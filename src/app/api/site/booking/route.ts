/**
 * Public Booking API Route
 * Accepts room booking requests from the public-facing hotel website.
 * No authentication required — this is the public-facing endpoint.
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = 'SS-';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

interface BookingRequestBody {
  websiteId: string;
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  adults?: number;
  children?: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  specialRequests?: string;
}

// ---------------------------------------------------------------------------
// POST /api/site/booking
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Parse & validate request body ----
    let body: BookingRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      );
    }

    const { websiteId, propertyId, roomTypeId, checkIn, checkOut, guestName, guestEmail } = body;

    // Required fields
    if (!websiteId || typeof websiteId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required.' } },
        { status: 400 },
      );
    }
    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required.' } },
        { status: 400 },
      );
    }
    if (!roomTypeId || typeof roomTypeId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomTypeId is required.' } },
        { status: 400 },
      );
    }
    if (!checkIn || typeof checkIn !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'checkIn date is required.' } },
        { status: 400 },
      );
    }
    if (!checkOut || typeof checkOut !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'checkOut date is required.' } },
        { status: 400 },
      );
    }
    if (!guestName || typeof guestName !== 'string' || guestName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestName is required (min 2 characters).' } },
        { status: 400 },
      );
    }
    if (!guestEmail || typeof guestEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid guestEmail is required.' } },
        { status: 400 },
      );
    }

    // ---- 2. Validate dates ----
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date format. Use YYYY-MM-DD.' } },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-in date cannot be in the past.' } },
        { status: 400 },
      );
    }

    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-out date must be after check-in date.' } },
        { status: 400 },
      );
    }

    // ---- 3. Look up website and verify it is published ----
    const website = await db.hotelWebsite.findUnique({
      where: { id: websiteId },
    });

    if (!website) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Website not found.' } },
        { status: 404 },
      );
    }

    if (website.status !== 'published') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Website is not published.' } },
        { status: 404 },
      );
    }

    // Verify the website belongs to the provided property
    if (website.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Website does not match the provided property.' } },
        { status: 400 },
      );
    }

    // ---- 4. Look up room type and verify it exists & is active ----
    const roomType = await db.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType || roomType.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found for this property.' } },
        { status: 404 },
      );
    }

    if (roomType.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAVAILABLE', message: 'This room type is currently unavailable.' } },
        { status: 400 },
      );
    }

    // ---- 5. Calculate nights and pricing ----
    const diffMs = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (nights < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Minimum stay is 1 night.' } },
        { status: 400 },
      );
    }

    if (nights > 90) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum stay is 90 nights.' } },
        { status: 400 },
      );
    }

    const roomRate = roomType.basePrice;
    const totalAmount = roomRate * nights;

    // ---- 6. Create or find guest ----
    const adults = body.adults ?? body.guests ?? 1;
    const children = body.children ?? 0;
    const guestPhone = body.guestPhone ?? '';

    // Parse guestName into firstName / lastName
    const nameParts = guestName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Try to find an existing guest by email within the same tenant
    // GAP-FIX(17b): Wrapped guest find-or-create in transaction to prevent TOCTOU race condition
    let guest = await db.$transaction(async (tx) => {
      const existing = await tx.guest.findFirst({
        where: {
          tenantId: website.tenantId,
          email: guestEmail.toLowerCase(),
        },
      });

      if (existing) return existing;

      // Create a new guest record
      return tx.guest.create({
        data: {
          tenantId: website.tenantId,
          firstName,
          lastName,
          email: guestEmail.toLowerCase(),
          phone: guestPhone || null,
          source: 'website',
        },
      });
    });

    // ---- 7. Create the booking ----
    const checkInDatetime = new Date(checkIn);
    checkInDatetime.setHours(14, 0, 0, 0); // 14:00 (2 PM)

    const checkOutDatetime = new Date(checkOut);
    checkOutDatetime.setHours(11, 0, 0, 0); // 11:00 (11 AM)

    const booking = await db.booking.create({
      data: {
        tenantId: website.tenantId,
        propertyId,
        confirmationCode: generateConfirmationCode(),
        primaryGuestId: guest.id,
        roomTypeId,
        checkIn: checkInDatetime,
        checkOut: checkOutDatetime,
        adults,
        children,
        roomRate,
        totalAmount,
        currency: roomType.currency,
        source: 'website',
        status: 'draft' as BookingStatus,
        specialRequests: body.specialRequests || null,
        notes: 'Booking created from public website',
        idempotencyKey: generateIdempotencyKey(),
      },
      include: {
        roomType: {
          select: { id: true, name: true, code: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    // ---- 8. Return success response ----
    return NextResponse.json(
      {
        success: true,
        data: {
          bookingId: booking.id,
          confirmationCode: booking.confirmationCode,
          status: booking.status,
          roomType: booking.roomType,
          property: booking.property,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          nights,
          adults: booking.adults,
          children: booking.children,
          roomRate: booking.roomRate,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          guestName,
          guestEmail,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/site/booking] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again later.' } },
      { status: 500 },
    );
  }
}
