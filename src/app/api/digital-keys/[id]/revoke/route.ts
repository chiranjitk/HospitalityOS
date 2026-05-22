/**
 * Revoke a Digital Key
 *
 * POST /api/digital-keys/[id]/revoke
 *
 * Marks the digital key as revoked for a given booking/room.
 * Sets status to 'revoked' and records the revocation in AuditLog
 * and DigitalKeyAccessLog.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'digital_keys.*') && !hasPermission(user, 'digital_keys.update') && !hasPermission(user, 'frontdesk.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // The "id" in the URL is the booking ID (matching the pattern key-{bookingId} from the digital keys list)
    const { id: bookingId } = await params;

    // Find the booking and its assigned room
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        tenantId: user.tenantId,
        status: { in: ['confirmed', 'checked_in'] },
        roomId: { not: null },
      },
      include: {
        room: { select: { id: true, number: true, digitalKeyEnabled: true, digitalKeySecret: true } },
        primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!booking || !booking.room) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Active booking with assigned room not found' } },
        { status: 404 },
      );
    }

    const room = booking.room;

    if (!room.digitalKeyEnabled && !room.digitalKeySecret) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ACTIVE_KEY', message: 'No active digital key found for this booking' } },
        { status: 404 },
      );
    }

    // Revoke the digital key
    await db.room.update({
      where: { id: room.id },
      data: {
        digitalKeyEnabled: false,
        digitalKeySecret: null,
      },
    });

    // Log revocation in AuditLog
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'update',
        entityType: 'Room',
        entityId: room.id,
        oldValue: JSON.stringify({
          roomNumber: room.number,
          keyEnabled: true,
          status: 'active',
        }),
        newValue: JSON.stringify({
          roomNumber: room.number,
          keyEnabled: false,
          status: 'revoked',
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          bookingId: booking.id,
          confirmationCode: booking.confirmationCode,
        }),
      },
    });

    // Log in DigitalKeyAccessLog if available
    try {
      await db.digitalKeyAccessLog.create({
        data: {
          tenantId: user.tenantId,
          roomId: room.id,
          guestId: booking.primaryGuestId,
          accessType: 'revoke',
          method: 'api',
          success: true,
          failureReason: null,
          deviceId: null,
          deviceType: 'staff_panel',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          accessedAt: new Date(),
        },
      });
    } catch {
      // DigitalKeyAccessLog may not exist in all schemas — non-blocking
      console.warn('[Digital Key Revoke] DigitalKeyAccessLog not available — skipping');
    }

    return NextResponse.json({
      success: true,
      data: {
        roomId: room.id,
        roomNumber: room.number,
        status: 'revoked',
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
      },
      message: 'Digital key revoked successfully',
    });
  } catch (error) {
    console.error('[Digital Key Revoke] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke digital key' } },
      { status: 500 },
    );
  }
}
