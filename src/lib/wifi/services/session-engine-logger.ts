/**
 * StaySuite Session Engine Logger
 *
 * Provides file-based logging for the session engine with:
 *   - Writes to logs/session-engine.log (persistent)
 *   - Keeps last N log entries in memory (for status endpoint)
 *   - Tracks lastRun timestamp and run results (for health checks)
 *   - Daily log rotation (keeps last 7 days)
 *
 * Log format: [ISO8601] [LEVEL] [SessionEngine] message
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'session-engine.log');
const MAX_IN_MEMORY_ENTRIES = 100;
const MAX_LOG_FILE_LINES = 10000;      // Rotate after this many lines
const MAX_LOG_FILES = 7;                // Keep 7 rotated files

// ---------------------------------------------------------------------------
// In-memory state (survives as long as the Node process runs)
// ---------------------------------------------------------------------------

const inMemoryLog: Array<{ timestamp: string; level: string; message: string }> = [];
let lastRunResult: {
  timestamp: Date;
  sessionsProcessed: number;
  interimUpdated: number;
  sessionTimeoutDisconnected: number;
  idleTimeoutDisconnected: number;
  dataLimitDisconnected: number;
  staleCleaned: number;
  errors: number;
  durationMs: number;
  disconnectedSessions: Array<{ username: string; ip: string; reason: string }>;
} | null = null;

let totalRuns = 0;
let totalErrors = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

const LOG_TIMEZONE = process.env.SE_LOG_TIMEZONE || 'Asia/Kolkata';

function formatTimestamp(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: LOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\//g, '-');
}

function formatLine(level: string, message: string): string {
  const ts = formatTimestamp();
  return `[${ts}] [${level}] [SessionEngine] ${message}`;
}

function rotateIfNeeded(): void {
  ensureLogDir();

  if (!fs.existsSync(LOG_FILE)) return;

  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  if (lines.length <= MAX_LOG_FILE_LINES) return;

  // Shift old files: .6 → .7 (delete), .5 → .6, ..., .1 → .2, current → .1
  for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
    const older = i === MAX_LOG_FILES - 1 ? null : path.join(LOG_DIR, `session-engine.log.${i + 1}`);
    const current = path.join(LOG_DIR, `session-engine.log.${i}`);
    if (fs.existsSync(current)) {
      if (older) {
        fs.unlinkSync(older);
      }
      fs.renameSync(current, older || current);
    }
  }

  // Keep only the last 60% of lines in the current file
  const keepFrom = Math.floor(lines.length * 0.4);
  const kept = lines.slice(keepFrom).join('\n') + '\n';
  fs.writeFileSync(LOG_FILE, kept, 'utf-8');
}

function writeToFile(line: string): void {
  try {
    ensureLogDir();
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  } catch {
    // Non-fatal — don't crash if log write fails
  }
}

// ---------------------------------------------------------------------------
// Logger functions
// ---------------------------------------------------------------------------

function addEntry(level: string, message: string): void {
  const line = formatLine(level, message);

  // Console output
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }

  // File output
  writeToFile(line);

  // In-memory buffer (ring buffer)
  inMemoryLog.push({ timestamp: new Date().toISOString(), level, message });
  if (inMemoryLog.length > MAX_IN_MEMORY_ENTRIES) {
    inMemoryLog.shift();
  }
}

export function info(message: string): void {
  addEntry('INFO', message);
}

export function warn(message: string): void {
  addEntry('WARN', message);
}

export function error(message: string): void {
  totalErrors++;
  addEntry('ERROR', message);
}

// ---------------------------------------------------------------------------
// Run result tracking
// ---------------------------------------------------------------------------

export function recordRunResult(result: {
  sessionsProcessed: number;
  interimUpdated: number;
  sessionTimeoutDisconnected: number;
  idleTimeoutDisconnected: number;
  dataLimitDisconnected: number;
  staleCleaned: number;
  errors: number;
  durationMs: number;
  disconnectedSessions: Array<{ username: string; ip: string; reason: string }>;
}): void {
  totalRuns++;
  totalErrors += result.errors;

  lastRunResult = {
    timestamp: new Date(),
    ...result,
  };
}

// ---------------------------------------------------------------------------
// Status / diagnostics
// ---------------------------------------------------------------------------

export interface SessionEngineStatus {
  /** Whether the cron job is registered */
  cronRegistered: boolean;
  /** Last run timestamp */
  lastRunAt: string | null;
  /** How many seconds since last run */
  secondsSinceLastRun: number | null;
  /** Total runs since server started */
  totalRuns: number;
  /** Total errors since server started */
  totalErrors: number;
  /** Last run result details */
  lastResult: typeof lastRunResult;
  /** Recent in-memory log entries (last 30) */
  recentLogs: Array<{ timestamp: string; level: string; message: string }>;
  /** Log file path */
  logFilePath: string;
  /** Log file size in bytes */
  logFileSize: number;
  /** Number of log lines in file */
  logFileLines: number;
  /** Active sessions in radacct */
  activeSessions: number;
  /** nftables counter IPs */
  counterIPs: number;
}

/**
 * Read the last N lines from the log file.
 */
function readLastLogLines(n: number): string[] {
  try {
    ensureLogDir();
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/**
 * Get a full status report.
 */
export function getStatus(extra?: {
  activeSessions?: number;
  counterIPs?: number;
}): SessionEngineStatus {
  let logFileSize = 0;
  let logFileLines = 0;

  try {
    if (fs.existsSync(LOG_FILE)) {
      const stat = fs.statSync(LOG_FILE);
      logFileSize = stat.size;
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      logFileLines = content.split('\n').filter(Boolean).length;
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  const secondsSinceLastRun = lastRunResult
    ? Math.floor((now - lastRunResult.timestamp.getTime()) / 1000)
    : null;

  return {
    cronRegistered: true, // If we're calling this, the cron is registered
    lastRunAt: lastRunResult?.timestamp.toISOString() ?? null,
    secondsSinceLastRun,
    totalRuns,
    totalErrors,
    lastResult: lastRunResult,
    recentLogs: inMemoryLog.slice(-30),
    logFilePath: LOG_FILE,
    logFileSize,
    logFileLines,
    activeSessions: extra?.activeSessions ?? 0,
    counterIPs: extra?.counterIPs ?? 0,
  };
}

/**
 * Read the last N lines from the log file (for display purposes).
 */
export function getRecentFileLogs(n: number = 50): string[] {
  return readLastLogLines(n);
}

/**
 * Clear in-memory logs (useful for testing).
 */
export function clearMemoryLogs(): void {
  inMemoryLog.length = 0;
}
