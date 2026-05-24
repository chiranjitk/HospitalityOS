import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/notification-service';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON:process-notifications] CRON_SECRET environment variable is required');
}

/**
 * Cron: Process scheduled notifications that are due
 * Also cleans up expired notifications
 *
 * Invoke via: GET /api/cron/process-notifications
 * Recommended schedule: Every 1 minute
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!CRON_SECRET) {
      return NextResponse.json({ success: false, error: { code: 'CONFIG_ERROR', message: 'Cron secret not configured' } }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron credentials' } }, { status: 401 });
    }
    const [processResult, cleanedCount] = await Promise.all([
      notificationService.processScheduledNotifications(),
      notificationService.cleanupExpiredNotifications(),
    ]);

    return NextResponse.json({
      success: true,
      processed: true,
      cleanedExpired: cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Failed to process notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process scheduled notifications' },
      { status: 500 }
    );
  }
}
