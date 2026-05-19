/**
 * WiFi Revenue Analytics Dashboard API
 *
 * GET — Return comprehensive revenue data for the revenue dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    // Run all independent queries in parallel
    const [
      currentUpgrades,
      previousUpgrades,
      usedVouchers,
      previousVouchers,
      partnerAuths,
      previousPartnerAuths,
      adCampaigns,
      allUpgrades,
      activePaidCount,
      topPlanGroups,
    ] = await Promise.all([
      // Current period — completed bandwidth upgrades
      db.wiFiBandwidthUpgrade.findMany({
        where: {
          tenantId: auth.tenantId,
          paymentStatus: 'completed',
          createdAt: { gte: thirtyDaysAgo },
        },
        include: { property: { select: { id: true, name: true } } },
      }),

      // Previous period — completed bandwidth upgrades
      db.wiFiBandwidthUpgrade.findMany({
        where: {
          tenantId: auth.tenantId,
          paymentStatus: 'completed',
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),

      // Current period — used vouchers
      db.wiFiVoucher.findMany({
        where: {
          tenantId: auth.tenantId,
          isUsed: true,
          usedAt: { gte: thirtyDaysAgo },
        },
        include: { plan: { select: { id: true, name: true, price: true } } },
      }),

      // Previous period — used vouchers
      db.wiFiVoucher.findMany({
        where: {
          tenantId: auth.tenantId,
          isUsed: true,
          usedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        include: { plan: { select: { id: true, name: true, price: true } } },
      }),

      // Current period — partner auths
      db.wiFiPartnerAuth.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: { gte: thirtyDaysAgo },
        },
        include: { partner: { select: { id: true, name: true } } },
      }),

      // Previous period — partner auths
      db.wiFiPartnerAuth.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),

      // Ad campaign revenue (current period)
      db.portalAdCampaign.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // All upgrades in period (for conversion rate)
      db.wiFiBandwidthUpgrade.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Active paid subscriptions (not expired)
      db.wiFiBandwidthUpgrade.count({
        where: {
          tenantId: auth.tenantId,
          paymentStatus: 'completed',
          expiresAt: { gt: new Date() },
        },
      }),

      // Top revenue plans groupBy
      db.wiFiBandwidthUpgrade.groupBy({
        by: ['toPlanId'],
        where: {
          tenantId: auth.tenantId,
          paymentStatus: 'completed',
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { id: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    // ── Revenue by source ──────────────────────────────────────────

    const upsellRevenue = currentUpgrades.reduce((sum, u) => sum + u.amount, 0);
    const voucherRevenue = usedVouchers.reduce((sum, v) => sum + (v.plan?.price || 0), 0);
    const partnerRevenue = partnerAuths.reduce((sum, p) => sum + p.commission, 0);
    const adRevenue = adCampaigns.reduce((sum, a) => sum + a.revenue, 0);
    const totalRevenue = upsellRevenue + voucherRevenue + partnerRevenue + adRevenue;

    const prevUpsellRevenue = previousUpgrades.reduce((sum, u) => sum + u.amount, 0);
    const prevVoucherRevenue = previousVouchers.reduce((sum, v) => sum + (v.plan?.price || 0), 0);
    const prevPartnerRevenue = previousPartnerAuths.reduce((sum, p) => sum + p.commission, 0);
    const prevTotalRevenue = prevUpsellRevenue + prevVoucherRevenue + prevPartnerRevenue;

    const revenueBySource = [
      { source: 'Bandwidth Upsells', revenue: upsellRevenue, percentage: totalRevenue > 0 ? Math.round((upsellRevenue / totalRevenue) * 1000) / 10 : 0 },
      { source: 'Voucher Sales', revenue: voucherRevenue, percentage: totalRevenue > 0 ? Math.round((voucherRevenue / totalRevenue) * 1000) / 10 : 0 },
      { source: 'Partner Commissions', revenue: partnerRevenue, percentage: totalRevenue > 0 ? Math.round((partnerRevenue / totalRevenue) * 1000) / 10 : 0 },
      { source: 'Ad Revenue', revenue: adRevenue, percentage: totalRevenue > 0 ? Math.round((adRevenue / totalRevenue) * 1000) / 10 : 0 },
    ];

    // ── KPIs ───────────────────────────────────────────────────────

    // ARPU — unique paid users
    const uniquePaidUsers = new Set([
      ...currentUpgrades.filter(u => u.guestId).map(u => u.guestId!),
      ...usedVouchers.filter(v => v.guestId).map(v => v.guestId!),
      ...partnerAuths.filter(p => p.guestId).map(p => p.guestId!),
    ]);
    const arpu = uniquePaidUsers.size > 0 ? totalRevenue / uniquePaidUsers.size : 0;

    // Conversion rate — completed / total
    const conversionRate = allUpgrades.length > 0
      ? (currentUpgrades.length / allUpgrades.length) * 100
      : 0;

    // ── Daily revenue trend (last 30 days) ─────────────────────────

    const dailyRevenue: { date: string; revenue: number; previousDay: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const filterByDate = (items: Array<{ createdAt: string }>) =>
        items.filter(item => {
          const d = new Date(item.createdAt);
          return d >= dayStart && d <= dayEnd;
        });

      const filterVouchersByDate = (items: Array<{ usedAt: string | Date | null }>) =>
        items.filter(item => {
          if (!item.usedAt) return false;
          const d = new Date(item.usedAt);
          return d >= dayStart && d <= dayEnd;
        });

      const dayRev =
        filterByDate(currentUpgrades).reduce((s, u) => s + u.amount, 0) +
        filterVouchersByDate(usedVouchers).reduce((s, v) => s + (v.plan?.price || 0), 0) +
        filterByDate(partnerAuths).reduce((s, p) => s + p.commission, 0) +
        filterByDate(adCampaigns).reduce((s, a) => s + a.revenue, 0);

      // Previous day
      const prevDayStart = new Date(dayStart);
      prevDayStart.setDate(prevDayStart.getDate() - 1);
      const prevDayEnd = new Date(prevDayStart);
      prevDayEnd.setHours(23, 59, 59, 999);

      const filterPrev = (items: Array<{ createdAt: string }>) =>
        items.filter(item => {
          const d = new Date(item.createdAt);
          return d >= prevDayStart && d <= prevDayEnd;
        });

      const prevDayRev =
        filterPrev(currentUpgrades).reduce((s, u) => s + u.amount, 0) +
        previousVouchers.filter(item => {
          if (!item.usedAt) return false;
          const d = new Date(item.usedAt);
          return d >= prevDayStart && d <= prevDayEnd;
        }).reduce((s, v) => s + (v.plan?.price || 0), 0) +
        filterPrev(partnerAuths).reduce((s, p) => s + p.commission, 0) +
        filterPrev(adCampaigns).reduce((s, a) => s + a.revenue, 0);

      dailyRevenue.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: Math.round(dayRev * 100) / 100,
        previousDay: Math.round(prevDayRev * 100) / 100,
      });
    }

    // ── Top plans by revenue ───────────────────────────────────────

    const planNameMap = await Promise.all(
      topPlanGroups.map(async (g) => {
        const plan = await db.wiFiPlan.findUnique({
          where: { id: g.toPlanId },
          select: { name: true },
        });
        return {
          planId: g.toPlanId,
          planName: plan?.name || 'Unknown Plan',
          subscriptions: g._count.id,
          revenue: g._sum.amount || 0,
          avgPerUser: g._count.id > 0 ? Math.round(((g._sum.amount || 0) / g._count.id) * 100) / 100 : 0,
        };
      })
    );

    // ── Peak revenue hours ─────────────────────────────────────────

    const hourlyRevenue: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyRevenue[h] = 0;

    currentUpgrades.forEach(u => {
      const hour = new Date(u.createdAt).getHours();
      hourlyRevenue[hour] += u.amount;
    });

    const peakHours = Object.entries(hourlyRevenue)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, rev]) => ({
        hour: parseInt(hour),
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        revenue: Math.round(rev * 100) / 100,
      }));

    // ── Forecast ───────────────────────────────────────────────────

    const avgDailyRevenue = dailyRevenue.reduce((s, d) => s + d.revenue, 0) / 30;
    const projectedMonthlyRevenue = avgDailyRevenue * 30;
    const growthRate = prevTotalRevenue > 0
      ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 10000) / 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          monthlyRecurringRevenue: Math.round(upsellRevenue * 100) / 100,
          arpu: Math.round(arpu * 100) / 100,
          conversionRate: Math.round(conversionRate * 10) / 10,
          activePaidSubscriptions: activePaidCount,
        },
        revenueBySource,
        dailyRevenue,
        topPlans: planNameMap,
        peakRevenueHours: peakHours,
        revenueForecast: {
          projectedMonthlyRevenue: Math.round(projectedMonthlyRevenue * 100) / 100,
          avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
          growthRate,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching revenue dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch revenue dashboard data' },
      { status: 500 }
    );
  }
}
