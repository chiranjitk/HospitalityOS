import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/crm - CRM module overview
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

    return NextResponse.json({
      success: true,
      data: {
        module: 'crm',
        description: 'CRM module for managing leads, guest reviews, and feedback',
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
      message: 'CRM module — use the endpoints above to manage leads, reviews, and feedback',
    });
  } catch (error) {
    console.error('CRM overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch CRM overview' } },
      { status: 500 }
    );
  }
}
