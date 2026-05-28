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

      // Actually update the room's type in the Room table + create folio charge
      // Using transaction for atomicity (following billing module pattern)
      try {
        await db.$transaction(async (tx) => {
          // 1. Update the room's type
          await tx.room.update({
            where: { id: existing.roomId },
            data: { roomTypeId: existing.newRoomTypeId },
          });

          // 2. Post rate difference as a FolioLineItem (if there's a rate difference)
          if (existing.rateDifference && existing.rateDifference !== 0) {
            const roundedDiff = Math.round(existing.rateDifference * 100) / 100;

            // Find open folio for this booking (Folio links via bookingId, not roomId)
            const folio = await tx.folio.findFirst({
              where: { bookingId: existing.bookingId, status: { in: ['open', 'partially_paid', 'pending'] } },
            });

            if (folio) {
              // Fetch room type names for description
              const [oldType, newType] = await Promise.all([
                tx.roomType.findFirst({ where: { id: existing.oldRoomTypeId }, select: { name: true } }),
                tx.roomType.findFirst({ where: { id: existing.newRoomTypeId }, select: { name: true } }),
              ]);
              const oldName = oldType?.name || 'Unknown';
              const newName = newType?.name || 'Unknown';

              // Create the folio line item
              await tx.folioLineItem.create({
                data: {
                  folioId: folio.id,
                  description: roundedDiff > 0
                    ? `Room upgrade charge: ${oldName} → ${newName}`
                    : `Room downgrade credit: ${oldName} → ${newName}`,
                  category: 'room_type_change',
                  quantity: 1,
                  unitPrice: Math.abs(roundedDiff),
                  totalAmount: Math.abs(roundedDiff),
                  serviceDate: new Date(),
                  postedBy: user.email || user.id,
                  referenceType: 'room_type_change',
                  referenceId: existing.id,
                },
              });

              // Recalculate folio totals (canonical pattern from billing module)
              const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
              const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
              await tx.folio.update({
                where: { id: folio.id },
                data: {
                  subtotal: Math.round(newSubtotal * 100) / 100,
                  totalAmount: Math.round((newSubtotal + folio.taxes - folio.discount) * 100) / 100,
                  balance: Math.round((newSubtotal - folio.paidAmount) * 100) / 100,
                },
              });

              // Mark charge as applied on the RoomTypeChange record
              updateData.chargeApplied = true;
              updateData.chargeAmount = Math.abs(roundedDiff);
              updateData.folioId = folio.id;
            }
          }
        });
      } catch (txError) {
        console.error('Failed to complete room type change transaction:', txError);
        // Non-fatal — the status update will still proceed
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
