import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth';

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
    if (!hasAnyPermission(user, ['laundry.view', 'laundry.manage', 'housekeeping.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
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
    if (!hasAnyPermission(user, ['laundry.manage', 'housekeeping.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
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

    // CRITICAL FIX: Execute status update INSIDE the folio transaction
    // so that status + folio posting are atomic (no orphaned status without folio)
    let order: any;
    const isDeliveredToFolio = status === 'delivered' && existing.bookingId && !existing.postedToFolio;

    if (isDeliveredToFolio) {
      try {
        await db.$transaction(async (tx) => {
          // Update order status inside transaction
          order = await tx.laundryOrder.update({
            where: { id },
            data: updateData,
            include: {
              items: true,
              booking: { select: { id: true, confirmationCode: true } },
              guest: { select: { id: true, firstName: true, lastName: true } },
              folio: { select: { id: true, folioNumber: true, status: true } },
            },
          });

          // Auto-post to folio
          const folio = await tx.folio.findFirst({
            where: {
              bookingId: existing.bookingId,
              status: { in: ['open', 'partially_paid'] },
              tenantId: user.tenantId,
            },
          });

          if (folio) {
            const lineItemDescription = `Laundry Service - Order #${existing.id.slice(0, 8)}`;
            const amount = existing.totalPrice;

            // Calculate tax from property tax settings
            let taxRate = 0;
            const prop = await tx.property.findFirst({
              where: { id: existing.propertyId },
              select: { defaultTaxRate: true, taxComponents: true },
            });
            if (prop) {
              try {
                const tc = JSON.parse(prop.taxComponents || '[]');
                if (Array.isArray(tc) && tc.length > 0) {
                  taxRate = tc.reduce((sum: number, c: { rate: number }) => sum + (c.rate || 0), 0) / 100;
                } else {
                  taxRate = (prop.defaultTaxRate || 0) / 100;
                }
              } catch { taxRate = (prop.defaultTaxRate || 0) / 100; }
            }
            const taxAmount = Math.round(amount * taxRate * 100) / 100;

            await tx.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: lineItemDescription,
                category: 'laundry',
                quantity: existing.totalItems,
                unitPrice: amount / existing.totalItems || amount,
                totalAmount: amount,
                taxRate: taxRate * 100,
                taxAmount,
                serviceDate: new Date(),
                referenceType: 'laundry_order',
                referenceId: existing.id,
                postedBy: user.id,
              },
            });

            // Recalculate folio totals from ALL line items (consistent pattern)
            const allLineItems = await tx.folioLineItem.findMany({
              where: { folioId: folio.id },
              select: { totalAmount: true, taxAmount: true },
            });
            const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
            const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
            const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

            await tx.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance: newTotal - (folio.paidAmount || 0),
              },
            });

            await tx.laundryOrder.update({
              where: { id },
              data: { folioId: folio.id, postedToFolio: true },
            });

            order.folioId = folio.id;
            order.postedToFolio = true;
          }
        }); // end transaction
      } catch (folioError) {
        console.error('[PATCH /api/laundry/orders/[id]] Auto-post to folio failed:', folioError);
        return NextResponse.json({ success: false, error: 'Failed to update order and post to folio' }, { status: 500 });
      }
    } else {
      // Non-delivery path: just update the order
      order = await db.laundryOrder.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          booking: { select: { id: true, confirmationCode: true } },
          guest: { select: { id: true, firstName: true, lastName: true } },
          folio: { select: { id: true, folioNumber: true, status: true } },
        },
      });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('[PATCH /api/laundry/orders/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
