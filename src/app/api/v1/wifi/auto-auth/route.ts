import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { radiusAuth, getRejectMessage } from '@/lib/wifi/utils/radius-auth';

// ────────────────────────────────────────────────────────────
// IP Pool Validation Helpers (shared with wifi/auth)
// ────────────────────────────────────────────────────────────

function extractClientIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  return null;
}

function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }
  const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Match) return v4Match[1];
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;
  return null;
}

async function validateClientIpInPool(
  clientIp: string,
  allowedPoolIds?: string[] | null
): Promise<{ poolId: string; poolName: string } | null> {
  try {
    // Build pool restriction clause when plan is bound to specific pools
    const poolFilter = (allowedPoolIds && allowedPoolIds.length > 0)
      ? `AND ip.id = ANY($2::uuid[])`
      : '';

    const params: unknown[] = [clientIp];
    if (allowedPoolIds && allowedPoolIds.length > 0) {
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
 * 1. WiFiPlan.ipPoolId — plan explicitly bound to a pool
 * 2. WiFiUser.ipPoolId — user-level override
 * 3. null — no restriction, any captive portal pool allowed
 *
 * Returns an array of pool UUIDs, or null if unrestricted.
 */
function resolveAllowedPoolIds(
  planIpPoolId?: string | null,
  userIpPoolId?: string | null
): string[] | null {
  // User-level override takes priority over plan-level
  if (userIpPoolId) return [userIpPoolId];
  if (planIpPoolId) return [planIpPoolId];
  return null; // No restriction
}

// ────────────────────────────────────────────────────────────────
// POST /api/v1/wifi/auto-auth
//
// Silent re-authentication for returning devices.
//
// Flow:
//   1. Receive fingerprintHash + optional storageToken + portalSlug
//   2. Look up DeviceProfile by storageToken (most reliable) OR fingerprintHash
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

    // ── Validate required fields ──
    if (!fingerprintHash) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FINGERPRINT', message: 'Device fingerprint is required' } },
        { status: 400 }
      );
    }

    // ── Resolve property from portal slug ──
    let propertyId: string | null = null;
    let tenantId: string | null = null;

    if (portalSlug) {
      const portal = await db.captivePortal.findUnique({
        where: { slug: portalSlug },
        select: { propertyId: true, tenantId: true },
      });
      if (portal) {
        propertyId = portal.propertyId;
        tenantId = portal.tenantId;
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
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true, validityMinutes: true, ipPoolId: true } },
              property: { select: { id: true, name: true, tenantId: true } },
            },
          },
        },
      });
    }

    // Strategy 2: Match by fingerprintHash (fallback when storage cleared)
    if (!deviceProfile) {
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
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true, validityMinutes: true, ipPoolId: true } },
              property: { select: { id: true, name: true, tenantId: true } },
            },
          },
        },
      });
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
            const clientIp =
              request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
              request.headers.get('x-real-ip') ||
              'unknown';
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

    // ── Update DeviceProfile stats ──
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
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

      // Re-create session timeout from WiFiUser validity period
      const sessionTimeoutSec = Math.floor((new Date(wifiUser.validUntil).getTime() - now.getTime()) / 1000);
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

    // ── IP Pool Validation: reject auto-auth from unmanaged networks ──
    // Only devices on allocated pool IPs can silently re-authenticate.
    // Also enforces plan→pool binding (same as manual auth route).
    const autoAuthRawIp = extractClientIp(request);
    const autoAuthClientIp = normalizeIp(autoAuthRawIp);

    if (autoAuthClientIp) {
      const allowedPools = resolveAllowedPoolIds(
        wifiUser.plan?.ipPoolId,
        wifiUser.ipPoolId as string | null | undefined
      );
      const poolMatch = await validateClientIpInPool(autoAuthClientIp, allowedPools);
      if (!poolMatch) {
        const poolInfo = allowedPools?.length
          ? `allowed: [${allowedPools.join(', ')}]`
          : 'any pool';
        console.warn(`[AutoAuth] IP pool check REJECTED: ${autoAuthClientIp} is not in ${poolInfo}`);
        return NextResponse.json(
          { success: false, error: { code: 'IP_NOT_IN_POOL', message: 'Your device is not on the correct WiFi network for your plan. Please connect to the appropriate network.' } },
          { status: 403 }
        );
      }
      console.log(`[AutoAuth] IP pool check PASSED: ${autoAuthClientIp} → pool "${poolMatch.poolName}"${allowedPools?.length ? ' [plan-restricted]' : ''}`);
    }

    // ── Close any existing active radacct session for this user ──
    // Must do this BEFORE calling radiusAuth so that the Simultaneous-Use
    // check does not count the stale session against the user.
    try {
      await db.$executeRawUnsafe(
        `UPDATE radacct SET acctstoptime = NOW(), acctterminatecause = 'User-Request', acctstatus = 'stop', acctupdatetime = NOW(), "updatedAt" = NOW() WHERE username = $1 AND acctstoptime IS NULL`,
        wifiUser.username
      );
    } catch (closeErr) {
      console.warn('[AutoAuth] Failed to close existing sessions (non-critical):', closeErr);
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

    // ── Create radacct accounting session (for Active Users tab) ──
    // The v_active_sessions view shows rows where acctstoptime IS NULL.
    // Without this, auto-auth users appear "connected" on the portal
    // but never show up in the admin Active Users dashboard.
    await createAccountingSession(wifiUser.username, clientIp, request, 'auto_reauth', macAddress);

    // ── Calculate remaining time ──
    const validUntil = new Date(wifiUser.validUntil);
    const remainingMs = validUntil.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));

    // ── Success! Silent re-auth complete ──
    return NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        method: 'auto_auth',
        username: wifiUser.username,
        planName: wifiUser.plan?.name || null,
        planValidityDays: wifiUser.plan?.validityDays || null,
        bandwidthDown: wifiUser.plan?.downloadSpeed || null,
        bandwidthUp: wifiUser.plan?.uploadSpeed || null,
        remainingMinutes,
        message: 'Welcome back! Connected automatically.',
        deviceProfileId: deviceProfile.id,
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
async function logAuthAttempt(
  username: string,
  reply: string,
  request: NextRequest,
  extraInfo?: string
) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '';

    // clientipaddress = real client IP (from HTTP headers)
    // "nasIpAddress" = 127.0.0.1 for captive portal (the app itself IS the NAS)
    await db.$executeRawUnsafe(
      `INSERT INTO radpostauth (username, pass, reply, authdate, clientipaddress, "nasIpAddress")
       VALUES ($1, $2, $3, NOW(), $4, '127.0.0.1')`,
      username,
      extraInfo || '',
      reply,
      clientIp
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
  macAddress?: string
) {
  try {
    const acctSessionId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const acctUniqueId = randomUUID();
    const now = new Date();

    // Normalize MAC address format
    const normalizedMac = macAddress
      ? macAddress.replace(/[:\-\.\s]/g, '').toUpperCase()
      : null;
    const formattedMac = normalizedMac && normalizedMac.length === 12
      ? normalizedMac.match(/.{2}/g)?.join(':') || null
      : null;

    await db.$executeRawUnsafe(
      `INSERT INTO radacct (
         acctuniqueid, acctsessionid, username,
         nasipaddress, nasporttype, acctstarttime, acctupdatetime,
         acctauthentic, framedipaddress, acctstatus,
         acctinputoctets, acctoutputoctets, acctsessiontime,
         calledstationid, callingstationid,
         "loginType", "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3,
         $4, 'Wireless-802.11', $5, $5,
         'PAP', $6, 'start',
         0, 0, 0,
         '00:00:00:00:00:01', $8,
         $7, NOW(), NOW()
       )`,
      acctUniqueId,
      acctSessionId,
      username,
      '127.0.0.1', // NAS IP (this device is the gateway)
      now,
      clientIp,
      loginType,
      formattedMac
    );

    console.log(`[AutoAuth] radacct session created for ${username} (loginType: ${loginType}, IP: ${clientIp}, MAC: ${formattedMac || 'N/A'})`);
  } catch (err) {
    // Non-fatal — accounting failure should not block auto-auth
    console.error('[AutoAuth] Failed to create accounting session:', err);
  }
}
