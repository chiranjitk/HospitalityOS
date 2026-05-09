/**
 * IP → Guest/Username correlation helper
 *
 * Resolves source IPs from ClickHouse/ulogd to human-readable guest names.
 * Three-tier lookup:
 *   1. WiFiSession.ipAddress → Guest (name)
 *   2. WiFiSession.ipAddress → WiFiSession.username (fallback when no guestId)
 *   3. DhcpLease → DeviceProfile → WiFiUser → Guest (MAC-based bridge)
 */

import { db } from '@/lib/db';

export interface CorrelationResult {
  ipToGuest: Map<string, string>;  // IP → display name
  totalIps: number;
  resolvedIps: number;
  resolvedViaSession: number;
  resolvedViaUsername: number;
  resolvedViaDhcp: number;
}

/**
 * Batch-resolve a list of IPs to guest names.
 *
 * @param ips  - Array of source IPs to resolve
 * @param tenantId - Optional tenant scope for WiFiSession lookup
 * @returns Map<ip, displayName> where displayName is guest name, username, or empty string
 */
export async function correlateIpsToGuests(
  ips: string[],
  tenantId?: string,
): Promise<CorrelationResult> {
  const uniqueIps = [...new Set(ips.filter(Boolean))];
  const result: CorrelationResult = {
    ipToGuest: new Map(),
    totalIps: uniqueIps.length,
    resolvedIps: 0,
    resolvedViaSession: 0,
    resolvedViaUsername: 0,
    resolvedViaDhcp: 0,
  };

  if (uniqueIps.length === 0) return result;

  try {
    // ── Step 1: WiFiSession lookup ─────────────────────────────────
    // Match IPs to active/recent WiFi sessions to get guestId or username
    const sessionWhere: Record<string, unknown> = { ipAddress: { in: uniqueIps } };
    if (tenantId) sessionWhere.tenantId = tenantId;

    const sessions = await db.wiFiSession.findMany({
      where: sessionWhere,
      select: {
        ipAddress: true,
        guestId: true,
        username: true,
        macAddress: true,
      },
      orderBy: { createdAt: 'desc' }, // most recent session wins per IP
    });

    // De-duplicate: keep latest session per IP
    const latestSession = new Map<string, (typeof sessions)[0]>();
    for (const s of sessions) {
      if (!latestSession.has(s.ipAddress)) {
        latestSession.set(s.ipAddress, s);
      }
    }

    // Collect all unique guest IDs from sessions
    const guestIds = [...new Set(
      [...latestSession.values()]
        .map((s) => s.guestId)
        .filter((g): g is string => !!g),
    )];

    // Batch-fetch guest names
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

    // Map IP → guest name (via Guest record)
    for (const [ip, session] of latestSession) {
      if (session.guestId) {
        const name = guestNameMap.get(session.guestId);
        if (name) {
          result.ipToGuest.set(ip, name);
          result.resolvedViaSession++;
          result.resolvedIps++;
          continue;
        }
      }

      // Fallback: use WiFiSession.username if no guest linked
      if (session.username) {
        result.ipToGuest.set(ip, session.username);
        result.resolvedViaUsername++;
        result.resolvedIps++;
        continue;
      }
    }

    // ── Step 2: DHCP lease bridge for unresolved IPs ───────────────
    const unresolvedIps = uniqueIps.filter((ip) => !result.ipToGuest.has(ip));
    if (unresolvedIps.length > 0) {
      const dhcpLeases = await db.dhcpLease.findMany({
        where: { ipAddress: { in: unresolvedIps } },
        select: { ipAddress: true, macAddress: true },
      });

      // Collect unique MACs for batch DeviceProfile lookup
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
          where: {
            macAddress: { in: macs },
            isActive: true,
          },
          select: { macAddress: true, guestId: true, wifiUserId: true },
        });

        // Collect WiFiUser IDs for batch lookup
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

        // Collect all guest IDs from DeviceProfile chain
        const chainGuestIds = [...new Set(
          devices
            .map((d) => d.guestId || (d.wifiUserId ? wifiUserGuestMap.get(d.wifiUserId) : null))
            .filter((g): g is string => !!g),
        )];

        // Batch-fetch guest names for chain
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

        // Resolve IPs via DeviceProfile chain
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
      `(session=${result.resolvedViaSession}, username=${result.resolvedViaUsername}, dhcp=${result.resolvedViaDhcp})`,
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
