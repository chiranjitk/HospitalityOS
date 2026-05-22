#!/usr/bin/env npx tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * StaySuite WiFi E2E Lifecycle Test — 500 User Full Check-in → Portal Login
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This test uses DIRECT DATABASE operations (no API auth needed) for:
 *   - Creating guests, bookings, check-ins
 *   - WiFi user provisioning (WiFiUser + RadCheck + RadReply + RadUserGroup)
 *   - Plan changes, deprovisioning
 *
 * And uses RADIUS (radclient) for actual authentication tests.
 *
 * PHASES:
 *   1. Create 500 Guests + Bookings across 6 room types (different plans)
 *   2. Check-in + WiFi Provisioning (500 WiFiUser + RADIUS credentials)
 *   3. Verify RADIUS User Creation (radcheck, radreply, radusergroup)
 *   4. RADIUS Auth Test — Simulate /connect portal login
 *   5. Plan Policy Verification (bandwidth, timeouts, data limits, device limits)
 *   6. Session Limit Enforcement (concurrent device test)
 *   7. Plan Change → RADIUS attribute update
 *   8. Expiry Test — Expired account rejection
 *   9. Deprovisioning — Check-out removes RADIUS access
 *  10. No-Plan Default — AAA Default Plan fallback
 *  11. Multi-Pool Validation (fn_get_user_pool_info, fn_get_pool_attr)
 *
 * RUN: npx tsx scripts/e2e-wifi-lifecycle-test.ts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Client as PgClient } from 'pg';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────
const DB_URL = 'postgresql://staysuite:Staysuite2025@localhost:5432/staysuite';
const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const PROPERTY_ID = '281fde73-7836-4511-b644-91f3663d8fcd';
const TOTAL_USERS = 500;
const BATCH_SIZE = 50;
const RADCLIENT = '/home/z/my-project/freeradius-install/bin/radclient';
const RADIUS_SECRET = 'testing123';

// Plan IDs
const PLANS: Record<string, string> = {
  standard:     'c80731b1-952f-45c0-b6e5-9cb77deb2590', // Free WiFi
  deluxe:       'adb7bd87-17eb-4b0e-bcf4-a6922445ac15', // Basic Plan
  executive:    '40486b74-cf4c-4f9e-82c8-d7621f36116c', // Standard Plan
  mountain:     '92fcd891-9963-4bd5-891b-28d202512db8', // Conference Plan
  valley:       '418b8a64-88c1-4529-a68f-e153bb92f224', // Premium Plan
  presidential: 'ee35e1ab-ebdd-4e9e-ac2b-8f786d501976', // VIP Suite Plan
};

// Room Type IDs
const ROOM_TYPES: Record<string, string> = {
  standard:     '4d5269a2-63ad-48e7-8683-4b0efca11567',
  deluxe:       '1aac4388-0d87-43da-a0bf-984fe39e5bcf',
  executive:    '22f53ea5-00fb-4b29-9dc6-a7834cc6b481',
  mountain:     '629ed75e-0ec4-4289-a2ad-76e7548255af',
  valley:       'ead9ba39-c74e-4cbe-8357-db3d5a106c27',
  presidential: 'bd3a1ffd-24b8-4185-b350-6bdae97bc426',
};

// Distribution per room type (should sum to 500)
const DISTRIBUTION: Record<string, number> = {
  standard:     150,
  deluxe:       120,
  executive:     60,
  mountain:      50,
  valley:        70,
  presidential:  50,
};

// ────────────────────────────────────────────────────────────
// Test Result Tracking
// ────────────────────────────────────────────────────────────
interface TestResult {
  phase: string;
  total: number;
  passed: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

const results: TestResult[] = [];

function createResult(phase: string): TestResult {
  return { phase, total: 0, passed: 0, failed: 0, errors: [], durationMs: 0 };
}

function log(r: TestResult, passed: boolean, detail: string) {
  r.total++;
  if (passed) {
    r.passed++;
  } else {
    r.failed++;
    r.errors.push(detail);
    if (r.errors.length <= 30) {
      console.log(`  ❌ ${detail}`);
    }
  }
}

// ────────────────────────────────────────────────────────────
// Data Generators
// ────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
  'Ananya','Diya','Myra','Sara','Aadhya','Priya','Riya','Kavya','Nisha','Pooja',
  'Rahul','Amit','Deepak','Vikram','Rajesh','Sunil','Manish','Suresh','Anil','Mohan',
  'Neha','Swati','Preeti','Meena','Komal','Ritu','Suman','Geeta','Rekha','Smita',
];
const LAST_NAMES = [
  'Sharma','Patel','Singh','Kumar','Gupta','Joshi','Rao','Reddy','Nair','Iyer',
  'Mukherjee','Banerjee','Chatterjee','Das','Bose','Ghosh','Saha','Roy','Pal','Dey',
  'Verma','Agarwal','Malhotra','Bhatia','Chauhan','Pillai','Menon','Pillay','Shah','Mehta',
];
const EMAIL_DOMAINS = ['gmail.com','yahoo.com','outlook.com','hotmail.com','rediffmail.com'];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPhone(): string { return `+91${Math.floor(7000000000 + Math.random() * 3000000000)}`; }

// ────────────────────────────────────────────────────────────
// RADIUS Auth Test
// ────────────────────────────────────────────────────────────
async function testRadiusAuth(username: string, password: string): Promise<{
  accepted: boolean;
  replyMessage: string;
  output: string;
}> {
  try {
    const { stdout, stderr } = await execAsync(
      `echo "User-Name=${username},User-Password=${password}" | ${RADCLIENT} -t 3 -r 1 127.0.0.1:1812 auth ${RADIUS_SECRET} 2>&1 || true`,
      { timeout: 8000 }
    );
    const output = stdout + stderr;
    const accepted = output.includes('Received Access-Accept');
    let replyMessage = '';
    const m = output.match(/Reply-Message\s*=\s*"([^"]*)"/);
    if (m) replyMessage = m[1];
    return { accepted, replyMessage, output: output.substring(0, 500) };
  } catch (err: any) {
    return { accepted: false, replyMessage: '', output: err.message?.substring(0, 200) || 'Error' };
  }
}

// ────────────────────────────────────────────────────────────
// Direct WiFi Provisioning
// ────────────────────────────────────────────────────────────
interface ProvisionedUser {
  bookingId: string;
  guestId: string;
  username: string;
  password: string;
  planId: string;
  planName: string;
  roomTypeName: string;
  roomTypeKey: string;
  wifiUserId: string;
}

async function provisionWifiUser(
  pg: PgClient,
  bookingId: string,
  guestId: string,
  planId: string,
  roomNumber: string,
  firstName: string,
  lastName: string,
): Promise<ProvisionedUser | null> {
  try {
    const suffix = roomNumber.replace(/[^0-9]/g, '');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const username = `room${suffix}${rand}`;
    const password = Math.random().toString(36).substring(2, 10);

    // Get plan details
    const planRes = await pg.query(`
      SELECT name, "downloadSpeed", "uploadSpeed", "dataLimit", "sessionLimit",
             "sessionTimeoutSec", "idleTimeoutSec", "maxDevices", "validityMinutes",
             "burstDownloadSpeed", "burstUploadSpeed"
      FROM "WiFiPlan" WHERE id = $1
    `, [planId]);
    const plan = planRes.rows[0];
    if (!plan) return null;

    const wifiUserId = randomUUID();
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + (plan.validityMinutes || 1440) * 60 * 1000);
    const groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_plan';

    // WiFiUser
    await pg.query(`
      INSERT INTO "WiFiUser" (id, "tenantId", "propertyId", "guestId", "bookingId",
        username, password, "planId", "validFrom", "validUntil", "maxSessions",
        "userType", status, "radiusSynced", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'guest','active',true,now(),now())
    `, [wifiUserId, TENANT_ID, PROPERTY_ID, guestId, bookingId,
        username, password, planId, validFrom, validUntil, plan.maxDevices || 1]);

    // RadCheck
    await pg.query(`
      INSERT INTO radcheck (id, "wifiUserId", username, attribute, op, value, "updatedAt") VALUES
        ($1, $4, $5, 'Cleartext-Password', ':=', $2, now()),
        ($3, $4, $5, 'Simultaneous-Use', ':=', $6, now())
    `, [randomUUID(), password, randomUUID(), wifiUserId, username, String(plan.maxDevices || 1)]);

    // Expiration
    const expDate = validUntil.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    await pg.query(`
      INSERT INTO radcheck (id, "wifiUserId", username, attribute, op, value, "updatedAt") VALUES ($1, $2, $3, 'Expiration', ':=', $4, now())
    `, [randomUUID(), wifiUserId, username, expDate]);

    // RadReply
    const dnBps = plan.downloadSpeed * 1000000;
    const upBps = plan.uploadSpeed * 1000000;
    const replyValues: [string, string][] = [
      ['Cryptsk-Bandwidth-Max-Down', String(dnBps)],
      ['Cryptsk-Bandwidth-Max-Up', String(upBps)],
      ['Cryptsk-Rate-Limit', `${plan.downloadSpeed}M/${plan.uploadSpeed}M`],
    ];
    if (plan.burstDownloadSpeed && plan.burstDownloadSpeed > 0) {
      replyValues.push(['Cryptsk-Bandwidth-Ceil-Down', String(plan.burstDownloadSpeed * 1000000)]);
    }
    if (plan.burstUploadSpeed && plan.burstUploadSpeed > 0) {
      replyValues.push(['Cryptsk-Bandwidth-Ceil-Up', String(plan.burstUploadSpeed * 1000000)]);
    }
    if (plan.sessionTimeoutSec && plan.sessionTimeoutSec > 0) {
      replyValues.push(['Session-Timeout', String(plan.sessionTimeoutSec)]);
    }
    if (plan.idleTimeoutSec && plan.idleTimeoutSec > 0) {
      replyValues.push(['Idle-Timeout', String(plan.idleTimeoutSec)]);
    }
    if (plan.dataLimit && plan.dataLimit > 0) {
      replyValues.push(['Cryptsk-Total-Limit', String(plan.dataLimit * 1024 * 1024)]);
    }

    for (const [attr, val] of replyValues) {
      await pg.query(`INSERT INTO radreply (id, "wifiUserId", username, attribute, op, value, "updatedAt") VALUES ($1,$2,$3,$4,'=',$5,now())`,
        [randomUUID(), wifiUserId, username, attr, val]);
    }

    // RadUserGroup
    await pg.query(`INSERT INTO radusergroup (id, username, groupname, priority) VALUES ($1,$2,$3,1)`,
      [randomUUID(), username, groupName]);

    return {
      bookingId, guestId, username, password, planId,
      planName: plan.name, roomTypeName: '', roomTypeKey: '',
      wifiUserId,
    };
  } catch (err: any) {
    console.error(`[provisionWifiUser] Error for booking ${bookingId}: ${err.message}\n${err.stack?.substring(0, 300)}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Main Test Runner
// ────────────────────────────────────────────────────────────
async function main() {
  const totalStart = Date.now();
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  StaySuite WiFi E2E Lifecycle Test — 500 Users');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  console.log('✅ Connected to PostgreSQL');

  // Verify system state
  const planCheck = await pg.query(`
    SELECT rt.code, rt.name as rt_name, wp.name as plan_name, wp."downloadSpeed", wp."maxDevices",
           wp."sessionTimeoutSec", wp."idleTimeoutSec", wp."dataLimit"
    FROM "RoomType" rt LEFT JOIN "WiFiPlan" wp ON rt."wifiPlanId" = wp.id ORDER BY rt.code
  `);
  console.log('\n📊 Room Type → Plan Mapping:');
  for (const row of planCheck.rows) {
    console.log(`  ${row.code.padEnd(5)} ${(row.rt_name || '').padEnd(22)} → ${(row.plan_name || 'NONE').padEnd(15)} (↓${row.downloadSpeed}M, ${row.maxDevices}dev, session:${row.sessionTimeoutSec}s, idle:${row.idleTimeoutSec}s, data:${row.dataLimit || 'unlimited'}MB)`);
  }

  // Get rooms per type
  const roomsByType: Record<string, Array<{id: string; number: string}>> = {};
  for (const [typeKey, typeId] of Object.entries(ROOM_TYPES)) {
    const res = await pg.query(`
      SELECT id, number FROM "Room" WHERE "roomTypeId" = $1 AND "propertyId" = $2 ORDER BY number
    `, [typeId, PROPERTY_ID]);
    roomsByType[typeKey] = res.rows;
    console.log(`  🏠 ${typeKey}: ${res.rows.length} rooms`);
  }

  // Clean up previous test data
  console.log('\n🧹 Cleaning up previous E2E test data...');
  await pg.query(`DELETE FROM radcheck WHERE username LIKE 'room%' AND username ~ 'room\\d{3,6}\\d{4}'`);
  await pg.query(`DELETE FROM radreply WHERE username LIKE 'room%' AND username ~ 'room\\d{3,6}\\d{4}'`);
  await pg.query(`DELETE FROM radusergroup WHERE username LIKE 'room%' AND username ~ 'room\\d{3,6}\\d{4}'`);
  await pg.query(`DELETE FROM radacct WHERE username LIKE 'room%' AND username ~ 'room\\d{3,6}\\d{4}'`);
  await pg.query(`DELETE FROM "WiFiUser" WHERE username LIKE 'room%' AND username ~ 'room\\d{3,6}\\d{4}'`);
  await pg.query(`DELETE FROM "BookingAuditLog" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "confirmationCode" LIKE 'E2E-%')`);
  await pg.query(`DELETE FROM "WiFiSession" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "confirmationCode" LIKE 'E2E-%')`);
  await pg.query(`DELETE FROM "Booking" WHERE "confirmationCode" LIKE 'E2E-%'`);
  await pg.query(`DELETE FROM "Guest" WHERE email LIKE 'e2e-%'`);
  console.log('  ✅ Cleaned up');

  // Load plan details for verification
  const planDetails = await pg.query(`
    SELECT id, name, "downloadSpeed", "uploadSpeed", "burstDownloadSpeed", "burstUploadSpeed",
           "dataLimit", "sessionLimit", "sessionTimeoutSec", "idleTimeoutSec", "maxDevices", "validityMinutes"
    FROM "WiFiPlan" WHERE id = ANY($1)
  `, [Object.values(PLANS)]);
  const planMap: Record<string, any> = {};
  for (const p of planDetails.rows) planMap[p.id] = p;

  // ══════════════════════════════════════════════════════════
  // PHASE 1: Create 500 Guests + Bookings + Check-in + WiFi Provision
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 1: Create 500 Guests + Bookings + Check-in + WiFi');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase1 = createResult('Phase 1: 500 User Full Provisioning');
  const phase1Start = Date.now();

  const allUsers: ProvisionedUser[] = [];
  let bookingIdx = 0;

  for (const [typeKey, count] of Object.entries(DISTRIBUTION)) {
    const typeId = ROOM_TYPES[typeKey];
    const planId = PLANS[typeKey];
    const planName = planMap[planId]?.name || 'Unknown';
    const rooms = roomsByType[typeKey] || [];

    if (rooms.length === 0) {
      console.log(`  ⚠️  No rooms for ${typeKey} — skipping ${count} users`);
      continue;
    }

    let created = 0;
    for (let i = 0; i < count; i++) {
      bookingIdx++;
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const email = `e2e-${bookingIdx}-${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomFrom(EMAIL_DOMAINS)}`;
      const phone = randomPhone();
      const guestId = randomUUID();
      const bookingId = randomUUID();
      const room = rooms[i % rooms.length];
      const confirmationCode = `E2E-${String(bookingIdx).padStart(6, '0')}`;
      const checkIn = new Date();
      const checkOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      try {
        await pg.query('BEGIN');

        // Guest
        await pg.query(`
          INSERT INTO "Guest" (id, "tenantId", "firstName", "lastName", email, phone, "loyaltyTier", "isVip", status, "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,'regular',false,'active',now(),now())
        `, [guestId, TENANT_ID, firstName, lastName, email, phone]);

        // Booking (confirmed)
        await pg.query(`
          INSERT INTO "Booking" (id, "tenantId", "propertyId", "confirmationCode", "primaryGuestId",
            "roomId", "roomTypeId", "checkIn", "checkOut", adults, children,
            "roomRate", taxes, fees, "totalAmount", currency, status, "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,0,100,18,0,118,'INR','confirmed',now(),now())
        `, [bookingId, TENANT_ID, PROPERTY_ID, confirmationCode, guestId, room.id, typeId, checkIn, checkOut]);

        // Check-in (update status)
        await pg.query(`
          UPDATE "Booking" SET status='checked_in', "actualCheckIn"=now(), "checkedInBy"='e2e-test'
          WHERE id=$1
        `, [bookingId]);

        await pg.query('COMMIT');

        // Provision WiFi
        const provisioned = await provisionWifiUser(pg, bookingId, guestId, planId, room.number, firstName, lastName);
        if (provisioned) {
          provisioned.roomTypeName = planMap[planId]?.name || '';
          provisioned.roomTypeKey = typeKey;
          allUsers.push(provisioned);
          created++;
          log(phase1, true, `${confirmationCode}: ${firstName} ${lastName} → ${planName} (user: ${provisioned.username})`);
        } else {
          log(phase1, false, `${confirmationCode}: WiFi provisioning failed`);
        }
      } catch (err: any) {
        await pg.query('ROLLBACK').catch(() => {});
        log(phase1, false, `${confirmationCode}: ${err.message?.substring(0, 80)}`);
      }
    }
    console.log(`  📝 ${typeKey}: ${created}/${count} users → ${planName}`);
  }

  phase1.durationMs = Date.now() - phase1Start;
  results.push(phase1);
  console.log(`\n  📊 Phase 1: ${phase1.passed}/${phase1.total} (${phase1.failed} failed) in ${(phase1.durationMs/1000).toFixed(1)}s`);
  console.log(`  ✅ Total provisioned: ${allUsers.length}`);

  if (allUsers.length === 0) {
    console.log('❌ No users provisioned — aborting');
    await pg.end();
    return;
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 2: Verify RADIUS User Creation
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 2: Verify RADIUS User Creation (DB-Level)');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase2 = createResult('Phase 2: RADIUS Verification');
  const phase2Start = Date.now();

  // Batch verification — count aggregates
  const totalRadCheck = await pg.query(`SELECT COUNT(*)::int as cnt FROM radcheck WHERE username = ANY($1)`,
    [allUsers.map(u => u.username)]);
  const totalRadReply = await pg.query(`SELECT COUNT(*)::int as cnt FROM radreply WHERE username = ANY($1)`,
    [allUsers.map(u => u.username)]);
  const totalRadGroup = await pg.query(`SELECT COUNT(*)::int as cnt FROM radusergroup WHERE username = ANY($1)`,
    [allUsers.map(u => u.username)]);
  const totalWifiUser = await pg.query(`SELECT COUNT(*)::int as cnt FROM "WiFiUser" WHERE id = ANY($1)`,
    [allUsers.map(u => u.wifiUserId)]);

  const checkOk = totalRadCheck.rows[0].cnt >= allUsers.length;
  const replyOk = totalRadReply.rows[0].cnt >= allUsers.length;
  const groupOk = totalRadGroup.rows[0].cnt >= allUsers.length;
  const wifiOk = totalWifiUser.rows[0].cnt >= allUsers.length;

  log(phase2, checkOk, `RadCheck: ${totalRadCheck.rows[0].cnt} rows for ${allUsers.length} users ${checkOk ? '✓' : '✗'}`);
  log(phase2, replyOk, `RadReply: ${totalRadReply.rows[0].cnt} rows for ${allUsers.length} users ${replyOk ? '✓' : '✗'}`);
  log(phase2, groupOk, `RadUserGroup: ${totalRadGroup.rows[0].cnt} rows for ${allUsers.length} users ${groupOk ? '✓' : '✗'}`);
  log(phase2, wifiOk, `WiFiUser: ${totalWifiUser.rows[0].cnt} active users ${wifiOk ? '✓' : '✗'}`);

  // Detailed check for a sample per plan type
  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length === 0) continue;
    const sample = planUsers[0];

    // Check specific user
    const radCheck = await pg.query(`SELECT attribute, value FROM radcheck WHERE username = $1`, [sample.username]);
    const hasPassword = radCheck.rows.some(r => r.attribute === 'Cleartext-Password');
    const hasSimUse = radCheck.rows.some(r => r.attribute === 'Simultaneous-Use');
    const hasExpiration = radCheck.rows.some(r => r.attribute === 'Expiration');

    log(phase2, hasPassword, `${sample.username} (${sample.planName}): Cleartext-Password ${hasPassword ? '✓' : '✗'}`);
    log(phase2, hasSimUse, `${sample.username} (${sample.planName}): Simultaneous-Use ${hasSimUse ? '✓' : '✗'}`);
    log(phase2, hasExpiration, `${sample.username} (${sample.planName}): Expiration ${hasExpiration ? '✓' : '✗'}`);

    const radReply = await pg.query(`SELECT attribute, value FROM radreply WHERE username = $1`, [sample.username]);
    const hasBw = radReply.rows.some(r => r.attribute === 'Cryptsk-Bandwidth-Max-Down' || r.attribute === 'WISPr-Bandwidth-Max-Down');
    log(phase2, hasBw, `${sample.username} (${sample.planName}): Bandwidth attrs ${hasBw ? '✓' : '✗'}`);

    const radGroup = await pg.query(`SELECT groupname FROM radusergroup WHERE username = $1`, [sample.username]);
    log(phase2, radGroup.rows.length > 0, `${sample.username} (${sample.planName}): Group ${radGroup.rows[0]?.groupname || '✗'}`);
  }

  phase2.durationMs = Date.now() - phase2Start;
  results.push(phase2);
  console.log(`\n  📊 Phase 2: ${phase2.passed}/${phase2.total} (${phase2.failed} failed) in ${(phase2.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 3: RADIUS Auth — Simulate /connect Portal Login
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 3: RADIUS Auth — Simulate /connect Portal Login');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase3 = createResult('Phase 3: RADIUS Auth');
  const phase3Start = Date.now();

  // Test 2 users per plan type + 20 random = 32 total
  const testSamples: ProvisionedUser[] = [];
  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    testSamples.push(...planUsers.slice(0, 2));
  }
  // Add 20 random
  const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
  for (const u of shuffled.slice(0, 20)) {
    if (!testSamples.includes(u)) testSamples.push(u);
  }

  console.log(`  Testing RADIUS auth for ${testSamples.length} users...`);

  for (const user of testSamples) {
    const result = await testRadiusAuth(user.username, user.password);
    log(phase3, result.accepted,
      `${user.username} (${user.planName}): ${result.accepted ? '✓ Accept' : '✗ Reject — ' + (result.replyMessage || result.output.substring(0, 80))}`);
  }

  // Test wrong password
  if (testSamples.length > 0) {
    const wrongUser = testSamples[0];
    const wrongResult = await testRadiusAuth(wrongUser.username, 'WRONG_PASSWORD');
    log(phase3, !wrongResult.accepted,
      `Wrong password: ${!wrongResult.accepted ? '✓ Rejected' : '✗ ACCEPTED (SECURITY!)'}`);
  }

  // Test non-existent user
  const ghostResult = await testRadiusAuth('ghost_nonexistent_user', 'nopass');
  log(phase3, !ghostResult.accepted,
    `Non-existent user: ${!ghostResult.accepted ? '✓ Rejected' : '✗ ACCEPTED (SECURITY!)'}`);

  phase3.durationMs = Date.now() - phase3Start;
  results.push(phase3);
  console.log(`\n  📊 Phase 3: ${phase3.passed}/${phase3.total} (${phase3.failed} failed) in ${(phase3.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 4: Plan Policy Verification
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 4: Plan Policy Verification (Bandwidth, Timeouts, Limits)');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase4 = createResult('Phase 4: Plan Policy Verification');
  const phase4Start = Date.now();

  // Sample: 5 users per plan type
  for (const [planKey, planId] of Object.entries(PLANS)) {
    const plan = planMap[planId];
    if (!plan) continue;
    const planUsers = allUsers.filter(u => u.planId === planId).slice(0, 5);

    for (const user of planUsers) {
      const reply = await pg.query(`SELECT attribute, value FROM radreply WHERE username = $1`, [user.username]);
      const check = await pg.query(`SELECT attribute, value FROM radcheck WHERE username = $1`, [user.username]);

      const attrs: Record<string, string> = {};
      for (const r of [...reply.rows, ...check.rows]) attrs[r.attribute] = r.value;

      // Bandwidth
      const expectedDnBps = plan.downloadSpeed * 1000000;
      const expectedUpBps = plan.uploadSpeed * 1000000;
      const dnVal = Number(attrs['Cryptsk-Bandwidth-Max-Down'] || attrs['WISPr-Bandwidth-Max-Down'] || 0);
      const upVal = Number(attrs['Cryptsk-Bandwidth-Max-Up'] || attrs['WISPr-Bandwidth-Max-Up'] || 0);

      const dnOk = dnVal === expectedDnBps;
      const upOk = upVal === expectedUpBps;
      log(phase4, dnOk, `${user.username}: ↓BW ${dnOk ? '✓' : `✗ expected ${expectedDnBps}, got ${dnVal}`}`);
      log(phase4, upOk, `${user.username}: ↑BW ${upOk ? '✓' : `✗ expected ${expectedUpBps}, got ${upVal}`}`);

      // Session timeout
      if (plan.sessionTimeoutSec && plan.sessionTimeoutSec > 0) {
        const stOk = attrs['Session-Timeout'] === String(plan.sessionTimeoutSec);
        log(phase4, stOk, `${user.username}: Session-Timeout ${stOk ? '✓' : `✗ expected ${plan.sessionTimeoutSec}, got ${attrs['Session-Timeout']}`}`);
      }

      // Idle timeout
      if (plan.idleTimeoutSec && plan.idleTimeoutSec > 0) {
        const itOk = attrs['Idle-Timeout'] === String(plan.idleTimeoutSec);
        log(phase4, itOk, `${user.username}: Idle-Timeout ${itOk ? '✓' : `✗ expected ${plan.idleTimeoutSec}, got ${attrs['Idle-Timeout']}`}`);
      }

      // Data limit
      if (plan.dataLimit && plan.dataLimit > 0) {
        const expectedBytes = plan.dataLimit * 1024 * 1024;
        const dlVal = Number(attrs['Cryptsk-Total-Limit'] || attrs['Mikrotik-Total-Limit'] || 0);
        const dlOk = dlVal === expectedBytes;
        log(phase4, dlOk, `${user.username}: Data limit ${dlOk ? '✓' : `✗ expected ${expectedBytes}, got ${dlVal}`}`);
      }

      // Simultaneous-Use
      const simOk = attrs['Simultaneous-Use'] === String(plan.maxDevices);
      log(phase4, simOk, `${user.username}: Simultaneous-Use ${simOk ? '✓' : `✗ expected ${plan.maxDevices}, got ${attrs['Simultaneous-Use']}`}`);

      // Expiration
      const hasExp = !!attrs['Expiration'];
      log(phase4, hasExp, `${user.username}: Expiration ${hasExp ? '✓' : '✗ MISSING'}`);
    }
  }

  phase4.durationMs = Date.now() - phase4Start;
  results.push(phase4);
  console.log(`\n  📊 Phase 4: ${phase4.passed}/${phase4.total} (${phase4.failed} failed) in ${(phase4.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 5: Session Limit Enforcement
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 5: Session Limit (Concurrent Device) Enforcement');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase5 = createResult('Phase 5: Session Limit');
  const phase5Start = Date.now();

  for (const [planKey, planId] of Object.entries(PLANS)) {
    const plan = planMap[planId];
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length === 0) continue;
    const testUser = planUsers[0];
    const maxDev = plan?.maxDevices || 1;

    console.log(`  Testing ${plan?.name || planKey}: maxDevices=${maxDev}, user=${testUser.username}`);

    try {
      // Clean up any test radacct rows
      await pg.query(`DELETE FROM radacct WHERE username = $1 AND acctsessionid LIKE 'e2e-sess-%'`, [testUser.username]);

      // Insert (maxDev - 1) active sessions
      for (let i = 0; i < maxDev - 1; i++) {
        await pg.query(`
          INSERT INTO radacct (acctsessionid, acctuniqueid, username, nasipaddress, nasporttype,
            acctstarttime, acctupdatetime, acctstoptime, acctsessiontime, acctauthentic,
            acctinputoctets, acctoutputoctets, calledstationid, callingstationid,
            servicetype, framedprotocol, framedipaddress, updatedat)
          VALUES ($1,$2,$3,'127.0.0.1','Wireless-802.11',now(),now(),NULL,0,'RADIUS',
            0,0,'00:00:00:00:00:00',$4,'Framed-User','PPP',$5,now())
        `, [`e2e-sess-${i}`, `e2e-uid-${i}-${Date.now()}`, testUser.username,
            `AA:BB:CC:DD:EE:F${i}`, `10.10.10.${100 + i}`]);
      }

      // Auth should SUCCEED (under limit)
      const underResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase5, underResult.accepted,
        `${testUser.username}: Under limit (${maxDev - 1}/${maxDev}) ${underResult.accepted ? '✓ Accept' : '✗ Reject'}`);

      // Insert one more (at limit)
      await pg.query(`
        INSERT INTO radacct (acctsessionid, acctuniqueid, username, nasipaddress, nasporttype,
          acctstarttime, acctupdatetime, acctstoptime, acctsessiontime, acctauthentic,
          acctinputoctets, acctoutputoctets, calledstationid, callingstationid,
          servicetype, framedprotocol, framedipaddress, updatedat)
        VALUES ($1,$2,$3,'127.0.0.1','Wireless-802.11',now(),now(),NULL,0,'RADIUS',
          0,0,'00:00:00:00:00:00','AA:BB:CC:DD:EE:FA','Framed-User','PPP','10.10.10.199',now())
      `, [`e2e-sess-at-limit`, `e2e-uid-at-${Date.now()}`, testUser.username]);

      // Auth should REJECT (at limit)
      const atResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase5, !atResult.accepted,
        `${testUser.username}: At limit (${maxDev}/${maxDev}) ${!atResult.accepted ? '✓ Reject' : '✗ Accept (SHOULD REJECT!)'}`);

      // Cleanup
      await pg.query(`DELETE FROM radacct WHERE username = $1 AND acctsessionid LIKE 'e2e-sess-%'`, [testUser.username]);

    } catch (err: any) {
      log(phase5, false, `${testUser.username}: Error — ${err.message?.substring(0, 80)}`);
    }
  }

  phase5.durationMs = Date.now() - phase5Start;
  results.push(phase5);
  console.log(`\n  📊 Phase 5: ${phase5.passed}/${phase5.total} (${phase5.failed} failed) in ${(phase5.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 6: Plan Change → RADIUS Attribute Update
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 6: Plan Change → RADIUS Attribute Update');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase6 = createResult('Phase 6: Plan Change');
  const phase6Start = Date.now();

  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length < 2) continue;
    const testUser = planUsers[1]; // Use second user
    const plan = planMap[planId];

    // Upgrade to next plan
    const planKeys = Object.keys(PLANS);
    const currentIdx = planKeys.indexOf(planKey);
    const upgradeKey = planKeys[Math.min(currentIdx + 1, planKeys.length - 1)];
    const upgradePlanId = PLANS[upgradeKey];
    const upgradePlan = planMap[upgradePlanId];

    if (upgradePlanId === planId) continue; // Skip if same plan (VIP → VIP)

    try {
      // Update WiFiUser plan
      await pg.query(`UPDATE "WiFiUser" SET "planId" = $1 WHERE id = $2`, [upgradePlanId, testUser.wifiUserId]);

      // Update RADIUS attributes
      const newDnBps = upgradePlan.downloadSpeed * 1000000;
      const newUpBps = upgradePlan.uploadSpeed * 1000000;

      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Bandwidth-Max-Down'`,
        [String(newDnBps), testUser.username]);
      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Bandwidth-Max-Up'`,
        [String(newUpBps), testUser.username]);
      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Rate-Limit'`,
        [`${upgradePlan.downloadSpeed}M/${upgradePlan.uploadSpeed}M`, testUser.username]);
      await pg.query(`UPDATE radcheck SET value = $1 WHERE username = $2 AND attribute = 'Simultaneous-Use'`,
        [String(upgradePlan.maxDevices), testUser.username]);

      // Update group
      const newGroupName = upgradePlan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_plan';
      await pg.query(`UPDATE radusergroup SET groupname = $1 WHERE username = $2`,
        [newGroupName, testUser.username]);

      // Verify via RADIUS auth with new bandwidth
      const authResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase6, authResult.accepted,
        `${testUser.username}: Auth after plan change ${authResult.accepted ? '✓' : '✗'}`);

      // Verify bandwidth in DB
      const newReply = await pg.query(`SELECT value FROM radreply WHERE username = $1 AND attribute = 'Cryptsk-Bandwidth-Max-Down'`, [testUser.username]);
      const bwUpdated = newReply.rows[0]?.value === String(newDnBps);
      log(phase6, bwUpdated,
        `${testUser.username}: BW updated ${plan?.name}→${upgradePlan.name} ${bwUpdated ? '✓' : '✗'}`);

      // Revert back
      await pg.query(`UPDATE "WiFiUser" SET "planId" = $1 WHERE id = $2`, [planId, testUser.wifiUserId]);
      const origDnBps = plan.downloadSpeed * 1000000;
      const origUpBps = plan.uploadSpeed * 1000000;
      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Bandwidth-Max-Down'`,
        [String(origDnBps), testUser.username]);
      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Bandwidth-Max-Up'`,
        [String(origUpBps), testUser.username]);
      await pg.query(`UPDATE radreply SET value = $1 WHERE username = $2 AND attribute = 'Cryptsk-Rate-Limit'`,
        [`${plan.downloadSpeed}M/${plan.uploadSpeed}M`, testUser.username]);
      await pg.query(`UPDATE radcheck SET value = $1 WHERE username = $2 AND attribute = 'Simultaneous-Use'`,
        [String(plan.maxDevices), testUser.username]);
      const origGroupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_plan';
      await pg.query(`UPDATE radusergroup SET groupname = $1 WHERE username = $2`,
        [origGroupName, testUser.username]);

    } catch (err: any) {
      log(phase6, false, `${testUser.username}: Error — ${err.message?.substring(0, 80)}`);
    }
  }

  phase6.durationMs = Date.now() - phase6Start;
  results.push(phase6);
  console.log(`\n  📊 Phase 6: ${phase6.passed}/${phase6.total} (${phase6.failed} failed) in ${(phase6.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 7: Expiry Test
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 7: Expiry Test — Account Validity Expired');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase7 = createResult('Phase 7: Expiry');
  const phase7Start = Date.now();

  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length < 3) continue;
    const testUser = planUsers[2];
    const plan = planMap[planId];

    try {
      // Expire the user
      const pastDate = new Date(Date.now() - 3600000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
      await pg.query(`UPDATE "WiFiUser" SET "validUntil" = now() - interval '1 hour' WHERE id = $1`, [testUser.wifiUserId]);
      await pg.query(`UPDATE radcheck SET value = $1 WHERE username = $2 AND attribute = 'Expiration'`, [pastDate, testUser.username]);

      // Should REJECT
      const expiredResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase7, !expiredResult.accepted,
        `${testUser.username} (${plan?.name}): Expired ${!expiredResult.accepted ? '✓ Rejected' : '✗ ACCEPTED (SHOULD REJECT!)'}`);

      // Restore
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
      await pg.query(`UPDATE "WiFiUser" SET "validUntil" = now() + interval '3 days' WHERE id = $1`, [testUser.wifiUserId]);
      await pg.query(`UPDATE radcheck SET value = $1 WHERE username = $2 AND attribute = 'Expiration'`, [futureDate, testUser.username]);

      // Should ACCEPT again
      const restoredResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase7, restoredResult.accepted,
        `${testUser.username} (${plan?.name}): Restored ${restoredResult.accepted ? '✓ Accepted' : '✗ Rejected (SHOULD ACCEPT!)'}`);

    } catch (err: any) {
      log(phase7, false, `${testUser.username}: Error — ${err.message?.substring(0, 80)}`);
    }
  }

  phase7.durationMs = Date.now() - phase7Start;
  results.push(phase7);
  console.log(`\n  📊 Phase 7: ${phase7.passed}/${phase7.total} (${phase7.failed} failed) in ${(phase7.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 8: Deprovisioning Test
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 8: Deprovisioning — RADIUS Access Removed');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase8 = createResult('Phase 8: Deprovisioning');
  const phase8Start = Date.now();

  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length < 4) continue;
    const testUser = planUsers[planUsers.length - 1]; // Last user

    try {
      // Deprovision
      await pg.query(`DELETE FROM radcheck WHERE username = $1`, [testUser.username]);
      await pg.query(`DELETE FROM radreply WHERE username = $1`, [testUser.username]);
      await pg.query(`DELETE FROM radusergroup WHERE username = $1`, [testUser.username]);
      await pg.query(`UPDATE "WiFiUser" SET status = 'revoked' WHERE id = $1`, [testUser.wifiUserId]);

      // Verify no RADIUS creds
      const check = await pg.query(`SELECT * FROM radcheck WHERE username = $1`, [testUser.username]);
      const reply = await pg.query(`SELECT * FROM radreply WHERE username = $1`, [testUser.username]);
      const group = await pg.query(`SELECT * FROM radusergroup WHERE username = $1`, [testUser.username]);
      const wifi = await pg.query(`SELECT status FROM "WiFiUser" WHERE id = $1`, [testUser.wifiUserId]);

      const credsRemoved = check.rows.length === 0 && reply.rows.length === 0 && group.rows.length === 0;
      log(phase8, credsRemoved, `${testUser.username}: Creds removed ${credsRemoved ? '✓' : '✗'}`);

      const statusOk = wifi.rows[0]?.status === 'revoked';
      log(phase8, statusOk, `${testUser.username}: Status revoked ${statusOk ? '✓' : '✗ (' + wifi.rows[0]?.status + ')'}`);

      // Should REJECT
      const authResult = await testRadiusAuth(testUser.username, testUser.password);
      log(phase8, !authResult.accepted, `${testUser.username}: Auth ${!authResult.accepted ? '✓ Rejected' : '✗ ACCEPTED (SHOULD REJECT!)'}`);

      // Remove from user list
      const idx = allUsers.findIndex(u => u.username === testUser.username);
      if (idx >= 0) allUsers.splice(idx, 1);

    } catch (err: any) {
      log(phase8, false, `${testUser.username}: Error — ${err.message?.substring(0, 80)}`);
    }
  }

  phase8.durationMs = Date.now() - phase8Start;
  results.push(phase8);
  console.log(`\n  📊 Phase 8: ${phase8.passed}/${phase8.total} (${phase8.failed} failed) in ${(phase8.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 9: No-Plan Default — AAA Default Plan
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 9: No-Plan Default — AAA Default Plan Fallback');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase9 = createResult('Phase 9: AAA Default Plan');
  const phase9Start = Date.now();

  try {
    const aaaCheck = await pg.query(`
      SELECT aaa."defaultPlanId", wp.name FROM "WiFiAAAConfig" aaa
      LEFT JOIN "WiFiPlan" wp ON aaa."defaultPlanId" = wp.id
      WHERE aaa."propertyId" = $1
    `, [PROPERTY_ID]);
    const defaultPlanId = aaaCheck.rows[0]?.defaultPlanId;
    const defaultPlanName = aaaCheck.rows[0]?.name;
    console.log(`  AAA Default Plan: ${defaultPlanName} (${defaultPlanId})`);

    log(phase9, !!defaultPlanId, `AAA config has default plan: ${defaultPlanId ? '✓ ' + defaultPlanName : '✗ MISSING'}`);

    // Provision a user with the AAA default plan directly
    const testGuestId = randomUUID();
    const testBookingId = randomUUID();
    const testRoom = roomsByType.standard?.[0];

    if (testRoom && defaultPlanId) {
      const provisioned = await provisionWifiUser(pg, testBookingId, testGuestId, defaultPlanId, testRoom.number, 'DefaultTest', 'User');
      if (provisioned) {
        const authResult = await testRadiusAuth(provisioned.username, provisioned.password);
        log(phase9, authResult.accepted,
          `AAA default user ${provisioned.username}: ${authResult.accepted ? '✓ Auth OK' : '✗ Auth FAILED'}`);

        // Check plan in WiFiUser
        const wifiCheck = await pg.query(`SELECT "planId" FROM "WiFiUser" WHERE username = $1`, [provisioned.username]);
        const correctPlan = wifiCheck.rows[0]?.planId === defaultPlanId;
        log(phase9, correctPlan, `AAA default plan assignment: ${correctPlan ? '✓' : '✗ got ' + wifiCheck.rows[0]?.planId}`);

        // Cleanup
        await pg.query(`DELETE FROM radcheck WHERE username = $1`, [provisioned.username]);
        await pg.query(`DELETE FROM radreply WHERE username = $1`, [provisioned.username]);
        await pg.query(`DELETE FROM radusergroup WHERE username = $1`, [provisioned.username]);
        await pg.query(`DELETE FROM "WiFiUser" WHERE id = $1`, [provisioned.wifiUserId]);
      }
    }

    // Cleanup test data
    await pg.query(`DELETE FROM "Booking" WHERE id = $1`, [testBookingId]);
    await pg.query(`DELETE FROM "Guest" WHERE id = $1`, [testGuestId]);

  } catch (err: any) {
    log(phase9, false, `AAA default test error: ${err.message?.substring(0, 100)}`);
  }

  phase9.durationMs = Date.now() - phase9Start;
  results.push(phase9);
  console.log(`\n  📊 Phase 9: ${phase9.passed}/${phase9.total} (${phase9.failed} failed) in ${(phase9.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // PHASE 10: Multi-Pool Validation
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 10: Multi-Pool Validation');
  console.log('═══════════════════════════════════════════════════════════════');
  const phase10 = createResult('Phase 10: Multi-Pool');
  const phase10Start = Date.now();

  // Verify WiFiPlanIPPool mappings
  const poolMappings = await pg.query(`
    SELECT pp."planId", wp.name as plan_name, pp."poolId", ip.name as pool_name, pp.priority
    FROM "WiFiPlanIPPool" pp
    JOIN "WiFiPlan" wp ON pp."planId" = wp.id
    JOIN "IpPool" ip ON pp."poolId" = ip.id
    ORDER BY wp.name, pp.priority
  `);

  console.log('  📋 Plan → Pool Mappings:');
  for (const m of poolMappings.rows) {
    console.log(`    ${m.plan_name} → ${m.pool_name} (priority: ${m.priority})`);
  }

  // Standard Plan should have multi-pool
  const standardPools = poolMappings.rows.filter(r => r.plan_name === 'Standard Plan');
  log(phase10, standardPools.length >= 2,
    `Standard Plan multi-pool: ${standardPools.length >= 2 ? '✓ has ' + standardPools.length + ' pools' : '✗ only ' + standardPools.length}`);

  // Test fn_get_user_pool_info for each plan type
  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length === 0) continue;
    const testUser = planUsers[0];

    try {
      const poolInfo = await pg.query(`SELECT * FROM fn_get_user_pool_info($1)`, [testUser.username]);
      log(phase10, poolInfo.rows.length >= 1,
        `${testUser.username} (${planMap[planId]?.name}): fn_get_user_pool_info returned ${poolInfo.rows.length} pools`);

      for (const pi of poolInfo.rows) {
        console.log(`      Pool: ${pi.pool_name} (source: ${pi.source})`);
      }
    } catch (err: any) {
      log(phase10, false, `${testUser.username}: fn_get_user_pool_info error — ${err.message?.substring(0, 80)}`);
    }
  }

  // Test fn_get_pool_attr
  for (const [planKey, planId] of Object.entries(PLANS)) {
    const planUsers = allUsers.filter(u => u.planId === planId);
    if (planUsers.length === 0) continue;
    const testUser = planUsers[0];

    try {
      const poolName = await pg.query(`SELECT fn_get_pool_attr($1, 'pool_name') as name`, [testUser.username]);
      const gateway = await pg.query(`SELECT fn_get_pool_attr($1, 'gateway') as gw`, [testUser.username]);
      log(phase10, !!poolName.rows[0]?.name,
        `${testUser.username}: pool=${poolName.rows[0]?.name || 'NULL'}, gw=${gateway.rows[0]?.gw || 'NULL'}`);
    } catch (err: any) {
      log(phase10, false, `${testUser.username}: fn_get_pool_attr error — ${err.message?.substring(0, 80)}`);
    }
  }

  phase10.durationMs = Date.now() - phase10Start;
  results.push(phase10);
  console.log(`\n  📊 Phase 10: ${phase10.passed}/${phase10.total} (${phase10.failed} failed) in ${(phase10.durationMs/1000).toFixed(1)}s`);

  // ══════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════
  const totalDurationMs = Date.now() - totalStart;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  🏁 FINAL E2E TEST REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  let grandTotal = 0, grandPassed = 0, grandFailed = 0;

  for (const r of results) {
    grandTotal += r.total;
    grandPassed += r.passed;
    grandFailed += r.failed;
    const pct = r.total > 0 ? ((r.passed / r.total) * 100).toFixed(1) : '0';
    const icon = r.failed > 0 ? '❌' : '✅';
    console.log(`  ${icon} ${r.phase.padEnd(55)} ${String(r.passed).padStart(5)}/${String(r.total).padEnd(5)} (${pct}%)  [${(r.durationMs/1000).toFixed(1)}s]`);
  }

  console.log('');
  const overallPct = grandTotal > 0 ? ((grandPassed / grandTotal) * 100).toFixed(1) : '0';
  const overallIcon = grandFailed > 0 ? '❌' : '✅';
  console.log(`  ${overallIcon} ${'OVERALL'.padEnd(55)} ${String(grandPassed).padStart(5)}/${String(grandTotal).padEnd(5)} (${overallPct}%)  [${(totalDurationMs/1000).toFixed(1)}s]`);
  console.log('');

  // Summary stats
  console.log(`  📊 Summary:`);
  console.log(`     Total Users Provisioned:  ${allUsers.length}`);
  console.log(`     Plan Types Tested:        ${Object.keys(PLANS).length}`);
  console.log(`     Pool Types:               ${poolMappings.rows.length} mappings`);
  console.log(`     Total Checks:             ${grandTotal}`);
  console.log(`     Passed:                   ${grandPassed}`);
  console.log(`     Failed:                   ${grandFailed}`);
  console.log(`     Total Test Time:          ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log('');

  // Error summary
  if (grandFailed > 0) {
    console.log('  ⚠️  FAILED CHECKS (first 50):');
    let errCount = 0;
    for (const r of results) {
      for (const e of r.errors) {
        if (errCount < 50) console.log(`    ❌ ${e}`);
        errCount++;
      }
    }
    if (errCount > 50) console.log(`    ... and ${errCount - 50} more errors`);
    console.log('');
  }

  await pg.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
