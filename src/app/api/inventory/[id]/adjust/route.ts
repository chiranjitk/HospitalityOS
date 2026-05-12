import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { notifyInventoryAlert } from '@/lib/notify';

// POST /api/inventory/[id]/adjust - Adjust stock quantity
// Body: { quantity: number (positive=add, negative=remove), reason: string, note?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.adjust') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { quantity, reason, note } = body;

    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'quantity is required' } },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reason is required' } },
        { status: 400 }
      );
    }

    const validReasons = ['Received', 'Waste', 'Transfer', 'Inventory Count', 'Damage', 'Other'];
    if (!validReasons.includes(reason) && !['received', 'waste', 'transfer', 'inventory_count', 'damage', 'other'].includes(reason.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user's tenant
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    const previousStock = Number(existing.currentStock);
    const adjustmentQty = Number(quantity);
    const newStock = previousStock + adjustmentQty;

    // Validate: resulting stock must be >= 0
    if (newStock < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Resulting stock cannot be negative. Current: ${previousStock}, Adjustment: ${adjustmentQty}, Result: ${newStock}` } },
        { status: 400 }
      );
    }

    // Auto-calculate new status
    const newThreshold = Number(existing.lowStockThreshold);
    const newStatus = newStock <= 0
      ? 'out_of_stock'
      : newStock <= newThreshold
        ? 'low_stock'
        : 'in_stock';

    // Create movement record and update stock in transaction
    const [item, movement] = await db.$transaction([
      db.inventoryItem.update({
        where: { id },
        data: {
          currentStock: newStock,
          status: newStatus,
          lastRestocked: adjustmentQty > 0 ? new Date() : existing.lastRestocked,
        },
        include: {
          _count: { select: { movements: true } },
        },
      }),
      db.inventoryMovement.create({
        data: {
          propertyId: existing.propertyId,
          inventoryItemId: id,
          quantity: adjustmentQty,
          previousStock,
          newStock,
          reason,
          note: note || null,
          performedBy: user.id,
        },
      }),
    ]);

    if (newStatus === 'low_stock' || newStatus === 'out_of_stock') {
      notifyInventoryAlert({
        tenantId: user.tenantId,
        userId: user.id,
        itemName: existing.name,
        currentStock: newStock,
        threshold: newThreshold,
        status: newStatus as 'low_stock' | 'out_of_stock',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        item,
        movement,
      },
    });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to adjust inventory' } },
      { status: 500 }
    );
  }
}

// GET /api/inventory/[id]/adjust - Get stock movement history for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.view') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100);

    // Verify item exists and belongs to user's tenant
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where: { inventoryItemId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      db.inventoryMovement.count({
        where: { inventoryItemId: id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: movements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock movements' } },
      { status: 500 }
    );
  }
}
