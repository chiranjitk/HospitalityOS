import { NextRequest, NextResponse } from 'next/server';
import { analyzePriceElasticity } from '@/lib/revenue/price-elasticity';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');
    const period = searchParams.get('period');

    const { db } = await import('@/lib/db');

    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (period) where.period = period;

    const analyses = await db.priceElasticityData.findMany({
      where,
      orderBy: { analyzedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, data: analyses });
  } catch (error) {
    console.error('Error fetching price elasticity data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch elasticity data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const body = await request.json();
    const { propertyId, roomTypeId, period } = body;

    if (!propertyId || !roomTypeId) {
      return NextResponse.json(
        { success: false, error: 'propertyId and roomTypeId are required' },
        { status: 400 }
      );
    }

    const result = await analyzePriceElasticity(
      tenantId,
      propertyId,
      roomTypeId,
      period || 'last_30_days'
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error running price elasticity analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
