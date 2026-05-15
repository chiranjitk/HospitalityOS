import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Helper to generate transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

// GET /api/guest-app/pay - Get payment configuration (gateways available) for a guest booking
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        currency: true,
        folios: {
          where: { status: { in: ['open', 'partially_paid'] } },
          select: {
            id: true,
            balance: true,
            totalAmount: true,
            paidAmount: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    // Get active payment gateways for the tenant
    const gateways = await db.paymentGateway.findMany({
      where: {
        tenantId: booking.tenantId,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        provider: true,
        mode: true,
        supportedCurrencies: true,
        feePercentage: true,
        feeFixed: true,
      },
      orderBy: { priority: 'asc' },
    });

    const folio = booking.folios[0];
    const balance = folio?.balance || 0;

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        folioId: folio?.id || null,
        balanceDue: balance,
        currency: booking.currency,
        gateways: gateways.map((g) => ({
          id: g.id,
          name: g.name,
          provider: g.provider,
          mode: g.mode,
          feePercentage: g.feePercentage,
          feeFixed: g.feeFixed,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching guest payment config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment configuration' } },
      { status: 500 }
    );
  }
}

// POST /api/guest-app/pay - Process a guest payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, folioId, amount, method, gateway, cardType, cardLast4 } = body;

    if (!token || !folioId || !amount || !method) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: token, folioId, amount, method' } },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        primaryGuest: true,
        folios: {
          where: { id: folioId, status: { in: ['open', 'partially_paid'] } },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    const folio = booking.folios[0];
    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (amount > folio.balance) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount exceeds outstanding balance' } },
        { status: 400 }
      );
    }

    // Generate transaction ID
    const transactionId = generateTransactionId();

    // Process the payment - for card payments through a gateway, record as pending
    // For manual payments (cash at desk, etc.), record directly as completed
    const isCardPayment = method === 'card';
    const paymentStatus = isCardPayment ? 'processing' : 'completed';
    const gatewayStatus = isCardPayment ? 'pending' : 'completed';

    // For card payments, verify gateway is configured
    if (isCardPayment && gateway) {
      const gatewayConfig = await db.paymentGateway.findFirst({
        where: {
          tenantId: booking.tenantId,
          provider: gateway,
          status: 'active',
        },
      });

      if (!gatewayConfig) {
        return NextResponse.json(
          { success: false, error: { code: 'GATEWAY_UNAVAILABLE', message: 'Selected payment gateway is not configured' } },
          { status: 400 }
        );
      }
    }

    // Create payment record
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          tenantId: booking.tenantId,
          folioId,
          guestId: booking.primaryGuestId,
          amount,
          currency: booking.currency,
          method,
          gateway: gateway || (method === 'cash' ? 'manual' : null),
          gatewayStatus,
          cardType: cardType || null,
          cardLast4: cardLast4 || null,
          transactionId,
          status: paymentStatus,
          processedAt: paymentStatus === 'completed' ? new Date() : null,
        },
        include: {
          folio: {
            select: { id: true, folioNumber: true },
          },
        },
      });

      // For completed payments (non-card), update folio
      if (paymentStatus === 'completed') {
        const updatedFolio = await tx.folio.update({
          where: { id: folioId },
          data: {
            paidAmount: { increment: amount },
            balance: { decrement: amount },
          },
        });

        if (updatedFolio.balance <= 0) {
          await tx.folio.update({
            where: { id: folioId },
            data: { status: 'paid', closedAt: new Date() },
          });
        } else if (updatedFolio.paidAmount > 0) {
          await tx.folio.update({
            where: { id: folioId },
            data: { status: 'partially_paid' },
          });
        }
      }

      return newPayment;
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        tenantId: booking.tenantId,
        userId: null,
        module: 'guest_portal',
        action: 'guest_payment',
        entityType: 'Payment',
        entityId: payment.id,
        newValue: JSON.stringify({
          amount,
          method,
          gateway: gateway || 'manual',
          transactionId,
          folioId,
          bookingId: booking.id,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: payment.id,
          transactionId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          gateway: payment.gateway,
          status: payment.status,
          processedAt: payment.processedAt,
          folioNumber: payment.folio?.folioNumber,
        },
      },
      { status: paymentStatus === 'processing' ? 202 : 201 }
    );
  } catch (error) {
    console.error('Error processing guest payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' } },
      { status: 500 }
    );
  }
}
