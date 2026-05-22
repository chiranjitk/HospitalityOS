/**
 * WiFi Partner Stats API
 *
 * GET — Partner performance stats:
 *   - Total auths
 *   - By-partner breakdown
 *   - Revenue by partner type
 *   - Daily trend (last 30 days)
 *   - Commission earned
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/partners/stats — Partner performance statistics
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Parallel queries for all stats
    const [
      totalPartners,
      activePartners,
      totalAuths,
      totalAuthsAllTime,
      totalRevenue,
      totalCommission,
      partnerBreakdown,
      revenueByType,
      dailyTrend,
    ] = await Promise.all([
      // Total partners
      db.wiFiPartner.count({ where: { tenantId } }),

      // Active partners
      db.wiFiPartner.count({ where: { tenantId, status: 'active' } }),

      // Auths in period
      db.wiFiPartnerAuth.count({
        where: { tenantId, createdAt: { gte: since } },
      }),

      // Auths all time
      db.wiFiPartnerAuth.count({
        where: { tenantId },
      }),

      // Total revenue (sum of costToPartner)
      db.wiFiPartnerAuth.aggregate({
        where: { tenantId, createdAt: { gte: since } },
        _sum: { costToPartner: true },
      }),

      // Total commission earned
      db.wiFiPartnerAuth.aggregate({
        where: { tenantId, createdAt: { gte: since } },
        _sum: { commission: true },
      }),

      // Auths by partner breakdown
      db.wiFiPartnerAuth.groupBy({
        by: ['partnerId'],
        where: { tenantId, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { costToPartner: true, commission: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // Revenue by partner type
      db.wiFiPartner.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          partnerType: true,
          totalAuths: true,
          totalRevenue: true,
        },
        orderBy: { totalRevenue: 'desc' },
        take: 20,
      }),

      // Daily auth trend (last N days)
      db.$queryRaw<Array<{ date: string; auths: number; revenue: number }>>`
        SELECT DATE(createdAt) as date, COUNT(*) as auths, SUM(costToPartner) as revenue
        FROM "WiFiPartnerAuth"
        WHERE "tenantId" = ${tenantId}::uuid AND "createdAt" >= ${since.toISOString()}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
    ]);

    // Enrich partner breakdown with partner names
    const partnerIds = partnerBreakdown.map((p) => p.partnerId);
    const partnerNames = partnerIds.length > 0
      ? await db.wiFiPartner.findMany({
          where: { id: { in: partnerIds }, tenantId },
          select: { id: true, name: true, partnerType: true },
        })
      : [];

    const partnerMap = new Map(partnerNames.map((p) => [p.id, p]));

    const enrichedBreakdown = partnerBreakdown.map((p) => ({
      partnerId: p.partnerId,
      partnerName: partnerMap.get(p.partnerId)?.name || 'Unknown',
      partnerType: partnerMap.get(p.partnerId)?.partnerType || 'unknown',
      auths: p._count.id,
      revenue: p._sum.costToPartner || 0,
      commission: p._sum.commission || 0,
    }));

    // Group revenue by partner type
    const typeMap: Record<string, { auths: number; revenue: number }> = {};
    for (const p of revenueByType) {
      const type = p.partnerType;
      if (!typeMap[type]) typeMap[type] = { auths: 0, revenue: 0 };
      typeMap[type].auths += p.totalAuths;
      typeMap[type].revenue += p.totalRevenue;
    }
    const revenueByTypeArray = Object.entries(typeMap).map(([type, data]) => ({
      partnerType: type,
      auths: data.auths,
      revenue: data.revenue,
    }));

    // Format daily trend
    const dailyTrendFormatted = dailyTrend.map((d) => ({
      date: d.date,
      auths: Number(d.auths),
      revenue: Number(d.revenue),
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalPartners,
          activePartners,
          totalAuths,
          totalAuthsAllTime,
          totalRevenue: totalRevenue._sum.costToPartner || 0,
          totalCommission: totalCommission._sum.commission || 0,
        },
        partnerBreakdown: enrichedBreakdown,
        revenueByType: revenueByTypeArray,
        dailyTrend: dailyTrendFormatted,
      },
    });
  } catch (error) {
    console.error('Error fetching partner stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partner stats' },
      { status: 500 },
    );
  }
}
