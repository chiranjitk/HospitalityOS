import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { getLeadAnalytics, autoExpireLeads } from '@/lib/crm/lead-pipeline';

// GET /api/crm/leads/analytics — Lead pipeline analytics
// Query params: propertyId, dateFrom, dateTo
// Returns: funnel data, conversion rates, source breakdown, pipeline value, response times
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const dateFromStr = searchParams.get('dateFrom');
    const dateToStr = searchParams.get('dateTo');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 }
      );
    }

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;

    const analytics = await getLeadAnalytics(user.tenantId, propertyId, dateFrom, dateTo);

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error('[crm/leads/analytics GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch lead analytics' } },
      { status: 500 }
    );
  }
}

// POST /api/crm/leads/analytics — Run maintenance actions
// Body: { action: 'auto_expire' }
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check for maintenance actions
    if (!hasAnyPermission(user, ['crm.manage', 'admin.*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'auto_expire') {
      const result = await autoExpireLeads(user.tenantId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Supported: auto_expire' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[crm/leads/analytics POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute action' } },
      { status: 500 }
    );
  }
}
