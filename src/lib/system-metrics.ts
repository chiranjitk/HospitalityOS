/**
 * Real-Time System Metrics Collector
 *
 * Collects CPU, RAM, disk, network interface metrics, load average, swap,
 * disk I/O, thermal, network errors, TCP connections, per-core CPU, active
 * RADIUS sessions, and auth statistics from /proc filesystem and database
 * on Linux. Stores last 120 data points (4 minutes at 2-second intervals) in
 * a circular buffer for real-time graphing, and writes to RRD files every
 * 60 seconds for historical analysis.
 *
 * Uses a lazy singleton pattern: the collector starts on first access via
 * getSystemMetrics() or getMetricsHistory().
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import { ensureSystemRRDs, updateSystemRRDs } from './rrd/system-rrd';
import { db } from '@/lib/db';

const execFileAsync = promisify(execFile);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InterfaceMetric {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxSpeed: number;  // bytes/sec (computed from delta)
  txSpeed: number;  // bytes/sec (computed from delta)
}

export interface SystemSnapshot {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    loadAvg: [number, number, number];
  };
  memory: {
    total: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    percent: number;
  };
  interfaces: InterfaceMetric[];
  cpuPerCore: number[];
  load: { avg1: number; avg5: number; avg15: number };
  swap: { total: number; used: number; percent: number };
  diskIO: { reads: number; writes: number; readBytes: number; writeBytes: number };
  thermal: number | null;
  netErrors: { rxErr: number; txErr: number; rxDrop: number; txDrop: number; rxPkt: number; txPkt: number };
  tcpConn: { established: number; timeWait: number; closeWait: number; synRecv: number };
  activeSessions: number;
  authStats: { accept: number; reject: number };
}

export interface MetricsHistoryPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  interfaces: Record<string, { rxSpeed: number; txSpeed: number }>;
  load1: number;
  swap: number;
  established: number;
  activeSessions: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HISTORY_SIZE = 120;       // 120 points × 2s = 4 minutes
const COLLECT_INTERVAL = 2000;  // 2 seconds for real-time data
const RRD_INTERVAL = 60000;     // 60 seconds for RRD writes

// ─── Module State (lazy singleton) ───────────────────────────────────────────

let running = false;
let collectTimer: ReturnType<typeof setInterval> | null = null;
let rrdTimer: ReturnType<typeof setInterval> | null = null;

// Current snapshot (always up to date)
let currentSnapshot: SystemSnapshot | null = null;

// Circular buffer for history
let historyBuffer: MetricsHistoryPoint[] = [];
let historyIndex = 0;    // next write position
let historyCount = 0;    // how many points have been written (up to HISTORY_SIZE)

// Previous CPU tick totals for delta computation
let prevCpuIdle = 0;
let prevCpuTotal = 0;

// Previous interface byte counters for speed computation
let prevIfaceBytes: Map<string, { rx: number; tx: number }> = new Map();

// Previous per-core CPU tick totals for delta computation
let prevCpuCoreTotals: Map<number, { idle: number; total: number }> = new Map();

// Previous disk IO for delta computation (DERIVE type)
let prevDiskIO: { reads: number; writes: number; readBytes: number; writeBytes: number } | null = null;

// Previous auth stats for delta computation (DERIVE type)
let prevAuthAccept = 0;
let prevAuthReject = 0;

// CPU cores (cached, rarely changes)
let cpuCores = os.cpus().length;

// ─── CPU Reading ─────────────────────────────────────────────────────────────

function readCpu(): number {
  try {
    const content = fs.readFileSync('/proc/stat', 'utf-8');
    // First line: cpu  user nice system idle iowait irq softirq steal guest guest_nice
    const match = content.match(/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) return 0;

    const user = parseInt(match[1], 10);
    const nice = 0; // simplified
    const system = parseInt(match[2], 10);
    const idle = parseInt(match[3], 10);

    const total = user + nice + system + idle;

    if (prevCpuTotal === 0) {
      // First read — seed values, return 0
      prevCpuIdle = idle;
      prevCpuTotal = total;
      return 0;
    }

    const deltaIdle = idle - prevCpuIdle;
    const deltaTotal = total - prevCpuTotal;

    prevCpuIdle = idle;
    prevCpuTotal = total;

    if (deltaTotal <= 0) return 0;
    return Math.max(0, Math.min(100, ((deltaTotal - deltaIdle) / deltaTotal) * 100));
  } catch {
    return 0;
  }
}

// ─── CPU Per-Core Reading ────────────────────────────────────────────────────

function readCpuPerCore(): number[] {
  try {
    const content = fs.readFileSync('/proc/stat', 'utf-8');
    const lines = content.split('\n');
    const results: number[] = [];

    for (const line of lines) {
      // Match lines like "cpu0  1234 56 789 0 1 2 3 4 5 6"
      const match = line.match(/^cpu(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (!match) continue;

      const coreIndex = parseInt(match[1], 10);
      const user = parseInt(match[2], 10);
      const system = parseInt(match[3], 10);
      const idle = parseInt(match[4], 10);
      const total = user + system + idle;

      const prev = prevCpuCoreTotals.get(coreIndex);

      if (!prev) {
        // First read for this core — seed values
        prevCpuCoreTotals.set(coreIndex, { idle, total });
        results.push(0);
        continue;
      }

      const deltaIdle = idle - prev.idle;
      const deltaTotal = total - prev.total;

      prevCpuCoreTotals.set(coreIndex, { idle, total });

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

// ─── Memory Reading ──────────────────────────────────────────────────────────

function readMemory(): { total: number; used: number; percent: number } {
  try {
    const content = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key: string) => {
      const m = content.match(new RegExp(`${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    };

    // MemTotal is in kB
    const memTotal = get('MemTotal') * 1024;
    const memAvailable = get('MemAvailable') * 1024;
    const memBuffers = get('Buffers') * 1024;
    const memCached = get('Cached') * 1024;

    const memUsed = memTotal - memAvailable;
    const percent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

    return { total: memTotal, used: memUsed, percent };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

// ─── Swap Reading ────────────────────────────────────────────────────────────

function readSwap(): { total: number; used: number; percent: number } {
  try {
    const content = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key: string) => {
      const m = content.match(new RegExp(`${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    };

    const swapTotal = get('SwapTotal') * 1024;  // kB → bytes
    const swapFree = get('SwapFree') * 1024;

    const swapUsed = swapTotal - swapFree;
    const percent = swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;

    return { total: swapTotal, used: swapUsed, percent };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

// ─── Disk Reading ────────────────────────────────────────────────────────────

async function readDisk(): Promise<{ total: number; used: number; percent: number }> {
  try {
    const { stdout } = await execFileAsync('df', ['-B1', '/'], {
      timeout: 5000,
    });
    // Output:
    // Filesystem     1B-blocks    Used Available Use% Mounted on
    // /dev/sda1      524288000 314572800 209715200  61% /
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

// ─── Disk I/O Reading ───────────────────────────────────────────────────────

function readDiskIO(): { reads: number; writes: number; readBytes: number; writeBytes: number } {
  const defaultResult = { reads: 0, writes: 0, readBytes: 0, writeBytes: 0 };
  try {
    const content = fs.readFileSync('/proc/diskstats', 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      // Format: major minor name reads reads_merged sectors_read ms_reading writes writes_merged sectors_written ms_writing ios_in_progress ms_io weighted_ms
      // Fields (0-indexed): 0=major, 1=minor, 2=name, 3=reads, 4=reads_merged, 5=sectors_read, 6=ms_reading, 7=writes, 8=writes_merged, 9=sectors_written
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) continue;

      const diskName = parts[2];
      // Filter out virtual devices
      if (diskName.startsWith('zram') || diskName.startsWith('pmem') || diskName.startsWith('loop') || diskName.startsWith('ram')) {
        continue;
      }
      // Accept first real disk (sda, vda, nvme0n1, etc.)
      const isRealDisk = /^sd[a-z]|^vd[a-z]|^nvme\d+n\d|^xvd[a-z]|^mmcblk\d|^hd[a-z]/.test(diskName);
      if (!isRealDisk) continue;

      const reads = parseInt(parts[3], 10) || 0;
      const writes = parseInt(parts[7], 10) || 0;
      const sectorsRead = parseInt(parts[5], 10) || 0;
      const sectorsWritten = parseInt(parts[9], 10) || 0;

      return {
        reads,
        writes,
        readBytes: sectorsRead * 512,
        writeBytes: sectorsWritten * 512,
      };
    }
  } catch {
    // ignore
  }
  return defaultResult;
}

// ─── Thermal Reading ─────────────────────────────────────────────────────────

function readThermal(): number | null {
  try {
    const content = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8').trim();
    const value = parseInt(content, 10);
    if (isNaN(value)) return null;
    // Most systems report in millidegrees Celsius
    if (value > 1000) return value / 1000;
    return value;
  } catch {
    return null;
  }
}

// ─── Network Errors Reading ──────────────────────────────────────────────────

function readNetErrors(): { rxErr: number; txErr: number; rxDrop: number; txDrop: number; rxPkt: number; txPkt: number } {
  const defaultResult = { rxErr: 0, txErr: 0, rxDrop: 0, txDrop: 0, rxPkt: 0, txPkt: 0 };
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.trim().split('\n');

    let totalRxErr = 0, totalTxErr = 0, totalRxDrop = 0, totalTxDrop = 0, totalRxPkt = 0, totalTxPkt = 0;

    for (const line of lines) {
      // Format: "  eth0: rx_bytes rx_packets rx_errs rx_drop rx_fifo rx_frame rx_compressed rx_multicast tx_bytes tx_packets tx_errs tx_drop tx_fifo tx_colls tx_carrier tx_compressed"
      //          Index:        1          2          3       4       5       6         7              8          9          10      11      12      13       14          15
      const match = line.match(/^\s*(\w+):\s+(.*)$/);
      if (!match) continue;
      const ifaceName = match[1];
      if (ifaceName === 'lo') continue;

      const fields = match[2].trim().split(/\s+/);
      if (fields.length < 16) continue;

      totalRxErr += parseInt(fields[2], 10) || 0;   // rx_errors
      totalRxDrop += parseInt(fields[3], 10) || 0;  // rx_drop
      totalTxPkt += parseInt(fields[9], 10) || 0;   // tx_packets
      totalTxErr += parseInt(fields[10], 10) || 0;  // tx_errors
      totalTxDrop += parseInt(fields[11], 10) || 0; // tx_drop
      totalRxPkt += parseInt(fields[1], 10) || 0;   // rx_packets
    }

    return {
      rxErr: totalRxErr,
      txErr: totalTxErr,
      rxDrop: totalRxDrop,
      txDrop: totalTxDrop,
      rxPkt: totalRxPkt,
      txPkt: totalTxPkt,
    };
  } catch {
    return defaultResult;
  }
}

// ─── TCP Connections Reading ─────────────────────────────────────────────────

function readTcpConnections(): { established: number; timeWait: number; closeWait: number; synRecv: number } {
  const defaultResult = { established: 0, timeWait: 0, closeWait: 0, synRecv: 0 };
  let established = 0, timeWait = 0, closeWait = 0, synRecv = 0;

  const countStates = (content: string) => {
    const lines = content.trim().split('\n');
    for (const line of lines) {
      // Skip header line: "sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode"
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const stateHex = parts[3];
      // IPv6 lines have an extra "0" field - state is at index 3
      // TCP state codes: 01=ESTABLISHED, 02=SYN_RECV, 06=TIME_WAIT, 08=CLOSE_WAIT
      switch (stateHex) {
        case '01': established++; break;
        case '02': synRecv++; break;
        case '06': timeWait++; break;
        case '08': closeWait++; break;
      }
    }
  };

  try {
    // Read both IPv4 and IPv6 TCP tables
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

// ─── Active Sessions Reading (DB) ────────────────────────────────────────────

async function readActiveSessions(): Promise<number> {
  try {
    // Use v_active_sessions view — same source as WiFi Access > Active Users tab
    const result: Array<{ count: number | bigint }> = await db.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM v_active_sessions WHERE session_status = 'active'
    `);
    return Number(result[0]?.count ?? 0);
  } catch (err) {
    console.error('[SystemMetrics] readActiveSessions error:', err);
    // Fallback to direct radacct query if view doesn't exist
    try {
      const fallback: Array<{ count: number | bigint }> = await db.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM radacct WHERE acctstoptime IS NULL
      `);
      return Number(fallback[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }
}

// ─── Auth Stats Reading (DB) ─────────────────────────────────────────────────

async function readAuthStats(): Promise<{ accept: number; reject: number }> {
  try {
    // Use RadiusAuthLog to count recent auth events in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000);

    const result: Array<{
      accept_count: number | bigint;
      reject_count: number | bigint;
    }> = await db.$queryRawUnsafe(
      `SELECT
        SUM(CASE WHEN "authResult" LIKE '%Accept%' THEN 1 ELSE 0 END) as accept_count,
        SUM(CASE WHEN "authResult" LIKE '%Reject%' THEN 1 ELSE 0 END) as reject_count
      FROM "RadiusAuthLog"
      WHERE timestamp > $1::timestamptz`,
      sixtySecondsAgo.toISOString()
    );

    const accept = Number(result[0]?.accept_count ?? 0);
    const reject = Number(result[0]?.reject_count ?? 0);

    return { accept, reject };
  } catch {
    return { accept: 0, reject: 0 };
  }
}

// ─── Interface Reading ───────────────────────────────────────────────────────

function readInterfaces(): InterfaceMetric[] {
  const result: InterfaceMetric[] = [];

  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      // Format: "  eth0:  12345678  0  0  0  0  0  0  87654321  0  0  0  0  0  0"
      const match = line.match(/^\s*(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (!match) continue;

      const name = match[1];
      if (name === 'lo') continue; // Skip loopback

      const rxBytes = parseInt(match[2], 10);
      const txBytes = parseInt(match[3], 10);
      const prev = prevIfaceBytes.get(name);

      let rxSpeed = 0;
      let txSpeed = 0;

      if (prev) {
        const deltaRx = rxBytes - prev.rx;
        const deltaTx = txBytes - prev.tx;
        // Speed in bytes/sec (interval is 2 seconds)
        if (deltaRx >= 0) rxSpeed = Math.round(deltaRx / (COLLECT_INTERVAL / 1000));
        if (deltaTx >= 0) txSpeed = Math.round(deltaTx / (COLLECT_INTERVAL / 1000));
      }

      prevIfaceBytes.set(name, { rx: rxBytes, tx: txBytes });

      result.push({ name, rxBytes, txBytes, rxSpeed, txSpeed });
    }

    // Clean up stale interface entries
    const activeNames = new Set(result.map(i => i.name));
    for (const [key] of prevIfaceBytes) {
      if (!activeNames.has(key)) prevIfaceBytes.delete(key);
    }
  } catch {
    // ignore
  }

  return result;
}

// ─── Collect One Snapshot ────────────────────────────────────────────────────

async function collectSnapshot(): Promise<SystemSnapshot> {
  const cpuUsage = readCpu();
  const cpuPerCore = readCpuPerCore();
  const mem = readMemory();
  const swap = readSwap();
  const disk = await readDisk();
  const interfaces = readInterfaces();
  const loadAvg = os.loadavg() as [number, number, number];
  const diskIO = readDiskIO();
  const thermal = readThermal();
  const netErrors = readNetErrors();
  const tcpConn = readTcpConnections();
  const activeSessions = await readActiveSessions();
  const authStats = await readAuthStats();

  return {
    timestamp: Date.now(),
    cpu: {
      usage: Math.round(cpuUsage * 10) / 10,
      cores: cpuCores,
      loadAvg,
    },
    memory: {
      total: mem.total,
      used: mem.used,
      percent: Math.round(mem.percent * 10) / 10,
    },
    disk: {
      total: disk.total,
      used: disk.used,
      percent: Math.round(disk.percent * 10) / 10,
    },
    interfaces,
    cpuPerCore: cpuPerCore.map(v => Math.round(v * 10) / 10),
    load: { avg1: loadAvg[0], avg5: loadAvg[1], avg15: loadAvg[2] },
    swap: { total: swap.total, used: swap.used, percent: Math.round(swap.percent * 10) / 10 },
    diskIO,
    thermal,
    netErrors,
    tcpConn,
    activeSessions,
    authStats,
  };
}

// ─── History Management (Circular Buffer) ────────────────────────────────────

function pushHistory(snapshot: SystemSnapshot): void {
  const point: MetricsHistoryPoint = {
    timestamp: snapshot.timestamp,
    cpu: snapshot.cpu.usage,
    memory: snapshot.memory.percent,
    disk: snapshot.disk.percent,
    interfaces: {},
    load1: snapshot.load.avg1,
    swap: snapshot.swap.percent,
    established: snapshot.tcpConn.established,
    activeSessions: snapshot.activeSessions,
  };

  for (const iface of snapshot.interfaces) {
    point.interfaces[iface.name] = {
      rxSpeed: iface.rxSpeed,
      txSpeed: iface.txSpeed,
    };
  }

  if (historyCount < HISTORY_SIZE) {
    historyBuffer.push(point);
    historyCount++;
  } else {
    historyBuffer[historyIndex] = point;
  }
  historyIndex = (historyIndex + 1) % HISTORY_SIZE;
}

function getOrderedHistory(): MetricsHistoryPoint[] {
  if (historyCount < HISTORY_SIZE) {
    return [...historyBuffer];
  }
  // Return oldest-first order from circular buffer
  return [...historyBuffer.slice(historyIndex), ...historyBuffer.slice(0, historyIndex)];
}

// ─── RRD Periodic Write ──────────────────────────────────────────────────────

async function writeRRD(): Promise<void> {
  if (!currentSnapshot) return;

  try {
    // Ensure RRD files exist (also creates new interface RRDs if detected)
    const ifaceNames = currentSnapshot.interfaces.map(i => i.name);
    await ensureSystemRRDs(ifaceNames, currentSnapshot.cpu.cores);

    await updateSystemRRDs(
      currentSnapshot.cpu.usage,
      currentSnapshot.cpuPerCore,
      currentSnapshot.memory.used,
      currentSnapshot.memory.percent,
      currentSnapshot.disk.used,
      currentSnapshot.disk.percent,
      currentSnapshot.interfaces,
      currentSnapshot.cpu.loadAvg,
      currentSnapshot.swap.used,
      currentSnapshot.swap.percent,
      currentSnapshot.diskIO,
      currentSnapshot.thermal,
      currentSnapshot.netErrors,
      currentSnapshot.tcpConn,
      currentSnapshot.activeSessions,
      currentSnapshot.authStats
    );
  } catch (err) {
    console.error('[SystemMetrics] RRD write error:', err);
  }
}

// ─── Collector Loop ──────────────────────────────────────────────────────────

async function collectTick(): Promise<void> {
  try {
    currentSnapshot = await collectSnapshot();
    pushHistory(currentSnapshot);
  } catch (err) {
    console.error('[SystemMetrics] Collection error:', err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current system metrics snapshot.
 * Starts the collector on first call (lazy singleton).
 */
export async function getSystemMetrics(): Promise<SystemSnapshot> {
  if (!running) {
    await startMetricsCollector();
  }
  // If this is the very first call, take an immediate snapshot
  if (!currentSnapshot) {
    currentSnapshot = await collectSnapshot();
    pushHistory(currentSnapshot);
  }
  return currentSnapshot;
}

/**
 * Get the last 120 data points for real-time graphing.
 * Starts the collector on first call (lazy singleton).
 */
export async function getMetricsHistory(): Promise<{
  snapshot: SystemSnapshot;
  history: MetricsHistoryPoint[];
}> {
  if (!running) {
    await startMetricsCollector();
  }
  if (!currentSnapshot) {
    currentSnapshot = await collectSnapshot();
    pushHistory(currentSnapshot);
  }
  return {
    snapshot: currentSnapshot,
    history: getOrderedHistory(),
  };
}

/**
 * Start the metrics collector. Safe to call multiple times.
 */
export async function startMetricsCollector(): Promise<void> {
  if (running) return;
  running = true;

  console.log('[SystemMetrics] Starting metrics collector...');

  // Seed initial values for CPU delta calculation (two reads with a small delay)
  readCpu();
  readCpuPerCore();

  // Wait 200ms for CPU counters to accumulate a meaningful delta
  await new Promise(resolve => setTimeout(resolve, 200));

  // Take an initial snapshot (now with real CPU delta)
  try {
    currentSnapshot = await collectSnapshot();
    pushHistory(currentSnapshot);
  } catch (err) {
    console.error('[SystemMetrics] Initial collection error:', err);
  }

  // Schedule real-time collection every 2 seconds
  collectTimer = setInterval(() => {
    collectTick().catch(() => { /* errors logged inside collectTick */ });
  }, COLLECT_INTERVAL);
  collectTimer.unref();

  // Schedule RRD writes every 60 seconds
  rrdTimer = setInterval(() => {
    writeRRD().catch(() => { /* errors logged inside writeRRD */ });
  }, RRD_INTERVAL);
  rrdTimer.unref();

  console.log('[SystemMetrics] Collector started (interval: 2s, RRD: 60s)');
}

/**
 * Stop the metrics collector gracefully.
 */
export function stopMetricsCollector(): void {
  if (!running) return;
  running = false;

  if (collectTimer) {
    clearInterval(collectTimer);
    collectTimer = null;
  }
  if (rrdTimer) {
    clearInterval(rrdTimer);
    rrdTimer = null;
  }

  console.log('[SystemMetrics] Collector stopped');
}
