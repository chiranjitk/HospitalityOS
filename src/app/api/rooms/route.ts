import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logRoom } from '@/lib/audit';

// GET /api/rooms - List all rooms
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (!hasPermission(user, 'rooms.view') && !hasPermission(user, 'rooms.*') && !hasPermission(user, 'housekeeping.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');
    const status = searchParams.get('status');
    const floor = searchParams.get('floor');
    
    const where: Record<string, unknown> = {
      deletedAt: null,
    };
    
    // Filter by tenant through property relation (always enforce)
    if (propertyId) {
      // When propertyId is specified, still verify it belongs to user's tenant
      const property = await db.property.findUnique({
        where: { id: propertyId, deletedAt: null },
        select: { tenantId: true },
      });
      if (property && property.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Not found' } },
          { status: 404 }
        );
      }
      where.propertyId = propertyId;
    } else {
      where.property = {
        tenantId,
        deletedAt: null,
      };
    }
    
    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (floor) {
      where.floor = parseInt(floor, 10);
    }
    
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const [rooms, total] = await Promise.all([
      db.room.findMany({
        where,
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
        orderBy: [
          { floor: 'asc' },
          { number: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.room.count({ where }),
    ]);
    
    return NextResponse.json({
      success: true,
      data: rooms,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rooms' } },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create a new room
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
      number,
      name,
      floor = 1,
      isAccessible = false,
      isSmoking = false,
      hasBalcony = false,
      hasSeaView = false,
      hasMountainView = false,
      status = 'available',
      digitalKeyEnabled = false,
    } = body;
    
    // Validate required fields
    if (!propertyId || !roomTypeId || !number) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
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
    
    // Check if room number already exists for this property
    const existingRoom = await db.room.findUnique({
      where: {
        propertyId_number: {
          propertyId,
          number,
        },
      },
    });
    
    if (existingRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NUMBER', message: 'A room with this number already exists' } },
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
    
    // Wrap all three operations in a single transaction for atomicity
    const room = await db.$transaction(async (tx) => {
      const newRoom = await tx.room.create({
        data: {
          propertyId,
          roomTypeId,
          number,
          name,
          floor,
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

      await tx.roomType.update({
        where: { id: roomTypeId },
        data: {
          totalRooms: {
            increment: 1,
          },
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          totalRooms: {
            increment: 1,
          },
        },
      });

      // NOTE: totalRooms on Property and RoomType are maintained via increment/decrement.
      // If counts drift (e.g., manual DB changes, failed transactions), run reconciliation:
      // UPDATE "RoomType" rt SET "totalRooms" = (SELECT COUNT(*) FROM "Room" r WHERE r."roomTypeId" = rt.id AND r."deletedAt" IS NULL)
      // UPDATE "Property" p SET "totalRooms" = (SELECT COUNT(*) FROM "Room" r WHERE r."propertyId" = p.id AND r."deletedAt" IS NULL)

      return newRoom;
    });
    
    // Log room creation (non-blocking)
    try {
      await logRoom(request, 'create', room.id, undefined, {
        number: room.number,
        floor: room.floor,
        roomTypeName: room.roomType?.name,
        propertyId: room.propertyId,
        status: room.status,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create room' } },
      { status: 500 }
    );
  }
}
