import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/inventory/low-stock-alerts
 * Return items below their reorder threshold, sorted by urgency.
 * Supports filtering by category and property.
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

    // Build where clause: fetch only items that have a reorderPoint set and are active
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
      status: 'active',
      lowStockAlert: true,
      reorderPoint: { gt: 0 },
      quantity: { lte: 0 }, // placeholder — actual filter is below
      ...(category ? { category } : {}),
      ...(propertyId ? { propertyId } : {}),
    };

    // Fetch all active items with reorderPoint > 0, then filter by quantity <= reorderPoint
    // Note: Prisma doesn't support comparing two fields directly in .where(), so we
    // fetch candidates with reorderPoint set and filter in-memory.
    const items = await db.stockItem.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        status: 'active',
        lowStockAlert: true,
        reorderPoint: { gt: 0 },
        ...(category ? { category } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        quantity: true,
        reorderPoint: true,
        unitCost: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter: only items where quantity <= reorderPoint
    const lowStockItems = items
      .filter((item) => item.quantity <= (item.reorderPoint ?? Infinity))
      .map((item) => {
        const ratio = item.reorderPoint > 0 ? item.quantity / item.reorderPoint : 0;
        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          unit: item.unit,
          currentStock: item.quantity,
          reorderLevel: item.reorderPoint,
          unitCost: item.unitCost,
          urgencyRatio: Math.round(ratio * 100) / 100, // lower = more urgent
          lastUpdated: item.updatedAt,
        };
      })
      .sort((a, b) => a.urgencyRatio - b.urgencyRatio); // most urgent first

    return NextResponse.json({
      items: lowStockItems,
      total: lowStockItems.length,
    });
  } catch (error) {
    console.error('[Low Stock Alerts] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
