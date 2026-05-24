import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

// GET /api/laundry/orders - List laundry orders with filters & pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.LaundryOrderWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo) where.receivedAt.lte = new Date(dateTo);
    }

    const [orders, total] = await Promise.all([
      db.laundryOrder.findMany({
        where,
        include: {
          items: true,
          booking: {
            select: { id: true, confirmationCode: true, primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
          guest: {
            select: { id: true, firstName: true, lastName: true },
          },
          folio: {
            select: { id: true, folioNumber: true, status: true },
          },
        },
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.laundryOrder.count({ where }),
    ]);

    // Aggregate totals
    const totals = await db.laundryOrder.aggregate({
      where,
      _sum: { totalPrice: true, totalItems: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        orders,
        totals: {
          count: totals._count,
          totalAmount: totals._sum.totalPrice || 0,
          totalItems: totals._sum.totalItems || 0,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/laundry/orders]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/laundry/orders - Create a laundry order with items in a transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.create') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId,
      bookingId,
      guestId,
      roomId,
      orderType,
      paymentMethod,
      specialInstructions,
      items,
      notes,
    } = body;

    if (!propertyId || !roomId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'propertyId, roomId, and items array are required' }, { status: 400 });
    }

    // Validate all item IDs exist and look up their prices
    const itemIds = items.map((i: { itemId: string }) => i.itemId);
    const laundryItems = await db.laundryItem.findMany({
      where: { id: { in: itemIds }, tenantId: user.tenantId, propertyId },
    });

    if (laundryItems.length !== itemIds.length) {
      const foundIds = laundryItems.map(i => i.id);
      const missing = itemIds.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json({ success: false, error: `Laundry items not found: ${missing.join(', ')}` }, { status: 400 });
    }

    // Build order item data and auto-calculate totals
    const priceMap = new Map(laundryItems.map(i => [i.id, i]));
    let totalItems = 0;
    let totalPrice = 0;
    const orderItemsData: {
      itemId: string;
      itemName: string;
      serviceType: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      status: string;
      notes?: string;
    }[] = [];

    for (const item of items) {
      const laundryItem = priceMap.get(item.itemId)!;
      const qty = item.quantity || 1;
      // Allow custom price override, fallback to laundry item price
      const unitPrice = item.unitPrice ?? laundryItem.unitPrice;
      const itemTotal = qty * unitPrice;
      totalItems += qty;
      totalPrice += itemTotal;

      orderItemsData.push({
        itemId: item.itemId,
        itemName: item.itemName || laundryItem.name,
        serviceType: item.serviceType || laundryItem.serviceType,
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
        status: 'received',
        notes: item.notes || null,
      });
    }

    // Use transaction to create order + items atomically
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.laundryOrder.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          bookingId: bookingId || null,
          guestId: guestId || null,
          roomId,
          orderType: orderType || 'guest',
          status: 'received',
          totalItems,
          totalPrice,
          currency: 'USD',
          paymentMethod: paymentMethod || 'room_charge',
          specialInstructions: specialInstructions || null,
          collectedBy: user.id,
          notes: notes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
          booking: {
            select: { id: true, confirmationCode: true },
          },
          guest: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/laundry/orders]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
