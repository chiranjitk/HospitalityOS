import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/maintenance - Maintenance module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'maintenance.read') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'maintenance',
        description: 'Maintenance management module for work orders, preventive maintenance, and vendor coordination',
        endpoints: {
          workOrders: '/api/maintenance/work-orders',
          workOrderById: '/api/maintenance/work-orders/[id]',
        },
      },
      message: 'Maintenance module — use /api/maintenance/work-orders to list and manage work orders',
    });
  } catch (error) {
    console.error('Maintenance overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch maintenance overview' } },
      { status: 500 }
    );
  }
}
