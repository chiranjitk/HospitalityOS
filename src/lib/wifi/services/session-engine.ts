/**
 * StaySuite Session Engine
 *
 * This is the HEART of the gateway's accounting and session management.
 * Since StaySuite IS the NAS (Network Access Server), it must perform the
 * duties that a real AP/controller would normally handle:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  In a standard setup, the WiFi AP does this:              │
 *   │    1. Sends Accounting-Start to RADIUS server            │
 *   │    2. Sends Interim-Update every 60s (byte counts)       │
 *   │    3. Enforces Session-Timeout (kicks user)              │
 *   │    4. Enforces Idle-Timeout (kicks user)                 │
 *   │    5. Enforces bandwidth limits (shapes traffic)         │
 *   │    6. Sends Accounting-Stop on disconnect                │
 *   │                                                           │
 *   │  StaySuite does ALL of this because it IS the gateway:   │
 *   │    1. ✅ Auth flow creates radacct START record           │
 *   │    2. ⚡ This engine generates Interim-Updates            │
 *   │    3. ⚡ This engine enforces Session-Timeout             │
 *   │    4. ⚡ This engine enforces Idle-Timeout                │
 *   │    5. ⚡ nftables + RADIUS attrs handle bandwidth         │
 *   │    6. ⚡ This engine generates Accounting-Stop             │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Architecture:
 *
 *   ┌──────────┐   read-all-counters   ┌───────────────────┐
 *   │ nftables │ ────────────────────→ │  Session Engine    │
 *   │ counters │   every 60 seconds    │  (this file)       │
 *   └──────────┘                       └────────┬──────────┘
 *                                               │
 *                              ┌────────────────┼────────────────┐
 *                              │                │                │
 *                         radacct          WiFiSession      WiFiUser
 *                         (interim)        (update)         (totals)
 *                              │                │                │
 *                              │                │                │
 *                       ┌──────▼────────────────▼────────────────▼──────┐
 *                       │           Policy Enforcement                   │
 *                       │  • Session-Timeout  → disconnect               │
 *                       │  • Idle-Timeout     → disconnect               │
 *                       │  • Data-Limit       → disconnect               │
 *                       │  • Stale session    → cleanup                  │
 *                       └───────────────────────────────────────────────┘
 *
 * CRITICAL DESIGN DECISIONS:
 * - Reads REAL byte counters from nftables (not estimated)
 * - Updates radacct in-place (same row, acctstatus stays 'start')
 * - Creates separate interim-update rows for history/auditing
 * - Disconnects by removing IP from nftables + closing radacct
 */

import { db } from '@/lib/db';
import {
  readAllCounters,
  setupCounterTable,
  addUserCounter,
  removeUserCounter,
  isIPAuthenticated,
  deauthIP,
  doesAuthenticatedSetExist,
  type IPByteCount,
} from '@/lib/wifi/utils/nftables-counters';
import * as SELog from './session-engine-logger';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SessionEngineResult {
  /** Total active sessions found */
  sessionsProcessed: number;
  /** Sessions updated with new byte counts */
  interimUpdated: number;
  /** Sessions disconnected due to session timeout */
  sessionTimeoutDisconnected: number;
  /** Sessions disconnected due to idle timeout */
  idleTimeoutDisconnected: number;
  /** Sessions disconnected due to data limit */
  dataLimitDisconnected: number;
  /** Sessions cleaned up (stale/gone) */
  staleCleaned: number;
  /** Errors encountered */
  errors: number;
  /** Duration of the run in ms */
  durationMs: number;
  /** Details of disconnected sessions */
  disconnectedSessions: Array<{
    username: string;
    ip: string;
    reason: string;
  }>;
}

interface ActiveSession {
  radacctid: string;
  acctuniqueid: string;
  acctsessionid: string;
  username: string;
  framedipaddress: string;
  callingstationid: string;
  nasipaddress: string;
  acctstarttime: Date;
  acctupdatetime: Date;
  acctinputoctets: number;
  acctoutputoctets: number;
  acctsessiontime: number;
}

// In-memory store for idle timeout tracking:
// Maps IP → last timestamp when bytes delta was > 0
const lastActivityMap = new Map<string, number>();

// Bug 7: Concurrency guard to prevent overlapping runs
let isRunning = false;

// ── nftables availability cache ──────────────────────────────────
// When nft is not installed (e.g. dev/sandbox), the engine falls back
// to using radacct timestamps for idle detection instead of nftables.
let nftablesAvailable: boolean | null = null; // null = not yet checked
let nftablesCheckedAt = 0;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Bug 14: Defensive Date-to-timestamp conversion.
 * Handles cases where acctstarttime might not be a proper Date object.
 */
function safeGetTime(date: Date | unknown): number {
  if (date instanceof Date) return date.getTime();
  return new Date(String(date)).getTime();
}

/**
 * Minimal result returned when session engine is already running (Bug 7).
 */
function minimalResult(): SessionEngineResult {
  return {
    sessionsProcessed: 0,
    interimUpdated: 0,
    sessionTimeoutDisconnected: 0,
    idleTimeoutDisconnected: 0,
    dataLimitDisconnected: 0,
    staleCleaned: 0,
    errors: 0,
    durationMs: 0,
    disconnectedSessions: [],
  };
}

// ────────────────────────────────────────────────────────────
// Session Engine — Main Entry Point
// ────────────────────────────────────────────────────────────

/**
 * Run one cycle of the Session Engine.
 *
 * Called every 60 seconds by the scheduler cron job.
 * Also can be triggered manually via the cron API endpoint.
 *
 * Steps:
 * 1. Ensure nftables counter table exists
 * 2. Read all active sessions from radacct (acctstoptime IS NULL)
 * 3. Read all per-IP byte counters from nftables
 * 4. For each session:
 *    a. Match IP to byte counter
 *    b. Calculate delta since last update
 *    c. Update radacct with new bytes + session time (interim-update)
 *    d. Update WiFiSession + WiFiUser
 *    e. Check session timeout
 *    f. Check idle timeout (using delta)
 *    g. Check data limit
 * 5. Clean up stale sessions (IP not in nftables)
 * 6. Return summary
 */
export async function runSessionEngine(): Promise<SessionEngineResult> {
  // Bug 7: Concurrency guard — skip if already running
  if (isRunning) {
    SELog.info('Session engine already running, skipping this cycle');
    const skipped = minimalResult();
    SELog.recordRunResult(skipped);
    return skipped;
  }
  isRunning = true;

  try {
    const startTime = Date.now();
    const result: SessionEngineResult = {
      sessionsProcessed: 0,
      interimUpdated: 0,
      sessionTimeoutDisconnected: 0,
      idleTimeoutDisconnected: 0,
      dataLimitDisconnected: 0,
      staleCleaned: 0,
      errors: 0,
      durationMs: 0,
      disconnectedSessions: [],
    };

    try {
      // ── Step 0: Check nftables availability (cached for 5 min) ──
      nftablesAvailable = checkNftablesAvailability();
      if (!nftablesAvailable) {
        SELog.warn('nftables not available — running in FALLBACK mode (radacct-based idle detection)');
      }

      // ── Step 1: Ensure counter table exists (skip in fallback mode) ──
      if (nftablesAvailable) {
        setupCounterTable();

        // Warn if the authenticated_users set doesn't exist — stale session
        // detection will be skipped (isIPAuthenticated returns true as a
        // safe fallback to avoid wiping all active sessions).
        if (!doesAuthenticatedSetExist()) {
          SELog.warn(
            'nftables authenticated_users set not found — ' +
            'stale session detection is DISABLED. ' +
            'Ensure nftables rules are properly configured (staysuite_mangle table).'
          );
        }
      }

      // ── Step 2: Get all active sessions from radacct ──
      const activeSessions = await getActiveSessions();
      result.sessionsProcessed = activeSessions.length;

      if (activeSessions.length === 0) {
        SELog.info('No active sessions found');
        // Bug 6: Clear all idle tracking when no sessions exist
        lastActivityMap.clear();
        // Don't return early — still need to recordRunResult for status tracking
      } else {

      // ── Step 3: Read all per-IP byte counters from nftables (skip in fallback mode) ──
      const counterMap = new Map<string, IPByteCount>();
      if (nftablesAvailable) {
        const counterData = readAllCounters();
        for (const c of counterData.counts) {
          counterMap.set(c.ip, c);
        }
      }

      SELog.info(
        `Processing ${activeSessions.length} sessions, ` +
        `${counterMap.size} counter rules found` +
        (nftablesAvailable ? '' : ' [FALLBACK]')
      );

      // ── Step 4: Process each session ──
      for (const session of activeSessions) {
        try {
          await processSession(session, counterMap, result);
        } catch (err) {
          result.errors++;
          SELog.error(
            `Error processing session ${session.username} (${session.framedipaddress}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Bug 6: GC pass — purge stale lastActivityMap entries for IPs no longer in counterMap
      for (const [mapIp] of lastActivityMap) {
        if (!counterMap.has(mapIp)) {
          lastActivityMap.delete(mapIp);
        }
      }

      // ── Step 4b: Close orphan interim-update rows ──
      // The session engine INSERTs interim-update rows (acctstatus='interim-update')
      // that have acctstoptime IS NULL. If a session was closed externally
      // (GUI disconnect, guest logout) but the engine's INSERT ran in a race,
      // these orphans linger and block re-login ("Maximum concurrent sessions").
      // Clean up any interim rows whose original session is already stopped.
      try {
        const orphanResult = await db.$executeRawUnsafe(`
          UPDATE radacct
          SET acctstoptime = NOW(),
              acctterminatecause = 'Orphan-Cleanup',
              acctupdatetime = NOW()
          WHERE acctstoptime IS NULL
            AND acctstatus = 'interim-update'
            AND NOT EXISTS (
              SELECT 1 FROM radacct r2
              WHERE r2.username = radacct.username
                AND r2.acctsessionid = radacct.acctsessionid
                AND r2.acctstoptime IS NULL
                AND (r2.acctstatus IS NULL OR r2.acctstatus = '' OR r2.acctstatus = 'start')
            )
        `);
        const orphanCount = typeof orphanResult === 'number' ? orphanResult : 0;
        if (orphanCount > 0) {
          SELog.info(`Cleaned ${orphanCount} orphan interim-update rows (no matching active session)`);
        }
      } catch (err) {
        SELog.warn(`Failed to clean orphan interim rows: ${err instanceof Error ? err.message : String(err)}`);
      }

      // ── Step 5: Log results ──
      const duration = Date.now() - startTime;
      result.durationMs = duration;

      SELog.info(
        `Cycle complete in ${duration}ms: ` +
        `${result.interimUpdated} updated, ` +
        `${result.sessionTimeoutDisconnected} session-timeout, ` +
        `${result.idleTimeoutDisconnected} idle-timeout, ` +
        `${result.dataLimitDisconnected} data-limit, ` +
        `${result.staleCleaned} stale, ` +
        `${result.errors} errors`
      );
      } // end else (activeSessions.length > 0)
    } catch (err) {
      SELog.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
      result.errors++;
    }

    // ── Step 6: Record run result for status tracking ──
    SELog.recordRunResult(result);

    return result;
  } finally {
    // Bug 7: Always release the concurrency guard
    isRunning = false;
  }
}

// ────────────────────────────────────────────────────────────
// Internal Functions
// ────────────────────────────────────────────────────────────

/**
 * Get all active sessions from radacct (sessions that haven't been stopped).
 */
async function getActiveSessions(): Promise<ActiveSession[]> {
  const records = await db.$queryRawUnsafe<ActiveSession[]>(`
    SELECT
      radacctid, acctuniqueid, acctsessionid, username,
      framedipaddress, callingstationid,
      COALESCE(nasipaddress, '127.0.0.1') as nasipaddress,
      acctstarttime, acctupdatetime,
      COALESCE(acctinputoctets, 0) as acctinputoctets,
      COALESCE(acctoutputoctets, 0) as acctoutputoctets,
      COALESCE(acctsessiontime, 0) as acctsessiontime
    FROM radacct
    WHERE acctstoptime IS NULL
      AND (acctstatus IS NULL OR acctstatus = '' OR acctstatus = 'start')
      AND framedipaddress IS NOT NULL
      AND framedipaddress != ''
      AND framedipaddress != '0.0.0.0'
    ORDER BY acctstarttime ASC
  `);

  return records;
}

/**
 * Check if nftables is available on this system.
 * Result is cached for 5 minutes to avoid repeated execSync calls.
 */
function checkNftablesAvailability(): boolean {
  const now = Date.now();
  if (nftablesAvailable !== null && (now - nftablesCheckedAt) < 300_000) {
    return nftablesAvailable;
  }
  try {
    const { execSync } = require('child_process');
    execSync('which nft 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
    nftablesAvailable = true;
  } catch {
    nftablesAvailable = false;
  }
  nftablesCheckedAt = now;
  return nftablesAvailable;
}

/**
 * FALLBACK mode: Check idle timeout, session timeout, and data limit
 * when nftables counters are not available.
 *
 * Idle detection strategy (PERSISTENT — survives server restart):
 * Uses radacct.acctupdatetime as the "last activity" timestamp.
 * In FALLBACK mode, the session engine does NOT update acctupdatetime
 * (only acctsessiontime), so it stays at the value from the last real
 * traffic or interim update. If acctupdatetime is older than the idle
 * timeout threshold, the user is considered idle and disconnected.
 */
async function checkPoliciesFallback(
  session: ActiveSession,
  ip: string,
  sessionTime: number,
  result: SessionEngineResult
): Promise<void> {
  const newDownloadBytes = Number(session.acctinputoctets);
  const newUploadBytes = Number(session.acctoutputoctets);
  const newTotal = newDownloadBytes + newUploadBytes;

  // ── Idle timeout check (persistent DB-based) ──
  // Uses radacct.acctupdatetime as the "last activity" timestamp.
  // In FALLBACK mode, we do NOT update acctupdatetime (see processSession),
  // so it stays at the timestamp of the last real traffic or interim update.
  // If acctupdatetime is older than idleTimeout seconds, the user is idle.
  const idleTimeout = await getIdleTimeoutForUser(session.username);
  if (idleTimeout > 0) {
    const lastActivity = safeGetTime(session.acctupdatetime);
    const idleSeconds = Math.floor((Date.now() - lastActivity) / 1000);

    if (idleSeconds >= idleTimeout) {
      SELog.info(
        `[FALLBACK] IDLE TIMEOUT: ${session.username} (${ip}) — ` +
        `idle for ${idleSeconds}s (limit: ${idleTimeout}s), last activity: ${session.acctupdatetime}, bytes: ${newTotal}`
      );
      await disconnectSessionFallback(session, 'Idle-Timeout', newDownloadBytes, newUploadBytes);
      lastActivityMap.delete(ip);
      result.idleTimeoutDisconnected++;
      result.disconnectedSessions.push({ username: session.username, ip, reason: 'Idle-Timeout' });
      return;
    }

    // Log idle progress every 5 minutes for debugging
    if (idleSeconds > 0 && idleSeconds % 300 < 60) {
      SELog.info(
        `[FALLBACK] Idle tracking: ${session.username} (${ip}) — ` +
        `${idleSeconds}s idle of ${idleTimeout}s limit, bytes: ${newTotal}`
      );
    }
  }

  // ── Session timeout check ──
  const sessionTimeout = await getSessionTimeoutForUser(session.username);
  if (sessionTimeout > 0 && sessionTime >= sessionTimeout) {
    SELog.info(
      `[FALLBACK] SESSION TIMEOUT: ${session.username} (${ip}) — ` +
      `${sessionTime}s (limit: ${sessionTimeout}s)`
    );
    await disconnectSessionFallback(session, 'Session-Timeout', newDownloadBytes, newUploadBytes);
    result.sessionTimeoutDisconnected++;
    result.disconnectedSessions.push({ username: session.username, ip, reason: 'Session-Timeout' });
    return;
  }

  // ── Data limit check ──
  const dataLimitBytes = await getDataLimitForUser(session.username);
  if (dataLimitBytes > 0 && newTotal >= dataLimitBytes) {
    SELog.info(
      `[FALLBACK] DATA LIMIT EXCEEDED: ${session.username} (${ip}) — ` +
      `${Math.round(newTotal / (1024 * 1024))}MB used of ${Math.round(dataLimitBytes / (1024 * 1024))}MB limit`
    );
    await disconnectSessionFallback(session, 'Data-Limit-Exceeded', newDownloadBytes, newUploadBytes);
    result.dataLimitDisconnected++;
    result.disconnectedSessions.push({ username: session.username, ip, reason: 'Data-Limit-Exceeded' });
    return;
  }
}

/**
 * FALLBACK mode: Disconnect a session without nftables.
 * Uses CoA (Change of Authorization) to tell the NAS to terminate the session,
 * then closes radacct and WiFiSession records.
 */
async function disconnectSessionFallback(
  session: ActiveSession,
  reason: string,
  downloadBytes: number,
  uploadBytes: number
): Promise<void> {
  SELog.info(`[FALLBACK] Disconnecting ${session.username}: ${reason}`);

  // Close radacct record
  await db.$executeRawUnsafe(`
    UPDATE radacct SET
      acctstoptime = NOW(),
      acctterminatecause = $1,
      acctsessiontime = $2,
      acctinputoctets = $3,
      acctoutputoctets = $4
    WHERE radacctid = $5 AND acctstoptime IS NULL
  `, reason, Math.floor((Date.now() - safeGetTime(session.acctstarttime)) / 1000), downloadBytes, uploadBytes, session.radacctid);

  // Close WiFiSession
  try {
    await db.wiFiSession.updateMany({
      where: {
        username: session.username,
        status: 'active',
      },
      data: {
        status: reason === 'Session-Cleanup' ? 'disconnected' : 'terminated',
        endTime: new Date(),
        downloadBytes,
        uploadBytes,
      },
    });
  } catch {
    // Non-fatal
  }

  // Try CoA disconnect via the RADIUS API (internal call)
  try {
    const coaRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/wifi/radius`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'coa-disconnect',
        username: session.username,
        nasIp: session.nasipaddress,
        reason,
      }),
    });
    SELog.info(`[FALLBACK] CoA disconnect response for ${session.username}: ${coaRes.status}`);
  } catch (coaErr) {
    SELog.warn(`[FALLBACK] CoA disconnect failed for ${session.username}: ${coaErr instanceof Error ? coaErr.message : String(coaErr)}`);
  }

  // Clean up idle tracking
  lastActivityMap.delete(session.framedipaddress);
  lastActivityMap.delete(`__prevTotal__${session.framedipaddress}`);
}

/**
 * Process a single session: read counters, update accounting, enforce policies.
 */
async function processSession(
  session: ActiveSession,
  counterMap: Map<string, IPByteCount>,
  result: SessionEngineResult
): Promise<void> {
  const ip = session.framedipaddress;
  const counter = counterMap.get(ip);

  // ── Check if IP is still in nftables (authenticated) ──
  // In FALLBACK mode (no nftables), skip stale check — rely on radacct timestamps
  if (nftablesAvailable) {
    const isAuthed = isIPAuthenticated(ip);
    if (!isAuthed) {
      // IP removed from firewall → session is gone (user left, DHCP expired, etc.)
      SELog.info(`Stale session: ${session.username} (${ip}) — IP not in nftables`);
      // Bug 9: Before closing stale session, read the counter to preserve last-cycle data
      const staleCounter = counterMap.get(ip);
      const dl = staleCounter ? staleCounter.downloadBytes : Number(session.acctinputoctets);
      const ul = staleCounter ? staleCounter.uploadBytes : Number(session.acctoutputoctets);
      await closeSession(session, 'Session-Cleanup', dl, ul);
      result.staleCleaned++;
      return;
    }
  }

  // ── Check if counter rule exists for this IP ──
  if (!counter) {
    if (nftablesAvailable) {
      // No counter rule yet — add one for future tracking
      addUserCounter(ip);
    }
    // Still update session time even without byte data
    // Bug 14: Use safeGetTime for defensive Date handling
    const sessionTime = Math.floor((Date.now() - safeGetTime(session.acctstarttime)) / 1000);

    // In FALLBACK mode: do NOT update acctupdatetime — it serves as the
    // persistent "last activity" timestamp. The idle detection compares
    // Date.now() against this value. If we update it every cycle, idle
    // detection would never trigger.
    if (nftablesAvailable) {
      await db.$executeRawUnsafe(`
        UPDATE radacct SET
          acctsessiontime = $1,
          acctupdatetime = NOW()
        WHERE radacctid = $2
      `, sessionTime, session.radacctid);
    } else {
      // FALLBACK: only update session time, leave acctupdatetime untouched
      await db.$executeRawUnsafe(`
        UPDATE radacct SET
          acctsessiontime = $1
        WHERE radacctid = $2
      `, sessionTime, session.radacctid);
    }

    // Also update WiFiSession
    // Bug 3: Number() wrapping for BigInt safety
    await updateWiFiSession(session.username, session.callingstationid, Number(session.acctinputoctets), Number(session.acctoutputoctets), sessionTime);

    // In FALLBACK mode, still check idle/session/data-limit even without counters
    if (!nftablesAvailable) {
      await checkPoliciesFallback(session, ip, sessionTime, result);
    }
    return;
  }

  // ── Calculate byte deltas ──
  const newDownloadBytes = counter.downloadBytes;
  const newUploadBytes = counter.uploadBytes;
  // Bug 3: Number() wrapping for BigInt safety on radacct columns
  const prevDownload = Number(session.acctinputoctets);
  const prevUpload = Number(session.acctoutputoctets);
  const prevTotal = prevDownload + prevUpload;
  const newTotal = newDownloadBytes + newUploadBytes;

  // Bug 5: Detect counter reset — when new total is less than previous
  const counterReset = newTotal < prevTotal;
  if (counterReset) {
    // Counter reset detected — update radacct baseline, don't trigger idle
    SELog.warn(`Counter reset detected for ${ip}: prev=${prevTotal}, new=${newTotal}`);
    await db.$executeRawUnsafe(
      `UPDATE radacct SET acctinputoctets = $1, acctoutputoctets = $2 WHERE framedipaddress = $3 AND acctstoptime IS NULL`,
      newDownloadBytes, newUploadBytes, ip
    );
    // Skip idle check this cycle — fall through to session/data limit checks
  }

  // The delta might be negative if counters were reset; on reset, treat as 0
  const delta = counterReset ? 0 : Math.max(0, newTotal - prevTotal);
  const downloadDelta = counterReset ? 0 : Math.max(0, newDownloadBytes - prevDownload);
  const uploadDelta = counterReset ? 0 : Math.max(0, newUploadBytes - prevUpload);

  // ── FALLBACK idle detection (when nftables is available but counter shows no delta) ──
  // If delta === 0 but radacct.acctupdatetime hasn't changed since last cycle,
  // the user is truly idle. This catches edge cases where nftables counters exist
  // but aren't incrementing (e.g. firewall rule ordering issues).
  if (delta === 0 && !counterReset) {
    const lastUpdate = safeGetTime(session.acctupdatetime);
    const updateAgeSeconds = Math.floor((Date.now() - lastUpdate) / 1000);
    // If radacct hasn't been updated in > 2 minutes and no nftables delta,
    // force the idle path
    if (updateAgeSeconds > 120) {
      lastActivityMap.delete(ip); // Clear any stale timestamp
    }
  }

  // ── Calculate session time ──
  // Bug 14: Use safeGetTime for defensive Date handling
  const sessionTime = Math.floor((Date.now() - safeGetTime(session.acctstarttime)) / 1000);

  // ── Check idle timeout (skip entirely on counter reset — Bug 5) ──
  if (!counterReset) {
    const idleTimeout = await getIdleTimeoutForUser(session.username);
    if (idleTimeout > 0 && delta > 0) {
      // User has activity — update last activity timestamp
      lastActivityMap.set(ip, Date.now());
    } else if (idleTimeout > 0 && delta === 0) {
      // No activity — check if idle timeout exceeded
      // Bug 6: Use Date.now() as fallback instead of session.acctstarttime.getTime()
      // so users aren't immediately kicked on engine restart
      const lastActivity = lastActivityMap.get(ip) || Date.now();
      const idleSeconds = Math.floor((Date.now() - lastActivity) / 1000);

      if (idleSeconds >= idleTimeout) {
        SELog.info(
          `IDLE TIMEOUT: ${session.username} (${ip}) — ` +
          `idle for ${idleSeconds}s (limit: ${idleTimeout}s)`
        );
        await disconnectSession(session, 'Idle-Timeout', newDownloadBytes, newUploadBytes);
        result.idleTimeoutDisconnected++;
        result.disconnectedSessions.push({
          username: session.username,
          ip,
          reason: 'Idle-Timeout',
        });
        return;
      }
    }
  }

  // ── Check session timeout ──
  const sessionTimeout = await getSessionTimeoutForUser(session.username);
  if (sessionTimeout > 0 && sessionTime >= sessionTimeout) {
    SELog.info(
      `SESSION TIMEOUT: ${session.username} (${ip}) — ` +
      `${sessionTime}s (limit: ${sessionTimeout}s)`
    );
    await disconnectSession(session, 'Session-Timeout', newDownloadBytes, newUploadBytes);
    result.sessionTimeoutDisconnected++;
    result.disconnectedSessions.push({
      username: session.username,
      ip,
      reason: 'Session-Timeout',
    });
    return;
  }

  // ── Check data limit ──
  const dataLimitBytes = await getDataLimitForUser(session.username);
  if (dataLimitBytes > 0 && newTotal >= dataLimitBytes) {
    SELog.info(
      `DATA LIMIT EXCEEDED: ${session.username} (${ip}) — ` +
      `${Math.round(newTotal / (1024 * 1024))}MB used of ${Math.round(dataLimitBytes / (1024 * 1024))}MB limit`
    );
    await disconnectSession(session, 'Data-Limit-Exceeded', newDownloadBytes, newUploadBytes);
    result.dataLimitDisconnected++;
    result.disconnectedSessions.push({
      username: session.username,
      ip,
      reason: 'Data-Limit-Exceeded',
    });
    return;
  }

  // ── Update radacct with interim data ──
  await db.$executeRawUnsafe(`
    UPDATE radacct SET
      acctinputoctets = $1,
      acctoutputoctets = $2,
      acctsessiontime = $3,
      acctupdatetime = NOW()
    WHERE radacctid = $4
  `, newDownloadBytes, newUploadBytes, sessionTime, session.radacctid);

  // ── Insert an interim-update row for audit trail ──
  // This creates a separate radacct row with acctstatus = 'interim-update'
  // so the accounting sync service can pick it up
  // Bug 8: Use cumulative values (newDownloadBytes, newUploadBytes) instead of deltas
  await db.$executeRawUnsafe(`
    INSERT INTO radacct (
      acctuniqueid, acctsessionid, username,
      nasipaddress, nasporttype, acctstarttime, acctupdatetime,
      acctauthentic, framedipaddress, acctstatus,
      acctinputoctets, acctoutputoctets, acctsessiontime,
      calledstationid, callingstationid,
      "loginType", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2,
      '127.0.0.1', 'Wireless-802.11', $3, NOW(),
      'PAP', $4, 'interim-update',
      $5, $6, $7,
      '00:00:00:00:00:01', $8,
      'session-engine', NOW(), NOW()
    )
  `, session.acctsessionid, session.username, session.acctstarttime, ip,
     newDownloadBytes, newUploadBytes, sessionTime, session.callingstationid);

  // ── Update WiFiSession ──
  await updateWiFiSession(session.username, session.callingstationid, newDownloadBytes, newUploadBytes, sessionTime);

  // ── Update WiFiUser cumulative totals ──
  if (downloadDelta > 0 || uploadDelta > 0) {
    await db.wiFiUser.updateMany({
      where: { username: session.username },
      data: {
        totalBytesIn: { increment: downloadDelta },
        totalBytesOut: { increment: uploadDelta },
        lastAccountingAt: new Date(),
      },
    });
  }

  result.interimUpdated++;
}

/**
 * Get session timeout for a user from radreply.
 * Returns timeout in SECONDS. 0 = no limit.
 */
async function getSessionTimeoutForUser(username: string): Promise<number> {
  try {
    const reply = await db.radReply.findFirst({
      where: { username, attribute: 'Session-Timeout', isActive: true },
    });
    return reply ? parseInt(reply.value, 10) || 0 : 0;
  } catch (err) {
    // Bug 15: Log the error instead of silently returning "no limit"
    SELog.warn(`Failed to look up Session-Timeout for ${username}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

/**
 * Get idle timeout for a user from radreply.
 * Checks Cryptsk-Idle-Timeout first (own gateway), then standard RFC Idle-Timeout
 * (for external NAS devices like MikroTik, Cisco, Aruba).
 * Returns timeout in SECONDS. 0 = no limit.
 */
async function getIdleTimeoutForUser(username: string): Promise<number> {
  try {
    // Check Cryptsk-Idle-Timeout first (own gateway / multimode)
    const cryptskReply = await db.radReply.findFirst({
      where: { username, attribute: 'Cryptsk-Idle-Timeout', isActive: true },
    });
    if (cryptskReply && parseInt(cryptskReply.value, 10) > 0) {
      return parseInt(cryptskReply.value, 10);
    }

    // Fallback: check standard RFC Idle-Timeout (for external NAS)
    const standardReply = await db.radReply.findFirst({
      where: { username, attribute: 'Idle-Timeout', isActive: true },
    });
    return standardReply ? parseInt(standardReply.value, 10) || 0 : 0;
  } catch (err) {
    SELog.warn(`Failed to look up Idle-Timeout for ${username}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

/**
 * Get data limit for a user (in BYTES).
 * Checks multiple possible attributes (vendor-specific + standard RFC):
 *   - Cryptsk-Data-Limit (bytes) — own gateway
 *   - Cryptsk-Max-Input-Octets (bytes) — own gateway
 *   - Max-Input-Octets (bytes) — standard RFC 2865 (ALL NAS)
 *   - ChilliSpot-Max-Total-Octets (bytes) — ChilliSpot/Coova
 * Returns 0 = unlimited.
 */
async function getDataLimitForUser(username: string): Promise<number> {
  try {
    const replies = await db.radReply.findMany({
      where: {
        username,
        attribute: { in: [
          'Cryptsk-Data-Limit',
          'Cryptsk-Max-Input-Octets',
          'Max-Input-Octets',         // Standard RFC 2865 — ALL NAS devices
          'ChilliSpot-Max-Total-Octets',
        ] },
        isActive: true,
      },
    });

    for (const reply of replies) {
      const val = parseInt(reply.value, 10);
      if (val > 0) return val;
    }
    return 0;
  } catch (err) {
    SELog.warn(`Failed to look up Data-Limit for ${username}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

/**
 * Update the WiFiSession record with latest byte counts and duration.
 */
async function updateWiFiSession(
  username: string,
  macAddress: string | null,
  downloadBytes: number,
  uploadBytes: number,
  sessionTimeSec: number
): Promise<void> {
  try {
    // Bug 4: Always include username in WHERE clause to avoid matching
    // ANY active session when macAddress is null/unknown
    const whereClause = macAddress && macAddress !== 'unknown'
      ? { username, macAddress, status: 'active' }
      : { username, status: 'active' };

    // Try to find by username + MAC, then by username alone
    let session = await db.wiFiSession.findFirst({ where: whereClause });

    if (!session) {
      session = await db.wiFiSession.findFirst({
        where: { username, status: 'active' },
        orderBy: { startTime: 'desc' },
      });
    }

    if (session) {
      const dataUsedMB = Math.floor((downloadBytes + uploadBytes) / (1024 * 1024));
      await db.wiFiSession.update({
        where: { id: session.id },
        data: {
          dataUsed: dataUsedMB,
          duration: sessionTimeSec,
          // Bug 13: Removed meaningless ternary `undefined : undefined`,
          // just omit ipAddress to keep existing value
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    // Non-fatal
    SELog.warn(`Failed to update WiFiSession for ${username}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Disconnect a session: remove from nftables + close radacct + close WiFiSession.
 * This is the "Accounting-Stop" equivalent.
 */
async function disconnectSession(
  session: ActiveSession,
  reason: string,
  downloadBytes: number,
  uploadBytes: number
): Promise<void> {
  const ip = session.framedipaddress;
  // Bug 14: Use safeGetTime for defensive Date handling
  const sessionTime = Math.floor((Date.now() - safeGetTime(session.acctstarttime)) / 1000);

  // 1. Remove from nftables (blocks internet access immediately)
  deauthIP(ip);

  // 2. Remove byte counter rules
  removeUserCounter(ip);

  // 3. Clean up idle tracking
  lastActivityMap.delete(ip);

  // Bug 2: Calculate delta for WiFiUser — only increment by the remaining difference,
  // not the full cumulative total (which would double-count bytes already recorded
  // by interim updates in processSession)
  const inDelta = Math.max(0, downloadBytes - Number(session.acctinputoctets));
  const outDelta = Math.max(0, uploadBytes - Number(session.acctoutputoctets));

  // Bug 11: Wrap all DB operations in a transaction for atomicity
  await db.$transaction(async (tx) => {

    // 4. Update radacct: set stop time and finalize counters
    const updateResult = await tx.$executeRawUnsafe(`
      UPDATE radacct SET
        acctstoptime = NOW(),
        acctinputoctets = $1,
        acctoutputoctets = $2,
        acctsessiontime = $3,
        acctterminatecause = $4,
        acctupdatetime = NOW()
      WHERE radacctid = $5
        AND acctstoptime IS NULL
    `, downloadBytes, uploadBytes, sessionTime, reason, session.radacctid);

    // Bug 10: Only increment sessionCount if the radacct UPDATE actually affected rows
    const rowsAffected = Number(updateResult);

    // 5. Insert a formal Accounting-Stop record for audit trail
    await tx.$executeRawUnsafe(`
      INSERT INTO radacct (
        acctuniqueid, acctsessionid, username,
        nasipaddress, nasporttype, acctstarttime, acctstoptime, acctupdatetime,
        acctauthentic, framedipaddress, acctstatus,
        acctinputoctets, acctoutputoctets, acctsessiontime, acctterminatecause,
        calledstationid, callingstationid,
        "loginType", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2,
        '127.0.0.1', 'Wireless-802.11', $3, NOW(), NOW(),
        'PAP', $4, 'stop',
        $5, $6, $7, $8,
        '00:00:00:00:00:01', $9,
        'session-engine', NOW(), NOW()
      )
    `, session.acctsessionid, session.username, session.acctstarttime, ip,
       downloadBytes, uploadBytes, sessionTime, reason, session.callingstationid);

    // 6. Close WiFiSession
    try {
      const wifiSession = await tx.wiFiSession.findFirst({
        where: {
          macAddress: session.callingstationid || 'unknown',
          status: 'active',
        },
      });

      if (wifiSession) {
        const dataUsedMB = Math.floor((downloadBytes + uploadBytes) / (1024 * 1024));
        await tx.wiFiSession.update({
          where: { id: wifiSession.id },
          data: {
            endTime: new Date(),
            dataUsed: dataUsedMB,
            duration: sessionTime,
            status: 'ended',
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Non-fatal
    }

    // 7. Update WiFiUser cumulative stats + session count
    // Bug 10: Only increment if we actually closed a session (rowsAffected > 0)
    // Bug 2: Use deltas (inDelta, outDelta) instead of cumulative totals
    if (rowsAffected > 0) {
      try {
        await tx.wiFiUser.updateMany({
          where: { username: session.username },
          data: {
            totalBytesIn: { increment: inDelta },
            totalBytesOut: { increment: outDelta },
            sessionCount: { increment: 1 },
            lastAccountingAt: new Date(),
          },
        });
      } catch {
        // Non-fatal
      }
    }

    // 8. Suspend the WiFi user for session-timeout and data-limit (not for idle-timeout)
    if (reason === 'Session-Timeout' || reason === 'Data-Limit-Exceeded') {
      try {
        await tx.wiFiUser.updateMany({
          where: { username: session.username },
          data: { status: reason === 'Data-Limit-Exceeded' ? 'suspended' : 'expired' },
        });
      } catch {
        // Non-fatal
      }
    }

  }); // end transaction

  SELog.info(
    `Disconnected: ${session.username} (${ip}) — ` +
    `reason: ${reason}, ` +
    `duration: ${sessionTime}s, ` +
    `data: ${Math.round((downloadBytes + uploadBytes) / (1024 * 1024))}MB`
  );
}

/**
 * Close a stale session (IP no longer in nftables).
 * Similar to disconnectSession but for cleanup of already-gone sessions.
 */
async function closeSession(
  session: ActiveSession,
  reason: string,
  downloadBytes: number,
  uploadBytes: number
): Promise<void> {
  const ip = session.framedipaddress;
  // Bug 14: Use safeGetTime for defensive Date handling
  const sessionTime = Math.floor((Date.now() - safeGetTime(session.acctstarttime)) / 1000);

  // Remove counter rules (may already be gone)
  removeUserCounter(ip);

  // Clean up idle tracking
  lastActivityMap.delete(ip);

  // Finalize radacct
  await db.$executeRawUnsafe(`
    UPDATE radacct SET
      acctstoptime = NOW(),
      acctinputoctets = COALESCE(acctinputoctets, $1),
      acctoutputoctets = COALESCE(acctoutputoctets, $2),
      acctsessiontime = $3,
      acctterminatecause = $4,
      acctupdatetime = NOW()
    WHERE radacctid = $5
      AND acctstoptime IS NULL
  `, downloadBytes, uploadBytes, sessionTime, reason, session.radacctid);

  // Close WiFiSession
  try {
    const wifiSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: session.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (wifiSession) {
      await db.wiFiSession.update({
        where: { id: wifiSession.id },
        data: {
          endTime: new Date(),
          duration: sessionTime,
          status: 'ended',
          updatedAt: new Date(),
        },
      });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Get a quick summary of active sessions with their current byte counts.
 * Used for the Live Sessions dashboard.
 */
export async function getSessionEngineStatus(): Promise<{
  activeSessions: number;
  totalDownloadMB: number;
  totalUploadMB: number;
  counterIPs: number;
  idleTrackingEntries: number;
  lastRun: Date | null;
}> {
  const activeSessions = await db.radAcct.count({
    where: { acctstoptime: null as any },
  });

  const totals = await db.radAcct.aggregate({
    where: { acctstoptime: null as any },
    _sum: {
      acctinputoctets: true,
      acctoutputoctets: true,
    },
  });

  const counterData = readAllCounters();

  // Get lastRun from the logger
  const logStatus = SELog.getStatus({ activeSessions, counterIPs: counterData.counts.length });

  return {
    activeSessions,
    totalDownloadMB: Math.round((totals._sum.acctinputoctets || 0) / (1024 * 1024)),
    totalUploadMB: Math.round((totals._sum.acctoutputoctets || 0) / (1024 * 1024)),
    counterIPs: counterData.counts.length,
    idleTrackingEntries: lastActivityMap.size,
    lastRun: logStatus.lastRunAt ? new Date(logStatus.lastRunAt) : null,
  };
}

/**
 * Get the full session engine diagnostic status (for admin monitoring).
 * Includes log entries, file info, and run history.
 */
export async function getSessionEngineDiagnostics(): Promise<SELog.SessionEngineStatus> {
  const activeSessions = await db.radAcct.count({
    where: { acctstoptime: null as any },
  });

  const counterData = readAllCounters();

  return SELog.getStatus({ activeSessions, counterIPs: counterData.counts.length });
}

/**
 * Manually force-disconnect a specific session by username or IP.
 * Used by the admin dashboard "disconnect" button.
 */
export async function forceDisconnect(params: {
  username?: string;
  ip?: string;
  reason?: string;
}): Promise<{ success: boolean; message?: string }> {
  const reason = params.reason || 'Admin-Request';

  // Bug 1: Use parameterized query — $2 placeholder instead of string interpolation
  const session = await db.$queryRawUnsafe<ActiveSession[] | undefined>(`
    SELECT * FROM radacct
    WHERE acctstoptime IS NULL
      AND (username = $1 ${params.ip ? `OR framedipaddress = $2` : ''})
    LIMIT 1
  `, params.username || '', ...(params.ip ? [params.ip] : []));

  if (!session || !Array.isArray(session) || session.length === 0) {
    return { success: false, message: 'No active session found' };
  }

  const activeSession = session[0];

  // Bug 12: Read live counters from nftables if possible (instead of dead code `null : null`)
  const counterData = readAllCounters();
  const counterEntry = params.ip ? counterData.counts.find(c => c.ip === params.ip) : null;
  // Bug 16: Number() wrap BigInt values from radacct query results
  const downloadBytes = counterEntry ? counterEntry.downloadBytes : Number(activeSession.acctinputoctets);
  const uploadBytes = counterEntry ? counterEntry.uploadBytes : Number(activeSession.acctoutputoctets);

  await disconnectSession(activeSession, reason, downloadBytes, uploadBytes);

  return { success: true, message: `Session disconnected: ${activeSession.username}` };
}
