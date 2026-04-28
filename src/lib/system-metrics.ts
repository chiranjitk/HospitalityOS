/**
 * Real-Time System Metrics Collector
 *
 * Collects CPU, RAM, disk, and network interface metrics from /proc filesystem
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
}

export interface MetricsHistoryPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  interfaces: Record<string, { rxSpeed: number; txSpeed: number }>;
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
  const mem = readMemory();
  const disk = await readDisk();
  const interfaces = readInterfaces();
  const loadAvg = os.loadavg() as [number, number, number];

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
    await ensureSystemRRDs(ifaceNames);

    await updateSystemRRDs(
      currentSnapshot.cpu.usage,
      currentSnapshot.memory.used,
      currentSnapshot.memory.percent,
      currentSnapshot.disk.used,
      currentSnapshot.disk.percent,
      currentSnapshot.interfaces
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

  // Seed initial values for CPU delta calculation
  readCpu();

  // Take an initial snapshot
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
