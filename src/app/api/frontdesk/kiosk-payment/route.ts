import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';

// =============================================================================
// DEMO/SIMULATION NOTE: This API route is for kiosk demo mode only.
// No real payment gateway integration. All payments succeed after validation.
// In production, replace simulated processing with actual gateway calls
// (e.g., Stripe, Razorpay, Adyen) and add proper PCI-DSS compliance.
// =============================================================================

// --- Zod Validation Schemas ---

const kioskPaymentSchema = z.object({
  bookingId: z.string().uuid({ message: 'bookingId must be a valid UUID' }),
  amount: z.number().positive({ message: 'Amount must be greater than 0' }),
  method: z.enum(['cash', 'card', 'upi', 'qr_code'], {
    errorMap: () => ({ message: 'Method must be one of: cash, card, upi, qr_code' }),
  }),
  currency: z.string().length(3).default('USD'),
});

// --- Helpers ---

/** Generate a receipt number in format RCP-YYYYMMDD-XXXXXX */
function generateReceiptNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RCP-${dateStr}-${rand}`;
}

/** Generate a simulated card reference for demo purposes */
function generateCardRef(): string {
  return `CARD-DEMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Generate a simulated UPI payment reference */
function generateUpiRef(): string {
  return `UPI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Generate a simulated QR code payment reference */
function generateQrRef(): string {
  return `QR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Generate a unique folio number */
function generateFolioNumber(bookingId: string): string {
  const short = bookingId.slice(0, 8).toUpperCase();
  return `FOLIO-${short}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

// --- POST: Process a kiosk payment ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate input with Zod
    const parsed = kioskPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { bookingId, amount, method, currency } = parsed.data;

    // 2. Verify booking exists and is not deleted
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        primaryGuestId: true,
        confirmationCode: true,
        status: true,
        totalAmount: true,
        currency: true,
        property: {
          select: { id: true, name: true, tenantId: true },
        },
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // 3. Find or create Folio for the booking
    let folio = await db.folio.findFirst({
      where: { bookingId },
    });

    if (!folio) {
      // Create a new folio for this booking
      folio = await db.folio.create({
        data: {
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          bookingId,
          folioNumber: generateFolioNumber(bookingId),
          guestId: booking.primaryGuestId,
          subtotal: booking.totalAmount,
          totalAmount: booking.totalAmount,
          balance: booking.totalAmount,
          currency: booking.currency || currency,
          status: 'open',
        },
      });
    }

    // 4. Build payment data based on method
    // DEMO MODE: All payments succeed — no real gateway calls
    const receiptNumber = generateReceiptNumber();
    let gatewayRef: string | null = null;
    let gatewayStatus = 'completed';
    let cardType: string | null = null;
    let cardLast4: string | null = null;
    let cardExpiry: string | null = null;

    switch (method) {
      case 'card':
        // Simulate card payment (demo mode)
        cardType = 'VISA';
        cardLast4 = '4242';
        cardExpiry = '12/28';
        gatewayRef = generateCardRef();
        break;

      case 'upi':
        // Simulate UPI payment
        gatewayRef = generateUpiRef();
        break;

      case 'qr_code':
        // Simulate QR code payment
        gatewayRef = generateQrRef();
        break;

      case 'cash':
        // Cash payment — mark as pending staff collection
        gatewayStatus = 'pending_collection';
        gatewayRef = `CASH-${receiptNumber}`;
        break;
    }

    // 5. Create Payment + Update Folio in a transaction
    const payment = await db.$transaction(async (tx) => {
      // Create the payment record
      const newPayment = await tx.payment.create({
        data: {
          tenantId: booking.tenantId,
          folioId: folio!.id,
          amount,
          currency: currency || booking.currency,
          method,
          gateway: 'kiosk-demo',
          gatewayRef,
          gatewayStatus,
          cardType,
          cardLast4,
          cardExpiry,
          transactionId: crypto.randomUUID(),
          reference: receiptNumber,
          guestId: booking.primaryGuestId,
          status: 'completed',
          processedAt: new Date(),
        },
      });

      // Update folio: add paidAmount, recalculate balance
      const updatedFolio = await tx.folio.update({
        where: { id: folio!.id },
        data: {
          paidAmount: { increment: amount },
          balance: { decrement: amount },
        },
      });

      // Update folio status based on balance
      if (updatedFolio.balance <= 0.01) {
        // Fully paid (allow for floating point rounding)
        await tx.folio.update({
          where: { id: folio!.id },
          data: {
            status: 'paid',
            closedAt: new Date(),
          },
        });
      } else if (updatedFolio.paidAmount > 0) {
        await tx.folio.update({
          where: { id: folio!.id },
          data: { status: 'partially_paid' },
        });
      }

      return newPayment;
    });

    // 6. Create audit log entry
    try {
      await db.auditLog.create({
        data: {
          tenantId: booking.tenantId,
          module: 'kiosk-payment',
          action: 'kiosk_payment_processed',
          entityType: 'Payment',
          entityId: payment.id,
          newValue: JSON.stringify({
            bookingId,
            confirmationCode: booking.confirmationCode,
            amount,
            currency: currency || booking.currency,
            method,
            receiptNumber,
            gatewayRef,
            guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
            performedBy: 'kiosk-self-service',
          }),
        },
      });
    } catch (auditError) {
      // Non-blocking: audit log failure should not break the payment flow
      console.error('[Kiosk Payment] Audit log creation failed (non-blocking):', auditError);
    }

    // 7. Re-read the updated folio to get the current balance
    const updatedFolio = await db.folio.findUnique({
      where: { id: folio.id },
      select: { balance: true },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          receiptNumber,
          folioBalance: updatedFolio?.balance ?? 0,
          currency: payment.currency,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing kiosk payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' } },
      { status: 500 }
    );
  }
}

// --- GET: Get payment summary for a booking ---

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId query parameter is required' } },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId must be a valid UUID' } },
        { status: 400 }
      );
    }

    // Find the booking
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        totalAmount: true,
        currency: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Find the folio
    const folio = await db.folio.findFirst({
      where: { bookingId },
    });

    if (!folio) {
      // No folio exists yet — return summary from booking data
      return NextResponse.json({
        success: true,
        data: {
          totalAmount: booking.totalAmount,
          paidAmount: 0,
          balance: booking.totalAmount,
          pendingCharges: booking.totalAmount,
          currency: booking.currency,
          status: 'open',
          payments: [],
        },
      });
    }

    // Get all payments for this folio
    const payments = await db.payment.findMany({
      where: { folioId: folio.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        reference: true,
        gatewayRef: true,
        cardType: true,
        cardLast4: true,
        processedAt: true,
        createdAt: true,
      },
    });

    // Calculate pending charges (line items total)
    const lineItemsTotal = await db.folioLineItem.aggregate({
      where: { folioId: folio.id },
      _sum: { totalAmount: true, taxAmount: true },
    });

    const pendingCharges = Math.max(
      0,
      (folio.totalAmount - folio.paidAmount)
    );

    return NextResponse.json({
      success: true,
      data: {
        folioId: folio.id,
        folioNumber: folio.folioNumber,
        totalAmount: folio.totalAmount,
        paidAmount: folio.paidAmount,
        balance: folio.balance,
        pendingCharges,
        currency: folio.currency,
        status: folio.status,
        payments: payments.map((p) => ({
          paymentId: p.id,
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          status: p.status,
          receiptNumber: p.reference,
          gatewayRef: p.gatewayRef,
          cardDisplay: p.cardType
            ? `${p.cardType} **** ${p.cardLast4 || '0000'}`
            : null,
          processedAt: p.processedAt,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching kiosk payment summary:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment summary' } },
      { status: 500 }
    );
  }
}
