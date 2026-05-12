import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStripeGateway } from '@/lib/payments/gateways/stripe';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logPayment } from '@/lib/audit/middleware';

// POST /api/payments/[id]/void — Void (cancel) a previously authorized payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Authentication & Authorization ──
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id: paymentId } = await params;

    // ── Fetch the authorized payment ──
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        folio: {
          select: {
            id: true,
            folioNumber: true,
            bookingId: true,
            booking: {
              select: { confirmationCode: true },
            },
          },
        },
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 },
      );
    }

    if (payment.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 },
      );
    }

    // ── Validate payment is authorized ──
    if (payment.status !== 'authorized') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Payment must be in 'authorized' status to void. Current status: '${payment.status}'`,
          },
        },
        { status: 400 },
      );
    }

    // ── Call Stripe void/cancel API if this is a Stripe payment ──
    if (payment.gateway === 'stripe' && payment.gatewayRef) {
      const gatewayConfig = await db.paymentGateway.findFirst({
        where: { tenantId: payment.tenantId, provider: 'stripe', status: 'active' },
      });

      if (gatewayConfig) {
        const stripeGateway = createStripeGateway({
          id: gatewayConfig.id,
          apiKey: gatewayConfig.apiKey || process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: gatewayConfig.webhookSecret ?? undefined,
          feePercentage: gatewayConfig.feePercentage,
          feeFixed: gatewayConfig.feeFixed,
        });

        try {
          const voidResult = await voidStripePaymentIntent(
            stripeGateway,
            payment.gatewayRef,
          );

          if (!voidResult.success) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'VOID_FAILED',
                  message: voidResult.errorMessage || 'Failed to void payment from gateway',
                },
              },
              { status: 400 },
            );
          }
        } catch (stripeError) {
          console.error('[Void] Stripe void error:', stripeError);
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'GATEWAY_ERROR',
                message: 'Failed to communicate with payment gateway',
              },
            },
            { status: 502 },
          );
        }
      }
    }

    // ── Void the payment — update status only, NO folio line item ──
    const updatedPayment = await db.payment.update({
      where: { id: paymentId },
      data: {
        status: 'voided',
        gatewayStatus: 'canceled',
      },
      include: {
        folio: {
          select: {
            id: true,
            folioNumber: true,
            booking: {
              select: { confirmationCode: true },
            },
          },
        },
        guest: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // ── Void any associated PaymentTokens that were created with this auth ──
    // (best-effort, non-blocking)
    try {
      if (payment.guestId && payment.folioId) {
        await db.paymentToken.updateMany({
          where: {
            guestId: payment.guestId,
            folioId: payment.folioId,
            tokenType: 'stripe_token',
            status: 'active',
          },
          data: {
            status: 'revoked',
          },
        });
      }
    } catch (tokenError) {
      console.error('[Void] Failed to revoke payment tokens (non-blocking):', tokenError);
    }

    // ── Audit log (non-blocking) ──
    try {
      await logPayment(request, 'void', paymentId, {
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        gateway: payment.gateway,
        gatewayRef: payment.gatewayRef,
        transactionId: payment.transactionId,
        folioNumber: updatedPayment.folio?.folioNumber,
        guestName: updatedPayment.guest
          ? `${updatedPayment.guest.firstName} ${updatedPayment.guest.lastName}`
          : undefined,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: updatedPayment,
      void: {
        amount: payment.amount,
        currency: payment.currency,
        voidedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error voiding payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to void payment' } },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// Stripe void helper — cancels a Payment Intent that hasn't been captured
// ────────────────────────────────────────────
async function voidStripePaymentIntent(
  stripeGateway: ReturnType<typeof import('@/lib/payments/gateways/stripe').createStripeGateway>,
  paymentIntentId: string,
): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    const config = stripeGateway.getConfig();
    const apiKey = config.apiKey;

    if (!apiKey) {
      return { success: false, errorMessage: 'Stripe API key not configured' };
    }

    // POST to /v1/payment_intents/:id/cancel — this cancels an uncaptured intent
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = responseData.error as { message?: string; code?: string } | undefined;
      console.error('[Stripe Void] Error:', error);
      return {
        success: false,
        errorMessage: error?.message || `Stripe void failed with status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Stripe Void] Exception:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error during Stripe void',
    };
  }
}
