import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// POST /api/orders/[id]/pay - Process payment for a restaurant order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify the order exists and belongs to the tenant
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
    const paymentAmount = order.totalAmount + (tipAmount || 0);

    // For room charges, find or create the booking's folio
    let folioId = order.folioId;

    if (paymentMethod === 'room_charge' && !folioId) {
      // Try to find an existing open folio for the booking
      let targetFolioId: string | null = null;

      if (bookingId) {
        const bookingFolio = await db.folio.findFirst({
          where: { bookingId, status: { in: ['open', 'partially_paid'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (bookingFolio) {
          targetFolioId = bookingFolio.id;
        }
      } else if (order.bookingId) {
        const bookingFolio = await db.folio.findFirst({
          where: { bookingId: order.bookingId, status: { in: ['open', 'partially_paid'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (bookingFolio) {
          targetFolioId = bookingFolio.id;
        }
      }

      if (!targetFolioId) {
        // Create a new folio for the room charge
        const newFolio = await db.folio.create({
          data: {
            tenantId: user.tenantId,
            propertyId: order.propertyId,
            bookingId: bookingId || order.bookingId || undefined,
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

      // Link the order to this folio
      await db.order.update({
        where: { id: orderId },
        data: { folioId },
      });
    }

    // Create or find a Folio for this order (non-room-charge)
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

      // Link the folio to the order
      await db.order.update({
        where: { id: orderId },
        data: { folioId },
      });
    }

    // Create folio line items for the order (room charge or regular)
    const existingLineItems = await db.folioLineItem.count({
      where: { folioId, reference: `order-${orderId}` },
    });

    if (existingLineItems === 0) {
      // Create line items for each order item
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

    // Create payment records
    const paymentsToCreate = [];
    if (splitCount && splitCount > 1) {
      // Split payment: first N-1 pay floor share, last pays remainder
      const floorShare = Math.floor((paymentAmount / splitCount) * 100) / 100;
      const lastShare = Math.round((paymentAmount - floorShare * (splitCount - 1)) * 100) / 100;

      for (let i = 0; i < splitCount; i++) {
        paymentsToCreate.push({
          folioId,
          tenantId: user.tenantId,
          amount: i < splitCount - 1 ? floorShare : lastShare,
          currency,
          method: paymentMethod,
          gateway: paymentMethod === 'card' ? 'manual_pos' : 'cash',
          cardType,
          cardLast4,
          status: 'completed',
          processedAt: new Date(),
          reference: `split-${i + 1}-of-${splitCount}-order-${orderId}`,
          guestId: order.guestId || undefined,
          idempotencyKey: crypto.randomUUID(),
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
        idempotencyKey: crypto.randomUUID(),
      });
    }

    await db.payment.createMany({ data: paymentsToCreate });

    // Update folio totals
    const allPayments = await db.payment.findMany({
      where: { folioId, status: 'completed' },
      _sum: { amount: true },
    });
    const totalPaid = allPayments._sum.amount || 0;

    await db.folio.update({
      where: { id: folioId },
      data: {
        paidAmount: totalPaid,
        balance: paymentAmount - totalPaid,
        status: totalPaid >= paymentAmount ? 'closed' : 'open',
        closedAt: totalPaid >= paymentAmount ? new Date() : undefined,
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

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        payment: {
          amount: paymentAmount,
          method: paymentMethod,
          splitCount: splitCount || 1,
          currency,
        },
      },
    });
  } catch (error) {
    console.error('Error processing order payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' } },
      { status: 500 }
    );
  }
}
