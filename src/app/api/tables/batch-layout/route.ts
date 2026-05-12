import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/tables/batch-layout
// Accepts { tables: [{ id, posX, posY, width, height, shape, capacity, name }] }
// Updates all tables in a Prisma transaction, tenant isolated
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { tables } = body;

    if (!Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'tables array is required' } }, { status: 400 });
    }

    // Verify all tables belong to user's tenant properties
    const tableIds = tables.map((t: { id: string }) => t.id);
    const existing = await db.restaurantTable.findMany({
      where: { id: { in: tableIds } },
      include: { property: { select: { tenantId: true } } },
      select: { id: true, propertyId: true, property: { select: { tenantId: true } } },
    });

    const validIds = existing.filter(t => t.property.tenantId === user.tenantId).map(t => t.id);
    const toUpdate = tables.filter((t: { id: string }) => validIds.includes(t.id));

    if (toUpdate.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'No valid tables found' } }, { status: 404 });
    }

    // Batch update in transaction
    await db.$transaction(
      toUpdate.map((t: { id: string; posX?: number; posY?: number; width?: number; height?: number; shape?: string; capacity?: number; name?: string }) =>
        db.restaurantTable.update({
          where: { id: t.id },
          data: {
            ...(t.posX !== undefined && { posX: t.posX }),
            ...(t.posY !== undefined && { posY: t.posY }),
            ...(t.width !== undefined && { width: t.width }),
            ...(t.height !== undefined && { height: t.height }),
            ...(t.shape !== undefined && { shape: t.shape }),
            ...(t.capacity !== undefined && { capacity: t.capacity }),
            ...(t.name !== undefined && { name: t.name }),
          },
        })
      )
    );

    return NextResponse.json({ success: true, data: { updated: toUpdate.length } });
  } catch (error) {
    console.error('Error batch updating table layout:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update table layout' } }, { status: 500 });
  }
}
