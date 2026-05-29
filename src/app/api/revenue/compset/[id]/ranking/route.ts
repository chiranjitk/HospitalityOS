import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { generateRanking } from '@/lib/revenue/compset-metrics';
import { subDays } from 'date-fns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/revenue/compset/[id]/ranking - Get current and historical ranking
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const dateStr = searchParams.get('date');
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Verify compset
    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId, isActive: true },
      select: { propertyId: true, name: true },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Current ranking
    const targetDate = dateStr ? new Date(dateStr) : subDays(new Date(), 1);
    const { rankings, ourRank } = await generateRanking(id, targetDate, ctx.tenantId);

    // Historical ranking trend
    const historicalRanks: { date: string; rank: number | null; rgi: number | null }[] = [];
    for (let i = 0; i < days; i++) {
      const d = subDays(targetDate, i);
      const metric = await db.compSetMetric.findFirst({
        where: {
          competitiveSetId: id,
          tenantId: ctx.tenantId,
          date: d,
          period: 'daily',
        },
        select: { ourRank: true, rgi: true, date: true },
      });

      historicalRanks.push({
        date: d.toISOString(),
        rank: metric?.ourRank ?? null,
        rgi: metric ? Number(metric.rgi.toFixed(2)) : null,
      });
    }

    // Get member details for enriched ranking
    const members = await db.compSetMember.findMany({
      where: { competitiveSetId: id, tenantId: ctx.tenantId, isActive: true },
      select: { hotelName: true, starRating: true, totalRooms: true, proximityKm: true },
      orderBy: { sortOrder: 'asc' },
    });

    const memberDetails = new Map<string, typeof members[0]>();
    for (const m of members) {
      memberDetails.set(m.hotelName, m);
    }

    const enrichedRankings = rankings.map((r) => {
      const details = memberDetails.get(r.name);
      return {
        ...r,
        adr: Number(r.adr.toFixed(2)),
        occupancy: Number(r.occupancy.toFixed(2)),
        revpar: Number(r.revpar.toFixed(2)),
        starRating: details?.starRating ?? null,
        totalRooms: details?.totalRooms ?? null,
        proximityKm: details?.proximityKm ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        competitiveSetId: id,
        competitiveSetName: compSet.name,
        targetDate: targetDate.toISOString(),
        currentRanking: enrichedRankings,
        ourRank,
        totalCompetitors: rankings.length,
        historicalTrend: historicalRanks.reverse(),
      },
    });
  } catch (error) {
    console.error('Error fetching ranking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ranking' } },
      { status: 500 }
    );
  }
}
