import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/revenue/rate-shopping — List competitors + trigger rate comparison summary
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const channel = searchParams.get('channel');

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (channel) where.channel = channel;

    const competitors = await db.rateShoppingCompetitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get latest results summary per competitor
    const recentResults = await db.rateShoppingResult.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { fetchedAt: 'desc' },
      take: 200,
    });

    const stats = {
      total: competitors.length,
      active: competitors.filter((c) => c.isActive).length,
      lastFetchedAt: recentResults[0]?.fetchedAt?.toISOString() ?? null,
      parity: 0,
      below: 0,
      above: 0,
      unknown: 0,
    };

    for (const r of recentResults) {
      if (r.parityStatus === 'parity') stats.parity++;
      else if (r.parityStatus === 'below') stats.below++;
      else if (r.parityStatus === 'above') stats.above++;
      else stats.unknown++;
    }

    return NextResponse.json({ success: true, data: { competitors, stats } });
  } catch (error) {
    console.error('Error fetching rate shopping data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch rate shopping data' }, { status: 500 });
  }
}

// POST /api/revenue/rate-shopping — Create competitor
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { name, channel, propertyId, url } = body;

    if (!name || !channel) {
      return NextResponse.json({ success: false, error: 'Name and channel are required' }, { status: 400 });
    }

    const competitor = await db.rateShoppingCompetitor.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        channel,
        propertyId: propertyId || null,
        url: url || null,
      },
    });

    return NextResponse.json({ success: true, data: competitor }, { status: 201 });
  } catch (error) {
    console.error('Error creating competitor:', error);
    return NextResponse.json({ success: false, error: 'Failed to create competitor' }, { status: 500 });
  }
}

// DELETE /api/revenue/rate-shopping — Remove competitor
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    const existing = await db.rateShoppingCompetitor.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Competitor not found' }, { status: 404 });
    }

    await db.rateShoppingResult.deleteMany({ where: { competitorId: id } });
    await db.rateShoppingCompetitor.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: 'Competitor deleted' } });
  } catch (error) {
    console.error('Error deleting competitor:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete competitor' }, { status: 500 });
  }
}

// PUT /api/revenue/rate-shopping — Update competitor
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id, name, channel, propertyId, url, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    const existing = await db.rateShoppingCompetitor.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Competitor not found' }, { status: 404 });
    }

    const updated = await db.rateShoppingCompetitor.update({
      where: { id },
      data: { name, channel, propertyId: propertyId || null, url: url || null, isActive: isActive !== undefined ? isActive : existing.isActive },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating competitor:', error);
    return NextResponse.json({ success: false, error: 'Failed to update competitor' }, { status: 500 });
  }
}
