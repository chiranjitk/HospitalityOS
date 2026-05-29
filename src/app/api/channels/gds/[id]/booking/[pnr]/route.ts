/**
 * GET /api/channels/gds/[id]/booking/[pnr]
 *
 * Retrieves a single booking from the GDS by PNR number.
 * Uses the real GDS protocol adapter to fetch booking details.
 * Returns the booking in StaySuite format, plus a link to
 * the internal GdsBooking record if one exists.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { createGDSClient, validateGDSConfig, getGDSConfig } from '@/lib/gds/client-factory';

interface RouteParams {
  params: Promise<{ id: string; pnr: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasAnyPermission(user, ['channels.view', 'channels.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id, pnr } = await params;

    if (!pnr || pnr.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'PNR number is required' } },
        { status: 400 },
      );
    }

    // Fetch connection
    const connection = await db.gdsConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'GDS connection not found' } },
        { status: 404 },
      );
    }

    // Validate config
    const config = getGDSConfig(connection);
    const configErrors = validateGDSConfig(config);
    if (configErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_INCOMPLETE', message: configErrors.join(', ') } },
        { status: 400 },
      );
    }

    // Retrieve booking from GDS
    const client = createGDSClient(connection);
    const booking = await client.retrieveBooking(pnr.trim());

    if (!booking) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: `No booking found with PNR "${pnr}" on ${connection.provider}`,
        },
      });
    }

    // Check if we have a local GdsBooking record for this PNR
    const localBooking = await db.gdsBooking.findFirst({
      where: { connectionId: id, pnr: pnr.trim(), tenantId: user.tenantId },
    });

    return NextResponse.json({
      success: true,
      data: {
        pnr: booking.pnr,
        guestName: `${booking.firstName} ${booking.lastName}`.trim(),
        firstName: booking.firstName,
        lastName: booking.lastName,
        checkIn: booking.checkIn.toISOString().split('T')[0],
        checkOut: booking.checkOut.toISOString().split('T')[0],
        roomType: booking.roomType,
        rateCode: booking.rateCode,
        status: booking.status,
        guestCount: booking.guestCount,
        specialRequests: booking.specialRequests || undefined,
        gdsSource: booking.gdsSource,
        provider: connection.provider,
        localBookingId: localBooking?.id || undefined,
        localBookingStatus: localBooking?.syncStatus || undefined,
        retrievedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GDS PNR Retrieve Error]', error);
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'PNR_RETRIEVE_FAILED',
        message: `Failed to retrieve booking: ${message}`,
      },
    }, { status: 500 });
  }
}
