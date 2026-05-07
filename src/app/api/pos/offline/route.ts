import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/pos/offline - Offline POS
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'pos.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view POS offline data' } },
        { status: 403 }
      );
    }

    // Mock sync status across POS terminals
    const syncStatus = {
      overall: 'synced',
      lastFullSync: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      nextScheduledSync: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
      terminals: [
        { terminalId: 'pos-001', name: 'Main Restaurant POS', location: 'Restaurant', status: 'synced', lastSync: new Date(Date.now() - 1000 * 60 * 1).toISOString(), pendingUpload: 0, pendingDownload: 0, syncLatency: 12, version: '4.2.1' },
        { terminalId: 'pos-002', name: 'Bar POS', location: 'Bar', status: 'synced', lastSync: new Date(Date.now() - 1000 * 60 * 3).toISOString(), pendingUpload: 0, pendingDownload: 0, syncLatency: 8, version: '4.2.1' },
        { terminalId: 'pos-003', name: 'Pool Bar POS', location: 'Pool Area', status: 'syncing', lastSync: new Date(Date.now() - 1000 * 60 * 10).toISOString(), pendingUpload: 5, pendingDownload: 2, syncLatency: 45, version: '4.2.1' },
        { terminalId: 'pos-004', name: 'Room Service POS', location: 'Kitchen', status: 'synced', lastSync: new Date(Date.now() - 1000 * 60 * 30).toISOString(), pendingUpload: 0, pendingDownload: 0, syncLatency: 15, version: '4.2.0' },
        { terminalId: 'pos-005', name: 'Banquet POS', location: 'Ballroom', status: 'offline', lastSync: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), pendingUpload: 12, pendingDownload: 8, syncLatency: null, version: '4.2.0' },
        { terminalId: 'pos-006', name: 'Gift Shop POS', location: 'Lobby', status: 'synced', lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(), pendingUpload: 0, pendingDownload: 0, syncLatency: 10, version: '4.2.1' },
      ],
    };

    // Mock offline queue
    const offlineQueue = [
      { id: 'oq-001', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'sale', orderId: 'ORD-BQT-001', amount: 45000, items: 12, guestId: 'guest-grp-001', guestName: 'Corporate Group - TechCorp', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), priority: 'high', retryCount: 0, status: 'queued' },
      { id: 'oq-002', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'sale', orderId: 'ORD-BQT-002', amount: 32000, items: 8, guestId: 'guest-grp-001', guestName: 'Corporate Group - TechCorp', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), priority: 'high', retryCount: 0, status: 'queued' },
      { id: 'oq-003', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'sale', orderId: 'ORD-BQT-003', amount: 18000, items: 6, guestId: 'guest-grp-002', guestName: 'Wedding Reception - Sharma Family', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), priority: 'high', retryCount: 1, status: 'queued' },
      { id: 'oq-004', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'payment', orderId: 'ORD-BQT-001', amount: 45000, paymentMethod: 'corporate_account', authCode: 'OFFLINE-78901', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), priority: 'critical', retryCount: 2, status: 'failed' },
      { id: 'oq-005', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'sale', orderId: 'ORD-BQT-004', amount: 8500, items: 4, guestId: 'guest-012', guestName: 'Ankit Gupta', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), priority: 'medium', retryCount: 0, status: 'queued' },
      { id: 'oq-006', terminalId: 'pos-003', terminalName: 'Pool Bar POS', type: 'sale', orderId: 'ORD-POOL-001', amount: 3200, items: 3, guestId: 'guest-001', guestName: 'James Richardson', createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(), priority: 'medium', retryCount: 0, status: 'syncing' },
      { id: 'oq-007', terminalId: 'pos-003', terminalName: 'Pool Bar POS', type: 'sale', orderId: 'ORD-POOL-002', amount: 2400, items: 2, guestId: 'guest-003', guestName: 'Yuki Tanaka', createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(), priority: 'low', retryCount: 0, status: 'syncing' },
      { id: 'oq-008', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'menu_update', orderId: null, amount: 0, items: 0, guestId: null, guestName: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), priority: 'medium', retryCount: 1, status: 'queued' },
      { id: 'oq-009', terminalId: 'pos-005', terminalName: 'Banquet POS', type: 'sale', orderId: 'ORD-BQT-005', amount: 12000, items: 5, guestId: 'guest-grp-002', guestName: 'Wedding Reception - Sharma Family', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), priority: 'high', retryCount: 0, status: 'queued' },
      { id: 'oq-010', terminalId: 'pos-003', terminalName: 'Pool Bar POS', type: 'payment', orderId: 'ORD-POOL-003', amount: 5800, paymentMethod: 'room_folio', authCode: 'OFFLINE-78903', createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(), priority: 'medium', retryCount: 0, status: 'syncing' },
    ];

    // Mock conflicts
    const conflicts = [
      { id: 'cft-001', type: 'menu_price', terminalId: 'pos-004', terminalName: 'Room Service POS', localValue: 450, serverValue: 500, itemName: 'Caesar Salad', field: 'price', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), status: 'resolved', resolution: 'server_wins', resolvedBy: 'admin', resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { id: 'cft-002', type: 'order_status', terminalId: 'pos-005', terminalName: 'Banquet POS', localValue: 'completed', serverValue: 'pending', itemName: 'ORD-BQT-001', field: 'status', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), status: 'pending', resolution: null, resolvedBy: null, resolvedAt: null },
      { id: 'cft-003', type: 'inventory', terminalId: 'pos-003', terminalName: 'Pool Bar POS', localValue: 24, serverValue: 18, itemName: 'Kingfisher Beer (330ml)', field: 'stock', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'pending', resolution: null, resolvedBy: null, resolvedAt: null },
      { id: 'cft-004', type: 'duplicate_order', terminalId: 'pos-005', terminalName: 'Banquet POS', localValue: 'ORD-BQT-003', serverValue: 'ORD-BQT-003 (existing)', itemName: 'ORD-BQT-003', field: 'order_id', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'pending', resolution: null, resolvedBy: null, resolvedAt: null },
      { id: 'cft-005', type: 'menu_price', terminalId: 'pos-005', terminalName: 'Banquet POS', localValue: 1200, serverValue: 1500, itemName: 'Grilled Salmon', field: 'price', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), status: 'pending', resolution: null, resolvedBy: null, resolvedAt: null },
      { id: 'cft-006', type: 'discount_mismatch', terminalId: 'pos-004', terminalName: 'Room Service POS', localValue: 15, serverValue: 10, itemName: 'Employee Discount', field: 'discount_percent', detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), status: 'resolved', resolution: 'server_wins', resolvedBy: 'admin', resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString() },
    ];

    // Mock offline settings
    const settings = {
      offlineMode: {
        enabled: true,
        autoEnableThreshold: 'Connection loss > 30 seconds',
        autoReconnectInterval: 30,
        maxOfflineHours: 24,
        storageLimit: '500MB',
        currentStorageUsed: '127MB',
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
    };

    const stats = {
      totalTerminals: syncStatus.terminals.length,
      syncedTerminals: syncStatus.terminals.filter(t => t.status === 'synced').length,
      syncingTerminals: syncStatus.terminals.filter(t => t.status === 'syncing').length,
      offlineTerminals: syncStatus.terminals.filter(t => t.status === 'offline').length,
      queuedItems: offlineQueue.filter(q => q.status === 'queued').length,
      syncingItems: offlineQueue.filter(q => q.status === 'syncing').length,
      failedItems: offlineQueue.filter(q => q.status === 'failed').length,
      pendingConflicts: conflicts.filter(c => c.status === 'pending').length,
      resolvedConflicts: conflicts.filter(c => c.status === 'resolved').length,
      totalQueuedAmount: offlineQueue.filter(q => q.status === 'queued' || q.status === 'syncing').reduce((sum, q) => sum + q.amount, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        syncStatus,
        offlineQueue,
        conflicts,
        settings,
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
