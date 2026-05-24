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

    // Validate tokenRef is a non-empty string
    if (typeof tokenRef !== 'string' || tokenRef.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'tokenRef must be a non-empty string' }, { status: 400 });
    }

    // Validate gateway if provided
    const validGateways = ['stripe', 'adyen', 'worldpay', 'braintree', 'custom'];
    if (gateway && !validGateways.includes(gateway)) {
      return NextResponse.json({ success: false, error: `Invalid gateway. Must be one of: ${validGateways.join(', ')}` }, { status: 400 });
    }

    // Validate tokenType if provided
    const validTokenTypes = ['card', 'bank_account', 'wallet'];
    if (tokenType && !validTokenTypes.includes(tokenType)) {
      return NextResponse.json({ success: false, error: `Invalid tokenType. Must be one of: ${validTokenTypes.join(', ')}` }, { status: 400 });
    }

    // Validate cardLast4 if provided (exactly 4 digits)
    if (cardLast4 && (!/^[0-9]{4}$/.test(String(cardLast4)))) {
      return NextResponse.json({ success: false, error: 'cardLast4 must be exactly 4 digits' }, { status: 400 });
    }

    // Validate expiry month/year if provided
    if (expiryMonth !== undefined && (expiryMonth < 1 || expiryMonth > 12)) {
      return NextResponse.json({ success: false, error: 'expiryMonth must be between 1 and 12' }, { status: 400 });
    }
    if (expiryYear !== undefined && (expiryYear < 2020 || expiryYear > 2099)) {
      return NextResponse.json({ success: false, error: 'expiryYear must be between 2020 and 2099' }, { status: 400 });
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
