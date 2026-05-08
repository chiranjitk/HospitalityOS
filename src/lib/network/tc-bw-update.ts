/**
 * TC Bandwidth Update — In-place HTB class rate change for active sessions
 *
 * When a plan's bandwidth changes or a user is reassigned to a different plan,
 * active sessions need their TC HTB classes updated WITHOUT disconnecting.
 *
 * How it works:
 *   1. Given an IP, compute the fwmark (same as staysuite_login.sh)
 *   2. Discover the classid from the existing tc filter: tc filter show dev ifb0 | grep mark
 *   3. Change the class rate: tc class change dev ifb0 classid 1:<id> htb rate <new> ceil <new>
 *
 * This is NON-DISRUPTIVE — no connectivity loss, no re-authentication needed.
 *
 * Only applies to StaySuite's own NAS (127.0.0.1). External NAS devices use
 * RADIUS CoA (Change of Authorization) which is a separate flow.
 */

import { execSync } from 'child_process';

// ─── Types ───────────────────────────────────────────────────────

export interface BwUpdateResult {
  /** Whether the TC update succeeded */
  success: boolean;
  /** The IP that was updated */
  ip: string;
  /** The fwmark used to find the class */
  mark: string;
  /** Download classid found (e.g., "1:4d20") */
  downloadClassid: string | null;
  /** Upload classid found (e.g., "1:4d20") */
  uploadClassid: string | null;
  /** New download rate in kbps */
  downloadKbps: number;
  /** New upload rate in kbps */
  uploadKbps: number;
  /** Human-readable message */
  message: string;
}

export interface BwUpdateBatchResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  results: BwUpdateResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Compute the 32-bit fwmark from an IP address.
 * Uses the same formula as staysuite_login.sh: (IP_num | 0x10000000)
 */
function ipToMark(ip: string): string {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(isNaN)) return '0x00000000';
  const ipNum = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  return '0x' + ((ipNum | 0x10000000) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Discover the classid for a given fwmark on a device.
 * Returns the classid string (e.g., "1:4d20") or null.
 */
function discoverClassid(device: string, mark: string): string | null {
  try {
    // tc filter show output: "filter parent 1: protocol ip pref 100 fw handle 0x1A0A0AC6 classid 1:4d20"
    // NOTE: tc outputs hex marks in LOWERCASE, our mark is UPPERCASE → use grep -i
    const output = execSync(
      `tc filter show dev ${device} parent 1: 2>/dev/null | grep -i "handle ${mark}" | grep -oP 'classid \\K\\S+' | head -1`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * Check if tc is available (nftables/TC only on the StaySuite NAS).
 */
function isTcAvailable(): boolean {
  try {
    execSync('which tc 2>/dev/null', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Update bandwidth for a single active session in-place.
 *
 * @param ip        - The user's IP address
 * @param downloadMbps - New download speed in Mbps
 * @param uploadMbps   - New upload speed in Mbps
 * @returns BwUpdateResult with details
 *
 * Non-disruptive: uses `tc class change` to update HTB rates
 * without disconnecting the user.
 */
export function updateSessionBandwidth(
  ip: string,
  downloadMbps: number,
  uploadMbps: number
): BwUpdateResult {
  const mark = ipToMark(ip);
  const downloadKbps = Math.round(downloadMbps * 1000);
  const uploadKbps = Math.round(uploadMbps * 1000);

  if (!isTcAvailable()) {
    return {
      success: false, ip, mark,
      downloadClassid: null, uploadClassid: null,
      downloadKbps, uploadKbps,
      message: 'tc not available (not StaySuite NAS)',
    };
  }

  // Discover existing classids from fw filters
  const dlClassid = discoverClassid('ifb0', mark);
  const ulClassid = discoverClassid('ifb1', mark);

  if (!dlClassid && !ulClassid) {
    return {
      success: false, ip, mark,
      downloadClassid: dlClassid, uploadClassid: ulClassid,
      downloadKbps, uploadKbps,
      message: 'No TC classes found for this IP (not online or no fw filter)',
    };
  }

  const errors: string[] = [];

  // Update download class (ifb0) — ceil = 1.2x rate for burst
  if (dlClassid) {
    try {
      execSync(
        `tc class change dev ifb0 classid ${dlClassid} htb rate ${downloadKbps}kbit ceil ${Math.round(downloadKbps * 1.2)}kbit quantum 1500 2>&1`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      console.log(`[TC-BW] Updated download: ${ip} → ${dlClassid} rate=${downloadKbps}kbit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`download: ${msg}`);
    }
  }

  // Update upload class (ifb1) — ceil = 1.2x rate for burst
  if (ulClassid) {
    try {
      execSync(
        `tc class change dev ifb1 classid ${ulClassid} htb rate ${uploadKbps}kbit ceil ${Math.round(uploadKbps * 1.2)}kbit quantum 1500 2>&1`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      console.log(`[TC-BW] Updated upload: ${ip} → ${ulClassid} rate=${uploadKbps}kbit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`upload: ${msg}`);
    }
  }

  const success = errors.length === 0;
  return {
    success, ip, mark,
    downloadClassid: dlClassid, uploadClassid: ulClassid,
    downloadKbps, uploadKbps,
    message: success
      ? `Updated to ${downloadMbps}/${uploadMbps} Mbps (dl=${dlClassid}, ul=${ulClassid})`
      : `Partial failure: ${errors.join('; ')}`,
  };
}

/**
 * Update bandwidth for all active sessions on a specific plan.
 *
 * Queries radacct for active sessions (acctstoptime IS NULL) with
 * NAS IP 127.0.0.1, then updates TC classes in-place.
 *
 * @param planId - The WiFi plan ID
 * @param downloadMbps - New download speed in Mbps
 * @param uploadMbps - New upload speed in Mbps
 * @param db - Prisma client instance
 * @returns Batch result summary
 */
export async function updatePlanBandwidthForActiveSessions(
  planId: string,
  downloadMbps: number,
  uploadMbps: number,
  db: any
): Promise<BwUpdateBatchResult> {
  // Import dynamically to avoid circular deps at module level
  const { db: prisma } = await import('@/lib/db');

  // Find active sessions for users on this plan where NAS is StaySuite (127.0.0.1)
  const activeSessions = await prisma.$queryRawUnsafe<Array<{
    username: string;
    framedipaddress: string;
    nasipaddress: string;
  }>>(`
    SELECT DISTINCT r.username, r.framedipaddress, r.nasipaddress
    FROM radacct r
    JOIN "WiFiUser" u ON u.username = r.username
    WHERE r.acctstoptime IS NULL
      AND (r.acctstatus IS NULL OR r.acctstatus = '' OR r.acctstatus = 'start')
      AND r.framedipaddress IS NOT NULL
      AND r.framedipaddress != '0.0.0.0'
      AND u."planId" = $1
      AND (r.nasipaddress = '127.0.0.1' OR r.nasipaddress IS NULL)
  `, planId);

  const results: BwUpdateResult[] = [];
  let updated = 0, skipped = 0, failed = 0;

  for (const session of activeSessions) {
    if (!session.framedipaddress) {
      skipped++;
      continue;
    }

    const result = updateSessionBandwidth(
      session.framedipaddress,
      downloadMbps,
      uploadMbps
    );

    results.push(result);
    if (result.success) {
      updated++;
    } else {
      failed++;
    }
  }

  console.log(
    `[TC-BW] Plan ${planId} bandwidth update: ${downloadMbps}/${uploadMbps} Mbps → ` +
    `${updated} updated, ${skipped} skipped, ${failed} failed (of ${activeSessions.length} active)`
  );

  return { total: activeSessions.length, updated, skipped, failed, results };
}

/**
 * Update bandwidth for a single user's active session.
 * Finds the user's active session by username and NAS IP 127.0.0.1.
 *
 * @param username - The RADIUS username
 * @param downloadMbps - New download speed in Mbps
 * @param uploadMbps - New upload speed in Mbps
 * @returns BwUpdateResult or null if user not online
 */
export async function updateUserBandwidthLive(
  username: string,
  downloadMbps: number,
  uploadMbps: number
): Promise<BwUpdateResult | null> {
  const { db } = await import('@/lib/db');

  const sessions = await db.$queryRawUnsafe<Array<{
    framedipaddress: string;
    nasipaddress: string;
  }>>(`
    SELECT framedipaddress, nasipaddress
    FROM radacct
    WHERE username = $1
      AND acctstoptime IS NULL
      AND (acctstatus IS NULL OR acctstatus = '' OR acctstatus = 'start')
      AND framedipaddress IS NOT NULL
      AND framedipaddress != '0.0.0.0'
      AND (nasipaddress = '127.0.0.1' OR nasipaddress IS NULL)
    LIMIT 1
  `, username);

  if (sessions.length === 0) {
    return null; // User not online or on external NAS
  }

  return updateSessionBandwidth(sessions[0].framedipaddress, downloadMbps, uploadMbps);
}
