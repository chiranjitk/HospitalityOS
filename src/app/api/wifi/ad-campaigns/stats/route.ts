import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';
import { format, subDays, startOfDay } from 'date-fns';

// GET - Campaign performance stats
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    // Fetch all campaigns for this tenant
    const campaigns = await db.portalAdCampaign.findMany({
      where: { tenantId },
    });

    // Overall stats
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const totalSpentBudget = campaigns.reduce((sum, c) => sum + c.spentBudget, 0);
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.maxBudget || 0), 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // By-slot breakdown
    const slotBreakdown: Record<string, { impressions: number; clicks: number; revenue: number; count: number }> = {};
    for (const c of campaigns) {
      if (!slotBreakdown[c.slot]) {
        slotBreakdown[c.slot] = { impressions: 0, clicks: 0, revenue: 0, count: 0 };
      }
      slotBreakdown[c.slot].impressions += c.impressions;
      slotBreakdown[c.slot].clicks += c.clicks;
      slotBreakdown[c.slot].revenue += c.revenue;
      slotBreakdown[c.slot].count += 1;
    }

    // By-advertiser breakdown
    const advertiserBreakdown: Record<string, { impressions: number; clicks: number; revenue: number; campaigns: number }> = {};
    for (const c of campaigns) {
      if (!advertiserBreakdown[c.advertiser]) {
        advertiserBreakdown[c.advertiser] = { impressions: 0, clicks: 0, revenue: 0, campaigns: 0 };
      }
      advertiserBreakdown[c.advertiser].impressions += c.impressions;
      advertiserBreakdown[c.advertiser].clicks += c.clicks;
      advertiserBreakdown[c.advertiser].revenue += c.revenue;
      advertiserBreakdown[c.advertiser].campaigns += 1;
    }

    // Sort advertisers by revenue descending
    const topAdvertisers = Object.entries(advertiserBreakdown)
      .map(([advertiser, stats]) => ({ advertiser, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    // Daily trend for last 30 days
    const dailyTrend: { date: string; impressions: number; clicks: number; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = startOfDay(subDays(new Date(), i));
      const dayEnd = startOfDay(subDays(new Date(), i - 1));

      // Count impressions/clicks for campaigns that were active on this day
      // Since we don't have a daily tracking table, we estimate based on campaign duration
      let dayImpressions = 0;
      let dayClicks = 0;
      let dayRevenue = 0;

      for (const c of campaigns) {
        const cStart = new Date(c.startDate);
        const cEnd = new Date(c.endDate);
        // Check if campaign was active on this day
        if (cStart <= dayEnd && cEnd >= dayStart && c.status !== 'draft') {
          const activeDays = Math.max(1, Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24)));
          // Distribute total metrics evenly across active days
          dayImpressions += Math.round(c.impressions / activeDays);
          dayClicks += Math.round(c.clicks / activeDays);
          dayRevenue += Math.round((c.revenue / activeDays) * 100) / 100;
        }
      }

      dailyTrend.push({
        date: format(dayStart, 'yyyy-MM-dd'),
        impressions: dayImpressions,
        clicks: dayClicks,
        revenue: dayRevenue,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCampaigns: campaigns.length,
          activeCampaigns,
          totalImpressions,
          totalClicks,
          ctr: Math.round(ctr * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalSpentBudget: Math.round(totalSpentBudget * 100) / 100,
          totalBudget: Math.round(totalBudget * 100) / 100,
        },
        slotBreakdown,
        topAdvertisers,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching ad campaign stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ad campaign stats' } },
      { status: 500 }
    );
  }
}
