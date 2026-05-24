import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

/**
 * GET /api/inventory/stock/alerts-config
 * Get alert configuration (reorder levels) per item.
 * Supports filtering by category, property.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
      status: 'active',
    };

    if (category) where.category = category;
    if (propertyId) where.propertyId = propertyId;

    const items = await db.stockItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        quantity: true,
        minQuantity: true,
        maxQuantity: true,
        reorderPoint: true,
        lowStockAlert: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        currentStock: item.quantity,
        minQuantity: item.minQuantity,
        maxQuantity: item.maxQuantity,
        reorderLevel: item.reorderPoint,
        lowStockAlert: item.lowStockAlert,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error('[Alerts Config] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/inventory/stock/alerts-config
 * Update reorder levels and alert thresholds for items.
 * Body: { items: [{ id, reorderLevel, minQuantity, maxQuantity, lowStockAlert }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'inventory.update') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { items } = body as {
      items: Array<{
        id: string;
        reorderLevel?: number | null;
        minQuantity?: number | null;
        maxQuantity?: number | null;
        lowStockAlert?: boolean;
      }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    if (items.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per update' }, { status: 400 });
    }

    const updatedItems = [];
    for (const item of items) {
      const updateData: Record<string, unknown> = {};
      if (item.reorderLevel !== undefined) updateData.reorderPoint = item.reorderLevel;
      if (item.minQuantity !== undefined) updateData.minQuantity = item.minQuantity;
      if (item.maxQuantity !== undefined) updateData.maxQuantity = item.maxQuantity;
      if (item.lowStockAlert !== undefined) updateData.lowStockAlert = item.lowStockAlert;

      const updated = await db.stockItem.updateMany({
        where: {
          id: item.id,
          tenantId: user.tenantId,
          deletedAt: null,
        },
        data: updateData,
      });

      if (updated.count > 0) {
        updatedItems.push({ id: item.id, updated: true });
      } else {
        updatedItems.push({ id: item.id, updated: false, error: 'Item not found or not accessible' });
      }
    }

    return NextResponse.json({
      updated: updatedItems,
      totalRequested: items.length,
      totalUpdated: updatedItems.filter((i) => i.updated).length,
    });
  } catch (error) {
    console.error('[Alerts Config] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
