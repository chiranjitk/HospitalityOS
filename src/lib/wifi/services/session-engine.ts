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
 *                       └──────────────────────────────────────────────┘
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
  acctstarttime: Date;
  acctupdatetime: Date;
  acctinputoctets: number;
  acctoutputoctets: number;
  acctsessiontime: number;
}

// In-memory store for idle timeout tracking:
// Maps IP → last timestamp when bytes delta was > 0
const lastActivityMap = new Map<string, number>();

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
    // ── Step 1: Ensure counter table exists ──
    setupCounterTable();

    // ── Step 2: Get all active sessions from radacct ──
    const activeSessions = await getActiveSessions();
    result.sessionsProcessed = activeSessions.length;

    if (activeSessions.length === 0) {
      SELog.info('No active sessions found');
      // Don't return early — still need to recordRunResult for status tracking
    } else {

    // ── Step 3: Read all per-IP byte counters from nftables ──
    const counterData = readAllCounters();
    const counterMap = new Map<string, IPByteCount>();
    for (const c of counterData.counts) {
      counterMap.set(c.ip, c);
    }

    SELog.info(
      `Processing ${activeSessions.length} sessions, ` +
      `${counterData.counts.length} counter rules found`
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
      acctstarttime, acctupdatetime,
      COALESCE(acctinputoctets, 0) as acctinputoctets,
      COALESCE(acctoutputoctets, 0) as acctoutputoctets,
      COALESCE(acctsessiontime, 0) as acctsessiontime
    FROM radacct
    WHERE acctstoptime IS NULL
      AND framedipaddress IS NOT NULL
      AND framedipaddress != ''
      AND framedipaddress != '0.0.0.0'
    ORDER BY acctstarttime ASC
  `);

  return records;
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
  const isAuthed = isIPAuthenticated(ip);
  if (!isAuthed) {
    // IP removed from firewall → session is gone (user left, DHCP expired, etc.)
    SELog.info(`Stale session: ${session.username} (${ip}) — IP not in nftables`);
    await closeSession(session, 'Session-Cleanup', 0, 0);
    result.staleCleaned++;
    return;
  }

  // ── Check if counter rule exists for this IP ──
  if (!counter) {
    // No counter rule yet — add one for future tracking
    addUserCounter(ip);
    // Still update session time even without byte data
    const sessionTime = Math.floor((Date.now() - session.acctstarttime.getTime()) / 1000);
    await db.$executeRawUnsafe(`
      UPDATE radacct SET
        acctsessiontime = $1,
        acctupdatetime = NOW()
      WHERE radacctid = $2
    `, sessionTime, session.radacctid);

    // Also update WiFiSession
    await updateWiFiSession(session.username, session.callingstationid, session.acctinputoctets, session.acctoutputoctets, sessionTime);
    return;
  }

  // ── Calculate byte deltas ──
  const newDownloadBytes = counter.downloadBytes;
  const newUploadBytes = counter.uploadBytes;
  const prevTotal = session.acctinputoctets + session.acctoutputoctets;
  const newTotal = newDownloadBytes + newUploadBytes;

  // The delta might be negative if counters were reset
  const delta = Math.max(0, newTotal - prevTotal);
  const downloadDelta = Math.max(0, newDownloadBytes - session.acctinputoctets);
  const uploadDelta = Math.max(0, newUploadBytes - session.acctoutputoctets);

  // ── Calculate session time ──
  const sessionTime = Math.floor((Date.now() - session.acctstarttime.getTime()) / 1000);

  // ── Check idle timeout ──
  const idleTimeout = await getIdleTimeoutForUser(session.username);
  if (idleTimeout > 0 && delta > 0) {
    // User has activity — update last activity timestamp
    lastActivityMap.set(ip, Date.now());
  } else if (idleTimeout > 0 && delta === 0) {
    // No activity — check if idle timeout exceeded
    const lastActivity = lastActivityMap.get(ip) || session.acctstarttime.getTime();
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
     downloadDelta, uploadDelta, sessionTime, session.callingstationid);

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
  } catch {
    return 0;
  }
}

/**
 * Get idle timeout for a user from radreply (Cryptsk-Idle-Timeout).
 * Returns timeout in SECONDS. 0 = no limit.
 */
async function getIdleTimeoutForUser(username: string): Promise<number> {
  try {
    const reply = await db.radReply.findFirst({
      where: { username, attribute: 'Cryptsk-Idle-Timeout', isActive: true },
    });
    return reply ? parseInt(reply.value, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Get data limit for a user (in BYTES).
 * Checks multiple possible attributes:
 *   - Cryptsk-Data-Limit (bytes)
 *   - ChilliSpot-Max-Total-Octets (bytes)
 * Returns 0 = unlimited.
 */
async function getDataLimitForUser(username: string): Promise<number> {
  try {
    const replies = await db.radReply.findMany({
      where: {
        username,
        attribute: { in: ['Cryptsk-Data-Limit', 'ChilliSpot-Max-Total-Octets'] },
        isActive: true,
      },
    });

    for (const reply of replies) {
      const val = parseInt(reply.value, 10);
      if (val > 0) return val;
    }
    return 0;
  } catch {
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
    const whereClause = macAddress && macAddress !== 'unknown'
      ? { macAddress, status: 'active' }
      : { status: 'active' };

    // Try to find by MAC first, then by any active session for this user
    let session = await db.wiFiSession.findFirst({ where: whereClause });

    if (!session) {
      session = await db.wiFiSession.findFirst({
        where: { status: 'active' },
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
          ipAddress: macAddress ? undefined : undefined, // keep existing IP
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
  const sessionTime = Math.floor((Date.now() - session.acctstarttime.getTime()) / 1000);

  // 1. Remove from nftables (blocks internet access immediately)
  deauthIP(ip);

  // 2. Remove byte counter rules
  removeUserCounter(ip);

  // 3. Clean up idle tracking
  lastActivityMap.delete(ip);

  // 4. Update radacct: set stop time and finalize counters
  await db.$executeRawUnsafe(`
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

  // 5. Insert a formal Accounting-Stop record for audit trail
  await db.$executeRawUnsafe(`
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
    const wifiSession = await db.wiFiSession.findFirst({
      where: {
        macAddress: session.callingstationid || 'unknown',
        status: 'active',
      },
    });

    if (wifiSession) {
      const dataUsedMB = Math.floor((downloadBytes + uploadBytes) / (1024 * 1024));
      await db.wiFiSession.update({
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
  try {
    await db.wiFiUser.updateMany({
      where: { username: session.username },
      data: {
        totalBytesIn: { increment: downloadBytes },
        totalBytesOut: { increment: uploadBytes },
        sessionCount: { increment: 1 },
        lastAccountingAt: new Date(),
      },
    });
  } catch {
    // Non-fatal
  }

  // 8. Suspend the WiFi user for session-timeout and data-limit (not for idle-timeout)
  if (reason === 'Session-Timeout' || reason === 'Data-Limit-Exceeded') {
    try {
      await db.wiFiUser.updateMany({
        where: { username: session.username },
        data: { status: reason === 'Data-Limit-Exceeded' ? 'suspended' : 'expired' },
      });
    } catch {
      // Non-fatal
    }
  }

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
  const sessionTime = Math.floor((Date.now() - session.acctstarttime.getTime()) / 1000);

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

  const session = await db.$queryRawUnsafe<ActiveSession[] | undefined>(`
    SELECT * FROM radacct
    WHERE acctstoptime IS NULL
      AND (username = $1 ${params.ip ? `OR framedipaddress = '${params.ip}'` : ''})
    LIMIT 1
  `, params.username || '');

  if (!session || !Array.isArray(session) || session.length === 0) {
    return { success: false, message: 'No active session found' };
  }

  const activeSession = session[0];

  // Read current counters before disconnecting
  const counter = params.ip ? null : null; // Will use existing radacct values
  const downloadBytes = activeSession.acctinputoctets || 0;
  const uploadBytes = activeSession.acctoutputoctets || 0;

  await disconnectSession(activeSession, reason, downloadBytes, uploadBytes);

  return { success: true, message: `Session disconnected: ${activeSession.username}` };
}
