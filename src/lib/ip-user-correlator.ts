/**
 * IP → Guest/Username correlation helper (time-window aware)
 *
 * Resolves source IPs from ClickHouse/ulogd to human-readable guest names.
 * Uses TIME-WINDOW matching to handle IP reuse across different guests.
 *
 * Four-tier lookup (most reliable first):
 *   0. RadAcct.framedipaddress + time window → WiFiUser.guestId → Guest
 *      Also: RadAcct.callingstationid → RadiusMacAuth.guestName (MAC auto-auth)
 *   1. WiFiSession.ipAddress + time window → Guest (name)
 *   2. WiFiSession.username (fallback when no guestId)
 *   3. DhcpLease → DeviceProfile → WiFiUser → Guest (MAC-based bridge)
 *
 * IMPORTANT: The correlator receives (IP, timestamp) pairs and finds the session
 * that was ACTIVE at each specific timestamp. This handles DHCP IP reuse correctly:
 *   - IP 10.0.1.101 on Jan 3 → Guest A (session Jan 1-5)
 *   - IP 10.0.1.101 on Jan 10 → Guest B (session Jan 10-12)
 */

import { db } from '@/lib/db';

/** A single IP+timestamp pair from ClickHouse/ulogd2 */
export interface IpTimestamp {
  ip: string;
  timestamp: Date;
}

export interface CorrelationResult {
  ipToGuest: Map<string, string>;  // IP → display name (per-timestamp, last-write-wins)
  totalIps: number;
  resolvedIps: number;
  resolvedViaRadAcct: number;
  resolvedViaSession: number;
  resolvedViaUsername: number;
  resolvedViaDhcp: number;
}

/**
 * Batch-resolve IP+timestamp pairs to guest names using time-window matching.
 *
 * @param ipTimestamps - Array of {ip, timestamp} pairs to resolve
 * @param tenantId - Optional tenant scope for WiFiSession lookup
 * @returns Map<ip, displayName> where displayName is guest name, username, or empty string
 */
export async function correlateIpsToGuests(
  ipTimestamps: IpTimestamp[] | string[],
  tenantId?: string,
): Promise<CorrelationResult> {
  // Backward-compatible: accept plain string[] (treat as now)
  const pairs: IpTimestamp[] = typeof ipTimestamps[0] === 'string'
    ? (ipTimestamps as string[]).map((ip) => ({ ip, timestamp: new Date() }))
    : ipTimestamps as IpTimestamp[];

  const uniqueIps = [...new Set(pairs.map((p) => p.ip).filter(Boolean))];

  const result: CorrelationResult = {
    ipToGuest: new Map(),
    totalIps: uniqueIps.length,
    resolvedIps: 0,
    resolvedViaRadAcct: 0,
    resolvedViaSession: 0,
    resolvedViaUsername: 0,
    resolvedViaDhcp: 0,
  };

  if (uniqueIps.length === 0) return result;

  try {
    // ── Step 0: RadAcct lookup with time-window matching ──────────
    // FreeRADIUS writes every session to radacct with framedipaddress.
    // We find sessions where the event timestamp falls within the session window.
    const resolvedSet = new Set<string>();

    if (uniqueIps.length > 0) {
      // Get all RadAcct records for these IPs (recent ones only, last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const radAcctRecords = await db.radAcct.findMany({
        where: {
          framedipaddress: { in: uniqueIps },
          acctstarttime: { gte: ninetyDaysAgo },
        },
        select: {
          framedipaddress: true,
          username: true,
          callingstationid: true,
          acctstarttime: true,
          acctstoptime: true,
        },
        orderBy: { acctstarttime: 'desc' },
      });

      if (radAcctRecords.length > 0) {
        // Group by IP for fast lookup
        const radAcctByIp = new Map<string, typeof radAcctRecords>();
        for (const r of radAcctRecords) {
          if (!r.framedipaddress) continue;
          const list = radAcctByIp.get(r.framedipaddress) || [];
          list.push(r);
          radAcctByIp.set(r.framedipaddress, list);
        }

        // Collect all unique usernames + MACs for batch lookup
        const allRadUsernames = new Set<string>();
        const allRadMacs = new Set<string>();
        for (const r of radAcctRecords) {
          if (r.username) allRadUsernames.add(r.username);
          if (r.callingstationid) allRadMacs.add(r.callingstationid);
        }

        // Batch: WiFiUser by username → guestId
        const wifiUserGuestMap = new Map<string, string>();
        if (allRadUsernames.size > 0) {
          const wifiUsers = await db.wiFiUser.findMany({
            where: { username: { in: [...allRadUsernames] } },
            select: { username: true, guestId: true },
          });
          for (const wu of wifiUsers) {
            if (wu.guestId) wifiUserGuestMap.set(wu.username, wu.guestId);
          }
        }

        // Batch: RadiusMacAuth by MAC → guestName / guestId
        const macAuthNameMap = new Map<string, string>();
        const macAuthGuestIdMap = new Map<string, string>();
        if (allRadMacs.size > 0) {
          const macAuths = await db.radiusMacAuth.findMany({
            where: { macAddress: { in: [...allRadMacs] } },
            select: { macAddress: true, guestName: true, guestId: true },
          });
          for (const ma of macAuths) {
            if (ma.guestName && !macAuthNameMap.has(ma.macAddress)) {
              macAuthNameMap.set(ma.macAddress, ma.guestName);
            }
            if (ma.guestId && !macAuthGuestIdMap.has(ma.macAddress)) {
              macAuthGuestIdMap.set(ma.macAddress, ma.guestId);
            }
          }
        }

        // Batch fetch guest names for all RadAcct chain IDs
        const allRadGuestIds = [...new Set([
          ...wifiUserGuestMap.values(),
          ...macAuthGuestIdMap.values(),
        ])];
        const radGuestNameMap = new Map<string, string>();
        if (allRadGuestIds.length > 0) {
          const radGuests = await db.guest.findMany({
            where: { id: { in: allRadGuestIds } },
            select: { id: true, firstName: true, lastName: true },
          });
          for (const g of radGuests) {
            const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
            if (name) radGuestNameMap.set(g.id, name);
          }
        }

        // Resolve each (IP, timestamp) pair with time-window matching
        for (const pair of pairs) {
          if (resolvedSet.has(pair.ip)) continue;

          const sessions = radAcctByIp.get(pair.ip);
          if (!sessions) continue;

          // Find the RadAcct session that was ACTIVE at this timestamp
          const matchedSession = sessions.find((s) => {
            if (!s.acctstarttime) return false;
            const start = new Date(s.acctstarttime);
            // Event must be after session start
            if (pair.timestamp < start) return false;
            // If session has stop time, event must be before or at stop time
            if (s.acctstoptime && pair.timestamp > new Date(s.acctstoptime)) return false;
            return true;
          });

          if (!matchedSession) continue;

          // Path A: RadAcct.username → WiFiUser → Guest
          if (matchedSession.username) {
            const guestId = wifiUserGuestMap.get(matchedSession.username);
            if (guestId) {
              const name = radGuestNameMap.get(guestId);
              if (name) {
                result.ipToGuest.set(pair.ip, name);
                result.resolvedViaRadAcct++;
                result.resolvedIps++;
                resolvedSet.add(pair.ip);
                continue;
              }
            }
          }

          // Path B: RadAcct.callingstationid (MAC) → RadiusMacAuth
          if (matchedSession.callingstationid) {
            const mac = matchedSession.callingstationid;
            const macName = macAuthNameMap.get(mac);
            if (macName) {
              result.ipToGuest.set(pair.ip, macName);
              result.resolvedViaRadAcct++;
              result.resolvedIps++;
              resolvedSet.add(pair.ip);
              continue;
            }

            const macGuestId = macAuthGuestIdMap.get(mac);
            if (macGuestId) {
              const name = radGuestNameMap.get(macGuestId);
              if (name) {
                result.ipToGuest.set(pair.ip, name);
                result.resolvedViaRadAcct++;
                result.resolvedIps++;
                resolvedSet.add(pair.ip);
                continue;
              }
            }
          }

          // Path C: Use RadAcct.username as display name (last resort for this tier)
          if (matchedSession.username && !result.ipToGuest.has(pair.ip)) {
            result.ipToGuest.set(pair.ip, matchedSession.username);
            result.resolvedViaRadAcct++;
            result.resolvedIps++;
            resolvedSet.add(pair.ip);
          }
        }
      }
    }

    // ── Step 1: WiFiSession lookup with time-window matching ───────
    const step1Pairs = pairs.filter((p) => !resolvedSet.has(p.ip));
    const step1Ips = [...new Set(step1Pairs.map((p) => p.ip))];

    if (step1Ips.length > 0) {
      const sessionWhere: Record<string, unknown> = { ipAddress: { in: step1Ips } };
      if (tenantId) sessionWhere.tenantId = tenantId;

      const sessions = await db.wiFiSession.findMany({
        where: sessionWhere,
        select: {
          ipAddress: true,
          guestId: true,
          username: true,
          startTime: true,
          endTime: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (sessions.length > 0) {
        // Group by IP
        const sessionsByIp = new Map<string, typeof sessions>();
        for (const s of sessions) {
          const list = sessionsByIp.get(s.ipAddress) || [];
          list.push(s);
          sessionsByIp.set(s.ipAddress, list);
        }

        // Collect all unique guest IDs
        const guestIds = [...new Set(
          sessions.map((s) => s.guestId).filter((g): g is string => !!g),
        )];

        const guestNameMap = new Map<string, string>();
        if (guestIds.length > 0) {
          const guests = await db.guest.findMany({
            where: { id: { in: guestIds } },
            select: { id: true, firstName: true, lastName: true },
          });
          for (const g of guests) {
            const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
            if (name) guestNameMap.set(g.id, name);
          }
        }

        // Resolve with time-window matching
        for (const pair of step1Pairs) {
          if (resolvedSet.has(pair.ip)) continue;

          const ipSessions = sessionsByIp.get(pair.ip);
          if (!ipSessions) continue;

          // Find session active at this timestamp
          const matched = ipSessions.find((s) => {
            if (!s.startTime) return false;
            if (pair.timestamp < new Date(s.startTime)) return false;
            if (s.endTime && pair.timestamp > new Date(s.endTime)) return false;
            return true;
          });

          if (!matched) continue;

          if (matched.guestId) {
            const name = guestNameMap.get(matched.guestId);
            if (name) {
              result.ipToGuest.set(pair.ip, name);
              result.resolvedViaSession++;
              result.resolvedIps++;
              resolvedSet.add(pair.ip);
              continue;
            }
          }

          if (matched.username) {
            result.ipToGuest.set(pair.ip, matched.username);
            result.resolvedViaUsername++;
            result.resolvedIps++;
            resolvedSet.add(pair.ip);
          }
        }
      }
    }

    // ── Step 2: DHCP lease bridge for unresolved IPs ───────────────
    const step2Ips = [...new Set(pairs.filter((p) => !resolvedSet.has(p.ip)).map((p) => p.ip))];
    if (step2Ips.length > 0) {
      const dhcpLeases = await db.dhcpLease.findMany({
        where: { ipAddress: { in: step2Ips } },
        select: { ipAddress: true, macAddress: true },
      });

      const macToIps = new Map<string, string[]>();
      for (const lease of dhcpLeases) {
        if (lease.macAddress) {
          const existing = macToIps.get(lease.macAddress) || [];
          existing.push(lease.ipAddress);
          macToIps.set(lease.macAddress, existing);
        }
      }

      if (macToIps.size > 0) {
        const macs = [...macToIps.keys()];
        const devices = await db.deviceProfile.findMany({
          where: { macAddress: { in: macs }, isActive: true },
          select: { macAddress: true, guestId: true, wifiUserId: true },
        });

        const wifiUserIds = [...new Set(
          devices.map((d) => d.wifiUserId).filter((w): w is string => !!w),
        )];
        const wifiUserGuestMap = new Map<string, string>();
        if (wifiUserIds.length > 0) {
          const wifiUsers = await db.wiFiUser.findMany({
            where: { id: { in: wifiUserIds } },
            select: { id: true, guestId: true },
          });
          for (const wu of wifiUsers) {
            if (wu.guestId) wifiUserGuestMap.set(wu.id, wu.guestId);
          }
        }

        const chainGuestIds = [...new Set(
          devices
            .map((d) => d.guestId || (d.wifiUserId ? wifiUserGuestMap.get(d.wifiUserId) : null))
            .filter((g): g is string => !!g),
        )];

        const chainGuestNames = new Map<string, string>();
        if (chainGuestIds.length > 0) {
          const chainGuests = await db.guest.findMany({
            where: { id: { in: chainGuestIds } },
            select: { id: true, firstName: true, lastName: true },
          });
          for (const g of chainGuests) {
            const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
            if (name) chainGuestNames.set(g.id, name);
          }
        }

        for (const device of devices) {
          let targetGuestId = device.guestId;
          if (!targetGuestId && device.wifiUserId) {
            targetGuestId = wifiUserGuestMap.get(device.wifiUserId);
          }
          if (targetGuestId) {
            const name = chainGuestNames.get(targetGuestId);
            if (name) {
              const ipsForMac = macToIps.get(device.macAddress) || [];
              for (const ip of ipsForMac) {
                if (!result.ipToGuest.has(ip)) {
                  result.ipToGuest.set(ip, name);
                  result.resolvedViaDhcp++;
                  result.resolvedIps++;
                }
              }
            }
          }
        }
      }
    }

    // ── Diagnostic logging ────────────────────────────────────────
    console.log(
      `[ip-correlator] ${result.resolvedIps}/${result.totalIps} IPs resolved ` +
      `(radacct=${result.resolvedViaRadAcct}, session=${result.resolvedViaSession}, username=${result.resolvedViaUsername}, dhcp=${result.resolvedViaDhcp})`,
    );
    if (result.resolvedIps < result.totalIps) {
      const unresolved = uniqueIps.filter((ip) => !result.ipToGuest.has(ip));
      console.log(`[ip-correlator] Unresolved IPs (${unresolved.length}): ${unresolved.slice(0, 10).join(', ')}${unresolved.length > 10 ? '...' : ''}`);
    }
  } catch (error) {
    console.error('[ip-correlator] Error during IP correlation:', error);
  }

  return result;
}
