import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });

    const tableId = request.nextUrl.searchParams.get('tableId');
    if (!tableId) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Table ID required' } }, { status: 400 });

    const table = await db.restaurantTable.findUnique({ where: { id: tableId }, select: { id: true, propertyId: true, tenantId: true } });
    if (!table) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    // Tenant isolation: ensure user can only view tables from their tenant
    if (table.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    const activeOrders = await db.order.findMany({
      where: { tableId, tenantId: user.tenantId, status: { in: ['pending', 'confirmed', 'preparing', 'ready'] } },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (activeOrders.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    const o = activeOrders[0];
    const avgPrepTime = o.items.reduce((sum: number, i: any) => sum + (i.menuItem?.preparationTime || 15), 0) / o.items.length;

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: o.orderNumber,
        items: o.items.map((i: any) => ({ name: i.menuItem?.name || 'Unknown', quantity: i.quantity, price: i.unitPrice, status: i.status })),
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
        estimatedWait: Math.round(avgPrepTime),
      },
    });
  } catch (error) {
    console.error('Error fetching customer display:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
