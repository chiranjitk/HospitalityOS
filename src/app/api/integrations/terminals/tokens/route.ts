import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/terminals/tokens — list stored tokens
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const gateway = searchParams.get('gateway');
    const tokenStatus = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (guestId) where.guestId = guestId;
    if (gateway) where.gateway = gateway;
    if (tokenStatus) where.status = tokenStatus;

    const tokens = await db.storedToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    console.error('Error listing stored tokens:', error);
    return NextResponse.json({ success: false, error: 'Failed to list tokens' }, { status: 500 });
  }
}

// POST /api/integrations/terminals/tokens — create a stored token
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { guestId, gateway, tokenType, tokenRef, cardLast4, cardBrand, expiryMonth, expiryYear, isDefault } = body;

    if (!tokenRef) {
      return NextResponse.json({ success: false, error: 'tokenRef is required' }, { status: 400 });
    }

    const token = await db.storedToken.create({
      data: {
        tenantId: user.tenantId,
        guestId: guestId ?? null,
        gateway: gateway ?? 'stripe',
        tokenType: tokenType ?? 'card',
        tokenRef,
        cardLast4: cardLast4 ?? null,
        cardBrand: cardBrand ?? null,
        expiryMonth: expiryMonth ?? null,
        expiryYear: expiryYear ?? null,
        isDefault: isDefault ?? false,
      },
    });

    return NextResponse.json({ success: true, data: token }, { status: 201 });
  } catch (error) {
    console.error('Error creating stored token:', error);
    return NextResponse.json({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}
