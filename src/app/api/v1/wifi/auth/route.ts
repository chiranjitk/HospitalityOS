import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wifiUserService } from '@/lib/wifi/services/wifi-user-service';
import { randomUUID } from 'crypto';
import { radiusAuth, getRejectMessage } from '@/lib/wifi/utils/radius-auth';

// ────────────────────────────────────────────────────────────
// In-memory OTP store (sandbox — use Redis in production)
// ────────────────────────────────────────────────────────────
const otpStore = new Map<
  string,
  { code: string; expiresAt: number; phone: string }
>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ────────────────────────────────────────────────────────────
// IP Pool Validation Helpers
// ────────────────────────────────────────────────────────────

interface MatchedPool {
  poolId: string;
  poolName: string;
  subnet: string | null;
  gateway: string | null;
  captivePortal: boolean;
  isDefault: boolean;
}

/** Extract client IP from request headers (same logic as resolve-zone) */
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

/** Strip IPv6-mapped prefix and normalize to plain IPv4 */
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

/**
 * Validate that the client IP belongs to an allocated IP pool.
 * Uses PostgreSQL inet range comparison for accurate matching.
 * Returns the matched pool info or null if no pool found.
 *
 * Conditions checked:
 * 1. IP must fall within an IpPoolRange (startIp–endIp)
 * 2. The pool must be enabled
 * 3. The pool must have captivePortal = true (managed network)
 */
async function validateClientIpInPool(clientIp: string): Promise<MatchedPool | null> {
  try {
    const result = await db.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      subnet: string | null;
      gateway: string | null;
      captivePortal: boolean;
      "isDefault": boolean;
    }>>(`
      SELECT DISTINCT ON (ip.id)
        ip.id, ip.name, ip.subnet::text as subnet, ip.gateway::text as gateway,
        ip."captivePortal", ip."isDefault"
      FROM "IpPoolRange" r
      JOIN "IpPool" ip ON ip.id = r."poolId"
      WHERE $1::inet BETWEEN r."startIp" AND r."endIp"
        AND ip.enabled = true
      ORDER BY ip.id, ip."isDefault" DESC
      LIMIT 1
    `, clientIp);

    if (result.length === 0) return null;

    const pool = result[0];
    return {
      poolId: pool.id,
      poolName: pool.name,
      subnet: pool.subnet,
      gateway: pool.gateway,
      captivePortal: pool.captivePortal,
      isDefault: pool.isDefault,
    };
  } catch (err) {
    console.error('[IP Pool Validation] Query failed:', err);
    return null;
  }
}

/** Get client IP string for logging/accounting */
function getClientIpString(request: NextRequest): string {
  return extractClientIp(request) || request.headers.get('x-real-ip') || '0.0.0.0';
}

// ────────────────────────────────────────────────────────────
// POST /api/v1/wifi/auth — Guest WiFi authentication
//
// Validation order (changed per requirement):
//   1. Parse request body → extract username/method
//   2. Validate credentials (username, password, voucher, room, OTP)
//      → if invalid, log and return credential-specific error
//   3. Validate client IP against allocated IP pools
//      → if invalid, log and return IP error
//   4. Authenticate via FreeRADIUS
//   5. Log success + create accounting session
//
// This ensures auth logs show the CORRECT rejection reason:
//   Wrong password → "Rejected — invalid credentials"
//   Wrong network  → "Rejected — IP not in managed pool"
// ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ════════════════════════════════════════════════════════════
    // STEP 1: Parse request body — extract username & method first
    // ════════════════════════════════════════════════════════════
    const body = await request.json();
    const {
      method,
      portalSlug,
      voucherCode,
      roomNumber,
      lastName,
      username,
      password,
      phoneNumber,
      otpCode,
      guestInfo,
      macAddress,
    } = body as {
      method?: string;
      portalSlug?: string;
      voucherCode?: string;
      roomNumber?: string;
      lastName?: string;
      username?: string;
      password?: string;
      phoneNumber?: string;
      otpCode?: string;
      guestInfo?: { firstName?: string; lastName?: string; email?: string; phone?: string };
      macAddress?: string;
    };

    if (!method) {
      return errorResponse('MISSING_METHOD', 'Authentication method is required');
    }

    const validMethods = [
      'voucher',
      'room_number',
      'pms_credentials',
      'sms_otp',
      'open_access',
    ];

    if (!validMethods.includes(method)) {
      return errorResponse(
        'INVALID_METHOD',
        `Invalid authentication method. Supported: ${validMethods.join(', ')}`
      );
    }

    // Fetch portal config for session timeout & bandwidth info
    const portal = portalSlug
      ? await db.captivePortal.findFirst({
          where: { slug: portalSlug, enabled: true },
        })
      : null;

    const sessionTimeout = portal?.sessionTimeout ?? 1440; // minutes
    const bwDown = portal
      ? Math.round((portal.maxBandwidthDown || 5242880) / 1000000)
      : 5;
    const bwUp = portal
      ? Math.round((portal.maxBandwidthUp || 1048576) / 1000000)
      : 1;

    // ════════════════════════════════════════════════════════════
    // STEP 2: Validate credentials FIRST
    // Each method validates its own credentials here.
    // If invalid, we log and return immediately — NO IP check yet.
    // ════════════════════════════════════════════════════════════
    switch (method) {
      // ─── Voucher ──────────────────────────────────────────
      case 'voucher': {
        if (!voucherCode?.trim()) {
          return errorResponse('MISSING_VOUCHER', 'Please enter a voucher code');
        }

        const voucher = await db.wiFiVoucher.findUnique({
          where: { code: voucherCode.trim().toUpperCase() },
          include: { plan: true },
        });

        if (!voucher) {
          await logAuthAttempt(voucherCode.trim(), 'Access-Reject', request, 'INVALID_VOUCHER');
          return errorResponse('INVALID_VOUCHER', 'Invalid or expired voucher code');
        }

        if (voucher.status !== 'active' || voucher.isUsed) {
          await logAuthAttempt(`voucher-${voucher.code.toLowerCase()}`, 'Access-Reject', request, 'VOUCHER_USED');
          return errorResponse('VOUCHER_USED', 'This voucher has already been used');
        }

        const now = new Date();
        if (voucher.validUntil < now) {
          await logAuthAttempt(`voucher-${voucher.code.toLowerCase()}`, 'Access-Reject', request, 'VOUCHER_EXPIRED');
          return errorResponse('VOUCHER_EXPIRED', 'This voucher has expired. Please contact front desk for a new one.');
        }

        // ── Credentials valid — now check IP pool ──
        const pool = await getValidatedPool(request);
        if (!pool) {
          await logAuthAttempt(`voucher-${voucher.code.toLowerCase()}`, 'Access-Reject', request, `IP_NOT_IN_POOL:${getClientIpString(request)}`);
          return errorResponse('IP_NOT_IN_POOL', 'Your device is not connected to a managed WiFi network. Please connect to the hotel WiFi and try again.', 403);
        }

        // Mark voucher as used
        await db.wiFiVoucher.update({
          where: { id: voucher.id },
          data: { status: 'used', isUsed: true, usedAt: now },
        });

        // Resolve propertyId
        const resolvedPropertyId = voucher.plan?.propertyId
          || await db.property.findFirst({ where: { tenantId: voucher.tenantId }, select: { id: true } }).then(p => p?.id);

        if (!resolvedPropertyId) {
          return errorResponse('NO_PROPERTY', 'No property configured. Please contact front desk.');
        }

        const wifiUsername = `voucher-${voucher.code.toLowerCase()}`;
        const validUntil = new Date(now.getTime() + sessionTimeout * 60 * 1000);
        const downloadBps = bwDown * 1000000;
        const uploadBps = bwUp * 1000000;
        const dataLimitMb = voucher.plan?.dataLimit ?? undefined;

        await provisionOrResumeUser(wifiUsername, now, validUntil, {
          tenantId: voucher.tenantId,
          propertyId: resolvedPropertyId,
          guestId: voucher.guestId ?? undefined,
          bookingId: voucher.bookingId ?? undefined,
          username: wifiUsername,
          password: voucher.code,
          planId: voucher.planId ?? undefined,
          planName: voucher.plan?.name,
          downloadSpeed: downloadBps,
          uploadSpeed: uploadBps,
          sessionTimeoutMinutes: sessionTimeout,
          idleTimeoutSeconds: portal?.idleTimeout,
          sessionLimit: voucher.plan?.maxDevices,
          dataLimit: dataLimitMb,
        });

        const radiusResult = await radiusAuth(wifiUsername, voucher.code);
        if (!radiusResult.accepted) {
          await logAuthAttempt(wifiUsername, 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
          return errorResponse(radiusResult.rejectReason || 'AUTH_FAILED', getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'));
        }

        await logAuthAttempt(wifiUsername, 'Access-Accept', request, `pool:${pool.poolName}`);
        await createAccountingSession(wifiUsername, request, 'portal', macAddress, pool);

        return successResponse({
          authenticated: true, method: 'voucher', username: wifiUsername,
          sessionTimeout, bandwidthDown: bwDown, bandwidthUp: bwUp,
          poolName: pool.poolName, message: 'Connected successfully!',
        });
      }

      // ─── Room Number ──────────────────────────────────────
      case 'room_number': {
        if (!roomNumber?.trim()) {
          return errorResponse('MISSING_ROOM', 'Please enter your room number');
        }
        if (!lastName?.trim()) {
          return errorResponse('MISSING_NAME', 'Please enter your last name');
        }

        const bookings = await db.booking.findMany({
          where: { room: { roomNumber: roomNumber.trim().toUpperCase() }, status: 'in_house' },
          include: { primaryGuest: true, room: true },
          take: 10,
        });

        const match = bookings.find(
          (b) => b.primaryGuest.lastName.toLowerCase() === lastName.trim().toLowerCase()
        );

        if (!match) {
          await logAuthAttempt(`room-${roomNumber.trim().toLowerCase()}`, 'Access-Reject', request, 'INVALID_CREDENTIALS');
          return errorResponse('ROOM_NOT_FOUND', 'No active guest found for this room number and last name. Please verify and try again.');
        }

        // ── Credentials valid — now check IP pool ──
        const pool = await getValidatedPool(request);
        if (!pool) {
          await logAuthAttempt(`room-${roomNumber.trim().toLowerCase()}`, 'Access-Reject', request, `IP_NOT_IN_POOL:${getClientIpString(request)}`);
          return errorResponse('IP_NOT_IN_POOL', 'Your device is not connected to a managed WiFi network. Please connect to the hotel WiFi and try again.', 403);
        }

        const now = new Date();
        const validUntil = new Date(now.getTime() + sessionTimeout * 60 * 1000);
        const wifiUsername = `room-${match.room?.roomNumber?.toLowerCase() || roomNumber.trim().toLowerCase()}`;
        const userPassword = `${match.primaryGuest.lastName.toLowerCase()}-${match.id.slice(0, 8)}`;
        const downloadBps = bwDown * 1000000;
        const uploadBps = bwUp * 1000000;

        await provisionOrResumeUser(wifiUsername, now, validUntil, {
          tenantId: match.tenantId,
          propertyId: match.propertyId,
          guestId: match.primaryGuestId,
          bookingId: match.id,
          username: wifiUsername,
          password: userPassword,
          downloadSpeed: downloadBps,
          uploadSpeed: uploadBps,
          sessionTimeoutMinutes: sessionTimeout,
          idleTimeoutSeconds: portal?.idleTimeout,
        });

        const radiusResult = await radiusAuth(wifiUsername, userPassword);
        if (!radiusResult.accepted) {
          await logAuthAttempt(wifiUsername, 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
          return errorResponse(radiusResult.rejectReason || 'AUTH_FAILED', getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'));
        }

        await logAuthAttempt(wifiUsername, 'Access-Accept', request, `pool:${pool.poolName}`);
        await createAccountingSession(wifiUsername, request, 'portal', macAddress, pool);

        return successResponse({
          authenticated: true, method: 'room_number', username: wifiUsername,
          sessionTimeout, bandwidthDown: bwDown, bandwidthUp: bwUp,
          poolName: pool.poolName, message: 'Connected successfully!',
        });
      }

      // ─── PMS Credentials ──────────────────────────────────
      case 'pms_credentials': {
        if (!username?.trim()) {
          return errorResponse('MISSING_USERNAME', 'Please enter your username');
        }
        if (!password?.trim()) {
          return errorResponse('MISSING_PASSWORD', 'Please enter your password');
        }

        const wifiUser = await db.wiFiUser.findUnique({
          where: { username: username.trim() },
        });

        if (!wifiUser) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, 'INVALID_CREDENTIALS');
          return errorResponse('INVALID_CREDENTIALS', 'Invalid username or password');
        }

        if (wifiUser.password !== password.trim()) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, 'INVALID_CREDENTIALS');
          return errorResponse('INVALID_CREDENTIALS', 'Invalid username or password');
        }

        if (wifiUser.status !== 'active') {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, 'ACCOUNT_INACTIVE');
          return errorResponse('ACCOUNT_INACTIVE', 'Your WiFi account is not active. Please contact front desk.');
        }

        const now = new Date();
        if (wifiUser.validUntil < now) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, 'ACCOUNT_EXPIRED');
          return errorResponse('ACCOUNT_EXPIRED', 'Your WiFi session has expired. Please contact front desk to renew.');
        }

        // ── Credentials valid — now check IP pool ──
        const pool = await getValidatedPool(request);
        if (!pool) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, `IP_NOT_IN_POOL:${getClientIpString(request)}`);
          return errorResponse('IP_NOT_IN_POOL', 'Your device is not connected to a managed WiFi network. Please connect to the hotel WiFi and try again.', 403);
        }

        // Ensure RADIUS credentials exist
        const existingCheck = await db.radCheck.findFirst({
          where: { username: wifiUser.username },
        });
        if (!existingCheck) {
          try {
            await wifiUserService.resumeUser(wifiUser.id);
          } catch {
            // Best effort
          }
        }

        const radiusResult = await radiusAuth(username.trim(), password.trim());
        if (!radiusResult.accepted) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
          return errorResponse(radiusResult.rejectReason || 'AUTH_FAILED', getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'));
        }

        await logAuthAttempt(username.trim(), 'Access-Accept', request, `pool:${pool.poolName}`);
        await createAccountingSession(username.trim(), request, 'portal', macAddress, pool);

        return successResponse({
          authenticated: true, method: 'pms_credentials', username: wifiUser.username,
          sessionTimeout, bandwidthDown: bwDown, bandwidthUp: bwUp,
          poolName: pool.poolName, message: 'Connected successfully!',
        });
      }

      // ─── SMS OTP ──────────────────────────────────────────
      case 'sms_otp': {
        if (otpCode) {
          // ── Step 2: Verify OTP (credential check) ──
          if (!phoneNumber?.trim()) {
            return errorResponse('MISSING_PHONE', 'Phone number is required for OTP verification');
          }

          const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');
          const stored = otpStore.get(normalizedPhone);

          if (!stored) {
            return errorResponse('OTP_NOT_FOUND', 'No OTP found. Please request a new one.');
          }

          if (Date.now() > stored.expiresAt) {
            otpStore.delete(normalizedPhone);
            return errorResponse('OTP_EXPIRED', 'Your OTP has expired. Please request a new one.');
          }

          if (stored.code !== otpCode.trim()) {
            return errorResponse('OTP_INVALID', 'Invalid OTP code. Please try again.');
          }

          // ── OTP verified — check IP pool ──
          const pool = await getValidatedPool(request);
          if (!pool) {
            await logAuthAttempt(`sms-${normalizedPhone.replace(/[^a-z0-9]/gi, '')}`, 'Access-Reject', request, `IP_NOT_IN_POOL:${getClientIpString(request)}`);
            return errorResponse('IP_NOT_IN_POOL', 'Your device is not connected to a managed WiFi network. Please connect to the hotel WiFi and try again.', 403);
          }

          otpStore.delete(normalizedPhone);

          const now = new Date();
          const validUntil = new Date(now.getTime() + sessionTimeout * 60 * 1000);
          const wifiUsername = `sms-${normalizedPhone.replace(/[^a-z0-9]/gi, '')}`;
          const downloadBps = bwDown * 1000000;
          const uploadBps = bwUp * 1000000;

          const fallbackPropertyId = portal?.propertyId
            || await (portal?.tenantId
              ? db.property.findFirst({ where: { tenantId: portal.tenantId }, select: { id: true } }).then(p => p?.id)
              : Promise.resolve(undefined));

          if (fallbackPropertyId) {
            await provisionOrResumeUser(wifiUsername, now, validUntil, {
              tenantId: portal?.tenantId || '',
              propertyId: fallbackPropertyId,
              username: wifiUsername,
              password: stored.code,
              downloadSpeed: downloadBps,
              uploadSpeed: uploadBps,
              sessionTimeoutMinutes: sessionTimeout,
              idleTimeoutSeconds: portal?.idleTimeout,
            });

            const radiusResult = await radiusAuth(wifiUsername, stored.code);
            if (!radiusResult.accepted) {
              await logAuthAttempt(wifiUsername, 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
              return errorResponse(radiusResult.rejectReason || 'AUTH_FAILED', getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'));
            }

            await logAuthAttempt(wifiUsername, 'Access-Accept', request, `pool:${pool.poolName}`);
            await createAccountingSession(wifiUsername, request, 'portal', macAddress, pool);
          }

          return successResponse({
            authenticated: true, method: 'sms_otp', username: wifiUsername,
            sessionTimeout, bandwidthDown: bwDown, bandwidthUp: bwUp,
            poolName: pool.poolName, message: 'Connected successfully!',
          });
        } else {
          // ── Step 1: Send OTP (no credential check needed) ──
          if (!phoneNumber?.trim()) {
            return errorResponse('MISSING_PHONE', 'Please enter your phone number');
          }

          const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');
          const code = generateOtp();

          otpStore.set(normalizedPhone, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000,
            phone: normalizedPhone,
          });

          console.log(`[SMS OTP] Code for ${normalizedPhone}: ${code} (expires in 5 min)`);

          return NextResponse.json({
            success: true,
            data: {
              otpSent: true,
              message: 'OTP sent to your phone',
              ...(process.env.NODE_ENV === 'development' && { _debugOtp: code }),
            },
          });
        }
      }

      // ─── Open Access ──────────────────────────────────────
      // No credential validation needed — only IP pool check
      case 'open_access': {
        const pool = await getValidatedPool(request);
        if (!pool) {
          await logAuthAttempt('open-access', 'Access-Reject', request, `IP_NOT_IN_POOL:${getClientIpString(request)}`);
          return errorResponse('IP_NOT_IN_POOL', 'Your device is not connected to a managed WiFi network. Please connect to the hotel WiFi and try again.', 403);
        }

        const now = new Date();
        const validUntil = new Date(now.getTime() + sessionTimeout * 60 * 1000);
        let wifiUsername: string | null = null;

        if (portal) {
          const openTimestamp = Date.now();
          wifiUsername = `open-${openTimestamp}`;
          const openPassword = `open-${openTimestamp}`;
          const downloadBps = bwDown * 1000000;
          const uploadBps = bwUp * 1000000;

          try {
            const resolvedPropertyId = portal.propertyId
              || await db.property.findFirst({ where: { tenantId: portal.tenantId }, select: { id: true } }).then(p => p?.id);

            if (resolvedPropertyId) {
              await wifiUserService.provisionUser({
                tenantId: portal.tenantId,
                propertyId: resolvedPropertyId,
                username: wifiUsername,
                password: openPassword,
                validFrom: now,
                validUntil,
                userType: 'guest',
                downloadSpeed: downloadBps,
                uploadSpeed: uploadBps,
                sessionTimeoutMinutes: sessionTimeout,
                idleTimeoutSeconds: portal?.idleTimeout,
              });

              const radiusResult = await radiusAuth(wifiUsername, openPassword);
              if (!radiusResult.accepted) {
                await logAuthAttempt(wifiUsername, 'Access-Reject', request, radiusResult.rejectReason || 'AUTH_FAILED');
                return errorResponse(radiusResult.rejectReason || 'AUTH_FAILED', getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED'));
              }

              await logAuthAttempt(wifiUsername, 'Access-Accept', request, `pool:${pool.poolName}`);
              await createAccountingSession(wifiUsername, request, 'portal', macAddress, pool);
            }
          } catch {
            // Best effort for open access
          }
        }

        return successResponse({
          authenticated: true, method: 'open_access', username: wifiUsername,
          sessionTimeout, bandwidthDown: bwDown, bandwidthUp: bwUp,
          poolName: pool.poolName, message: 'Connected successfully!',
        });
      }

      default: {
        return errorResponse('INVALID_METHOD', 'Unsupported authentication method');
      }
    }
  } catch (error) {
    console.error('[Guest Auth API] Error:', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred. Please try again or contact front desk.');
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json({ success: true, data });
}

function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

/**
 * Validate client IP and check it belongs to an allocated pool.
 * Called AFTER credential validation, BEFORE RADIUS auth.
 * Returns the matched pool or null.
 */
async function getValidatedPool(request: NextRequest): Promise<MatchedPool | null> {
  const rawIp = extractClientIp(request);
  const clientIp = normalizeIp(rawIp);

  if (!clientIp) {
    console.warn('[Guest Auth] IP pool check: cannot determine client IP');
    return null;
  }

  const pool = await validateClientIpInPool(clientIp);
  if (!pool) {
    console.warn(`[Guest Auth] IP pool check REJECTED: ${clientIp} is not in any allocated IP pool`);
    return null;
  }

  console.log(`[Guest Auth] IP pool check PASSED: ${clientIp} → pool "${pool.poolName}" (${pool.subnet || 'no subnet'})`);
  return pool;
}

/**
 * Provision a RADIUS user, or resume an existing one if provisioning fails.
 * Reduces code duplication across auth methods.
 */
async function provisionOrResumeUser(
  wifiUsername: string,
  now: Date,
  validUntil: Date,
  params: {
    tenantId: string;
    propertyId: string;
    guestId?: string;
    bookingId?: string;
    username: string;
    password: string;
    planId?: string;
    planName?: string;
    downloadSpeed: number;
    uploadSpeed: number;
    sessionTimeoutMinutes: number;
    idleTimeoutSeconds?: number;
    sessionLimit?: number;
    dataLimit?: number;
  }
) {
  try {
    await wifiUserService.provisionUser(params);
  } catch (provisionErr) {
    console.error('[Guest Auth] RADIUS provisioning failed:', provisionErr);
    try {
      const existingUser = await db.wiFiUser.findUnique({ where: { username: wifiUsername } });
      if (existingUser) {
        await db.wiFiUser.update({
          where: { id: existingUser.id },
          data: {
            status: 'active',
            validFrom: now,
            validUntil,
            radiusSynced: true,
            radiusSyncedAt: now,
          },
        });
      }
    } catch {
      // Best effort
    }
  }
}

/**
 * Write an auth log to RadPostAuth table.
 * This feeds the v_auth_logs view → Auth Logs dashboard tab.
 *
 * IMPORTANT: We populate BOTH clientipaddress AND "nasIpAddress" columns.
 * - clientipaddress: the real client IP (from HTTP headers) — used by v_auth_logs
 *   to show "Source IP" in reject messages and the source_ip_address column.
 * - "nasIpAddress": also set to the client IP so the view's nas_ip_address column
 *   is populated even for application-level rejects (not just RADIUS rejects).
 * - pass: stores the rejection reason code (e.g., IP_NOT_IN_POOL:1.2.3.4,
 *   INVALID_CREDENTIALS, ACCOUNT_EXPIRED) so v_auth_logs can build descriptive
 *   reply_message strings.
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

    await db.$executeRawUnsafe(
      `INSERT INTO radpostauth (username, pass, reply, authdate, clientipaddress, "nasIpAddress")
       VALUES ($1, $2, $3, NOW(), $4, $4)`,
      username,
      extraInfo || '',
      reply,
      clientIp,
    );
  } catch (err) {
    // Non-fatal — auth logging failure should not block authentication
    console.error('[Guest Auth] Failed to write auth log:', err);
  }
}

/**
 * Create an accounting session in RadAcct table.
 * This feeds the v_active_sessions view → Active Users dashboard tab.
 *
 * The session is marked as 'start' with no stop time (acctstoptime = NULL),
 * which is how FreeRADIUS represents an active session.
 *
 * @param loginType - 'portal' for manual login, 'auto_reauth' for silent re-auth
 */
async function createAccountingSession(
  username: string,
  request: NextRequest,
  loginType: string = 'portal',
  macAddress?: string,
  pool?: MatchedPool | null
) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '0.0.0.0';

    const now = new Date();
    const acctSessionId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const acctUniqueId = randomUUID();

    // Normalize MAC address format: strip separators, uppercase
    const normalizedMac = macAddress
      ? macAddress.replace(/[:\-\.\s]/g, '').toUpperCase()
      : null;
    // Reformat as AA:BB:CC:DD:EE:FF for RADIUS compatibility
    const formattedMac = normalizedMac && normalizedMac.length === 12
      ? normalizedMac.match(/.{2}/g)?.join(':') || null
      : null;

    // Build connect-info with pool details for audit trail
    const connectInfoStart = pool
      ? `pool_id=${pool.poolId}|pool_name=${pool.poolName}|subnet=${pool.subnet || 'none'}|gateway=${pool.gateway || 'none'}`
      : '';

    await db.$executeRawUnsafe(
      `INSERT INTO radacct (
         acctuniqueid, acctsessionid, username,
         nasipaddress, nasporttype, acctstarttime, acctupdatetime,
         acctauthentic, framedipaddress, acctstatus,
         acctinputoctets, acctoutputoctets, acctsessiontime,
         calledstationid, callingstationid,
         "loginType", connectinfo_start, "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3,
         $4, 'Wireless-802.11', $5, $5,
         'PAP', $6, 'start',
         0, 0, 0,
         '00:00:00:00:00:01', $8,
         $7, $9, NOW(), NOW()
       )`,
      acctUniqueId,
      acctSessionId,
      username,
      '127.0.0.1', // NAS IP (this device is the gateway)
      now,
      clientIp,
      loginType,
      formattedMac,
      connectInfoStart
    );
  } catch (err) {
    // Non-fatal — accounting failure should not block authentication
    console.error('[Guest Auth] Failed to create accounting session:', err);
  }
}
