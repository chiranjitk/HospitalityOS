/**
 * seed-final-fix.ts
 *
 * Fixes broken seed data for 7 previously-failed tables + seeds 13 never-attempted tables.
 *
 * FAILED TABLE FIXES:
 *   1. BandwidthUsageSession  – INT32 overflow on downloadBytes (2147483648 > MAX_INT32)
 *   2. IoTCommand / IoTReading – Prisma accessor naming (iOTCommand vs iotCommand)
 *   3. DatabaseBackup          – createdBy passed as string 'system', expects UUID
 *   4. OverbookingLog         – performedBy passed as string 'system', expects UUID
 *   5. WiFiUserStatusHistory  – wrong field names (wifiUserId→removed, missing propertyId/username)
 *   6. WebCategorySchedule    – stray `description` field not in schema
 *   7. MinibarConsumption     – reseed with skipDuplicates (already seeded but verify)
 *
 * NEW TABLES:
 *   OtaChannel, OTAContentProfile, ChannelCancellationPolicy, ChannelContentField,
 *   ChannelContentSync, ChannelCurrencyConfig, ChannelCurrencyHistory,
 *   ChannelGuestRateConfig, ChannelPromoCode, ChannelTaxMapping,
 *   LosPricingTier, RateDerivationRule, PricingSchedulerLog
 */

import { createHash } from 'crypto';

// Deterministic UUID from seed string (same algo as seed.ts)
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31),
  ].join('-');
};

// ─── Shared UUIDs (matching seed.ts / seed-empty-tables.ts) ───
const T1 = uuid('tenant-1');
const T2 = uuid('tenant-2');
const P1 = uuid('property-1');
const P2 = uuid('property-2');
const U1 = uuid('user-1');
const U2 = uuid('user-2');
const U3 = uuid('user-3');
const UP1 = uuid('user-platform');
const UT2_1 = uuid('user-t2-1');

// Rooms
const ROOM_101 = uuid('room-101');
const ROOM_305 = uuid('room-305');
const ROOM_501 = uuid('room-501');
const ROOM_510 = uuid('room-510');
const ROOM_801 = uuid('room-801');
const ROOM_1002 = uuid('room-1002');

// Room types
const RT1 = uuid('roomtype-1');
const RT2 = uuid('roomtype-2');
const RT3 = uuid('roomtype-3');
const RT4 = uuid('roomtype-4');

// Bookings
const BK1 = uuid('booking-1');
const BK2 = uuid('booking-2');
const BK3 = uuid('booking-3');
const BK4 = uuid('booking-4');
const BK5 = uuid('booking-5');
const BK6 = uuid('booking-6');

// Folios
const FOL1 = uuid('folio-1');
const FOL2 = uuid('folio-2');
const FOL6 = uuid('folio-6');

// Rate plans
const RP1 = uuid('rateplan-1');
const RP2 = uuid('rateplan-2');
const RP3 = uuid('rateplan-3');
const RP4 = uuid('rateplan-4');
const RP5 = uuid('rateplan-5');
const RP6 = uuid('rateplan-6');
const RP7 = uuid('rateplan-7');

// Bandwidth
const BW_POLICY_FREE = uuid('bwpolicy-free');
const BW_POLICY_STD = uuid('bwpolicy-standard');
const BW_POLICY_PREM = uuid('bwpolicy-premium');

// Channel connections
const CH1 = uuid('channel-conn-1');
const CH2 = uuid('channel-conn-2');

// IoT devices
const IOT1 = uuid('iot-1');
const IOT2 = uuid('iot-2');
const IOT3 = uuid('iot-3');

// WiFi sessions & users
const WS1 = uuid('wifisession-1');
const WS2 = uuid('wifisession-2');
const WS3 = uuid('wifisession-9');
const WU1 = uuid('wifiuser-1');
const WU2 = uuid('wifiuser-2');

// Web categories
const WC1 = uuid('wc-1');
const WC2 = uuid('wc-2');

// Cancellation policies
const CP_1 = uuid('cp-1');
const CP_2 = uuid('cp-2');
const CP_3 = uuid('cp-3');

// Commission rules
const CRULE_1 = uuid('crule-1');

// Minibar items
const MB_3 = uuid('mbitem-3');

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

export async function seedFinalFix(prisma: any) {
  console.log('\n🔧 Running seed-final-fix — fixing broken tables & seeding new ones...\n');

  // ════════════════════════════════════════════════════════════════
  // SECTION 1 — FIX BROKEN TABLES
  // ════════════════════════════════════════════════════════════════

  // ── 1. BandwidthUsageSession (INT32 overflow fix) ──────────────
  console.log('  [FIX 1/7] BandwidthUsageSession — fixing INT32 overflow...');
  try {
    // Clear any previously-failed inserts (they wouldn't exist due to error, but be safe)
    await prisma.bandwidthUsageSession.deleteMany({
      where: { id: { in: [uuid('bus-1'), uuid('bus-2'), uuid('bus-3')] } },
    }).catch(() => {});
    await prisma.bandwidthUsageSession.createMany({
      data: [
        // bus-1: premium session — within INT32 limits
        {
          id: uuid('bus-1'),
          tenantId: T1,
          propertyId: P1,
          sessionId: WS1,
          username: 'guest.amit.mukherjee',
          ipAddress: '192.168.10.55',
          macAddress: 'AA:BB:CC:DD:EE:01',
          planId: BW_POLICY_PREM,
          policyId: BW_POLICY_PREM,
          downloadBytes: 536870912,   // 512 MB — safely under INT32 max
          uploadBytes: 134217728,     // 128 MB
          durationSeconds: 3600,
          startedAt: daysAgo(0),
        },
        // bus-2: standard session — was 2147483648 (overflow!), now 1 GB
        {
          id: uuid('bus-2'),
          tenantId: T1,
          propertyId: P1,
          sessionId: WS2,
          username: 'guest.rahul.banerjee',
          ipAddress: '192.168.10.88',
          macAddress: 'AA:BB:CC:DD:EE:02',
          downloadBytes: 1073741824,  // 1 GB — under INT32 max (2147483647)
          uploadBytes: 268435456,    // 256 MB
          durationSeconds: 7200,
          startedAt: daysAgo(1),
          endedAt: daysAgo(0),
        },
        // bus-3: free tier session
        {
          id: uuid('bus-3'),
          tenantId: T1,
          propertyId: P1,
          sessionId: WS3,
          username: 'guest.sneha.gupta',
          ipAddress: '192.168.10.102',
          downloadBytes: 268435456,   // 256 MB
          uploadBytes: 67108864,     // 64 MB
          durationSeconds: 1800,
          startedAt: daysAgo(0),
        },
      ],
    });
    console.log('    ✅ BandwidthUsageSession seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ BandwidthUsageSession:', e.message?.substring(0, 120));
  }

  // ── 2. IoTCommand (accessor naming fix) ────────────────────────
  console.log('  [FIX 2/7] IoTCommand...');
  try {
    // Prisma generates PascalCase accessor for IoTCommand (unusual but confirmed)
    const iotCmd = prisma.IoTCommand;
    if (!iotCmd) throw new Error('IoTCommand accessor not found on Prisma client');

    await iotCmd.deleteMany({
      where: { id: { in: [uuid('iotcmd-1'), uuid('iotcmd-2'), uuid('iotcmd-3')] } },
    }).catch(() => {});
    await iotCmd.createMany({
      data: [
        { id: uuid('iotcmd-1'), deviceId: IOT1, command: 'set_temperature', parameters: '{"value": 22}', status: 'completed', executedAt: daysAgo(0), source: 'manual', triggeredBy: U2 },
        { id: uuid('iotcmd-2'), deviceId: IOT2, command: 'turn_off', parameters: '{}', status: 'completed', executedAt: daysAgo(1), source: 'automation' },
        { id: uuid('iotcmd-3'), deviceId: IOT3, command: 'set_brightness', parameters: '{"value": 70}', status: 'pending', source: 'manual', triggeredBy: U3 },
      ],
    });
    console.log('    ✅ IoTCommand seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ IoTCommand:', e.message?.substring(0, 120));
  }

  // ── 3. IoTReading (accessor naming fix) ────────────────────────
  console.log('  [FIX 3/7] IoTReading...');
  try {
    // Prisma generates PascalCase accessor for IoTReading
    const iotRead = prisma.IoTReading;
    if (!iotRead) throw new Error('IoTReading accessor not found on Prisma client');

    await iotRead.deleteMany({
      where: { id: { in: [uuid('iotr-1'), uuid('iotr-2'), uuid('iotr-3'), uuid('iotr-4')] } },
    }).catch(() => {});
    await iotRead.createMany({
      data: [
        { id: uuid('iotr-1'), deviceId: IOT1, type: 'temperature', value: 22.5, unit: 'celsius', timestamp: daysAgo(0) },
        { id: uuid('iotr-2'), deviceId: IOT1, type: 'humidity', value: 55.0, unit: 'percent', timestamp: daysAgo(0) },
        { id: uuid('iotr-3'), deviceId: IOT2, type: 'power', value: 0.0, unit: 'watts', timestamp: daysAgo(1) },
        { id: uuid('iotr-4'), deviceId: IOT3, type: 'brightness', value: 70, unit: 'percent', timestamp: daysAgo(0) },
      ],
    });
    console.log('    ✅ IoTReading seeded (4 rows)');
  } catch (e: any) {
    console.log('    ❌ IoTReading:', e.message?.substring(0, 120));
  }

  // ── 4. DatabaseBackup (createdBy UUID fix) ─────────────────────
  console.log('  [FIX 4/7] DatabaseBackup — fixing createdBy to use UUID...');
  try {
    await prisma.databaseBackup.deleteMany({
      where: { id: { in: [uuid('dbbk-1'), uuid('dbbk-2'), uuid('dbbk-3')] } },
    }).catch(() => {});
    await prisma.databaseBackup.createMany({
      data: [
        {
          id: uuid('dbbk-1'),
          tenantId: T1,
          type: 'full',
          status: 'completed',
          fileSize: 52428800,
          storageLocation: 's3://staysuite-backups/tenant-1/full-20250101.dump',
          startedAt: daysAgo(7),
          completedAt: daysAgo(7),
          expiresAt: daysFromNow(23),
          createdBy: U1,                    // ← was 'system' string, now actual UUID
          notes: 'Weekly full backup',
        },
        {
          id: uuid('dbbk-2'),
          tenantId: T1,
          type: 'incremental',
          status: 'completed',
          fileSize: 5242880,
          storageLocation: 's3://staysuite-backups/tenant-1/incr-20250108.dump',
          startedAt: daysAgo(0),
          completedAt: daysAgo(0),
          expiresAt: daysFromNow(30),
          createdBy: UP1,                   // ← platform admin UUID instead of 'system'
          notes: 'Daily incremental backup',
        },
        {
          id: uuid('dbbk-3'),
          tenantId: T2,
          type: 'full',
          status: 'failed',
          startedAt: daysAgo(2),
          createdBy: UT2_1,                 // ← tenant-2 admin UUID
          notes: 'Backup failed due to disk space',
        },
      ],
    });
    console.log('    ✅ DatabaseBackup seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ DatabaseBackup:', e.message?.substring(0, 120));
  }

  // ── 5. OverbookingLog (performedBy UUID fix) ───────────────────
  console.log('  [FIX 5/7] OverbookingLog — fixing performedBy to use UUID...');
  try {
    await prisma.overbookingLog.deleteMany({
      where: { id: { in: [uuid('oblog-1'), uuid('oblog-2'), uuid('oblog-3')] } },
    }).catch(() => {});
    await prisma.overbookingLog.createMany({
      data: [
        {
          id: uuid('oblog-1'),
          tenantId: T1,
          propertyId: P1,
          date: daysFromNow(7),
          roomTypeId: RT1,
          action: 'created',
          details: '{"maxExtra":2,"confidence":0.25,"bookingsAnalyzed":48}',
          performedBy: UP1,                // ← was 'system' string
        },
        {
          id: uuid('oblog-2'),
          tenantId: T1,
          propertyId: P1,
          date: daysFromNow(14),
          roomTypeId: RT2,
          action: 'updated',
          details: '{"maxExtra":1,"confidence":0.35,"bookingsAnalyzed":52}',
          performedBy: U1,
        },
        {
          id: uuid('oblog-3'),
          tenantId: T1,
          propertyId: P1,
          date: daysFromNow(21),
          roomTypeId: RT1,
          action: 'absorbed',
          details: '{"maxExtra":2,"confidence":0.18,"absorbedWalkups":1,"upgradedTo":"Deluxe Room"}',
          performedBy: U2,
        },
      ],
    });
    console.log('    ✅ OverbookingLog seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ OverbookingLog:', e.message?.substring(0, 120));
  }

  // ── 6. WiFiUserStatusHistory (missing propertyId + wrong fields) ─
  console.log('  [FIX 6/7] WiFiUserStatusHistory — fixing schema field mismatch...');
  try {
    await prisma.wiFiUserStatusHistory.deleteMany({
      where: { id: { in: [uuid('wush-1'), uuid('wush-2'), uuid('wush-3'), uuid('wush-4')] } },
    }).catch(() => {});
    // Schema requires: tenantId, propertyId, username
    // Schema has: userId (optional UUID) — NOT wifiUserId
    // Schema has: changeReason — NOT reason
    // Schema has: createdAt — NOT changedAt
    await prisma.wiFiUserStatusHistory.createMany({
      data: [
        {
          id: uuid('wush-1'),
          tenantId: T1,
          propertyId: P1,              // ← was MISSING
          username: 'guest.amit.mukherjee', // ← was MISSING
          userId: WU1,                 // ← was 'wifiUserId' (wrong field name)
          oldStatus: 'pending',
          newStatus: 'active',
          changedBy: UP1,
          changeReason: 'Auto-provisioned on check-in', // ← was 'reason'
        },
        {
          id: uuid('wush-2'),
          tenantId: T1,
          propertyId: P1,
          username: 'guest.amit.mukherjee',
          userId: WU1,
          oldStatus: 'active',
          newStatus: 'suspended',
          changedBy: U1,
          changeReason: 'FUP daily limit exceeded',
        },
        {
          id: uuid('wush-3'),
          tenantId: T1,
          propertyId: P1,
          username: 'guest.amit.mukherjee',
          userId: WU1,
          oldStatus: 'suspended',
          newStatus: 'active',
          changedBy: UP1,
          changeReason: 'FUP cycle reset',
        },
        {
          id: uuid('wush-4'),
          tenantId: T1,
          propertyId: P1,
          username: 'guest.rahul.banerjee',
          userId: WU2,
          oldStatus: 'pending',
          newStatus: 'active',
          changedBy: UP1,
          changeReason: 'Auto-provisioned on check-in',
        },
      ],
    });
    console.log('    ✅ WiFiUserStatusHistory seeded (4 rows)');
  } catch (e: any) {
    console.log('    ❌ WiFiUserStatusHistory:', e.message?.substring(0, 120));
  }

  // ── 7. WebCategorySchedule (remove stray 'description' field) ──
  console.log('  [FIX 7/7] WebCategorySchedule — removing invalid description field...');
  try {
    await prisma.webCategorySchedule.deleteMany({
      where: { id: { in: [uuid('wcs-1'), uuid('wcs-2'), uuid('wcs-3')] } },
    }).catch(() => {});
    // Schema does NOT have a 'description' field — only the fields listed below
    await prisma.webCategorySchedule.createMany({
      data: [
        {
          id: uuid('wcs-1'),
          tenantId: T1,
          propertyId: P1,
          webCategoryId: WC1,
          isAllow: false,
          orderIndex: 0,
          startTime: '06:00',
          endTime: '23:59',
          daysOfWeek: '1,2,3,4,5',
          enabled: true,
        },
        {
          id: uuid('wcs-2'),
          tenantId: T1,
          propertyId: P1,
          webCategoryId: WC1,
          isAllow: true,
          orderIndex: 1,
          startTime: '00:00',
          endTime: '05:59',
          daysOfWeek: '1,2,3,4,5',
          enabled: true,
          // ← description removed — not in schema
        },
        {
          id: uuid('wcs-3'),
          tenantId: T1,
          propertyId: P1,
          webCategoryId: WC2,
          isAllow: true,
          orderIndex: 0,
          startTime: '18:00',
          endTime: '22:00',
          daysOfWeek: '0,6',
          enabled: true,
          // ← description removed — not in schema
        },
      ],
    });
    console.log('    ✅ WebCategorySchedule seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ WebCategorySchedule:', e.message?.substring(0, 120));
  }

  // ════════════════════════════════════════════════════════════════
  // SECTION 2 — VERIFY ALREADY-SEEDED TABLES (re-attempt with skipDuplicates)
  // ════════════════════════════════════════════════════════════════

  // ── MinibarConsumption (verify/reseed) ─────────────────────────
  console.log('  [VERIFY] MinibarConsumption — re-attempt with skipDuplicates...');
  try {
    const mbResult = await prisma.minibarConsumption.createMany({
      data: [
        {
          id: uuid('mbcons-1'), tenantId: T1, propertyId: P1, bookingId: BK1,
          folioId: FOL1, roomId: ROOM_501, itemId: MB_3,
          itemName: 'Kingfisher Beer 330ml', quantity: 2, unitPrice: 180, totalPrice: 360,
          consumedAt: daysAgo(1), postedToFolio: true, postedAt: daysAgo(1),
          consumedBy: 'Guest Amit Mukherjee', notes: 'Evening drinks',
        },
        {
          id: uuid('mbcons-2'), tenantId: T1, propertyId: P1, bookingId: BK1,
          folioId: FOL1, roomId: ROOM_501, itemId: uuid('mbitem-7'),
          itemName: 'Mixed Nuts Pack', quantity: 1, unitPrice: 200, totalPrice: 200,
          consumedAt: new Date(today.getTime() - 12 * 60 * 60 * 1000), postedToFolio: false,
          consumedBy: 'Guest Amit Mukherjee',
        },
        {
          id: uuid('mbcons-3'), tenantId: T1, propertyId: P1, bookingId: BK2,
          folioId: FOL2, roomId: ROOM_801, itemId: uuid('mbitem-9'),
          itemName: 'Johnnie Walker Red Label 50ml', quantity: 1, unitPrice: 450, totalPrice: 450,
          consumedAt: new Date(today.getTime() - 8 * 60 * 60 * 1000), postedToFolio: true,
          postedAt: new Date(today.getTime() - 8 * 60 * 60 * 1000), consumedBy: 'Guest Rahul Banerjee',
        },
        {
          id: uuid('mbcons-4'), tenantId: T1, propertyId: P1, bookingId: BK2,
          folioId: FOL2, roomId: ROOM_801, itemId: uuid('mbitem-10'),
          itemName: 'Champagne Mini 187ml', quantity: 1, unitPrice: 1200, totalPrice: 1200,
          consumedAt: new Date(today.getTime() - 10 * 60 * 60 * 1000), postedToFolio: true,
          postedAt: new Date(today.getTime() - 10 * 60 * 60 * 1000), consumedBy: 'Guest Rahul Banerjee',
          notes: 'Celebration drink',
        },
        {
          id: uuid('mbcons-5'), tenantId: T1, propertyId: P1, bookingId: BK6,
          folioId: FOL6, roomId: ROOM_305, itemId: uuid('mbitem-1'),
          itemName: 'Coca-Cola Can', quantity: 1, unitPrice: 80, totalPrice: 80,
          consumedAt: daysAgo(2), postedToFolio: true,
          postedAt: daysAgo(2), consumedBy: 'Guest Rina Chatterjee',
        },
      ],
      skipDuplicates: true,
    });
    console.log(`    ✅ MinibarConsumption verified (${mbResult.count} new rows)`);
  } catch (e: any) {
    console.log('    ❌ MinibarConsumption:', e.message?.substring(0, 120));
  }

  // ── CommissionRecord (verify/reseed) ───────────────────────────
  console.log('  [VERIFY] CommissionRecord — re-attempt with skipDuplicates...');
  try {
    const crResult = await prisma.commissionRecord.createMany({
      data: [
        { id: uuid('crec-1'), tenantId: T1, propertyId: P1, ruleId: CRULE_1, bookingId: BK3, sourceType: 'ota', sourceName: 'Booking.com', bookingAmount: 22000, commissionAmount: 3300, status: 'accrued', notes: 'Booking.com booking for Sneha Gupta' },
        { id: uuid('crec-2'), tenantId: T1, propertyId: P1, ruleId: CRULE_1, bookingId: BK5, sourceType: 'ota', sourceName: 'Booking.com', bookingAmount: 10500, commissionAmount: 1575, status: 'accrued', notes: 'Booking.com booking for Pooja Saha' },
        { id: uuid('crec-3'), tenantId: T1, propertyId: P1, ruleId: uuid('crule-3'), bookingId: BK1, sourceType: 'travel_agent', sourceName: 'Thomas Cook India', bookingAmount: 16500, commissionAmount: 1980, status: 'invoiced', invoicedAt: daysAgo(25), notes: 'Referred via Thomas Cook' },
        { id: uuid('crec-4'), tenantId: T1, propertyId: P1, ruleId: uuid('crule-2'), bookingId: BK2, sourceType: 'ota', sourceName: 'Expedia', bookingAmount: 48000, commissionAmount: 8640, status: 'paid', invoicedAt: daysAgo(15), paidAt: daysAgo(10), notes: 'Expedia VIP booking' },
        { id: uuid('crec-5'), tenantId: T1, propertyId: P1, ruleId: uuid('crule-4'), bookingId: BK6, sourceType: 'corporate', sourceName: 'TCS Corporate', bookingAmount: 10500, commissionAmount: 500, status: 'accrued', notes: 'Corporate referral from TCS' },
      ],
      skipDuplicates: true,
    });
    console.log(`    ✅ CommissionRecord verified (${crResult.count} new rows)`);
  } catch (e: any) {
    console.log('    ❌ CommissionRecord:', e.message?.substring(0, 120));
  }

  // ════════════════════════════════════════════════════════════════
  // SECTION 3 — NEW TABLES (never before seeded)
  // ════════════════════════════════════════════════════════════════

  // ── 1. OtaChannel (FK → Tenant, Property) ──────────────────────
  console.log('  [NEW 1/13] OtaChannel...');
  try {
    await prisma.otaChannel.createMany({
      data: [
        {
          id: uuid('otach-1'),
          tenantId: T1,
          propertyId: P1,
          name: 'Booking.com Kolkata',
          type: 'booking_com',
          apiKey: 'bk-com-api-key-royal-kol',
          apiSecret: 'bk-com-secret-royal-kol',
          hotelId: 'BK-HOTEL-12345',
          isActive: true,
          lastSyncedAt: daysAgo(1),
          config: '{"syncRates": true, "syncInventory": true, "syncRestrictions": true}',
        },
        {
          id: uuid('otach-2'),
          tenantId: T1,
          propertyId: P1,
          name: 'Expedia Kolkata',
          type: 'expedia',
          apiKey: 'exp-api-key-royal-kol',
          apiSecret: 'exp-secret-royal-kol',
          hotelId: 'EXP-HOTEL-67890',
          isActive: true,
          lastSyncedAt: daysAgo(2),
          config: '{"syncRates": true, "syncInventory": true, "syncRestrictions": false}',
        },
        {
          id: uuid('otach-3'),
          tenantId: T1,
          propertyId: P2,
          name: 'MakeMyTrip Darjeeling',
          type: 'make_my_trip',
          apiKey: 'mmt-api-key-royal-darj',
          hotelId: 'MMT-HOTEL-11111',
          isActive: true,
          lastSyncedAt: daysAgo(0),
          config: '{"syncRates": true, "syncInventory": true}',
        },
        {
          id: uuid('otach-4'),
          tenantId: T1,
          propertyId: P2,
          name: 'Agoda Darjeeling',
          type: 'agoda',
          isActive: true,
          config: '{"syncRates": true, "syncInventory": true}',
        },
      ],
    });
    console.log('    ✅ OtaChannel seeded (4 rows)');
  } catch (e: any) {
    console.log('    ❌ OtaChannel:', e.message?.substring(0, 120));
  }

  // ── 2. OTAContentProfile (FK → Tenant, Property) ──────────────
  console.log('  [NEW 2/13] OTAContentProfile...');
  try {
    await prisma.oTAContentProfile.createMany({
      data: [
        {
          id: uuid('otacp-1'),
          tenantId: T1,
          propertyId: P1,
          channelName: 'booking_com',
          syncStatus: 'synced',
          fieldMapping: '{"hotelName":"name","hotelDescription":"longDescription","amenities":"amenityCodes","photos":"imageUrls"}',
          lastSyncAt: daysAgo(1),
          totalFields: 12,
          syncedFields: 12,
          failedFields: 0,
        },
        {
          id: uuid('otacp-2'),
          tenantId: T1,
          propertyId: P1,
          channelName: 'expedia',
          syncStatus: 'partial',
          fieldMapping: '{"hotelName":"name","hotelDescription":"description","amenities":"amenityList"}',
          lastSyncAt: daysAgo(2),
          totalFields: 10,
          syncedFields: 8,
          failedFields: 2,
          errorDetails: 'Photo upload failed: 2 images exceeded 5MB limit',
        },
        {
          id: uuid('otacp-3'),
          tenantId: T1,
          propertyId: P2,
          channelName: 'make_my_trip',
          syncStatus: 'pending',
          totalFields: 10,
        },
      ],
    });
    console.log('    ✅ OTAContentProfile seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ OTAContentProfile:', e.message?.substring(0, 120));
  }

  // ── 3. ChannelCancellationPolicy (FK → Tenant, ChannelConnection optional) ──
  console.log('  [NEW 3/13] ChannelCancellationPolicy...');
  try {
    const chanCanPol = (prisma.channelCancellationPolicy);
    if (!chanCanPol) throw new Error('channelCancellationPolicy accessor not found');
    await chanCanPol.createMany({
      data: [
        {
          id: uuid('chcp-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          policyName: 'Flexible 48h',
          policyType: 'free_cancellation',
          freeCancelBefore: 48,
          penaltyType: 'percentage',
          penaltyValue: 0,
          noShowPolicy: true,
          noShowPenaltyType: 'nights',
          noShowPenaltyValue: 1,
          syncEnabled: true,
          syncStatus: 'synced',
          lastSyncedAt: daysAgo(1),
          isActive: true,
        },
        {
          id: uuid('chcp-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          policyName: 'Non-Refundable',
          policyType: 'non_refundable',
          freeCancelBefore: null,
          penaltyType: 'percentage',
          penaltyValue: 100,
          noShowPolicy: true,
          noShowPenaltyType: 'nights',
          noShowPenaltyValue: 1,
          syncEnabled: true,
          syncStatus: 'synced',
          lastSyncedAt: daysAgo(1),
          isActive: true,
        },
        {
          id: uuid('chcp-3'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          channelCode: 'expedia',
          policyName: 'Moderate 72h',
          policyType: 'moderate',
          freeCancelBefore: 72,
          penaltyType: 'nights',
          penaltyValue: 1,
          noShowPolicy: true,
          noShowPenaltyType: 'nights',
          noShowPenaltyValue: 1,
          syncEnabled: true,
          syncStatus: 'pending',
          isActive: true,
        },
      ],
    });
    console.log('    ✅ ChannelCancellationPolicy seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelCancellationPolicy:', e.message?.substring(0, 120));
  }

  // ── 4. ChannelContentField (FK → Tenant, ChannelConnection optional) ──
  console.log('  [NEW 4/13] ChannelContentField...');
  try {
    const chanContField = (prisma.channelContentField);
    if (!chanContField) throw new Error('channelContentField accessor not found');
    await chanContField.createMany({
      data: [
        {
          id: uuid('chcf-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          fieldType: 'hotel_name',
          sourceValue: 'Royal Stay Kolkata',
          mappedValue: 'Royal Stay Kolkata - City Center',
          syncEnabled: true,
          lastSyncedAt: daysAgo(1),
          syncStatus: 'synced',
        },
        {
          id: uuid('chcf-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          fieldType: 'hotel_description',
          sourceValue: 'A luxury 5-star hotel in the heart of Kolkata with stunning views of Victoria Memorial.',
          mappedValue: 'Luxury 5-star hotel in Kolkata city center near Victoria Memorial. Free WiFi, pool, spa.',
          syncEnabled: true,
          lastSyncedAt: daysAgo(1),
          syncStatus: 'synced',
        },
        {
          id: uuid('chcf-3'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          fieldType: 'hotel_name',
          sourceValue: 'Royal Stay Kolkata',
          mappedValue: 'Royal Stay Kolkata',
          syncEnabled: true,
          syncStatus: 'pending',
        },
        {
          id: uuid('chcf-4'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          fieldType: 'checkin_instructions',
          sourceValue: 'Check-in from 14:00 at front desk. Valid ID required.',
          mappedValue: 'Check-in: 2:00 PM. Please present valid photo ID at the front desk.',
          syncEnabled: false,
          syncStatus: 'pending',
        },
      ],
    });
    console.log('    ✅ ChannelContentField seeded (4 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelContentField:', e.message?.substring(0, 120));
  }

  // ── 5. ChannelContentSync (FK → Tenant, ChannelConnection optional) ──
  console.log('  [NEW 5/13] ChannelContentSync...');
  try {
    const chanContSync = (prisma.channelContentSync);
    if (!chanContSync) throw new Error('channelContentSync accessor not found');
    await chanContSync.createMany({
      data: [
        {
          id: uuid('chcs-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          contentType: 'photos',
          syncType: 'full',
          status: 'completed',
          totalItems: 24,
          syncedItems: 24,
          failedItems: 0,
          lastSyncAt: daysAgo(1),
          nextSyncAt: daysFromNow(6),
        },
        {
          id: uuid('chcs-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          contentType: 'descriptions',
          syncType: 'full',
          status: 'completed',
          totalItems: 6,
          syncedItems: 6,
          failedItems: 0,
          lastSyncAt: daysAgo(1),
        },
        {
          id: uuid('chcs-3'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          contentType: 'amenities',
          syncType: 'full',
          status: 'partial',
          totalItems: 15,
          syncedItems: 12,
          failedItems: 3,
          lastSyncAt: daysAgo(2),
          errorMessage: '3 amenities not recognized by Expedia mapping',
        },
      ],
    });
    console.log('    ✅ ChannelContentSync seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelContentSync:', e.message?.substring(0, 120));
  }

  // ── 6. ChannelCurrencyConfig (FK → Tenant, ChannelConnection REQUIRED) ──
  console.log('  [NEW 6/13] ChannelCurrencyConfig...');
  try {
    const chanCurCfg = (prisma.channelCurrencyConfig);
    if (!chanCurCfg) throw new Error('channelCurrencyConfig accessor not found');
    await chanCurCfg.createMany({
      data: [
        {
          id: uuid('chcc-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          sourceCurrency: 'INR',
          targetCurrency: 'USD',
          conversionType: 'auto',
          exchangeRate: 0.012,
          markupPercent: 5,
          roundingMethod: 'up',
          lastRateUpdate: daysAgo(0),
          rateProvider: 'open_exchange',
          isActive: true,
        },
        {
          id: uuid('chcc-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          channelCode: 'expedia',
          sourceCurrency: 'INR',
          targetCurrency: 'USD',
          conversionType: 'manual',
          exchangeRate: 0.012,
          markupPercent: 0,
          roundingMethod: 'nearest',
          lastRateUpdate: daysAgo(1),
          rateProvider: 'manual',
          isActive: true,
        },
      ],
    });
    console.log('    ✅ ChannelCurrencyConfig seeded (2 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelCurrencyConfig:', e.message?.substring(0, 120));
  }

  // ── 7. ChannelCurrencyHistory (FK → Tenant, configId REQUIRED) ──
  console.log('  [NEW 7/13] ChannelCurrencyHistory...');
  try {
    const chanCurHist = (prisma.channelCurrencyHistory);
    if (!chanCurHist) throw new Error('channelCurrencyHistory accessor not found');
    await chanCurHist.createMany({
      data: [
        {
          id: uuid('chch-1'),
          tenantId: T1,
          configId: uuid('chcc-1'),
          sourceCurrency: 'INR',
          targetCurrency: 'USD',
          exchangeRate: 0.012,
          effectiveFrom: daysAgo(30),
          effectiveTo: daysAgo(0),
          changedBy: U1,
        },
        {
          id: uuid('chch-2'),
          tenantId: T1,
          configId: uuid('chcc-1'),
          sourceCurrency: 'INR',
          targetCurrency: 'USD',
          exchangeRate: 0.012,
          effectiveFrom: daysAgo(0),
          changedBy: UP1,
        },
        {
          id: uuid('chch-3'),
          tenantId: T1,
          configId: uuid('chcc-2'),
          sourceCurrency: 'INR',
          targetCurrency: 'USD',
          exchangeRate: 0.0119,
          effectiveFrom: daysAgo(7),
          effectiveTo: daysAgo(1),
          changedBy: U1,
        },
      ],
    });
    console.log('    ✅ ChannelCurrencyHistory seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelCurrencyHistory:', e.message?.substring(0, 120));
  }

  // ── 8. ChannelGuestRateConfig (FK → Tenant, ChannelConnection optional, unique constraint) ──
  console.log('  [NEW 8/13] ChannelGuestRateConfig...');
  try {
    const chanGuestRate = (prisma.channelGuestRateConfig);
    if (!chanGuestRate) throw new Error('channelGuestRateConfig accessor not found');
    await chanGuestRate.createMany({
      data: [
        {
          id: uuid('chgrc-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          roomTypeId: RT1,
          maxAdults: 2,
          maxChildren: 1,
          maxTotalGuests: 3,
          infantAgeMax: 2,
          childAgeMin: 3,
          childAgeMax: 12,
          adultAgeMin: 13,
          extraAdultRate: 500,
          extraAdultType: 'per_night',
          extraChildRate: 300,
          extraChildType: 'per_night',
          cribRate: 0,
          cribAvailable: true,
          extraBedRate: 1500,
          extraBedAvailable: true,
          currency: 'INR',
          isActive: true,
        },
        {
          id: uuid('chgrc-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          roomTypeId: RT2,
          maxAdults: 2,
          maxChildren: 2,
          maxTotalGuests: 4,
          infantAgeMax: 2,
          childAgeMin: 3,
          childAgeMax: 12,
          adultAgeMin: 13,
          extraAdultRate: 800,
          extraAdultType: 'per_night',
          extraChildRate: 500,
          extraChildType: 'per_night',
          cribRate: 0,
          cribAvailable: true,
          extraBedRate: 2000,
          extraBedAvailable: true,
          currency: 'INR',
          isActive: true,
        },
        {
          id: uuid('chgrc-3'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          channelCode: 'expedia',
          roomTypeId: RT3,
          maxAdults: 3,
          maxChildren: 2,
          maxTotalGuests: 4,
          infantAgeMax: 2,
          childAgeMin: 3,
          childAgeMax: 17,
          adultAgeMin: 18,
          extraAdultRate: 1500,
          extraAdultType: 'per_night',
          extraChildRate: 800,
          extraChildType: 'per_night',
          cribRate: 0,
          cribAvailable: true,
          extraBedRate: 3000,
          extraBedAvailable: true,
          currency: 'INR',
          isActive: true,
        },
      ],
    });
    console.log('    ✅ ChannelGuestRateConfig seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelGuestRateConfig:', e.message?.substring(0, 120));
  }

  // ── 9. ChannelPromoCode (FK → Tenant, ChannelConnection optional) ──
  console.log('  [NEW 9/13] ChannelPromoCode...');
  try {
    const chanPromo = (prisma.channelPromoCode);
    if (!chanPromo) throw new Error('channelPromoCode accessor not found');
    await chanPromo.createMany({
      data: [
        {
          id: uuid('chpc-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          promoCode: 'WINTER_SALE_15',
          promoName: 'Winter Sale 15% Off',
          description: '15% off for bookings made in January-February',
          discountType: 'percentage',
          discountValue: 15,
          currency: 'INR',
          validFrom: daysAgo(30),
          validTo: daysFromNow(30),
          bookingWindowFrom: daysAgo(30),
          bookingWindowTo: daysFromNow(30),
          usageLimit: 100,
          usageCount: 42,
          syncStatus: 'synced',
          lastSyncedAt: daysAgo(1),
          isActive: true,
        },
        {
          id: uuid('chpc-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          channelCode: 'expedia',
          promoCode: 'EXP_LOYALTY_10',
          promoName: 'Expedia Loyalty 10% Off',
          discountType: 'percentage',
          discountValue: 10,
          currency: 'INR',
          minStay: 2,
          validFrom: daysAgo(15),
          validTo: daysFromNow(60),
          usageLimit: 200,
          usageCount: 78,
          syncStatus: 'synced',
          lastSyncedAt: daysAgo(2),
          isActive: true,
        },
      ],
    });
    console.log('    ✅ ChannelPromoCode seeded (2 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelPromoCode:', e.message?.substring(0, 120));
  }

  // ── 10. ChannelTaxMapping (FK → Tenant, ChannelConnection optional) ──
  console.log('  [NEW 10/13] ChannelTaxMapping...');
  try {
    const chanTaxMap = (prisma.channelTaxMapping);
    if (!chanTaxMap) throw new Error('channelTaxMapping accessor not found');
    await chanTaxMap.createMany({
      data: [
        {
          id: uuid('chtm-1'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          internalTaxName: 'GST 18%',
          taxType: 'gst',
          taxRate: 18,
          displayMode: 'inclusive',
          channelTaxCode: 'GST_18_IN',
          channelTaxName: 'GST 18%',
          appliesTo: 'room_rate',
          isIncludedInRate: true,
          isActive: true,
        },
        {
          id: uuid('chtm-2'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH1,
          channelCode: 'booking_com',
          internalTaxName: 'Kolkata Municipal Tax',
          taxType: 'city_tax',
          taxRate: 1,
          displayMode: 'show_separately',
          channelTaxCode: 'CITY_TAX_KOL',
          channelTaxName: 'City Tax',
          appliesTo: 'total_amount',
          isIncludedInRate: false,
          isActive: true,
        },
        {
          id: uuid('chtm-3'),
          tenantId: T1,
          propertyId: P1,
          connectionId: CH2,
          channelCode: 'expedia',
          internalTaxName: 'GST 18%',
          taxType: 'gst',
          taxRate: 18,
          displayMode: 'inclusive',
          channelTaxCode: 'TAX_18',
          channelTaxName: 'Tax and Service Fee',
          appliesTo: 'room_rate',
          isIncludedInRate: true,
          isActive: true,
        },
      ],
    });
    console.log('    ✅ ChannelTaxMapping seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ ChannelTaxMapping:', e.message?.substring(0, 120));
  }

  // ── 11. LosPricingTier (FK → Tenant, Property, RoomType) ──────
  console.log('  [NEW 11/13] LosPricingTier...');
  try {
    const los = (prisma.losPricingTier);
    if (!los) throw new Error('losPricingTier accessor not found');
    await los.createMany({
      data: [
        // Standard Room LOS tiers
        {
          id: uuid('los-1'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT1,
          minNights: 1,
          maxNights: 2,
          label: '1-2 nights',
          discountPercent: 0,
          isActive: true,
          sortOrder: 1,
        },
        {
          id: uuid('los-2'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT1,
          minNights: 3,
          maxNights: 5,
          label: '3-5 nights',
          discountPercent: 5,
          isActive: true,
          sortOrder: 2,
        },
        {
          id: uuid('los-3'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT1,
          minNights: 6,
          maxNights: 14,
          label: '6-14 nights',
          discountPercent: 10,
          isActive: true,
          sortOrder: 3,
        },
        {
          id: uuid('los-4'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT1,
          minNights: 15,
          maxNights: null,
          label: '15+ nights (Long Stay)',
          discountPercent: 20,
          isActive: true,
          sortOrder: 4,
        },
        // Deluxe Room LOS tiers
        {
          id: uuid('los-5'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT2,
          minNights: 1,
          maxNights: 2,
          label: '1-2 nights',
          discountPercent: 0,
          isActive: true,
          sortOrder: 1,
        },
        {
          id: uuid('los-6'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT2,
          minNights: 3,
          maxNights: 6,
          label: '3-6 nights',
          discountPercent: 7,
          isActive: true,
          sortOrder: 2,
        },
        {
          id: uuid('los-7'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT2,
          minNights: 7,
          maxNights: null,
          label: '7+ nights',
          discountPercent: 15,
          isActive: true,
          sortOrder: 3,
        },
        // Executive Suite LOS tiers
        {
          id: uuid('los-8'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT3,
          minNights: 1,
          maxNights: 3,
          label: '1-3 nights',
          discountPercent: 0,
          isActive: true,
          sortOrder: 1,
        },
        {
          id: uuid('los-9'),
          tenantId: T1,
          propertyId: P1,
          roomTypeId: RT3,
          minNights: 4,
          maxNights: null,
          label: '4+ nights',
          discountPercent: 12,
          isActive: true,
          sortOrder: 2,
        },
      ],
    });
    console.log('    ✅ LosPricingTier seeded (9 rows)');
  } catch (e: any) {
    console.log('    ❌ LosPricingTier:', e.message?.substring(0, 120));
  }

  // ── 12. RateDerivationRule (FK → Tenant, sourceRatePlanId REQUIRED) ──
  console.log('  [NEW 12/13] RateDerivationRule...');
  try {
    const rdr = (prisma.rateDerivationRule);
    if (!rdr) throw new Error('rateDerivationRule accessor not found');
    await rdr.createMany({
      data: [
        {
          id: uuid('rdr-1'),
          tenantId: T1,
          propertyId: P1,
          name: 'Booking.com BAR +10%',
          description: 'Add 10% commission markup for Booking.com on top of BAR rate',
          connectionId: CH1,
          sourceRatePlanId: RP1,
          channelCode: 'booking_com',
          operation: 'percentage',
          adjustmentValue: 10,
          roundingMethod: 'nearest',
          floorRate: 3000,
          priority: 1,
          isActive: true,
          effectiveFrom: daysAgo(365),
        },
        {
          id: uuid('rdr-2'),
          tenantId: T1,
          propertyId: P1,
          name: 'Expedia BAR +15%',
          description: 'Add 15% commission markup for Expedia on BAR rate',
          connectionId: CH2,
          sourceRatePlanId: RP1,
          channelCode: 'expedia',
          operation: 'percentage',
          adjustmentValue: 15,
          roundingMethod: 'up',
          floorRate: 3500,
          priority: 1,
          isActive: true,
          effectiveFrom: daysAgo(365),
        },
        {
          id: uuid('rdr-3'),
          tenantId: T1,
          propertyId: P1,
          name: 'Corporate Fixed Discount',
          description: 'Flat INR 500 discount on BAR for corporate bookings',
          connectionId: null,
          sourceRatePlanId: RP1,
          channelCode: 'direct',
          operation: 'fixed_amount',
          adjustmentValue: -500,
          roundingMethod: 'nearest',
          floorRate: 2500,
          appliesTo: 'all',
          priority: 2,
          isActive: true,
          effectiveFrom: daysAgo(180),
        },
        {
          id: uuid('rdr-4'),
          tenantId: T1,
          propertyId: P1,
          name: 'Weekend Surcharge',
          description: '20% surcharge on weekends for deluxe rooms',
          connectionId: null,
          sourceRatePlanId: RP4,
          channelCode: 'direct',
          operation: 'percentage',
          adjustmentValue: 20,
          roundingMethod: 'nearest',
          appliesTo: 'weekends',
          priority: 3,
          isActive: true,
          effectiveFrom: daysAgo(90),
        },
      ],
    });
    console.log('    ✅ RateDerivationRule seeded (4 rows)');
  } catch (e: any) {
    console.log('    ❌ RateDerivationRule:', e.message?.substring(0, 120));
  }

  // ── 13. PricingSchedulerLog (standalone, FK → Tenant) ─────────
  console.log('  [NEW 13/13] PricingSchedulerLog...');
  try {
    const psl = (prisma.pricingSchedulerLog);
    if (!psl) throw new Error('pricingSchedulerLog accessor not found');
    await psl.createMany({
      data: [
        {
          id: uuid('psl-1'),
          tenantId: T1,
          propertyId: P1,
          status: 'completed',
          rulesEvaluated: 12,
          rulesApplied: 8,
          rulesSkipped: 4,
          totalRevenueImpact: 45000,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
        },
        {
          id: uuid('psl-2'),
          tenantId: T1,
          propertyId: P1,
          status: 'completed',
          rulesEvaluated: 12,
          rulesApplied: 6,
          rulesSkipped: 6,
          totalRevenueImpact: -5000,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
        },
        {
          id: uuid('psl-3'),
          tenantId: T1,
          propertyId: P2,
          status: 'failed',
          rulesEvaluated: 5,
          rulesApplied: 0,
          rulesSkipped: 5,
          totalRevenueImpact: 0,
          errorDetails: 'Rate plan RP-DELUXE-DARJ not found for property Royal Stay Darjeeling',
          startedAt: daysAgo(0),
          completedAt: null,
        },
      ],
    });
    console.log('    ✅ PricingSchedulerLog seeded (3 rows)');
  } catch (e: any) {
    console.log('    ❌ PricingSchedulerLog:', e.message?.substring(0, 120));
  }

  console.log('\n✅ seed-final-fix completed!\n');
}
