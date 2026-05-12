import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const isRead = sp.get('isRead');
    const propertyId = sp.get('propertyId');
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (isRead !== null) where.isRead = isRead === 'true';
    if (propertyId) where.propertyId = propertyId;

    const data = await db.vipAlert.findMany({
      where,
      include: { vipRule: true },
      orderBy: [{ createdAt: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.vipAlert.count({ where });
    const unreadCount = await db.vipAlert.count({ where: { tenantId: user.tenantId, isRead: false } });

    return NextResponse.json({
      success: true, data, pagination: { total, limit, offset },
      stats: { total, unread: unreadCount },
    });
  } catch (error) {
    console.error('GET /api/guests/vip-alerts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
