import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/analytics - Analytics module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'reports.view') && !hasPermission(user, 'analytics.view') && !hasPermission(user, 'dashboard.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'analytics',
        description: 'Analytics module for reporting, revenue analysis, and business intelligence',
        endpoints: {
          dashboard: '/api/dashboard',
          dashboardStats: '/api/dashboard/stats',
          dashboardKpis: '/api/dashboard/kpis',
          dashboardQuickStats: '/api/dashboard/quick-stats',
          dashboardRevenueTrend: '/api/dashboard/revenue-trend',
          dashboardOccupancyForecast: '/api/dashboard/occupancy-forecast',
          dashboardGuestSegments: '/api/dashboard/guest-segments',
          dashboardGuestSatisfaction: '/api/dashboard/guest-satisfaction',
          dashboardRatePlans: '/api/dashboard/rate-plans',
          dashboardPropertyComparison: '/api/dashboard/property-comparison',
          reportsOccupancy: '/api/reports/occupancy',
          reportsRevenue: '/api/reports/revenue',
          reportsExport: '/api/reports/export',
          reportsBiExport: '/api/reports/bi-export',
          revenueDemandForecast: '/api/revenue/demand-forecast',
          revenueCompetitorPricing: '/api/revenue/competitor-pricing',
          revenuePriceElasticity: '/api/revenue/price-elasticity',
          revenueRevparOptimize: '/api/revenue/revpar-optimize',
          chainAnalytics: '/api/chain/analytics',
        },
      },
      message: 'Analytics module — use the endpoints above for dashboards, reports, revenue analytics, and forecasting',
    });
  } catch (error) {
    console.error('Analytics overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics overview' } },
      { status: 500 }
    );
  }
}
