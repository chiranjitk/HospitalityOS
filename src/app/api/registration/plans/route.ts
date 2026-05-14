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

// GET /api/registration/plans (PUBLIC)
export async function GET() {
  try {
    // Sync from SubscriptionPlan (idempotent)
    await ensureRegistrationPlansSeeded();

    const plans = await db.registrationPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const plansWithFeatureCount = plans.map((plan) => {
      let featureCount = 0;
      try {
        const features = JSON.parse(plan.features);
        featureCount = Array.isArray(features) ? features.length : 0;
      } catch {
        featureCount = 0;
      }

      return {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        maxProperties: plan.maxProperties,
        maxRoomsPerProperty: plan.maxRoomsPerProperty,
        maxUsers: plan.maxUsers,
        maxStaff: plan.maxStaff,
        features: plan.features,
        featureCount,
        highlighted: plan.highlighted,
        trialDays: plan.trialDays,
        sortOrder: plan.sortOrder,
      };
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
