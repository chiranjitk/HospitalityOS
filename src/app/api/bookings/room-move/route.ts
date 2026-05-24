import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/bookings/room-move - Move guest from one room to another
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    // SECURITY FIX: Add permission check — room move is a sensitive operation
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
    }

    const body = await request.json();
    const { bookingId, fromRoomId, toRoomId, reason, notes } = body;

    if (!bookingId || !fromRoomId || !toRoomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId, fromRoomId, and toRoomId are required' } },
        { status: 400 }
      );
    }

    if (fromRoomId === toRoomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'From and To rooms must be different' } },
        { status: 400 }
      );
    }

    const validReasons = ['guest_request', 'maintenance', 'upgrade', 'availability', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `reason must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    // Execute room move in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Fetch booking
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, number: true, floor: true, roomTypeId: true, status: true } },
          roomType: { select: { id: true, name: true, basePrice: true } },
          property: { select: { id: true, name: true } },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.tenantId !== user.tenantId) {
        throw new Error('FORBIDDEN');
      }

      if (!booking.room || booking.room.id !== fromRoomId) {
        throw new Error('Booking is not currently in the specified room');
      }

      if (booking.status !== 'checked_in') {
        throw new Error('Can only move rooms for checked-in guests');
      }

      // 2. Validate from room
      const fromRoom = await tx.room.findUnique({
        where: { id: fromRoomId },
        include: {
          roomType: { select: { id: true, name: true, basePrice: true } },
        },
      });

      if (!fromRoom) {
        throw new Error('From room not found');
      }

      // 3. Validate to room
      const toRoom = await tx.room.findUnique({
        where: { id: toRoomId },
        include: {
          roomType: { select: { id: true, name: true, basePrice: true, propertyId: true, amenities: true } },
        },
      });

      if (!toRoom) {
        throw new Error('To room not found');
      }

      // Validate same property
      if (fromRoom.propertyId !== toRoom.propertyId) {
        throw new Error('Cannot move rooms across different properties');
      }

      // Validate to room is available
      if (toRoom.status !== 'available' && toRoom.status !== 'clean') {
        throw new Error(`Target room is not available (current status: ${toRoom.status})`);
      }

      // Check no active bookings for the to room
      const toRoomActiveBooking = await tx.booking.findFirst({
        where: {
          roomId: toRoomId,
          status: 'checked_in',
          id: { not: bookingId },
        },
      });

      if (toRoomActiveBooking) {
        throw new Error('Target room already has an active check-in');
      }

      // Check for overlapping future bookings in the target room
      const futureBookings = await tx.booking.findFirst({
        where: {
          roomId: toRoomId,
          id: { not: bookingId },
          status: { in: ['confirmed', 'checked_in'] },
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: new Date() },
        },
      });

      if (futureBookings) {
        throw new Error('CONFLICT');
      }

      // 4. Calculate rate difference
      const previousRate = fromRoom.roomType.basePrice;
      const newRate = toRoom.roomType.basePrice;
      const rateDifference = newRate - previousRate;

      // 5. Update booking room
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          roomId: toRoomId,
          roomTypeId: toRoom.roomTypeId,
          roomRate: newRate,
        },
        include: {
          room: true,
          roomType: true,
        },
      });

      // 6. Update room statuses
      // FIX: Set old room status to 'dirty' (not 'available') since housekeeping needs to clean it.
      // A room with housekeepingStatus 'dirty' should never be 'available' for booking.
      await tx.room.update({
        where: { id: fromRoomId },
        data: { status: 'dirty', housekeepingStatus: 'dirty' },
      });

      await tx.room.update({
        where: { id: toRoomId },
        data: { status: 'occupied' },
      });

      // 7. Create RoomMoveLog
      const moveLog = await tx.roomMoveLog.create({
        data: {
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          bookingId,
          guestId: booking.primaryGuestId,
          fromRoomId,
          fromRoomNumber: fromRoom.number,
          toRoomId,
          toRoomNumber: toRoom.number,
          reason,
          movedBy: user.id,
          previousRate,
          newRate,
          rateDifference,
          notes: notes || null,
        },
      });

      // 8. Create BookingAuditLog
      await tx.bookingAuditLog.create({
        data: {
          bookingId,
          action: 'room_move',
          oldStatus: booking.status,
          newStatus: booking.status,
          notes: `Room moved from ${fromRoom.number} to ${toRoom.number}. Reason: ${reason}. Rate change: ${rateDifference >= 0 ? '+' : ''}${rateDifference}`,
          performedBy: user.id,
        },
      });

      // 9. Post rate difference charge to folio inside the same transaction (race condition fix)
      let folioChargePosted = false;
      if (rateDifference !== 0) {
        const remainingNights = Math.max(
          1,
          Math.ceil((new Date(updatedBooking.checkOut).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );

        const folio = await tx.folio.findFirst({
          where: { bookingId, status: { in: ['open', 'partially_paid'] } },
        });

        if (folio) {
          const chargeDescription = rateDifference > 0
            ? `Room upgrade charge - Room ${fromRoom.number} to ${toRoom.number}`
            : `Room downgrade credit - Room ${fromRoom.number} to ${toRoom.number}`;

          await tx.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: chargeDescription,
              category: 'room_move',
              quantity: remainingNights,
              unitPrice: Math.abs(rateDifference),
              totalAmount: Math.round(rateDifference * remainingNights * 100) / 100,
              serviceDate: new Date(),
              postedBy: user.id,
            },
          });

          // BALANCE FIX: Recalculate folio totals from ALL line items including taxes and discount
          const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
          const newSubtotal = Math.round(allLineItems.reduce((sum, li) => sum + li.totalAmount, 0) * 100) / 100;
          const newTaxes = Math.round(allLineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0) * 100) / 100;
          const newTotalAmount = Math.round((newSubtotal + newTaxes - (folio.discount || 0)) * 100) / 100;
          // BALANCE FIX: balance = totalAmount - paidAmount (not subtotal - paidAmount)
          const newBalance = Math.max(0, Math.round((newTotalAmount - (folio.paidAmount || 0)) * 100) / 100);

          await tx.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotalAmount,
              balance: newBalance,
            },
          });

          // Update booking totalAmount to reflect the rate difference
          await tx.booking.update({
            where: { id: bookingId },
            data: {
              totalAmount: { increment: Math.round(rateDifference * remainingNights * 100) / 100 },
            },
          });

          folioChargePosted = true;
        }
      }

      return {
        booking: updatedBooking,
        moveLog,
        fromRoom,
        toRoom,
        previousRate,
        newRate,
        rateDifference,
        folioChargePosted,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Guest moved from Room ${result.fromRoom.number} to Room ${result.toRoom.number}`,
        roomNumber: result.toRoom.number,
        roomType: result.toRoom.roomType.name,
        rateDifference: result.rateDifference,
        moveLog: result.moveLog,
      },
    });
  } catch (error) {
    console.error('Error processing room move:', error);
    const message = error instanceof Error ? error.message : 'Failed to process room move';

    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
      }
      if (error.message === 'CONFLICT') {
        return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Target room has conflicting bookings' } }, { status: 409 });
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
