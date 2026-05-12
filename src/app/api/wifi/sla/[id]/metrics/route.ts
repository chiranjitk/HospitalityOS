/**
 * WiFi SLA Metrics API
 *
 * GET — Get SLA metrics for a config with date range filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = 'tenant_01';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Verify config exists
    const config = await db.wiFiSLAConfig.findFirst({
      where: { id, tenantId: TENANT_ID },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SLA config not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = {
      slaConfigId: id,
      tenantId: TENANT_ID,
    };

    if (dateFrom || dateTo) {
      const periodFilter: Record<string, unknown> = {};
      if (dateFrom) periodFilter.gte = new Date(dateFrom);
      if (dateTo) periodFilter.lte = new Date(dateTo);
      where.periodStart = periodFilter;
    }

    const metrics = await db.wiFiSLAMetric.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: limit,
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Time series data for chart
    const timeSeries = metrics.map(m => ({
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      actualUptime: m.actualUptime,
      avgSpeedDown: m.avgSpeedDown,
      avgSpeedUp: m.avgSpeedUp,
      avgLatency: m.avgLatency,
      totalSessions: m.totalSessions,
      totalBandwidth: m.totalBandwidth,
      breached: m.breached,
      breachTypes: m.breachTypes ? (typeof m.breachTypes === 'string' ? JSON.parse(m.breachTypes) : m.breachTypes) : [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        config,
        metrics: timeSeries,
        total: metrics.length,
      },
    });
  } catch (error) {
    console.error('Error fetching SLA metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA metrics' },
      { status: 500 }
    );
  }
}
