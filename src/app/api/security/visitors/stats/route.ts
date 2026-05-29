import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/security/visitors/stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.view', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const tenantId = user.tenantId;

    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Total today
    const totalToday = await db.visitorLog.count({
      where: {
        tenantId,
        propertyId,
        deletedAt: null,
        checkIn: { gte: todayStart, lte: todayEnd },
      },
    });

    // Currently checked in
    const currentlyCheckedIn = await db.visitorLog.count({
      where: {
        tenantId,
        propertyId,
        deletedAt: null,
        status: 'checked_in',
      },
    });

    // By purpose breakdown
    const byPurposeRaw = await db.visitorLog.groupBy({
      by: ['purpose'],
      where: {
        tenantId,
        propertyId,
        deletedAt: null,
        checkIn: { gte: todayStart, lte: todayEnd },
      },
      _count: true,
    });

    const byPurpose: Record<string, number> = {};
    for (const item of byPurposeRaw) {
      byPurpose[item.purpose] = item._count;
    }

    // Peak hours today (group by hour of checkIn)
    const peakHoursRaw = await db.$queryRaw<Array<{ hour: number; count: bigint }>>`
      SELECT EXTRACT(HOUR FROM "check_in")::int AS hour, COUNT(*)::bigint AS count
      FROM "VisitorLog"
      WHERE "tenant_id" = ${tenantId}
        AND "property_id" = ${propertyId}
        AND "deleted_at" IS NULL
        AND "check_in" >= ${todayStart}
        AND "check_in" <= ${todayEnd}
      GROUP BY hour
      ORDER BY count DESC, hour
      LIMIT 5
    `;

    const peakHours = peakHoursRaw.map((row) => ({
      hour: row.hour,
      count: Number(row.count),
    }));

    // Currently checked in by purpose
    const checkedInByPurposeRaw = await db.visitorLog.groupBy({
      by: ['purpose'],
      where: {
        tenantId,
        propertyId,
        deletedAt: null,
        status: 'checked_in',
      },
      _count: true,
    });

    const checkedInByPurpose: Record<string, number> = {};
    for (const item of checkedInByPurposeRaw) {
      checkedInByPurpose[item.purpose] = item._count;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalToday,
        currentlyCheckedIn,
        byPurpose,
        checkedInByPurpose,
        peakHours,
      },
    });
  } catch (error) {
    console.error('[GET /api/security/visitors/stats]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
