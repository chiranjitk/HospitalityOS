import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import crypto from 'crypto';

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

    // TODO: Add fraud detection check for split payments. Split payments across multiple
    // methods can be used to circumvent per-method limits. Consider calling
    // evaluateTransaction() from @/lib/fraud-detection before processing, similar to
    // the single payment flow in /api/payments.
    // H-19: Fraud detection is intentionally skipped here — this is a known gap.
    // Split payments across multiple methods can be used to circumvent per-method limits
    // and should be evaluated before processing.
    console.warn(
      `[Split Payment] H-19: Fraud detection not implemented for split payments. ` +
      `folioId=${folioId}, splitCount=${splitPayments.length}, totalAmount=${totalSplitAmount}`
    );

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
