/**
 * StaySuite NAS Health Check Service
 *
 * Probes all registered NAS devices (from RadiusNAS table) and writes
 * health status to NasHealthLog. Runs every 60 seconds via scheduler.
 *
 * Probes:
 *   1. ICMP ping → latency + isOnline (requires cap_net_raw on production)
 *   2. TCP port check → RADIUS auth port (1812) + acct port (1813)
 *   3. Live session count from LiveSession table
 *   4. Auth stats from RadiusAuthLog
 *
 * Graceful degradation:
 *   - If ICMP not available (sandbox/no-cap) → TCP-only check
 *   - If NAS IP is localhost → skip ICMP, just check ports
 *   - If NAS is marked inactive → skip probe
 */

import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import * as SELog from './session-engine-logger';

const execAsync = promisify(exec);

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface NasConfig {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  shortname: string;
  ipAddress: string;
  type: string;
  authPort: number;
  acctPort: number;
  coaEnabled: boolean;
  coaPort: number;
  status: string;
}

interface ProbeResult {
  nasId: string;
  nasIp: string;
  nasName: string;
  tenantId: string;
  propertyId: string;

  /** True if any probe succeeded */
  isOnline: boolean;

  /** ICMP round-trip time in ms (null if ICMP unavailable) */
  icmpLatencyMs: number | null;

  /** Time to connect to RADIUS auth port in ms (null if failed) */
  authPortLatencyMs: number | null;

  /** Time to connect to RADIUS acct port in ms (null if failed) */
  acctPortLatencyMs: number | null;

  /** Best available latency for display (ICMP preferred, then TCP) */
  avgLatencyMs: number | null;

  /** Number of active sessions for this NAS */
  liveUsers: number;

  /** Total auth attempts */
  totalAuths: number;

  /** Failed auth attempts */
  failedAuths: number;

  /** Which probes succeeded */
  probesUsed: string[];

  /** Error message if all probes failed */
  error?: string;

  /** Timestamp of this probe */
  probedAt: Date;
}

export interface NasHealthCheckResult {
  /** Total NAS devices found */
  totalNas: number;
  /** NAS devices actually probed (active ones) */
  probed: number;
  /** Devices that responded */
  online: number;
  /** Devices that didn't respond */
  offline: number;
  /** Devices with high latency (>200ms) */
  degraded: number;
  /** Total errors during probe */
  errors: number;
  /** Duration of the full check in ms */
  durationMs: number;
  /** Per-NAS results */
  results: ProbeResult[];
}

// ────────────────────────────────────────────────────────────
// Probe Functions
// ────────────────────────────────────────────────────────────

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);

/**
 * ICMP ping: returns round-trip time in ms, or null if unavailable.
 * Uses system `ping` command (requires cap_net_raw or setuid).
 */
async function icmpPing(ip: string, timeoutMs: number = 3000): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ip} 2>&1`,
      { timeout: timeoutMs + 1000 }
    );

    // Parse Linux ping output: "time=42.3 ms" or "time=42.324 ms"
    const match = stdout.match(/time[=<]([0-9.]+)\s*ms/);
    if (match) {
      return parseFloat(match[1]);
    }

    return null;
  } catch {
    // Ping failed (device offline, permission denied, etc.)
    return null;
  }
}

/**
 * Check if ICMP is available (has permission to send raw packets).
 * Runs a single test ping to localhost.
 */
async function checkIcmpAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('ping -c 1 -W 1 127.0.0.1 2>&1', {
      timeout: 3000,
    });
    // If we got "time=" in output, ICMP works
    return /time[=<]/.test(stdout);
  } catch {
    return false;
  }
}

/**
 * TCP port check: tries to connect to host:port, returns latency in ms.
 * Returns null if connection failed or timed out.
 */
function tcpPortCheck(ip: string, port: number, timeoutMs: number = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/**
 * Probe a single NAS device.
 */
async function probeNas(
  nas: NasConfig,
  icmpAvailable: boolean,
  liveUsers: number,
  authStats: { totalAuths: number; failedAuths: number }
): Promise<ProbeResult> {
  const result: ProbeResult = {
    nasId: nas.id,
    nasIp: nas.ipAddress,
    nasName: nas.name || nas.shortname,
    tenantId: nas.tenantId,
    propertyId: nas.propertyId,
    isOnline: false,
    icmpLatencyMs: null,
    authPortLatencyMs: null,
    acctPortLatencyMs: null,
    avgLatencyMs: null,
    liveUsers,
    totalAuths: authStats.totalAuths,
    failedAuths: authStats.failedAuths,
    probesUsed: [],
    probedAt: new Date(),
  };

  const probes: Promise<void>[] = [];
  const isLocalhost = LOCALHOST_IPS.has(nas.ipAddress);

  // ── 0. Self/Localhost NAS — always online (StaySuite IS the gateway) ──
  // When the NAS IP is 127.0.0.1, this IS the local machine. No need to probe.
  if (isLocalhost) {
    result.isOnline = true;
    result.avgLatencyMs = 0;
    result.probesUsed.push('self:localhost');
    return result;
  }

  // ── 1. ICMP Ping ──
  if (icmpAvailable) {
    probes.push(
      (async () => {
        const latency = await icmpPing(nas.ipAddress);
        result.icmpLatencyMs = latency;
        if (latency !== null) {
          result.isOnline = true;
          result.probesUsed.push('icmp');
        }
      })()
    );
  }

  // ── 2. TCP Auth Port Check ──
  probes.push(
    (async () => {
      const latency = await tcpPortCheck(nas.ipAddress, nas.authPort, 3000);
      result.authPortLatencyMs = latency;
      if (latency !== null) {
        result.isOnline = true;
        result.probesUsed.push(`tcp:${nas.authPort}`);
      }
    })()
  );

  // ── 3. TCP Acct Port Check (optional, non-blocking) ──
  probes.push(
    (async () => {
      const latency = await tcpPortCheck(nas.ipAddress, nas.acctPort, 2000);
      result.acctPortLatencyMs = latency;
      if (latency !== null && !result.probesUsed.includes(`tcp:${nas.acctPort}`)) {
        result.probesUsed.push(`tcp:${nas.acctPort}`);
      }
    })()
  );

  // ── Run all probes in parallel ──
  await Promise.allSettled(probes);

  // ── Calculate best latency ──
  const latencies = [
    result.icmpLatencyMs,
    result.authPortLatencyMs,
    result.acctPortLatencyMs,
  ].filter((l): l is number => l !== null);

  if (latencies.length > 0) {
    // Use ICMP if available (most accurate), otherwise average of TCP
    if (result.icmpLatencyMs !== null) {
      result.avgLatencyMs = result.icmpLatencyMs;
    } else {
      result.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    }
  }

  // ── Error message for offline ──
  if (!result.isOnline) {
    if (!icmpAvailable && isLocalhost) {
      result.error = 'ICMP unavailable (sandbox) + localhost ports closed';
    } else if (!icmpAvailable) {
      result.error = `TCP ports ${nas.authPort}/${nas.acctPort} not responding (ICMP unavailable)`;
    } else {
      result.error = `All probes failed: ICMP unreachable, TCP ${nas.authPort}/${nas.acctPort} closed`;
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// Main Health Check Runner
// ────────────────────────────────────────────────────────────

let icmpAvailable: boolean | null = null;
let lastCheckResult: NasHealthCheckResult | null = null;

/**
 * Run a full NAS health check cycle.
 * Probes all active NAS devices and writes to NasHealthLog.
 */
export async function runNasHealthCheck(): Promise<NasHealthCheckResult> {
  const startTime = Date.now();
  const result: NasHealthCheckResult = {
    totalNas: 0,
    probed: 0,
    online: 0,
    offline: 0,
    degraded: 0,
    errors: 0,
    durationMs: 0,
    results: [],
  };

  try {
    // ── Step 1: Check ICMP availability (cached) ──
    if (icmpAvailable === null) {
      icmpAvailable = await checkIcmpAvailable();
      SELog.info(`ICMP ping available: ${icmpAvailable}`);
    }

    // ── Step 2: Get all active NAS devices ──
    const nasList = await db.$queryRawUnsafe<NasConfig[]>(`
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress", type,
             "authPort", "acctPort", "coaEnabled", "coaPort", status
      FROM "RadiusNAS"
      WHERE status = 'active'
        AND "ipAddress" IS NOT NULL
        AND "ipAddress" != ''
        AND "ipAddress" != '0.0.0.0'
    `);

    result.totalNas = nasList.length;

    if (nasList.length === 0) {
      SELog.info('No active NAS devices to probe');
      lastCheckResult = result;
      return result;
    }

    // ── Step 3: Batch-fetch live sessions and auth stats ──
    const nasIps = nasList.map((n) => n.ipAddress);

    const liveSessionRows = await db.$queryRawUnsafe<Array<{ nasIpAddress: string; cnt: number }>>(`
      SELECT "nasIpAddress", COUNT(*)::int as cnt
      FROM "LiveSession"
      WHERE "nasIpAddress" = ANY($1::text[])
        AND status = 'active'
      GROUP BY "nasIpAddress"
    `, nasIps);

    const liveSessionMap: Record<string, number> = {};
    for (const row of liveSessionRows) {
      liveSessionMap[row.nasIpAddress] = row.cnt;
    }

    const authRows = await db.$queryRawUnsafe<Array<{
      nasIpAddress: string;
      totalAuths: number;
      failedAuths: number;
    }>>(`
      SELECT "nasIpAddress",
             COUNT(*)::int as "totalAuths",
             COUNT(*) FILTER (WHERE "authResult" = 'Reject')::int as "failedAuths"
      FROM "RadiusAuthLog"
      WHERE "nasIpAddress" = ANY($1::text[])
      GROUP BY "nasIpAddress"
    `, nasIps);

    const authMap: Record<string, { totalAuths: number; failedAuths: number }> = {};
    for (const row of authRows) {
      authMap[row.nasIpAddress] = { totalAuths: row.totalAuths, failedAuths: row.failedAuths };
    }

    // ── Step 4: Probe each NAS (in parallel, max 5 concurrent) ──
    result.probed = nasList.length;
    const CONCURRENCY = 5;

    for (let i = 0; i < nasList.length; i += CONCURRENCY) {
      const batch = nasList.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((nas) =>
          probeNas(
            nas,
            icmpAvailable!,
            liveSessionMap[nas.ipAddress] || 0,
            authMap[nas.ipAddress] || { totalAuths: 0, failedAuths: 0 }
          )
        )
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          const probe = settled.value;
          result.results.push(probe);

          if (probe.isOnline) {
            result.online++;
            if (probe.avgLatencyMs !== null && probe.avgLatencyMs > 200) {
              result.degraded++;
            }
          } else {
            result.offline++;
          }
        } else {
          result.errors++;
        }
      }
    }

    // ── Step 5: Write results to NasHealthLog ──
    // Each cycle creates a new row (audit trail). The GET endpoint uses
    // DISTINCT ON to fetch only the latest per NAS IP.
    for (const probe of result.results) {
      try {
        await db.nasHealthLog.create({
          data: {
            tenantId: probe.tenantId,
            propertyId: probe.propertyId,
            nasIpAddress: probe.nasIp,
            nasName: probe.nasName,
            isOnline: probe.isOnline,
            liveUsers: probe.liveUsers,
            totalAuths: probe.totalAuths,
            totalAccts: 0,
            avgLatencyMs: probe.avgLatencyMs,
            lastSeenAt: probe.isOnline ? new Date() : null,
            checkIntervalSec: 60,
          },
        });
      } catch {
        // Skip on error (e.g. missing property/tenant FK)
      }
    }

    // ── Step 6: Update RadiusNAS.lastSeenAt for online devices ──
    const onlineIps = result.results.filter((r) => r.isOnline).map((r) => r.nasIp);
    if (onlineIps.length > 0) {
      await db.$executeRawUnsafe(`
        UPDATE "RadiusNAS"
        SET "lastSeenAt" = NOW()
        WHERE "ipAddress" = ANY($1::text[])
      `, onlineIps);
    }

    // ── Step 7: Cleanup old health logs (keep 7 days) ──
    try {
      await db.$executeRawUnsafe(`
        DELETE FROM "NasHealthLog"
        WHERE "createdAt" < NOW() - INTERVAL '7 days'
      `);
    } catch {
      // Non-fatal
    }

    // ── Step 8: Log summary ──
    result.durationMs = Date.now() - startTime;

    SELog.info(
      `NAS health check: ${result.probed} probed, ` +
      `${result.online} online, ${result.offline} offline, ` +
      `${result.degraded} degraded, ${result.errors} errors, ` +
      `${result.durationMs}ms (ICMP: ${icmpAvailable ? 'yes' : 'no'})`
    );

    // Log individual offline devices
    for (const probe of result.results) {
      if (!probe.isOnline) {
        SELog.warn(`NAS offline: ${probe.nasName} (${probe.nasIp}) — ${probe.error}`);
      }
    }

  } catch (err) {
    SELog.error(`NAS health check fatal error: ${err instanceof Error ? err.message : String(err)}`);
    result.errors++;
  }

  lastCheckResult = result;
  return result;
}

/**
 * Get the last NAS health check result (from memory).
 */
export function getLastNasHealthCheck(): NasHealthCheckResult | null {
  return lastCheckResult;
}

/**
 * Check if ICMP is currently available.
 */
export function isIcmpAvailable(): boolean {
  return icmpAvailable === true;
}
