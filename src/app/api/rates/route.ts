import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/rates - Rates module overview
// Provides an overview of the rate-plans and pricing sub-system
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

    return NextResponse.json({
      success: true,
      data: {
        module: 'rates',
        description: 'Rates module for managing rate plans, pricing rules, overrides, and revenue optimization',
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
      message: 'Rates module — use /api/rate-plans to manage rate plans, or explore the endpoints above for pricing rules and overrides',
    });
  } catch (error) {
    console.error('Rates overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rates overview' } },
      { status: 500 }
    );
  }
}
