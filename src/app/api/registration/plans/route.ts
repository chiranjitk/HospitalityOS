import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/registration/plans (PUBLIC)
export async function GET() {
  try {
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
