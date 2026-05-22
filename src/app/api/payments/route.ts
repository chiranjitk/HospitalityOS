import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPaymentRouter } from '@/lib/payments';
import crypto from 'crypto';
import { PaymentRequest } from '@/lib/payments/types';
import { logPayment } from '@/lib/audit';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { notifyPaymentReceived, notifyPaymentFailed } from '@/lib/notify';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { evaluateTransaction } from '@/lib/fraud-detection';
import { fireAutomationEvent } from '@/lib/automation/hooks';

// Helper function to generate transaction ID
function generateTransactionId(): string {
  // Generate a proper UUID v4 for the transactionId column (which is UUID type in DB)
  return crypto.randomUUID();
}

// GET /api/payments - List all payments with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const gateway = searchParams.get('gateway');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (folioId) {
      where.folioId = folioId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    if (gateway) {
      where.gateway = gateway;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { transactionId: { contains: search,  } },
        { reference: { contains: search,  } },
        { gatewayRef: { contains: search,  } },
      ];
    }

    const payments = await db.payment.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.payment.count({ where });

    // Calculate summary statistics
    const summary = await db.payment.aggregate({
      where,
      _sum: {
        amount: true,
        refundAmount: true,
        gatewayFee: true,
      },
      _count: {
        id: true,
      },
    });

    // Get gateway breakdown
    const gatewayBreakdown = await db.payment.groupBy({
      by: ['gateway'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    });

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalAmount: summary._sum.amount || 0,
        totalRefunded: summary._sum.refundAmount || 0,
        totalGatewayFees: summary._sum.gatewayFee || 0,
        count: summary._count.id,
      },
      gatewayBreakdown: gatewayBreakdown.map(g => ({
        gateway: g.gateway || 'manual',
        count: g._count.id,
        amount: g._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payments' } },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create a new payment using gateway router
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
    const data = nullifyEmptyStrings(body);
    const tenantId = user.tenantId;

    const {
      folioId,
      guestId,
      amount,
      currency = '',
      method,
      gateway: preferredGateway,
      cardData,
      token,
      cardType: inputCardType,
      cardLast4: inputCardLast4,
      cardExpiry,
      reference,
      idempotencyKey,
      description,
      status: requestedStatus,
    } = data;

    // Validate required fields
    if (!folioId || !amount || !method) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, amount, method' } },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' } },
        { status: 400 }
      );
    }

    // Verify folio exists and check tenant ownership via the folio's booking
    const folio = await db.folio.findUnique({
      where: { id: folioId },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            tenantId: true,
          },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FOLIO', message: 'Folio not found' } },
        { status: 400 }
      );
    }

    // Verify tenant ownership — prevent cross-tenant payments
    if (folio.booking.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Folio does not belong to your tenant' } },
        { status: 403 }
      );
    }

    // Resolve currency from folio if not explicitly provided
    const resolvedCurrency = currency || folio.currency || 'INR';

    // SECURITY FIX (P-01): Overpayment guard. Prevent payments that exceed
    // the outstanding folio balance, which would make the balance deeply negative
    // and enable revenue leakage.
    if (amount > folio.balance) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OVERPAYMENT',
            message: `Payment amount exceeds outstanding balance of ${folio.balance.toFixed(2)}`,
          },
        },
        { status: 400 }
      );
    }

    // SECURITY FIX (P-02): Fraud detection enforcement. Run the fraud detection
    // engine before processing any payment. If the risk score is high (> 0.7 = 70
    // on the 0-100 scale), block the payment and create a fraud alert record.
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const fraudResult = await evaluateTransaction({
      tenantId,
      amount,
      currency: resolvedCurrency,
      userId: guestId || user.id,
      ip: clientIp,
      paymentMethod: method,
    });

    if (fraudResult.riskScore >= 70 || fraudResult.action === 'block') {
      // Record the blocked payment attempt
      await db.payment.create({
        data: {
          tenantId,
          folioId,
          guestId: guestId || null,
          amount,
          currency: resolvedCurrency,
          method,
          transactionId: generateTransactionId(),
          reference,
          status: 'failed',
          gatewayStatus: 'fraud_blocked',
          idempotencyKey,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FRAUD_DETECTED',
            message: 'Payment blocked by fraud detection',
          },
          fraudDetails: {
            riskScore: fraudResult.riskScore,
            alerts: fraudResult.alerts,
          },
        },
        { status: 403 }
      );
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingPayment = await db.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        return NextResponse.json({ success: true, data: existingPayment });
      }
    }

    // Create per-request payment router for this tenant
    const router = await createPaymentRouter(tenantId);

    let paymentResult;
    let gateway = preferredGateway;
    let gatewayRef: string | null = null;
    let gatewayFee: number | null = null;
    let gatewayStatus: string | null = null;
    let retryCount = 0;
    let failoverTo: string | null = null;
    let routingDecision: string | null = null;
    let cardType = inputCardType;
    let cardLast4 = inputCardLast4;

    // Process through gateway router if card payment
    if (method === 'card' && (cardData || token)) {
      const paymentRequest: PaymentRequest = {
        amount,
        currency: resolvedCurrency,
        description: description || `Payment for folio ${folio.folioNumber}`,
        token,
        cardData,
        guestId,
        folioId,
        bookingId: folio.bookingId,
        idempotencyKey,
      };

      // Process payment through router
      paymentResult = await router.processPayment(paymentRequest);

      // Extract gateway details
      gateway = paymentResult.success ? paymentResult.metadata?.gateway : undefined;
      gatewayRef = paymentResult.gatewayRef || null;
      gatewayFee = paymentResult.gatewayFee || null;
      gatewayStatus = paymentResult.status;
      
      if (paymentResult.metadata?.attemptCount) {
        retryCount = parseInt(paymentResult.metadata.attemptCount, 10) - 1;
      }
      
      if (paymentResult.metadata?.failoverFrom) {
        failoverTo = paymentResult.metadata.failoverFrom;
      }
      
      if (paymentResult.metadata?.routingDecision) {
        routingDecision = JSON.stringify({
          reason: paymentResult.metadata.routingDecision,
        });
      }

      cardType = paymentResult.cardType || cardType;
      cardLast4 = paymentResult.last4 || cardLast4;

      if (!paymentResult.success) {
        // Record failed payment attempt
        await db.payment.create({
          data: {
            tenantId,
            folioId,
            guestId: guestId || null,
            amount,
            currency: resolvedCurrency,
            method,
            gateway,
            gatewayRef,
            gatewayStatus: 'failed',
            retryCount,
            failoverTo,
            routingDecision,
            cardType,
            cardLast4,
            cardExpiry,
            transactionId: generateTransactionId(),
            reference,
            status: 'failed',
            idempotencyKey,
          },
        });

        // GAP 4: Update booking payment status to 'failed' so it's visible
        // Don't auto-cancel — that's a business decision. Just make the status visible.
        if (folio.bookingId) {
          try {
            await db.booking.update({
              where: { id: folio.bookingId },
              data: {
                paymentStatus: 'failed',
                notes: `Payment of ${amount} ${resolvedCurrency} failed via ${method}${paymentResult.errorMessage ? ': ' + paymentResult.errorMessage : ''}`,
              },
            });
          } catch (bookingUpdateError) {
            console.error('[Payment] Failed to update booking payment status:', bookingUpdateError);
          }
        }

        notifyPaymentFailed({
          tenantId,
          userId: user.id,
          amount,
          currency,
          method: method || gateway || 'unknown',
          reason: paymentResult.errorMessage || paymentResult.errorCode || undefined,
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              code: paymentResult.errorCode || 'PAYMENT_FAILED',
              message: paymentResult.errorMessage || 'Payment processing failed',
              gateway,
              retryCount,
            },
          },
          { status: 400 }
        );
      }
    } else {
      // Non-card payments (cash, bank_transfer, etc.)
      gateway = method === 'cash' ? 'manual' : gateway;
      gatewayStatus = 'completed';
    }

    // Resolve payment status: respect client-provided status with validation,
    // but default to 'completed' for non-card payments (cash, bank_transfer, wallet)
    // since those are settled immediately.
    const VALID_STATUSES = ['pending', 'completed', 'authorized'];
    const isNonCardPayment = method !== 'card' || (!cardData && !token);
    let paymentStatus: string;

    if (requestedStatus && VALID_STATUSES.includes(requestedStatus)) {
      // Use the client-provided status if valid
      paymentStatus = requestedStatus;
    } else if (isNonCardPayment) {
      // Cash, bank_transfer, wallet — settled immediately
      paymentStatus = 'completed';
    } else {
      // Card payments processed through gateway — completed if we reached here
      paymentStatus = 'completed';
    }

    const isCompletedPayment = paymentStatus === 'completed';

    // Generate transaction ID
    const transactionId = paymentResult?.transactionId || generateTransactionId();

    // Create payment in a transaction to update folio balance
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          folioId,
          guestId: guestId || null,
          amount,
          currency: resolvedCurrency,
          method,
          gateway,
          gatewayRef,
          gatewayFee,
          gatewayStatus,
          retryCount,
          failoverTo,
          routingDecision,
          cardType,
          cardLast4,
          cardExpiry,
          transactionId,
          reference,
          status: paymentStatus,
          processedAt: isCompletedPayment ? new Date() : null,
          idempotencyKey,
        },
        include: {
          folio: {
            select: {
              id: true,
              folioNumber: true,
            },
          },
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Only update folio paid amount and balance for completed payments.
      // Pending/authorized payments (e.g., pre-auth holds) should NOT affect the
      // folio balance until they are captured/completed.
      if (isCompletedPayment) {
        const updatedFolio = await tx.folio.update({
          where: { id: folioId },
          data: {
            paidAmount: { increment: amount },
            balance: { decrement: amount },
          },
        });

        // Update folio status if fully paid
        if (updatedFolio.balance <= 0) {
          await tx.folio.update({
            where: { id: folioId },
            data: {
              status: 'paid',
              closedAt: new Date(),
            },
          });
        } else if (updatedFolio.paidAmount > 0) {
          await tx.folio.update({
            where: { id: folioId },
            data: { status: 'partially_paid' },
          });
        }
      }

      // Update gateway statistics if used
      if (gateway && gateway !== 'manual') {
        await tx.paymentGateway.updateMany({
          where: {
            tenantId,
            provider: gateway,
          },
          data: {
            totalTransactions: { increment: 1 },
            totalVolume: { increment: amount },
            lastSyncAt: new Date(),
          },
        });
      }

      return newPayment;
    });

    // Log payment to audit log
    try {
      await logPayment(request, 'payment', payment.id, {
        amount,
        currency: resolvedCurrency,
        method,
        gateway,
        transactionId,
        folioNumber: payment.folio?.folioNumber,
        guestName: payment.guest ? `${payment.guest.firstName} ${payment.guest.lastName}` : undefined,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    notifyPaymentReceived({
      tenantId: payment.tenantId,
      userId: user.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method || payment.gateway || 'unknown',
      confirmationCode: folio?.booking?.confirmationCode,
      folioNumber: folio?.folioNumber,
    });

    // Fire automation trigger for payment received
    fireAutomationEvent('payment.received', {
      tenantId: payment.tenantId,
      entityId: payment.id,
      data: {
        paymentId: payment.id,
        folioId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        gateway: payment.gateway,
        transactionId: payment.transactionId,
        status: payment.status,
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: payment,
      gatewayDetails: {
        gateway,
        gatewayRef,
        gatewayFee,
        retryCount,
        routingDecision: routingDecision ? JSON.parse(routingDecision) : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment' } },
      { status: 500 }
    );
  }
}
