/**
 * nftables Per-IP Traffic Counter Helper
 *
 * Reads/writes byte counters from nftables "staysuite_count" table.
 * Each authenticated user gets two counter rules:
 *   - user_in_<ip>:  download bytes (packets destined TO user IP)
 *   - user_out_<ip>: upload bytes (packets FROM user IP)
 *
 * The Session Engine calls these functions every 60s to:
 *   1. Read counters → calculate deltas
 *   2. Write interim-update to radacct
 *   3. Enforce session/idle/data-limit policies
 */

import { execSync } from 'child_process';

const COUNTER_SCRIPT = '/home/z/my-project/scripts/nftables/staysuite-traffic-counters.sh';

// One-time availability check — if nft is missing or nftables table can't be
// created, suppress all subsequent log noise. SessionEngine handles fallback.
let _nftablesAvailable: boolean | null = null;

// Cache for authenticated_users set existence check.
// When the set doesn't exist, isIPAuthenticated() returns true (can't verify)
// to prevent false stale detection.
let _authSetExists: boolean | null = null;
let _authSetCheckedAt = 0;
const AUTH_SET_CHECK_TTL = 60_000; // Re-check every 60 seconds

function isNftablesAvailable(): boolean {
  if (_nftablesAvailable !== null) return _nftablesAvailable;
  try {
    execSync('which nft 2>/dev/null', { timeout: 2000 });
    const result = execSync(`bash ${COUNTER_SCRIPT} setup 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    _nftablesAvailable = true;
    return true;
  } catch {
    _nftablesAvailable = false;
    return false;
  }
}

export interface IPByteCount {
  ip: string;
  downloadBytes: number;
  uploadBytes: number;
}

export interface AllByteCounts {
  counts: IPByteCount[];
  timestamp: Date;
}

/**
 * Ensure the counter table exists. Safe to call multiple times.
 */
export function setupCounterTable(): boolean {
  if (!isNftablesAvailable()) return false;
  try {
    execSync(`bash ${COUNTER_SCRIPT} setup 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Add counter rules for a user IP.
 * Called after successful authentication.
 */
export function addUserCounter(ip: string): boolean {
  if (!isNftablesAvailable()) return false;
  try {
    execSync(`bash ${COUNTER_SCRIPT} add ${ip} 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove counter rules for a user IP.
 * Called on logout/disconnect/session cleanup.
 */
export function removeUserCounter(ip: string): boolean {
  if (!isNftablesAvailable()) return false;
  try {
    execSync(`bash ${COUNTER_SCRIPT} remove ${ip} 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read byte counters for a single IP.
 * Returns { ip, downloadBytes, uploadBytes }.
 */
export function readUserCounter(ip: string): IPByteCount | null {
  if (!isNftablesAvailable()) return null;
  try {
    const output = execSync(`bash ${COUNTER_SCRIPT} read ${ip} 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    // Parse: "192.168.1.100 1234567 987654"
    const parts = output.trim().split(/\s+/);
    if (parts.length >= 3) {
      return {
        ip: parts[0],
        downloadBytes: parseInt(parts[1], 10) || 0,
        uploadBytes: parseInt(parts[2], 10) || 0,
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Read byte counters for ALL tracked user IPs.
 * Returns array of { ip, downloadBytes, uploadBytes }.
 */
export function readAllCounters(): AllByteCounts {
  if (!isNftablesAvailable()) return { counts: [], timestamp: new Date() };
  try {
    const output = execSync(`bash ${COUNTER_SCRIPT} read-all 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    const counts: IPByteCount[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // Skip comment lines
      if (line.startsWith('#') || line.trim() === '') continue;

      // Parse: "192.168.1.100 1234567 987654"
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && /^\d+\.\d+\.\d+\.\d+$/.test(parts[0])) {
        counts.push({
          ip: parts[0],
          downloadBytes: parseInt(parts[1], 10) || 0,
          uploadBytes: parseInt(parts[2], 10) || 0,
        });
      }
    }

    return { counts, timestamp: new Date() };
  } catch {
    return { counts: [], timestamp: new Date() };
  }
}

/**
 * Remove all counter rules (keep the table).
 * Used during cleanup/reset.
 */
export function flushAllCounters(): boolean {
  if (!isNftablesAvailable()) return false;
  try {
    execSync(`bash ${COUNTER_SCRIPT} flush 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Check if the nftables authenticated_users set exists.
 * Result is cached for AUTH_SET_CHECK_TTL to avoid repeated exec calls.
 */
export function doesAuthenticatedSetExist(): boolean {
  const now = Date.now();
  if (_authSetExists !== null && (now - _authSetCheckedAt) < AUTH_SET_CHECK_TTL) {
    return _authSetExists;
  }
  try {
    const output = execSync('nft list sets 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 3000,
    });
    _authSetExists = output.includes('authenticated_users');
  } catch {
    _authSetExists = false;
  }
  _authSetCheckedAt = now;
  return _authSetExists;
}

/**
 * Check if an IP is in the nftables authenticated_users set.
 * Used to verify a session is still active at the firewall level.
 *
 * If the authenticated_users set doesn't exist at all (e.g. nftables not
 * fully configured), returns true to prevent false stale detection —
 * we cannot confirm the IP is NOT authenticated, so we assume it is.
 */
export function isIPAuthenticated(ip: string): boolean {
  // If the set doesn't exist, we can't verify authentication.
  // Return true to avoid false stale detection wiping all sessions.
  if (!doesAuthenticatedSetExist()) {
    return true;
  }

  try {
    const output = execSync(
      `nft get element inet staysuite_mangle authenticated_users "{ ${ip} }" 2>&1`,
      { encoding: 'utf-8', timeout: 3000 }
    );
    return output.includes(ip);
  } catch {
    return false;
  }
}

/**
 * Remove a user IP from the nftables authenticated_users set.
 * This is the "disconnect" action at the firewall level.
 */
export function deauthIP(ip: string): boolean {
  try {
    execSync(
      `nft delete element inet staysuite_mangle authenticated_users "{ ${ip} }" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 3000 }
    );
    return true;
  } catch {
    return false;
  }
}
