import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getUsageHistory } from '@/lib/license-enforcement';

// GET - Usage history for charts
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('moduleKey');
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

    if (!moduleKey) {
      return NextResponse.json(
        { success: false, error: 'moduleKey query parameter is required' },
        { status: 400 }
      );
    }

    // Validate moduleKey format (alphanumeric + underscore, max 100 chars)
    if (typeof moduleKey !== 'string' || !/^[a-zA-Z0-9_]+$/.test(moduleKey) || moduleKey.length > 100) {
      return NextResponse.json(
        { success: false, error: 'moduleKey must be alphanumeric (with underscores) and max 100 characters' },
        { status: 400 }
      );
    }

    const history = await getUsageHistory(tenantId, moduleKey, days);

    return NextResponse.json({
      success: true,
      data: {
        moduleKey,
        days,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching usage history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch usage history' },
      { status: 500 }
    );
  }
}
