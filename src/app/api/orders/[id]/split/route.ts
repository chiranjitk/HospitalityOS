import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
  return `ORD-${ts}-${rand}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { splits } = body;

    if (!splits || splits.length < 2) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least 2 splits required' } }, { status: 400 });

    const originalOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: { include: { menuItem: true } } },
    });

    if (!originalOrder) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    // Status guard: cannot split paid, refunded, or cancelled orders
    if (['paid', 'refunded', 'cancelled'].includes(originalOrder.status)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot split order with status: ${originalOrder.status}` } }, { status: 400 });
    }

    const allItemIds = new Set(splits.flatMap((s: { items: string[] }) => s.items));
    const originalItemIds = new Set(originalOrder.items.map(i => i.id));
    const allAccounted = originalOrder.items.every(i => allItemIds.has(i.id));
    if (!allAccounted) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'All items must be assigned to splits' } }, { status: 400 });

    const newOrders = await db.$transaction(async (tx) => {
      // Mark original as cancelled/split
      await tx.order.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledReason: 'Order split', notes: `${originalOrder.notes || ''} [SPLIT from ${originalOrder.orderNumber}]` },
      });

      const created: any[] = [];
      for (const split of splits) {
        if (split.items.length === 0) continue;

        const splitItems = originalOrder.items.filter((i: { id: string }) => split.items.includes(i.id));
        const subtotal = Math.round(splitItems.reduce((s: number, i: any) => s + i.totalAmount, 0) * 100) / 100;
        const taxRate = originalOrder.subtotal > 0 ? (originalOrder.taxes / originalOrder.subtotal) * 100 : 0;
        const taxes = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        // Include service charge proportionally (add discount back to isolate service charge from discount reduction)
        const serviceChargeRate = originalOrder.subtotal > 0
          ? ((originalOrder.totalAmount - originalOrder.subtotal - originalOrder.taxes + (originalOrder.discount || 0)) / originalOrder.subtotal) * 100
          : 0;
        const serviceCharge = Math.round(subtotal * (serviceChargeRate / 100) * 100) / 100;
        const totalAmount = Math.round((subtotal + taxes + serviceCharge) * 100) / 100;

        const newOrder = await tx.order.create({
          data: {
            tenantId: user.tenantId, propertyId: originalOrder.propertyId, tableId: originalOrder.tableId,
            orderType: originalOrder.orderType, orderNumber: generateOrderNumber(),
            guestName: originalOrder.guestName, bookingId: originalOrder.bookingId,
            folioId: originalOrder.folioId, // Carry folio link from original order
            subtotal, taxes, totalAmount,
            notes: `Split from ${originalOrder.orderNumber}${split.notes ? ` | ${split.notes}` : ''}`,
            status: 'pending', kitchenStatus: 'pending',
          },
        });

        await tx.orderItem.createMany({
          data: splitItems.map((i: any) => ({
            orderId: newOrder.id, menuItemId: i.menuItemId, quantity: i.quantity,
            unitPrice: i.unitPrice, totalAmount: i.totalAmount, notes: i.notes, status: 'pending',
          })),
        });

        // H-36: Copy the original order's folio line items to each child order.
        // This ensures that any charges already posted to the folio (e.g., room service surcharge)
        // are preserved after the split.
        if (originalOrder.folioId) {
          const originalFolioItems = await tx.folioLineItem.findMany({
            where: { folioId: originalOrder.folioId, reference: `order-${id}` },
          });
          if (originalFolioItems.length > 0) {
            for (const folioItem of originalFolioItems) {
              // Proportionally assign line items to child orders
              const itemBelongsToSplit = splitItems.find((si: any) => folioItem.referenceId === si.id);
              if (itemBelongsToSplit) {
                const proportion = itemBelongsToSplit.totalAmount / (originalOrder.subtotal || 1);
                const proportionedAmount = Math.round(folioItem.totalAmount * proportion * 100) / 100;
                const proportionedTax = Math.round((folioItem.taxAmount || 0) * proportion * 100) / 100;
                await tx.folioLineItem.create({
                  data: {
                    folioId: originalOrder.folioId,
                    description: `${folioItem.description} (split)`,
                    category: folioItem.category,
                    subcategory: folioItem.subcategory,
                    quantity: itemBelongsToSplit.quantity,
                    unitPrice: proportion > 0 ? Math.round(proportionedAmount / itemBelongsToSplit.quantity * 100) / 100 : folioItem.unitPrice,
                    totalAmount: proportionedAmount,
                    taxRate: folioItem.taxRate,
                    taxAmount: proportionedTax,
                    reference: `order-${newOrder.id}`,
                    referenceType: folioItem.referenceType,
                    referenceId: itemBelongsToSplit.id,
                    serviceDate: folioItem.serviceDate || new Date(),
                    postedBy: folioItem.postedBy,
                  },
                });
              }
            }
          }
        }

        created.push(newOrder);
      }

      return created;
    });

    return NextResponse.json({ success: true, data: newOrders });
  } catch (error) {
    console.error('Error splitting order:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
