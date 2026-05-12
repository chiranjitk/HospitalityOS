/**
 * WiFi Bandwidth Upgrade Statistics API
 *
 * GET — Revenue stats, avg upsell amount, conversion rate, popular upgrade paths, revenue trend
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = 'tenant_01';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const since = startDate ? new Date(startDate) : new Date(Date.now() - days * 86400000);
    const until = endDate ? new Date(endDate) : new Date();

    const baseWhere = {
      tenantId: TENANT_ID,
      createdAt: { gte: since, lte: until },
    };

    // Completed payments only for revenue
    const completedWhere = {
      ...baseWhere,
      paymentStatus: 'completed',
    };

    const [
      totalUpgrades,
      completedUpgrades,
      revenueResult,
      avgResult,
      upgradePaths,
      trendData,
      allTimeUpgrades,
    ] = await Promise.all([
      // Total upgrades in period
      db.wiFiBandwidthUpgrade.count({ where: baseWhere }),
      // Completed upgrades in period
      db.wiFiBandwidthUpgrade.count({ where: completedWhere }),
      // Total revenue
      db.wiFiBandwidthUpgrade.aggregate({
        where: completedWhere,
        _sum: { amount: true },
      }),
      // Average upsell amount
      db.wiFiBandwidthUpgrade.aggregate({
        where: completedWhere,
        _avg: { amount: true },
      }),
      // Popular upgrade paths
      db.wiFiBandwidthUpgrade.findMany({
        where: completedWhere,
        include: {
          fromPlan: { select: { name: true } },
          toPlan: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // All upgrades in period for trend and conversion
      db.wiFiBandwidthUpgrade.findMany({
        where: baseWhere,
        select: { createdAt: true, amount: true, currency: true, paymentStatus: true },
        orderBy: { createdAt: 'asc' },
      }),
      // All-time upgrades for conversion rate
      db.wiFiBandwidthUpgrade.count({ where: { tenantId: TENANT_ID } }),
    ]);

    // Estimate total sessions (use identity logs count as proxy)
    let totalSessions = allTimeUpgrades;
    try {
      totalSessions = await db.wiFiIdentityLog.count({ where: { tenantId: TENANT_ID } }) || allTimeUpgrades;
    } catch {
      // IdentityLog may not exist, use upgrades as fallback
    }

    // Build upgrade path counts
    const pathMap = new Map<string, { from: string; to: string; count: number; revenue: number }>();
    for (const u of upgradePaths) {
      const key = `${u.fromPlan?.name || 'Unknown'} → ${u.toPlan?.name || 'Unknown'}`;
      if (!pathMap.has(key)) {
        pathMap.set(key, { from: u.fromPlan?.name || 'Unknown', to: u.toPlan?.name || 'Unknown', count: 0, revenue: 0 });
      }
      const entry = pathMap.get(key)!;
      entry.count++;
      entry.revenue += u.amount;
    }

    // Build daily revenue trend
    const trendMap = new Map<string, { date: string; revenue: number; upgrades: number }>();
    for (const u of trendData) {
      const dateKey = u.createdAt.toISOString().split('T')[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, { date: dateKey, revenue: 0, upgrades: 0 });
      }
      const entry = trendMap.get(dateKey)!;
      entry.upgrades++;
      if (u.paymentStatus === 'completed') {
        entry.revenue += u.amount;
      }
    }

    // Default currency from first completed upgrade
    const defaultCurrency = trendData.find((u) => u.paymentStatus === 'completed')?.currency || 'INR';

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue: revenueResult._sum.amount || 0,
        currency: defaultCurrency,
        totalUpgradesSold: completedUpgrades,
        averageUpsellAmount: avgResult._avg.amount ? Math.round(avgResult._avg.amount * 100) / 100 : 0,
        conversionRate: totalSessions > 0 ? Math.round((allTimeUpgrades / totalSessions) * 100) : 0,
        popularPaths: Array.from(pathMap.values()).sort((a, b) => b.count - a.count),
        revenueTrend: Array.from(trendMap.values()),
      },
    });
  } catch (error) {
    console.error('Error fetching bandwidth upgrade stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch upgrade statistics' }, { status: 500 });
  }
}
