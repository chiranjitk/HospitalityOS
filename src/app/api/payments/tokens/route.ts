import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { validateTokenFormat, getGatewayTokenInfo, normalizeLast4 } from '@/lib/payment-tokenization';

// GET /api/payments/tokens - List saved payment tokens for the current user/tenant
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.view', 'payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const gateway = searchParams.get('gateway');
    const status = searchParams.get('status');
    const guestId = searchParams.get('guestId');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (gateway) {
      where.gateway = gateway;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = 'active';
    }

    if (guestId) {
      where.guestId = guestId;
    }

    const tokens = await db.storedToken.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Mask sensitive data before returning
    const maskedTokens = tokens.map(token => ({
      id: token.id,
      gateway: token.gateway,
      tokenType: token.tokenType,
      cardLast4: token.cardLast4,
      cardBrand: token.cardBrand,
      expiryMonth: token.expiryMonth,
      expiryYear: token.expiryYear,
      isDefault: token.isDefault,
      status: token.status,
      guestId: token.guestId,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      // Explicitly do NOT return tokenRef
    }));

    return NextResponse.json({
      success: true,
      data: maskedTokens,
    });
  } catch (error) {
    console.error('Error fetching payment tokens:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment tokens' } },
      { status: 500 }
    );
  }
}

// POST /api/payments/tokens - Save a new payment token
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { gateway, token, tokenType, guestId, cardLast4, cardBrand, expiryMonth, expiryYear, isDefault } = body;

    // Validate required fields
    if (!gateway || !token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: gateway, token' } },
        { status: 400 }
      );
    }

    // Validate gateway is supported
    const supportedGateways = ['stripe', 'razorpay', 'paypal', 'braintree'];
    if (!supportedGateways.includes(gateway.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GATEWAY', message: `Unsupported gateway: ${gateway}. Supported: ${supportedGateways.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate token format
    if (!validateTokenFormat(gateway, token)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: `Token format is invalid for gateway: ${gateway}` } },
        { status: 400 }
      );
    }

    // SECURITY FIX (H-4): PCI-DSS compliance — reject raw card numbers.
    // Full PAN must NEVER traverse application memory. Only gateway tokens
    // (Stripe Elements, Razorpay tokens, etc.) and pre-extracted last4 are accepted.
    if (body.cardNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PCI_VIOLATION',
            message: 'Raw card numbers are not accepted. Use gateway tokenization (e.g., Stripe Elements) to create a payment token on the client side, then submit the token here.',
          },
        },
        { status: 400 }
      );
    }

    // Try to get token info from gateway (metadata from client should be passed)
    let finalCardLast4 = normalizeLast4(cardLast4);
    let finalCardBrand = cardBrand || 'unknown';
    let finalExpMonth = expiryMonth || 0;
    let finalExpYear = expiryYear || 0;

    // If no brand provided and we have last4, try to infer
    if (!cardBrand && cardLast4) {
      finalCardBrand = 'unknown';
    }

    const finalTokenType = tokenType || 'card';
    const finalIsDefault = isDefault === true;

    // If setting as default, unset existing defaults
    if (finalIsDefault) {
      await db.storedToken.updateMany({
        where: {
          tenantId: user.tenantId,
          guestId: guestId || undefined,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Create the stored token
    const storedToken = await db.storedToken.create({
      data: {
        tenantId: user.tenantId,
        guestId: guestId || null,
        gateway: gateway.toLowerCase(),
        tokenType: finalTokenType,
        tokenRef: token,
        cardLast4: finalCardLast4,
        cardBrand: finalCardBrand,
        expiryMonth: finalExpMonth,
        expiryYear: finalExpYear,
        isDefault: finalIsDefault,
        status: 'active',
      },
    });

    // Return masked response
    return NextResponse.json({
      success: true,
      data: {
        id: storedToken.id,
        gateway: storedToken.gateway,
        tokenType: storedToken.tokenType,
        cardLast4: storedToken.cardLast4,
        cardBrand: storedToken.cardBrand,
        expiryMonth: storedToken.expiryMonth,
        expiryYear: storedToken.expiryYear,
        isDefault: storedToken.isDefault,
        status: storedToken.status,
        guestId: storedToken.guestId,
        createdAt: storedToken.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving payment token:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save payment token' } },
      { status: 500 }
    );
  }
}
