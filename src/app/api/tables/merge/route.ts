import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const merges = await db.tableMerge.findMany({ where, orderBy: { mergedAt: 'desc' }, take: 50 });

    const data = await Promise.all(merges.map(async (m) => {
      const tableIds: string[] = JSON.parse(m.tableIds);
      const tables = await db.restaurantTable.findMany({ where: { id: { in: tableIds } }, select: { id: true, number: true, capacity: true } });
      return { ...m, tableIds: JSON.stringify(tableIds), tables };
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching table merges:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

    const { propertyId, tableIds, partySize } = await request.json();
    if (!propertyId || !tableIds || tableIds.length < 2) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Select at least 2 tables' } }, { status: 400 });

    const prop = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId, deletedAt: null } });
    if (!prop) return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY' } }, { status: 400 });

    const tables = await db.restaurantTable.findMany({ where: { id: { in: tableIds }, propertyId } });
    if (tables.length !== tableIds.length) return NextResponse.json({ success: false, error: { code: 'INVALID_TABLES', message: 'Some tables not found' } }, { status: 400 });

    const unavailable = tables.find(t => t.status !== 'available');
    if (unavailable) return NextResponse.json({ success: false, error: { code: 'TABLE_UNAVAILABLE', message: `Table ${unavailable.number} is not available` } }, { status: 400 });

    await db.$transaction(async (tx) => {
      await tx.tableMerge.create({ data: { tenantId: user.tenantId, propertyId, tableIds: JSON.stringify(tableIds), partySize } });
      await tx.restaurantTable.updateMany({ where: { id: { in: tableIds } }, data: { status: 'merged' } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error merging tables:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
