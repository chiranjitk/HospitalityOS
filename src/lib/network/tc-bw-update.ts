/**
 * TC Bandwidth Update — In-place HTB class rate change for active sessions
 *
 * When a plan's bandwidth changes or a user is reassigned to a different plan,
 * active sessions need their TC HTB classes updated WITHOUT disconnecting.
 *
 * How it works:
 *   1. Given an IP, compute the fwmark (same as staysuite_login.sh)
 *   2. Discover the classid from the existing tc filter: tc filter show dev ifb0 | grep mark
 *   3. Change the class rate: tc class change dev ifb0 classid 1:<id> htb rate <new> ceil <ceil>
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
  /** Download burst ceil in kbps */
  downloadCeilKbps: number;
  /** Upload burst ceil in kbps */
  uploadCeilKbps: number;
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
 * @param ip            - The user's IP address
 * @param downloadMbps  - New download speed in Mbps
 * @param uploadMbps    - New upload speed in Mbps
 * @param options       - Optional burst ceil values (in Mbps). Defaults to rate if not set.
 * @returns BwUpdateResult with details
 *
 * Non-disruptive: uses `tc class change` to update HTB rates
 * without disconnecting the user.
 */
export function updateSessionBandwidth(
  ip: string,
  downloadMbps: number,
  uploadMbps: number,
  options?: {
    /** Download burst ceil in Mbps. If 0 or undefined, ceil = rate. */
    downloadCeilMbps?: number;
    /** Upload burst ceil in Mbps. If 0 or undefined, ceil = rate. */
    uploadCeilMbps?: number;
  }
): BwUpdateResult {
  const mark = ipToMark(ip);
  const downloadKbps = Math.round(downloadMbps * 1000);
  const uploadKbps = Math.round(uploadMbps * 1000);
  const downloadCeilKbps = options?.downloadCeilMbps
    ? Math.round(options.downloadCeilMbps * 1000)
    : downloadKbps;
  const uploadCeilKbps = options?.uploadCeilMbps
    ? Math.round(options.uploadCeilMbps * 1000)
    : uploadKbps;

  if (!isTcAvailable()) {
    return {
      success: false, ip, mark,
      downloadClassid: null, uploadClassid: null,
      downloadKbps, uploadKbps, downloadCeilKbps, uploadCeilKbps,
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
      downloadKbps, uploadKbps, downloadCeilKbps, uploadCeilKbps,
      message: 'No TC classes found for this IP (not online or no fw filter)',
    };
  }

  const errors: string[] = [];

  // Update download class (ifb0) — ceil = burst ceil (or rate if no burst)
  if (dlClassid) {
    try {
      execSync(
        `tc class change dev ifb0 classid ${dlClassid} htb rate ${downloadKbps}kbit ceil ${downloadCeilKbps}kbit quantum 1500 2>&1`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      console.log(`[TC-BW] Updated download: ${ip} → ${dlClassid} rate=${downloadKbps}kbit ceil=${downloadCeilKbps}kbit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`download: ${msg}`);
    }
  }

  // Update upload class (ifb1) — ceil = burst ceil (or rate if no burst)
  if (ulClassid) {
    try {
      execSync(
        `tc class change dev ifb1 classid ${ulClassid} htb rate ${uploadKbps}kbit ceil ${uploadCeilKbps}kbit quantum 1500 2>&1`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      console.log(`[TC-BW] Updated upload: ${ip} → ${ulClassid} rate=${uploadKbps}kbit ceil=${uploadCeilKbps}kbit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`upload: ${msg}`);
    }
  }

  const success = errors.length === 0;
  return {
    success, ip, mark,
    downloadClassid: dlClassid, uploadClassid: ulClassid,
    downloadKbps, uploadKbps, downloadCeilKbps, uploadCeilKbps,
    message: success
      ? `Updated to ${downloadMbps}/${uploadMbps} Mbps (ceil=${downloadCeilKbps / 1000}/${uploadCeilKbps / 1000} Mbps, dl=${dlClassid}, ul=${ulClassid})`
      : `Partial failure: ${errors.join('; ')}`,
  };
}

/**
 * Update bandwidth for all active sessions on a specific plan.
 *
 * Queries radacct for active sessions (acctstoptime IS NULL) with
 * NAS IP 127.0.0.1, then updates TC classes in-place.
 *
 * @param planId          - The WiFi plan ID
 * @param downloadMbps    - New download speed in Mbps
 * @param uploadMbps      - New upload speed in Mbps
 * @param db              - Prisma client instance
 * @param downloadCeilMbps - Download burst ceil in Mbps (optional, defaults to rate)
 * @param uploadCeilMbps   - Upload burst ceil in Mbps (optional, defaults to rate)
 * @returns Batch result summary
 */
export async function updatePlanBandwidthForActiveSessions(
  planId: string,
  downloadMbps: number,
  uploadMbps: number,
  db: any,
  downloadCeilMbps?: number,
  uploadCeilMbps?: number,
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

  const ceilOpts = {
    downloadCeilMbps: downloadCeilMbps || downloadMbps,
    uploadCeilMbps: uploadCeilMbps || uploadMbps,
  };

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
      uploadMbps,
      ceilOpts,
    );

    results.push(result);
    if (result.success) {
      updated++;
    } else {
      failed++;
    }
  }

  console.log(
    `[TC-BW] Plan ${planId} bandwidth update: ${downloadMbps}/${uploadMbps} Mbps ` +
    `(ceil=${ceilOpts.downloadCeilMbps}/${ceilOpts.uploadCeilMbps}) → ` +
    `${updated} updated, ${skipped} skipped, ${failed} failed (of ${activeSessions.length} active)`
  );

  return { total: activeSessions.length, updated, skipped, failed, results };
}

/**
 * Update bandwidth for a single user's active session.
 * Finds the user's active session by username and NAS IP 127.0.0.1.
 *
 * @param username          - The RADIUS username
 * @param downloadMbps      - New download speed in Mbps
 * @param uploadMbps        - New upload speed in Mbps
 * @param downloadCeilMbps  - Download burst ceil in Mbps (optional)
 * @param uploadCeilMbps    - Upload burst ceil in Mbps (optional)
 * @returns BwUpdateResult or null if user not online
 */
export async function updateUserBandwidthLive(
  username: string,
  downloadMbps: number,
  uploadMbps: number,
  downloadCeilMbps?: number,
  uploadCeilMbps?: number,
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

  return updateSessionBandwidth(sessions[0].framedipaddress, downloadMbps, uploadMbps, {
    downloadCeilMbps: downloadCeilMbps || downloadMbps,
    uploadCeilMbps: uploadCeilMbps || uploadMbps,
  });
}
