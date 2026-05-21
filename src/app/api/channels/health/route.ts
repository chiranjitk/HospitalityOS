import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/health?propertyId=X
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;

    // Fetch connections with counts
    const connections = await db.channelConnection.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Get sync log stats
    const connIds = connections.map(c => c.id);
    const now = new Date();

    // Fetch sync stats and recent syncs in parallel
    const [syncStats, recentSyncs] = connIds.length > 0
      ? await Promise.all([
          db.channelSyncLog.groupBy({
            by: ['connectionId', 'status'],
            where: { connectionId: { in: connIds } },
            _count: true,
            _max: { createdAt: true },
          }),
          db.channelSyncLog.findMany({
            where: { connectionId: { in: connIds } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        ])
      : [[], []];

    // Build per-connection stats
    const connStatsMap = new Map<string, { success: number; failed: number; lastSuccess: Date | null; lastError: Date | null }>();
    for (const s of syncStats) {
      const e = connStatsMap.get(s.connectionId) || { success: 0, failed: 0, lastSuccess: null, lastError: null };
      if (s.status === 'success') {
        e.success += s._count;
        if (s._max.createdAt && (!e.lastSuccess || s._max.createdAt > e.lastSuccess)) e.lastSuccess = s._max.createdAt;
      } else {
        e.failed += s._count;
        if (s._max.createdAt && (!e.lastError || s._max.createdAt > e.lastError)) e.lastError = s._max.createdAt;
      }
      connStatsMap.set(s.connectionId, e);
    }

    // Build channel health
    const channelHealth = connections.map(conn => {
      const stats = connStatsMap.get(conn.id) || { success: 0, failed: 0, lastSuccess: null, lastError: null };
      const total = stats.success + stats.failed;
      const successRate = total > 0 ? Math.round((stats.success / total) * 100) : (conn.status === 'active' ? 100 : 0);

      let score = 100;
      if (total > 0) score -= Math.round((stats.failed / total) * 50);
      if (conn.status === 'error') score -= 20;
      if (conn.lastError) score -= 10;
      if (conn.status === 'active' && conn.lastSyncAt) {
        const hours = (now.getTime() - conn.lastSyncAt.getTime()) / 3600000;
        if (hours > 24) score -= 15;
        else if (hours > 6) score -= 5;
      }
      score = Math.max(0, Math.min(100, score));

      const healthStatus = conn.status === 'disconnected' || conn.status === 'pending' ? 'offline'
        : score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';

      return {
        connectionId: conn.id,
        channel: conn.channel,
        displayName: conn.displayName || conn.channel,
        status: conn.status,
        autoSync: conn.autoSync ?? false,
        syncInterval: conn.syncInterval ?? 30,
        lastSyncAt: conn.lastSyncAt,
        channelMeta: null,
        health: {
          score,
          status: healthStatus,
          uptime7d: successRate,
          successRate24h: successRate,
          successRate7d: successRate,
          avgSyncTimeMs: null,
          lastSuccessAt: stats.lastSuccess,
          lastError: conn.lastError ? { message: typeof conn.lastError === 'string' ? conn.lastError : String(conn.lastError), time: conn.lastSyncAt?.toISOString() ?? null } : null,
          retryCount: 0,
          deadLetterCount: 0,
          syncs24h: { success: stats.success, failed: stats.failed },
          syncs7d: { success: stats.success, failed: stats.failed },
        },
      };
    });

    const healthy = channelHealth.filter(c => c.health.status === 'healthy').length;
    const warning = channelHealth.filter(c => c.health.status === 'warning').length;
    const critical = channelHealth.filter(c => c.health.status === 'critical').length;
    const offline = channelHealth.filter(c => c.health.status === 'offline').length;

    return NextResponse.json({
      success: true,
      data: {
        channels: channelHealth,
        overall: {
          totalChannels: channelHealth.length,
          healthy,
          warning,
          critical,
          offline,
          averageUptime: channelHealth.length > 0 ? Math.round(channelHealth.reduce((s, c) => s + c.health.uptime7d, 0) / channelHealth.length) : 100,
          totalErrors24h: channelHealth.reduce((s, c) => s + c.health.syncs24h.failed, 0),
          allSystemsHealthy: critical === 0 && warning === 0,
        },
        syncTimeline: recentSyncs.map(s => ({
          id: s.id,
          channel: s.connectionId,
          channelDisplayName: s.connectionId,
          connectionId: s.connectionId,
          syncType: s.syncType ?? 'full',
          direction: s.direction ?? 'outbound',
          status: s.status,
          errorMessage: s.errorMessage,
          attemptCount: s.attemptCount ?? 1,
          createdAt: s.createdAt,
        })),
        alerts: [] as unknown[],
        healthHistory: [] as unknown[],
      },
    });
  } catch (error) {
    console.error('Error fetching channel health:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel health data' } },
      { status: 500 }
    );
  }
}
