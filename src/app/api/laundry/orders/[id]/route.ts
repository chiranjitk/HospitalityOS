import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
};

// GET /api/laundry/orders/[id] - Get a single laundry order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await db.laundryOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        items: true,
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        guest: {
          select: { id: true, firstName: true, lastName: true },
        },
        folio: {
          select: { id: true, folioNumber: true, status: true },
        },
        collectedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        deliveredByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Laundry order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('[GET /api/laundry/orders/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/laundry/orders/[id] - Update order status (auto-post to folio on delivered)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.laundryOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Laundry order not found' }, { status: 404 });
    }

    const { status, notes, specialInstructions } = body;

    // Validate status transition
    if (status && status !== existing.status) {
      const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json({
          success: false,
          error: `Invalid status transition from '${existing.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
        }, { status: 400 });
      }
    }

    // Build update data based on status
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (specialInstructions !== undefined) updateData.specialInstructions = specialInstructions;

    // Set timestamps based on status
    if (status === 'ready') {
      updateData.readyAt = new Date();
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      updateData.deliveredBy = user.id;
    }

    // Execute update
    const order = await db.laundryOrder.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        booking: { select: { id: true, confirmationCode: true } },
        guest: { select: { id: true, firstName: true, lastName: true } },
        folio: { select: { id: true, folioNumber: true, status: true } },
      },
    });

    // Auto-post to folio when order is delivered and linked to a booking
    if (status === 'delivered' && existing.bookingId && !existing.postedToFolio) {
      try {
        const folio = await db.folio.findFirst({
          where: {
            bookingId: existing.bookingId,
            status: 'open',
            tenantId: user.tenantId,
          },
        });

        if (folio) {
          const lineItemDescription = `Laundry Service - Order #${existing.id.slice(0, 8)}`;

          await db.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: lineItemDescription,
              category: 'laundry',
              quantity: existing.totalItems,
              unitPrice: existing.totalPrice / existing.totalItems || existing.totalPrice,
              totalAmount: existing.totalPrice,
              serviceDate: new Date(),
              referenceType: 'laundry_order',
              referenceId: existing.id,
              postedBy: user.id,
            },
          });

          const newBalance = folio.balance + existing.totalPrice;
          await db.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: { increment: existing.totalPrice },
              totalAmount: { increment: existing.totalPrice },
              balance: newBalance,
            },
          });

          await db.laundryOrder.update({
            where: { id },
            data: { folioId: folio.id, postedToFolio: true },
          });

          order.folioId = folio.id;
          order.postedToFolio = true;
        }
      } catch (folioError) {
        console.error('[PATCH /api/laundry/orders/[id]] Auto-post to folio failed:', folioError);
        // Order status is still updated, just not posted to folio
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('[PATCH /api/laundry/orders/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
