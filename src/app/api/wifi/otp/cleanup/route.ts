/**
 * POST /api/wifi/otp/cleanup — Expire stale OTP records (admin-only)
 *
 * Protected endpoint — marks all pending OTPs past their expiry as "expired".
 * Can be called manually or triggered by a cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { cleanupExpiredOTPs } from '@/lib/services/otp-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const count = await cleanupExpiredOTPs();

    return NextResponse.json({
      success: true,
      data: {
        expired: count,
        message: count === 0
          ? 'No expired OTPs found'
          : `Marked ${count} OTP record${count === 1 ? '' : 's'} as expired`,
      },
    });
  } catch (error) {
    console.error('[otp/cleanup] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup expired OTPs' },
      { status: 500 },
    );
  }
}
