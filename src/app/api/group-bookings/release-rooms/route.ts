import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// POST /api/group-bookings/release-rooms - Release unsold rooms from group block back to general inventory
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { groupBookingId, force = false } = body;

    if (!groupBookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupBookingId is required' } },
        { status: 400 }
      );
    }

    // Fetch group booking
    const groupBooking = await db.groupBooking.findFirst({
      where: { id: groupBookingId, tenantId },
      include: {
        bookings: {
          select: { id: true, status: true },
        },
      },
    });

    if (!groupBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    if (!['confirmed', 'in_progress'].includes(groupBooking.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Group booking must be confirmed or in progress to release rooms' } },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check cutoff date: auto-release if current date > cutoffDate
    let autoRelease = false;
    if (groupBooking.cutoffDate && now > groupBooking.cutoffDate) {
      autoRelease = true;
    }

    if (!autoRelease && !force) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUTOFF_NOT_REACHED',
            message: `Cutoff date (${groupBooking.cutoffDate?.toISOString()}) has not been reached. Use force=true to override.`,
          },
        },
        { status: 400 }
      );
    }

    // Count booked rooms (non-cancelled)
    const activeBookings = groupBooking.bookings.filter((b) => !['cancelled'].includes(b.status));
    const bookedRoomsCount = activeBookings.length;

    // Calculate rooms to release
    const alreadyReleased = groupBooking.releasedRooms || 0;
    const totalAvailableForRelease = Math.max(0, groupBooking.totalRooms - bookedRoomsCount - alreadyReleased);

    if (totalAvailableForRelease <= 0) {
      return NextResponse.json({
        success: true,
        data: {
          releasedRooms: 0,
          totalAvailableForRelease,
          message: 'No additional rooms available for release',
        },
      });
    }

    // Update GroupBooking.releasedRooms count
    const newReleasedRooms = alreadyReleased + totalAvailableForRelease;

    const updatedGroup = await db.groupBooking.update({
      where: { id: groupBookingId },
      data: { releasedRooms: newReleasedRooms },
    });

    // Create audit log entry
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'group_bookings',
        action: 'rooms_released',
        entityType: 'GroupBooking',
        entityId: groupBookingId,
        oldValue: JSON.stringify({ releasedRooms: alreadyReleased }),
        newValue: JSON.stringify({ releasedRooms: newReleasedRooms, autoRelease }),
        userId: auth.userId,
      },
    });

    // Prepare notification data
    const notificationResult = {
      sent: false,
      contactEmail: groupBooking.contactEmail || null,
      reason: !groupBooking.contactEmail ? 'No contact email on file' : 'Queued for delivery',
    };

    // Create notification if contact email exists
    if (groupBooking.contactEmail) {
      try {
        await db.notification.create({
          data: {
            tenantId,
            type: 'group_booking',
            category: 'info',
            title: `Group Block Rooms Released - ${groupBooking.name}`,
            message: `${totalAvailableForRelease} room(s) from group block "${groupBooking.name}" have been released back to general inventory.${autoRelease ? ' (Auto-released: cutoff date reached)' : ' (Manual release)'}`,
            priority: 'medium',
          },
        });
        notificationResult.sent = true;
      } catch (notifError) {
        console.error('[ReleaseRooms] Failed to create notification:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        groupBookingId: updatedGroup.id,
        groupName: updatedGroup.name,
        totalRooms: updatedGroup.totalRooms,
        bookedRooms: bookedRoomsCount,
        releasedRooms: newReleasedRooms,
        roomsReleasedThisAction: totalAvailableForRelease,
        autoRelease,
        cutoffDate: updatedGroup.cutoffDate,
        notification: notificationResult,
      },
    });
  } catch (error) {
    console.error('[ReleaseRooms] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release rooms from group block' } },
      { status: 500 }
    );
  }
}
