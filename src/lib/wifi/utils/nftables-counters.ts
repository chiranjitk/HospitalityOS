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
  try {
    execSync(`bash ${COUNTER_SCRIPT} setup 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch (err) {
    console.error('[nft-counters] Failed to setup counter table:', err);
    return false;
  }
}

/**
 * Add counter rules for a user IP.
 * Called after successful authentication.
 */
export function addUserCounter(ip: string): boolean {
  try {
    execSync(`bash ${COUNTER_SCRIPT} add ${ip} 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch (err) {
    console.error(`[nft-counters] Failed to add counter for ${ip}:`, err);
    return false;
  }
}

/**
 * Remove counter rules for a user IP.
 * Called on logout/disconnect/session cleanup.
 */
export function removeUserCounter(ip: string): boolean {
  try {
    execSync(`bash ${COUNTER_SCRIPT} remove ${ip} 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  } catch (err) {
    // Non-fatal — counters may already be removed
    console.warn(`[nft-counters] Failed to remove counter for ${ip}:`, err);
    return false;
  }
}

/**
 * Read byte counters for a single IP.
 * Returns { ip, downloadBytes, uploadBytes }.
 */
export function readUserCounter(ip: string): IPByteCount | null {
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
  } catch (err) {
    console.error('[nft-counters] Failed to read all counters:', err);
    return { counts: [], timestamp: new Date() };
  }
}

/**
 * Remove all counter rules (keep the table).
 * Used during cleanup/reset.
 */
export function flushAllCounters(): boolean {
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
 * Check if an IP is in the nftables authenticated_users set.
 * Used to verify a session is still active at the firewall level.
 */
export function isIPAuthenticated(ip: string): boolean {
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
