import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/offline — aggregated offline POS dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['pos.view', 'pos.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view POS offline data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch terminals
    const terminalWhere: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (status) terminalWhere.syncStatus = status;

    const terminals = await db.posTerminal.findMany({
      where: terminalWhere,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch offline orders for these terminals
    const terminalIds = terminals.map(t => t.id);
    const orderWhere: Record<string, unknown> = { tenantId: user.tenantId, terminalId: { in: terminalIds } };
    const orderStatus = searchParams.get('orderStatus');
    if (orderStatus) orderWhere.status = orderStatus;

    const offlineOrders = await db.offlineOrder.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Compute stats
    const totalTerminals = terminals.length;
    const syncedTerminals = terminals.filter(t => t.syncStatus === 'synced').length;
    const syncingTerminals = terminals.filter(t => t.syncStatus === 'syncing').length;
    const offlineTerminals = terminals.filter(t => t.syncStatus === 'offline').length;
    const queuedItems = offlineOrders.filter(o => o.status === 'offline_pending').length;
    const syncingItems = offlineOrders.filter(o => o.status === 'syncing').length;
    const failedItems = offlineOrders.filter(o => o.status === 'conflict' || o.status === 'conflict').length;
    const totalQueuedAmount = offlineOrders
      .filter(o => o.status === 'offline_pending' || o.status === 'syncing')
      .reduce((sum, o) => sum + o.netAmount, 0);

    const syncStatus = {
      overall: offlineTerminals > 0 ? 'offline' : syncingTerminals > 0 ? 'syncing' : 'synced',
      lastFullSync: terminals.sort((a, b) => (b.lastSyncAt?.getTime() ?? 0) - (a.lastSyncAt?.getTime() ?? 0))[0]?.lastSyncAt?.toISOString() ?? null,
      nextScheduledSync: null,
      terminals: terminals.map(t => ({
        terminalId: t.id,
        name: t.name,
        location: t.location,
        status: t.syncStatus,
        lastSync: t.lastSyncAt?.toISOString() ?? null,
        pendingUpload: t.offlineQueueCount,
        pendingDownload: 0,
        syncLatency: t.lastSyncAt ? Math.round((Date.now() - t.lastSyncAt.getTime()) / 1000) : null,
        version: null,
      })),
    };

    const offlineQueue = offlineOrders.map(o => ({
      id: o.id,
      terminalId: o.terminalId,
      terminalName: terminals.find(t => t.id === o.terminalId)?.name ?? null,
      type: 'sale',
      orderId: o.orderNumber,
      amount: o.totalAmount,
      items: JSON.parse(o.items).length,
      guestId: o.guestId,
      guestName: null,
      createdAt: o.createdAt.toISOString(),
      priority: 'medium',
      retryCount: 0,
      status: o.status,
    }));

    const stats = {
      totalTerminals,
      syncedTerminals,
      syncingTerminals,
      offlineTerminals,
      queuedItems,
      syncingItems,
      failedItems,
      pendingConflicts: offlineOrders.filter(o => o.status === 'conflict').length,
      resolvedConflicts: offlineOrders.filter(o => o.status === 'resolved').length,
      totalQueuedAmount,
    };

    return NextResponse.json({
      success: true,
      data: {
        syncStatus,
        offlineQueue,
        conflicts: [],
        settings: {
          offlineMode: {
            enabled: true,
            autoEnableThreshold: 'Connection loss > 30 seconds',
            autoReconnectInterval: 30,
            maxOfflineHours: 24,
            storageLimit: '500MB',
            currentStorageUsed: '0MB',
          },
          syncSettings: {
            mode: 'realtime_with_fallback',
            syncInterval: 15,
            fullSyncInterval: 3600,
            retryAttempts: 3,
            retryDelayMs: 5000,
            batchSize: 50,
            priorityOrder: ['payments', 'sales', 'inventory', 'menu_updates'],
          },
          conflictResolution: {
            defaultStrategy: 'server_wins',
            autoResolve: {
              menu_price: true,
              inventory: false,
              order_status: false,
              duplicate_order: false,
              discount_mismatch: false,
            },
            notifyOnConflict: true,
            escalationTimeout: 3600,
          },
          dataRetention: {
            offlineTransactionsKeepDays: 30,
            syncLogsKeepDays: 90,
            conflictHistoryKeepDays: 180,
          },
          networkTolerance: {
            minBandwidthKbps: 256,
            maxLatencyMs: 2000,
            packetLossThreshold: 5,
          },
        },
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching offline POS data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch offline POS data' } },
      { status: 500 }
    );
  }
}
