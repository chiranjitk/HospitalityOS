/**
 * POST /api/wifi/otp/send — Send OTP to guest via SMS or email
 *
 * Public endpoint (no auth) — called from captive portal.
 * Generates a numeric OTP, stores SHA-256 hash, delivers via adapter.
 * Returns otpId + masked destination for subsequent verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWifiSettings, type IdentityVerificationSettings } from '@/lib/wifi-settings';
import { sendSMSForTenant } from '@/lib/adapters/sms';
import { sendEmailForTenant } from '@/lib/adapters/email';
import { checkRateLimit, createOTP } from '@/lib/services/otp-service';

/** Mask phone number: +919876543210 → +91******3210 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const prefix = phone.slice(0, phone.length - digits.length + 4);
  return prefix + '*'.repeat(digits.length - 4);
}

/** Mask email address: user@domain.com → u***@domain.com */
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '****';
  const local = email.slice(0, atIdx);
  return local[0] + '***' + email.slice(atIdx);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      propertyId,
      sessionId,
      username,
      destination,
      channel,
      ipAddress,
    } = body;

    // ── Validation ─────────────────────────────────────────
    if (!tenantId || !destination || !channel) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, destination, channel' },
        { status: 400 },
      );
    }

    if (!['sms', 'email'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'Channel must be "sms" or "email"' },
        { status: 400 },
      );
    }

    // ── Check tenant-level settings ────────────────────────
    let settings: IdentityVerificationSettings;
    try {
      settings = await getWifiSettings(tenantId, 'identity_verification');
    } catch {
      settings = {
        requiredMethods: [],
        autoVerifyRoomNumber: false,
        enableSmsOtp: true,
        enableEmailOtp: true,
        otpExpirySeconds: 300,
        otpMaxRetries: 3,
      };
    }

    if (channel === 'sms' && !settings.enableSmsOtp) {
      return NextResponse.json(
        { success: false, error: 'SMS OTP is disabled for this tenant' },
        { status: 400 },
      );
    }

    if (channel === 'email' && !settings.enableEmailOtp) {
      return NextResponse.json(
        { success: false, error: 'Email OTP is disabled for this tenant' },
        { status: 400 },
      );
    }

    // ── Rate limiting ──────────────────────────────────────
    const rateCheck = await checkRateLimit(tenantId, destination, 5, 3);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many OTP requests. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
          retryAfter: rateCheck.remainingSeconds,
        },
        { status: 429 },
      );
    }

    // ── Generate and store OTP ─────────────────────────────
    const { otpId, code, expiresAt } = await createOTP({
      tenantId,
      propertyId,
      sessionId,
      username,
      destination,
      channel,
      otpLength: 6,
      expirySeconds: settings.otpExpirySeconds || 300,
      maxAttempts: settings.otpMaxRetries || 3,
      ipAddress,
    });

    const expiryMinutes = Math.floor((settings.otpExpirySeconds || 300) / 60);

    // ── Deliver OTP via adapter ────────────────────────────
    try {
      if (channel === 'sms') {
        const message = `Your WiFi verification code is: ${code}. Valid for ${expiryMinutes} minute${expiryMinutes !== 1 ? 's' : ''}.`;
        await sendSMSForTenant(tenantId, { to: destination, message });
      } else {
        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden;">
    <div style="background: #0d9488; padding: 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 600;">WiFi Verification</h1>
      <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Your one-time code</p>
    </div>
    <div style="padding: 24px; text-align: center;">
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Enter this code to verify your identity:</p>
      <div style="background: #f0fdfa; border: 2px dashed #ccfbf1; border-radius: 8px; padding: 16px; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #0f766e; font-family: 'SF Mono', 'Fira Code', monospace;">${code}</div>
      <p style="font-size: 13px; color: #9ca3af; margin-top: 16px;">This code expires in ${expiryMinutes} minute${expiryMinutes !== 1 ? 's' : ''}. Do not share it with anyone.</p>
    </div>
    <div style="padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 2px 0;">This is an automated message. Do not reply.</p>
    </div>
  </div>
</body></html>`;

        await sendEmailForTenant(tenantId, {
          to: destination,
          subject: 'WiFi Verification Code',
          html,
          text: `Your WiFi verification code is: ${code}. Valid for ${expiryMinutes} minute${expiryMinutes !== 1 ? 's' : ''}. Do not share it with anyone.`,
        });
      }
    } catch (deliveryError) {
      const errMsg = deliveryError instanceof Error ? deliveryError.message : 'Delivery failed';
      console.error(`[otp/send] Delivery failed for ${channel} to ${destination}:`, errMsg);

      // Mark the OTP record as failed
      await db.wiFiOTP.update({
        where: { id: otpId },
        data: { status: 'failed' },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to send OTP. Please try again later.' },
        { status: 500 },
      );
    }

    // ── Return response (never expose plaintext code) ──────
    const maskedDestination = channel === 'sms' ? maskPhone(destination) : maskEmail(destination);

    return NextResponse.json({
      success: true,
      data: {
        otpId,
        expiresAt: expiresAt.toISOString(),
        channel,
        maskedDestination,
        expirySeconds: settings.otpExpirySeconds || 300,
      },
    });
  } catch (error) {
    console.error('[otp/send] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 },
    );
  }
}
