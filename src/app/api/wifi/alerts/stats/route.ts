import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// ─── GET /api/wifi/alerts/stats ───────────────────────────────────────────────
// Return alert statistics: counts by severity, by type, trend, active count, avg resolution time
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const baseWhere = { tenantId: auth.tenantId };

    // ── 1. Count by severity (active + acknowledged only) ──
    const severityCounts = await db.wiFiAlert.groupBy({
      by: ['severity'],
      where: { ...baseWhere, status: { in: ['active', 'acknowledged'] } },
      _count: { id: true },
    });
    const bySeverity: Record<string, number> = {};
    for (const row of severityCounts) {
      bySeverity[row.severity] = row._count.id;
    }

    // ── 2. Count by type (active + acknowledged only) ──
    const typeCounts = await db.wiFiAlert.groupBy({
      by: ['type'],
      where: { ...baseWhere, status: { in: ['active', 'acknowledged'] } },
      _count: { id: true },
    });
    const byType: Record<string, number> = {};
    for (const row of typeCounts) {
      byType[row.type] = row._count.id;
    }

    // ── 3. Total counts by status ──
    const statusCounts = await db.wiFiAlert.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { id: true },
    });
    const byStatus: Record<string, number> = { active: 0, acknowledged: 0, resolved: 0 };
    for (const row of statusCounts) {
      byStatus[row.status] = row._count.id;
    }

    // ── 4. Trend: new this week vs last week ──
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const [thisWeekCount, lastWeekCount] = await Promise.all([
      db.wiFiAlert.count({
        where: { ...baseWhere, createdAt: { gte: startOfThisWeek } },
      }),
      db.wiFiAlert.count({
        where: { ...baseWhere, createdAt: { gte: startOfLastWeek, lt: startOfThisWeek } },
      }),
    ]);

    // ── 5. Average resolution time (in minutes) ──
    // Resolution time = resolvedAt - createdAt for resolved alerts
    const resolvedAlerts = await db.wiFiAlert.findMany({
      where: {
        ...baseWhere,
        status: 'resolved',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
      take: 500, // Limit to avoid huge queries
      orderBy: { resolvedAt: 'desc' },
    });

    let avgResolutionMinutes: number | null = null;
    if (resolvedAlerts.length > 0) {
      const totalMinutes = resolvedAlerts.reduce((sum, alert) => {
        if (alert.resolvedAt) {
          const diffMs = alert.resolvedAt.getTime() - alert.createdAt.getTime();
          return sum + diffMs / (1000 * 60);
        }
        return sum;
      }, 0);
      avgResolutionMinutes = Math.round(totalMinutes / resolvedAlerts.length);
    }

    // ── 6. Active count (non-resolved) ──
    const activeCount = byStatus.active + byStatus.acknowledged;

    return NextResponse.json({
      success: true,
      data: {
        bySeverity,
        byType,
        byStatus,
        trend: {
          thisWeek: thisWeekCount,
          lastWeek: lastWeekCount,
          change: lastWeekCount > 0 ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) : 0,
        },
        activeCount,
        avgResolutionMinutes,
      },
    });
  } catch (error: any) {
    console.error('[WiFi Alerts Stats API] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert statistics' } },
      { status: 500 }
    );
  }
}
