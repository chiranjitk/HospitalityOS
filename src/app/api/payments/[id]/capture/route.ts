import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStripeGateway } from '@/lib/payments/gateways/stripe';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logPayment, logFolio } from '@/lib/audit/middleware';
import { notifyPaymentReceived } from '@/lib/notify';

// POST /api/payments/[id]/capture — Capture a previously authorized payment
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
            propertyId: true,
            balance: true,
            paidAmount: true,
            totalAmount: true,
            status: true,
            booking: {
              select: { id: true, confirmationCode: true },
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
            message: `Payment must be in 'authorized' status to capture. Current status: '${payment.status}'`,
          },
        },
        { status: 400 },
      );
    }

    // ── Parse request body for optional partial capture amount ──
    const body = await request.json();
    const captureAmount: number | undefined = body.amount;

    // If amount is provided, validate it
    if (captureAmount !== undefined) {
      if (captureAmount <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_AMOUNT', message: 'Capture amount must be greater than 0' } },
          { status: 400 },
        );
      }
      if (captureAmount > payment.amount) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AMOUNT_EXCEEDS_AUTHORIZED',
              message: `Capture amount (${captureAmount}) exceeds authorized amount (${payment.amount})`,
            },
          },
          { status: 400 },
        );
      }
    }

    const finalAmount = captureAmount ?? payment.amount;

    // ── Call Stripe capture API if this is a Stripe payment ──
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
          // Use Stripe's capture endpoint via the gateway's makeRequest (internal)
          // We call the Stripe API directly through a dedicated capture method
          const captureResult = await captureStripePayment(
            stripeGateway,
            payment.gatewayRef,
            finalAmount,
            payment.currency,
          );

          if (!captureResult.success) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'CAPTURE_FAILED',
                  message: captureResult.errorMessage || 'Failed to capture payment from gateway',
                },
              },
              { status: 400 },
            );
          }
        } catch (stripeError) {
          console.error('[Capture] Stripe capture error:', stripeError);
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

    // ── Capture in a database transaction: update payment, folio balance, create line item ──
    const result = await db.$transaction(async (tx) => {
      // 1. Update payment status to completed
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          processedAt: new Date(),
          amount: Math.round(finalAmount * 100) / 100, // Round for partial capture precision
          gatewayStatus: 'succeeded',
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

      // 2. Update folio balance (rounded to prevent floating point drift)
      const roundedCaptureAmount = Math.round(finalAmount * 100) / 100;
      // Fetch current folio balance before update for safe calculation
      const folioBeforeCapture = await tx.folio.findUnique({ where: { id: payment.folioId } });
      const prevBalance = folioBeforeCapture?.balance ?? 0;
      const updatedFolio = await tx.folio.update({
        where: { id: payment.folioId },
        data: {
          paidAmount: { increment: roundedCaptureAmount },
          balance: Math.max(0, Math.round((prevBalance - roundedCaptureAmount) * 100) / 100),
        },
      });

      // 3. Update folio status if fully paid
      if (updatedFolio.balance <= 0) {
        await tx.folio.update({
          where: { id: payment.folioId },
          data: { status: 'paid', closedAt: new Date() },
        });
      } else if (updatedFolio.paidAmount > 0) {
        await tx.folio.update({
          where: { id: payment.folioId },
          data: { status: 'partially_paid' },
        });
      }

      // Note: Payments do NOT create FolioLineItems — payments are tracked
      // via folio.paidAmount, not as line items. Creating negative line items
      // would cause totalAmount drift.

      // 4. Update gateway statistics
      if (payment.gateway && payment.gateway !== 'manual') {
        await tx.paymentGateway.updateMany({
          where: { tenantId: payment.tenantId, provider: payment.gateway },
          data: { lastSyncAt: new Date() },
        });
      }

      return { updatedPayment, updatedFolio };
    });

    // ── Audit log (non-blocking) ──
    try {
      await logPayment(request, 'capture', paymentId, {
        amount: finalAmount,
        currency: payment.currency,
        originalAmount: payment.amount,
        method: payment.method,
        gateway: payment.gateway,
        gatewayRef: payment.gatewayRef,
        transactionId: payment.transactionId,
        isPartialCapture: captureAmount !== undefined && captureAmount !== payment.amount,
        folioNumber: result.updatedPayment.folio?.folioNumber,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    try {
      await logFolio(request, 'update', payment.folioId, {
        action: 'payment_captured',
        amount: finalAmount,
        newBalance: result.updatedFolio.balance,
        newStatus: result.updatedFolio.status,
        folioNumber: result.updatedPayment.folio?.folioNumber,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Folio audit log failed (non-blocking):', auditError);
    }

    // ── Notification ──
    try {
      notifyPaymentReceived({
        tenantId: payment.tenantId,
        userId: user.id,
        amount: finalAmount,
        currency: payment.currency,
        method: payment.method || payment.gateway || 'unknown',
        confirmationCode: payment.folio?.booking?.confirmationCode,
        folioNumber: payment.folio?.folioNumber,
      });
    } catch (notifyError) {
      console.error('Notification failed (non-blocking):', notifyError);
    }

    return NextResponse.json({
      success: true,
      data: result.updatedPayment,
      folio: {
        id: result.updatedFolio.id,
        balance: result.updatedFolio.balance,
        paidAmount: result.updatedFolio.paidAmount,
        status: result.updatedFolio.status,
      },
      capture: {
        amount: finalAmount,
        originalAuthAmount: payment.amount,
        isPartial: captureAmount !== undefined && captureAmount !== payment.amount,
      },
    });
  } catch (error) {
    console.error('Error capturing payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to capture payment' } },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// Stripe capture helper — uses the Stripe Payment Intents capture API
// ────────────────────────────────────────────
async function captureStripePayment(
  stripeGateway: ReturnType<typeof import('@/lib/payments/gateways/stripe').createStripeGateway>,
  paymentIntentId: string,
  amount: number,
  currency: string,
): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    // Access the internal makeRequest method via the gateway's config
    // The StripeGateway class exposes getConfig() but not makeRequest directly.
    // Instead, we'll call Stripe's capture API via fetch.

    // Get the API key from the gateway config
    const config = stripeGateway.getConfig();
    const apiKey = config.apiKey;

    if (!apiKey) {
      return { success: false, errorMessage: 'Stripe API key not configured' };
    }

    const captureData: Record<string, string> = {};

    // If amount is specified, convert to cents for Stripe (partial capture)
    if (amount) {
      captureData.amount_to_capture = Math.round(amount * 100).toString();
    }

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      },
      body: new URLSearchParams(captureData).toString(),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = responseData.error as { message?: string; code?: string } | undefined;
      console.error('[Stripe Capture] Error:', error);
      return {
        success: false,
        errorMessage: error?.message || `Stripe capture failed with status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Stripe Capture] Exception:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error during Stripe capture',
    };
  }
}
