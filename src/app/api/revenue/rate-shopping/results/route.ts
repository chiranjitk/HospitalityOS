import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/revenue/rate-shopping/results — Query rate comparison results
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['revenue.view', 'revenue.manage', 'revenue.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const competitorId = searchParams.get('competitorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const roomTypeId = searchParams.get('roomTypeId');
    const parityStatus = searchParams.get('parityStatus');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (competitorId) where.competitorId = competitorId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (parityStatus) where.parityStatus = parityStatus;
    if (dateFrom || dateTo) {
      where.fetchedAt = {} as Record<string, unknown>;
      if (dateFrom) (where.fetchedAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.fetchedAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const results = await db.rateShoppingResult.findMany({
      where,
      orderBy: { fetchedAt: 'desc' },
      take: 500,
    });

    // Aggregate stats
    const total = results.length;
    const parity = results.filter((r) => r.parityStatus === 'parity').length;
    const below = results.filter((r) => r.parityStatus === 'below').length;
    const above = results.filter((r) => r.parityStatus === 'above').length;
    const avgDiff = total > 0 ? results.reduce((s, r) => s + r.rateDifference, 0) / total : 0;

    return NextResponse.json({
      success: true,
      data: {
        results,
        stats: { total, parity, below, above, avgRateDifference: Math.round(avgDiff * 100) / 100 },
      },
    });
  } catch (error) {
    console.error('Error fetching rate shopping results:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch results' }, { status: 500 });
  }
}
