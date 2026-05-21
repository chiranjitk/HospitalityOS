import { NextRequest, NextResponse } from 'next/server';
import { optimizeRevPAR, getCurrentMetrics } from '@/lib/revenue/revpar-optimizer';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'propertyId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const suggestions = await optimizeRevPAR(tenantId, propertyId, {
      start: new Date(startDate),
      end: new Date(endDate),
    });

    // Summary
    const summary = {
      totalSuggestions: suggestions.length,
      urgentCount: suggestions.filter(s => s.priority === 'urgent').length,
      highCount: suggestions.filter(s => s.priority === 'high').length,
      mediumCount: suggestions.filter(s => s.priority === 'medium').length,
      lowCount: suggestions.filter(s => s.priority === 'low').length,
      avgRateIncrease: suggestions.length > 0
        ? suggestions.reduce((s, r) => s + r.suggestedRateChange, 0) / suggestions.length
        : 0,
      totalRevenueImpact: suggestions.reduce((s, r) => s + r.expectedRevenueImpact, 0),
    };

    return NextResponse.json({ success: true, data: suggestions, summary });
  } catch (error) {
    console.error('Error fetching RevPAR suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
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
    const { propertyId, startDate, endDate } = body;

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'propertyId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const suggestions = await optimizeRevPAR(tenantId, propertyId, {
      start: new Date(startDate),
      end: new Date(endDate),
    });

    const metrics = await getCurrentMetrics(tenantId, propertyId, {
      start: new Date(startDate),
      end: new Date(endDate),
    });

    const summary = {
      totalSuggestions: suggestions.length,
      urgentCount: suggestions.filter(s => s.priority === 'urgent').length,
      highCount: suggestions.filter(s => s.priority === 'high').length,
      avgOccupancy: metrics.length > 0
        ? metrics.reduce((s, m) => s + m.occupancy, 0) / metrics.length
        : 0,
      avgADR: metrics.length > 0
        ? metrics.reduce((s, m) => s + m.adr, 0) / metrics.length
        : 0,
      avgRevPAR: metrics.length > 0
        ? metrics.reduce((s, m) => s + m.revpar, 0) / metrics.length
        : 0,
      totalRevenueImpact: suggestions.reduce((s, r) => s + r.expectedRevenueImpact, 0),
    };

    return NextResponse.json({
      success: true,
      data: { suggestions, metrics },
      summary,
    });
  } catch (error) {
    console.error('Error running RevPAR optimization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run optimization' },
      { status: 500 }
    );
  }
}
