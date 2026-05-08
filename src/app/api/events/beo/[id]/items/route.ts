import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const items = await db.bEOItem.findMany({
      where: { orderId: id },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'BEO not found' }, { status: 404 });
    if (!['draft', 'confirmed'].includes(beo.status))
      return NextResponse.json({ success: false, error: 'Cannot add items to BEO in current status' }, { status: 400 });

    const { items = [] } = body;
    if (!items.length) return NextResponse.json({ success: false, error: 'Items required' }, { status: 400 });

    const created = await db.bEOItem.createMany({
      data: items.map((i: { category: string; description: string; quantity: number; unitPrice: number; notes?: string; sortOrder?: number }, idx: number) => ({
        orderId: id,
        category: i.category || 'food', description: i.description,
        quantity: i.quantity || 1, unitPrice: i.unitPrice || 0,
        totalPrice: (i.unitPrice || 0) * (i.quantity || 1),
        notes: i.notes, sortOrder: i.sortOrder ?? idx,
      })),
    });

    const totalAmount = (beo.totalAmount || 0) + created.reduce((s: number, i: { totalPrice: number }) => s + i.totalPrice, 0);
    await db.banquetEventOrder.update({
      where: { id }, data: { totalAmount },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to add items' }, { status: 500 });
  }
}
