/**
 * RRD Collector — Cron-Compatible Entry Point
 *
 * Unlike the PM2 daemon (which stays resident and uses in-memory counters),
 * this script is designed to be called from system cron every minute.
 * It persists last-seen counters to a JSON state file so deltas can be
 * calculated across invocations.
 *
 * Usage:
 *   npx tsx src/lib/rrd/collector-cron.ts              # poll both users + interfaces
 *   npx tsx src/lib/rrd/collector-cron.ts --users      # users only
 *   npx tsx src/lib/rrd/collector-cron.ts --interfaces # interfaces only
 *
 * Crontab (every minute):
 *   * * * * * cd /home/z/my-project/StaySuite-HospitalityOS && npx tsx src/lib/rrd/collector-cron.ts >> logs/rrd-cron.log 2>&1
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// ─── Force-load project .env (overrides any inherited shell env) ─────
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

// ─── Config ─────────────────────────────────────────────────
const STATE_DIR = path.resolve(process.cwd(), 'data/rrd/state');
const STATE_FILE = path.join(STATE_DIR, 'counter-state.json');
const LOG_PREFIX = `[RRD-Cron ${new Date().toISOString()}]`;

// Parse CLI flags
const args = process.argv.slice(2);
const RUN_USERS = !args.includes('--interfaces');
const RUN_INTERFACES = !args.includes('--users');

// ─── Lazy imports (after env is loaded) ─────────────────────
let prisma: any;
let ensureRRD: any;
let updateRRD: any;
let userRRDPath: any;
let interfaceRRDPath: any;
let getRRDBasePath: any;

async function init() {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient({ log: ['error', 'warn'] });

  const rrd = await import('./index');
  ensureRRD = rrd.ensureRRD;
  updateRRD = rrd.updateRRD;
  userRRDPath = rrd.userRRDPath;
  interfaceRRDPath = rrd.interfaceRRDPath;
  getRRDBasePath = rrd.getRRDBasePath;
}

// ─── State file helpers ─────────────────────────────────────
interface CounterState {
  users: Record<string, { input: number; output: number; ts: number }>;
  interfaces: Record<string, { rx: number; tx: number; ts: number }>;
}

function loadState(): CounterState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error loading state file:`, err);
  }
  return { users: {}, interfaces: {} };
}

function saveState(state: CounterState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── User bandwidth poll ────────────────────────────────────
async function pollUsers(state: CounterState): Promise<number> {
  try {
    const rows: Array<{
      username: string;
      acctinputoctets: bigint | number;
      acctoutputoctets: bigint | number;
    }> = await prisma.$queryRawUnsafe(`
      SELECT username, acctinputoctets, acctoutputoctets
      FROM radacct
      WHERE acctstoptime IS NULL
    `);

    const now = Math.floor(Date.now() / 1000);
    let updated = 0;

    for (const row of rows) {
      // acctoutputoctets = NAS→user = download, acctinputoctets = user→NAS = upload
      const dlBytes = Number(row.acctoutputoctets) || 0;
      const ulBytes = Number(row.acctinputoctets) || 0;
      const prev = state.users[row.username];

      const rrdPath = userRRDPath(row.username);
      await ensureRRD(rrdPath);

      if (prev) {
        const deltaDl = dlBytes - prev.input;
        const deltaUl = ulBytes - prev.output;
        const deltaT = now - prev.ts;

        if (deltaT > 0 && deltaDl >= 0 && deltaUl >= 0) {
          await updateRRD(rrdPath, now, {
            ds_in: Math.max(0, deltaDl),
            ds_out: Math.max(0, deltaUl),
          });
          updated++;
        }
      }

      state.users[row.username] = { input: dlBytes, output: ulBytes, ts: now };
    }

    // Clean stale users (not seen for > 10 minutes)
    const activeUsers = new Set(rows.map(r => r.username));
    for (const username of Object.keys(state.users)) {
      if (!activeUsers.has(username) && (now - state.users[username].ts) > 600) {
        delete state.users[username];
      }
    }

    return updated;
  } catch (err) {
    console.error(`${LOG_PREFIX} User poll error:`, err);
    return 0;
  }
}

// ─── Interface bandwidth poll ───────────────────────────────
async function pollInterfaces(state: CounterState): Promise<number> {
  try {
    const procNetDev = '/proc/net/dev';
    if (!fs.existsSync(procNetDev)) return 0;

    const content = fs.readFileSync(procNetDev, 'utf-8');
    const lines = content.trim().split('\n');
    const now = Math.floor(Date.now() / 1000);
    let updated = 0;

    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (!match) continue;

      const iface = match[1];
      if (iface === 'lo') continue;

      const rxBytes = parseInt(match[2], 10);
      const txBytes = parseInt(match[3], 10);
      const prev = state.interfaces[iface];

      const rrdPath = interfaceRRDPath(iface);
      await ensureRRD(rrdPath);

      if (prev) {
        const deltaRx = rxBytes - prev.rx;
        const deltaTx = txBytes - prev.tx;
        const deltaT = now - prev.ts;

        if (deltaT > 0 && deltaRx >= 0 && deltaTx >= 0) {
          await updateRRD(rrdPath, now, {
            ds_in: Math.max(0, deltaRx),
            ds_out: Math.max(0, deltaTx),
          });
          updated++;
        }
      }

      state.interfaces[iface] = { rx: rxBytes, tx: txBytes, ts: now };
    }

    // Clean stale interfaces
    const activeIfaces = new Set(
      lines
        .map(l => l.match(/^\s*(\w+):/))
        .filter(Boolean)
        .map(m => m![1])
        .filter(i => i !== 'lo')
    );
    for (const iface of Object.keys(state.interfaces)) {
      if (!activeIfaces.has(iface)) {
        delete state.interfaces[iface];
      }
    }

    return updated;
  } catch (err) {
    console.error(`${LOG_PREFIX} Interface poll error:`, err);
    return 0;
  }
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Starting cron collection (users=${RUN_USERS}, interfaces=${RUN_INTERFACES})`);

  await init();

  // Ensure RRD directories exist
  const base = getRRDBasePath();
  fs.mkdirSync(`${base}/users`, { recursive: true });
  fs.mkdirSync(`${base}/interfaces`, { recursive: true });

  // Load previous counter state
  const state = loadState();

  let usersUpdated = 0;
  let ifacesUpdated = 0;

  if (RUN_USERS) {
    usersUpdated = await pollUsers(state);
    console.log(`${LOG_PREFIX} Users: ${usersUpdated} RRD updates`);
  }

  if (RUN_INTERFACES) {
    ifacesUpdated = await pollInterfaces(state);
    console.log(`${LOG_PREFIX} Interfaces: ${ifacesUpdated} RRD updates`);
  }

  // Save counter state for next run
  saveState(state);

  const elapsed = Date.now() - startTime;
  console.log(`${LOG_PREFIX} Done in ${elapsed}ms (users=${usersUpdated}, ifaces=${ifacesUpdated})`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`${LOG_PREFIX} Fatal error:`, err);
  process.exit(1);
});
