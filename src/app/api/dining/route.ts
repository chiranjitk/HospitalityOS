import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/dining - Dining module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'pos.view') && !hasPermission(user, 'pos.*') && !hasPermission(user, 'restaurant.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'dining',
        description: 'Dining module for restaurant management, room service, POS, and reservation handling',
        endpoints: {
          roomService: '/api/room-service',
          roomServiceRooms: '/api/room-service/rooms',
          posTerminals: '/api/pos/terminals',
          posSyncStatus: '/api/pos/sync-status',
          posOffline: '/api/pos/offline',
          posMenuBoards: '/api/pos/menu-boards',
          posCustomerDisplay: '/api/pos/customer-display',
          posReservations: '/api/pos-reservations',
          posStaff: '/api/pos-staff',
          tables: '/api/tables',
          menuCategories: '/api/menu-categories',
          menuModifiers: '/api/menu-modifiers',
          menuVariants: '/api/menu-variants',
          recipes: '/api/recipes',
          restaurantReports: '/api/restaurant-reports',
        },
      },
      message: 'Dining module — use the endpoints above for restaurant operations, POS, room service, and reservations',
    });
  } catch (error) {
    console.error('Dining overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dining overview' } },
      { status: 500 }
    );
  }
}
