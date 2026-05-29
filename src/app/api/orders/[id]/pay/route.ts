import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';
import { notifyPaymentReceived } from '@/lib/notify';
import { auditLogService } from '@/lib/services/audit-service';
import { createPaymentRouter } from '@/lib/payments';
import { PaymentRequest, GatewayType } from '@/lib/payments/types';
import { fireAutomationEvent } from '@/lib/automation/hooks';

// Payment methods that require a real payment gateway
const GATEWAY_PAYMENT_METHODS = new Set(['card', 'upi', 'qr']);

/**
 * Determine which gateway types to prefer for a given POS payment method.
 *
 * - card  → stripe (primary), razorpay, square (fallback)
 * - upi   → upi (primary), razorpay, phonepe (fallback)
 * - qr    → upi (primary), razorpay, phonepe (fallback)
 */
function preferredGatewayTypes(paymentMethod: string): GatewayType[] {
  switch (paymentMethod) {
    case 'card':
      return ['stripe', 'razorpay', 'square'];
    case 'upi':
    case 'qr':
      return ['upi', 'phonepe', 'razorpay'];
    default:
      return [];
  }
}

/**
 * Build a PaymentRequest suitable for POS card / UPI / QR flows.
 *
 * For card: no token/cardData → gateway creates an intent/order for the client to confirm.
 * For upi/qr: metadata carries UPI-specific fields.
 */
function buildGatewayPaymentRequest(params: {
  amount: number;
  currency: string;
  folioId: string;
  orderId: string;
  orderNumber: string;
  paymentMethod: string;
  guestId?: string | null;
  bookingId?: string | null;
  propertyId?: string;
  tipAmount: number;
  idempotencyKey: string;
}): PaymentRequest {
  const { amount, currency, folioId, orderId, orderNumber, paymentMethod, guestId, bookingId, propertyId, tipAmount, idempotencyKey } = params;

  const isUpiOrQr = paymentMethod === 'upi' || paymentMethod === 'qr';

  return {
    amount,
    currency,
    description: `POS Order ${orderNumber}${tipAmount > 0 ? ` + tip` : ''}`,
    folioId,
    bookingId: bookingId || undefined,
    guestId: guestId || undefined,
    idempotencyKey,
    // For card: no token → Stripe creates a PaymentIntent in requires_confirmation state.
    // For UPI/QR: metadata tells the UPI gateway which mode to use.
    metadata: isUpiOrQr
      ? {
          source: 'pos',
          orderId,
          orderNumber,
          propertyId: propertyId || '',
          upiMethod: paymentMethod === 'qr' ? 'qr' : 'intent',
          tipAmount: String(tipAmount),
        }
      : {
          source: 'pos',
          orderId,
          orderNumber,
          propertyId: propertyId || '',
          tipAmount: String(tipAmount),
        },
  };
}

// POST /api/orders/[id]/pay — Process payment for a restaurant order
//
// H-40 FIX: Real payment gateway integration.
//   • card  → routes through gateway registry (Stripe / Razorpay).
//             Returns client_secret or order_id so the POS client can confirm.
//             Order is marked "processing" until webhook confirms.
//   • upi   → UPI gateway returns QR string / intent URL.
//   • qr    → Same as UPI but defaults to QR mode.
//   • cash / room_charge → immediate completion (unchanged).
//   • If no gateway is configured → graceful fallback to manual/cash.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let idempotencyKey: string;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await request.json();
    const {
      paymentMethod = 'cash',
      tipAmount = 0,
      splitCount,
      cardType,
      cardLast4,
      bookingId,
    } = body;

    idempotencyKey = body.idempotencyKey || crypto.randomUUID();

    // ── 1. Verify order exists and belongs to the tenant ──────────────────────
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      include: {
        property: {
          select: { id: true, currency: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Only allow payment for served or ready orders
    if (!['served', 'ready'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot pay for order with status: ${order.status}` } },
        { status: 400 }
      );
    }

    const currency = order.property?.currency || 'USD';
    if (order.currency && order.currency !== currency) {
      console.warn(`[Orders Pay] Currency mismatch: order is ${order.currency}, property is ${currency}. Using property currency.`);
    }
    const paymentAmount = order.totalAmount + (tipAmount || 0);

    // ── 2. Room charge handling (unchanged) ───────────────────────────────────
    let folioId = order.folioId;

    if (paymentMethod === 'room_charge' && !folioId) {
      const effectiveBookingId = bookingId || order.bookingId;
      if (!effectiveBookingId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room charge requires a booking association' } },
          { status: 400 }
        );
      }

      const booking = await db.booking.findUnique({ where: { id: effectiveBookingId } });
      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 400 }
        );
      }
      if (booking.status !== 'checked_in') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_BOOKING_STATUS', message: 'Room charge requires the guest to be checked in' } },
          { status: 400 }
        );
      }

      let targetFolioId: string | null = null;

      const bookingFolio = await db.folio.findFirst({
        where: { bookingId: effectiveBookingId, status: { in: ['open', 'partially_paid'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (bookingFolio) {
        if (bookingFolio.status === 'closed') {
          return NextResponse.json(
            { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot charge to a closed folio' } },
            { status: 400 }
          );
        }
        targetFolioId = bookingFolio.id;
      }

      if (!targetFolioId) {
        const newFolio = await db.folio.create({
          data: {
            tenantId: user.tenantId,
            propertyId: order.propertyId,
            bookingId: effectiveBookingId || undefined,
            guestId: order.guestId || undefined,
            folioNumber: `FOL-ROOM-${Date.now().toString(36).toUpperCase()}`,
            currency,
            subtotal: 0,
            taxes: 0,
            totalAmount: 0,
            paidAmount: 0,
            balance: 0,
            status: 'open',
          },
        });
        targetFolioId = newFolio.id;
      }

      folioId = targetFolioId;

      await db.order.update({
        where: { id: orderId },
        data: { folioId },
      });
    }

    // ── 3. Create folio + line items (shared across all payment paths) ─────────
    if (!folioId) {
      const folio = await db.folio.create({
        data: {
          tenantId: user.tenantId,
          propertyId: order.propertyId,
          bookingId: order.bookingId || undefined,
          guestId: order.guestId || undefined,
          folioNumber: `FOL-ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          currency,
          subtotal: order.subtotal,
          taxes: order.taxes,
          discount: order.discount,
          totalAmount: paymentAmount,
          balance: paymentAmount,
          status: 'open',
        },
      });
      folioId = folio.id;

      await db.order.update({
        where: { id: orderId },
        data: { folioId },
      });
    }

    // Create folio line items for the order
    const existingLineItems = await db.folioLineItem.count({
      where: { folioId, reference: `order-${orderId}` },
    });

    if (existingLineItems === 0) {
      for (const item of (await db.orderItem.findMany({ where: { orderId }, include: { menuItem: { select: { name: true } } } }))) {
        await db.folioLineItem.create({
          data: {
            folioId,
            description: `${item.menuItem?.name || 'Restaurant Item'} x${item.quantity}${item.notes ? ` (${item.notes})` : ''}`,
            category: 'restaurant',
            subcategory: order.orderType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
            taxAmount: Math.round(item.totalAmount * (order.subtotal > 0 ? (order.taxes / order.subtotal) : 0) * 100) / 100,
            reference: `order-${orderId}`,
            referenceType: 'order',
            referenceId: item.id,
            serviceDate: new Date(),
          },
        });
      }
    }

    // Recalculate folio totals after adding line items
    const allLineItems = await db.folioLineItem.findMany({ where: { folioId } });
    const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
    const newTaxes = allLineItems.reduce((sum, li) => sum + li.taxAmount, 0);
    const folioRecord = await db.folio.findUnique({ where: { id: folioId } });
    if (folioRecord) {
      await db.folio.update({
        where: { id: folioId },
        data: {
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newSubtotal + newTaxes - (folioRecord.discount || 0),
          balance: (newSubtotal + newTaxes - (folioRecord.discount || 0)) - (folioRecord.paidAmount || 0),
        },
      });
    }

    // Create tip line item if applicable
    if (tipAmount && tipAmount > 0) {
      await db.folioLineItem.create({
        data: {
          folioId,
          description: `Tip for Order ${order.orderNumber}`,
          category: 'tip',
          quantity: 1,
          unitPrice: tipAmount,
          totalAmount: tipAmount,
          taxRate: 0,
          taxAmount: 0,
          reference: `tip-order-${orderId}`,
          serviceDate: new Date(),
        },
      });
    }

    // ── 4. Duplicate payment prevention ────────────────────────────────────────
    const existingPayment = await db.payment.findFirst({
      where: {
        folioId,
        reference: splitCount ? `split-1-of-${splitCount}-order-${orderId}` : `order-${orderId}`,
        status: { in: ['completed', 'processing'] },
      },
    });
    if (existingPayment) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_PAYMENT', message: 'Payment already processed or in progress' } },
        { status: 409 }
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. PAYMENT PROCESSING — gateway-mediated vs immediate
    // ══════════════════════════════════════════════════════════════════════════

    const needsGateway = GATEWAY_PAYMENT_METHODS.has(paymentMethod);

    if (needsGateway) {
      return await handleGatewayPayment({
        request,
        orderId,
        order,
        folioId,
        folioRecord,
        paymentMethod,
        paymentAmount,
        currency,
        tipAmount,
        splitCount,
        cardType,
        cardLast4,
        bookingId,
        user,
        idempotencyKey,
      });
    }

    // ── Immediate completion (cash / room_charge / any other method) ───────────
    return await handleImmediatePayment({
      orderId,
      order,
      folioId,
      folioRecord,
      paymentMethod,
      paymentAmount,
      currency,
      tipAmount,
      splitCount,
      cardType,
      cardLast4,
      user,
      idempotencyKey,
    });
  } catch (error) {
    console.error('Error processing order payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' } },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway-mediated payment (card / upi / qr)
// ─────────────────────────────────────────────────────────────────────────────

async function handleGatewayPayment(params: {
  request: NextRequest;
  orderId: string;
  order: any;
  folioId: string;
  folioRecord: any;
  paymentMethod: string;
  paymentAmount: number;
  currency: string;
  tipAmount: number;
  splitCount?: number;
  cardType?: string;
  cardLast4?: string;
  bookingId?: string;
  user: any;
  idempotencyKey: string;
}): Promise<NextResponse> {
  const {
    request, orderId, order, folioId, folioRecord,
    paymentMethod, paymentAmount, currency, tipAmount,
    splitCount, cardType, cardLast4, bookingId, user, idempotencyKey,
  } = params;

  // ── 5a. Attempt real gateway processing ─────────────────────────────────────
  try {
    const router = await createPaymentRouter(user.tenantId);

    const gatewayRequest = buildGatewayPaymentRequest({
      amount: paymentAmount,
      currency,
      folioId,
      orderId,
      orderNumber: order.orderNumber,
      paymentMethod,
      guestId: order.guestId,
      bookingId: bookingId || order.bookingId,
      propertyId: order.propertyId,
      tipAmount,
      idempotencyKey,
    });

    const gatewayResult = await router.processPayment(gatewayRequest);

    if (gatewayResult.success) {
      const gatewayRef = gatewayResult.gatewayRef || null;
      const gateway = gatewayResult.metadata?.gateway || preferredGatewayTypes(paymentMethod)[0] || 'stripe';
      const gatewayStatus = gatewayResult.status; // 'processing' for intent-based flows

      // ── Create payment record in 'processing' state ───────────────────────
      const payment = await db.payment.create({
        data: {
          folioId,
          tenantId: user.tenantId,
          amount: paymentAmount,
          currency,
          method: paymentMethod,
          gateway,
          gatewayRef,
          gatewayStatus,
          cardType: gatewayResult.cardType || cardType,
          cardLast4: gatewayResult.last4 || cardLast4,
          status: 'processing',
          reference: `order-${orderId}`,
          guestId: order.guestId || undefined,
          idempotencyKey,
          transactionId: gatewayResult.transactionId || crypto.randomUUID(),
        },
      });

      // ── Mark order as 'processing' ────────────────────────────────────────
      await db.order.update({
        where: { id: orderId },
        data: { status: 'processing' },
      });

      // ── Audit log ─────────────────────────────────────────────────────────
      try {
        await auditLogService.logWithContext({
          tenantId: user.tenantId, userId: user.id, module: 'billing', action: 'payment_initiated',
          entityType: 'order', entityId: orderId,
          newValue: {
            orderNumber: order.orderNumber,
            paymentMethod,
            paymentAmount,
            folioId,
            gateway,
            gatewayRef,
            idempotencyKey,
          },
          description: `Gateway payment initiated for order ${order.orderNumber}: ${paymentAmount} via ${paymentMethod} (${gateway})`,
        }, request);
      } catch (auditError) {
        console.error('[Orders Pay] Audit log failed:', auditError);
      }

      // ── Build response with gateway-specific data ───────────────────────
      const responsePayload: Record<string, unknown> = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        payment: {
          id: payment.id,
          amount: paymentAmount,
          method: paymentMethod,
          currency,
          status: 'processing',
          splitCount: splitCount || 1,
        },
        gateway: {
          type: gateway,
          gatewayRef,
          gatewayStatus,
        },
        _gatewayMetadata: gatewayResult.metadata,
      };

      // Extract commonly-needed fields from gateway metadata
      if (gatewayResult.metadata?.client_secret) {
        responsePayload.clientSecret = gatewayResult.metadata.client_secret;
      }
      if (gatewayResult.metadata?.upiQrString) {
        responsePayload.upiQrString = gatewayResult.metadata.upiQrString;
      }
      if (gatewayResult.metadata?.upiIntentUrl) {
        responsePayload.upiIntentUrl = gatewayResult.metadata.upiIntentUrl;
      }
      if (gatewayResult.metadata?.paymentRef) {
        responsePayload.paymentRef = gatewayResult.metadata.paymentRef;
      }
      if (gatewayResult.metadata?.expiresAt) {
        responsePayload.expiresAt = gatewayResult.metadata.expiresAt;
      }
      // Razorpay checkout flag
      if (gatewayResult.metadata?._razorpayCheckout === 'true') {
        responsePayload.razorpayOrderId = gatewayRef;
      }

      return NextResponse.json({
        success: true,
        data: responsePayload,
        message: 'Payment intent created — awaiting confirmation via gateway',
      });
    }

    // ── Gateway returned failure — fall back to manual ─────────────────────
    console.warn(
      `[Orders Pay] Gateway payment failed for order ${order.orderNumber}:`,
      gatewayResult.errorCode,
      gatewayResult.errorMessage,
    );
  } catch (gwError) {
    console.warn('[Orders Pay] Gateway unavailable, falling back to manual:', gwError);
  }

  // ── 5b. No gateway configured or gateway failed → manual fallback ────────────
  console.log(`[Orders Pay] No active gateway for '${paymentMethod}' — using manual/cash fallback for order ${order.orderNumber}`);

  return await handleImmediatePayment({
    orderId,
    order,
    folioId,
    folioRecord,
    paymentMethod: paymentMethod === 'card' ? 'cash' : paymentMethod, // Map card→cash when no gateway
    paymentAmount,
    currency,
    tipAmount,
    splitCount,
    cardType,
    cardLast4,
    user,
    idempotencyKey: crypto.randomUUID(), // New key for the fallback payment
    fallbackFrom: paymentMethod,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Immediate payment (cash / room_charge / manual fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function handleImmediatePayment(params: {
  orderId: string;
  order: any;
  folioId: string;
  folioRecord: any;
  paymentMethod: string;
  paymentAmount: number;
  currency: string;
  tipAmount: number;
  splitCount?: number;
  cardType?: string;
  cardLast4?: string;
  user: any;
  idempotencyKey: string;
  fallbackFrom?: string;
}): Promise<NextResponse> {
  const {
    orderId, order, folioId, folioRecord,
    paymentMethod, paymentAmount, currency, tipAmount,
    splitCount, cardType, cardLast4, user, idempotencyKey, fallbackFrom,
  } = params;

  // Create payment records
  const paymentsToCreate: any[] = [];
  if (splitCount && splitCount > 1) {
    const floorShare = Math.floor((paymentAmount / splitCount) * 100) / 100;
    const lastShare = Math.round((paymentAmount - floorShare * (splitCount - 1)) * 100) / 100;

    for (let i = 0; i < splitCount; i++) {
      paymentsToCreate.push({
        folioId,
        tenantId: user.tenantId,
        amount: i < splitCount - 1 ? floorShare : lastShare,
        currency,
        method: paymentMethod,
        gateway: paymentMethod === 'card' ? 'manual_pos' : paymentMethod === 'room_charge' ? 'room_folio' : 'cash',
        cardType,
        cardLast4,
        status: 'completed',
        processedAt: new Date(),
        reference: `split-${i + 1}-of-${splitCount}-order-${orderId}`,
        guestId: order.guestId || undefined,
        idempotencyKey,
      });
    }
  } else {
    paymentsToCreate.push({
      folioId,
      tenantId: user.tenantId,
      amount: paymentAmount,
      currency,
      method: paymentMethod,
      gateway: paymentMethod === 'card' ? 'manual_pos' : paymentMethod === 'room_charge' ? 'room_folio' : 'cash',
      cardType,
      cardLast4,
      status: 'completed',
      processedAt: new Date(),
      reference: `order-${orderId}`,
      guestId: order.guestId || undefined,
      idempotencyKey,
    });
  }

  await db.payment.createMany({ data: paymentsToCreate });

  // Update folio totals
  const allPayments = await db.payment.findMany({
    where: { folioId, status: 'completed' },
    _sum: { amount: true },
  });
  const totalPaid = allPayments._sum.amount || 0;

  const allFolioItems = await db.folioLineItem.findMany({ where: { folioId } });
  const recalculatedSubtotal = allFolioItems.reduce((sum: number, li: any) => sum + li.totalAmount, 0);
  const recalculatedTaxes = allFolioItems.reduce((sum: number, li: any) => sum + (li.taxAmount || 0), 0);
  const recalculatedTotal = recalculatedSubtotal + recalculatedTaxes - (folioRecord?.discount || 0);
  const recalculatedBalance = recalculatedTotal - totalPaid;

  const folioShouldClose = totalPaid >= recalculatedTotal && !folioRecord?.bookingId;
  await db.folio.update({
    where: { id: folioId },
    data: {
      subtotal: recalculatedSubtotal,
      taxes: recalculatedTaxes,
      totalAmount: recalculatedTotal,
      paidAmount: totalPaid,
      balance: recalculatedBalance,
      ...(folioShouldClose
        ? { status: 'closed', closedAt: new Date() }
        : { status: totalPaid > 0 ? 'partially_paid' : 'open' }),
    },
  });

  // Update order status to 'paid'
  const updatedOrder = await db.order.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      completedAt: new Date(),
    },
    include: {
      table: true,
      items: {
        include: {
          menuItem: {
            select: { id: true, name: true, price: true },
          },
        },
      },
    },
  });

  // Update table status if applicable
  if (updatedOrder.tableId) {
    await db.restaurantTable.update({
      where: { id: updatedOrder.tableId },
      data: { status: 'available' },
    });
  }

  // Notification
  notifyPaymentReceived({
    tenantId: user.tenantId,
    userId: user.id,
    amount: paymentAmount,
    currency,
    method: paymentMethod || 'unknown',
    orderNumber: order.orderNumber,
  });

  // Fire automation event
  fireAutomationEvent('payment.received', {
    tenantId: user.tenantId,
    entityId: orderId,
    data: {
      orderId,
      folioId,
      amount: paymentAmount,
      currency,
      method: paymentMethod,
      gateway: paymentMethod === 'card' ? 'manual_pos' : 'cash',
      status: 'completed',
    },
  });

  // Audit log
  try {
    await auditLogService.logWithContext({
      tenantId: user.tenantId, userId: user.id, module: 'billing', action: 'payment',
      entityType: 'order', entityId: orderId,
      newValue: {
        orderNumber: order.orderNumber,
        paymentMethod,
        paymentAmount,
        folioId,
        splitCount: splitCount || 1,
        ...(fallbackFrom ? { fallbackFrom, note: `No gateway configured for ${fallbackFrom}, processed as ${paymentMethod}` } : {}),
      },
      description: `Payment processed for order ${order.orderNumber}: ${paymentAmount} via ${paymentMethod}`,
    }, new Request('https://internal'));
  } catch (auditError) {
    console.error('[Orders Pay] Audit log failed:', auditError);
  }

  const responseData: Record<string, unknown> = {
    order: updatedOrder,
    payment: {
      amount: paymentAmount,
      method: paymentMethod,
      splitCount: splitCount || 1,
      currency,
    },
  };

  // Indicate fallback when applicable
  if (fallbackFrom) {
    responseData.gatewayWarning = `No payment gateway configured for '${fallbackFrom}'. Payment recorded as manual ${paymentMethod}.`;
    responseData.isManualFallback = true;
  }

  return NextResponse.json({
    success: true,
    data: responseData,
  });
}
