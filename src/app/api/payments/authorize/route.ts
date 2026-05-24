import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStripeGateway } from '@/lib/payments/gateways/stripe';
import { PaymentRequest, PaymentResult } from '@/lib/payments/types';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logPayment } from '@/lib/audit/middleware';
import crypto from 'crypto';

// Helper function to generate transaction ID
function generateTransactionId(): string {
  // Generate a proper UUID v4 for the transactionId column (which is UUID type in DB)
  return crypto.randomUUID();
}

// POST /api/payments/authorize — Pre-authorize a payment (hold funds, don't capture)
export async function POST(request: NextRequest) {
  try {
    // ── Authentication & Authorization ──
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    // ── Parse & validate body ──
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      folioId,
      amount,
      currency = 'USD',
      method,
      cardType: inputCardType,
      cardLast4: inputCardLast4,
      cardExpiry,
      guestId,
      description,
      token,
      cardData,
    } = body;

    // Required fields
    if (!folioId || !amount || !method) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, amount, method' } },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' } },
        { status: 400 },
      );
    }

    // Check for duplicate authorization (same folio + method + status=authorized)
    if (folioId && method) {
      const existingAuth = await db.payment.findFirst({
        where: {
          folioId,
          method,
          status: 'authorized',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Within 24 hours
        },
      });
      if (existingAuth) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_AUTHORIZATION', message: `An active authorization already exists for this folio (payment ${existingAuth.id}). Capture or void it before creating a new one.` } },
          { status: 409 },
        );
      }
    }

    // ── Verify folio exists and is open ──
    const folio = await db.folio.findUnique({
      where: { id: folioId },
      include: {
        booking: {
          select: { id: true, confirmationCode: true },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FOLIO', message: 'Folio not found' } },
        { status: 400 },
      );
    }

    if (folio.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FOLIO', message: 'Folio not found' } },
        { status: 404 },
      );
    }

    if (folio.status !== 'open' && folio.status !== 'partially_paid') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_NOT_OPEN', message: 'Folio must be open or partially paid to authorize payments' } },
        { status: 400 },
      );
    }

    // ── Determine resolved guestId (from request or folio) ──
    const resolvedGuestId = guestId || folio.guestId;

    // ── Process through gateway if Stripe card payment ──
    let gateway = method === 'cash' || method === 'bank_transfer' ? 'manual' : method;
    let gatewayRef: string | null = null;
    let gatewayFee: number | null = null;
    let gatewayStatus: string | null = null;
    let cardType = inputCardType;
    let cardLast4 = inputCardLast4;
    let stripeGatewayToken: string | null = null;

    if (method === 'card' && token) {
      // Look up the active Stripe gateway config for this tenant
      const gatewayConfig = await db.paymentGateway.findFirst({
        where: { tenantId, provider: 'stripe', status: 'active' },
      });

      if (gatewayConfig) {
        const stripeGateway = createStripeGateway({
          id: gatewayConfig.id,
          apiKey: gatewayConfig.apiKey || process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: gatewayConfig.webhookSecret ?? undefined,
          feePercentage: gatewayConfig.feePercentage,
          feeFixed: gatewayConfig.feeFixed,
        });

        const paymentRequest: PaymentRequest = {
          amount,
          currency,
          description: description || `Pre-authorization for folio ${folio.folioNumber}`,
          token,
          cardData,
          guestId: resolvedGuestId,
          folioId,
          bookingId: folio.bookingId,
          captureMethod: 'manual',
        };

        const result: PaymentResult = await stripeGateway.processPayment(paymentRequest);

        gateway = 'stripe';
        gatewayRef = result.gatewayRef || null;
        gatewayFee = result.gatewayFee || null;
        gatewayStatus = result.status;
        cardType = result.cardType || cardType;
        cardLast4 = result.last4 || cardLast4;
        stripeGatewayToken = token; // keep for PaymentToken storage

        if (!result.success) {
          // Record failed authorization attempt
          await db.payment.create({
            data: {
              tenantId,
              folioId,
              guestId: resolvedGuestId,
              amount,
              currency,
              method,
              gateway,
              gatewayRef,
              gatewayStatus: 'failed',
              cardType,
              cardLast4,
              cardExpiry,
              transactionId: generateTransactionId(),
              status: 'failed',
            },
          });

          return NextResponse.json(
            {
              success: false,
              error: {
                code: result.errorCode || 'AUTHORIZATION_FAILED',
                message: result.errorMessage || 'Payment authorization failed',
                gateway,
              },
            },
            { status: 400 },
          );
        }

        // For Stripe, a manual-capture intent comes back with status 'requires_capture'
        // which we map to 'authorized' in our system.
        if (result.status === 'processing' || result.transactionId) {
          gatewayStatus = 'requires_capture';
        }
      } else {
        // No Stripe gateway configured — fallback to manual authorization
        gateway = 'manual';
        gatewayStatus = 'authorized';
      }
    } else if (method !== 'card') {
      // Non-card (cash, bank_transfer, etc.) — immediate authorization
      gatewayStatus = 'authorized';
    } else if (method === 'card' && !token) {
      // Card payment without a token — manual / on-file card scenario
      gateway = 'manual';
      gatewayStatus = 'authorized';
    }

    // ── Generate transaction ID ──
    const transactionId = gatewayRef || generateTransactionId();

    // ── Create the authorized Payment + token in a transaction ──
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          folioId,
          guestId: resolvedGuestId,
          amount,
          currency,
          method,
          gateway,
          gatewayRef,
          gatewayFee,
          gatewayStatus,
          cardType,
          cardLast4,
          cardExpiry,
          transactionId,
          status: 'authorized',
        },
        include: {
          folio: {
            select: { id: true, folioNumber: true },
          },
          guest: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // ── Store card token in PaymentToken model if a Stripe token was used ──
      if (stripeGatewayToken && resolvedGuestId) {
        try {
          const [expMonth, expYear] = cardExpiry ? cardExpiry.split('/').map(Number) : [null, null];

          await tx.paymentToken.create({
            data: {
              tenantId,
              guestId: resolvedGuestId,
              folioId,
              tokenType: 'stripe_token',
              gatewayTokenId: stripeGatewayToken,
              cardType: cardType || 'credit',
              cardLast4: cardLast4 || '',
              cardExpiryMonth: expMonth || null,
              cardExpiryYear: expYear ? (expYear < 100 ? 2000 + expYear : expYear) : null,
              cardBrand: cardType,
              isDefault: false,
              status: 'active',
            },
          });
        } catch (tokenError) {
          // Non-blocking — the authorization succeeded, token storage is best-effort
          console.error('[Authorize] Failed to store payment token (non-blocking):', tokenError);
        }
      }

      return newPayment;
    });

    // ── Update gateway statistics if used ──
    if (gateway && gateway !== 'manual') {
      await db.paymentGateway.updateMany({
        where: { tenantId, provider: gateway },
        data: {
          totalTransactions: { increment: 1 },
          totalVolume: { increment: amount },
          lastSyncAt: new Date(),
        },
      });
    }

    // ── Audit log (non-blocking) ──
    try {
      await logPayment(request, 'create', payment.id, {
        amount,
        currency,
        method,
        gateway,
        gatewayRef,
        transactionId,
        status: 'authorized',
        folioNumber: payment.folio?.folioNumber,
        guestName: payment.guest ? `${payment.guest.firstName} ${payment.guest.lastName}` : undefined,
      }, { tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json(
      {
        success: true,
        data: payment,
        authorization: {
          status: 'authorized',
          gatewayRef,
          gatewayStatus,
          expiresAt: gateway === 'stripe'
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Stripe auth expires in 7 days
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating payment authorization:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment authorization' } },
      { status: 500 },
    );
  }
}
