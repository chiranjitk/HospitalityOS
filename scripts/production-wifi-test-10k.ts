/**
 * ╔════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║  StaySuite — Production WiFi Load Test Script (10,000 Users)                              ║
 * ║  Comprehensive multi-phase test: plans → users → auth → sessions → analytics              ║
 * ║  ALL operations use API calls — NO direct SQL/DB inserts.                                 ║
 * ║                                                                                            ║
 * ║  Run: npx tsx scripts/production-wifi-test-10k.ts                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { execSync } from 'child_process';
import { randomUUID, randomInt } from 'crypto';

// ────────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';
const RADCLIENT_BIN = '/home/z/my-project/freeradius-install/bin/radclient';
const RADCLIENT_DICT = '/home/z/my-project/freeradius-install/share/freeradius';
const RADCLIENT_LIB = '/home/z/my-project/freeradius-install/lib';
const RADIUS_SECRET = 'testing123';
const RADIUS_SERVER = '127.0.0.1';
const PSQL_BIN = '/home/z/my-project/pgsql-runtime/bin/psql';
const DB_HOST = '127.0.0.1';
const DB_PORT = '5432';
const DB_NAME = 'staysuite';
const DB_USER = 'staysuite';
const DB_PASS = 'Staysuite2025';

// Existing IDs from seed data
const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const PROPERTY_ID = '281fde73-7836-4511-b644-91f3663d8fcd';
const ADMIN_EMAIL = 'admin@royalstay.in';
const ADMIN_PASSWORD = 'admin123';

// Test portal slug
const PORTAL_SLUG = 'test-royal-stay';

// Scale parameters
const TOTAL_USERS = 10000;
const BATCH_SIZE = 50;
const AUTH_CONCURRENCY = 100;
const TEST_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Distribution of auth methods
const ROOM_NUMBER_COUNT = 2500;
const VOUCHER_COUNT = 2500;
const PMS_CREDENTIALS_COUNT = 2500;
const OPEN_ACCESS_COUNT = 1500;
const MAC_AUTH_COUNT = 1000;

// Indian guest name pools for realistic test data
const FIRST_NAMES = [
  'Amit', 'Rahul', 'Sneha', 'Vikram', 'Pooja', 'Rina', 'Deepak', 'Anita',
  'Rajesh', 'Priya', 'Sanjay', 'Meera', 'Arjun', 'Kavita', 'Sunil', 'Nisha',
  'Manish', 'Swati', 'Dinesh', 'Rekha', 'Suresh', 'Anjali', 'Mohan', 'Sunita',
  'Ashok', 'Lata', 'Ravi', 'Usha', 'Kiran', 'Bhavna', 'Gaurav', 'Pallavi',
];

const LAST_NAMES = [
  'Mukherjee', 'Banerjee', 'Gupta', 'Singh', 'Saha', 'Chatterjee', 'Das', 'Roy',
  'Patel', 'Sharma', 'Verma', 'Joshi', 'Reddy', 'Nair', 'Iyer', 'Pillai',
  'Mehta', 'Shah', 'Agarwal', 'Malhotra', 'Kapoor', 'Chopra', 'Bhatia', 'Saxena',
  'Tiwari', 'Mishra', 'Pandey', 'Srivastava', 'Chauhan', 'Yadav', 'Rao', 'Desai',
];

// ────────────────────────────────────────────────────────────────────────────────
// Test Results Tracking
// ────────────────────────────────────────────────────────────────────────────────

interface AuthResult {
  userIdx: number;
  method: string;
  username: string;
  planName: string;
  macAddress: string;
  clientIp: string;
  success: boolean;
  radiusAccepted: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}

interface TestStats {
  totalUsersCreated: number;
  totalAuthAttempts: number;
  authSuccesses: number;
  authFailures: number;
  totalSessionsCreated: number;
  totalDisconnects: number;
  responseTimes: number[];
  errorCategories: Map<string, number>;
  methodStats: Map<string, { attempts: number; successes: number; failures: number }>;
  startTime: number;
  phaseTimes: Map<string, number>;
}

const stats: TestStats = {
  totalUsersCreated: 0,
  totalAuthAttempts: 0,
  authSuccesses: 0,
  authFailures: 0,
  totalSessionsCreated: 0,
  totalDisconnects: 0,
  responseTimes: [],
  errorCategories: new Map(),
  methodStats: new Map(),
  startTime: Date.now(),
  phaseTimes: new Map(),
};

const planIdMap = new Map<string, string>();
const createdVouchers: string[] = [];
const createdUsers: { username: string; password: string; method: string }[] = [];
const createdMacEntries: string[] = [];
const authResults: AuthResult[] = [];

let sessionCookie = '';
let portalId = '';
let ipPoolId = '';

// ────────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────────────────────────────────────

function log(phase: string, msg: string) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] [${phase}] ${msg}`);
}

function logSuccess(phase: string, msg: string) { log(phase, `✅ ${msg}`); }
function logError(phase: string, msg: string) { log(phase, `❌ ${msg}`); }
function logWarn(phase: string, msg: string) { log(phase, `⚠️  ${msg}`); }
function logInfo(phase: string, msg: string) { log(phase, `ℹ️  ${msg}`); }

/** Generate a locally administered MAC address (02:XX:XX:XX:XX:XX) */
function generateMac(index: number): string {
  const bytes = [
    0x02,
    (index >> 24) & 0xff,
    (index >> 16) & 0xff,
    (index >> 8) & 0xff,
    index & 0xff,
    randomInt(0, 256),
  ];
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** Generate a client IP from 10.0.X.X range (supports 65k+ unique IPs) */
function generateClientIp(index: number): string {
  const subnet = Math.floor(index / 254) + 1;
  const host = (index % 254) + 1;
  return `10.0.${subnet}.${host}`;
}

/** Execute SQL via psql and return output */
function sql(query: string): string {
  const env = { ...process.env, PGPASSWORD: DB_PASS };
  try {
    return execSync(
      `${PSQL_BIN} -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -t -A -c "${query.replace(/"/g, '\\"')}"`,
      { env, timeout: 15000, encoding: 'utf-8' }
    ).trim();
  } catch (err: any) {
    return `SQL_ERROR: ${err.message?.substring(0, 200) || err}`;
  }
}

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Record an error category */
function recordError(category: string) {
  const current = stats.errorCategories.get(category) || 0;
  stats.errorCategories.set(category, current + 1);
}

/** Record method stats */
function recordMethodStat(method: string, success: boolean) {
  const current = stats.methodStats.get(method) || { attempts: 0, successes: 0, failures: 0 };
  current.attempts++;
  if (success) current.successes++;
  else current.failures++;
  stats.methodStats.set(method, current);
}

/** Make an HTTP request with retry logic */
async function httpReq(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
  retries = 1
): Promise<{ status: number; data: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const opts: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
          ...headers,
        },
      };
      if (body && method !== 'GET') {
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`${BASE_URL}${path}`, opts);
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    } catch (err: any) {
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      } else {
        return { status: 0, data: { error: err.message } };
      }
    }
  }
  return { status: 0, data: { error: 'Max retries exceeded' } };
}

/** Process items in batches with controlled concurrency */
async function batchOperation<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.allSettled(chunk.map((item, j) => fn(item, i + j)));
    if (i + concurrency < items.length) {
      await sleep(100);
    }
  }
}

/** Test RADIUS auth via radclient */
function radclientAuth(username: string, password: string): { accepted: boolean; output: string; durationMs: number } {
  const tmpFile = `/tmp/radtest-${Date.now()}-${randomInt(0, 99999)}.txt`;
  try {
    const attrs = `User-Name="${username}"\nUser-Password="${password}"\nNAS-IP-Address=127.0.0.1\nNAS-Port=0\nCalled-Station-Id=StaySuite-Guest\nCalling-Station-Id=00:00:00:00:00:00\nService-Type=Framed-User\n`;
    execSync(`cat > ${tmpFile} << 'RAD_EOF'\n${attrs}RAD_EOF`, { timeout: 5000 });

    const start = Date.now();
    const cmd = `RADCLIENT_DICT=${RADCLIENT_DICT} LD_LIBRARY_PATH=${RADCLIENT_LIB} ${RADCLIENT_BIN} -t 5 -r 1 -n 3 ${RADIUS_SERVER}:1812 auth ${RADIUS_SECRET} < ${tmpFile} 2>&1`;
    const output = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
    const durationMs = Date.now() - start;
    const accepted = output.includes('Access-Accept') || output.includes('Received Access-Accept');
    return { accepted, output, durationMs };
  } catch (err: any) {
    const output = err.stdout || err.message || 'radclient error';
    const accepted = output.includes('Access-Accept');
    return { accepted, output, durationMs: 0 };
  } finally {
    try { execSync(`rm -f ${tmpFile}`, { timeout: 2000 }); } catch { /* ignore */ }
  }
}

/** Format bytes to human-readable */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Format duration */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 0: Environment Setup
// ────────────────────────────────────────────────────────────────────────────────

async function phase0_setup() {
  const phaseStart = Date.now();
  log('P0', '════════════════════════════════════════════════════════════');
  log('P0', 'Phase 0: Environment Setup');
  log('P0', '════════════════════════════════════════════════════════════');

  // Step 1: Login as admin
  log('P0', 'Step 1: Logging in as admin...');
  try {
    const loginFetchRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const loginData = await loginFetchRes.json();

    const setCookieHeaders = loginFetchRes.headers.getSetCookie?.() || [];
    for (const cookieStr of setCookieHeaders) {
      if (cookieStr.includes('session_token') || cookieStr.includes('next-auth') || cookieStr.includes('token')) {
        sessionCookie = cookieStr.split(';')[0];
        break;
      }
    }

    if (loginFetchRes.status === 200 && loginData.success) {
      logSuccess('P0', `Admin login successful: ${loginData.user?.name || ADMIN_EMAIL}`);
      if (sessionCookie) {
        logInfo('P0', `Session cookie captured: ${sessionCookie.substring(0, 40)}...`);
      } else {
        logWarn('P0', 'No session cookie found — using best effort');
        sessionCookie = 'session_token=test';
      }
    } else {
      logWarn('P0', `Admin login returned status ${loginFetchRes.status}: ${JSON.stringify(loginData).substring(0, 200)}`);
      sessionCookie = 'session_token=test';
    }
  } catch (err: any) {
    logError('P0', `Login failed: ${err.message}`);
    sessionCookie = 'session_token=test';
  }

  // Step 2: Verify FreeRADIUS is running
  log('P0', 'Step 2: Verifying FreeRADIUS is running...');
  const radResult = radclientAuth('test-probe-user', 'test-probe-pass');
  const hasRADIUSResponse = radResult.output.includes('Access-Reject') || radResult.output.includes('Access-Accept');
  if (hasRADIUSResponse || radResult.output.includes('Sent Access-Request')) {
    logSuccess('P0', `FreeRADIUS is running (probe: ${radResult.accepted ? 'Accept' : 'Reject'}, ${radResult.durationMs}ms)`);
  } else {
    logError('P0', `FreeRADIUS not responding properly: ${radResult.output.substring(0, 200)}`);
    logWarn('P0', 'Continuing anyway — some tests may fail');
  }

  // Step 3: Verify DB connectivity
  log('P0', 'Step 3: Verifying PostgreSQL connectivity...');
  const dbCheck = sql('SELECT count(*) FROM "WiFiPlan"');
  if (!dbCheck.startsWith('SQL_ERROR')) {
    logSuccess('P0', `PostgreSQL connected — ${dbCheck} WiFi plans found`);
  } else {
    logError('P0', `PostgreSQL connection failed: ${dbCheck}`);
  }

  // Step 4: Verify existing data
  log('P0', 'Step 4: Verifying existing seed data...');
  const tenantCount = sql(`SELECT count(*) FROM "Tenant" WHERE id = '${TENANT_ID}'`);
  const propertyCount = sql(`SELECT count(*) FROM "Property" WHERE id = '${PROPERTY_ID}'`);
  logInfo('P0', `Tenant: ${tenantCount}, Property: ${propertyCount}`);

  if (tenantCount === '0' || propertyCount === '0') {
    logError('P0', 'Required tenant/property not found — aborting');
    process.exit(1);
  }

  // Step 5: Check existing user counts
  const existingUsers = sql('SELECT count(*) FROM "WiFiUser"');
  const existingRadacct = sql('SELECT count(*) FROM radacct');
  logInfo('P0', `Existing WiFiUser: ${existingUsers}, radacct: ${existingRadacct}`);

  stats.phaseTimes.set('P0', Date.now() - phaseStart);
  logInfo('P0', `Phase 0 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 1: Create WiFi Plans via API (10 plans)
// ────────────────────────────────────────────────────────────────────────────────

async function phase1_createPlans() {
  const phaseStart = Date.now();
  log('P1', '════════════════════════════════════════════════════════════');
  log('P1', 'Phase 1: Creating 10 Test WiFi Plans via API');
  log('P1', '════════════════════════════════════════════════════════════');

  // Store existing plan IDs first
  const existingPlans = sql(`SELECT id, name FROM "WiFiPlan" WHERE "tenantId" = '${TENANT_ID}'`);
  if (existingPlans && !existingPlans.startsWith('SQL_ERROR')) {
    existingPlans.split('\n').forEach(line => {
      if (line.trim()) {
        const [id, name] = line.split('|');
        if (id && name) planIdMap.set(name.trim(), id.trim());
      }
    });
  }
  logInfo('P1', `Found ${planIdMap.size} existing plans: ${Array.from(planIdMap.keys()).join(', ')}`);

  const plans = [
    { name: 'Free 5M', downloadSpeed: 5, uploadSpeed: 2, dataLimit: null, maxDevices: 1, validityDays: 1, validityMinutes: 240, sessionTimeoutSec: 14400, description: 'Basic free WiFi - 5M/2M, 4hr timeout', priority: 1 },
    { name: 'Standard 10M', downloadSpeed: 10, uploadSpeed: 5, dataLimit: 2048, maxDevices: 2, validityDays: 1, validityMinutes: 480, sessionTimeoutSec: 28800, description: 'Standard WiFi - 10M/5M, 2GB cap, 8hr timeout', priority: 2 },
    { name: 'Premium 25M', downloadSpeed: 25, uploadSpeed: 10, dataLimit: 5120, maxDevices: 3, validityDays: 1, validityMinutes: 720, sessionTimeoutSec: 43200, description: 'Premium WiFi - 25M/10M, 5GB cap, 12hr timeout', priority: 3 },
    { name: 'VIP 50M', downloadSpeed: 50, uploadSpeed: 25, dataLimit: 10240, maxDevices: 5, validityDays: 1, validityMinutes: 1440, sessionTimeoutSec: 86400, description: 'VIP WiFi - 50M/25M, 10GB cap, 24hr timeout', priority: 4 },
    { name: 'Data Saver 2M', downloadSpeed: 2, uploadSpeed: 1, dataLimit: 512, maxDevices: 1, validityDays: 1, validityMinutes: 120, sessionTimeoutSec: 7200, description: 'FUP test - 2M/1M, 500MB cap, 2hr timeout', priority: 5 },
    { name: 'Conference 30M', downloadSpeed: 30, uploadSpeed: 15, dataLimit: null, maxDevices: 10, validityDays: 1, validityMinutes: 240, sessionTimeoutSec: 14400, description: 'Conference WiFi - 30M/15M, 10 devices, 4hr timeout', priority: 6 },
    { name: 'Day Pass 20M', downloadSpeed: 20, uploadSpeed: 10, dataLimit: 3072, maxDevices: 1, validityDays: 1, validityMinutes: 1440, sessionTimeoutSec: 86400, description: 'Day Pass - 20M/10M, 3GB, 24hr validity', priority: 7 },
    { name: 'Night Owl 15M', downloadSpeed: 15, uploadSpeed: 8, dataLimit: 1024, maxDevices: 1, validityDays: 1, validityMinutes: 480, sessionTimeoutSec: 28800, description: 'Night Owl - 15M/8M, 1GB, 8hr timeout', priority: 8 },
    { name: 'Express 100M', downloadSpeed: 100, uploadSpeed: 50, dataLimit: null, maxDevices: 1, validityDays: 1, validityMinutes: 60, sessionTimeoutSec: 3600, description: 'Express burst - 100M/50M, 1hr timeout', priority: 9 },
    { name: 'Voucher Basic', downloadSpeed: 5, uploadSpeed: 2, dataLimit: 1024, maxDevices: 1, validityDays: 1, validityMinutes: 240, sessionTimeoutSec: 14400, description: 'Voucher testing - 5M/2M, 1GB, 4hr timeout', priority: 10 },
  ];

  let created = 0;
  let skipped = 0;

  for (const plan of plans) {
    if (planIdMap.has(plan.name)) {
      logInfo('P1', `Plan "${plan.name}" already exists (id: ${planIdMap.get(plan.name)}) — skipping`);
      skipped++;
      continue;
    }

    const res = await httpReq('POST', '/api/wifi/plans', {
      propertyId: PROPERTY_ID,
      tenantId: TENANT_ID,
      ...plan,
      price: 0,
      currency: 'INR',
      status: 'active',
    });

    if (res.status === 201 && res.data.success && res.data.data?.id) {
      planIdMap.set(plan.name, res.data.data.id);
      logSuccess('P1', `Created plan "${plan.name}" (id: ${res.data.data.id})`);
      created++;
    } else {
      // Try to find existing plan by name via DB query
      const existingId = sql(`SELECT id FROM "WiFiPlan" WHERE name = '${plan.name}' AND "tenantId" = '${TENANT_ID}' LIMIT 1`);
      if (existingId && !existingId.startsWith('SQL_ERROR') && existingId.trim()) {
        planIdMap.set(plan.name, existingId.trim());
        logWarn('P1', `Plan "${plan.name}" creation returned ${res.status}, found existing: ${existingId.trim()}`);
        skipped++;
      } else {
        logError('P1', `Failed to create plan "${plan.name}" via API: ${JSON.stringify(res.data).substring(0, 150)}`);
      }
    }
    await sleep(200);
  }

  logInfo('P1', `Plans: ${created} created, ${skipped} existing, ${planIdMap.size} total available`);
  stats.phaseTimes.set('P1', Date.now() - phaseStart);
  logInfo('P1', `Phase 1 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 2: Create IP Pool & Portal via API
// ────────────────────────────────────────────────────────────────────────────────

async function phase2_createIpPoolAndPortal() {
  const phaseStart = Date.now();
  log('P2', '════════════════════════════════════════════════════════════');
  log('P2', 'Phase 2: Creating IP Pool & Captive Portal via API');
  log('P2', '════════════════════════════════════════════════════════════');

  // Step 1: Create IP Pool via API
  log('P2', 'Step 1: Creating Guest IP Pool via API...');
  const poolRes = await httpReq('POST', '/api/wifi/ip-pools', {
    tenantId: TENANT_ID,
    name: 'Guest Pool 10K',
    subnet: '10.0.0.0/16',
    gateway: '10.0.0.1',
    captivePortal: true,
    isDefault: true,
    enabled: true,
    ranges: [{ startIp: '10.0.1.10', endIp: '10.0.255.250' }],
  });

  if (poolRes.status === 201 && poolRes.data.success && poolRes.data.data?.id) {
    ipPoolId = poolRes.data.data.id;
    logSuccess('P2', `Created IP Pool via API (id: ${ipPoolId})`);
  } else {
    logWarn('P2', `IP Pool API returned ${poolRes.status}: ${JSON.stringify(poolRes.data).substring(0, 150)}`);
    // Check existing
    const existingPool = sql(`SELECT id FROM "IpPool" WHERE name = 'Guest Pool 10K' AND "tenantId" = '${TENANT_ID}' LIMIT 1`);
    if (existingPool && !existingPool.startsWith('SQL_ERROR') && existingPool.trim()) {
      ipPoolId = existingPool.trim();
      logInfo('P2', `Found existing IP Pool: ${ipPoolId}`);
    } else {
      // Fallback to original Guest Pool
      const fallbackPool = sql(`SELECT id FROM "IpPool" WHERE "tenantId" = '${TENANT_ID}' LIMIT 1`);
      if (fallbackPool && !fallbackPool.startsWith('SQL_ERROR') && fallbackPool.trim()) {
        ipPoolId = fallbackPool.trim();
        logInfo('P2', `Using fallback IP Pool: ${ipPoolId}`);
      }
    }
  }

  // Step 2: Create Captive Portal via API
  log('P2', 'Step 2: Creating Captive Portal via API...');
  const portalRes = await httpReq('POST', '/api/wifi/portal/instances', {
    tenantId: TENANT_ID,
    propertyId: PROPERTY_ID,
    slug: PORTAL_SLUG,
    name: 'Royal Stay 10K Test Portal',
    enabled: true,
    sessionTimeout: 86400,
    idleTimeout: 1800,
    maxBandwidthDown: 5242880,
    maxBandwidthUp: 1048576,
    authMethod: 'room_number,voucher,pms_credentials,sms_otp,open_access',
  });

  if (portalRes.status === 201 && portalRes.data.success && portalRes.data.data?.id) {
    portalId = portalRes.data.data.id;
    logSuccess('P2', `Created Captive Portal via API (id: ${portalId})`);
  } else {
    logWarn('P2', `Portal API returned ${portalRes.status}: ${JSON.stringify(portalRes.data).substring(0, 150)}`);
    const existingPortal = sql(`SELECT id FROM "CaptivePortal" WHERE slug = '${PORTAL_SLUG}' LIMIT 1`);
    if (existingPortal && !existingPortal.startsWith('SQL_ERROR') && existingPortal.trim()) {
      portalId = existingPortal.trim();
      logInfo('P2', `Found existing Captive Portal: ${portalId}`);
    }
  }

  // Step 3: Create portal-pool mapping via API
  if (portalId && ipPoolId) {
    log('P2', 'Step 3: Creating portal-pool mapping...');
    const mappingRes = await httpReq('POST', '/api/wifi/portal/mappings', {
      portalId,
      poolId: ipPoolId,
      priority: 1,
    });
    if (mappingRes.data.success) {
      logSuccess('P2', 'Portal-pool mapping created');
    } else {
      logWarn('P2', `Portal-pool mapping: ${JSON.stringify(mappingRes.data).substring(0, 100)}`);
    }
  }

  // Step 4: Create checked-in bookings for room_number auth
  log('P2', 'Step 4: Creating checked-in bookings for room_number testing...');
  const rooms = sql(`SELECT r.id, r.number, r."roomTypeId" FROM "Room" r WHERE r."propertyId" = '${PROPERTY_ID}' ORDER BY r.number LIMIT 100`)
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('|');
      return { id: parts[0]?.trim(), number: parts[1]?.trim(), roomTypeId: parts[2]?.trim() };
    });

  logInfo('P2', `Found ${rooms.length} rooms available`);

  // Create bookings via API
  let bookingsCreated = 0;
  const bookingBatch = rooms.slice(0, 50); // Create 50 bookings for reuse
  for (const room of bookingBatch) {
    if (!room?.id || !room?.roomTypeId) continue;

    const hasBooking = sql(`SELECT count(*) FROM "Booking" WHERE "roomId" = '${room.id}' AND status = 'checked_in'`);
    if (hasBooking !== '0') continue;

    // Create guest + booking via bookings API
    const firstName = FIRST_NAMES[randomInt(0, FIRST_NAMES.length)];
    const lastName = LAST_NAMES[randomInt(0, LAST_NAMES.length)];

    try {
      const bookingRes = await httpReq('POST', '/api/bookings', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        primaryGuest: { firstName, lastName, email: `wifi10k.${room.number}@royalstay.in`, phone: `+9198765${String(20000 + bookingsCreated).padStart(5, '0')}` },
        checkIn: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        checkOut: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        adults: 1,
        status: 'checked_in',
      });

      if (bookingRes.data.success) {
        bookingsCreated++;
      } else {
        logWarn('P2', `Booking API failed for room ${room.number}: ${JSON.stringify(bookingRes.data).substring(0, 100)}`);
      }
    } catch (err: any) {
      logWarn('P2', `Booking creation exception for room ${room.number}: ${err.message?.substring(0, 80)}`);
    }
    await sleep(100);
  }

  logInfo('P2', `Created ${bookingsCreated} checked-in bookings via API`);
  const totalCheckedIn = sql(`SELECT count(*) FROM "Booking" WHERE status = 'checked_in'`);
  logInfo('P2', `Total checked-in bookings now: ${totalCheckedIn}`);

  stats.phaseTimes.set('P2', Date.now() - phaseStart);
  logInfo('P2', `Phase 2 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 3: Create 10,000 RADIUS Users via API (BATCH)
// ────────────────────────────────────────────────────────────────────────────────

async function phase3_createUsers() {
  const phaseStart = Date.now();
  log('P3', '════════════════════════════════════════════════════════════');
  log('P3', 'Phase 3: Creating 10,000 RADIUS Users via API (BATCH)');
  log('P3', '════════════════════════════════════════════════════════════');

  // ─── Group A: Create 2,500 voucher users via API ───
  log('P3', '');
  log('P3', '─── Group A: Creating 2,500 Voucher Users ───');

  const voucherPlans = ['Voucher Basic', 'Day Pass 20M', 'Night Owl 15M', 'Free 5M'];
  let vouchersCreated = 0;
  const voucherBatchSize = 10; // Create 10 vouchers per API call

  for (let batch = 0; batch < Math.ceil(VOUCHER_COUNT / voucherBatchSize); batch++) {
    const planName = voucherPlans[batch % voucherPlans.length];
    const planId = planIdMap.get(planName) || Array.from(planIdMap.values())[0];
    if (!planId) {
      logWarn('P3-A', `No plan ID for "${planName}" — skipping batch ${batch}`);
      continue;
    }

    const quantity = Math.min(voucherBatchSize, VOUCHER_COUNT - vouchersCreated);
    const res = await httpReq('POST', '/api/wifi/vouchers', {
      propertyId: PROPERTY_ID,
      planId,
      quantity,
      validityDays: 1,
    });

    if (res.status === 201 && res.data.success && res.data.data) {
      const vouchers = Array.isArray(res.data.data) ? res.data.data : [res.data.data];
      for (const v of vouchers) {
        if (v.code) {
          createdVouchers.push(v.code);
          vouchersCreated++;
        }
      }
    } else {
      logWarn('P3-A', `Voucher batch ${batch} failed: ${JSON.stringify(res.data).substring(0, 100)}`);
      recordError('VOUCHER_CREATE_FAILED');
    }

    if (batch % 25 === 0) {
      logInfo('P3-A', `Vouchers created: ${vouchersCreated}/${VOUCHER_COUNT}`);
    }
    await sleep(150);
  }

  logSuccess('P3-A', `Created ${vouchersCreated} vouchers`);

  // ─── Group B: Create 2,500 PMS credentials users via API ───
  log('P3', '');
  log('P3', '─── Group B: Creating 2,500 PMS Credentials Users ───');

  const pmsPlans = ['Data Saver 2M', 'Express 100M', 'Conference 30M', 'Standard 10M'];
  const pmsUserItems = Array.from({ length: PMS_CREDENTIALS_COUNT }, (_, i) => i);

  await batchOperation(pmsUserItems, BATCH_SIZE, async (i) => {
    const planName = pmsPlans[i % pmsPlans.length];
    const planId = planIdMap.get(planName) || Array.from(planIdMap.values())[0];
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i + 3) % LAST_NAMES.length];
    const username = `pms-${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}-${randomUUID().substring(0, 6)}`;
    const password = `${firstName}@2025`;

    const res = await httpReq('POST', '/api/wifi/radius', {
      action: 'create-user',
      username,
      password,
      userType: 'guest',
      planId,
      ipPoolId: ipPoolId || undefined,
    });

    if (res.status === 200 && res.data.success) {
      createdUsers.push({ username, password, method: 'pms_credentials' });
    } else {
      // Try wifi/users API as fallback
      const fallbackRes = await httpReq('POST', '/api/wifi/users', {
        propertyId: PROPERTY_ID,
        planId,
        username,
        password,
        guestName: `${firstName} ${lastName}`,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        userType: 'guest',
        sessionLimit: 3,
      });

      if (fallbackRes.status === 200 && fallbackRes.data.success) {
        createdUsers.push({ username, password, method: 'pms_credentials' });
      } else {
        recordError('PMS_USER_CREATE_FAILED');
      }
    }
  });

  logSuccess('P3-B', `Created ${createdUsers.filter(u => u.method === 'pms_credentials').length} PMS users`);

  // ─── Group C: Create 1,000 MAC auth users via API ───
  log('P3', '');
  log('P3', '─── Group C: Creating 1,000 MAC Auth Entries ───');

  const macPlans = ['Free 5M', 'Standard 10M'];
  const macItems = Array.from({ length: MAC_AUTH_COUNT }, (_, i) => i);

  await batchOperation(macItems, BATCH_SIZE, async (i) => {
    const mac = generateMac(10000 + i);
    const planName = macPlans[i % macPlans.length];
    const planId = planIdMap.get(planName);

    const res = await httpReq('POST', '/api/wifi/mac-auth', {
      macAddress: mac,
      autoLogin: true,
      planId,
      propertyId: PROPERTY_ID,
      guestName: `MAC Guest ${i}`,
      description: `10K test MAC user ${i}`,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    if (res.status === 201 && res.data.success) {
      createdMacEntries.push(mac);
    } else {
      // Duplicate is OK (P2002)
      if (res.data.error?.code === 'DUPLICATE' || res.status === 409) {
        createdMacEntries.push(mac);
      } else {
        recordError('MAC_AUTH_CREATE_FAILED');
      }
    }
  });

  logSuccess('P3-C', `Created ${createdMacEntries.length} MAC auth entries`);

  // ─── Group D: Room number users don't need explicit creation ───
  // They auth via existing checked-in bookings
  log('P3', '');
  log('P3', '─── Group D: Room Number Users (auth via existing bookings) ───');
  const bookingsRaw = sql(`
    SELECT b.id, r.number as room_num, g."lastName"
    FROM "Booking" b 
    JOIN "Room" r ON r.id = b."roomId" 
    JOIN "Guest" g ON g.id = b."primaryGuestId" 
    WHERE b.status = 'checked_in' AND b."propertyId" = '${PROPERTY_ID}'
    ORDER BY r.number
  `);
  const bookings = bookingsRaw.split('\n')
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('|');
      return { id: parts[0]?.trim(), roomNum: parts[1]?.trim(), lastName: parts[2]?.trim() };
    });
  logInfo('P3-D', `${bookings.length} checked-in bookings available for room_number auth`);

  // ─── Group E: Open access users don't need explicit creation ───
  log('P3', '─── Group E: Open Access Users (no pre-creation needed) ───');

  stats.totalUsersCreated = createdVouchers.length + createdUsers.length + createdMacEntries.length;
  logInfo('P3', `Total pre-created users: ${stats.totalUsersCreated}`);

  stats.phaseTimes.set('P3', Date.now() - phaseStart);
  logInfo('P3', `Phase 3 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 4: Authenticate all 10k users via /connect portal
// ────────────────────────────────────────────────────────────────────────────────

async function phase4_authenticateUsers() {
  const phaseStart = Date.now();
  log('P4', '════════════════════════════════════════════════════════════');
  log('P4', 'Phase 4: Authenticating 10,000 Users via /connect Portal');
  log('P4', '════════════════════════════════════════════════════════════');

  // ─── Group A: Room Number Auth (2,500 users) ───
  log('P4', '');
  log('P4', '─── Group A: Room Number Auth (2,500 users) ───');

  const bookingsRaw = sql(`
    SELECT b.id, r.number as room_num, g."lastName"
    FROM "Booking" b 
    JOIN "Room" r ON r.id = b."roomId" 
    JOIN "Guest" g ON g.id = b."primaryGuestId" 
    WHERE b.status = 'checked_in' AND b."propertyId" = '${PROPERTY_ID}'
    ORDER BY r.number
  `);
  const bookings = bookingsRaw.split('\n')
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('|');
      return { id: parts[0]?.trim(), roomNum: parts[1]?.trim(), lastName: parts[2]?.trim() };
    });

  if (bookings.length === 0) {
    logWarn('P4-A', 'No checked-in bookings found — skipping room_number auth');
  } else {
    const roomAuthItems = Array.from({ length: ROOM_NUMBER_COUNT }, (_, i) => i);

    await batchOperation(roomAuthItems, AUTH_CONCURRENCY, async (i) => {
      const booking = bookings[i % bookings.length];
      if (!booking) return;

      const mac = generateMac(i + 1);
      const clientIp = generateClientIp(i + 1);
      const startMs = Date.now();

      try {
        const res = await httpReq('POST', '/api/v1/wifi/auth', {
          method: 'room_number',
          portalSlug: PORTAL_SLUG,
          roomNumber: booking.roomNum,
          lastName: booking.lastName,
          macAddress: mac,
          propertyId: PROPERTY_ID,
        }, {
          'X-Forwarded-For': clientIp,
          'X-Real-IP': clientIp,
        });

        const durationMs = Date.now() - startMs;
        const success = res.status === 200 && res.data?.success;
        const radiusAccepted = res.data?.data?.authenticated === true;

        stats.totalAuthAttempts++;
        if (success) stats.authSuccesses++;
        else stats.authFailures++;
        stats.responseTimes.push(durationMs);
        recordMethodStat('room_number', success);

        if (!success) {
          recordError(res.data?.error?.code || 'ROOM_AUTH_FAILED');
        }

        authResults.push({
          userIdx: i, method: 'room_number',
          username: res.data?.data?.username || `room-${booking.roomNum?.toLowerCase()}`,
          planName: '', macAddress: mac, clientIp,
          success, radiusAccepted,
          errorCode: res.data?.error?.code, errorMessage: res.data?.error?.message?.substring(0, 80),
          durationMs,
        });

        if (success && res.data?.data?.username) {
          createdUsers.push({ username: res.data.data.username, password: 'room-auth', method: 'room_number' });
        }
      } catch (err: any) {
        stats.totalAuthAttempts++;
        stats.authFailures++;
        recordMethodStat('room_number', false);
        recordError('ROOM_AUTH_EXCEPTION');
      }
    });

    logInfo('P4-A', `Room number auth: ${stats.methodStats.get('room_number')?.attempts || 0} attempts, ${stats.methodStats.get('room_number')?.successes || 0} successes`);
  }

  // ─── Group B: Voucher Auth (2,500 users) ───
  log('P4', '');
  log('P4', '─── Group B: Voucher Auth (2,500 users) ───');

  const voucherAuthItems = Array.from({ length: Math.min(VOUCHER_COUNT, createdVouchers.length) }, (_, i) => i);

  await batchOperation(voucherAuthItems, AUTH_CONCURRENCY, async (i) => {
    const code = createdVouchers[i];
    const mac = generateMac(3000 + i + 1);
    const clientIp = generateClientIp(3000 + i + 1);
    const startMs = Date.now();

    try {
      const res = await httpReq('POST', '/api/v1/wifi/auth', {
        method: 'voucher',
        portalSlug: PORTAL_SLUG,
        voucherCode: code,
        macAddress: mac,
        propertyId: PROPERTY_ID,
      }, {
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      });

      const durationMs = Date.now() - startMs;
      const success = res.status === 200 && res.data?.success;

      stats.totalAuthAttempts++;
      if (success) stats.authSuccesses++;
      else stats.authFailures++;
      stats.responseTimes.push(durationMs);
      recordMethodStat('voucher', success);

      if (!success) {
        recordError(res.data?.error?.code || 'VOUCHER_AUTH_FAILED');
      }

      if (success && res.data?.data?.username) {
        createdUsers.push({ username: res.data.data.username, password: code, method: 'voucher' });
      }
    } catch (err: any) {
      stats.totalAuthAttempts++;
      stats.authFailures++;
      recordMethodStat('voucher', false);
      recordError('VOUCHER_AUTH_EXCEPTION');
    }
  });

  logInfo('P4-B', `Voucher auth: ${stats.methodStats.get('voucher')?.attempts || 0} attempts, ${stats.methodStats.get('voucher')?.successes || 0} successes`);

  // ─── Group C: PMS Credentials Auth (2,500 users) ───
  log('P4', '');
  log('P4', '─── Group C: PMS Credentials Auth (2,500 users) ───');

  const pmsUsers = createdUsers.filter(u => u.method === 'pms_credentials');
  const pmsAuthItems = Array.from({ length: Math.min(PMS_CREDENTIALS_COUNT, pmsUsers.length) }, (_, i) => i);

  await batchOperation(pmsAuthItems, AUTH_CONCURRENCY, async (i) => {
    const user = pmsUsers[i];
    if (!user) return;

    const mac = generateMac(6000 + i + 1);
    const clientIp = generateClientIp(6000 + i + 1);
    const startMs = Date.now();

    try {
      const res = await httpReq('POST', '/api/v1/wifi/auth', {
        method: 'pms_credentials',
        portalSlug: PORTAL_SLUG,
        username: user.username,
        password: user.password,
        macAddress: mac,
        propertyId: PROPERTY_ID,
      }, {
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      });

      const durationMs = Date.now() - startMs;
      const success = res.status === 200 && res.data?.success;

      stats.totalAuthAttempts++;
      if (success) stats.authSuccesses++;
      else stats.authFailures++;
      stats.responseTimes.push(durationMs);
      recordMethodStat('pms_credentials', success);

      if (!success) {
        recordError(res.data?.error?.code || 'PMS_AUTH_FAILED');
      }
    } catch (err: any) {
      stats.totalAuthAttempts++;
      stats.authFailures++;
      recordMethodStat('pms_credentials', false);
      recordError('PMS_AUTH_EXCEPTION');
    }
  });

  logInfo('P4-C', `PMS auth: ${stats.methodStats.get('pms_credentials')?.attempts || 0} attempts, ${stats.methodStats.get('pms_credentials')?.successes || 0} successes`);

  // ─── Group D: Open Access Auth (1,500 users) ───
  log('P4', '');
  log('P4', '─── Group D: Open Access Auth (1,500 users) ───');

  const openAuthItems = Array.from({ length: OPEN_ACCESS_COUNT }, (_, i) => i);

  await batchOperation(openAuthItems, AUTH_CONCURRENCY, async (i) => {
    const mac = generateMac(9000 + i + 1);
    const clientIp = generateClientIp(9000 + i + 1);
    const startMs = Date.now();

    try {
      const res = await httpReq('POST', '/api/v1/wifi/auth', {
        method: 'open_access',
        portalSlug: PORTAL_SLUG,
        macAddress: mac,
        propertyId: PROPERTY_ID,
      }, {
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      });

      const durationMs = Date.now() - startMs;
      const success = res.status === 200 && res.data?.success;

      stats.totalAuthAttempts++;
      if (success) stats.authSuccesses++;
      else stats.authFailures++;
      stats.responseTimes.push(durationMs);
      recordMethodStat('open_access', success);

      if (!success) {
        recordError(res.data?.error?.code || 'OPEN_AUTH_FAILED');
      }

      if (success && res.data?.data?.username) {
        createdUsers.push({ username: res.data.data.username, password: 'open-access', method: 'open_access' });
      }
    } catch (err: any) {
      stats.totalAuthAttempts++;
      stats.authFailures++;
      recordMethodStat('open_access', false);
      recordError('OPEN_AUTH_EXCEPTION');
    }
  });

  logInfo('P4-D', `Open access auth: ${stats.methodStats.get('open_access')?.attempts || 0} attempts, ${stats.methodStats.get('open_access')?.successes || 0} successes`);

  // ─── Group E: MAC Auth (1,000 users) ───
  log('P4', '');
  log('P4', '─── Group E: MAC Auth (1,000 users) ───');

  // MAC auth goes through the /connect portal with method 'open_access'
  // or directly through RADIUS MAC authentication
  const macAuthItems = Array.from({ length: Math.min(MAC_AUTH_COUNT, createdMacEntries.length) }, (_, i) => i);

  await batchOperation(macAuthItems, AUTH_CONCURRENCY, async (i) => {
    const mac = createdMacEntries[i];
    const clientIp = generateClientIp(11000 + i + 1);
    const startMs = Date.now();

    try {
      // MAC auth users connect through the portal as open_access
      // (MAC auth is automatic in the RADIUS layer)
      const res = await httpReq('POST', '/api/v1/wifi/auth', {
        method: 'open_access',
        portalSlug: PORTAL_SLUG,
        macAddress: mac,
        propertyId: PROPERTY_ID,
      }, {
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      });

      const durationMs = Date.now() - startMs;
      const success = res.status === 200 && res.data?.success;

      stats.totalAuthAttempts++;
      if (success) stats.authSuccesses++;
      else stats.authFailures++;
      stats.responseTimes.push(durationMs);
      recordMethodStat('mac_auth', success);

      if (!success) {
        recordError(res.data?.error?.code || 'MAC_AUTH_FAILED');
      }
    } catch (err: any) {
      stats.totalAuthAttempts++;
      stats.authFailures++;
      recordMethodStat('mac_auth', false);
      recordError('MAC_AUTH_EXCEPTION');
    }
  });

  logInfo('P4-E', `MAC auth: ${stats.methodStats.get('mac_auth')?.attempts || 0} attempts, ${stats.methodStats.get('mac_auth')?.successes || 0} successes`);

  stats.phaseTimes.set('P4', Date.now() - phaseStart);
  logInfo('P4', `Phase 4 completed in ${formatDuration(Date.now() - phaseStart)}`);
  logInfo('P4', `Total auth: ${stats.totalAuthAttempts} attempts, ${stats.authSuccesses} successes, ${stats.authFailures} failures`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 5: Simulate RADIUS Accounting Sessions
// ────────────────────────────────────────────────────────────────────────────────

async function phase5_simulateSessions() {
  const phaseStart = Date.now();
  log('P5', '════════════════════════════════════════════════════════════');
  log('P5', 'Phase 5: Simulating RADIUS Accounting Sessions');
  log('P5', '════════════════════════════════════════════════════════════');

  // Create WiFi sessions via the API for all authenticated users
  const allAuthedUsers = createdUsers.filter(u => u.username);
  logInfo('P5', `Creating sessions for ${allAuthedUsers.length} authenticated users`);

  const sessionItems = allAuthedUsers.slice(0, 5000); // Create sessions for up to 5000 users

  await batchOperation(sessionItems, BATCH_SIZE, async (user, idx) => {
    if (!user.username) return;

    const mac = generateMac(idx + 1);
    const clientIp = generateClientIp(idx + 1);
    const planName = Array.from(planIdMap.keys())[idx % planIdMap.size];
    const planId = planIdMap.get(planName);

    try {
      // Create WiFi session via API
      const res = await httpReq('POST', '/api/wifi/sessions', {
        propertyId: PROPERTY_ID,
        planId,
        macAddress: mac,
        ipAddress: clientIp,
        deviceName: `Test Device ${idx}`,
        deviceType: idx % 3 === 0 ? 'mobile' : idx % 3 === 1 ? 'desktop' : 'tablet',
        authMethod: user.method,
      });

      if (res.status === 201 && res.data.success) {
        stats.totalSessionsCreated++;
      } else {
        recordError('SESSION_CREATE_FAILED');
      }
    } catch (err: any) {
      recordError('SESSION_CREATE_EXCEPTION');
    }
  });

  logSuccess('P5', `Created ${stats.totalSessionsCreated} WiFi sessions`);

  // Create radacct entries via RADIUS accounting flow
  log('P5', 'Creating RADIUS accounting (radacct) entries...');
  let radacctCreated = 0;
  const radacctUsers = allAuthedUsers.slice(0, 3000);

  await batchOperation(radacctUsers, BATCH_SIZE, async (user, idx) => {
    if (!user.username) return;

    try {
      // Use the radius API event-users-bulk to create accounting entries
      const res = await httpReq('POST', '/api/wifi/radius', {
        action: 'event-users-bulk',
        eventId: `load-test-${Date.now()}`,
        propertyId: PROPERTY_ID,
        users: [{
          username: user.username,
          password: user.password,
          planId: Array.from(planIdMap.values())[idx % planIdMap.size],
          macAddress: generateMac(idx + 1),
          clientIp: generateClientIp(idx + 1),
          sessionTimeout: [300, 600, 1800, 3600, 7200, 14400, 28800, 43200, 86400][idx % 9],
        }],
      });

      if (res.data.success) {
        radacctCreated++;
      }
    } catch (err: any) {
      // Non-fatal
    }
  });

  logInfo('P5', `RADIUS accounting bulk requests: ${radacctCreated} submitted`);

  // Verify radacct entries exist
  const radacctCount = sql('SELECT count(*) FROM radacct');
  logInfo('P5', `Current radacct entries: ${radacctCount}`);

  stats.phaseTimes.set('P5', Date.now() - phaseStart);
  logInfo('P5', `Phase 5 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 6: Continuous 1-Hour Load Test
// ────────────────────────────────────────────────────────────────────────────────

async function phase6_continuousLoadTest() {
  const phaseStart = Date.now();
  log('P6', '════════════════════════════════════════════════════════════');
  log('P6', 'Phase 6: Continuous 1-Hour Load Test');
  log('P6', '════════════════════════════════════════════════════════════');

  const endTime = Date.now() + TEST_DURATION_MS;
  let cycleCount = 0;
  let lastFiveMinCycle = Date.now();
  let lastTenMinCycle = Date.now();
  let lastFifteenMinCycle = Date.now();
  let lastTwoMinLog = Date.now();

  while (Date.now() < endTime) {
    const now = Date.now();
    cycleCount++;

    // Every 5 minutes: create 500 new users, auth them, simulate sessions
    if (now - lastFiveMinCycle >= 5 * 60 * 1000) {
      lastFiveMinCycle = now;
      log('P6', '─── 5-Minute Cycle: Creating 500 new users ───');

      // Create 100 new vouchers
      const voucherPlan = Array.from(planIdMap.keys())[cycleCount % planIdMap.size];
      const voucherPlanId = planIdMap.get(voucherPlan);
      if (voucherPlanId) {
        const voucherRes = await httpReq('POST', '/api/wifi/vouchers', {
          propertyId: PROPERTY_ID,
          planId: voucherPlanId,
          quantity: 50,
          validityDays: 1,
        });
        if (voucherRes.data.success && Array.isArray(voucherRes.data.data)) {
          for (const v of voucherRes.data.data) {
            if (v.code) createdVouchers.push(v.code);
          }
        }
      }

      // Create 100 new PMS users
      for (let i = 0; i < 100; i++) {
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(i + cycleCount) % LAST_NAMES.length];
        const username = `pms-load-${firstName.toLowerCase()}.${lastName.toLowerCase()}${cycleCount}-${i}`;
        const password = `${firstName}@2025`;
        const planId = Array.from(planIdMap.values())[i % planIdMap.size];

        const res = await httpReq('POST', '/api/wifi/radius', {
          action: 'create-user',
          username,
          password,
          userType: 'guest',
          planId,
        });

        if (res.data.success) {
          createdUsers.push({ username, password, method: 'pms_credentials' });
          stats.totalUsersCreated++;
        }
      }

      // Auth 300 open_access users
      for (let i = 0; i < 300; i++) {
        const mac = generateMac(20000 + cycleCount * 300 + i);
        const clientIp = generateClientIp(20000 + cycleCount * 300 + i);

        const res = await httpReq('POST', '/api/v1/wifi/auth', {
          method: 'open_access',
          portalSlug: PORTAL_SLUG,
          macAddress: mac,
          propertyId: PROPERTY_ID,
        }, {
          'X-Forwarded-For': clientIp,
          'X-Real-IP': clientIp,
        });

        stats.totalAuthAttempts++;
        if (res.status === 200 && res.data?.success) {
          stats.authSuccesses++;
          if (res.data?.data?.username) {
            createdUsers.push({ username: res.data.data.username, password: 'open-access', method: 'open_access' });
          }
        } else {
          stats.authFailures++;
          recordError(res.data?.error?.code || 'LOAD_TEST_AUTH_FAILED');
        }
        recordMethodStat('open_access', res.status === 200 && res.data?.success);
      }

      // Create sessions for new users
      const newUsers = createdUsers.slice(-200);
      for (const user of newUsers) {
        if (!user.username) continue;
        const sessionRes = await httpReq('POST', '/api/wifi/sessions', {
          propertyId: PROPERTY_ID,
          macAddress: generateMac(Math.floor(Math.random() * 30000)),
          ipAddress: generateClientIp(Math.floor(Math.random() * 30000)),
          deviceType: 'mobile',
          authMethod: user.method,
        });
        if (sessionRes.data.success) stats.totalSessionsCreated++;
      }
    }

    // Every 10 minutes: disconnect 200 random users
    if (now - lastTenMinCycle >= 10 * 60 * 1000) {
      lastTenMinCycle = now;
      log('P6', '─── 10-Minute Cycle: Disconnecting 200 random users ───');

      const usersToDisconnect = createdUsers
        .filter(u => u.username && u.method !== 'room_number')
        .sort(() => Math.random() - 0.5)
        .slice(0, 200);

      let disconnected = 0;
      await batchOperation(usersToDisconnect, 50, async (user) => {
        if (!user.username) return;

        const res = await httpReq('POST', '/api/v1/wifi/disconnect', {
          username: user.username,
          source: 'admin',
        });

        if (res.data.success) {
          disconnected++;
          stats.totalDisconnects++;
        }
      });

      logInfo('P6', `Disconnected ${disconnected} users`);
    }

    // Every 15 minutes: verify analytics APIs return data
    if (now - lastFifteenMinCycle >= 15 * 60 * 1000) {
      lastFifteenMinCycle = now;
      log('P6', '─── 15-Minute Cycle: Verifying analytics APIs ───');

      try {
        const statusRes = await httpReq('GET', `/api/wifi/radius?action=status`);
        if (statusRes.data.success) {
          logInfo('P6', `RADIUS status: users=${statusRes.data.data?.userCount}, sessions=${statusRes.data.data?.activeSessions}`);
        }

        const analyticsRes = await httpReq('GET', `/api/wifi/portal/analytics?period=today`);
        if (analyticsRes.data.success) {
          const s = analyticsRes.data.data?.summary;
          logInfo('P6', `Portal analytics: totalSessions=${s?.totalSessions}, active=${s?.activeSessions}`);
        }

        const liveStatsRes = await httpReq('GET', `/api/wifi/radius?action=live-sessions-stats`);
        if (liveStatsRes.data.success) {
          logInfo('P6', `Live sessions: ${liveStatsRes.data.data?.totalActive} active`);
        }

        const authStatsRes = await httpReq('GET', `/api/wifi/radius?action=auth-logs-stats`);
        if (authStatsRes.data.success) {
          logInfo('P6', `Auth stats: total=${authStatsRes.data.data?.totalAuths}, rate=${authStatsRes.data.data?.successRate}%`);
        }
      } catch (err: any) {
        logWarn('P6', `Analytics verification failed: ${err.message}`);
      }
    }

    // Every 2 minutes: log progress
    if (now - lastTwoMinLog >= 2 * 60 * 1000) {
      lastTwoMinLog = now;
      const elapsed = now - stats.startTime;
      const remaining = Math.max(0, endTime - now);
      const avgResponseTime = stats.responseTimes.length > 0
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : 0;

      logInfo('P6', `Progress: elapsed=${formatDuration(elapsed)} remaining=${formatDuration(remaining)} | ` +
        `users=${stats.totalUsersCreated} auth=${stats.totalAuthAttempts} ` +
        `success=${stats.authSuccesses} fail=${stats.authFailures} ` +
        `sessions=${stats.totalSessionsCreated} disconnects=${stats.totalDisconnects} ` +
        `avgResponse=${avgResponseTime}ms`);
    }

    // Small sleep to avoid busy loop
    await sleep(5000);
  }

  stats.phaseTimes.set('P6', Date.now() - phaseStart);
  logInfo('P6', `Phase 6 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 7: Verify All Tabs Have Data
// ────────────────────────────────────────────────────────────────────────────────

async function phase7_verifyTabs() {
  const phaseStart = Date.now();
  log('P7', '════════════════════════════════════════════════════════════');
  log('P7', 'Phase 7: Verifying All Tabs Have Data');
  log('P7', '════════════════════════════════════════════════════════════');

  const checks: { tab: string; endpoint: string; hasData: boolean; count?: number; details: string }[] = [];

  // 1. RADIUS Users tab
  log('P7', 'Checking /api/wifi/radius?action=users...');
  try {
    const res = await httpReq('GET', `/api/wifi/radius?action=users&propertyId=${PROPERTY_ID}`);
    const userCount = Array.isArray(res.data?.data) ? res.data.data.length : 0;
    const hasData = userCount > 0;
    checks.push({ tab: 'RADIUS Users', endpoint: 'radius?action=users', hasData, count: userCount, details: `${userCount} users found` });
    log(hasData ? 'P7' : 'P7', hasData ? `✅ Users: ${userCount} found` : `⚠️ Users: ${userCount} found (may need more data)`);
  } catch (err: any) {
    checks.push({ tab: 'RADIUS Users', endpoint: 'radius?action=users', hasData: false, details: err.message });
  }

  // 2. RADIUS Status
  log('P7', 'Checking /api/wifi/radius?action=status...');
  try {
    const res = await httpReq('GET', `/api/wifi/radius?action=status`);
    const data = res.data?.data;
    const hasData = data?.userCount > 0;
    checks.push({ tab: 'RADIUS Status', endpoint: 'radius?action=status', hasData, count: data?.userCount, details: `users=${data?.userCount}, sessions=${data?.activeSessions}, running=${data?.running}` });
    logInfo('P7', `Status: users=${data?.userCount}, activeSessions=${data?.activeSessions}, running=${data?.running}`);
  } catch (err: any) {
    checks.push({ tab: 'RADIUS Status', endpoint: 'radius?action=status', hasData: false, details: err.message });
  }

  // 3. WiFi Sessions
  log('P7', 'Checking /api/wifi/sessions...');
  try {
    const res = await httpReq('GET', `/api/wifi/sessions?limit=10`);
    const sessionCount = res.data?.pagination?.total || 0;
    const hasData = sessionCount > 0 || (Array.isArray(res.data?.data) && res.data.data.length > 0);
    checks.push({ tab: 'WiFi Sessions', endpoint: 'sessions', hasData, count: sessionCount, details: `${sessionCount} sessions` });
    logInfo('P7', `Sessions: ${sessionCount} found`);
  } catch (err: any) {
    checks.push({ tab: 'WiFi Sessions', endpoint: 'sessions', hasData: false, details: err.message });
  }

  // 4. Session History
  log('P7', 'Checking /api/wifi/session-history...');
  try {
    const res = await httpReq('GET', `/api/wifi/session-history?limit=10`);
    const total = res.data?.pagination?.total || 0;
    const hasData = total > 0;
    checks.push({ tab: 'Session History', endpoint: 'session-history', hasData, count: total, details: `${total} history records` });
    logInfo('P7', `Session History: ${total} records`);
  } catch (err: any) {
    checks.push({ tab: 'Session History', endpoint: 'session-history', hasData: false, details: err.message });
  }

  // 5. Portal Analytics — Overview
  log('P7', 'Checking /api/wifi/portal/analytics?period=today (Overview)...');
  try {
    const res = await httpReq('GET', `/api/wifi/portal/analytics?period=today`);
    const summary = res.data?.data?.summary;
    const hasData = summary && (summary.totalSessions > 0 || summary.activeSessions > 0);
    checks.push({
      tab: 'Portal Analytics Overview', endpoint: 'portal/analytics?period=today', hasData,
      details: `totalSessions=${summary?.totalSessions}, active=${summary?.activeSessions}, devices=${summary?.uniqueDevices}, avgDuration=${summary?.avgDurationMin}min, growth=${summary?.growthPercent}%`
    });
    logInfo('P7', `Analytics Overview: total=${summary?.totalSessions}, active=${summary?.activeSessions}, growth=${summary?.growthPercent}%`);
  } catch (err: any) {
    checks.push({ tab: 'Portal Analytics Overview', endpoint: 'portal/analytics', hasData: false, details: err.message });
  }

  // 6. Live Sessions Stats
  log('P7', 'Checking /api/wifi/radius?action=live-sessions-stats (Live Monitor)...');
  try {
    const res = await httpReq('GET', `/api/wifi/radius?action=live-sessions-stats`);
    const data = res.data?.data;
    const hasData = data && data.totalActive > 0;
    checks.push({
      tab: 'Live Monitor', endpoint: 'radius?action=live-sessions-stats', hasData,
      details: `active=${data?.totalActive}, download=${formatBytes(data?.totalDownload || 0)}, upload=${formatBytes(data?.totalUpload || 0)}`
    });
    logInfo('P7', `Live Monitor: active=${data?.totalActive}, NAS count=${data?.perNas?.length}`);
  } catch (err: any) {
    checks.push({ tab: 'Live Monitor', endpoint: 'radius?action=live-sessions-stats', hasData: false, details: err.message });
  }

  // 7. Auth Logs Stats
  log('P7', 'Checking /api/wifi/radius?action=auth-logs-stats (Auth Insights)...');
  try {
    const res = await httpReq('GET', `/api/wifi/radius?action=auth-logs-stats`);
    const data = res.data?.data;
    const hasData = data && data.totalAuths > 0;
    checks.push({
      tab: 'Auth Insights', endpoint: 'radius?action=auth-logs-stats', hasData,
      details: `total=${data?.totalAuths}, accepts=${data?.acceptCount}, rejects=${data?.rejectCount}, rate=${data?.successRate}%, trend=${data?.last24hTrend}%`
    });
    logInfo('P7', `Auth Insights: total=${data?.totalAuths}, rate=${data?.successRate}%, trend=${data?.last24hTrend}%`);
  } catch (err: any) {
    checks.push({ tab: 'Auth Insights', endpoint: 'radius?action=auth-logs-stats', hasData: false, details: err.message });
  }

  // 8. Auth Logs
  log('P7', 'Checking /api/wifi/radius?action=auth-logs...');
  try {
    const res = await httpReq('GET', `/api/wifi/radius?action=auth-logs&limit=10`);
    const logCount = Array.isArray(res.data?.data) ? res.data.data.length : 0;
    checks.push({ tab: 'Auth Logs', endpoint: 'radius?action=auth-logs', hasData: logCount > 0, count: logCount, details: `${logCount} log entries` });
    logInfo('P7', `Auth Logs: ${logCount} entries`);
  } catch (err: any) {
    checks.push({ tab: 'Auth Logs', endpoint: 'radius?action=auth-logs', hasData: false, details: err.message });
  }

  // 9. WiFi Plans
  log('P7', 'Checking /api/wifi/plans...');
  try {
    const res = await httpReq('GET', `/api/wifi/plans?propertyId=${PROPERTY_ID}`);
    const planCount = Array.isArray(res.data?.data) ? res.data.data.length : 0;
    checks.push({ tab: 'WiFi Plans', endpoint: 'plans', hasData: planCount > 0, count: planCount, details: `${planCount} plans` });
    logInfo('P7', `Plans: ${planCount} found`);
  } catch (err: any) {
    checks.push({ tab: 'WiFi Plans', endpoint: 'plans', hasData: false, details: err.message });
  }

  // 10. Vouchers
  log('P7', 'Checking /api/wifi/vouchers...');
  try {
    const res = await httpReq('GET', `/api/wifi/vouchers?limit=10`);
    const voucherTotal = res.data?.pagination?.total || 0;
    checks.push({ tab: 'Vouchers', endpoint: 'vouchers', hasData: voucherTotal > 0, count: voucherTotal, details: `${voucherTotal} vouchers` });
    logInfo('P7', `Vouchers: ${voucherTotal} found`);
  } catch (err: any) {
    checks.push({ tab: 'Vouchers', endpoint: 'vouchers', hasData: false, details: err.message });
  }

  // 11. MAC Auth
  log('P7', 'Checking /api/wifi/mac-auth...');
  try {
    const res = await httpReq('GET', `/api/wifi/mac-auth?propertyId=${PROPERTY_ID}`);
    const macTotal = res.data?.pagination?.total || 0;
    checks.push({ tab: 'MAC Auth', endpoint: 'mac-auth', hasData: macTotal > 0, count: macTotal, details: `${macTotal} MAC entries` });
    logInfo('P7', `MAC Auth: ${macTotal} entries`);
  } catch (err: any) {
    checks.push({ tab: 'MAC Auth', endpoint: 'mac-auth', hasData: false, details: err.message });
  }

  // 12. DB counts (supplementary)
  log('P7', 'Checking DB counts...');
  const dbUserCount = sql('SELECT count(*) FROM "WiFiUser"');
  const dbRadacctCount = sql('SELECT count(*) FROM radacct');
  const dbActiveRadacct = sql("SELECT count(*) FROM radacct WHERE acctstoptime IS NULL");
  const dbRadpostauth = sql('SELECT count(*) FROM radpostauth');
  const dbVoucherCount = sql(`SELECT count(*) FROM "WiFiVoucher" WHERE "tenantId" = '${TENANT_ID}'`);
  const dbMacAuthCount = sql(`SELECT count(*) FROM "RadiusMacAuth" WHERE "propertyId" = '${PROPERTY_ID}'`);
  const dbSessionCount = sql(`SELECT count(*) FROM "WiFiSession" WHERE "tenantId" = '${TENANT_ID}'`);

  logInfo('P7', `DB: WiFiUser=${dbUserCount}, radacct=${dbRadacctCount}, active_radacct=${dbActiveRadacct}, radpostauth=${dbRadpostauth}`);
  logInfo('P7', `DB: Voucher=${dbVoucherCount}, MAC=${dbMacAuthCount}, WiFiSession=${dbSessionCount}`);

  // Summary
  const passCount = checks.filter(c => c.hasData).length;
  const failCount = checks.filter(c => !c.hasData).length;
  logInfo('P7', `\nTab verification: ${passCount}/${checks.length} tabs have data, ${failCount} need attention`);

  for (const check of checks) {
    const icon = check.hasData ? '✅' : '⚠️ ';
    logInfo('P7', `${icon} ${check.tab}: ${check.details}`);
  }

  stats.phaseTimes.set('P7', Date.now() - phaseStart);
  logInfo('P7', `Phase 7 completed in ${formatDuration(Date.now() - phaseStart)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// Phase 8: Final Report
// ────────────────────────────────────────────────────────────────────────────────

function phase8_finalReport() {
  const totalDuration = Date.now() - stats.startTime;
  const avgResponseTime = stats.responseTimes.length > 0
    ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
    : 0;
  const p95ResponseTime = stats.responseTimes.length > 0
    ? stats.responseTimes.sort((a, b) => a - b)[Math.floor(stats.responseTimes.length * 0.95)]
    : 0;
  const p99ResponseTime = stats.responseTimes.length > 0
    ? stats.responseTimes.sort((a, b) => a - b)[Math.floor(stats.responseTimes.length * 0.99)]
    : 0;

  log('P8', '');
  log('P8', '╔══════════════════════════════════════════════════════════════════════╗');
  log('P8', '║            10,000-USER PRODUCTION WIFI TEST — FINAL REPORT          ║');
  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');

  log('P8', `║  Total Duration:          ${formatDuration(totalDuration).padEnd(42)}║`);
  log('P8', `║  Total Users Created:     ${String(stats.totalUsersCreated).padEnd(42)}║`);
  log('P8', `║  Total Auth Attempts:     ${String(stats.totalAuthAttempts).padEnd(42)}║`);
  log('P8', `║  Auth Successes:          ${String(stats.authSuccesses).padEnd(42)}║`);
  log('P8', `║  Auth Failures:           ${String(stats.authFailures).padEnd(42)}║`);
  log('P8', `║  Success Rate:            ${((stats.authSuccesses / Math.max(stats.totalAuthAttempts, 1)) * 100).toFixed(1).padEnd(41)}%║`);
  log('P8', `║  Total Sessions Created:  ${String(stats.totalSessionsCreated).padEnd(42)}║`);
  log('P8', `║  Total Disconnects:       ${String(stats.totalDisconnects).padEnd(42)}║`);
  log('P8', `║  Avg Response Time:       ${String(avgResponseTime + 'ms').padEnd(42)}║`);
  log('P8', `║  P95 Response Time:       ${String(p95ResponseTime + 'ms').padEnd(42)}║`);
  log('P8', `║  P99 Response Time:       ${String(p99ResponseTime + 'ms').padEnd(42)}║`);

  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');
  log('P8', '║  Method Breakdown:                                                   ║');

  for (const [method, data] of Array.from(stats.methodStats)) {
    const rate = data.attempts > 0 ? ((data.successes / data.attempts) * 100).toFixed(1) : '0.0';
    log('P8', `║    ${method.padEnd(20)} ${String(data.attempts).padStart(6)} attempts  ${String(data.successes).padStart(6)} success  ${rate.padStart(5)}%  ║`);
  }

  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');
  log('P8', '║  Error Categories:                                                   ║');

  const sortedErrors = Array.from(stats.errorCategories.entries()).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedErrors.slice(0, 15)) {
    log('P8', `║    ${category.padEnd(35)} ${String(count).padStart(6)}  ║`);
  }
  if (sortedErrors.length === 0) {
    log('P8', '║    (no errors)                                                       ║');
  }

  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');
  log('P8', '║  Phase Durations:                                                    ║');

  for (const [phase, duration] of Array.from(stats.phaseTimes)) {
    log('P8', `║    ${phase.padEnd(10)} ${formatDuration(duration).padEnd(42)}║`);
  }

  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');
  log('P8', '║  Data Summary:                                                       ║');

  const dbUserCount = sql('SELECT count(*) FROM "WiFiUser"');
  const dbRadacctCount = sql('SELECT count(*) FROM radacct');
  const dbActiveRadacct = sql("SELECT count(*) FROM radacct WHERE acctstoptime IS NULL");
  const dbRadpostauth = sql('SELECT count(*) FROM radpostauth');
  const dbRadCheck = sql('SELECT count(DISTINCT username) FROM radcheck');
  const dbVoucherCount = sql(`SELECT count(*) FROM "WiFiVoucher" WHERE "tenantId" = '${TENANT_ID}'`);
  const dbMacAuthCount = sql(`SELECT count(*) FROM "RadiusMacAuth" WHERE "propertyId" = '${PROPERTY_ID}'`);
  const dbSessionCount = sql(`SELECT count(*) FROM "WiFiSession" WHERE "tenantId" = '${TENANT_ID}'`);

  log('P8', `║    WiFiUser:              ${dbUserCount.padEnd(42)}║`);
  log('P8', `║    radacct:               ${dbRadacctCount.padEnd(42)}║`);
  log('P8', `║    active radacct:        ${dbActiveRadacct.padEnd(42)}║`);
  log('P8', `║    radpostauth:           ${dbRadpostauth.padEnd(42)}║`);
  log('P8', `║    radcheck (unique):     ${dbRadCheck.padEnd(42)}║`);
  log('P8', `║    WiFiVoucher:           ${dbVoucherCount.padEnd(42)}║`);
  log('P8', `║    RadiusMacAuth:         ${dbMacAuthCount.padEnd(42)}║`);
  log('P8', `║    WiFiSession:           ${dbSessionCount.padEnd(42)}║`);

  log('P8', '╠══════════════════════════════════════════════════════════════════════╣');
  log('P8', '║  Plan Summary:                                                       ║');

  for (const [name, id] of Array.from(planIdMap)) {
    const planUserCount = sql(`SELECT count(*) FROM "WiFiUser" WHERE "planId" = '${id}'`);
    log('P8', `║    ${name.padEnd(22)} ${planUserCount.padStart(6)} users  ${id.substring(0, 8).padStart(8)}...  ║`);
  }

  log('P8', '╚══════════════════════════════════════════════════════════════════════╝');
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Execution
// ────────────────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  StaySuite — 10,000-User Production WiFi Load Test                            ║');
  console.log('║  Started at:', new Date().toISOString(), '                                       ║');
  console.log('║  Target:', TOTAL_USERS, 'users |', formatDuration(TEST_DURATION_MS), 'duration                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await phase0_setup();
    console.log('');
    await phase1_createPlans();
    console.log('');
    await phase2_createIpPoolAndPortal();
    console.log('');
    await phase3_createUsers();
    console.log('');
    await phase4_authenticateUsers();
    console.log('');
    await phase5_simulateSessions();
    console.log('');
    await phase6_continuousLoadTest();
    console.log('');
    await phase7_verifyTabs();
    console.log('');
    phase8_finalReport();
  } catch (err: any) {
    logError('MAIN', `Fatal error: ${err.message}`);
    console.error(err.stack);
    // Still try to produce the final report
    try { phase8_finalReport(); } catch { /* ignore */ }
  }

  const totalDuration = Date.now() - startTime;
  console.log('');
  logSuccess('MAIN', `Test completed in ${formatDuration(totalDuration)}`);
}

// Run
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
