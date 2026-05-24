import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/rooms/maintenance-blocks?propertyId=xxx - List maintenance blocks
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['rooms.manage', 'rooms.view', 'admin.*', 'housekeeping.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Pagination defaults
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'all') where.status = status;

    const [blocks, total] = await Promise.all([
      db.maintenanceBlock.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              number: true,
              name: true,
              floor: true,
              status: true,
              roomType: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.maintenanceBlock.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: blocks, pagination: { total, limit, offset } });
  } catch (error) {
    console.error('Error fetching maintenance blocks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch maintenance blocks' } },
      { status: 500 }
    );
  }
}

// POST /api/rooms/maintenance-blocks - Create maintenance block
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['rooms.manage', 'admin.*', 'housekeeping.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      roomId,
      reason,
      description,
      startDate,
      endDate,
      priority,
      estimatedCost,
      vendorId,
      notes,
    } = body;

    if (!roomId || !reason || !startDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: roomId, reason, startDate' } },
        { status: 400 }
      );
    }

    const validReasons = ['maintenance', 'renovation', 'deep_cleaning', 'inspection', 'quarantine'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    const validPriorities = ['normal', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify room exists, is not deleted, and get property info
    const room = await db.room.findFirst({
      where: { id: roomId, deletedAt: null },
      include: { property: { select: { id: true, tenantId: true } } },
    });

    if (!room || room.property.tenantId !== tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } }, { status: 404 });
    }

    if (room.status === 'maintenance') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_BLOCKED', message: 'Room is already under maintenance' } },
        { status: 400 }
      );
    }

    // Create block + check overlap atomically in transaction (prevents TOCTOU race)
    const block = await db.$transaction(async (tx) => {
      // Check for overlapping active blocks inside the transaction
      const existingBlocks = await tx.maintenanceBlock.findMany({
        where: {
          roomId,
          tenantId,
          status: { in: ['scheduled', 'active'] },
        },
      });

      const startDateObj = new Date(startDate);
      const endDateObj = endDate ? new Date(endDate) : null;
      const hasOverlap = existingBlocks.some((blk) => {
        const blockStart = new Date(blk.startDate);
        const blockEnd = blk.endDate ? new Date(blk.endDate) : null;
        const blockEndVal = blockEnd || new Date('2100-01-01');
        const newEndVal = endDateObj || new Date('2100-01-01');
        return startDateObj < blockEndVal && blockStart < newEndVal;
      });

      if (hasOverlap) {
        throw new Error('OVERLAP:Room already has an active or scheduled block for this period');
      }

      const maintenanceBlock = await tx.maintenanceBlock.create({
        data: {
          tenantId,
          propertyId: room.propertyId,
          roomId,
          roomNumber: room.number,
          reason,
          description: description || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          blockedBy: user.id,
          status: new Date(startDate) <= new Date() ? 'active' : 'scheduled',
          priority: priority || 'normal',
          vendorId: vendorId || null,
          estimatedCost: estimatedCost ? parseFloat(String(estimatedCost)) : null,
          notes: notes || null,
        },
      });

      // Update room status if block is active or scheduled
      if (maintenanceBlock.status === 'active' || maintenanceBlock.status === 'scheduled') {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'out_of_order' },
        });
      }

      return maintenanceBlock;
    });

    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('OVERLAP:')) {
      return NextResponse.json(
        { success: false, error: { code: 'OVERLAP', message: error.message.replace('OVERLAP:', '') } },
        { status: 400 }
      );
    }
    console.error('Error creating maintenance block:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create maintenance block' } },
      { status: 500 }
    );
  }
}
