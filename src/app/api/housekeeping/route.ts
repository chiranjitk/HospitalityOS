import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/housekeeping - Housekeeping module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'housekeeping',
        description: 'Housekeeping management module for room cleaning, task assignment, and optimization',
        endpoints: {
          dashboard: '/api/housekeeping/dashboard',
          workload: '/api/housekeeping/workload',
          optimization: '/api/housekeeping/optimization',
          routes: '/api/housekeeping/routes',
          triggerCron: '/api/housekeeping/trigger-cron',
        },
      },
      message: 'Housekeeping module — use /api/housekeeping/dashboard for the main dashboard, or explore the endpoints above',
    });
  } catch (error) {
    console.error('Housekeeping overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch housekeeping overview' } },
      { status: 500 }
    );
  }
}
