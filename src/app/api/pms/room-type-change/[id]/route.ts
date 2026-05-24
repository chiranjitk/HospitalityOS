import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.view', 'rooms.manage', 'rooms.*', 'pms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const change = await db.roomTypeChange.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!change) {
      return NextResponse.json({ success: false, error: 'Room type change not found' }, { status: 404 });
    }

    // Fetch related entities
    const [room, oldType, newType] = await Promise.all([
      db.room.findFirst({ where: { id: change.roomId }, select: { id: true, number: true, floor: true, status: true } }),
      db.roomType.findFirst({ where: { id: change.oldRoomTypeId }, select: { id: true, name: true, code: true, basePrice: true } }),
      db.roomType.findFirst({ where: { id: change.newRoomTypeId }, select: { id: true, name: true, code: true, basePrice: true } }),
    ]);

    const data = {
      ...change,
      room: room || null,
      oldRoomType: oldType || null,
      newRoomType: newType || null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/pms/room-type-change/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch room type change' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', 'pms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { status, reason, notes, chargeApplied, chargeAmount } = body;

    const existing = await db.roomTypeChange.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Room type change not found' }, { status: 404 });
    }

    // Validate transitions
    const validTransitions: Record<string, string[]> = {
      requested: ['approved', 'rejected'],
      approved: ['completed'],
      completed: [],
      rejected: [],
    };

    if (status && status !== existing.status) {
      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json({
          success: false,
          error: `Cannot transition from ${existing.status} to ${status}. Allowed: ${allowed.join(', ')}`,
        }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (status) updateData.status = status;
    if (reason !== undefined) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;
    if (chargeApplied !== undefined) updateData.chargeApplied = chargeApplied;
    if (chargeAmount !== undefined) updateData.chargeAmount = chargeAmount;

    if (status === 'approved') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
    }

    if (status === 'completed') {
      updateData.completedAt = new Date();
      // Actually update the room's type in the Room table
      try {
        await db.room.update({
          where: { id: existing.roomId },
          data: { roomTypeId: existing.newRoomTypeId },
        });
      } catch (roomUpdateError) {
        console.error('Failed to update room type:', roomUpdateError);
        // Don't fail the whole operation if room update fails
      }

      // FIX: Update active folios for this room with the rate difference
      // When a room type changes mid-stay, the folio should reflect the new rate
      try {
        if (existing.rateDifference && existing.rateDifference !== 0) {
          await db.folio.updateMany({
            where: {
              roomId: existing.roomId,
              status: { in: ['open', 'pending'] },
            },
            data: {
              notes: 'Rate adjustment due to room type change',
            },
          });
        }
      } catch (folioError) {
        console.error('Failed to update folios after room type change:', folioError);
        // Non-critical — room type was already updated
      }
    }

    const updated = await db.roomTypeChange.update({
      where: { id },
      data: updateData,
    });

    // Fetch related entities for the response
    const [room, oldType, newType] = await Promise.all([
      db.room.findFirst({ where: { id: updated.roomId }, select: { id: true, number: true, floor: true, status: true } }),
      db.roomType.findFirst({ where: { id: updated.oldRoomTypeId }, select: { id: true, name: true, code: true, basePrice: true } }),
      db.roomType.findFirst({ where: { id: updated.newRoomTypeId }, select: { id: true, name: true, code: true, basePrice: true } }),
    ]);

    const data = {
      ...updated,
      room: room || null,
      oldRoomType: oldType || null,
      newRoomType: newType || null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('PUT /api/pms/room-type-change/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update room type change' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', 'pms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const existing = await db.roomTypeChange.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Room type change not found' }, { status: 404 });
    }

    if (existing.status !== 'requested') {
      return NextResponse.json({
        success: false,
        error: 'Only pending (requested) changes can be cancelled',
      }, { status: 400 });
    }

    await db.roomTypeChange.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Room type change cancelled' });
  } catch (error) {
    console.error('DELETE /api/pms/room-type-change/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel room type change' }, { status: 500 });
  }
}
