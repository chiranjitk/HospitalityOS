import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Always sync RegistrationPlan from SubscriptionPlan (idempotent upsert).
 * This keeps both plan tables in sync on every request.
 */
async function ensureRegistrationPlansSeeded() {
  const subscriptionPlans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (subscriptionPlans.length === 0) return;

  for (const sp of subscriptionPlans) {
    // Parse features from SubscriptionPlan format to RegistrationPlan format
    let features = '[]';
    try {
      const parsed = JSON.parse(sp.features || '[]');
      // SubscriptionPlan stores [{ name, included }], convert to feature flag IDs
      features = JSON.stringify(
        parsed
          .filter((f: { included?: boolean }) => f.included !== false)
          .map((f: { name: string }) => f.name.toLowerCase().replace(/\s+/g, '_'))
      );
    } catch {
      features = '[]';
    }

    await db.registrationPlan.upsert({
      where: { name: sp.name },
      create: {
        name: sp.name,
        displayName: sp.displayName,
        description: sp.description || `The ${sp.displayName} plan for StaySuite`,
        price: sp.monthlyPrice,
        currency: sp.currency || 'USD',
        maxProperties: sp.maxProperties,
        maxRoomsPerProperty: sp.maxRooms,
        maxUsers: sp.maxUsers,
        maxStaff: Math.max(1, Math.floor(sp.maxUsers * 0.8)),
        features,
        sortOrder: sp.sortOrder,
        isActive: true,
        highlighted: sp.isPopular || false,
        trialDays: sp.name === 'trial' ? 14 : null,
      },
      update: {
        displayName: sp.displayName,
        description: sp.description,
        price: sp.monthlyPrice,
        currency: sp.currency,
        maxProperties: sp.maxProperties,
        maxRoomsPerProperty: sp.maxRooms,
        maxUsers: sp.maxUsers,
        maxStaff: Math.max(1, Math.floor(sp.maxUsers * 0.8)),
        features,
        highlighted: sp.isPopular || false,
      },
    });
  }

  console.log(`[RegistrationPlans] Auto-seeded ${subscriptionPlans.length} plans from SubscriptionPlan`);
}

/**
 * Normalise a plan object into the canonical response shape.
 * Works for both RegistrationPlan and mapped SubscriptionPlan rows.
 */
function formatPlan(
  plan: Record<string, unknown>,
  featureCount: number
): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    description: plan.description ?? null,
    price: Number(plan.price ?? 0),
    currency: plan.currency ?? 'USD',
    maxProperties: plan.maxProperties ?? 1,
    maxRoomsPerProperty: plan.maxRoomsPerProperty ?? 50,
    maxUsers: plan.maxUsers ?? 5,
    maxStaff: plan.maxStaff ?? 10,
    features: plan.features ?? '[]',
    featureCount,
    highlighted: plan.highlighted ?? false,
    trialDays: plan.trialDays ?? null,
    sortOrder: plan.sortOrder ?? 0,
  };
}

/**
 * Query SubscriptionPlan directly and map fields to RegistrationPlan shape.
 * Used as a fallback when the RegistrationPlan table is empty.
 */
async function getPlansFromSubscriptionFallback() {
  const subscriptionPlans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return subscriptionPlans.map((sp) => {
    // Convert features from [{ name, included }] → list of feature flag IDs
    let features = '[]';
    let featureCount = 0;
    try {
      const parsed = JSON.parse(sp.features || '[]');
      const ids = parsed
        .filter((f: { included?: boolean }) => f.included !== false)
        .map((f: { name: string }) => f.name.toLowerCase().replace(/\s+/g, '_'));
      features = JSON.stringify(ids);
      featureCount = ids.length;
    } catch {
      featureCount = 0;
    }

    return formatPlan(
      {
        id: sp.id,
        name: sp.name,
        displayName: sp.displayName,
        description: sp.description,
        price: sp.monthlyPrice,
        currency: sp.currency,
        // Field mapping: SubscriptionPlan.maxRooms → RegistrationPlan.maxRoomsPerProperty
        maxProperties: sp.maxProperties ?? 1,
        maxRoomsPerProperty: sp.maxRooms ?? 50,
        maxUsers: sp.maxUsers ?? 5,
        maxStaff: Math.max(1, Math.floor((sp.maxUsers ?? 5) * 0.8)),
        features,
        highlighted: sp.isPopular ?? false,
        trialDays: sp.name === 'trial' ? 14 : null,
        sortOrder: sp.sortOrder,
      },
      featureCount
    );
  });
}

// GET /api/registration/plans (PUBLIC)
export async function GET() {
  try {
    // 1. Always attempt to sync from SubscriptionPlan (idempotent).
    //    Wrapped in its own try/catch so a seed failure does not kill the request.
    try {
      await ensureRegistrationPlansSeeded();
    } catch (seedError) {
      console.error('[RegistrationPlans] Seed sync failed, will use fallback:', seedError);
    }

    // 2. Query RegistrationPlan
    const plans = await db.registrationPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 3. If RegistrationPlan is empty after sync, fall back to SubscriptionPlan directly
    if (plans.length === 0) {
      console.warn('[RegistrationPlans] Table empty after sync – falling back to SubscriptionPlan');
      const fallbackPlans = await getPlansFromSubscriptionFallback();
      return NextResponse.json({ success: true, plans: fallbackPlans });
    }

    // 4. Normal path: return RegistrationPlan data
    const plansWithFeatureCount = plans.map((plan) => {
      let featureCount = 0;
      try {
        const features = JSON.parse(plan.features);
        featureCount = Array.isArray(features) ? features.length : 0;
      } catch {
        featureCount = 0;
      }

      return formatPlan(plan, featureCount);
    });

    return NextResponse.json({ success: true, plans: plansWithFeatureCount });
  } catch (error) {
    console.error('Failed to fetch registration plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch registration plans' },
      { status: 500 }
    );
  }
}
