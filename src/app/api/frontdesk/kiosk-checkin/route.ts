import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitBookingCheckedIn } from '@/lib/events/booking-events';
import { fireAutomationEvent } from '@/lib/automation/hooks';
import { requireAuth } from '@/lib/auth/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit-simple';

// POST /api/frontdesk/kiosk-checkin - Process express check-in from kiosk
export async function POST(request: NextRequest) {
  // L-35: Rate limiting — 5 requests per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip, 5, 60000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const ctx = await requireAuth(request);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { bookingId, idVerified, termsAccepted } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId must be a valid UUID' } },
        { status: 400 }
      );
    }

    if (!idVerified) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID verification is required for express check-in' } },
        { status: 400 }
      );
    }

    if (!termsAccepted) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Terms must be accepted to proceed' } },
        { status: 400 }
      );
    }

    // Fetch booking with all needed relations — tenant isolation via ctx
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId: ctx.tenantId, status: 'confirmed', deletedAt: null },
      include: {
        primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        room: { select: { id: true, number: true, floor: true, status: true } },
        property: { select: { id: true, name: true } },
        roomType: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No confirmed booking found' } },
        { status: 404 }
      );
    }

    if (!booking.room) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ROOM', message: 'No room assigned to this booking' } },
        { status: 400 }
      );
    }

    // Process booking/room updates in a transaction
    const updatedBooking = await db.$transaction(async (tx) => {
      // 1. Update booking status
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'checked_in',
          actualCheckIn: new Date(),
          checkedInBy: 'kiosk-self-service',
        },
        include: {
          primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          room: { select: { id: true, number: true, floor: true } },
          roomType: { select: { id: true, name: true } },
          property: { select: { id: true, name: true, tenantId: true } },
        },
      });

      // 2. Atomic room occupancy guard — use updateMany with status check
      // to prevent two kiosks/requests checking into the same room concurrently
      const roomUpdateResult = await tx.room.updateMany({
        where: { id: booking.room.id, status: { not: 'occupied' } },
        data: { status: 'occupied' },
      });
      if (roomUpdateResult.count === 0) {
        throw new Error('ROOM_OCCUPIED');
      }

      // 3. Create booking audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId,
          action: 'express_checkin',
          oldStatus: 'confirmed',
          newStatus: 'checked_in',
          notes: 'Express check-in via self-service kiosk',
          performedBy: 'kiosk-self-service',
        },
      });

      return updated;
    });

    // H-16 FIX: WiFi provisioning — return wifiProvisioned flag in response so
    // frontend can warn the guest if WiFi credentials were not provisioned.
    // Still doesn't fail the check-in (WiFi is non-critical), but surfaces the issue.
    let wifiCredentials: { username: string; password: string; validUntil: Date } | null = null;
    let wifiProvisioned = false;

    try {
      // Check autoProvisionOnCheckin flag
      const aaaConfig = await db.wiFiAAAConfig.findUnique({
        where: { propertyId: booking.propertyId },
        select: { autoProvisionOnCheckin: true },
      });

      if (aaaConfig?.autoProvisionOnCheckin !== false) {
        const { wifiProvisioningService } = await import('@/lib/wifi/services/provisioning-service');
        const provisionResult = await wifiProvisioningService.provisionWiFiForBooking({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          guestId: booking.primaryGuest.id,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          roomTypeId: booking.roomType?.id || booking.roomTypeId || '',
          roomTypeName: booking.roomType?.name || '',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomNumber: booking.room.number,
          guestPhone: booking.primaryGuest.phone,
          guestEmail: booking.primaryGuest.email ?? undefined,
        });

        if (provisionResult.success) {
          console.log(`[Kiosk Check-in] WiFi provisioned: ${provisionResult.username} for booking ${booking.id}`);
          wifiProvisioned = true;
          wifiCredentials = {
            username: provisionResult.username!,
            password: provisionResult.password!,
            validUntil: provisionResult.validUntil!,
          };
        } else {
          console.error(`[Kiosk Check-in] WiFi provisioning failed for booking ${booking.id}: ${provisionResult.error}`);
        }
      }
    } catch (wifiError) {
      console.error('[Kiosk Check-in] Failed to provision WiFi:', wifiError);
      // Don't fail the check-in if WiFi provisioning fails
    }

    // Emit booking event for other consumers (realtime, notifications, etc.)
    try {
      await emitBookingCheckedIn({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        confirmationCode: booking.confirmationCode || '',
        guestId: booking.primaryGuest.id,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        guestEmail: booking.primaryGuest.email ?? undefined,
        roomTypeId: booking.roomType?.id || booking.roomTypeId || '',
        roomTypeName: booking.roomType?.name || '',
        roomId: booking.room.id,
        roomNumber: booking.room.number,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        actualCheckIn: new Date(),
        assignedRoomId: booking.room.id,
        assignedRoomNumber: booking.room.number,
        performedBy: 'kiosk-self-service',
      });
    } catch (eventError) {
      console.warn('[Kiosk Check-in] Failed to emit booking event:', eventError);
    }

    // Fire automation trigger for kiosk guest check-in
    fireAutomationEvent('guest.check_in', {
      tenantId: booking.tenantId,
      propertyId: booking.propertyId,
      entityId: booking.id,
      data: {
        bookingId: booking.id,
        guestId: booking.primaryGuest.id,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        roomId: booking.room.id,
        roomNumber: booking.room.number,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        performedBy: 'kiosk-self-service',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        roomNumber: updatedBooking.room?.number,
        roomFloor: updatedBooking.room?.floor,
        roomType: updatedBooking.roomType?.name,
        propertyName: updatedBooking.property?.name,
        guestName: `${updatedBooking.primaryGuest.firstName} ${updatedBooking.primaryGuest.lastName}`,
        checkInTime: updatedBooking.actualCheckIn,
        wifiCredentials: wifiCredentials ? {
          username: wifiCredentials.username,
          password: wifiCredentials.password,
          validUntil: wifiCredentials.validUntil.toISOString(),
        } : null,
        wifiProvisioned,
        wifiWarning: !wifiProvisioned ? 'WiFi credentials could not be provisioned. Please visit the front desk for assistance.' : undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_OCCUPIED') {
      return NextResponse.json(
        { success: false, error: { code: 'ROOM_ALREADY_OCCUPIED', message: 'Room is already occupied — cannot check in' } },
        { status: 409 }
      );
    }
    console.error('Error processing kiosk check-in:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process check-in' } },
      { status: 500 }
    );
  }
}
