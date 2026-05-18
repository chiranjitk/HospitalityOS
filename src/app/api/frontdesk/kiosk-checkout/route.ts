import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { emitBookingCheckedOut } from '@/lib/events/booking-events';

// POST /api/frontdesk/kiosk-checkout - Process express check-out from kiosk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Zod validation for request body
    const checkoutSchema = z.object({
      bookingId: z.string().uuid('bookingId must be a valid UUID'),
    });

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    const { bookingId } = parsed.data;

    // Fetch booking with all needed relations — must be checked_in and not soft-deleted
    const booking = await db.booking.findFirst({
      where: { id: bookingId, status: 'checked_in', deletedAt: null },
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        room: { select: { id: true, number: true, floor: true, status: true } },
        property: { select: { id: true, name: true, tenantId: true } },
        roomType: { select: { id: true, name: true } },
        folios: {
          select: { id: true, balance: true, totalAmount: true, paidAmount: true, status: true },
          where: { status: 'open' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No checked-in booking found with this ID',
          },
        },
        { status: 404 }
      );
    }

    if (!booking.room) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ROOM',
            message: 'No room assigned to this booking',
          },
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Process booking/room updates in a transaction
    const updatedBooking = await db.$transaction(async (tx) => {
      // 1. Update booking status to checked_out
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'checked_out',
          actualCheckOut: now,
          checkedOutBy: 'kiosk-self-service',
        },
        include: {
          primaryGuest: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          room: { select: { id: true, number: true, floor: true } },
          roomType: { select: { id: true, name: true } },
          property: { select: { id: true, name: true, tenantId: true } },
          folios: {
            select: {
              id: true,
              balance: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
            },
            where: { status: 'open' },
          },
        },
      });

      // 2. Update room status to vacant and mark for housekeeping
      await tx.room.update({
        where: { id: booking.room.id },
        data: {
          status: 'vacant',
          housekeepingStatus: 'dirty',
        },
      });

      // 3. Create booking audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId,
          action: 'express_checkout',
          oldStatus: 'checked_in',
          newStatus: 'checked_out',
          notes: 'Express check-out via self-service kiosk',
          performedBy: 'kiosk-self-service',
        },
      });

      return updated;
    });

    // WiFi deactivation — OUTSIDE the transaction (non-blocking, best-effort)
    try {
      const wifiUsers = await db.wiFiUser.findMany({
        where: {
          bookingId: booking.id,
          status: 'active',
        },
        select: { id: true, username: true },
      });

      if (wifiUsers.length > 0) {
        const userIds = wifiUsers.map((u) => u.id);
        await db.wiFiUser.updateMany({
          where: { id: { in: userIds } },
          data: {
            status: 'inactive',
            validUntil: now,
          },
        });
        console.log(
          `[Kiosk Check-out] Deactivated ${wifiUsers.length} WiFi credential(s) for booking ${booking.id}: ${wifiUsers.map((u) => u.username).join(', ')}`
        );
      }
    } catch (wifiError) {
      console.error('[Kiosk Check-out] Failed to deactivate WiFi credentials:', wifiError);
      // Don't fail the check-out if WiFi deactivation fails
    }

    // Emit booking checked-out event for other consumers (realtime, notifications, etc.)
    try {
      await emitBookingCheckedOut({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        confirmationCode: booking.confirmationCode || '',
        guestId: booking.primaryGuest.id,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        guestEmail: booking.primaryGuest.email ?? undefined,
        guestPhone: booking.primaryGuest.phone ?? undefined,
        roomTypeId: booking.roomType?.id || booking.roomTypeId || '',
        roomTypeName: booking.roomType?.name || '',
        roomId: booking.room.id,
        roomNumber: booking.room.number,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        actualCheckOut: now,
        totalAmount: booking.totalAmount,
        paidAmount: booking.folios?.[0]?.paidAmount ?? 0,
        performedBy: 'kiosk-self-service',
      });
    } catch (eventError) {
      console.warn('[Kiosk Check-out] Failed to emit booking event:', eventError);
    }

    // Build response
    const folioBalance = booking.folios?.[0]?.balance ?? 0;
    const guestName = `${updatedBooking.primaryGuest.firstName} ${updatedBooking.primaryGuest.lastName}`;

    return NextResponse.json({
      success: true,
      data: {
        propertyName: updatedBooking.property?.name,
        guestName,
        checkOutTime: updatedBooking.actualCheckOut,
        roomNumber: updatedBooking.room?.number,
        folioBalance,
        hasBalance: folioBalance > 0,
        currency: booking.currency || 'INR',
        confirmationCode: booking.confirmationCode || '',
        bookingId: booking.id,
      },
    });
  } catch (error) {
    console.error('Error processing kiosk check-out:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process check-out' },
      },
      { status: 500 }
    );
  }
}
