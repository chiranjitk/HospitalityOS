import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { calculateCompSetMetrics, storeCompSetMetrics } from '@/lib/revenue/compset-metrics';
import { subDays } from 'date-fns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/revenue/compset/[id]/metrics - Query metrics with date range filter
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const period = searchParams.get('period') || 'daily';

    // Verify compset exists
    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { propertyId: true, isActive: true },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Default to last 30 days
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : subDays(endDate, 29);

    // Ensure startDate is at midnight
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const metrics = await db.compSetMetric.findMany({
      where: {
        competitiveSetId: id,
        tenantId: ctx.tenantId,
        date: { gte: startDate, lte: endDate },
        period,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate aggregated summary
    const adrIndexValues = metrics.map((m) => m.adrIndex);
    const mpiValues = metrics.map((m) => m.mpi);
    const rgiValues = metrics.map((m) => m.rgi);
    const revparIndexValues = metrics.map((m) => m.revparIndex);

    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics.map((m) => ({
          id: m.id,
          date: m.date.toISOString(),
          period: m.period,
          ourAdr: Number(m.ourAdr.toFixed(2)),
          ourOccupancy: Number(m.ourOccupancy.toFixed(2)),
          ourRevpar: Number(m.ourRevpar.toFixed(2)),
          compsetAdr: Number(m.compsetAdr.toFixed(2)),
          compsetOccupancy: Number(m.compsetOccupancy.toFixed(2)),
          compsetRevpar: Number(m.compsetRevpar.toFixed(2)),
          adrIndex: Number(m.adrIndex.toFixed(2)),
          mpi: Number(m.mpi.toFixed(2)),
          rgi: Number(m.rgi.toFixed(2)),
          revparIndex: Number(m.revparIndex.toFixed(2)),
          compsetSize: m.compsetSize,
          ourRank: m.ourRank,
          dataCompleteness: Number(m.dataCompleteness.toFixed(2)),
          source: m.source,
          createdAt: m.createdAt.toISOString(),
        })),
        summary: {
          totalDays: metrics.length,
          avgAdrIndex: avg(adrIndexValues),
          avgMpi: avg(mpiValues),
          avgRgi: avg(rgiValues),
          avgRevparIndex: avg(revparIndexValues),
          latestMetric: metrics.length > 0 ? metrics[metrics.length - 1] : null,
        },
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          period,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching compset metrics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch metrics' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/compset/[id]/metrics - Calculate + store new metrics
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const body = await request.json();
    const { date: dateStr, endDate: endDateStr, period = 'daily', source = 'manual' } = body;

    // Verify compset
    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId, isActive: true },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (endDateStr) {
      startDate = dateStr ? new Date(dateStr) : new Date(endDateStr);
      endDate = new Date(endDateStr);
    } else if (dateStr) {
      startDate = new Date(dateStr);
      endDate = new Date(dateStr);
    } else {
      // Default to yesterday
      const yesterday = subDays(new Date(), 1);
      startDate = yesterday;
      endDate = yesterday;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Calculate and store metrics for each day in range
    const results = [];
    const current = new Date(startDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let processedCount = 0;

    while (current <= endDate) {
      const calculated = await calculateCompSetMetrics(
        compSet.propertyId,
        id,
        current,
        period,
        ctx.tenantId
      );

      if (calculated) {
        await storeCompSetMetrics(id, ctx.tenantId, compSet.propertyId, calculated, source);
        results.push(calculated);
        processedCount++;
      }

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Calculated and stored metrics for ${processedCount} day(s)`,
        totalDays,
        processedDays: processedCount,
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error calculating compset metrics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate metrics' } },
      { status: 500 }
    );
  }
}
