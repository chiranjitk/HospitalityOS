/**
 * Canonical Plan Pricing (L-33)
 *
 * Single source of truth for subscription plan monthly prices.
 * All revenue calculations, billing, and admin UI MUST import from here.
 *
 * IMPORTANT: If you change a price here, verify that the SubscriptionPlan
 * table in the database is also updated for existing tenants.
 * The `reconcilePlanPricing()` function helps detect mismatches.
 */

// ── Monthly Prices (USD) ────────────────────────────────────────────

export const PLAN_PRICING = {
  trial: 0,
  starter: 99,
  professional: 499,
  enterprise: 1999,
} as const;

export type PlanName = keyof typeof PLAN_PRICING;

// ── Yearly Prices (10-month discount) ───────────────────────────────

export const PLAN_PRICING_YEARLY: Record<PlanName, number> = {
  trial: 0,
  starter: 990,       // 99 * 10
  professional: 4990, // 499 * 10
  enterprise: 19990,  // 1999 * 10
};

// ── Billing Limits per Plan ──────────────────────────────────────────

export const PLAN_LIMITS = {
  enterprise: { apiCalls: 500000, messages: 100000, rooms: 5000, users: 50000 },
  professional: { apiCalls: 100000, messages: 25000, rooms: 1000, users: 10000 },
  starter: { apiCalls: 25000, messages: 5000, rooms: 100, users: 1000 },
  trial: { apiCalls: 5000, messages: 1000, rooms: 25, users: 100 },
} as const;

// ── Reconciliation Check ────────────────────────────────────────────

interface PricingMismatch {
  plan: string;
  source: string;
  expected: number;
  actual: number;
}

/**
 * Reconcile plan pricing between this canonical source and the SubscriptionPlan table.
 * Returns an array of mismatches (empty = all good).
 *
 * Call this from admin health checks or on plan pricing changes.
 */
export function reconcilePlanPricing(
  dbSubscriptionPlans: Array<{ plan: string; monthlyPrice: number }>,
): PricingMismatch[] {
  const mismatches: PricingMismatch[] = [];

  for (const sub of dbSubscriptionPlans) {
    const plan = sub.plan as PlanName;
    const expected = PLAN_PRICING[plan];
    if (expected !== undefined && sub.monthlyPrice !== expected) {
      mismatches.push({
        plan,
        source: 'SubscriptionPlan DB',
        expected,
        actual: sub.monthlyPrice,
      });
    }
  }

  return mismatches;
}

/**
 * Quick in-code reconciliation: verify the yearly prices match monthly * 10.
 * Returns true if consistent.
 */
export function verifyInternalConsistency(): boolean {
  for (const plan of Object.keys(PLAN_PRICING) as PlanName[]) {
    const expectedYearly = PLAN_PRICING[plan] * 10;
    if (PLAN_PRICING_YEARLY[plan] !== expectedYearly) {
      console.error(
        `[plan-pricing] INCONSISTENCY: ${plan} monthly=${PLAN_PRICING[plan]} yearly=${PLAN_PRICING_YEARLY[plan]} expected=${expectedYearly}`,
      );
      return false;
    }
  }
  return true;
}
