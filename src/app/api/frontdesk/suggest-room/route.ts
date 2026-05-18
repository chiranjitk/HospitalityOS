import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { suggestRoomAssignment } from '@/lib/ai/smart-room-assigner';

// GET /api/frontdesk/suggest-room - Get smart room suggestions for a booking
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['bookings.manage', 'frontdesk.*', 'admin.*']) && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Verify booking belongs to tenant
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, tenantId: true, propertyId: true },
    });

    if (!booking || booking.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } }, { status: 404 });
    }

    // Get smart suggestions from the AI engine
    const result = await suggestRoomAssignment(bookingId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting room suggestions:', error);
    const message = error instanceof Error ? error.message : 'Failed to get room suggestions';
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
