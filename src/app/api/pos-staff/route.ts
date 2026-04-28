import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const assignments = searchParams.get('assignments');

    if (assignments === 'true') {
      const orders = await db.order.findMany({
        where: { tenantId: user.tenantId, propertyId: propertyId || undefined, status: { notIn: ['cancelled', 'served'] } },
        select: { id: true, tableId: true },
      });

      return NextResponse.json({ success: true, data: { assignments: orders.map(o => ({ id: o.id, tableId: o.tableId, tableNumber: '', staffId: '', staffName: '', startedAt: new Date().toISOString() })), orders: orders.length } });
    }

    const staffUsers = await db.user.findMany({
      where: { tenantId: user.tenantId, status: 'active', deletedAt: null },
      select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } },
      take: 20,
    });

    const staffList = staffUsers.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role?.name || 'Staff',
      status: 'on-duty',
      tablesCount: 0,
      ordersCount: 0,
    }));

    return NextResponse.json({ success: true, data: staffList });
  } catch (error) {
    console.error('Error fetching POS staff:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const { propertyId, tableId, staffId } = await request.json();
    if (!tableId || !staffId) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 });

    const table = await db.restaurantTable.findFirst({ where: { id: tableId, propertyId, tenantId: user.tenantId } });
    if (!table) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    return NextResponse.json({ success: true, data: { id: crypto.randomUUID(), tableId, tableNumber: table.number, staffId, staffName: 'Staff', startedAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Error creating POS staff assignment:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const body = await request.json();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
