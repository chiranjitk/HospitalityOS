import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/crm - CRM module overview with actual summary data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'crm.view') && !hasPermission(user, 'crm.*') && !hasPermission(user, 'guests.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Query CRM summary data from the database
    const [totalGuests, totalLeads, totalReviews, avgRating, recentFeedback] = await Promise.all([
      db.guest.count({ where: { tenantId } }),
      db.lead.count({ where: { tenantId } }),
      db.review.count({ where: { tenantId } }),
      db.review.aggregate({
        where: { tenantId },
        _avg: { rating: true },
      }),
      db.feedback.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, rating: true, status: true, createdAt: true },
      }),
    ]);

    // Count loyalty members (guests with loyalty tier)
    const loyaltyMembers = await db.guestProfile.count({
      where: { tenantId, loyaltyTier: { not: null } },
    });

    return NextResponse.json({
      success: true,
      data: {
        module: 'crm',
        summary: {
          totalGuests,
          totalLeads,
          totalReviews,
          averageRating: avgRating._avg.rating || 0,
          loyaltyMembers,
        },
        recentFeedback,
        endpoints: {
          leads: '/api/crm/leads',
          leadsAnalytics: '/api/crm/leads/analytics',
          leadById: '/api/crm/leads/[leadId]',
          leadActivities: '/api/crm/leads/[leadId]/activities',
          leadConvert: '/api/crm/leads/[leadId]/convert',
          reviews: '/api/crm/reviews',
          feedback: '/api/crm/feedback',
        },
      },
    });
  } catch (error) {
    console.error('CRM overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch CRM overview' } },
      { status: 500 }
    );
  }
}
