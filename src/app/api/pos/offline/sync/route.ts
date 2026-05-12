import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// POST /api/pos/offline/sync — sync offline orders
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { terminalId, orderIds } = body;

    // Mark specified orders (or all pending orders for terminal) as synced
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      status: { in: ['offline_pending', 'syncing'] },
    };
    if (terminalId) where.terminalId = terminalId;
    if (orderIds && orderIds.length > 0) where.id = { in: orderIds };

    const result = await db.offlineOrder.updateMany({
      where,
      data: {
        status: 'synced',
        syncedAt: new Date(),
      },
    });

    // Update terminal status
    if (terminalId) {
      const pendingCount = await db.offlineOrder.count({
        where: { tenantId: user.tenantId, terminalId, status: 'offline_pending' },
      });
      await db.posTerminal.update({
        where: { id: terminalId },
        data: {
          syncStatus: pendingCount > 0 ? 'offline' : 'synced',
          lastSyncAt: new Date(),
          offlineQueueCount: pendingCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        syncedCount: result.count,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error syncing offline orders:', error);
    return NextResponse.json({ success: false, error: 'Failed to sync offline orders' }, { status: 500 });
  }
}
