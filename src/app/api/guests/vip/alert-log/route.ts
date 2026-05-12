import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/guests/vip/alert-log — List alert log entries with date range, type filter, pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.view', 'guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const alertLevel = sp.get('alertLevel');
    const ruleType = sp.get('ruleType');
    const isRead = sp.get('isRead');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (alertLevel) where.alertLevel = alertLevel;
    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    // Filter by rule type via relation
    if (ruleType) {
      where.vipRule = { ruleType };
    }

    const alerts = await db.vipAlert.findMany({
      where,
      include: {
        vipRule: {
          select: { name: true, ruleType: true, alertLevel: true },
        },
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            loyaltyTier: true,
            isVip: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.vipAlert.count({ where });
    const unreadCount = await db.vipAlert.count({
      where: { tenantId: user.tenantId, isRead: false },
    });

    // Transform for frontend compatibility
    const transformedAlerts = alerts.map((a) => {
      let ruleConditions: Record<string, unknown> = {};
      // Infer notification channel from rule conditions
      const channel = 'front_desk' as string;

      return {
        id: a.id,
        timestamp: a.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        guestName: a.guest ? `${a.guest.firstName} ${a.guest.lastName}` : 'Unknown Guest',
        guestTier: a.guest?.loyaltyTier || a.alertLevel || 'bronze',
        alertType: a.vipRule?.ruleType || 'check_in',
        message: a.message || a.vipRule?.alertMessage || `${a.vipRule?.name || 'VIP alert'} triggered`,
        channel,
        acknowledgedBy: a.readBy || undefined,
        actionTaken: a.actionTaken || undefined,
        isRead: a.isRead,
        ruleName: a.vipRule?.name || '',
        alertLevel: a.alertLevel,
      };
    });

    // Type-based stats
    const typeBreakdown: Record<string, number> = {};
    for (const alert of transformedAlerts) {
      typeBreakdown[alert.alertType] = (typeBreakdown[alert.alertType] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: transformedAlerts,
      pagination: { total, limit, offset },
      stats: {
        total,
        unread: unreadCount,
        typeBreakdown,
      },
    });
  } catch (error) {
    console.error('GET /api/guests/vip/alert-log:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch alert log' }, { status: 500 });
  }
}
