import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// GET /api/group-bookings/[id] - Get a single group booking with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;

    const group = await db.groupBooking.findFirst({
      where: { 
        id,
        tenantId: user.tenantId,
      },
      include: {
        bookings: {
          include: {
            room: { select: { number: true } },
            roomType: { select: { name: true } },
            primaryGuest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Get property
    const property = await db.property.findUnique({
      where: { id: group.propertyId },
      select: { id: true, name: true },
    });

    const transformedGroup = {
      ...group,
      property: property || null,
      bookedRooms: group.bookings?.length || 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedGroup,
    });
  } catch (error) {
    console.error('Error fetching group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group booking' } },
      { status: 500 }
    );
  }
}

// PUT /api/group-bookings/[id] - Update a group booking (M-04)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const VALID_STATUSES = ['inquiry', 'tentative', 'confirmed', 'in_progress', 'completed', 'cancelled'];

    // Verify group belongs to tenant
    const existingGroup = await db.groupBooking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    const { status, contactEmail, checkIn, checkOut, totalRooms, totalAmount, depositAmount, contractSignedAt, ...updateData } = body;

    // Validate status transition
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' } },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Build update payload with validated date fields
    const data: Record<string, unknown> = { ...updateData };
    if (status !== undefined) data.status = status;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);
    if (contractSignedAt !== undefined) data.contractSignedAt = new Date(contractSignedAt);
    if (totalRooms !== undefined) data.totalRooms = Math.max(1, totalRooms);
    if (totalAmount !== undefined) data.totalAmount = Math.max(0, totalAmount);
    if (depositAmount !== undefined) data.depositAmount = Math.max(0, depositAmount);

    // Validate date ordering
    const effectiveCheckIn = data.checkIn instanceof Date ? data.checkIn : existingGroup.checkIn;
    const effectiveCheckOut = data.checkOut instanceof Date ? data.checkOut : existingGroup.checkOut;
    if (effectiveCheckIn >= effectiveCheckOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    const group = await db.groupBooking.update({
      where: { id },
      data,
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'bookings',
        action: 'update',
        entityType: 'group_booking',
        entityId: group.id,
        oldValue: { name: existingGroup.name, status: existingGroup.status, totalRooms: existingGroup.totalRooms, totalAmount: existingGroup.totalAmount },
        newValue: { name: group.name, status: group.status, totalRooms: group.totalRooms, totalAmount: group.totalAmount },
        description: `Updated group booking: ${group.name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for group booking update:', auditError);
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error updating group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update group booking' } },
      { status: 500 }
    );
  }
}

// DELETE /api/group-bookings/[id] - Delete a group booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;

    // Verify group belongs to tenant
    const existingGroup = await db.groupBooking.findFirst({
      where: { 
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Check for associated bookings
    const bookingsCount = await db.booking.count({
      where: { groupId: id },
    });

    if (bookingsCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_BOOKINGS', message: 'Cannot delete group with associated bookings' } },
        { status: 400 }
      );
    }

    await db.groupBooking.delete({
      where: { id },
    });

    // M-05 FIX: Trigger waitlist auto-process after group cancellation
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/cron/waitlist-auto-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || 'dev-only-cron-secret' },
    }).catch(() => {});

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'bookings',
        action: 'delete',
        entityType: 'group_booking',
        entityId: existingGroup.id,
        oldValue: { name: existingGroup.name, status: existingGroup.status, totalRooms: existingGroup.totalRooms, totalAmount: existingGroup.totalAmount },
        description: `Deleted group booking: ${existingGroup.name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for group booking delete:', auditError);
    }

    return NextResponse.json({ success: true, message: 'Group booking deleted' });
  } catch (error) {
    console.error('Error deleting group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete group booking' } },
      { status: 500 }
    );
  }
}
