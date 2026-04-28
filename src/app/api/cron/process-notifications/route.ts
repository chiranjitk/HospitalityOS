import { NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/notification-service';

/**
 * Cron: Process scheduled notifications that are due
 * Also cleans up expired notifications
 *
 * Invoke via: GET /api/cron/process-notifications
 * Recommended schedule: Every 1 minute
 */

export async function GET() {
  try {
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
