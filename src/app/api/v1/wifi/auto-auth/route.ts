import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const { fingerprintHash, storageToken, portalSlug } = body as {
      fingerprintHash?: string;
      storageToken?: string;
      portalSlug?: string;
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
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true } },
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
              plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, validityDays: true } },
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
        macAddress: deviceProfile.macAddress || null, // Keep existing MAC from RADIUS
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

      // Re-create bandwidth limits from plan (downloadSpeed/uploadSpeed in Mbps → Kbps)
      const downKbps = (wifiUser.plan?.downloadSpeed || 0) * 1000;
      const upKbps = (wifiUser.plan?.uploadSpeed || 0) * 1000;
      if (downKbps > 0) {
        await db.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Mikrotik-Rate-Limit',
            op: ':=',
            value: `${downKbps}k/${upKbps || downKbps}k`,
            priority: 20,
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
