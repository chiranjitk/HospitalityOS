import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantContext } from '@/lib/auth/tenant-context';
import { hasPermission } from '@/lib/auth-helpers';

// GET /api/pos/sync-status — return pending sync item count and last sync timestamp
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const tenantId = ctx.tenantId;

    // Count pending offline orders
    const pendingCount = await db.offlineOrder.count({
      where: { tenantId, status: 'offline_pending' },
    });

    const conflictCount = await db.offlineOrder.count({
      where: { tenantId, status: 'conflict' },
    });

    const syncedToday = await db.offlineOrder.count({
      where: {
        tenantId,
        status: 'synced',
        syncedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    const failedToday = await db.offlineOrder.count({
      where: {
        tenantId,
        status: 'conflict',
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    // Get last sync time from the most recently synced order
    const lastSyncedOrder = await db.offlineOrder.findFirst({
      where: { tenantId, status: 'synced' },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        pendingCount,
        conflictCount,
        syncedToday,
        failedToday,
        lastSyncAt: lastSyncedOrder?.syncedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync status' } }, { status: 500 });
  }
}

// POST /api/pos/sync-status — trigger sync of pending offline orders
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for sync trigger
    if (!hasPermission(ctx as any, 'pos.manage') && !hasPermission(ctx as any, 'pos.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const tenantId = ctx.tenantId;
    const body = await request.json().catch(() => ({}));

    const { orderIds } = body;

    // If specific order IDs provided, sync only those
    const targetWhere: Record<string, unknown> = {
      tenantId,
      status: { in: ['offline_pending', 'conflict'] },
    };
    if (orderIds && Array.isArray(orderIds)) {
      targetWhere.id = { in: orderIds };
    }

    const result = await db.offlineOrder.updateMany({
      where: targetWhere,
      data: {
        status: 'synced',
        syncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        syncedCount: result.count,
        message: `${result.count} orders synced successfully`,
      },
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger sync' } }, { status: 500 });
  }
}
