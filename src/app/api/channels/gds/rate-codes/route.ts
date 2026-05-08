import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/channels/gds/rate-codes — list GDS rate codes
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.view', 'channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const rateCodes = await db.gdsRateCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rateCodes });
  } catch (error) {
    console.error('Error listing GDS rate codes:', error);
    return NextResponse.json({ success: false, error: 'Failed to list GDS rate codes' }, { status: 500 });
  }
}

// POST /api/channels/gds/rate-codes — create a GDS rate code
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { connectionId, code, name, rateType, description, roomTypeId, ratePlanId, minStay, maxStay, baseRate, currency } = body;

    if (!connectionId || !code || !name) {
      return NextResponse.json({ success: false, error: 'connectionId, code, and name are required' }, { status: 400 });
    }

    const rateCode = await db.gdsRateCode.create({
      data: {
        tenantId: user.tenantId,
        connectionId,
        code,
        name,
        rateType: rateType ?? 'BAR',
        description: description ?? null,
        roomTypeId: roomTypeId ?? null,
        ratePlanId: ratePlanId ?? null,
        minStay: minStay ?? null,
        maxStay: maxStay ?? null,
        baseRate: baseRate ?? null,
        currency: currency ?? 'USD',
      },
    });

    return NextResponse.json({ success: true, data: rateCode }, { status: 201 });
  } catch (error) {
    console.error('Error creating GDS rate code:', error);
    return NextResponse.json({ success: false, error: 'Failed to create GDS rate code' }, { status: 500 });
  }
}
