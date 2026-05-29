import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { evaluateTransaction } from '@/lib/fraud-detection';
import crypto from 'crypto';

// ── Split Payment Fraud Detection Thresholds ───────────────────────────
// Configurable limits for split-payment-specific fraud detection.
// These guard against abuse patterns unique to split payments (e.g., structuring
// many small amounts to evade per-transaction limits).

/** Maximum allowed amount for any single segment in a split payment */
const SPLIT_MAX_INDIVIDUAL_AMOUNT = 10_000;

/** Maximum number of payment segments allowed in a single split */
const SPLIT_MAX_COUNT = 10;

/** If a split has ≥ this many segments, check for structuring */
const SPLIT_STRUCTURING_MIN_COUNT = 5;

/** Per-segment amount threshold for structuring detection */
const SPLIT_STRUCTURING_MAX_AMOUNT = 200;

// Generate a transaction ID
function generateTransactionId(): string {
  // Generate a proper UUID v4 for the transactionId column (which is UUID type in DB)
  return crypto.randomUUID();
}

// POST /api/payments/split - Create multiple payment records in a transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { folioId, payments: splitPayments } = body;

    // Validate required fields
    if (!folioId || !Array.isArray(splitPayments) || splitPayments.length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'folioId and at least 2 payment methods are required' } },
        { status: 400 }
      );
    }

    // Validate each payment entry
    const validMethods = ['cash', 'card', 'bank_transfer', 'upi', 'online'];
    for (const p of splitPayments) {
      if (!p.method || !validMethods.includes(p.method)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_METHOD', message: `Invalid payment method: ${p.method}. Must be one of: ${validMethods.join(', ')}` } },
          { status: 400 }
        );
      }
      if (!p.amount || typeof p.amount !== 'number' || p.amount <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_AMOUNT', message: 'Each payment amount must be greater than 0' } },
          { status: 400 }
        );
      }
    }

    // Verify folio exists and belongs to the tenant
    const folio = await db.folio.findUnique({
      where: { id: folioId },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (folio.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Folio does not belong to your tenant' } },
        { status: 403 }
      );
    }

    // Validate total amounts
    const totalSplitAmount = splitPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);

    if (totalSplitAmount > folio.balance + 0.005) {
      return NextResponse.json(
        { success: false, error: { code: 'EXCEEDS_BALANCE', message: `Total split amount exceeds folio balance of ${folio.balance.toFixed(2)}` } },
        { status: 400 }
      );
    }

    // ── Fraud Detection for Split Payments (H-19 fix) ────────────────────
    // Split payments are a higher-risk vector because they can circumvent
    // per-method limits and per-transaction caps. We run both split-specific
    // structural checks and the standard fraud detection engine on every
    // individual segment. If ANY check fails, the entire split is rejected.

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')?.trim()
      || undefined;
    const guestId = folio.booking?.primaryGuest?.id;

    // 1. Excessive split count — more than SPLIT_MAX_COUNT segments is suspicious
    if (splitPayments.length > SPLIT_MAX_COUNT) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FRAUD_DETECTED',
            message: `Split payment rejected: too many payment segments (${splitPayments.length}, maximum ${SPLIT_MAX_COUNT}). This may indicate structuring.`,
          },
        },
        { status: 403 }
      );
    }

    // 2. Per-segment amount cap — no single segment may exceed the threshold
    for (const p of splitPayments) {
      if (p.amount > SPLIT_MAX_INDIVIDUAL_AMOUNT) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FRAUD_DETECTED',
              message: `Split payment rejected: individual segment of $${p.amount.toFixed(2)} exceeds the per-segment limit of $${SPLIT_MAX_INDIVIDUAL_AMOUNT.toLocaleString()}.`,
            },
          },
          { status: 403 }
        );
      }
    }

    // 3. Structuring detection — many small equal/near-equal amounts to evade caps
    if (splitPayments.length >= SPLIT_STRUCTURING_MIN_COUNT) {
      const allSmall = splitPayments.every((p: { amount: number }) => p.amount <= SPLIT_STRUCTURING_MAX_AMOUNT);
      if (allSmall) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FRAUD_DETECTED',
              message: 'Split payment rejected: unusual pattern of many small-amount segments detected. This is consistent with structuring to avoid transaction limits.',
            },
          },
          { status: 403 }
        );
      }
    }

    // 4. Per-segment fraud engine evaluation — reuse the same evaluateTransaction()
    //    that the single-payment route uses. If any segment triggers a block or
    //    high risk score, reject the entire split.
    for (const p of splitPayments) {
      const fraudResult = await evaluateTransaction({
        tenantId: user.tenantId,
        amount: p.amount,
        currency: folio.currency || 'USD',
        userId: guestId || user.id,
        ip: clientIp,
        paymentMethod: p.method,
      });

      if (fraudResult.action === 'block' || fraudResult.riskScore >= 70) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FRAUD_DETECTED',
              message: 'Split payment rejected: fraud detection triggered on an individual payment segment.',
            },
            fraudDetails: {
              riskScore: fraudResult.riskScore,
              alerts: fraudResult.alerts,
              triggeredMethod: p.method,
              triggeredAmount: p.amount,
              splitCount: splitPayments.length,
            },
          },
          { status: 403 }
        );
      }
    }

    // Process all payments in a transaction
    const createdPayments = await db.$transaction(async (tx) => {
      const results = [];

      for (let i = 0; i < splitPayments.length; i++) {
        const p = splitPayments[i];

        const payment = await tx.payment.create({
          data: {
            tenantId: user.tenantId,
            folioId,
            amount: p.amount,
            currency: folio.currency,
            method: p.method,
            gateway: p.method === 'card' ? 'manual' : p.method === 'online' ? 'manual' : p.method,
            cardType: p.cardType || null,
            cardLast4: p.cardLast4 || null,
            reference: p.reference || `Split ${i + 1}/${splitPayments.length}`,
            transactionId: generateTransactionId(),
            status: 'completed',
            processedAt: new Date(),
          },
          include: {
            folio: {
              select: {
                id: true,
                folioNumber: true,
                booking: {
                  select: {
                    id: true,
                    confirmationCode: true,
                    primaryGuest: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            guest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        results.push(payment);
      }

      // Update folio balance
      const newPaidAmount = Math.round(((folio.paidAmount || 0) + totalSplitAmount) * 100) / 100;
      const newBalance = Math.round(((folio.totalAmount || 0) - newPaidAmount) * 100) / 100;

      await tx.folio.update({
        where: { id: folioId },
        data: {
          paidAmount: Math.max(0, newPaidAmount),
          balance: Math.max(0, newBalance),
          status: newBalance <= 0.005 ? 'paid' : folio.status,
          closedAt: newBalance <= 0.005 ? new Date() : folio.closedAt,
        },
      });

      return results;
    });

    // Audit log for split payment
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'create',
          entityType: 'payment_split',
          entityId: folioId,
          newValue: {
            folioId,
            folioNumber: folio.folioNumber,
            totalSplitAmount,
            splitCount: splitPayments.length,
            methods: splitPayments.map((p: { method: string; amount: number }) => ({ method: p.method, amount: p.amount })),
            currency: folio.currency,
          },
          details: {
            event: 'split_payment',
            folioId,
            folioNumber: folio.folioNumber,
            totalSplitAmount,
            splitCount: splitPayments.length,
            bookingId: folio.booking?.id,
            paymentIds: createdPayments.map((p: { id: string }) => p.id),
          },
        },
        request
      );
    } catch (auditError) {
      console.error('[Audit] Failed to log split payment:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        payments: createdPayments,
        totalAmount: totalSplitAmount,
        folioId,
      },
    });
  } catch (error) {
    console.error('Error processing split payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process split payment' } },
      { status: 500 }
    );
  }
}
