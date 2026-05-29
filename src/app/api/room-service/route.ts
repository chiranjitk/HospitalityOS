import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { deductRecipeStockForOrder } from '@/lib/recipe-stock-deduction';
import { generateFolioNumber } from '@/lib/billing/number-generation';
import crypto from 'crypto';

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
  return `RS-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const room = searchParams.get('room');

    const where: Record<string, unknown> = { tenantId: user.tenantId, orderType: 'room_service' };

    if (propertyId) {
      const prop = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
      if (!prop) return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
      where.propertyId = propertyId;
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (room) where.roomNumber = { contains: room };

    const orders = await db.order.findMany({
      where,
      include: { items: { include: { menuItem: { select: { id: true, name: true, price: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        roomNumber: o.roomNumber || '',
        guestName: o.guestName,
        status: o.status,
        priority: o.priority || 'normal',
        orderCategory: o.orderCategory || 'general',
        totalAmount: o.totalAmount,
        estimatedDelivery: o.estimatedDelivery || 25,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching room service orders:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });

    const body = await request.json();
    const { propertyId, roomNumber, bookingId, guestName, orderCategory, priority, specialInstructions, items } = body;

    if (!propertyId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID and items are required' } }, { status: 400 });
    }

    // Validate that roomNumber exists and has an active booking
    if (roomNumber) {
      const room = await db.room.findFirst({
        where: { number: roomNumber, propertyId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!room) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Room ${roomNumber} not found` } }, { status: 400 });
      }
      // Check for an active booking on this room (checked_in or confirmed)
      if (!bookingId) {
        const activeBooking = await db.booking.findFirst({
          where: { roomId: room.id, status: { in: ['checked_in', 'confirmed'] }, deletedAt: null },
          select: { id: true },
        });
        if (!activeBooking) {
          return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `No active booking found for room ${roomNumber}` } }, { status: 400 });
        }
      }
    }

    const property = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId, deletedAt: null }, select: { id: true, defaultTaxRate: true, taxComponents: true, serviceChargePercent: true } });
    if (!property) return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });

    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await db.menuItem.findMany({ where: { id: { in: menuItemIds }, propertyId, deletedAt: null } });

    let subtotal = 0;
    const orderItemsData = items.map((item: { menuItemId: string; quantity?: number; notes?: string }) => {
      const mi = menuItems.find(m => m.id === item.menuItemId);
      if (!mi) return null;
      const qty = item.quantity || 1;
      subtotal += mi.price * qty;
      return { menuItemId: item.menuItemId, quantity: qty, unitPrice: mi.price, totalAmount: Math.round(mi.price * qty * 100) / 100, notes: item.notes, status: 'pending' };
    }).filter(Boolean);

    if (orderItemsData.length === 0) return NextResponse.json({ success: false, error: { code: 'INVALID_ITEMS', message: 'No valid menu items' } }, { status: 400 });

    // Round subtotal to 2 decimal places
    subtotal = Math.round(subtotal * 100) / 100;

    let taxes = 0;
    if (property.taxComponents) {
      try { const tc = JSON.parse(property.taxComponents); for (const c of tc) taxes += subtotal * (c.rate / 100); } catch { taxes = subtotal * ((property.defaultTaxRate || 0) / 100); }
    } else { taxes = subtotal * ((property.defaultTaxRate || 0) / 100); }

    // Round taxes
    taxes = Math.round(taxes * 100) / 100;

    const serviceCharge = property.serviceChargePercent ? Math.round(subtotal * (property.serviceChargePercent / 100) * 100) / 100 : 0;
    const resolvedPriority = priority || 'normal';
    const estimatedDelivery = resolvedPriority === 'rush' ? 15 : 25;
    const totalAmount = Math.round((subtotal + taxes + serviceCharge) * 100) / 100;

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: user.tenantId, propertyId, orderType: 'room_service', orderNumber: generateOrderNumber(),
          guestName, bookingId, subtotal, taxes, totalAmount,
          roomNumber: roomNumber || null,
          orderCategory: orderCategory || 'general',
          priority: resolvedPriority,
          estimatedDelivery,
          notes: specialInstructions || null,
          specialInstructions: specialInstructions || null,
          status: 'pending', kitchenStatus: 'pending',
        },
      });
      await tx.orderItem.createMany({ data: orderItemsData.map((i: Record<string, unknown>) => ({ ...i, orderId: newOrder.id })) });
      return newOrder;
    });

    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId, userId: user.id, module: 'billing', action: 'create',
        entityType: 'order', entityId: order.id,
        newValue: { orderNumber: order.orderNumber, orderType: 'room_service', roomNumber, bookingId, guestName, subtotal, totalAmount, itemCount: orderItemsData.length },
        description: `Created room service order ${order.orderNumber} (${orderItemsData.length} items, total: ${totalAmount})`,
      }, request);
    } catch (auditError) { console.error('[RoomService POST] Audit log failed:', auditError); }

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('Error creating room service order:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });

    const body = await request.json();
    const { id, status } = body;
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } }, { status: 400 });

    // Fetch the order with items (needed for auto-folio posting)
    const existing = await db.order.findFirst({
      where: { id, tenantId: user.tenantId, orderType: 'room_service' },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
        property: {
          select: {
            id: true,
            currency: true,
            defaultTaxRate: true,
            taxComponents: true,
            serviceChargePercent: true,
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'preparing') updateData.confirmedAt = new Date();
      if (status === 'delivered') { updateData.completedAt = new Date(); updateData.kitchenStatus = 'ready'; }
      if (status === 'cancelled') updateData.cancelledAt = new Date();
    }

    // ── Auto-Folio Posting: when status changes to "delivered" ──────────
    // Wrap status update + folio posting in a single transaction for atomicity
    if (status === 'delivered' && existing.roomNumber) {
      try {
        // Skip if already posted to a folio
        if (existing.folioId) {
          console.log(`[RoomService] Order ${existing.orderNumber} already posted to folio ${existing.folioId}, skipping.`);
          const order = await db.order.update({ where: { id }, data: updateData });
          return NextResponse.json({ success: true, data: order });
        }

        const order = await db.$transaction(async (tx) => {
          // 1. Update order status
          const updatedOrder = await tx.order.update({ where: { id }, data: updateData });

          // M-55: Deduct recipe ingredient stock when room service order is delivered
          if (existing.propertyId) {
            try {
              await deductRecipeStockForOrder(
                tx,
                existing.items.map((item) => ({
                  menuItemId: item.menuItemId,
                  quantity: item.quantity,
                  itemName: item.menuItem?.name || null,
                })),
                existing.propertyId,
                existing.id,
                existing.orderNumber,
                user.id,
              );
            } catch (stockError) {
              console.error(`[RoomService] Stock deduction failed for order ${existing.orderNumber}:`, stockError);
              // Don't fail the order update — stock deduction is best-effort
            }
          }

          // 2. Find the booking for this room number that is currently checked in
          const room = await tx.room.findFirst({
            where: {
              number: existing.roomNumber,
              propertyId: existing.propertyId,
            },
          });

          let bookingId = existing.bookingId;

          if (!bookingId && room) {
            const activeBooking = await tx.booking.findFirst({
              where: {
                roomId: room.id,
                status: 'checked_in',
                deletedAt: null,
              },
              select: { id: true, primaryGuestId: true, propertyId: true },
            });
            if (activeBooking) {
              bookingId = activeBooking.id;
            }
          }

          if (!bookingId) {
            console.log(`[RoomService] No active booking found for room ${existing.roomNumber}, cannot auto-post to folio.`);
            return updatedOrder;
          }

          // 3. Find or create folio
          let folioId: string | null = null;
          const existingFolio = await tx.folio.findFirst({
            where: {
              bookingId,
              status: { in: ['open', 'partially_paid'] },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingFolio) {
            folioId = existingFolio.id;
          } else {
            const booking = await tx.booking.findUnique({
              where: { id: bookingId },
              select: { primaryGuestId: true, propertyId: true },
            });

            if (booking) {
              const newFolio = await tx.folio.create({
                data: {
                  tenantId: existing.tenantId,
                  propertyId: booking.propertyId || existing.propertyId,
                  bookingId,
                  guestId: booking.primaryGuestId,
                  folioNumber: generateFolioNumber('RS'),
                  status: 'open',
                  subtotal: 0,
                  taxes: 0,
                  totalAmount: 0,
                  paidAmount: 0,
                  balance: 0,
                  currency: existing.property?.currency || 'USD',
                },
              });
              folioId = newFolio.id;
            }
          }

          if (!folioId) return updatedOrder;

          // M-56: Calculate tax rate for proportional tax distribution across line items
          let taxRate = 0;
          if (existing.property) {
            try {
              const taxComponents = JSON.parse(existing.property.taxComponents || '[]');
              if (Array.isArray(taxComponents) && taxComponents.length > 0) {
                taxRate = taxComponents.reduce((sum: number, tc: { rate: number }) => sum + (tc.rate || 0), 0) / 100;
              } else {
                taxRate = (existing.property.defaultTaxRate || 0) / 100;
              }
            } catch {
              taxRate = (existing.property.defaultTaxRate || 0) / 100;
            }
          }
          const serviceChargeAmt = existing.totalAmount - existing.subtotal - (existing.taxes || 0);

          // M-56: Create individual folio line items per menu item (instead of single combined line)
          const perItemLineData = existing.items.map((item: { id: string; menuItem?: { name: string } | null; quantity: number; unitPrice: number; totalAmount: number; notes?: string | null }) => {
            const name = item.menuItem?.name || 'Unknown Item';
            const desc = item.notes ? `Room Service - ${name} (${item.notes})` : `Room Service - ${name}`;
            return {
              folioId,
              description: desc,
              category: 'room_service' as const,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount,
              serviceDate: new Date(),
              referenceType: 'order_item' as const,
              referenceId: item.id,
              taxRate: taxRate * 100,
              taxAmount: Math.round(item.totalAmount * taxRate * 100) / 100,
              postedBy: 'system:room_service_delivered' as const,
              itemCurrency: existing.property?.currency || 'USD',
            };
          });

          await tx.folioLineItem.createMany({ data: perItemLineData });

          if (serviceChargeAmt > 0) {
            await tx.folioLineItem.create({
              data: {
                folioId,
                description: `Room Service Charge (${existing.property?.serviceChargePercent || 0}%)`,
                category: 'service',
                quantity: 1,
                unitPrice: serviceChargeAmt,
                totalAmount: serviceChargeAmt,
                serviceDate: new Date(),
                referenceType: 'order',
                referenceId: existing.id,
                taxAmount: 0,
                postedBy: `system:room_service_delivered`,
                itemCurrency: existing.property?.currency || 'USD',
              },
            });
          }

          // 7. Recalculate folio totals
          const folioLineItems = await tx.folioLineItem.findMany({
            where: { folioId },
          });
          const newSubtotal = folioLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
          const newTaxes = folioLineItems.reduce((sum, item) => sum + item.taxAmount, 0);

          const currentFolio = await tx.folio.findUnique({ where: { id: folioId } });
          const newTotal = newSubtotal + newTaxes - (currentFolio?.discount || 0);

          await tx.folio.update({
            where: { id: folioId },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotal,
              balance: newTotal - (currentFolio?.paidAmount || 0),
            },
          });

          // Link order to folio and booking
          await tx.order.update({
            where: { id: existing.id },
            data: {
              folioId,
              bookingId,
            },
          });

          // Audit log (best-effort inside transaction)
          try {
            await tx.bookingAuditLog.create({
              data: {
                bookingId,
                action: 'charge_added',
                notes: JSON.stringify({
                  source: 'room_service_auto_folio',
                  orderId: existing.id,
                  orderNumber: existing.orderNumber,
                  folioId,
                  amount: existing.totalAmount,
                  lineItemCount: perItemLineData.length,
                }),
                performedBy: 'system:room_service',
              },
            });
          } catch {
            console.warn('[RoomService] Could not create booking audit log');
          }

          console.log(`[RoomService] Auto-posted order ${existing.orderNumber} ($${existing.totalAmount}, ${perItemLineData.length} line items) to folio ${folioId}`);
          return updatedOrder;
        });

        return NextResponse.json({ success: true, data: order });
      } catch (folioError) {
        console.error(`[RoomService] Error in transactional status update + folio posting for order ${existing.orderNumber}:`, folioError);
        return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } }, { status: 500 });
      }
    }

    const order = await db.order.update({ where: { id }, data: updateData });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating room service order:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } }, { status: 500 });
  }
}
