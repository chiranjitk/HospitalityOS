import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/minibar/setup - List minibar setups with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.MinibarSetupWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (roomId) {
      where.roomId = roomId;
    }

    const [setups, total] = await Promise.all([
      db.minibarSetup.findMany({
        where,
        include: {
          room: {
            select: { id: true, name: true, roomNumber: true, floor: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.minibarSetup.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        setups,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/minibar/setup]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/minibar/setup - Create or upsert a minibar setup
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, roomId, itemJson, lastRestockedAt, restockedBy } = body;

    if (!propertyId || !roomId) {
      return NextResponse.json({ success: false, error: 'propertyId and roomId are required' }, { status: 400 });
    }

    // Validate room belongs to property and tenant
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId, tenantId: user.tenantId },
    });

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // Upsert: create or update the setup for this room
    const setup = await db.minibarSetup.upsert({
      where: { roomId },
      create: {
        tenantId: user.tenantId,
        propertyId,
        roomId,
        itemJson: itemJson ? JSON.stringify(itemJson) : '[]',
        lastRestockedAt: lastRestockedAt ? new Date(lastRestockedAt) : null,
        restockedBy: restockedBy || null,
      },
      update: {
        itemJson: itemJson ? JSON.stringify(itemJson) : undefined,
        lastRestockedAt: lastRestockedAt ? new Date(lastRestockedAt) : undefined,
        restockedBy: restockedBy !== undefined ? restockedBy : undefined,
      },
      include: {
        room: {
          select: { id: true, name: true, roomNumber: true, floor: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: setup });
  } catch (error) {
    console.error('[POST /api/minibar/setup]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
