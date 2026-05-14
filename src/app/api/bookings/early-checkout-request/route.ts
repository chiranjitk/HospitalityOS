import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/bookings/early-checkout-request - Submit early checkout request
// Accepts portal token for guest-initiated requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, requestedCheckoutDate, reason } = body;

    // Validate required fields
    if (!bookingId || !requestedCheckoutDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId and requestedCheckoutDate are required' } },
        { status: 400 }
      );
    }

    // Validate date
    const requestedDate = new Date(requestedCheckoutDate);
    if (isNaN(requestedDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'Invalid requested checkout date' } },
        { status: 400 }
      );
    }

    // Find the booking - can be accessed by portal token or by auth
    const token = body.token; // Optional portal token for guest access
    let booking;

    if (token) {
      // Guest access via portal token
      booking = await db.booking.findFirst({
        where: {
          portalToken: token,
          id: bookingId,
          status: { in: ['confirmed', 'checked_in'] },
        },
      });
    } else {
      // Staff access - booking must exist
      booking = await db.booking.findUnique({
        where: { id: bookingId },
      });
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found or not accessible' } },
        { status: 404 }
      );
    }

    // Validate booking status is checked_in
    if (booking.status !== 'checked_in') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Early checkout can only be requested for checked-in bookings' } },
        { status: 400 }
      );
    }

    const checkInDate = new Date(booking.checkIn);
    const originalCheckOut = new Date(booking.checkOut);
    const now = new Date();

    // Validate requested date is between check-in and original check-out
    if (requestedDate <= checkInDate) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'Requested checkout date must be after check-in date' } },
        { status: 400 }
      );
    }

    if (requestedDate >= originalCheckOut) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'Requested checkout date must be before the original check-out date' } },
        { status: 400 }
      );
    }

    if (requestedDate <= now) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'Requested checkout date must be in the future' } },
        { status: 400 }
      );
    }

    // Check for existing pending request on this booking
    const existingRequest = await db.earlyCheckoutRequest.findFirst({
      where: {
        bookingId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_REQUEST', message: 'An early checkout request is already pending for this booking' } },
        { status: 409 }
      );
    }

    // Create the early checkout request
    const checkoutRequest = await db.earlyCheckoutRequest.create({
      data: {
        bookingId,
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        guestId: booking.primaryGuestId,
        requestedDate,
        originalCheckOut,
        reason: reason || null,
        status: 'pending',
      },
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        tenantId: booking.tenantId,
        userId: null,
        module: 'guest_portal',
        action: 'early_checkout_request',
        entityType: 'EarlyCheckoutRequest',
        entityId: checkoutRequest.id,
        newValue: JSON.stringify({
          bookingId,
          requestedDate: requestedDate.toISOString(),
          originalCheckOut: originalCheckOut.toISOString(),
          reason: reason || null,
        }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    // Create a booking audit log
    await db.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'early_checkout_requested',
        notes: `Guest requested early checkout on ${requestedDate.toISOString()}. Original checkout: ${originalCheckOut.toISOString()}. Reason: ${reason || 'Not provided'}`,
        performedBy: 'guest_portal',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: checkoutRequest.id,
          bookingId: checkoutRequest.bookingId,
          requestedDate: checkoutRequest.requestedDate,
          originalCheckOut: checkoutRequest.originalCheckOut,
          status: checkoutRequest.status,
          createdAt: checkoutRequest.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating early checkout request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit early checkout request' } },
      { status: 500 }
    );
  }
}

// GET /api/bookings/early-checkout-request - Check existing early checkout request
export async function GET(request: NextRequest) {
  try {
    const bookingId = request.nextUrl.searchParams.get('bookingId');
    const token = request.nextUrl.searchParams.get('token');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Verify access
    if (token) {
      const booking = await db.booking.findFirst({
        where: { portalToken: token, id: bookingId },
        select: { id: true },
      });
      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }
    }

    const checkoutRequest = await db.earlyCheckoutRequest.findFirst({
      where: {
        bookingId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: checkoutRequest || null,
    });
  } catch (error) {
    console.error('Error fetching early checkout request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch early checkout request' } },
      { status: 500 }
    );
  }
}
