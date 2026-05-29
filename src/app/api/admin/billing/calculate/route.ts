/**
 * POST /api/admin/billing/calculate
 * Server-side billing calculation with proper auth, tenant isolation, and currency standardization.
 * Requires platform admin access.
 *
 * Body:
 *   - tenantId (optional, defaults to auth user's tenant)
 *   - billingPeriod: 'monthly' | 'yearly'
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import { PLAN_PRICING, PLAN_PRICING_YEARLY, PLAN_LIMITS, type PlanName } from '@/lib/plan-pricing';

// Plan-based pricing lookup derived from canonical source (L-33)
const planPricing: Record<string, { monthly: number; yearly: number }> = {
  trial:    { monthly: PLAN_PRICING.trial,      yearly: PLAN_PRICING_YEARLY.trial },
  starter:  { monthly: PLAN_PRICING.starter,    yearly: PLAN_PRICING_YEARLY.starter },
  professional: { monthly: PLAN_PRICING.professional, yearly: PLAN_PRICING_YEARLY.professional },
  enterprise: { monthly: PLAN_PRICING.enterprise, yearly: PLAN_PRICING_YEARLY.enterprise },
};

// Overage rates (USD)
const overageRates = {
  apiCalls: 0.001,    // per call over limit
  storage: 0.10,      // per MB over limit
  messages: 0.01,     // per message over limit
};

// Usage rates (USD) for metered usage within limits
const usageRates = {
  apiCalls: 0.0001,
  storage: 0.01,
  messages: 0.001,
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const tenantId = body.tenantId || authResult.tenantId;
    const billingPeriod = body.billingPeriod || 'monthly';

    // Fix K: billingPeriod validation
    if (body.billingPeriod && !['monthly', 'yearly'].includes(body.billingPeriod)) {
      return NextResponse.json(
        { success: false, error: 'billingPeriod must be "monthly" or "yearly"' },
        { status: 400 }
      );
    }

    // Fetch tenant data
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        _count: { select: { properties: true, users: true } },
        properties: { select: { totalRooms: true } },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Fetch usage data
    let apiCallsUsed = 0;
    let storageUsed = 0;
    let messagesUsed = 0;

    try {
      const summary = await db.usageSummary.findUnique({
        where: { tenantId },
      });
      if (summary) {
        apiCallsUsed = summary.apiCallsMonth;
        storageUsed = Math.round(summary.storageUsedMb);
        messagesUsed = summary.messagesMonth + summary.emailsMonth + summary.smsMonth;
      }
    } catch {
      // UsageSummary may not exist yet
    }

    // Get plan limits
    const plan = tenant.plan || 'trial';

    // Look up plan pricing from DB; fall back to hardcoded defaults with a warning
    let basePrice: number;
    let apiCallsLimit: number;
    let messagesLimit: number;

    try {
      const planRecord = await db.subscriptionPlan.findFirst({
        where: { name: plan, isActive: true },
      });

      if (planRecord) {
        basePrice = billingPeriod === 'yearly' ? planRecord.yearlyPrice / 12 : planRecord.monthlyPrice;
        // Use plan limits from DB for API calls and messages; fallback to tenant limits
        apiCallsLimit = planRecord.maxUsers > 0 ? planRecord.maxUsers * 10000 : tenant.maxUsers * 10000;
        messagesLimit = planRecord.maxUsers > 0 ? planRecord.maxUsers * 2000 : tenant.maxUsers * 2000;
      } else {
        // No SubscriptionPlan record found — fall back to hardcoded values
        console.warn(
          `[billing] No active SubscriptionPlan found for plan "${plan}" (tenant ${tenantId}). ` +
          `Using hardcoded fallback pricing. Create a matching SubscriptionPlan record in the DB.`
        );
        const pricing = planPricing[plan] || planPricing.trial;
        basePrice = billingPeriod === 'yearly' ? pricing.yearly / 12 : pricing.monthly;
        const limits = PLAN_LIMITS[plan as PlanName] || PLAN_LIMITS.trial;
        apiCallsLimit = limits.apiCalls;
        messagesLimit = limits.messages;
      }
    } catch (error) {
      // DB lookup failed — fall back to hardcoded values
      console.warn(
        `[billing] SubscriptionPlan DB lookup failed for plan "${plan}" (tenant ${tenantId}):`,
        error instanceof Error ? error.message : error
      );
      const pricing = planPricing[plan] || planPricing.trial;
      basePrice = billingPeriod === 'yearly' ? pricing.yearly / 12 : pricing.monthly;
      const limits = PLAN_LIMITS[plan as PlanName] || PLAN_LIMITS.trial;
      apiCallsLimit = limits.apiCalls;
      messagesLimit = limits.messages;
    }

    // Usage charges (within limit)
    const usageCharges = {
      apiCalls: Math.min(apiCallsUsed, apiCallsLimit) * usageRates.apiCalls,
      storage: Math.min(storageUsed, tenant.storageLimitMb) * usageRates.storage,
      messages: Math.min(messagesUsed, messagesLimit) * usageRates.messages,
    };

    const totalUsageCharges = usageCharges.apiCalls + usageCharges.storage + usageCharges.messages;

    // Overage charges
    let overageCharges = 0;
    if (apiCallsUsed > apiCallsLimit) {
      overageCharges += (apiCallsUsed - apiCallsLimit) * overageRates.apiCalls;
    }
    if (storageUsed > tenant.storageLimitMb) {
      overageCharges += (storageUsed - tenant.storageLimitMb) * overageRates.storage;
    }
    if (messagesUsed > messagesLimit) {
      overageCharges += (messagesUsed - messagesLimit) * overageRates.messages;
    }

    // Total = base + usage charges + overage (FIX: previously usage charges were computed but not added)
    const totalAmount = basePrice + totalUsageCharges + overageCharges;

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        plan,
        billingPeriod,
        currency: 'USD',
        basePrice: Math.round(basePrice * 100) / 100,
        usageCharges: {
          apiCalls: Math.round(usageCharges.apiCalls * 100) / 100,
          storage: Math.round(usageCharges.storage * 100) / 100,
          messages: Math.round(usageCharges.messages * 100) / 100,
          total: Math.round(totalUsageCharges * 100) / 100,
        },
        overageCharges: Math.round(overageCharges * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        usage: {
          apiCalls: { used: apiCallsUsed, limit: apiCallsLimit },
          storage: { used: storageUsed, limit: tenant.storageLimitMb },
          messages: { used: messagesUsed, limit: messagesLimit },
          users: { used: tenant._count.users, limit: tenant.maxUsers },
          properties: { used: tenant._count.properties, limit: tenant.maxProperties },
          rooms: {
            used: tenant.properties.reduce((sum, p) => sum + p.totalRooms, 0),
            limit: tenant.maxRooms,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error calculating billing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate billing' },
      { status: 500 }
    );
  }
}
