import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/marketing/upsell - Upsell Engine
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'marketing.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view upsell data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Mock upsell campaigns
    const campaigns = [
      {
        id: 'camp-001',
        name: 'Room Upgrade - Deluxe to Suite',
        description: 'Offer guests an upgrade from Deluxe rooms to Suites at check-in',
        type: 'room_upgrade',
        trigger: 'pre_arrival',
        targetSegment: 'all_guests',
        status: 'active',
        priority: 'high',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        offers: [
          { id: 'off-001', name: 'Upgrade to Executive Suite', originalPrice: 8000, upsellPrice: 3500, currency: 'INR', discount: 56 },
          { id: 'off-002', name: 'Upgrade to Presidential Suite', originalPrice: 20000, upsellPrice: 8000, currency: 'INR', discount: 60 },
        ],
        targeting: { checkInDaysBefore: 2, minBookingValue: 5000, excludeSegments: ['corporate', 'group'] },
        stats: { impressions: 4520, conversions: 342, conversionRate: 7.57, revenue: 1197000 },
      },
      {
        id: 'camp-002',
        name: 'Breakfast Package Add-on',
        description: 'Promote full breakfast buffet inclusion to room-only bookings',
        type: 'package_addon',
        trigger: 'post_booking',
        targetSegment: 'new_guests',
        status: 'active',
        priority: 'medium',
        startDate: '2026-02-01',
        endDate: '2026-12-31',
        offers: [
          { id: 'off-003', name: 'Daily Breakfast Buffet - Full Stay', price: 1200, perNight: true, currency: 'INR' },
        ],
        targeting: { hoursAfterBooking: 4, minBookingValue: 3000, includeOnly: ['new_guests', 'leisure'] },
        stats: { impressions: 6780, conversions: 1890, conversionRate: 27.88, revenue: 2268000 },
      },
      {
        id: 'camp-003',
        name: 'Late Check-out Offer',
        description: 'Offer late check-out until 2 PM for a nominal fee',
        type: 'service_addon',
        trigger: 'during_stay',
        targetSegment: 'all_guests',
        status: 'active',
        priority: 'low',
        startDate: '2026-01-15',
        endDate: '2026-12-31',
        offers: [
          { id: 'off-004', name: 'Late Check-out (2 PM)', price: 1500, perStay: true, currency: 'INR' },
          { id: 'off-005', name: 'Late Check-out (4 PM)', price: 2500, perStay: true, currency: 'INR' },
        ],
        targeting: { triggerDayBeforeCheckout: true, excludeSegments: ['vip', 'loyalty_gold', 'loyalty_platinum'] },
        stats: { impressions: 3200, conversions: 896, conversionRate: 28.0, revenue: 1344000 },
      },
      {
        id: 'camp-004',
        name: 'Spa Treatment Bundle',
        description: 'Pre-arrival spa treatment packages for relaxation seekers',
        type: 'experience',
        trigger: 'pre_arrival',
        targetSegment: 'leisure',
        status: 'active',
        priority: 'medium',
        startDate: '2026-03-01',
        endDate: '2026-11-30',
        offers: [
          { id: 'off-006', name: 'Couples Spa Retreat (90 min)', originalPrice: 6000, upsellPrice: 4500, currency: 'INR', discount: 25 },
          { id: 'off-007', name: 'Signature Ayurvedic Package (120 min)', originalPrice: 8000, upsellPrice: 5500, currency: 'INR', discount: 31 },
        ],
        targeting: { checkInDaysBefore: 5, minBookingValue: 8000, includeOnly: ['leisure', 'honeymoon'] },
        stats: { impressions: 2100, conversions: 252, conversionRate: 12.0, revenue: 1134000 },
      },
      {
        id: 'camp-005',
        name: 'Airport Transfer Upgrade',
        description: 'Offer sedan/SUV airport transfer instead of shared shuttle',
        type: 'service_addon',
        trigger: 'post_booking',
        targetSegment: 'international',
        status: 'paused',
        priority: 'low',
        startDate: '2026-04-01',
        endDate: '2026-09-30',
        offers: [
          { id: 'off-008', name: 'Private Sedan Transfer', price: 3500, perTrip: true, currency: 'INR' },
          { id: 'off-009', name: 'Premium SUV Transfer', price: 5500, perTrip: true, currency: 'INR' },
        ],
        targeting: { hoursAfterBooking: 6, includeOnly: ['international', 'business'] },
        stats: { impressions: 1800, conversions: 198, conversionRate: 11.0, revenue: 792000 },
      },
      {
        id: 'camp-006',
        name: 'Minibar Premium Package',
        description: 'Upgrade to premium minibar with craft beverages and gourmet snacks',
        type: 'amenity',
        trigger: 'during_stay',
        targetSegment: 'all_guests',
        status: 'active',
        priority: 'low',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
        offers: [
          { id: 'off-010', name: 'Premium Minibar Package', price: 2000, perStay: true, currency: 'INR' },
        ],
        targeting: { hoursAfterCheckIn: 2, excludeSegments: ['corporate'] },
        stats: { impressions: 1500, conversions: 210, conversionRate: 14.0, revenue: 420000 },
      },
    ];

    // Mock offer catalog
    const offerCatalog = [
      { id: 'cat-001', category: 'Room Upgrades', icon: 'bed-double', availableOffers: 12, avgConversionRate: 7.5, topRevenue: 2400000 },
      { id: 'cat-002', category: 'Dining & F&B', icon: 'utensils', availableOffers: 8, avgConversionRate: 22.0, topRevenue: 1800000 },
      { id: 'cat-003', category: 'Spa & Wellness', icon: 'heart', availableOffers: 10, avgConversionRate: 12.0, topRevenue: 1500000 },
      { id: 'cat-004', category: 'Transportation', icon: 'car', availableOffers: 5, avgConversionRate: 11.0, topRevenue: 800000 },
      { id: 'cat-005', category: 'Experiences & Tours', icon: 'map', availableOffers: 7, avgConversionRate: 8.5, topRevenue: 650000 },
      { id: 'cat-006', category: 'Amenities & Services', icon: 'sparkles', availableOffers: 9, avgConversionRate: 15.0, topRevenue: 500000 },
      { id: 'cat-007', category: 'Event Packages', icon: 'party-popper', availableOffers: 4, avgConversionRate: 5.2, topRevenue: 1200000 },
      { id: 'cat-008', category: 'Early Check-in / Late Check-out', icon: 'clock', availableOffers: 3, avgConversionRate: 28.0, topRevenue: 900000 },
    ];

    // Mock performance stats
    const performanceStats = {
      thisMonth: {
        totalImpressions: 19900,
        totalConversions: 3788,
        overallConversionRate: 19.04,
        totalRevenue: 8951000,
        avgOrderValue: 2363,
        topPerformingCampaign: 'Breakfast Package Add-on',
        topPerformingSegment: 'leisure',
        revenueVsLastMonth: 18.5,
      },
      lastMonth: {
        totalImpressions: 17200,
        totalConversions: 3010,
        overallConversionRate: 17.5,
        totalRevenue: 7550000,
        avgOrderValue: 2508,
      },
      dailyTrend: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (6 - i)).toISOString().split('T')[0],
        impressions: Math.floor(600 + Math.random() * 200),
        conversions: Math.floor(100 + Math.random() * 60),
        revenue: Math.floor(280000 + Math.random() * 120000),
      })),
    };

    // Mock AI recommendations
    const aiRecommendations = [
      {
        id: 'ai-001',
        type: 'opportunity',
        title: 'High-demand suite upgrade window detected',
        description: 'Weekend of June 21-22 shows 92% occupancy for Deluxe rooms but only 65% for Suites. Consider launching a time-limited upgrade campaign.',
        estimatedImpact: '+₹180,000 revenue',
        confidence: 0.92,
        suggestedAction: 'Create flash upgrade campaign for June 19-20 pre-arrival emails',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      },
      {
        id: 'ai-002',
        type: 'optimization',
        title: 'Optimize breakfast addon pricing for international guests',
        description: 'International segment shows 35% conversion on breakfast addon, 12% higher than domestic. Consider introducing tiered pricing by market.',
        estimatedImpact: '+₹95,000 revenue',
        confidence: 0.87,
        suggestedAction: 'A/B test higher price point for international guest segment',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      },
      {
        id: 'ai-003',
        type: 'optimization',
        title: 'Late check-out timing could be optimized',
        description: 'Guests who accept late check-out at 2 PM have 40% higher incidental spend. Consider making this the default upsell.',
        estimatedImpact: '+₹72,000 revenue',
        confidence: 0.81,
        suggestedAction: 'Reorder late check-out offers to show 2 PM option first',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: 'ai-004',
        type: 'opportunity',
        title: 'Spa bundle underperforming with business travelers',
        description: 'Business segment shows only 2.1% conversion on spa offers. Consider shorter express treatments (30 min) tailored for this segment.',
        estimatedImpact: '+₹55,000 revenue',
        confidence: 0.76,
        suggestedAction: 'Create business-friendly express spa packages',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      },
      {
        id: 'ai-005',
        type: 'warning',
        title: 'Upsell fatigue detected for repeat guests',
        description: 'Guests on their 3rd+ stay show declining upsell engagement (down 34%). Reduce frequency and personalize based on past purchases.',
        estimatedImpact: 'Prevent -₹40,000 churn',
        confidence: 0.88,
        suggestedAction: 'Cap upsell emails at 2 per stay for repeat guests, prioritize high-value offers only',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      },
    ];

    const filteredCampaigns = status
      ? campaigns.filter(c => c.status === status)
      : campaigns;

    const stats = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalOfferCategories: offerCatalog.length,
      thisMonthRevenue: performanceStats.thisMonth.totalRevenue,
      thisMonthConversions: performanceStats.thisMonth.totalConversions,
      aiRecommendationsCount: aiRecommendations.length,
      highConfidenceRecommendations: aiRecommendations.filter(r => r.confidence >= 0.85).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        campaigns: filteredCampaigns,
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
