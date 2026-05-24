/**
 * Test Notification API Endpoint
 *
 * POST: Send a test notification through the full pipeline
 * GET:  Get diagnostic info about the notification system
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  notificationService,
  NotificationData,
  NotificationChannel,
  NotificationCategory,
  NotificationPriority,
} from '@/lib/services/notification-service';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.send')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      type = 'system',
      category = 'info',
      priority = 'normal',
      title = '🔔 Test Notification',
      message = 'This is a test notification from StaySuite HospitalityOS. If you see this in your bell icon, the notification pipeline is working!',
      channels = ['in_app'] as NotificationChannel[],
      skipRealtime = false,
    } = body;

    const notificationData: NotificationData = {
      tenantId: user.tenantId,
      userId: user.id,
      type,
      category: category as NotificationCategory,
      title,
      message,
      priority: priority as NotificationPriority,
      channels: skipRealtime ? ['in_app'] : channels,
      data: {
        test: true,
        sentAt: new Date().toISOString(),
        skipRealtime,
      },
      link: '/notifications',
      icon: '🔔',
    };

    const result = await notificationService.send(notificationData);

    const response: Record<string, unknown> = {
      success: result.success,
      data: {
        notificationId: result.notificationId,
        channels: result.channels,
        timestamp: new Date().toISOString(),
      },
      message: result.success
        ? '✅ Test notification sent! Check the bell icon in the header.'
        : '❌ Failed to send test notification.',
    };

    if (skipRealtime) {
      response.note = 'Realtime push skipped. Notification will appear via polling (within 30s).';
    }

    if (result.errors?.length) {
      response.errors = result.errors;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in test notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.view')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check realtime service health
    let realtimeHealth = null;
    try {
      const healthRes = await fetch('http://localhost:3003/health', {
        signal: AbortSignal.timeout(3000),
      });
      realtimeHealth = await healthRes.json();
    } catch {
      realtimeHealth = { status: 'unreachable', error: 'Realtime service not running' };
    }

    // Count user's notifications
    const [totalNotifications, unreadNotifications] = await Promise.all([
      db.notification.count({
        where: { tenantId: user.tenantId, userId: user.id },
      }),
      db.notification.count({
        where: { tenantId: user.tenantId, userId: user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
        },
        realtime: {
          health: realtimeHealth,
          expectedBehavior: 'Bell icon should receive notifications instantly via WebSocket when realtime service is running, or within 30s via polling fallback.',
        },
        notifications: {
          total: totalNotifications,
          unread: unreadNotifications,
        },
        pipeline: {
          steps: [
            '1. POST /api/notifications/test → sends notification',
            '2. NotificationService.send() → resolves channels, checks preferences',
            '3. sendInAppNotification() → creates DB record + emits via realtime',
            '4. Realtime service → pushes notification:alert via Socket.IO',
            '5. Bell icon useRealtime hook → increments badge + re-fetches',
            '6. OR: 30s polling fallback → fetches /api/notifications/list',
          ],
        },
        testCommand: 'POST /api/notifications/test with body: { "title": "My Test", "category": "success" }',
      },
    });
  } catch (error) {
    console.error('Error in test diagnostics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get diagnostics' },
      { status: 500 }
    );
  }
}
