import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import {
  checkPropertyRateParity,
  applyParityCorrections,
  PricingStrategy,
  ParityReport,
} from '@/lib/channel-manager/rate-parity';

// GET /api/channel-manager/parity - Get rate parity report across all channels
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.manage') && !hasPermission(user, 'channels.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Requires channels.manage' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const threshold = searchParams.get('threshold')
      ? parseFloat(searchParams.get('threshold')!)
      : 5;
    const strategy = (searchParams.get('strategy') || 'match_lowest') as PricingStrategy;
    const priceFloor = searchParams.get('priceFloor')
      ? parseFloat(searchParams.get('priceFloor')!)
      : undefined;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 }
      );
    }

    // Validate threshold
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'threshold must be between 0 and 100' } },
        { status: 400 }
      );
    }

    // Validate strategy
    const validStrategies: PricingStrategy[] = ['match_lowest', 'price_floor', 'match_pms'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` } },
        { status: 400 }
      );
    }

    const reports = await checkPropertyRateParity(propertyId, {
      dateRange: startDate && endDate ? { start: startDate, end: endDate } : undefined,
      threshold,
      strategy,
      priceFloor,
    });

    // Compute summary statistics
    const summary = {
      totalChecks: reports.length,
      matched: reports.filter(r => r.overallStatus === 'matched').length,
      undercut: reports.filter(r => r.overallStatus === 'undercut').length,
      overpriced: reports.filter(r => r.overallStatus === 'overpriced').length,
      avgDeviation: reports.length > 0
        ? Math.round(reports.reduce((sum, r) => {
            const avgDev = r.channels.length > 0
              ? r.channels.reduce((s, c) => s + Math.abs(c.deviationPercent), 0) / r.channels.length
              : 0;
            return sum + avgDev;
          }, 0) / reports.length * 100) / 100
        : 0,
      totalRevenueImpact: reports.reduce((sum, r) => {
        const avgRate = r.averageRate;
        const pmsRate = r.pmsBaseRate;
        return sum + (avgRate - pmsRate);
      }, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        reports,
        summary,
        parameters: {
          propertyId,
          threshold,
          strategy,
          priceFloor,
          dateRange: startDate && endDate ? { start: startDate, end: endDate } : 'next 7 days',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching rate parity report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate parity report' } },
      { status: 500 }
    );
  }
}

// POST /api/channel-manager/parity - Apply parity corrections
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.manage') && !hasPermission(user, 'channels.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Requires channels.manage' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      strategy = 'match_lowest',
      threshold = 5,
      priceFloor,
      roomTypeIds,
      dateRange,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 }
      );
    }

    const validStrategies: PricingStrategy[] = ['match_lowest', 'price_floor', 'match_pms'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` } },
        { status: 400 }
      );
    }

    const result = await applyParityCorrections({
      propertyId,
      strategy,
      threshold,
      priceFloor,
      roomTypeIds,
      dateRange: dateRange
        ? { start: dateRange.start, end: dateRange.end }
        : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Parity corrections applied successfully using '${strategy}' strategy`,
        summary: {
          corrected: result.corrected,
          skipped: result.skipped,
          errors: result.errors,
        },
        details: result.details,
        parameters: {
          propertyId,
          strategy,
          threshold,
          priceFloor,
          roomTypeIds,
          dateRange: dateRange || 'next 7 days',
        },
      },
    });
  } catch (error) {
    console.error('Error applying parity corrections:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply parity corrections' } },
      { status: 500 }
    );
  }
}
