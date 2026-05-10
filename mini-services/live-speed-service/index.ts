/**
 * StaySuite Live Speed Polling Service
 *
 * Polls bandwidth data every 3 seconds from two sources:
 *   1. Local NAS: nftables counters (inet staysuite_count forward chain)
 *   2. MikroTik: REST API /rest/ip/hotspot/active
 *
 * Calculates real-time speed by storing previous poll values and computing
 * delta/time: speed_mbps = (current_bytes - prev_bytes) * 8 / elapsed_seconds / 1_000_000
 *
 * Endpoints:
 *   GET /speeds  — returns all live speeds keyed by IP
 *   GET /health  — health check
 *   GET /status  — service status (poll count, NAS status, etc.)
 *
 * Port: 3018
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { execSync } from 'child_process';
import https from 'https';
import pg from 'pg';
import { createLogger } from '../shared/logger';

// ============================================================================
// Constants & Setup
// ============================================================================

const PORT = parseInt(process.env.PORT || '3018', 10);
const POLL_INTERVAL_MS = 3000; // 3 seconds
const SPEED_EXPIRY_MS = 15_000; // Remove stale speeds after 15s
const log = createLogger('live-speed-service');
const startTime = Date.now();

// Database — same pattern as nftables-service
const DB_URL =
  process.env.LIVE_SPEED_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite';
const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Explicitly set user to prevent pg from using OS username
  user: 'staysuite',
});

pool.on('error', (err: Error) => {
  log.warn('PostgreSQL pool error', { error: err.message });
});

// HTTPS agent for MikroTik self-signed certs
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ============================================================================
// Types
// ============================================================================

interface SpeedData {
  speedDown: number;  // Mbps
  speedUp: number;    // Mbps
  nasIp: string;      // which NAS this session is on
  timestamp: number;  // Date.now() of last calculation
  isLocal: boolean;   // true = local NAS, false = external (MikroTik)
}

interface PollData {
  downloadBytes: number;
  uploadBytes: number;
  timestamp: number;
  nasIp: string;
}

interface NasConfig {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  ipAddress: string;
  type: string;
  secret: string;
}

interface MikroTikUser {
  address: string;
  'bytes-in': number;
  'bytes-out': number;
  uptime: string;
  username?: string;
  'mac-address'?: string;
}

// ============================================================================
// State — in-memory maps for speed data and previous poll values
// ============================================================================

/** Current live speeds keyed by IP */
const liveSpeeds = new Map<string, SpeedData>();

/** Previous poll byte counts keyed by IP (for delta calculation) */
const prevPollData = new Map<string, PollData>();

/** Poll statistics */
let pollCount = 0;
let localPollSuccessCount = 0;
let localPollFailCount = 0;
let mikrotikPollSuccessCount = 0;
let mikrotikPollFailCount = 0;
let lastPollAt = 0;
let nftablesAvailable = false;
let lastNasLoadAt = 0;

/** Cached external NAS list (MikroTik devices) */
let externalNasList: NasConfig[] = [];

// ============================================================================
// Database: Load NAS configuration
// ============================================================================

async function loadExternalNasList(): Promise<NasConfig[]> {
  try {
    const res = await pool.query<NasConfig>(`
      SELECT id, "tenantId", "propertyId", name, "ipAddress", type, secret
      FROM "RadiusNAS"
      WHERE status = 'active'
        AND type = 'mikrotik'
        AND "ipAddress" IS NOT NULL
        AND "ipAddress" != ''
        AND "ipAddress" != '0.0.0.0'
        AND "ipAddress" != '127.0.0.1'
      ORDER BY "ipAddress"
    `);
    lastNasLoadAt = Date.now();
    log.info(`Loaded ${res.rows.length} external MikroTik NAS devices from DB`);
    return res.rows;
  } catch (err) {
    log.error('Failed to load NAS list from DB', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ============================================================================
// nftables: Local NAS polling
// ============================================================================

function checkNftablesAvailable(): boolean {
  try {
    execSync('which nft 2>/dev/null', { encoding: 'utf-8', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read all per-IP byte counters from the nftables staysuite_count table.
 * Parses the raw `nft -a list chain inet staysuite_count forward` output
 * and extracts IP + download_bytes + upload_bytes from "stayuser <ip>" comments.
 *
 * Returns a Map<ip, { downloadBytes, uploadBytes }> for all tracked users.
 */
function readNftablesCounters(): Map<string, { downloadBytes: number; uploadBytes: number }> {
  const result = new Map<string, { downloadBytes: number; uploadBytes: number }>();

  try {
    const output = execSync(
      'nft -a list chain inet staysuite_count forward 2>/dev/null',
      { encoding: 'utf-8', timeout: 5000 }
    );

    // First pass: extract all unique IPs from "stayuser <ip>" comments
    const ipRegex = /stayuser\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
    const ips = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = ipRegex.exec(output)) !== null) {
      ips.add(match[1]);
    }

    if (ips.size === 0) return result;

    // For each IP, parse all matching counter rules and sum bytes
    for (const ip of ips) {
      const safeIp = ip.replace(/\./g, '_');

      // Download counters: "user_in_<safe_ip>" (ip daddr = user IP)
      let downloadBytes = 0;
      const inRegex = new RegExp(`user_in_${safeIp}[^\\n]*bytes\\s+(\\d+)`, 'g');
      let dlMatch: RegExpExecArray | null;
      while ((dlMatch = inRegex.exec(output)) !== null) {
        downloadBytes += parseInt(dlMatch[1], 10) || 0;
      }

      // Upload counters: "user_out_<safe_ip>" (ip saddr = user IP)
      let uploadBytes = 0;
      const outRegex = new RegExp(`user_out_${safeIp}[^\\n]*bytes\\s+(\\d+)`, 'g');
      let ulMatch: RegExpExecArray | null;
      while ((ulMatch = outRegex.exec(output)) !== null) {
        uploadBytes += parseInt(ulMatch[1], 10) || 0;
      }

      result.set(ip, { downloadBytes, uploadBytes });
    }
  } catch {
    // nft command failed (table doesn't exist, permissions, etc.)
  }

  return result;
}

/**
 * Process local nftables counters and update live speeds.
 */
function processLocalCounters(now: number): void {
  const counters = readNftablesCounters();

  for (const [ip, { downloadBytes, uploadBytes }] of counters) {
    const key = `local:${ip}`;
    const prev = prevPollData.get(key);

    if (prev) {
      const elapsed = (now - prev.timestamp) / 1000; // seconds

      if (elapsed > 0.1) {
        // Avoid division by zero / micro-polls
        const deltaDown = Math.max(0, downloadBytes - prev.downloadBytes);
        const deltaUp = Math.max(0, uploadBytes - prev.uploadBytes);

        // speed = delta_bytes * 8 (bits) / elapsed_seconds / 1_000_000 (Mbps)
        const speedDown = (deltaDown * 8) / elapsed / 1_000_000;
        const speedUp = (deltaUp * 8) / elapsed / 1_000_000;

        liveSpeeds.set(ip, {
          speedDown: Math.round(speedDown * 1000) / 1000, // 3 decimal places
          speedUp: Math.round(speedUp * 1000) / 1000,
          nasIp: '127.0.0.1',
          timestamp: now,
          isLocal: true,
        });
      }
    }

    // Store current values for next delta
    prevPollData.set(key, {
      downloadBytes,
      uploadBytes,
      timestamp: now,
      nasIp: '127.0.0.1',
    });
  }

  // Clean up prevPollData for local IPs that no longer have counters
  for (const [key] of prevPollData) {
    if (key.startsWith('local:')) {
      const ip = key.slice(6); // remove "local:" prefix
      if (!counters.has(ip)) {
        prevPollData.delete(key);
        liveSpeeds.delete(ip);
      }
    }
  }

  localPollSuccessCount++;
}

// ============================================================================
// MikroTik: External NAS polling via REST API
// ============================================================================

/**
 * Poll a single MikroTik router for active hotspot users.
 * Returns per-IP byte counts from /rest/ip/hotspot/active.
 */
async function pollMikrotik(nas: NasConfig): Promise<Map<string, { downloadBytes: number; uploadBytes: number }>> {
  const result = new Map<string, { downloadBytes: number; uploadBytes: number }>();

  try {
    const url = `https://${nas.ipAddress}/rest/ip/hotspot/active`;
    const credentials = Buffer.from(`admin:${nas.secret}`).toString('base64');

    const res = await fetch(url, {
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.warn(`MikroTik ${nas.ipAddress} returned ${res.status}`, {
        nasName: nas.name,
        status: res.status,
      });
      return result;
    }

    const users: MikroTikUser[] = (await res.json()) || [];

    for (const user of users) {
      if (!user.address) continue;

      // MikroTik: bytes-in = upload (from user), bytes-out = download (to user)
      result.set(user.address, {
        downloadBytes: user['bytes-out'] || 0,
        uploadBytes: user['bytes-in'] || 0,
      });
    }
  } catch (err) {
    log.warn(`MikroTik poll failed for ${nas.ipAddress}`, {
      nasName: nas.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/**
 * Process MikroTik counters from all external NAS devices.
 */
async function processMikrotikCounters(now: number): Promise<void> {
  if (externalNasList.length === 0) return;

  // Poll all MikroTik devices in parallel
  const results = await Promise.allSettled(
    externalNasList.map(async (nas) => {
      const counters = await pollMikrotik(nas);
      return { nas, counters };
    })
  );

  for (const settled of results) {
    if (settled.status !== 'fulfilled') {
      mikrotikPollFailCount++;
      continue;
    }

    const { nas, counters } = settled.value;

    if (counters.size === 0) {
      // No active users on this NAS — skip but count as success
      mikrotikPollSuccessCount++;
      continue;
    }

    for (const [ip, { downloadBytes, uploadBytes }] of counters) {
      const key = `mikrotik:${nas.ipAddress}:${ip}`;
      const prev = prevPollData.get(key);

      if (prev) {
        const elapsed = (now - prev.timestamp) / 1000;

        if (elapsed > 0.1) {
          const deltaDown = Math.max(0, downloadBytes - prev.downloadBytes);
          const deltaUp = Math.max(0, uploadBytes - prev.uploadBytes);

          const speedDown = (deltaDown * 8) / elapsed / 1_000_000;
          const speedUp = (deltaUp * 8) / elapsed / 1_000_000;

          // External NAS speeds: use the MikroTik IP as nasIp
          liveSpeeds.set(ip, {
            speedDown: Math.round(speedDown * 1000) / 1000,
            speedUp: Math.round(speedUp * 1000) / 1000,
            nasIp: nas.ipAddress,
            timestamp: now,
            isLocal: false,
          });
        }
      }

      prevPollData.set(key, {
        downloadBytes,
        uploadBytes,
        timestamp: now,
        nasIp: nas.ipAddress,
      });
    }

    // Clean up prevPollData for IPs that no longer appear on this NAS
    for (const [key, prev] of prevPollData) {
      if (key.startsWith(`mikrotik:${nas.ipAddress}:`)) {
        const ip = key.slice(`mikrotik:${nas.ipAddress}:`.length);
        if (!counters.has(ip)) {
          prevPollData.delete(key);
          // Only delete from liveSpeeds if this IP was last seen on this NAS
          const speed = liveSpeeds.get(ip);
          if (speed && speed.nasIp === nas.ipAddress && !speed.isLocal) {
            liveSpeeds.delete(ip);
          }
        }
      }
    }

    mikrotikPollSuccessCount++;
  }
}

// ============================================================================
// Stale entry cleanup
// ============================================================================

function cleanupStaleEntries(now: number): void {
  for (const [ip, speed] of liveSpeeds) {
    if (now - speed.timestamp > SPEED_EXPIRY_MS) {
      liveSpeeds.delete(ip);
    }
  }

  // Also clean prevPollData entries older than 2 minutes
  const prevExpiry = 120_000;
  for (const [key, data] of prevPollData) {
    if (now - data.timestamp > prevExpiry) {
      prevPollData.delete(key);
    }
  }
}

// ============================================================================
// Main poll loop
// ============================================================================

async function pollCycle(): Promise<void> {
  const now = Date.now();
  lastPollAt = now;
  pollCount++;

  try {
    // ── Local NAS: nftables counters ──
    if (nftablesAvailable) {
      try {
        processLocalCounters(now);
      } catch (err) {
        localPollFailCount++;
        log.error('Local nftables poll error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── External NAS: MikroTik REST API ──
    try {
      await processMikrotikCounters(now);
    } catch (err) {
      mikrotikPollFailCount++;
      log.error('MikroTik poll error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Cleanup stale entries ──
    cleanupStaleEntries(now);
  } catch (err) {
    log.error('Unexpected error in poll cycle', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================================
// HTTP Server
// ============================================================================

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    // ── GET /health ──
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJSON(res, {
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        service: 'live-speed-service',
        port: PORT,
      });
      return;
    }

    // ── GET /status ──
    if (req.method === 'GET' && url.pathname === '/status') {
      const now = Date.now();
      const nasStatuses = externalNasList.map((nas) => ({
        name: nas.name,
        ip: nas.ipAddress,
        type: nas.type,
      }));

      sendJSON(res, {
        status: 'running',
        uptime: Math.floor(process.uptime()),
        startTime: new Date(startTime).toISOString(),
        pollIntervalMs: POLL_INTERVAL_MS,
        totalPolls: pollCount,
        lastPollAt: lastPollAt ? new Date(lastPollAt).toISOString() : null,
        lastPollAgeMs: lastPollAt ? now - lastPollAt : null,
        trackedIPs: liveSpeeds.size,
        nftablesAvailable,
        localPolls: {
          success: localPollSuccessCount,
          fail: localPollFailCount,
        },
        mikrotikPolls: {
          success: mikrotikPollSuccessCount,
          fail: mikrotikPollFailCount,
        },
        externalNas: nasStatuses,
        nasLoadedAt: lastNasLoadAt ? new Date(lastNasLoadAt).toISOString() : null,
      });
      return;
    }

    // ── GET /speeds ──
    if (req.method === 'GET' && url.pathname === '/speeds') {
      const now = Date.now();
      const speedsObj: Record<string, SpeedData> = {};

      for (const [ip, speed] of liveSpeeds) {
        // Only return speeds that are less than SPEED_EXPIRY_MS old
        if (now - speed.timestamp <= SPEED_EXPIRY_MS) {
          speedsObj[ip] = speed;
        }
      }

      sendJSON(res, {
        speeds: speedsObj,
        count: Object.keys(speedsObj).length,
        polledAt: lastPollAt ? new Date(lastPollAt).toISOString() : null,
        pollAgeMs: lastPollAt ? now - lastPollAt : null,
      });
      return;
    }

    // ── 404 ──
    sendJSON(res, { error: 'Not found' }, 404);
  } catch (err) {
    log.error('HTTP handler error', {
      error: err instanceof Error ? err.message : String(err),
    });
    sendJSON(res, { error: 'Internal server error' }, 500);
  }
}

// ============================================================================
// Startup
// ============================================================================

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    log.error('Unhandled request error', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      sendJSON(res, { error: 'Internal server error' }, 500);
    }
  }
});

async function start(): Promise<void> {
  // Check nftables availability
  nftablesAvailable = checkNftablesAvailable();
  log.info(`nftables available: ${nftablesAvailable}`);

  // Load NAS config from DB (non-blocking — start server first)
  loadExternalNasList().then((nasList) => {
    externalNasList = nasList;
  }).catch(() => {
    // Will retry via the refresh interval
  });

  // Refresh NAS list every 5 minutes
  pollTimer = setInterval(async () => {
    try {
      externalNasList = await loadExternalNasList();
    } catch {
      // Keep using cached list
    }
  }, 300_000);

  // Start HTTP server FIRST (endpoints available immediately)
  server.listen(PORT, () => {
    log.info(`Live Speed Service running on port ${PORT}`, {
      pollIntervalMs: POLL_INTERVAL_MS,
      nftablesAvailable,
      externalNasCount: externalNasList.length,
    });
    console.log(`[live-speed-service] Running on port ${PORT}`);
    console.log(`[live-speed-service] Endpoints: GET /speeds | GET /health | GET /status`);
    console.log(`[live-speed-service] Polling every ${POLL_INTERVAL_MS}ms (nftables: ${nftablesAvailable}, MikroTik: ${externalNasList.length} devices)`);

    // Start the poll loop AFTER server is listening
    // First poll immediately (non-blocking — runs in background)
    pollCycle().catch((err) => {
      log.error('Initial poll error', { error: err instanceof Error ? err.message : String(err) });
    });

    // Then every 3 seconds
    setInterval(async () => {
      try {
        await pollCycle();
      } catch (err) {
        log.error('Poll interval error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, POLL_INTERVAL_MS);
  });
}

// Graceful shutdown
function shutdown(signal: string): void {
  log.info(`Received ${signal}, shutting down...`);
  clearInterval(pollTimer as unknown as ReturnType<typeof setInterval>);

  server.close(() => {
    pool.end().then(() => {
      log.info('Server and DB pool closed');
      process.exit(0);
    });
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    log.warn('Forced exit after shutdown timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Track the interval ID for cleanup
let pollTimer: ReturnType<typeof setInterval>;

start().catch((err) => {
  log.error('Failed to start service', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
