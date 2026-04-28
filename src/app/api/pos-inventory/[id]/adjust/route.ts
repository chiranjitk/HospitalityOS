import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// POST /api/pos-inventory/[id]/adjust
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { quantity, reason, note } = body;

    if (quantity === undefined || !reason) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'quantity and reason are required' } }, { status: 400 });
    }

    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 });
    }

    const previousStock = Number(existing.currentStock);
    const newStock = Math.max(0, previousStock + Number(quantity));

    // Create movement record and update stock in transaction
    const [item] = await db.$transaction([
      db.inventoryItem.update({
        where: { id },
        data: {
          currentStock: newStock,
          status: newStock <= 0 ? 'out_of_stock' : newStock <= existing.lowStockThreshold ? 'low_stock' : 'in_stock',
          lastRestocked: quantity > 0 ? new Date() : existing.lastRestocked,
        },
      }),
      db.inventoryMovement.create({
        data: {
          propertyId: existing.propertyId,
          inventoryItemId: id,
          quantity: Number(quantity),
          previousStock,
          newStock,
          reason,
          note,
          performedBy: user.id,
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to adjust inventory' } }, { status: 500 });
  }
}
