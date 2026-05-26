import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID, createHash } from 'crypto';
import { normalizeIPv4, getClientIp, extractClientIp } from '@/lib/utils/ip';
import { addUserCounter } from '@/lib/wifi/utils/nftables-counters';
import {
  runLoginScript,
  generateClassIds,
  lookupBandwidthPool,
  type LoginScriptParams,
} from '@/lib/network/script-runner';
import { getExternalGatewayConfig, buildGatewayAuthResponse, type ExternalGatewayConfig } from '@/lib/wifi/utils/external-gateway';
import { radiusAuth, getRejectMessage } from '@/lib/wifi/utils/radius-auth';
import { getLocalNasConfig } from '@/lib/wifi/local-nas-config';

// ────────────────────────────────────────────────────────────
// IP Pool Validation Helpers (shared with wifi/auth)
// ────────────────────────────────────────────────────────────

async function validateClientIpInPool(
  clientIp: string,
  allowedPoolIds?: string[] | 'ANY' | null
): Promise<{ poolId: string; poolName: string } | null> {
  try {
    // Build pool restriction clause when plan is bound to specific pools
    const poolFilter = (Array.isArray(allowedPoolIds) && allowedPoolIds.length > 0)
      ? `AND ip.id = ANY($2::uuid[])`
      : '';

    const params: unknown[] = [clientIp];
    if (Array.isArray(allowedPoolIds) && allowedPoolIds.length > 0) {
      params.push(allowedPoolIds);
    }

    const result = await db.$queryRawUnsafe<Array<{ id: string; name: string }>>(`
      SELECT ip.id, ip.name
      FROM "IpPoolRange" r
      JOIN "IpPool" ip ON ip.id = r."poolId"
      WHERE $1::inet BETWEEN r."startIp" AND r."endIp"
        AND ip.enabled = true
        ${poolFilter}
      LIMIT 1
    `, ...params);
    if (result.length === 0) return null;
    return { poolId: result[0].id, poolName: result[0].name };
  } catch (err) {
    console.error('[AutoAuth IP Pool Validation] Query failed:', err);
    return null;
  }
}

/**
 * Resolve allowed IP pool IDs for a user based on their plan binding.
 *
 * Priority:
 * 1. WiFiUser.ipPoolId — user-level override
 * 2. WiFiPlanIPPool junction — multi-pool mappings from plan
 * 3. WiFiPlan.ipPoolId — legacy single pool
 * 4. Plan exists but no pool → 'ANY' (check all pools)
 * 5. No plan at all → 'ANY' (still check all pools)
 *
 * Returns string[] of pool IDs, 'ANY', or null.
 */
function resolveAllowedPoolIds(
  planIpPoolId?: string | null,
  userIpPoolId?: string | null,
  planPoolIds?: string[],
): string[] | 'ANY' | null {
  if (userIpPoolId) return [userIpPoolId];
  if (planPoolIds && planPoolIds.length > 0) return planPoolIds;
  if (planIpPoolId) return [planIpPoolId];
  // No pool restriction — but IP must still be in at least one pool
  return 'ANY';
}

// ────────────────────────────────────────────────────────────────
// POST /api/v1/wifi/auto-auth
//
// Silent re-authentication for returning devices.
//
// Flow:
//   1. Receive fingerprintHash + optional storageToken + macAddress + portalSlug
//   2. Look up DeviceProfile by:
//      Strategy 1: storageToken (most reliable — set via localStorage)
//      Strategy 2: fingerprintHash (real browser fingerprint)
//      Strategy 3: macAddress → synthetic fingerprint (HTTP where crypto.subtle unavailable)
//   3. If found → verify WiFiUser is still valid (active, not expired)
//   4. If valid → update DeviceProfile stats → return success (silent re-auth)
//   5. If not found or expired → return 404 (show login form)
//
// This is called from the captive portal on page load, BEFORE showing the login form.
// If it succeeds, the portal silently redirects to internet without showing any UI.
// ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fingerprintHash, storageToken, portalSlug, macAddress } = body as {
      fingerprintHash?: string;
      storageToken?: string;
      portalSlug?: string;
      macAddress?: string;
    };

    // Internal flag: create a new DeviceProfile after successful manual auth
    const _createProfile = body._createProfile as boolean | undefined;
    const _wifiUsername = body._wifiUsername as string | undefined;

    // ── Validate: need at least one identifier (fingerprint, token, or MAC) ──
    if (!fingerprintHash && !storageToken && !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_IDENTIFIER', message: 'Device fingerprint, storage token, or MAC address is required' } },
        { status: 400 }
      );
    }

    console.log(`[AutoAuth] Received: fp=${fingerprintHash ? fingerprintHash.substring(0, 16) + '...' : 'null'} token=${storageToken ? storageToken.substring(0, 8) + '...' : 'null'} mac=${macAddress || 'null'} slug=${portalSlug || 'none'}`);

    // ── Resolve property from portal slug ──
    let propertyId: string | null = null;
    let tenantId: string | null = null;
    let autoAuthEnabled = true; // Default: allow auto-auth unless explicitly disabled

    if (portalSlug) {
      const portal = await db.captivePortal.findUnique({
        where: { slug: portalSlug },
        select: { propertyId: true, tenantId: true, autoAuthEnabled: true, enabled: true },
      });
      if (portal) {
        // If the portal is disabled or auto-auth is turned off, skip silently
        if (!portal.enabled || !portal.autoAuthEnabled) {
          console.log(`[AutoAuth] Skipped: portal "${portalSlug}" is ${!portal.enabled ? 'disabled' : 'auto-auth disabled'}`);
          return NextResponse.json(
            { success: false, error: { code: 'NO_MATCH', message: 'Auto-authentication is disabled for this portal' } },
            { status: 404 }
          );
        }
        propertyId = portal.propertyId;
        tenantId = portal.tenantId;
        autoAuthEnabled = portal.autoAuthEnabled;
      }
    }

    // ── Look up DeviceProfile — two strategies ──
    let deviceProfile = null;

    // Strategy 1: Match by storageToken (most reliable — set via localStorage)
    if (storageToken) {
      deviceProfile = await db.deviceProfile.findFirst({
        where: {
          storageToken,
          isActive: true,
          ...(propertyId ? { propertyId } : {}),
        },
        include: {
          wifiUser: {
            select: {
              id: true,
              username: true,
              status: true,
              validUntil: true,
              validFrom: true,
              password: true,
              ipPoolId: true,
              maxSessions: true,
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true, validityMinutes: true, ipPoolId: true, maxDevices: true } },
              property: { select: { id: true, name: true, tenantId: true } },
            },
          },
        },
      });
    }

    // Strategy 2: Match by fingerprintHash (fallback when storage cleared)
    if (!deviceProfile && fingerprintHash) {
      console.log(`[AutoAuth] Strategy 1 (token) failed, trying Strategy 2 (fingerprint)`);
      deviceProfile = await db.deviceProfile.findFirst({
        where: {
          fingerprintHash,
          isActive: true,
          ...(propertyId ? { propertyId } : {}),
        },
        include: {
          wifiUser: {
            select: {
              id: true,
              username: true,
              status: true,
              validUntil: true,
              validFrom: true,
              password: true,
              ipPoolId: true,
              maxSessions: true,
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true, validityMinutes: true, ipPoolId: true, maxDevices: true } },
              property: { select: { id: true, name: true, tenantId: true } },
            },
          },
        },
      });
    }

    // Strategy 3: Match by MAC address (synthetic fingerprint for HTTP/no-crypto.subtle)
    if (!deviceProfile && macAddress) {
      const normalizedMac = macAddress.replace(/[:\-\.\s]/g, '').toUpperCase();
      const formattedMac = normalizedMac.length === 12
        ? normalizedMac.match(/.{2}/g)?.join(':') || null
        : null;
      if (formattedMac) {
        // Match by macAddress directly on DeviceProfile
        console.log(`[AutoAuth] Strategy 2 (fingerprint) failed, trying Strategy 3 (MAC: ${formattedMac})`);
        deviceProfile = await db.deviceProfile.findFirst({
          where: {
            macAddress: formattedMac,
            isActive: true,
            ...(propertyId ? { propertyId } : {}),
          },
          include: {
            wifiUser: {
              select: {
                id: true,
                username: true,
                status: true,
                validUntil: true,
                validFrom: true,
                password: true,
                ipPoolId: true,
                maxSessions: true,
                plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true, validityMinutes: true, ipPoolId: true, maxDevices: true } },
                property: { select: { id: true, name: true, tenantId: true } },
              },
            },
          },
        });
        if (deviceProfile) {
          console.log(`[AutoAuth] Strategy 3 (MAC) matched: ${deviceProfile.fingerprintHash.substring(0, 16)}... for user ${deviceProfile.wifiUser?.username}`);
        }
      }
    }

    // ── No match found ──
    if (!deviceProfile) {
      // ── Profile creation / upsert mode: after successful manual auth ──
      if (_createProfile && _wifiUsername && propertyId && storageToken) {
        try {
          // Look up the WiFiUser that was just created by the auth flow
          const wifiUser = await db.wiFiUser.findUnique({
            where: { username: _wifiUsername },
            select: { id: true, tenantId: true, propertyId: true, guestId: true },
          });

          if (wifiUser) {
            const clientIp = getClientIp(request) || 'unknown';
            const userAgent = request.headers.get('user-agent') || null;

            // Normalize MAC address: strip separators, format as AA:BB:CC:DD:EE:FF
            const normalizedMac = macAddress
              ? macAddress.replace(/[:\-\.\s]/g, '').toUpperCase()
              : null;
            const formattedMac = normalizedMac && normalizedMac.length === 12
              ? normalizedMac.match(/.{2}/g)?.join(':') || null
              : null;

            // Use upsert: if profile exists for this fingerprint+property, update it;
            // otherwise create a new one. This handles re-login after session expiry.
            await db.deviceProfile.upsert({
              where: {
                fingerprintHash_propertyId: {
                  fingerprintHash,
                  propertyId: wifiUser.propertyId,
                },
              },
              create: {
                tenantId: wifiUser.tenantId,
                propertyId: wifiUser.propertyId,
                wifiUserId: wifiUser.id,
                guestId: wifiUser.guestId || undefined,
                fingerprintHash,
                storageToken,
                ipAddress: clientIp,
                userAgent: userAgent?.substring(0, 500),
                macAddress: formattedMac || undefined,
                deviceType: parseDeviceType(userAgent || ''),
                deviceName: parseDeviceName(userAgent || ''),
                authCount: 1,
                lastAuthAt: new Date(),
              },
              update: {
                wifiUserId: wifiUser.id,
                guestId: wifiUser.guestId || undefined,
                storageToken,
                ipAddress: clientIp,
                userAgent: userAgent?.substring(0, 500),
                ...(formattedMac ? { macAddress: formattedMac } : {}), // Update MAC if provided
                deviceType: parseDeviceType(userAgent || ''),
                deviceName: parseDeviceName(userAgent || ''),
                isActive: true,
                authCount: { increment: 1 },
                lastAuthAt: new Date(),
              },
            });
            console.log(`[AutoAuth] DeviceProfile upserted for ${_wifiUsername}`);
          }
        } catch (createErr) {
          console.warn('[AutoAuth] Profile creation failed (non-critical):', createErr);
        }
      }

      return NextResponse.json(
        { success: false, error: { code: 'NO_MATCH', message: 'No device profile found' } },
        { status: 404 }
      );
    }

    const { wifiUser } = deviceProfile;
    const now = new Date();

    // ── Validate WiFiUser is still active and not expired ──
    if (wifiUser.status !== 'active') {
      // Deactivate the device profile — user was revoked/suspended
      await db.deviceProfile.update({
        where: { id: deviceProfile.id },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: { code: 'USER_INACTIVE', message: 'WiFi user is no longer active' } },
        { status: 404 }
      );
    }

    if (new Date(wifiUser.validUntil) < now) {
      // WiFiUser expired — deactivate device profile
      await db.deviceProfile.update({
        where: { id: deviceProfile.id },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: { code: 'USER_EXPIRED', message: 'WiFi session has expired' } },
        { status: 404 }
      );
    }

    // ── Check device-level auto-auth toggle (F9 fix) ──
    // The admin can toggle WiFiDevice.autoAuth per-device in the device management UI.
    // This allows selective disabling of auto-auth for specific devices while keeping
    // the portal-level autoAuthEnabled toggle ON for other devices.
    const normalizeMac = (raw: string | undefined | null): string | null => {
      if (!raw) return null;
      const stripped = raw.replace(/[:\-\.\s]/g, '').toUpperCase();
      if (stripped.length === 12) return stripped.match(/.{2}/g)?.join(':') || null;
      return null;
    };
    const effectiveMac = normalizeMac(macAddress) || deviceProfile.macAddress || null;
    if (effectiveMac && tenantId) {
      try {
        const wifiDevice = await db.wiFiDevice.findFirst({
          where: { macAddress: effectiveMac, tenantId },
          select: { autoAuth: true },
        });
        if (wifiDevice && !wifiDevice.autoAuth) {
          console.log(`[AutoAuth] Device ${effectiveMac} has autoAuth=DISABLED — showing login form`);
          return NextResponse.json(
            { success: false, error: { code: 'DEVICE_AUTO_AUTH_DISABLED', message: 'Auto-authentication is disabled for this device' } },
            { status: 404 }
          );
        }
      } catch (deviceCheckErr) {
        console.warn('[AutoAuth] WiFiDevice lookup failed (non-critical, proceeding):', deviceCheckErr);
      }
    }

    // ── Close stale radacct session for THIS device only ──
    // Only close sessions matching the current device's IP, not ALL sessions.
    // Previously closed ALL sessions which killed other active device connections.
    try {
      const closeResult = await db.$executeRawUnsafe(
        `UPDATE radacct SET acctstoptime = NOW(), acctterminatecause = 'Auto-Reauth', acctstatus = 'stop', acctupdatetime = NOW(), updatedat = NOW()
         WHERE username = $1 AND acctstoptime IS NULL AND framedipaddress = $2`,
        wifiUser.username, clientIp || '0.0.0.0'
      );
      if (closeResult > 0) {
        console.log(`[AutoAuth] Closed ${closeResult} stale session(s) for ${wifiUser.username} (IP: ${clientIp}) before reauth`);
      }
    } catch (closeErr) {
      console.warn('[AutoAuth] Failed to close existing sessions (non-critical):', closeErr);
    }

    // ── Check max device limit ──
    // After closing stale sessions, the count should be 0 for the same device.
    // If another device is connected (different username sharing is not possible,
    // but if maxDevices > 1 the user could have multiple devices), this still
    // correctly enforces the limit.
    const maxDevices = wifiUser.maxSessions || wifiUser.plan?.maxDevices || 1;
    if (maxDevices > 0) {
      try {
        const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`
          SELECT COUNT(*)::bigint as count
          FROM radacct
          WHERE username = $1
            AND acctstoptime IS NULL
            AND (acctstatus IS NULL OR acctstatus = '' OR acctstatus = 'start')
            AND acctterminatecause IS NULL
        `, wifiUser.username);
        const activeCount = Number(result[0]?.count ?? 0);
        if (activeCount >= maxDevices) {
          console.warn(`[AutoAuth] Max devices reached for ${wifiUser.username}: ${activeCount}/${maxDevices}`);
          return NextResponse.json(
            { success: false, error: { code: 'MAX_DEVICES', message: `Max device limit reached (${activeCount}/${maxDevices})` } },
            { status: 403 }
          );
        }
      } catch (err) {
        console.error('[AutoAuth] Failed to check session limit:', err);
        // Fail closed — deny access on error
        return NextResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify device limit' } },
          { status: 500 }
        );
      }
    }

    // ── Update DeviceProfile stats ──
    const clientIp = getClientIp(request) || 'unknown';
    const userAgent = request.headers.get('user-agent') || null;

    // Parse device type from UA
    const deviceType = parseDeviceType(userAgent || '');
    const deviceName = parseDeviceName(userAgent || '');

    await db.deviceProfile.update({
      where: { id: deviceProfile.id },
      data: {
        ipAddress: clientIp,
        userAgent: userAgent?.substring(0, 500),
        deviceType,
        deviceName,
        // Update MAC from NAS if provided and profile doesn't have one yet
        ...(macAddress && !deviceProfile.macAddress ? { macAddress: macAddress.replace(/[:\-\.\s]/g, '').toUpperCase().match(/.{2}/g)?.join(':') || null } : {}),
        authCount: { increment: 1 },
        lastAuthAt: now,
        // Update storageToken if we matched by fingerprint and token is different
        ...(storageToken && deviceProfile.storageToken !== storageToken
          ? { storageToken }
          : {}),
      },
    });

    // ── Ensure RADIUS credentials exist ──
    // If credentials were deleted (deprovision + reprovision cycle), re-create them
    const radCheckCount = await db.radCheck.count({
      where: { username: wifiUser.username, isActive: true },
    });

    if (radCheckCount === 0) {
      // Re-provision RADIUS credentials
      await db.radCheck.create({
        data: {
          wifiUserId: wifiUser.id,
          username: wifiUser.username,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: wifiUser.password,
          priority: 0,
          isActive: true,
        },
      });

      // Re-create session timeout: cap at min(plan validity, remaining time)
      const planValiditySec = (wifiUser.plan?.validityMinutes || 60) * 60;
      const remainingUntilExpirySec = Math.floor((new Date(wifiUser.validUntil).getTime() - now.getTime()) / 1000);
      const sessionTimeoutSec = Math.min(planValiditySec, Math.max(0, remainingUntilExpirySec));
      if (sessionTimeoutSec > 0) {
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Session-Timeout',
            op: ':=',
            value: String(sessionTimeoutSec),
            priority: 10,
            isActive: true,
          },
        });
      }

      // Re-create bandwidth attributes from plan (downloadSpeed/uploadSpeed stored in Mbps)
      const downMbps = wifiUser.plan?.downloadSpeed || 0;
      const upMbps = wifiUser.plan?.uploadSpeed || 0;
      if (downMbps > 0) {
        // Cryptsk-Rate-Limit: human-readable "D/U" format in Mbps (e.g. "5M/2M")
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Cryptsk-Rate-Limit',
            op: ':=',
            value: `${downMbps}M/${upMbps || downMbps}M`,
            priority: 20,
            isActive: true,
          },
        });
        // Cryptsk-Bandwidth-Max-Down/Up: numeric bps values for gateway enforcement
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Cryptsk-Bandwidth-Max-Down',
            op: ':=',
            value: String(downMbps * 1000000),
            priority: 21,
            isActive: true,
          },
        });
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Cryptsk-Bandwidth-Max-Up',
            op: ':=',
            value: String((upMbps || downMbps) * 1000000),
            priority: 22,
            isActive: true,
          },
        });
      }

      // Mark as synced
      await db.wiFiUser.update({
        where: { id: wifiUser.id },
        data: { radiusSynced: true, radiusSyncedAt: now },
      });
    }

    // ── IP Pool Validation: advisory (non-blocking for auto-auth) ──
    // Auto-auth uses DeviceProfile (fingerprint/storageToken) as the primary
    // identity proof. IP pool matching determines whether to activate firewall
    // rules (nftables/TC), but should NOT block the auto-auth itself.
    //
    // This is critical for:
    //   - WAN-side testing (no real DHCP/pool IPs)
    //   - Sandbox environments (no real nftables)
    //   - Guests roaming between zones with different subnets
    const autoAuthRawIp = extractClientIp(request);
    const autoAuthClientIp = normalizeIPv4(autoAuthRawIp) || null;
    let matchedPool: { poolId: string; poolName: string; subnet?: string } | null = null;
    let skipFirewall = false; // Flag: skip firewall if IP not in any pool

    if (autoAuthClientIp) {
      // Resolve multi-pool IDs from WiFiPlanIPPool junction
      let autoAuthPlanPoolIds: string[] | undefined;
      if (wifiUser.planId) {
        try {
          const poolRows = await db.wiFiPlanIPPool.findMany({
            where: { planId: wifiUser.planId },
            select: { poolId: true },
          });
          autoAuthPlanPoolIds = poolRows.map(r => r.poolId);
        } catch { /* junction table may not exist yet */ }
      }
      const allowedPools = resolveAllowedPoolIds(
        wifiUser.plan?.ipPoolId,
        wifiUser.ipPoolId as string | null | undefined,
        autoAuthPlanPoolIds
      );
      const poolMatch = await validateClientIpInPool(autoAuthClientIp, allowedPools);
      if (!poolMatch) {
        const poolInfo = Array.isArray(allowedPools)
          ? `allowed: [${allowedPools.join(', ')}]`
          : 'any pool';
        console.warn(`[AutoAuth] IP pool check: ${autoAuthClientIp} not in ${poolInfo} — proceeding without firewall activation`);
        skipFirewall = true;
      } else {
        matchedPool = poolMatch;
        console.log(`[AutoAuth] IP pool check PASSED: ${autoAuthClientIp} → pool "${poolMatch.poolName}"${Array.isArray(allowedPools) ? ' [plan-restricted]' : ''}`);
      }
    } else {
      console.warn(`[AutoAuth] No valid client IP detected — proceeding without firewall activation`);
      skipFirewall = true;
    }

    // ── Authenticate via FreeRADIUS (validates Simultaneous-Use, expiration, etc.) ──
    const radiusResult = await radiusAuth(wifiUser.username, wifiUser.password);
    if (!radiusResult.accepted) {
      console.warn(`[AutoAuth] RADIUS rejected ${wifiUser.username}: ${radiusResult.rejectReason}`);
      // Log failed auth attempt to radpostauth
      await logAuthAttempt(wifiUser.username, 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: radiusResult.rejectReason || 'AUTH_FAILED',
            message: getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'),
          },
        },
        { status: 403 }
      );
    }

    // ── Log successful auth attempt to radpostauth (for Auth Logs tab) ──
    await logAuthAttempt(wifiUser.username, 'Access-Accept', request, 'auto_auth');

    // ── Normalize MAC address for firewall script ──
    const normalizedAutoMac = macAddress
      ? macAddress.replace(/[:\-\.\s]/g, '').toUpperCase()
      : null;
    const formattedAutoMac = normalizedAutoMac && normalizedAutoMac.length === 12
      ? normalizedAutoMac.match(/.{2}/g)?.join(':') || undefined
      : undefined;

    // ── Create radacct accounting session (for Active Users tab) ──
    // The v_active_sessions view shows rows where acctstoptime IS NULL.
    // Without this, auto-auth users appear "connected" on the portal
    // but never show up in the admin Active Users dashboard.
    const acctSessionId = await createAccountingSession(wifiUser.username, clientIp, request, 'auto_reauth', macAddress, wifiUser.propertyId);

    // ── Resolve bandwidth from RADIUS radReply or WiFi plan ──
    const autoAuthBw = await resolvePlanBandwidthKbps(wifiUser.planId, wifiUser.username);

    // ── Check for External MikroTik Gateway ──
    // When externalPortalMode=true on a MikroTik gateway, the guest device
    // must redirect to the MikroTik login URL with RADIUS creds so MikroTik
    // can open its own firewall. In this case, skip nftables activation —
    // MikroTik handles bandwidth/firewall enforcement via RADIUS attributes.
    // Pass client IP for subnet-based multi-gateway routing.
    let externalGateway: ExternalGatewayConfig | null = null;
    try {
      const gatewayClientIp = autoAuthClientIp || normalizeIPv4(clientIp);
      externalGateway = await getExternalGatewayConfig(
        wifiUser.propertyId,
        wifiUser.tenantId,
        gatewayClientIp && gatewayClientIp !== '0.0.0.0' ? gatewayClientIp : null,
      );
      if (externalGateway) {
        console.log(`[AutoAuth] External MikroTik gateway detected: ${externalGateway.mikrotikIp} → ${externalGateway.portalCallbackUrl}`);
      }
    } catch (err) {
      console.warn('[AutoAuth] External gateway lookup failed (non-critical):', err);
    }

    // ── Activate nftables + TC bandwidth shaping (staysuite_login.sh) ──
    // Only activate firewall when client IP is in a managed IP pool AND
    // there is no external gateway (external gateway handles its own firewall).
    if (!skipFirewall && !externalGateway) {
      const firewallIp = autoAuthClientIp || normalizeIPv4(clientIp);
      if (firewallIp && firewallIp !== '0.0.0.0') {
        await activateUserFirewall({
          username: wifiUser.username,
          clientIp: firewallIp,
          propertyId: wifiUser.propertyId,
          sessionId: acctSessionId,
          macAddress: formattedAutoMac,
          userId: wifiUser.id,
          dnKbps: autoAuthBw.dn,
          upKbps: autoAuthBw.up,
          dnCeilKbps: autoAuthBw.dnCeil,
          upCeilKbps: autoAuthBw.upCeil,
          subnet: matchedPool?.poolName,
        });
      } else {
        console.warn(`[AutoAuth] No valid client IP for firewall activation (ip=${clientIp})`);
      }

      // ── Add per-IP byte counter rules for session engine tracking ──
      const counterIp = autoAuthClientIp || normalizeIPv4(clientIp);
      if (counterIp && counterIp !== '0.0.0.0') {
        addUserCounter(counterIp);
      }
    } else {
      console.log(`[AutoAuth] Skipping firewall + counter activation (${skipFirewall ? 'WAN/sandbox/non-pool IP' : 'external gateway mode'})`);
    }

    // ── Calculate remaining validity (NEVER reset validUntil on reauth) ──
    // validUntil is set ONCE on first login/creation. Reauth only checks it.
    // This ensures a 4-hr package gives exactly 4 hours total — not infinite sliding.
    const planValidityMin = wifiUser.plan?.validityMinutes
      || (wifiUser.plan?.validityDays ? wifiUser.plan.validityDays * 1440 : null)
      || 60; // fallback: 1 hour

    const remainingMs = new Date(wifiUser.validUntil).getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    // ── Cap RADIUS Session-Timeout to remaining validity ──
    // If 30 min left on a 60-min plan, give a 30-min RADIUS session.
    // This prevents RADIUS sessions that exceed the actual account validity.
    const sessionTimeoutSec = Math.min(planValidityMin * 60, remainingSeconds);
    const existingSessionTimeout = await db.radReply.findFirst({
      where: { username: wifiUser.username, attribute: 'Session-Timeout' },
    });
    if (existingSessionTimeout && String(existingSessionTimeout.value) !== String(sessionTimeoutSec)) {
      await db.radReply.update({
        where: { id: existingSessionTimeout.id },
        data: { value: String(sessionTimeoutSec) },
      });
    }

    // ── Success! Silent re-auth complete ──
    const gatewayFields = buildGatewayAuthResponse(
      externalGateway,
      wifiUser.username,
      wifiUser.password,
    );

    return NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        method: 'auto_auth',
        username: wifiUser.username,
        sessionTimeout: planValidityMin,
        remainingMinutes,
        planName: wifiUser.plan?.name || null,
        planValidityDays: wifiUser.plan?.validityDays || null,
        bandwidthDown: wifiUser.plan?.downloadSpeed || null,
        bandwidthUp: wifiUser.plan?.uploadSpeed || null,
        remainingMinutes: planValidityMin,
        message: externalGateway ? 'Welcome back! Connecting to gateway...' : 'Welcome back! Connected automatically.',
        deviceProfileId: deviceProfile.id,
        ...gatewayFields,
      },
    });
  } catch (error) {
    console.error('[AutoAuth] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Auto-authentication failed' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// DELETE /api/v1/wifi/auto-auth
//
// Remove device profile (opt-out / logout from all devices).
// Called with ?storageToken=xxx to clear a specific device.
// Or ?fingerprintHash=xxx to clear by fingerprint.
// ────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storageToken = searchParams.get('storageToken');
    const fingerprintHash = searchParams.get('fingerprintHash');

    if (!storageToken && !fingerprintHash) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAMS', message: 'storageToken or fingerprintHash required' } },
        { status: 400 }
      );
    }

    const result = await db.deviceProfile.deleteMany({
      where: {
        ...(storageToken ? { storageToken } : {}),
        ...(fingerprintHash ? { fingerprintHash } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.count },
    });
  } catch (error) {
    console.error('[AutoAuth] Delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove device profile' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Firewall Activation (same as auth route)
// ────────────────────────────────────────────────────────────

async function activateUserFirewall(params: {
  username: string;
  clientIp: string;
  propertyId: string;
  sessionId?: string;
  macAddress?: string;
  userId?: string;
  /** Download bandwidth in kbps (e.g. 5000 = 5 Mbps) */
  dnKbps?: number;
  /** Upload bandwidth in kbps (e.g. 2000 = 2 Mbps) */
  upKbps?: number;
  /** Download burst ceil in kbps (0 or undefined = ceil = rate) */
  dnCeilKbps?: number;
  /** Upload burst ceil in kbps (0 or undefined = ceil = rate) */
  upCeilKbps?: number;
  subnet?: string | null;
}) {
  try {
    const clientIp = normalizeIPv4(params.clientIp);
    if (!clientIp || clientIp === '0.0.0.0') {
      console.warn('[AutoAuth Firewall] Skipping activation — no valid client IP');
      return;
    }

    if (!params.sessionId) {
      console.warn(`[AutoAuth Firewall] No sessionId for ${params.username} — session engine will NOT track this user.`);
    }

    const classIds = generateClassIds(params.username);
    const dnKbps = params.dnKbps || 0;
    const upKbps = params.upKbps || 0;
    const poolBw = await lookupBandwidthPool(params.propertyId, params.subnet);

    const scriptParams: LoginScriptParams = {
      ip: clientIp,
      action: 'masq',
      poolId: poolBw.poolId,
      poolRateDn: poolBw.poolRateDn,
      poolCeilDn: poolBw.poolCeilDn,
      poolRateUp: poolBw.poolRateUp,
      poolCeilUp: poolBw.poolCeilUp,
      dnClassid: classIds.dn,
      upClassid: classIds.up,
      dnKbps,
      upKbps,
      dnCeilKbps: params.dnCeilKbps,
      upCeilKbps: params.upCeilKbps,
      sessionId: params.sessionId,
      macAddress: params.macAddress,
      userId: params.userId,
    };

    const result = runLoginScript(scriptParams);

    if (result.success) {
      console.log(
        `[AutoAuth Firewall] Login OK: ${params.username} ip=${clientIp} cls=${classIds.dn}/${classIds.up} pool=${poolBw.poolId} dn=${dnKbps}k up=${upKbps}k (${result.durationMs}ms)`
      );
    } else {
      console.error(
        `[AutoAuth Firewall] Login FAIL: ${params.username} ip=${clientIp} exit=${result.exitCode} pool=${poolBw.poolId} stderr=${result.stderr || '(none)'} (${result.durationMs}ms)`
      );
    }
  } catch (err) {
    console.error('[AutoAuth Firewall] Exception:', err);
  }
}

/**
 * Resolve bandwidth from RADIUS radReply or WiFi plan (in kbps).
 * Same logic as auth route's resolvePlanBandwidthKbps.
 */
async function resolvePlanBandwidthKbps(
  planId: string | null | undefined,
  username?: string,
): Promise<{ dn: number; up: number; dnCeil: number; upCeil: number }> {
  // Priority 1: RADIUS radReply override (WISPr stores bits/sec → convert to kbps)
  if (username) {
    try {
      const radreply = await db.radReply.findMany({ where: { username } });
      const getVal = (attr: string): string | undefined =>
        radreply.find(r => r.attribute === attr)?.value;
      const radDown = getVal('WISPr-Bandwidth-Max-Down') || getVal('Cryptsk-Bandwidth-Max-Down');
      const radUp = getVal('WISPr-Bandwidth-Max-Up') || getVal('Cryptsk-Bandwidth-Max-Up');
      if (radDown && radUp) {
        const dn = Math.round(Number(radDown) / 1000);
        const up = Math.round(Number(radUp) / 1000);
        const radDlCeil = getVal('Cryptsk-Bandwidth-Ceil-Down');
        const radUlCeil = getVal('Cryptsk-Bandwidth-Ceil-Up');
        return { dn, up, dnCeil: radDlCeil ? Math.round(Number(radDlCeil) / 1000) : dn, upCeil: radUlCeil ? Math.round(Number(radUlCeil) / 1000) : up };
      }
    } catch { /* non-critical */ }
  }

  // Priority 2: WiFi plan bandwidth (Mbps → kbps)
  if (planId) {
    try {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: planId },
        select: { downloadSpeed: true, uploadSpeed: true, burstDownloadSpeed: true, burstUploadSpeed: true },
      });
      if (plan && plan.downloadSpeed > 0 && plan.uploadSpeed > 0) {
        const dn = plan.downloadSpeed * 1000;
        const up = plan.uploadSpeed * 1000;
        const dnCeil = (plan.burstDownloadSpeed && plan.burstDownloadSpeed > 0) ? plan.burstDownloadSpeed * 1000 : dn;
        const upCeil = (plan.burstUploadSpeed && plan.burstUploadSpeed > 0) ? plan.burstUploadSpeed * 1000 : up;
        return { dn, up, dnCeil, upCeil };
      }
    } catch { /* non-critical */ }
  }

  return { dn: 0, up: 0, dnCeil: 0, upCeil: 0 };
}

// ────────────────────────────────────────────────────────────
// UA Parsing Helpers
// ────────────────────────────────────────────────────────────

function parseDeviceType(ua: string): string {
  if (/iPhone/i.test(ua)) return 'mobile';
  // iPad detection: UA contains "iPad" or macOS with touch capabilities
  // Note: we cannot use navigator.maxTouchPoints on server — use UA heuristics instead
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && /WebKit/i.test(ua) && !/Safari/i.test(ua))) return 'tablet';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'mobile' : 'tablet';
  if (/SmartTV|InternetTV|APPLETV/i.test(ua)) return 'tv';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

function parseDeviceName(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  if (/Linux/i.test(ua)) return 'Linux PC';
  if (/SmartTV/i.test(ua)) return 'Smart TV';
  return 'Unknown Device';
}

/**
 * Write an auth log to radpostauth table.
 * This feeds the Auth Logs dashboard tab.
 */
/**
 * Convert a rejection reason code to human-readable message for replyMessage column.
 */
function getRejectMessageFromCode(code: string): string | null {
  if (code.startsWith('IP_NOT_IN_POOL:')) return `IP not in managed pool: ${code.replace('IP_NOT_IN_POOL:', '')}`;
  if (code === 'IP_NOT_DETERMINED') return 'Could not determine client IP';
  if (code.startsWith('MAX_SESSION')) return 'Max concurrent sessions reached';
  if (code.startsWith('ACCOUNT_')) return code.replace(/_/g, ' ').toLowerCase();
  return null;
}

async function logAuthAttempt(
  username: string,
  reply: string,
  request: NextRequest,
  extraInfo?: string,
  macAddress?: string,
) {
  try {
    const clientIp = normalizeIPv4(getClientIp(request) || '');

    // Resolve MAC: use provided MAC, then fall back to DeviceProfile lookup
    let effectiveMac = macAddress || null;
    if (!effectiveMac) {
      try {
        const wifiUser = await db.wiFiUser.findUnique({ where: { username }, select: { id: true } });
        if (wifiUser) {
          const dp = await db.deviceProfile.findFirst({
            where: { wifiUserId: wifiUser.id, isActive: true, macAddress: { not: null } },
            select: { macAddress: true },
            orderBy: { lastSeenAt: 'desc' },
          });
          if (dp?.macAddress) effectiveMac = dp.macAddress;
        }
      } catch { /* non-fatal */ }
    }

    // clientipaddress = real client IP (from HTTP headers)
    // "nasIpAddress" = 127.0.0.1 for captive portal (the app itself IS the NAS)
    await db.$executeRawUnsafe(
      `INSERT INTO radpostauth (username, pass, reply, authdate, clientipaddress, "nasIpAddress", callingstationid, "replyMessage")
       VALUES ($1, $2, $3, NOW(), $4, '127.0.0.1', $5, $6)`,
      username,
      extraInfo || '',
      reply,
      clientIp,
      effectiveMac,
      extraInfo ? getRejectMessageFromCode(extraInfo) : null,
    );
  } catch (err) {
    // Non-fatal — auth logging failure should not block authentication
    console.error('[AutoAuth] Failed to write auth log:', err);
  }
}

/**
 * Create an accounting session in radacct.
 * This feeds the v_active_sessions view → Active Users dashboard tab.
 *
 * The session is created with acctstoptime = NULL (no stop time),
 * which is how FreeRADIUS represents an active session.
 * The v_active_sessions view filters: WHERE session_status = 'active'
 * which maps to: acctstoptime IS NULL.
 */
async function createAccountingSession(
  username: string,
  clientIp: string,
  request: NextRequest,
  loginType: string = 'portal',
  macAddress?: string,
  propertyId?: string
): Promise<string> {
  try {
    const acctSessionId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const acctUniqueId = randomUUID();
    const now = new Date();

    // Normalize MAC address format
    const normalizedMac = macAddress
      ? macAddress.replace(/[:\-\.\s]/g, '').toUpperCase()
      : null;
    let formattedMac = normalizedMac && normalizedMac.length === 12
      ? normalizedMac.match(/.{2}/g)?.join(':') || null
      : null;

    // Fallback: if no MAC from request, look up DeviceProfile for this user
    if (!formattedMac) {
      try {
        const wifiUser = await db.wiFiUser.findUnique({ where: { username }, select: { id: true } });
        if (wifiUser) {
          const dp = await db.deviceProfile.findFirst({
            where: { wifiUserId: wifiUser.id, isActive: true, macAddress: { not: null } },
            select: { macAddress: true },
            orderBy: { lastSeenAt: 'desc' },
          });
          if (dp?.macAddress) formattedMac = dp.macAddress;
        }
      } catch { /* non-fatal */ }
    }

    // Get local NAS identity from RadiusNAS config (replaces hardcoded values)
    const localNas = propertyId ? await getLocalNasConfig(propertyId) : { calledStationId: '00:00:00:00:00:01', nasIpAddress: '127.0.0.1', nasIdentifier: 'Cryptsk-Gateway' };

    await db.$executeRawUnsafe(
      `INSERT INTO radacct (
         acctuniqueid, acctsessionid, username,
         nasipaddress, nasporttype, acctstarttime, acctupdatetime,
         acctauthentic, framedipaddress, acctstatus,
         acctinputoctets, acctoutputoctets, acctsessiontime,
         calledstationid, callingstationid, nasidentifier,
         "loginType", createdat, updatedat
       ) VALUES (
         $1, $2, $3,
         $4, 'Wireless-802.11', $5, $5,
         'PAP', $6, 'start',
         0, 0, 0,
         $9, $8, $10,
         $7, NOW(), NOW()
       )`,
      acctUniqueId,
      acctSessionId,
      username,
      localNas.nasIpAddress,
      now,
      clientIp,
      loginType,
      formattedMac,
      localNas.calledStationId,
      localNas.nasIdentifier || 'cryptsk-gateway'
    );

    console.log(`[AutoAuth] radacct session created for ${username} (loginType: ${loginType}, IP: ${clientIp}, MAC: ${formattedMac || 'N/A'})`);
    return acctSessionId;
  } catch (err) {
    // Non-fatal — accounting failure should not block auto-auth
    console.error('[AutoAuth] Failed to create accounting session:', err);
    return '';
  }
}
