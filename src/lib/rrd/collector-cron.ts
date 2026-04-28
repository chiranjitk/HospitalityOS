/**
 * RRD Collector — Cron-Compatible Entry Point
 *
 * Unlike the PM2 daemon (which stays resident and uses in-memory counters),
 * this script is designed to be called from system cron every minute.
 * It persists last-seen counters to a JSON state file so deltas can be
 * calculated across invocations.
 *
 * Collects:
 *   1. User bandwidth RRDs (per-user download/upload from radacct)
 *   2. Interface bandwidth RRDs (per-interface rx/tx from /proc/net/dev)
 *   3. System health RRDs (CPU, memory, disk, load, swap, disk I/O,
 *      thermal, network errors, TCP connections, per-core CPU,
 *      active RADIUS sessions, auth accept/reject)
 *
 * Usage:
 *   npx tsx src/lib/rrd/collector-cron.ts              # poll all
 *   npx tsx src/lib/rrd/collector-cron.ts --users      # users only
 *   npx tsx src/lib/rrd/collector-cron.ts --interfaces # interfaces only
 *   npx tsx src/lib/rrd/collector-cron.ts --system     # system health only
 *
 * Crontab (every minute):
 *   * * * * * cd /home/z/my-project/StaySuite-HospitalityOS && npx tsx src/lib/rrd/collector-cron.ts >> logs/rrd-cron.log 2>&1
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);

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
const RUN_USERS = !args.includes('--interfaces') && !args.includes('--system');
const RUN_INTERFACES = !args.includes('--users') && !args.includes('--system');
const RUN_SYSTEM = !args.includes('--users') && !args.includes('--interfaces');

// ─── Lazy imports (after env is loaded) ─────────────────────
let prisma: any;
let ensureRRD: any;
let updateRRD: any;
let userRRDPath: any;
let interfaceRRDPath: any;
let getRRDBasePath: any;
let ensureSystemRRDs: any;
let updateSystemRRDs: any;

async function init() {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient({ log: ['error', 'warn'] });

  const rrd = await import('./index');
  ensureRRD = rrd.ensureRRD;
  updateRRD = rrd.updateRRD;
  userRRDPath = rrd.userRRDPath;
  interfaceRRDPath = rrd.interfaceRRDPath;
  getRRDBasePath = rrd.getRRDBasePath;

  const sysRrd = await import('./system-rrd');
  ensureSystemRRDs = sysRrd.ensureSystemRRDs;
  updateSystemRRDs = sysRrd.updateSystemRRDs;
}

// ─── State file helpers ─────────────────────────────────────
interface CounterState {
  users: Record<string, { input: number; output: number; ts: number }>;
  interfaces: Record<string, { rx: number; tx: number; ts: number }>;
  system: {
    cpuPrevIdle: number;
    cpuPrevTotal: number;
    cpuCorePrev: Record<number, { idle: number; total: number }>;
  };
}

function loadState(): CounterState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Ensure system state exists (migration for existing state files)
      if (!parsed.system) {
        parsed.system = { cpuPrevIdle: 0, cpuPrevTotal: 0, cpuCorePrev: {} };
      }
      return parsed as CounterState;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error loading state file:`, err);
  }
  return { users: {}, interfaces: {}, system: { cpuPrevIdle: 0, cpuPrevTotal: 0, cpuCorePrev: {} } };
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

// ═══════════════════════════════════════════════════════════════
// ─── System Health Metric Readers ───────────────────────────
// ═══════════════════════════════════════════════════════════════

// Read /proc/stat and return CPU usage % using delta from state
function readCpuUsage(sysState: CounterState['system']): number {
  try {
    const content = fs.readFileSync('/proc/stat', 'utf-8');
    const match = content.match(/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) return 0;

    const user = parseInt(match[1], 10);
    const system = parseInt(match[2], 10);
    const idle = parseInt(match[3], 10);
    const total = user + system + idle;

    if (sysState.cpuPrevTotal === 0) {
      // First read — seed values, return 0
      sysState.cpuPrevIdle = idle;
      sysState.cpuPrevTotal = total;
      return 0;
    }

    const deltaIdle = idle - sysState.cpuPrevIdle;
    const deltaTotal = total - sysState.cpuPrevTotal;
    sysState.cpuPrevIdle = idle;
    sysState.cpuPrevTotal = total;

    if (deltaTotal <= 0) return 0;
    return Math.max(0, Math.min(100, ((deltaTotal - deltaIdle) / deltaTotal) * 100));
  } catch {
    return 0;
  }
}

// Read per-core CPU usage % from /proc/stat
function readCpuPerCore(sysState: CounterState['system']): number[] {
  try {
    const content = fs.readFileSync('/proc/stat', 'utf-8');
    const lines = content.split('\n');
    const results: number[] = [];

    for (const line of lines) {
      const match = line.match(/^cpu(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (!match) continue;

      const coreIndex = parseInt(match[1], 10);
      const user = parseInt(match[2], 10);
      const system = parseInt(match[3], 10);
      const idle = parseInt(match[4], 10);
      const total = user + system + idle;

      const prev = sysState.cpuCorePrev[coreIndex];

      if (!prev) {
        sysState.cpuCorePrev[coreIndex] = { idle, total };
        results.push(0);
        continue;
      }

      const deltaIdle = idle - prev.idle;
      const deltaTotal = total - prev.total;
      sysState.cpuCorePrev[coreIndex] = { idle, total };

      if (deltaTotal <= 0) {
        results.push(0);
      } else {
        results.push(Math.max(0, Math.min(100, ((deltaTotal - deltaIdle) / deltaTotal) * 100)));
      }
    }

    return results;
  } catch {
    return [];
  }
}

// Read memory info from /proc/meminfo
function readMemory(): { total: number; used: number; percent: number } {
  try {
    const content = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key: string) => {
      const m = content.match(new RegExp(`${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    };

    const memTotal = get('MemTotal') * 1024;       // kB → bytes
    const memAvailable = get('MemAvailable') * 1024;
    const memUsed = memTotal - memAvailable;
    const percent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

    return { total: memTotal, used: memUsed, percent };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

// Read swap info from /proc/meminfo
function readSwap(): { total: number; used: number; percent: number } {
  try {
    const content = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key: string) => {
      const m = content.match(new RegExp(`${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    };

    const swapTotal = get('SwapTotal') * 1024;
    const swapFree = get('SwapFree') * 1024;
    const swapUsed = swapTotal - swapFree;
    const percent = swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;

    return { total: swapTotal, used: swapUsed, percent };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

// Read disk usage via df
async function readDisk(): Promise<{ total: number; used: number; percent: number }> {
  try {
    const { stdout } = await execFileAsync('df', ['-B1', '/'], { timeout: 5000 });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return { total: 0, used: 0, percent: 0 };

    const parts = lines[1].trim().split(/\s+/);
    const total = parseInt(parts[1], 10) || 0;
    const used = parseInt(parts[2], 10) || 0;
    const percent = total > 0 ? (used / total) * 100 : 0;

    return { total, used, percent };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

// Read disk I/O from /proc/diskstats (absolute counters for RRDtool DERIVE)
function readDiskIO(): { reads: number; writes: number; readBytes: number; writeBytes: number } {
  const defaultResult = { reads: 0, writes: 0, readBytes: 0, writeBytes: 0 };
  try {
    const content = fs.readFileSync('/proc/diskstats', 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) continue;

      const diskName = parts[2];
      if (diskName.startsWith('zram') || diskName.startsWith('pmem') || diskName.startsWith('loop') || diskName.startsWith('ram')) {
        continue;
      }
      const isRealDisk = /^sd[a-z]|^vd[a-z]|^nvme\d+n\d|^xvd[a-z]|^mmcblk\d|^hd[a-z]/.test(diskName);
      if (!isRealDisk) continue;

      return {
        reads: parseInt(parts[3], 10) || 0,
        writes: parseInt(parts[7], 10) || 0,
        readBytes: (parseInt(parts[5], 10) || 0) * 512,
        writeBytes: (parseInt(parts[9], 10) || 0) * 512,
      };
    }
  } catch {
    // ignore
  }
  return defaultResult;
}

// Read CPU temperature from /sys/class/thermal
function readThermal(): number | null {
  try {
    const content = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8').trim();
    const value = parseInt(content, 10);
    if (isNaN(value)) return null;
    return value > 1000 ? value / 1000 : value;  // millidegrees → degrees
  } catch {
    return null;
  }
}

// Read network errors and packet counts from /proc/net/dev (absolute counters)
function readNetErrors(): { rxErr: number; txErr: number; rxDrop: number; txDrop: number; rxPkt: number; txPkt: number } {
  const defaultResult = { rxErr: 0, txErr: 0, rxDrop: 0, txDrop: 0, rxPkt: 0, txPkt: 0 };
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.trim().split('\n');

    let totalRxErr = 0, totalTxErr = 0, totalRxDrop = 0, totalTxDrop = 0, totalRxPkt = 0, totalTxPkt = 0;

    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s+(.*)$/);
      if (!match) continue;
      const ifaceName = match[1];
      if (ifaceName === 'lo') continue;

      const fields = match[2].trim().split(/\s+/);
      if (fields.length < 16) continue;

      totalRxPkt += parseInt(fields[1], 10) || 0;   // rx_packets
      totalRxErr += parseInt(fields[2], 10) || 0;   // rx_errors
      totalRxDrop += parseInt(fields[3], 10) || 0;  // rx_drop
      totalTxPkt += parseInt(fields[9], 10) || 0;   // tx_packets
      totalTxErr += parseInt(fields[10], 10) || 0;  // tx_errors
      totalTxDrop += parseInt(fields[11], 10) || 0; // tx_drop
    }

    return { rxErr: totalRxErr, txErr: totalTxErr, rxDrop: totalRxDrop, txDrop: totalTxDrop, rxPkt: totalRxPkt, txPkt: totalTxPkt };
  } catch {
    return defaultResult;
  }
}

// Read TCP connection states from /proc/net/tcp and /proc/net/tcp6
function readTcpConnections(): { established: number; timeWait: number; closeWait: number; synRecv: number } {
  let established = 0, timeWait = 0, closeWait = 0, synRecv = 0;

  const countStates = (content: string) => {
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const stateHex = parts[3];
      switch (stateHex) {
        case '01': established++; break;
        case '02': synRecv++; break;
        case '06': timeWait++; break;
        case '08': closeWait++; break;
      }
    }
  };

  try {
    if (fs.existsSync('/proc/net/tcp')) {
      countStates(fs.readFileSync('/proc/net/tcp', 'utf-8'));
    }
    if (fs.existsSync('/proc/net/tcp6')) {
      countStates(fs.readFileSync('/proc/net/tcp6', 'utf-8'));
    }
  } catch {
    // ignore
  }

  return { established, timeWait, closeWait, synRecv };
}

// Read active RADIUS sessions from DB (same source as Active Users tab)
async function readActiveSessions(): Promise<number> {
  try {
    const result: Array<{ count: number | bigint }> = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM v_active_sessions WHERE session_status = 'active'
    `);
    return Number(result[0]?.count ?? 0);
  } catch {
    // Fallback to direct radacct query if view doesn't exist
    try {
      const fallback: Array<{ count: number | bigint }> = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM radacct WHERE acctstoptime IS NULL
      `);
      return Number(fallback[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }
}

// Read auth accept/reject stats from DB
async function readAuthStats(): Promise<{ accept: number; reject: number }> {
  try {
    const sixtySecondsAgo = new Date(Date.now() - 60_000);

    const result: Array<{
      accept_count: number | bigint;
      reject_count: number | bigint;
    }> = await prisma.$queryRawUnsafe(
      `SELECT
        SUM(CASE WHEN "authResult" LIKE '%Accept%' THEN 1 ELSE 0 END) as accept_count,
        SUM(CASE WHEN "authResult" LIKE '%Reject%' THEN 1 ELSE 0 END) as reject_count
      FROM "RadiusAuthLog"
      WHERE timestamp > $1::timestamptz`,
      sixtySecondsAgo.toISOString()
    );

    return {
      accept: Number(result[0]?.accept_count ?? 0),
      reject: Number(result[0]?.reject_count ?? 0),
    };
  } catch {
    return { accept: 0, reject: 0 };
  }
}

// ─── System Health Poll ─────────────────────────────────────
async function pollSystemHealth(state: CounterState): Promise<string> {
  try {
    const cpuPercent = readCpuUsage(state.system);
    const cpuPerCore = readCpuPerCore(state.system);
    const mem = readMemory();
    const swap = readSwap();
    const disk = await readDisk();
    const loadAvg = os.loadavg() as [number, number, number];
    const diskIO = readDiskIO();
    const thermal = readThermal();
    const netErrors = readNetErrors();
    const tcpConn = readTcpConnections();
    const activeSessions = await readActiveSessions();
    const authStats = await readAuthStats();

    // Read interfaces from /proc/net/dev for system RRDs
    const interfaces: Array<{ name: string; rxBytes: number; txBytes: number }> = [];
    try {
      const procNetDev = '/proc/net/dev';
      if (fs.existsSync(procNetDev)) {
        const content = fs.readFileSync(procNetDev, 'utf-8');
        const lines = content.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
          if (!match) continue;
          const name = match[1];
          if (name === 'lo') continue;
          interfaces.push({
            name,
            rxBytes: parseInt(match[2], 10),
            txBytes: parseInt(match[3], 10),
          });
        }
      }
    } catch {
      // ignore
    }

    const ifaceNames = interfaces.map(i => i.name);
    const coreCount = cpuPerCore.length > 0 ? cpuPerCore.length : os.cpus().length;

    // Ensure all RRD files exist (creates if missing)
    await ensureSystemRRDs(ifaceNames, coreCount);

    // Update all system RRDs
    await updateSystemRRDs(
      Math.round(cpuPercent * 10) / 10,
      cpuPerCore.map(v => Math.round(v * 10) / 10),
      mem.used,
      Math.round(mem.percent * 10) / 10,
      disk.used,
      Math.round(disk.percent * 10) / 10,
      interfaces,
      loadAvg,
      swap.used,
      Math.round(swap.percent * 10) / 10,
      diskIO,
      thermal,
      netErrors,
      tcpConn,
      activeSessions,
      authStats
    );

    return `cpu=${cpuPercent.toFixed(1)}%, mem=${mem.percent.toFixed(1)}%, disk=${disk.percent.toFixed(1)}%, cores=${coreCount}, ifaces=${ifaceNames.join(',')}`;
  } catch (err) {
    console.error(`${LOG_PREFIX} System health poll error:`, err);
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Starting cron collection (users=${RUN_USERS}, interfaces=${RUN_INTERFACES}, system=${RUN_SYSTEM})`);

  await init();

  // Ensure RRD directories exist
  const base = getRRDBasePath();
  fs.mkdirSync(`${base}/users`, { recursive: true });
  fs.mkdirSync(`${base}/interfaces`, { recursive: true });
  fs.mkdirSync(`${base}/system`, { recursive: true });

  // Load previous counter state
  const state = loadState();

  let usersUpdated = 0;
  let ifacesUpdated = 0;
  let systemStatus = 'skipped';

  if (RUN_USERS) {
    usersUpdated = await pollUsers(state);
    console.log(`${LOG_PREFIX} Users: ${usersUpdated} RRD updates`);
  }

  if (RUN_INTERFACES) {
    ifacesUpdated = await pollInterfaces(state);
    console.log(`${LOG_PREFIX} Interfaces: ${ifacesUpdated} RRD updates`);
  }

  if (RUN_SYSTEM) {
    systemStatus = await pollSystemHealth(state);
    console.log(`${LOG_PREFIX} System: ${systemStatus}`);
  }

  // Save counter state for next run
  saveState(state);

  const elapsed = Date.now() - startTime;
  console.log(`${LOG_PREFIX} Done in ${elapsed}ms (users=${usersUpdated}, ifaces=${ifacesUpdated}, system=${systemStatus})`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`${LOG_PREFIX} Fatal error:`, err);
  process.exit(1);
});
