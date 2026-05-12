import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

    const { mergedGroupId, propertyId } = await request.json();
    if (!mergedGroupId) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Merge group ID required' } }, { status: 400 });

    const merge = await db.tableMerge.findFirst({ where: { id: mergedGroupId, tenantId: user.tenantId, status: 'merged' } });
    if (!merge) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Active merge not found' } }, { status: 404 });

    const tableIds: string[] = JSON.parse(merge.tableIds);

    await db.$transaction(async (tx) => {
      await tx.tableMerge.update({ where: { id: mergedGroupId }, data: { status: 'split', splitAt: new Date() } });
      await tx.restaurantTable.updateMany({ where: { id: { in: tableIds } }, data: { status: 'available' } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error splitting tables:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
