import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import dns from 'dns';
import fs from 'fs';
import net from 'net';
import os from 'os';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

const RADIUS_SERVICE_URL =
  process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RadiusResponse {
  success: boolean;
  status?: number;
  [key: string]: unknown;
}

async function freeradiusRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<RadiusResponse> {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError: Record<string, unknown>;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  return response.json() as Promise<RadiusResponse>;
}

function safeExec(command: string, fallback: string): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || fallback;
  } catch {
    return fallback;
  }
}

function checkPort(
  host: string,
  port: number,
  timeoutMs: number = 2000,
): Promise<{ port: number; status: 'open' | 'closed' | 'timeout'; latency_ms: number }> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const timer = setTimeout(() => {
      socket.destroy();
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ port, status: 'timeout', latency_ms: Math.round(elapsed) });
    }, timeoutMs);

    const socket = net.createConnection({ host, port }, () => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      clearTimeout(timer);
      socket.destroy();
      resolve({ port, status: 'open', latency_ms: Math.round(elapsed) });
    });

    socket.on('error', () => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      clearTimeout(timer);
      socket.destroy();
      resolve({ port, status: 'closed', latency_ms: Math.round(elapsed) });
    });
  });
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleServiceHealth() {
  // FreeRADIUS process check
  const pidOutput = safeExec('pgrep -f "freeradius" | head -1', '');
  const isRunning = pidOutput !== '';
  const pid = pidOutput ? parseInt(pidOutput, 10) : null;

  // Version
  const version = safeExec('freeradius -v 2>&1 | head -1', 'unknown');

  // Uptime — try systemd first, fall back to ps etime
  let uptime: string;
  if (pid) {
    uptime = safeExec(
      `systemctl show freeradius --property=ActiveEnterTimestamp 2>/dev/null | cut -d= -f2`,
      '',
    );
    if (!uptime) {
      uptime = safeExec(`ps -p ${pid} -o etime=`, 'unknown');
    }
  } else {
    uptime = 'not running';
  }

  // Database counts
  const [userCount, nasCount, activeSessions] = await Promise.all([
    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM radcheck',
    ).then((r) => parseInt(r[0]?.count ?? '0', 10)),

    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM nas',
    ).then((r) => parseInt(r[0]?.count ?? '0', 10)),

    db.$queryRawUnsafe<{ count: string }[]>(
      "SELECT COUNT(*)::text AS count FROM radacct WHERE acctstoptime IS NULL",
    ).then((r) => parseInt(r[0]?.count ?? '0', 10)),
  ]);

  return {
    service: {
      name: 'FreeRADIUS',
      running: isRunning,
      pid,
      version,
      uptime,
    },
    statistics: {
      totalUsers: userCount,
      totalNas: nasCount,
      activeSessions,
    },
  };
}

async function handlePortCheck() {
  const defaultPorts = [1812, 1813, 1814];

  // Optionally gather NAS IPs
  let nasIps: string[] = [];
  try {
    const rows = await db.$queryRawUnsafe<{ nasipaddress: string }[]>(
      'SELECT DISTINCT nasipaddress FROM nas WHERE nasipaddress IS NOT NULL',
    );
    nasIps = rows.map((r) => r.nasipaddress);
  } catch {
    // Continue without NAS IPs
  }

  const results: Array<{
    host: string;
    port: number;
    status: 'open' | 'closed' | 'timeout';
    latency_ms: number;
  }> = [];

  // Check localhost first
  for (const port of defaultPorts) {
    results.push({ host: 'localhost', ...(await checkPort('127.0.0.1', port)) });
  }

  // Check NAS IPs on primary ports
  for (const ip of nasIps) {
    for (const port of [1812, 1813]) {
      results.push({ host: ip, ...(await checkPort(ip, port)) });
    }
  }

  return { ports: results };
}

async function handleDatabaseCheck() {
  const [radcheck, nas, radacct, radpostauth, dbSize] = await Promise.all([
    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM radcheck',
    ).then((r) => ({ table: 'radcheck', count: parseInt(r[0]?.count ?? '0', 10) })),

    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM nas',
    ).then((r) => ({ table: 'nas', count: parseInt(r[0]?.count ?? '0', 10) })),

    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM radacct',
    ).then((r) => ({ table: 'radacct', count: parseInt(r[0]?.count ?? '0', 10) })),

    db.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM radpostauth',
    ).then((r) => ({ table: 'radpostauth', count: parseInt(r[0]?.count ?? '0', 10) })),

    db.$queryRawUnsafe<{ pg_size_pretty: string }[]>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) AS pg_size_pretty',
    ).then((r) => r[0]?.pg_size_pretty ?? 'unknown'),
  ]);

  return {
    connected: true,
    databaseSize: dbSize,
    tables: [radcheck, nas, radacct, radpostauth],
  };
}

async function handleDnsResolve(hostname?: string) {
  if (hostname) {
    try {
      const addresses = await dns.promises.resolve4(hostname);
      return { hostname, addresses };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'DNS resolution failed';
      return { hostname, addresses: [], error: message };
    }
  }

  // No hostname — resolve all NAS IPs from the database
  try {
    const rows = await db.$queryRawUnsafe<{
      nasname: string;
      nasipaddress: string;
    }[]>(
      'SELECT nasname, nasipaddress FROM nas WHERE nasname IS NOT NULL LIMIT 50',
    );

    const results: Array<{
      nasname: string;
      nasipaddress: string;
      addresses: string[];
      error?: string;
    }> = [];

    await Promise.all(
      rows.map(async (row) => {
        try {
          const addresses = await dns.promises.resolve4(row.nasname);
          results.push({
            nasname: row.nasname,
            nasipaddress: row.nasipaddress,
            addresses,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'DNS resolution failed';
          results.push({
            nasname: row.nasname,
            nasipaddress: row.nasipaddress,
            addresses: [],
            error: message,
          });
        }
      }),
    );

    return { resolved: results };
  } catch {
    return { resolved: [], error: 'Failed to query NAS records' };
  }
}

async function handleSystemInfo() {
  const configDir = '/etc/freeradius/3.0/';
  let configDirExists = false;
  let configFiles: string[] = [];

  try {
    configDirExists = fs.existsSync(configDir);
    if (configDirExists) {
      configFiles = fs.readdirSync(configDir);
    }
  } catch {
    // Continue with defaults
  }

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      total: formatBytes(os.totalmem()),
      free: formatBytes(os.freemem()),
      used: formatBytes(os.totalmem() - os.freemem()),
      utilizationPercent: Math.round(
        ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
      ),
    },
    uptime: {
      systemUptimeSeconds: os.uptime(),
      formatted: formatUptime(os.uptime()),
    },
    nodejs: {
      version: process.version,
      pid: process.pid,
    },
    freeradius: {
      configDirectory: configDir,
      configDirectoryExists: configDirExists,
      configFileCount: configFiles.length,
    },
  };
}

async function handleNasPing() {
  try {
    const rows = await db.$queryRawUnsafe<{
      nasname: string | null;
      nasipaddress: string;
    }[]>(
      'SELECT nasname, nasipaddress FROM nas WHERE nasipaddress IS NOT NULL LIMIT 100',
    );

    const results: Array<{
      nasIp: string;
      nasName: string;
      status: 'open' | 'closed' | 'timeout';
      latency_ms: number;
    }> = await Promise.all(
      rows.map(async (row) => {
        const check = await checkPort(row.nasipaddress, 1812, 2000);
        return {
          nasIp: row.nasipaddress,
          nasName: row.nasname || row.nasipaddress,
          status: check.status,
          latency_ms: check.latency_ms,
        };
      }),
    );

    return { nas: results };
  } catch {
    return { nas: [], error: 'Failed to query NAS records' };
  }
}

async function handleConfigCheck() {
  const configFiles = [
    '/etc/freeradius/3.0/radiusd.conf',
    '/etc/freeradius/3.0/clients.conf',
    '/etc/freeradius/3.0/mods-available/sql',
    '/etc/freeradius/3.0/sites-available/default',
  ];

  const results: Array<{
    path: string;
    exists: boolean;
    readable: boolean;
    size?: number;
  }> = configFiles.map((filePath) => {
    try {
      const exists = fs.existsSync(filePath);
      let size: number | undefined;

      if (exists) {
        try {
          const stat = fs.statSync(filePath);
          size = stat.size;
        } catch {
          // size stays undefined
        }
      }

      let readable = false;
      if (exists) {
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          readable = true;
        } catch {
          readable = false;
        }
      }

      return { path: filePath, exists, readable, size };
    } catch {
      return { path: filePath, exists: false, readable: false };
    }
  });

  return { configs: results };
}

// ---------------------------------------------------------------------------
// Utility formatters
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

type DiagnosticsAction =
  | 'service-health'
  | 'port-check'
  | 'database-check'
  | 'dns-resolve'
  | 'system-info'
  | 'nas-ping'
  | 'config-check';

const VALID_ACTIONS = new Set<string>([
  'service-health',
  'port-check',
  'database-check',
  'dns-resolve',
  'system-info',
  'nas-ping',
  'config-check',
]);

export async function GET(request: NextRequest) {
  // --- Auth & authorisation ---------------------------------------------------
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  const hasWifiPermission = hasPermission(session, 'wifi.manage');
  const hasReportsPermission = hasPermission(session, 'reports.view');

  if (!hasWifiPermission && !hasReportsPermission) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 },
    );
  }

  // --- Parse action -----------------------------------------------------------
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') as DiagnosticsAction | null;

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid or missing action parameter. Valid actions: ${Array.from(VALID_ACTIONS).join(', ')}`,
      },
      { status: 400 },
    );
  }

  // --- Dispatch ---------------------------------------------------------------
  try {
    let data: unknown;
    const startTime = Date.now();

    switch (action) {
      case 'service-health':
        data = await handleServiceHealth();
        break;

      case 'port-check':
        data = await handlePortCheck();
        break;

      case 'database-check':
        data = await handleDatabaseCheck();
        break;

      case 'dns-resolve': {
        const hostname = searchParams.get('hostname') || undefined;
        data = await handleDnsResolve(hostname);
        break;
      }

      case 'system-info':
        data = await handleSystemInfo();
        break;

      case 'nas-ping':
        data = await handleNasPing();
        break;

      case 'config-check':
        data = await handleConfigCheck();
        break;

      default: {
        const _exhaustive: never = action;
        return NextResponse.json(
          { success: false, error: 'Unhandled action' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      action,
      duration_ms: Date.now() - startTime,
      data,
    });
  } catch (err: unknown) {
    console.error(`[diagnostics] Error on action=${action}:`, err);
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message, action },
      { status: 500 },
    );
  }
}
