import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logRoom } from '@/lib/audit';

interface BulkRoomData {
  number: string;
  name?: string;
  floor?: number;
}

// POST /api/rooms/bulk - Create multiple rooms at once
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (!hasPermission(user, 'rooms.create') && !hasPermission(user, 'rooms.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const {
      propertyId,
      roomTypeId,
      rooms, // Array of { number, name?, floor? }
      isAccessible = false,
      isSmoking = false,
      hasBalcony = false,
      hasSeaView = false,
      hasMountainView = false,
      status = 'available',
      digitalKeyEnabled = false,
    } = body;

    // Validate required fields
    if (!propertyId || !roomTypeId || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields (propertyId, roomTypeId, rooms array)' } },
        { status: 400 }
      );
    }

    if (rooms.length > 200) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum 200 rooms per bulk creation' } },
        { status: 400 }
      );
    }

    // Validate each room has a number
    for (const room of rooms) {
      if (!room.number || room.number.trim() === '') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Each room must have a number' } },
          { status: 400 }
        );
      }
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findUnique({
      where: { id: propertyId, deletedAt: null },
      select: { tenantId: true },
    });
    if (!property || property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // Verify room type exists and belongs to this property
    const roomType = await db.roomType.findFirst({
      where: {
        id: roomTypeId,
        propertyId,
        deletedAt: null,
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ROOM_TYPE', message: 'Room type not found or does not belong to this property' } },
        { status: 400 }
      );
    }

    // Check for duplicate numbers in the request itself
    const requestNumbers = new Set(rooms.map(r => r.number.trim()));
    if (requestNumbers.size !== rooms.length) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NUMBER', message: 'Duplicate room numbers in request' } },
        { status: 400 }
      );
    }

    // Check which room numbers already exist
    const existingRooms = await db.room.findMany({
      where: {
        propertyId,
        number: { in: rooms.map(r => r.number.trim()) },
        deletedAt: null,
      },
      select: { number: true },
    });
    const existingNumbers = new Set(existingRooms.map(r => r.number));

    // Filter out rooms that already exist
    const roomsToCreate = rooms
      .filter(r => !existingNumbers.has(r.number.trim()))
      .map(r => ({
        number: r.number.trim(),
        name: r.name?.trim() || null,
        floor: r.floor || 1,
      }));

    if (roomsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          created: 0,
          skipped: rooms.length,
          duplicates: existingNumbers.size,
          errors: [],
        },
      });
    }

    // Create all rooms in a single transaction
    const createdRooms = await db.$transaction(async (tx) => {
      const created = [];
      for (const roomData of roomsToCreate) {
        const newRoom = await tx.room.create({
          data: {
            propertyId,
            roomTypeId,
            number: roomData.number,
            name: roomData.name,
            floor: roomData.floor,
            isAccessible,
            isSmoking,
            hasBalcony,
            hasSeaView,
            hasMountainView,
            status,
            digitalKeyEnabled,
          },
          include: {
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
                basePrice: true,
                currency: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
                currency: true,
              },
            },
          },
        });
        created.push(newRoom);
      }

      // Update totalRooms counters
      await tx.roomType.update({
        where: { id: roomTypeId },
        data: {
          totalRooms: {
            increment: createdRooms.length,
          },
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          totalRooms: {
            increment: createdRooms.length,
          },
        },
      });

      return created;
    });

    // Audit logging (non-blocking, just log a summary)
    try {
      await logRoom(request, 'create', createdRooms[0]?.id, undefined, {
        bulk: true,
        count: createdRooms.length,
        numbers: createdRooms.map(r => r.number),
        floor: roomsToCreate[0]?.floor,
        roomTypeName: createdRooms[0]?.roomType?.name,
        propertyId,
        status,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    const skipped = rooms.length - roomsToCreate.length;

    return NextResponse.json({
      success: true,
      data: {
        created: createdRooms.length,
        skipped,
        duplicates: skipped,
        rooms: createdRooms,
        errors: [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error bulk creating rooms:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rooms' } },
      { status: 500 }
    );
  }
}
