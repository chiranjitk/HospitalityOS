import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
          return errorResponse(
            'INVALID_VOUCHER',
            'Invalid or expired voucher code'
          );
        }

        if (voucher.status !== 'active' || voucher.isUsed) {
          return errorResponse(
            'VOUCHER_USED',
            'This voucher has already been used'
          );
        }

        const now = new Date();
        if (voucher.validUntil < now) {
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

        // Create a WiFi user for RADIUS
        const wifiUsername = `voucher-${voucher.code.toLowerCase()}`;
        const existingUser = await db.wiFiUser.findUnique({
          where: { username: wifiUsername },
        });

        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );

        if (existingUser) {
          await db.wiFiUser.update({
            where: { id: existingUser.id },
            data: {
              status: 'active',
              validFrom: now,
              validUntil,
              radiusSynced: false,
            },
          });
        } else {
          await db.wiFiUser.create({
            data: {
              tenantId: voucher.tenantId,
              propertyId: voucher.plan?.propertyId || voucher.tenantId,
              username: wifiUsername,
              password: voucher.code,
              guestId: voucher.guestId,
              bookingId: voucher.bookingId,
              planId: voucher.planId,
              validFrom: now,
              validUntil,
              status: 'active',
            },
          });
        }

        return successResponse({
          authenticated: true,
          method: 'voucher',
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
          return errorResponse(
            'ROOM_NOT_FOUND',
            'No active guest found for this room number and last name. Please verify and try again.'
          );
        }

        // Create or activate a WiFi user
        const wifiUsername = `room-${match.room?.roomNumber?.toLowerCase() || roomNumber.trim().toLowerCase()}`;
        const now = new Date();
        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );

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
              radiusSynced: false,
            },
          });
        } else {
          await db.wiFiUser.create({
            data: {
              tenantId: match.tenantId,
              propertyId: match.propertyId,
              username: wifiUsername,
              password: `${match.primaryGuest.lastName.toLowerCase()}-${match.id.slice(0, 8)}`,
              guestId: match.primaryGuestId,
              bookingId: match.id,
              validFrom: now,
              validUntil,
              status: 'active',
            },
          });
        }

        return successResponse({
          authenticated: true,
          method: 'room_number',
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
          return errorResponse(
            'INVALID_CREDENTIALS',
            'Invalid username or password'
          );
        }

        if (wifiUser.password !== password.trim()) {
          return errorResponse(
            'INVALID_CREDENTIALS',
            'Invalid username or password'
          );
        }

        if (wifiUser.status !== 'active') {
          return errorResponse(
            'ACCOUNT_INACTIVE',
            'Your WiFi account is not active. Please contact front desk.'
          );
        }

        const now = new Date();
        if (wifiUser.validUntil < now) {
          return errorResponse(
            'ACCOUNT_EXPIRED',
            'Your WiFi session has expired. Please contact front desk to renew.'
          );
        }

        return successResponse({
          authenticated: true,
          method: 'pms_credentials',
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

          // Create a WiFi user for the phone-based session
          const now = new Date();
          const validUntil = new Date(
            now.getTime() + sessionTimeout * 60 * 1000
          );

          const wifiUsername = `sms-${normalizedPhone.replace(/[^a-z0-9]/gi, '')}`;
          const existingUser = await db.wiFiUser.findUnique({
            where: { username: wifiUsername },
          });

          // Get any property from the portal
          const fallbackPropertyId = portal?.propertyId || '';

          if (existingUser) {
            await db.wiFiUser.update({
              where: { id: existingUser.id },
              data: {
                status: 'active',
                validFrom: now,
                validUntil,
                radiusSynced: false,
              },
            });
          } else if (fallbackPropertyId) {
            await db.wiFiUser.create({
              data: {
                tenantId: portal?.tenantId || '',
                propertyId: fallbackPropertyId,
                username: wifiUsername,
                password: stored.code,
                validFrom: now,
                validUntil,
                status: 'active',
              },
            });
          }

          return successResponse({
            authenticated: true,
            method: 'sms_otp',
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
        // Auto-connect — no credentials needed
        const now = new Date();
        const validUntil = new Date(
          now.getTime() + sessionTimeout * 60 * 1000
        );

        // Optionally create a WiFi user for tracking
        if (portal) {
          const wifiUsername = `open-${Date.now()}`;
          try {
            await db.wiFiUser.create({
              data: {
                tenantId: portal.tenantId,
                propertyId: portal.propertyId,
                username: wifiUsername,
                password: `open-${Date.now()}`,
                validFrom: now,
                validUntil,
                status: 'active',
              },
            });
          } catch {
            // Ignore unique constraint race — best effort
          }
        }

        return successResponse({
          authenticated: true,
          method: 'open_access',
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
function successResponse(data: Record<string, unknown>) {
  return NextResponse.json({ success: true, data });
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
