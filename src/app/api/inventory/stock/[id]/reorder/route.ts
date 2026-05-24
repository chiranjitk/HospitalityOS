import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

/**
 * POST /api/inventory/stock/[id]/reorder
 * Trigger a reorder for a low-stock item by creating a PurchaseRequisition.
 * Calculates suggested order quantity (maxQuantity - currentQuantity if set, or reorderPoint * 2).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'inventory.manage') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch the stock item
    const stockItem = await db.stockItem.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        deletedAt: null,
        status: 'active',
      },
    });

    if (!stockItem) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    // Parse optional body for custom quantity
    let customQuantity: number | undefined;
    try {
      const body = await request.json();
      customQuantity = body.quantity ? parseFloat(body.quantity) : undefined;
    } catch {
      // no body is fine
    }

    // Calculate suggested order quantity
    const suggestedQuantity = customQuantity ?? (() => {
      if (stockItem.maxQuantity && stockItem.maxQuantity > stockItem.quantity) {
        return stockItem.maxQuantity - stockItem.quantity;
      }
      return Math.ceil((stockItem.reorderPoint ?? 0) * 2 - stockItem.quantity);
    })();

    if (suggestedQuantity <= 0) {
      return NextResponse.json({ error: 'No reorder needed — stock is at or above target level' }, { status: 400 });
    }

    // Generate a requisition number
    const now = new Date();
    const requisitionNo = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;

    // Determine propertyId — prefer item's, else user's first property
    let propertyId = stockItem.propertyId;
    if (!propertyId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      propertyId = firstProperty?.id;
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'No property found for this item' }, { status: 400 });
    }

    // Create PurchaseRequisition atomically with item
    const itemTotalPrice = Math.round(suggestedQuantity * stockItem.unitCost * 100) / 100;

    const requisition = await db.purchaseRequisition.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        requisitionNo,
        department: stockItem.category || 'general',
        requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        priority: 'normal',
        totalAmount: itemTotalPrice,
        notes: `Auto-generated reorder for ${stockItem.name}. Current stock: ${stockItem.quantity}, Reorder point: ${stockItem.reorderPoint}`,
        items: {
          create: {
            stockItemId: stockItem.id,
            itemName: stockItem.name,
            description: stockItem.description || undefined,
            quantity: suggestedQuantity,
            unit: stockItem.unit,
            unitPrice: stockItem.unitCost,
            totalPrice: itemTotalPrice,
          },
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      requisition,
      suggestedQuantity,
      message: `Purchase requisition ${requisitionNo} created successfully`,
    });
  } catch (error) {
    console.error('[Stock Reorder] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
