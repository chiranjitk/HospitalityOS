import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/offline/orders — list offline orders
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const terminalId = searchParams.get('terminalId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (terminalId) where.terminalId = terminalId;
    if (status) where.status = status;

    const orders = await db.offlineOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error listing offline orders:', error);
    return NextResponse.json({ success: false, error: 'Failed to list offline orders' }, { status: 500 });
  }
}

// POST /api/pos/offline/orders — create an offline order
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { terminalId, orderNumber, items, totalAmount, taxAmount, discount, netAmount, currency, orderType, guestId, roomId, bookingId, tableId } = body;

    if (!terminalId || !orderNumber) {
      return NextResponse.json({ success: false, error: 'terminalId and orderNumber are required' }, { status: 400 });
    }

    const order = await db.offlineOrder.create({
      data: {
        tenantId: user.tenantId,
        terminalId,
        orderNumber,
        items: JSON.stringify(items ?? []),
        totalAmount: totalAmount ?? 0,
        taxAmount: taxAmount ?? 0,
        discount: discount ?? 0,
        netAmount: netAmount ?? (totalAmount ?? 0) - (taxAmount ?? 0) - (discount ?? 0),
        currency: currency ?? 'USD',
        orderType: orderType ?? 'dine_in',
        guestId: guestId ?? null,
        roomId: roomId ?? null,
        bookingId: bookingId ?? null,
        tableId: tableId ?? null,
        status: 'offline_pending',
      },
    });

    // Update terminal offline queue count
    await db.posTerminal.update({
      where: { id: terminalId },
      data: { offlineQueueCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('Error creating offline order:', error);
    return NextResponse.json({ success: false, error: 'Failed to create offline order' }, { status: 500 });
  }
}
