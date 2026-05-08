import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/marketing/upsell — Upsell Engine dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view upsell data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch campaigns with their offers
    const campaignWhere: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) campaignWhere.status = status;

    const campaigns = await db.upsellCampaign.findMany({
      where: campaignWhere,
      include: { offers: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const formattedCampaigns = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      type: c.campaignType,
      trigger: c.triggerDaysBefore ? `${c.triggerDaysBefore}d before check-in` : 'Manual',
      targetSegment: c.targetSegment,
      status: c.status,
      priority: 'medium',
      startDate: c.startDate?.toISOString().split('T')[0] ?? null,
      endDate: c.endDate?.toISOString().split('T')[0] ?? null,
      offers: c.offers.map(o => o.name),
      targeting: { checkInDaysBefore: c.triggerDaysBefore ?? 0, targetSegment: c.targetSegment },
      stats: {
        impressions: c.totalSent,
        conversions: c.totalAccepted,
        conversionRate: c.conversionRate,
        revenue: c.totalRevenue,
      },
    }));

    // Fetch all offers
    const allOffers = await db.upsellOffer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { sortOrder: 'asc' },
    });

    const offerCatalog = [
      { id: 'cat-room-upgrade', category: 'Room Upgrades', icon: 'bed-double', availableOffers: allOffers.filter(o => o.offerType === 'upgrade').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-early-checkin', category: 'Early Check-in', icon: 'sun', availableOffers: allOffers.filter(o => o.offerType === 'early_checkin').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-late-checkout', category: 'Late Check-out', icon: 'clock', availableOffers: allOffers.filter(o => o.offerType === 'late_checkout').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-spa', category: 'Spa & Wellness', icon: 'heart', availableOffers: allOffers.filter(o => o.offerType === 'spa').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-dining', category: 'Dining & F&B', icon: 'utensils', availableOffers: allOffers.filter(o => o.offerType === 'dining').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-experience', category: 'Experiences & Tours', icon: 'map', availableOffers: allOffers.filter(o => o.offerType === 'experience').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-package', category: 'Packages', icon: 'package', availableOffers: allOffers.filter(o => o.offerType === 'package').length, avgConversionRate: 0, topRevenue: 0 },
      { id: 'cat-amenity', category: 'Amenities', icon: 'sparkles', availableOffers: allOffers.filter(o => o.offerType === 'amenity').length, avgConversionRate: 0, topRevenue: 0 },
    ];

    // Compute performance stats from campaigns
    const totalSent = campaigns.reduce((s, c) => s + c.totalSent, 0);
    const totalAccepted = campaigns.reduce((s, c) => s + c.totalAccepted, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.totalRevenue, 0);

    const performanceStats = {
      thisMonth: {
        totalImpressions: totalSent,
        totalConversions: totalAccepted,
        overallConversionRate: totalSent > 0 ? parseFloat(((totalAccepted / totalSent) * 100).toFixed(2)) : 0,
        totalRevenue,
        avgOrderValue: totalAccepted > 0 ? totalRevenue / totalAccepted : 0,
        topPerformingCampaign: campaigns.sort((a, b) => b.totalRevenue - a.totalRevenue)[0]?.name ?? null,
        topPerformingSegment: 'all',
        revenueVsLastMonth: 0,
      },
      lastMonth: { totalImpressions: 0, totalConversions: 0, overallConversionRate: 0, totalRevenue: 0, avgOrderValue: 0 },
    };

    const aiRecommendations: unknown[] = [];

    const stats = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalOfferCategories: offerCatalog.length,
      thisMonthRevenue: totalRevenue,
      thisMonthConversions: totalAccepted,
      aiRecommendationsCount: aiRecommendations.length,
      highConfidenceRecommendations: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        campaigns: formattedCampaigns,
        offerCatalog,
        performanceStats,
        aiRecommendations,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching upsell data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch upsell engine data' } },
      { status: 500 }
    );
  }
}
