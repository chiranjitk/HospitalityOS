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

    if (room) where.guestName = { contains: room };

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
        roomNumber: o.notes?.match(/Room:\s*(\S+)/)?.[1] || '',
        guestName: o.guestName,
        status: o.status,
        priority: o.specialInstructions?.match(/Priority:\s*(\w+)/)?.[1] || 'normal',
        orderCategory: o.specialInstructions?.match(/Category:\s*(\w+)/)?.[1] || 'general',
        totalAmount: o.totalAmount,
        estimatedDelivery: o.specialInstructions?.match(/ETA:\s*(\d+)/)?.[1] || '25',
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
    const si = [specialInstructions, `Room: ${roomNumber}`, `Category: ${orderCategory}`, `Priority: ${priority}`, `ETA: ${priority === 'rush' ? '15' : '25'} min`].filter(Boolean).join(' | ');

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: user.tenantId, propertyId, orderType: 'room_service', orderNumber: generateOrderNumber(),
          guestName, bookingId, subtotal, taxes, totalAmount: subtotal + taxes + serviceCharge,
          notes: si, specialInstructions: si, status: 'pending', kitchenStatus: 'pending',
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

    const existing = await db.order.findFirst({ where: { id, tenantId: user.tenantId, orderType: 'room_service' } });
    if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'preparing') updateData.confirmedAt = new Date();
      if (status === 'delivered') { updateData.completedAt = new Date(); updateData.kitchenStatus = 'ready'; }
      if (status === 'cancelled') updateData.cancelledAt = new Date();
    }

    const order = await db.order.update({ where: { id }, data: updateData });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating room service order:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } }, { status: 500 });
  }
}
