import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
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
      return { menuItemId: item.menuItemId, quantity: qty, unitPrice: mi.price, totalAmount: mi.price * qty, notes: item.notes, status: 'pending' };
    }).filter(Boolean);

    if (orderItemsData.length === 0) return NextResponse.json({ success: false, error: { code: 'INVALID_ITEMS', message: 'No valid menu items' } }, { status: 400 });

    let taxes = 0;
    if (property.taxComponents) {
      try { const tc = JSON.parse(property.taxComponents); for (const c of tc) taxes += subtotal * (c.rate / 100); } catch { taxes = subtotal * ((property.defaultTaxRate || 0) / 100); }
    } else { taxes = subtotal * ((property.defaultTaxRate || 0) / 100); }

    const serviceCharge = property.serviceChargePercent ? subtotal * (property.serviceChargePercent / 100) : subtotal * 0.05;
    const resolvedPriority = priority || 'normal';
    const estimatedDelivery = resolvedPriority === 'rush' ? 15 : 25;

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: user.tenantId, propertyId, orderType: 'room_service', orderNumber: generateOrderNumber(),
          guestName, bookingId, subtotal, taxes, totalAmount: subtotal + taxes + serviceCharge,
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

    const order = await db.order.update({ where: { id }, data: updateData });

    // ── Auto-Folio Posting: when status changes to "delivered" ──────────
    if (status === 'delivered' && existing.roomNumber) {
      try {
        // Skip if already posted to a folio
        if (existing.folioId) {
          console.log(`[RoomService] Order ${existing.orderNumber} already posted to folio ${existing.folioId}, skipping.`);
        } else {
          // 1. Find the booking for this room number that is currently checked in
          const room = await db.room.findFirst({
            where: {
              number: existing.roomNumber,
              propertyId: existing.propertyId,
            },
          });

          let bookingId = existing.bookingId;

          if (!bookingId && room) {
            const activeBooking = await db.booking.findFirst({
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

          if (bookingId) {
            // 2. Find or create folio
            let folioId: string | null = null;
            const existingFolio = await db.folio.findFirst({
              where: {
                bookingId,
                status: { in: ['open', 'partially_paid'] },
              },
              orderBy: { createdAt: 'desc' },
            });

            if (existingFolio) {
              folioId = existingFolio.id;
            } else {
              // Get guestId for the new folio
              const booking = await db.booking.findUnique({
                where: { id: bookingId },
                select: { primaryGuestId: true, propertyId: true },
              });

              if (booking) {
                const newFolio = await db.folio.create({
                  data: {
                    tenantId: existing.tenantId,
                    propertyId: booking.propertyId || existing.propertyId,
                    bookingId,
                    guestId: booking.primaryGuestId,
                    folioNumber: `FOL-RS-${Date.now().toString(36).toUpperCase()}`,
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

            if (folioId) {
              // 3. Build item description
              const itemNames = existing.items
                .map((item: { menuItem?: { name: string } | null; quantity: number }) => {
                  const name = item.menuItem?.name || 'Unknown Item';
                  return item.quantity > 1 ? `${name} x${item.quantity}` : name;
                })
                .join(', ');
              const description = `Room Service - ${itemNames || existing.orderNumber}`;

              // 4. Calculate amounts: total + 5% surcharge
              const surchargeRate = 0.05;
              const surcharge = Math.round(existing.totalAmount * surchargeRate * 100) / 100;
              const lineItemTotal = Math.round((existing.totalAmount + surcharge) * 100) / 100;

              // Determine tax rate from property
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
              const taxAmount = Math.round(existing.totalAmount * taxRate * 100) / 100;

              // 5. Create folio line item and update folio totals in a transaction
              await db.$transaction(async (tx) => {
                // Create the line item
                await tx.folioLineItem.create({
                  data: {
                    folioId,
                    description,
                    category: 'restaurant',
                    quantity: 1,
                    unitPrice: lineItemTotal,
                    totalAmount: lineItemTotal,
                    serviceDate: new Date(),
                    referenceType: 'order',
                    referenceId: existing.id,
                    taxRate: taxRate * 100,
                    taxAmount,
                    postedBy: `system:room_service_delivered`,
                    itemCurrency: existing.property?.currency || 'USD',
                  },
                });

                // Recalculate folio totals
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

                // Create audit log
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
                        amount: lineItemTotal,
                        surcharge,
                        description,
                      }),
                      performedBy: 'system:room_service',
                    },
                  });
                } catch {
                  // Audit log creation is best-effort
                  console.warn('[RoomService] Could not create booking audit log');
                }
              });

              console.log(`[RoomService] Auto-posted order ${existing.orderNumber} ($${lineItemTotal}) to folio ${folioId}`);
            }
          } else {
            console.log(`[RoomService] No active booking found for room ${existing.roomNumber}, cannot auto-post to folio.`);
          }
        }
      } catch (folioError) {
        console.error(`[RoomService] Error auto-posting order ${existing.orderNumber} to folio:`, folioError);
        // Don't fail the main request — the status update already succeeded
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating room service order:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } }, { status: 500 });
  }
}
