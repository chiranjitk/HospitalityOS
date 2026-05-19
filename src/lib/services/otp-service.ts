/**
 * OTP Service — F14 SMS/Email OTP provider integration
 *
 * Handles OTP generation, hashing, storage, verification, rate limiting,
 * and cleanup of expired OTP codes for guest WiFi identity verification.
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

/** Generate a numeric OTP code of the given length (default 6) */
export function generateOTP(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/** Hash an OTP code with SHA-256 for secure storage (never store plaintext) */
export function hashOTP(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Rate-limit check: max OTPs per destination within a sliding window */
export async function checkRateLimit(
  tenantId: string,
  destination: string,
  windowMinutes: number = 5,
  maxSends: number = 3,
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const recentCount = await db.wiFiOTP.count({
    where: {
      tenantId,
      destination,
      createdAt: { gte: windowStart },
      status: { in: ['pending', 'verified', 'expired'] },
    },
  });

  // Calculate when the oldest OTP in the window will expire
  let remainingSeconds = 0;
  if (recentCount >= maxSends) {
    const oldestRecent = await db.wiFiOTP.findFirst({
      where: {
        tenantId,
        destination,
        createdAt: { gte: windowStart },
        status: { in: ['pending', 'verified', 'expired'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (oldestRecent) {
      const windowEnd = new Date(oldestRecent.createdAt.getTime() + windowMinutes * 60 * 1000);
      remainingSeconds = Math.max(0, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
    }
  }

  return { allowed: recentCount < maxSends, remainingSeconds };
}

/** Create an OTP record: generates code, hashes it, stores in DB */
export async function createOTP(params: {
  tenantId: string;
  propertyId?: string;
  sessionId?: string;
  username?: string;
  destination: string; // phone number or email address
  channel: 'sms' | 'email';
  otpLength?: number;
  expirySeconds?: number;
  maxAttempts?: number;
  ipAddress?: string;
}): Promise<{ otpId: string; code: string; expiresAt: Date }> {
  const code = generateOTP(params.otpLength || 6);
  const expiresAt = new Date(Date.now() + (params.expirySeconds || 300) * 1000);

  const record = await db.wiFiOTP.create({
    data: {
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      sessionId: params.sessionId,
      username: params.username,
      destination: params.destination,
      channel: params.channel,
      codeHash: hashOTP(code),
      otpLength: params.otpLength || 6,
      expiresAt,
      maxAttempts: params.maxAttempts || 3,
      ipAddress: params.ipAddress,
    },
  });

  return { otpId: record.id, code, expiresAt };
}

/** Verify an OTP code against a stored record */
export async function verifyOTP(
  otpId: string,
  code: string,
): Promise<{ success: boolean; reason?: string }> {
  const record = await db.wiFiOTP.findUnique({ where: { id: otpId } });

  if (!record) return { success: false, reason: 'OTP not found' };
  if (record.status === 'verified') return { success: false, reason: 'OTP already used' };

  if (record.status === 'expired' || record.expiresAt < new Date()) {
    await db.wiFiOTP.update({
      where: { id: otpId },
      data: { status: 'expired' },
    });
    return { success: false, reason: 'OTP expired' };
  }

  if (record.attempts >= record.maxAttempts) {
    await db.wiFiOTP.update({
      where: { id: otpId },
      data: { status: 'failed' },
    });
    return { success: false, reason: 'Max attempts exceeded' };
  }

  // Increment attempt counter
  await db.wiFiOTP.update({
    where: { id: otpId },
    data: { attempts: { increment: 1 } },
  });

  // Compare hashed codes
  if (hashOTP(code) !== record.codeHash) {
    return { success: false, reason: 'Invalid OTP' };
  }

  // Mark as verified
  await db.wiFiOTP.update({
    where: { id: otpId },
    data: { status: 'verified', verifiedAt: new Date() },
  });

  return { success: true };
}

/** Bulk-expire pending OTPs past their expiration (for cron) */
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await db.wiFiOTP.updateMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });
  return result.count;
}
