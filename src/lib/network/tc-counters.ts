/**
 * TC HTB Class Counter Reader
 *
 * Reads TC HTB class byte counters from ifb0 (download) and ifb1 (upload).
 * These counters track cumulative bytes sent/received per TC class.
 *
 * Used by the RRD collector to track per-pool bandwidth usage.
 * Pool container classes exist as 1:2 through 1:101 on both ifb devices.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = /*turbopackIgnore: true*/ require('child_process');

export interface TcClassCounter {
  classid: string;   // e.g., "1:2"
  minor: number;     // e.g., 2
  sentBytes: number;  // cumulative bytes
}

interface PooledCounters {
  classid: string;
  dnBytes: number;
  upBytes: number;
}

/**
 * Parse `tc -s -d class show dev <device>` output and extract
 * classid + sent bytes for each HTB class block.
 */
function parseTcClassOutput(output: string): TcClassCounter[] {
  const counters: TcClassCounter[] = [];
  const blocks = output.split(/\n(?=class htb\s)/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // Extract classid: "class htb 1:2 parent ..."
    const classMatch = block.match(/class\s+htb\s+(\d+:\d+)/);
    if (!classMatch) continue;

    const classid = classMatch[1];
    const [majorStr, minorStr] = classid.split(':');
    const minor = parseInt(minorStr, 10);

    // Extract sent bytes: "Sent 1234567890 bytes 1000000 pkts ..."
    const sentMatch = block.match(/Sent\s+(\d+)\s+bytes/);
    const sentBytes = sentMatch ? parseInt(sentMatch[1], 10) : 0;

    counters.push({ classid, minor, sentBytes });
  }

  return counters;
}

/**
 * Read TC HTB class byte counters from both ifb0 (download) and ifb1 (upload).
 *
 * Returns a Map keyed by the minor class ID number (2-101 for pools).
 * Each entry contains:
 *   - classid: "1:N" (same on both devices)
 *   - dnBytes: cumulative bytes sent on ifb0 (download)
 *   - upBytes: cumulative bytes sent on ifb1 (upload)
 *
 * Only pool-range minors (2-101) are included in the result.
 */
export function readTcClassCounters(): Map<number, { classid: string; dnBytes: number; upBytes: number }> {
  const result = new Map<number, { classid: string; dnBytes: number; upBytes: number }>();

  try {
    // Read download counters from ifb0
    let dnOutput = '';
    try {
      dnOutput = execSync('tc -s -d class show dev ifb0 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
    } catch {
      // ifb0 may not exist in sandbox
      return result;
    }

    // Read upload counters from ifb1
    let upOutput = '';
    try {
      upOutput = execSync('tc -s -d class show dev ifb1 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
    } catch {
      // ifb1 may not exist in sandbox
      return result;
    }

    // Parse both outputs
    const dnCounters = parseTcClassOutput(dnOutput);
    const upCounters = parseTcClassOutput(upOutput);

    // Build maps by minor for easy lookup
    const dnMap = new Map<number, number>();
    for (const c of dnCounters) {
      if (c.minor >= 2 && c.minor <= 101) {
        dnMap.set(c.minor, c.sentBytes);
      }
    }

    const upMap = new Map<number, number>();
    for (const c of upCounters) {
      if (c.minor >= 2 && c.minor <= 101) {
        upMap.set(c.minor, c.sentBytes);
      }
    }

    // Merge: a pool entry exists if it has counters on either device
    const allMinors = new Set([...dnMap.keys(), ...upMap.keys()]);
    for (const minor of allMinors) {
      result.set(minor, {
        classid: `1:${minor}`,
        dnBytes: dnMap.get(minor) || 0,
        upBytes: upMap.get(minor) || 0,
      });
    }
  } catch (err) {
    console.error('[TC-Counters] Error reading TC counters:', err);
  }

  return result;
}
