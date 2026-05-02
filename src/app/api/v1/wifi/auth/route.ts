import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wifiUserService } from '@/lib/wifi/services/wifi-user-service';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

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
// POST /api/v1/wifi/auth — Guest WiFi authentication
//
// After successful authentication, this route:
// 1. Provisions RADIUS credentials (RadCheck, RadReply, RadUserGroup)
//    via wifiUserService — FreeRADIUS reads these tables directly.
// 2. Writes an auth log to RadPostAuth (for Auth Logs dashboard tab).
// 3. Creates an accounting session in RadAcct (for Active Users tab).
// ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
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

    switch (method) {
      // ─── Voucher ──────────────────────────────────────────
      case 'voucher': {
        if (!voucherCode?.trim()) {
          return errorResponse(
            'MISSING_VOUCHER',
            'Please enter a voucher code'
          );
        }

        const voucher = await db.wiFiVoucher.findUnique({
          where: { code: voucherCode.trim().toUpperCase() },
          include: { plan: true },
        });

        if (!voucher) {
          // Log failed auth attempt
          await logAuthAttempt(voucherCode.trim(), 'Access-Reject', request);
          return errorResponse(
            'INVALID_VOUCHER',
            'Invalid or expired voucher code'
          );
        }

        if (voucher.status !== 'active' || voucher.isUsed) {
          await logAuthAttempt(`voucher-${voucher.code.toLowerCase()}`, 'Access-Reject', request);
          return errorResponse(
            'VOUCHER_USED',
            'This voucher has already been used'
          );
        }

        const now = new Date();
        if (voucher.validUntil < now) {
          await logAuthAttempt(`voucher-${voucher.code.toLowerCase()}`, 'Access-Reject', request);
          return errorResponse(
            'VOUCHER_EXPIRED',
            'This voucher has expired. Please contact front desk for a new one.'
          );
        }

        // Mark voucher as used
        await db.wiFiVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'used',
            isUsed: true,
            usedAt: now,
          },
        });

        // Resolve a valid propertyId (required FK — must exist in Property table)
        const resolvedPropertyId = voucher.plan?.propertyId
          || await db.property.findFirst({
              where: { tenantId: voucher.tenantId },
              select: { id: true },
            }).then(p => p?.id);

        if (!resolvedPropertyId) {
          return errorResponse(
            'NO_PROPERTY',
            'No property configured. Please contact front desk.'
          );
        }

        const wifiUsername = `voucher-${voucher.code.toLowerCase()}`;
        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );

        // ── Provision RADIUS credentials ──
        const downloadBps = bwDown * 1000000;
        const uploadBps = bwUp * 1000000;
        const dataLimitMb = voucher.plan?.dataLimit ?? undefined;

        try {
          await wifiUserService.provisionUser({
            tenantId: voucher.tenantId,
            propertyId: resolvedPropertyId,
            guestId: voucher.guestId ?? undefined,
            bookingId: voucher.bookingId ?? undefined,
            username: wifiUsername,
            password: voucher.code,
            planId: voucher.planId ?? undefined,
            planName: voucher.plan?.name,
            validFrom: now,
            validUntil,
            userType: 'guest',
            downloadSpeed: downloadBps,
            uploadSpeed: uploadBps,
            sessionTimeoutMinutes: sessionTimeout,
            idleTimeoutSeconds: portal?.idleTimeout,
            sessionLimit: voucher.plan?.maxDevices,
            dataLimit: dataLimitMb,
          });
        } catch (provisionErr) {
          console.error('[Guest Auth] RADIUS provisioning failed:', provisionErr);
          // User may already exist — try to update
          try {
            const existingUser = await db.wiFiUser.findUnique({
              where: { username: wifiUsername },
            });
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

        // ── Authenticate via FreeRADIUS ──
        const radiusResult = await radiusAuth(wifiUsername, voucher.code);
        if (!radiusResult.accepted) {
          await logAuthAttempt(wifiUsername, 'Access-Reject', request);
          return errorResponse(
            radiusResult.rejectReason || 'AUTH_FAILED',
            getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED')
          );
        }

        // ── Log auth attempt (for Auth Logs tab) ──
        await logAuthAttempt(wifiUsername, 'Access-Accept', request);

        // ── Create accounting session (for Active Users tab) ──
        await createAccountingSession(wifiUsername, request, 'portal', macAddress);

        return successResponse({
          authenticated: true,
          method: 'voucher',
          username: wifiUsername,
          sessionTimeout,
          bandwidthDown: bwDown,
          bandwidthUp: bwUp,
          message: 'Connected successfully!',
        });
      }

      // ─── Room Number ──────────────────────────────────────
      case 'room_number': {
        if (!roomNumber?.trim()) {
          return errorResponse(
            'MISSING_ROOM',
            'Please enter your room number'
          );
        }
        if (!lastName?.trim()) {
          return errorResponse(
            'MISSING_NAME',
            'Please enter your last name'
          );
        }

        // Find an active booking for this room with matching guest last name
        const bookings = await db.booking.findMany({
          where: {
            room: {
              roomNumber: roomNumber.trim().toUpperCase(),
            },
            status: 'in_house',
          },
          include: {
            primaryGuest: true,
            room: true,
          },
          take: 10,
        });

        const match = bookings.find(
          (b) =>
            b.primaryGuest.lastName.toLowerCase() ===
            lastName.trim().toLowerCase()
        );

        if (!match) {
          await logAuthAttempt(`room-${roomNumber.trim().toLowerCase()}`, 'Access-Reject', request);
          return errorResponse(
            'ROOM_NOT_FOUND',
            'No active guest found for this room number and last name. Please verify and try again.'
          );
        }

        const now = new Date();
        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );

        const wifiUsername = `room-${match.room?.roomNumber?.toLowerCase() || roomNumber.trim().toLowerCase()}`;
        const userPassword = `${match.primaryGuest.lastName.toLowerCase()}-${match.id.slice(0, 8)}`;
        const downloadBps = bwDown * 1000000;
        const uploadBps = bwUp * 1000000;

        // ── Provision RADIUS credentials ──
        try {
          await wifiUserService.provisionUser({
            tenantId: match.tenantId,
            propertyId: match.propertyId,
            guestId: match.primaryGuestId,
            bookingId: match.id,
            username: wifiUsername,
            password: userPassword,
            validFrom: now,
            validUntil,
            userType: 'guest',
            downloadSpeed: downloadBps,
            uploadSpeed: uploadBps,
            sessionTimeoutMinutes: sessionTimeout,
            idleTimeoutSeconds: portal?.idleTimeout,
          });
        } catch (provisionErr) {
          console.error('[Guest Auth] RADIUS provisioning failed:', provisionErr);
          try {
            const existingUser = await db.wiFiUser.findUnique({
              where: { username: wifiUsername },
            });
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

        // ── Authenticate via FreeRADIUS ──
        const radiusResult = await radiusAuth(wifiUsername, userPassword);
        if (!radiusResult.accepted) {
          await logAuthAttempt(wifiUsername, 'Access-Reject', request);
          return errorResponse(
            radiusResult.rejectReason || 'AUTH_FAILED',
            getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED')
          );
        }

        // ── Log auth attempt ──
        await logAuthAttempt(wifiUsername, 'Access-Accept', request);

        // ── Create accounting session ──
        await createAccountingSession(wifiUsername, request, 'portal', macAddress);

        return successResponse({
          authenticated: true,
          method: 'room_number',
          username: wifiUsername,
          sessionTimeout,
          bandwidthDown: bwDown,
          bandwidthUp: bwUp,
          message: 'Connected successfully!',
        });
      }

      // ─── PMS Credentials ──────────────────────────────────
      case 'pms_credentials': {
        if (!username?.trim()) {
          return errorResponse(
            'MISSING_USERNAME',
            'Please enter your username'
          );
        }
        if (!password?.trim()) {
          return errorResponse(
            'MISSING_PASSWORD',
            'Please enter your password'
          );
        }

        const wifiUser = await db.wiFiUser.findUnique({
          where: { username: username.trim() },
        });

        if (!wifiUser) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request);
          return errorResponse(
            'INVALID_CREDENTIALS',
            'Invalid username or password'
          );
        }

        if (wifiUser.password !== password.trim()) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request);
          return errorResponse(
            'INVALID_CREDENTIALS',
            'Invalid username or password'
          );
        }

        if (wifiUser.status !== 'active') {
          await logAuthAttempt(username.trim(), 'Access-Reject', request);
          return errorResponse(
            'ACCOUNT_INACTIVE',
            'Your WiFi account is not active. Please contact front desk.'
          );
        }

        const now = new Date();
        if (wifiUser.validUntil < now) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request);
          return errorResponse(
            'ACCOUNT_EXPIRED',
            'Your WiFi session has expired. Please contact front desk to renew.'
          );
        }

        // Ensure RADIUS credentials exist (user might not have been provisioned)
        const existingCheck = await db.radCheck.findFirst({
          where: { username: wifiUser.username },
        });
        if (!existingCheck) {
          try {
            await wifiUserService.resumeUser(wifiUser.id);
          } catch {
            // Best effort — user already has valid WiFiUser record
          }
        }

        // ── Authenticate via FreeRADIUS ──
        const radiusResult = await radiusAuth(username.trim(), password.trim());
        if (!radiusResult.accepted) {
          await logAuthAttempt(username.trim(), 'Access-Reject', request);
          return errorResponse(
            radiusResult.rejectReason || 'AUTH_FAILED',
            getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED')
          );
        }

        // ── Log auth attempt ──
        await logAuthAttempt(username.trim(), 'Access-Accept', request);

        // ── Create accounting session ──
        await createAccountingSession(username.trim(), request, 'portal', macAddress);

        return successResponse({
          authenticated: true,
          method: 'pms_credentials',
          username: wifiUser.username,
          sessionTimeout,
          bandwidthDown: bwDown,
          bandwidthUp: bwUp,
          message: 'Connected successfully!',
        });
      }

      // ─── SMS OTP ──────────────────────────────────────────
      case 'sms_otp': {
        if (otpCode) {
          // ── Step 2: Verify OTP ──
          if (!phoneNumber?.trim()) {
            return errorResponse(
              'MISSING_PHONE',
              'Phone number is required for OTP verification'
            );
          }

          const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');
          const stored = otpStore.get(normalizedPhone);

          if (!stored) {
            return errorResponse(
              'OTP_NOT_FOUND',
              'No OTP found. Please request a new one.'
            );
          }

          if (Date.now() > stored.expiresAt) {
            otpStore.delete(normalizedPhone);
            return errorResponse(
              'OTP_EXPIRED',
              'Your OTP has expired. Please request a new one.'
            );
          }

          if (stored.code !== otpCode.trim()) {
            return errorResponse(
              'OTP_INVALID',
              'Invalid OTP code. Please try again.'
            );
          }

          // OTP verified — clean up
          otpStore.delete(normalizedPhone);

          const now = new Date();
          const validUntil = new Date(
            now.getTime() + sessionTimeout * 60 * 1000
          );

          const wifiUsername = `sms-${normalizedPhone.replace(/[^a-z0-9]/gi, '')}`;
          const downloadBps = bwDown * 1000000;
          const uploadBps = bwUp * 1000000;

          // Get any property from the portal
          const fallbackPropertyId = portal?.propertyId
            || await (portal?.tenantId
              ? db.property.findFirst({ where: { tenantId: portal.tenantId }, select: { id: true } }).then(p => p?.id)
              : Promise.resolve(undefined));

          if (fallbackPropertyId) {
            // ── Provision RADIUS credentials ──
            try {
              await wifiUserService.provisionUser({
                tenantId: portal?.tenantId || '',
                propertyId: fallbackPropertyId,
                username: wifiUsername,
                password: stored.code,
                validFrom: now,
                validUntil,
                userType: 'guest',
                downloadSpeed: downloadBps,
                uploadSpeed: uploadBps,
                sessionTimeoutMinutes: sessionTimeout,
                idleTimeoutSeconds: portal?.idleTimeout,
              });
            } catch (provisionErr) {
              console.error('[Guest Auth] RADIUS provisioning failed:', provisionErr);
              try {
                const existingUser = await db.wiFiUser.findUnique({
                  where: { username: wifiUsername },
                });
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

            // ── Authenticate via FreeRADIUS ──
            const radiusResult = await radiusAuth(wifiUsername, stored.code);
            if (!radiusResult.accepted) {
              await logAuthAttempt(wifiUsername, 'Access-Reject', request);
              return errorResponse(
                radiusResult.rejectReason || 'AUTH_FAILED',
                getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED')
              );
            }

            // ── Log auth attempt ──
            await logAuthAttempt(wifiUsername, 'Access-Accept', request);

            // ── Create accounting session ──
            await createAccountingSession(wifiUsername, request, 'portal', macAddress);
          }

          return successResponse({
            authenticated: true,
            method: 'sms_otp',
            username: wifiUsername,
            sessionTimeout,
            bandwidthDown: bwDown,
            bandwidthUp: bwUp,
            message: 'Connected successfully!',
          });
        } else {
          // ── Step 1: Send OTP ──
          if (!phoneNumber?.trim()) {
            return errorResponse(
              'MISSING_PHONE',
              'Please enter your phone number'
            );
          }

          const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');
          const code = generateOtp();

          // Store OTP with 5-minute expiry
          otpStore.set(normalizedPhone, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000,
            phone: normalizedPhone,
          });

          // In production, send the OTP via SMS here.
          // For the sandbox, we just return success (OTP is logged).
          console.log(
            `[SMS OTP] Code for ${normalizedPhone}: ${code} (expires in 5 min)`
          );

          return NextResponse.json({
            success: true,
            data: {
              otpSent: true,
              message: 'OTP sent to your phone',
              // In sandbox, include the code for testing convenience
              ...(process.env.NODE_ENV === 'development' && {
                _debugOtp: code,
              }),
            },
          });
        }
      }

      // ─── Open Access ──────────────────────────────────────
      case 'open_access': {
        const now = new Date();
        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );
        let wifiUsername: string | null = null;

        if (portal) {
          const openTimestamp = Date.now();
          wifiUsername = `open-${openTimestamp}`;
          const openPassword = `open-${openTimestamp}`;
          const downloadBps = bwDown * 1000000;
          const uploadBps = bwUp * 1000000;

          try {
            // Resolve a valid propertyId (portal.propertyId may be null)
            const resolvedPropertyId = portal.propertyId
              || await db.property.findFirst({
                  where: { tenantId: portal.tenantId },
                  select: { id: true },
                }).then(p => p?.id);

            if (resolvedPropertyId) {
              // ── Provision RADIUS credentials ──
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

              // ── Authenticate via FreeRADIUS ──
              const radiusResult = await radiusAuth(wifiUsername, openPassword);
              if (!radiusResult.accepted) {
                await logAuthAttempt(wifiUsername, 'Access-Reject', request);
                return errorResponse(
                  radiusResult.rejectReason || 'AUTH_FAILED',
                  getRejectMessage(radiusResult.rejectReason || 'AUTH_FAILED')
                );
              }

              // ── Log auth attempt ──
              await logAuthAttempt(wifiUsername, 'Access-Accept', request);

              // ── Create accounting session ──
              await createAccountingSession(wifiUsername, request, 'portal', macAddress);
            }
          } catch {
            // Ignore — best effort for open access
          }
        }

        return successResponse({
          authenticated: true,
          method: 'open_access',
          username: wifiUsername,
          sessionTimeout,
          bandwidthDown: bwDown,
          bandwidthUp: bwUp,
          message: 'Connected successfully!',
        });
      }

      default: {
        return errorResponse(
          'INVALID_METHOD',
          'Unsupported authentication method'
        );
      }
    }
  } catch (error) {
    console.error('[Guest Auth API] Error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again or contact front desk.'
    );
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Send a RADIUS Access-Request via radclient to FreeRADIUS on localhost.
 * This runs ALL authorization checks (sql module reads radcheck, checks
 * Simultaneous-Use via fn_check_login_limit, expiration, etc.).
 */
async function radiusAuth(username: string, password: string): Promise<{
  accepted: boolean;
  replyAttrs: Record<string, string>;
  rejectReason?: string;
}> {
  try {
    const radclientBin = '/home/z/my-project/freeradius-install/bin/radclient';
    const raddbDir = '/home/z/my-project/freeradius-install/etc/raddb';
    const dictDir = '/home/z/my-project/freeradius-install/share/freeradius';
    const libDir = '/home/z/my-project/freeradius-install/lib';

    // radclient needs LD_LIBRARY_PATH for shared libs and -D for dictionary path
    const radclientCmd = [
      `export LD_LIBRARY_PATH=${libDir}:$LD_LIBRARY_PATH`,
      `echo "User-Name = '${username.replace(/'/g, "'\\''")}', User-Password = '${password.replace(/'/g, "'\\''")}', NAS-IP-Address = 127.0.0.1, NAS-Port = 0, NAS-Port-Type = Wireless-802.11, Called-Station-Id = '00:00:00:00:00:01'" |`,
      `${radclientBin} -D ${dictDir} -x 127.0.0.1 auth testing123 3`,
    ].join(' ');

    const output = execSync(radclientCmd, {
      encoding: 'utf-8',
      timeout: 5000,
      cwd: raddbDir,
      env: { ...process.env, LD_LIBRARY_PATH: `${libDir}:${process.env.LD_LIBRARY_PATH || ''}` },
    });

    // Parse radclient output — look for "Received Access-Accept" or "Received Access-Reject"
    const accepted = output.includes('Received Access-Accept');
    const rejected = output.includes('Received Access-Reject');

    if (accepted) {
      const replyAttrs: Record<string, string> = {};
      const lines = output.split('\n');
      for (const line of lines) {
        // Match reply attributes after "Received Access-Accept" block
        const match = line.match(/^\s+(\S+)\s*=\s*(.+)$/);
        if (match && match[1] !== 'Message-Authenticator') {
          replyAttrs[match[1]] = match[2].trim().replace(/^"(.*)"$/, '$1');
        }
      }
      return { accepted: true, replyAttrs };
    }

    let rejectReason = 'AUTH_FAILED';
    if (rejected) {
      if (output.includes('Simultaneous-Use') || output.includes('simul_count')) rejectReason = 'MAX_SESSIONS_REACHED';
      else if (output.includes('Expiration') || output.includes('expired')) rejectReason = 'ACCOUNT_EXPIRED';
      else rejectReason = 'INVALID_CREDENTIALS';
    }

    return { accepted: false, replyAttrs: {}, rejectReason };
  } catch (err) {
    console.error('[RADIUS Auth] radclient error:', err);
    return { accepted: false, replyAttrs: {}, rejectReason: 'RADIUS_UNREACHABLE' };
  }
}

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json({ success: true, data });
}

function getRejectMessage(code: string): string {
  const messages: Record<string, string> = {
    MAX_SESSIONS_REACHED: 'Maximum concurrent sessions reached. Please disconnect another device first.',
    ACCOUNT_EXPIRED: 'Your WiFi session has expired. Please contact front desk to renew.',
    INVALID_CREDENTIALS: 'Authentication failed. Please verify your credentials and try again.',
    RADIUS_UNREACHABLE: 'Network authentication service is temporarily unavailable. Please try again.',
    AUTH_FAILED: 'Authentication failed. Please try again or contact front desk.',
  };
  return messages[code] || messages.AUTH_FAILED;
}

function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

/**
 * Write an auth log to RadPostAuth table.
 * This feeds the v_auth_logs view → Auth Logs dashboard tab.
 */
async function logAuthAttempt(
  username: string,
  reply: string,
  request: NextRequest
) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '';

    await db.$executeRawUnsafe(
      `INSERT INTO radpostauth (username, pass, reply, authdate, clientipaddress)
       VALUES ($1, '', $2, NOW(), $3)`,
      username,
      reply,
      clientIp
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
  macAddress?: string
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
  } catch (err) {
    // Non-fatal — accounting failure should not block authentication
    console.error('[Guest Auth] Failed to create accounting session:', err);
  }
}
