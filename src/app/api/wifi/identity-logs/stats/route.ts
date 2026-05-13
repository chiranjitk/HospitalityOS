import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subDays } from 'date-fns';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/identity-logs/stats — Verification statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default date range: last 90 days for compliance rate, today for today stats
    const ninetyDaysAgo = subDays(new Date(), 90);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Date range for method breakdown and country distribution
    const reportStart = startDate ? new Date(startDate) : ninetyDaysAgo;
    const reportEnd = endDate ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })() : new Date();

    // ── Total verifications (90-day window) ──
    const totalWhere = {
      tenantId: TENANT_ID,
      createdAt: { gte: ninetyDaysAgo },
    };

    const [totalCount, statusCounts] = await Promise.all([
      db.wiFiIdentityLog.count({ where: totalWhere }),
      db.wiFiIdentityLog.groupBy({
        by: ['verificationStatus'],
        where: totalWhere,
        _count: { id: true },
      }),
    ]);

    const verified = statusCounts.find(s => s.verificationStatus === 'verified')?._count.id || 0;
    const pending = statusCounts.find(s => s.verificationStatus === 'pending')?._count.id || 0;
    const failed = statusCounts.find(s => s.verificationStatus === 'failed')?._count.id || 0;
    const skipped = statusCounts.find(s => s.verificationStatus === 'skipped')?._count.id || 0;

    // Compliance rate: % of sessions with verified identity out of total
    const complianceRate = totalCount > 0 ? (verified / totalCount) * 100 : 0;

    // ── Today stats ──
    const todayWhere = {
      tenantId: TENANT_ID,
      createdAt: { gte: todayStart, lte: todayEnd },
    };

    const [todayTotal, todayStatusCounts] = await Promise.all([
      db.wiFiIdentityLog.count({ where: todayWhere }),
      db.wiFiIdentityLog.groupBy({
        by: ['verificationStatus'],
        where: todayWhere,
        _count: { id: true },
      }),
    ]);

    const todayVerified = todayStatusCounts.find(s => s.verificationStatus === 'verified')?._count.id || 0;
    const todayPending = todayStatusCounts.find(s => s.verificationStatus === 'pending')?._count.id || 0;
    const todayFailed = todayStatusCounts.find(s => s.verificationStatus === 'failed')?._count.id || 0;

    // ── Method breakdown (report period) ──
    const reportWhere = {
      tenantId: TENANT_ID,
      createdAt: { gte: reportStart, lte: reportEnd },
    };

    const methodStats = await db.wiFiIdentityLog.groupBy({
      by: ['verificationMethod'],
      where: reportWhere,
      _count: { id: true },
    });

    // Success rate by method
    const methodSuccess = await db.wiFiIdentityLog.groupBy({
      by: ['verificationMethod'],
      where: { ...reportWhere, verificationStatus: 'verified' },
      _count: { id: true },
    });

    const methodSuccessMap = new Map(methodSuccess.map(m => [m.verificationMethod, m._count.id]));

    const methodBreakdown = methodStats.map(m => ({
      method: m.verificationMethod,
      count: m._count.id,
      successRate: m._count.id > 0 ? (methodSuccessMap.get(m.verificationMethod) || 0) / m._count.id * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    // ── Failure reasons (report period) ──
    const failureLogs = await db.wiFiIdentityLog.findMany({
      where: {
        ...reportWhere,
        verificationStatus: 'failed',
        failureReason: { not: null },
      },
      select: { failureReason: true },
    });

    const failureReasonMap = new Map<string, number>();
    for (const log of failureLogs) {
      if (log.failureReason) {
        failureReasonMap.set(log.failureReason, (failureReasonMap.get(log.failureReason) || 0) + 1);
      }
    }

    const failureReasons = Array.from(failureReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Country distribution (report period, verified only) ──
    const countryStats = await db.wiFiIdentityLog.groupBy({
      by: ['countryCode'],
      where: {
        ...reportWhere,
        countryCode: { not: null },
      },
      _count: { id: true },
    });

    const countryDistribution = countryStats
      .filter(c => c.countryCode)
      .map(c => ({ country: c.countryCode!, count: c._count.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      data: {
        totalVerifications: totalCount,
        verified,
        pending,
        failed,
        skipped,
        complianceRate,
        todayVerified,
        todayPending,
        todayFailed,
        todayTotal: todayTotal,
        methodBreakdown,
        failureReasons,
        countryDistribution,
      },
    });
  } catch (error) {
    console.error('[F14] Error fetching identity verification stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch verification statistics' } },
      { status: 500 },
    );
  }
}
