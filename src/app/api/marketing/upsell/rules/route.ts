import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/marketing/upsell/rules — list upsell rules
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ruleType = searchParams.get('ruleType');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (ruleType) where.ruleType = ruleType;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const rules = await db.upsellRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error listing upsell rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to list rules' }, { status: 500 });
  }
}

// POST /api/marketing/upsell/rules — create an upsell rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['marketing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, ruleType, conditions, priority } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Validate conditions against defined schema
    if (conditions && typeof conditions === 'object') {
      const allowedConditionFields = ['minStay', 'maxStay', 'minGuests', 'maxGuests', 'roomType', 'bookingSource', 'leadScore', 'arrivalWindow', 'departureWindow', 'propertyId', 'eventType'];
      for (const key of Object.keys(conditions)) {
        if (!allowedConditionFields.includes(key)) {
          return NextResponse.json({ success: false, error: `Invalid condition field: ${key}. Allowed: ${allowedConditionFields.join(', ')}` }, { status: 400 });
        }
      }
    }

    const rule = await db.upsellRule.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description ?? null,
        ruleType: ruleType ?? 'guest_segment',
        conditions: JSON.stringify(conditions ?? {}),
        priority: priority ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating upsell rule:', error);
    return NextResponse.json({ success: false, error: 'Failed to create rule' }, { status: 500 });
  }
}
