import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { convertLeadToBooking } from '@/lib/crm/lead-pipeline';

// POST /api/crm/leads/[leadId]/convert — Convert lead to booking
// Body: { roomTypeId, ratePlanId?, checkIn, checkOut, specialRequests? }
// Creates a Booking record, updates lead status to 'converted', sets convertedBookingId
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['crm.manage', 'bookings.create'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Requires crm.manage or bookings.create.' } },
        { status: 403 }
      );
    }

    const { leadId } = await params;
    const body = await request.json();
    const { checkIn, checkOut, roomTypeId, ratePlanId, guestId, specialRequests } = body;

    if (!checkIn || !checkOut || !roomTypeId || !guestId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'checkIn, checkOut, roomTypeId, and guestId are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'checkOut must be after checkIn',
          },
        },
        { status: 400 }
      );
    }

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    if (existing.status === 'converted') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Lead is already converted' } },
        { status: 409 }
      );
    }

    // Validate room type exists
    const roomType = await db.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType || roomType.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    const result = await convertLeadToBooking(
      leadId,
      {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        roomTypeId,
        ratePlanId,
        guestId,
        specialRequests,
      },
      user.id
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('[crm/leads/[leadId]/convert POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to convert lead';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
