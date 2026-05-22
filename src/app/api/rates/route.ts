import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/rates - Rates module overview with actual rate plan summary data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'rates.view') && !hasPermission(user, 'rate-plans.view') && !hasPermission(user, 'revenue.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Query rate plan summary from the database
    const [totalPlans, activePlans, avgBasePrice, recentRatePlans] = await Promise.all([
      db.ratePlan.count({
        where: { tenantId },
      }),
      db.ratePlan.count({
        where: { tenantId, status: 'active' },
      }),
      db.ratePlan.aggregate({
        where: { tenantId, status: 'active' },
        _avg: { basePrice: true },
      }),
      db.ratePlan.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, basePrice: true, status: true, season: true, roomType: { select: { name: true } } },
      }),
    ]);

    // Get pricing rules count
    const activePricingRules = await db.pricingRule.count({
      where: { tenantId, isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        module: 'rates',
        summary: {
          totalPlans,
          activePlans,
          inactivePlans: totalPlans - activePlans,
          averageBasePrice: avgBasePrice._avg.basePrice || 0,
          activePricingRules,
        },
        recentRatePlans,
        endpoints: {
          ratePlans: '/api/rate-plans',
          ratePlanById: '/api/rate-plans/[id]',
          bulkRates: '/api/rate-plans/bulk-rates',
          priceOverrides: '/api/price-overrides',
          priceOverrideById: '/api/price-overrides/[id]',
          revenuePricingRules: '/api/revenue/pricing-rules',
          revenueLosPricing: '/api/revenue/los-pricing',
          revenueHourlyPricing: '/api/revenue/hourly-pricing',
          revenueLinearPricing: '/api/revenue/linear-pricing',
          revenueAutoApply: '/api/revenue/auto-apply',
          revenueAiSuggestions: '/api/revenue/ai-suggestions',
          revenueRateShopping: '/api/revenue/rate-shopping',
          revenueLastMinuteTriggers: '/api/revenue/last-minute-triggers',
          revenueOverbooking: '/api/revenue/overbooking',
          cancellationPolicies: '/api/cancellation-policies',
          exchangeRates: '/api/exchange-rates',
          dashboardRatePlans: '/api/dashboard/rate-plans',
        },
      },
    });
  } catch (error) {
    console.error('Rates overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rates overview' } },
      { status: 500 }
    );
  }
}
