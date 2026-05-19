/**
 * POST /api/wifi/otp/verify — Verify an OTP code
 *
 * Public endpoint (no auth) — called from captive portal.
 * Verifies the OTP code against the stored hash.
 * On success, creates/updates a WiFiIdentityLog entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOTP as verifyOTPService } from '@/lib/services/otp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { otpId, code } = body;

    // ── Validation ─────────────────────────────────────────
    if (!otpId || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: otpId, code' },
        { status: 400 },
      );
    }

    if (typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP code format' },
        { status: 400 },
      );
    }

    // ── Verify OTP ─────────────────────────────────────────
    const result = await verifyOTPService(otpId, code.trim());

    if (!result.success) {
      return NextResponse.json({
        success: false,
        reason: result.reason,
      });
    }

    // ── Lookup the OTP record for identity log ─────────────
    const otpRecord = await db.wiFiOTP.findUnique({
      where: { id: otpId },
      select: {
        tenantId: true,
        propertyId: true,
        sessionId: true,
        username: true,
        destination: true,
        channel: true,
        ipAddress: true,
      },
    });

    if (otpRecord) {
      const verificationMethod = otpRecord.channel === 'sms' ? 'otp_sms' : 'otp_email';

      // Create a WiFiIdentityLog entry for this successful verification
      await db.wiFiIdentityLog.create({
        data: {
          tenantId: otpRecord.tenantId,
          propertyId: otpRecord.propertyId,
          sessionId: otpRecord.sessionId,
          username: otpRecord.username || otpRecord.destination,
          verificationMethod,
          verifiedIdentity: maskDestination(otpRecord.destination, otpRecord.channel),
          verificationStatus: 'verified',
          ipAddress: otpRecord.ipAddress || '',
          verifiedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[otp/verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 },
    );
  }
}

/** Mask destination for identity log storage */
function maskDestination(destination: string, channel: string): string {
  if (channel === 'sms') {
    const digits = destination.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    const prefix = destination.slice(0, destination.length - digits.length + 4);
    return prefix + '****';
  }
  // email
  const atIdx = destination.indexOf('@');
  if (atIdx <= 0) return '****';
  const local = destination.slice(0, atIdx);
  return local[0] + '***' + destination.slice(atIdx);
}
