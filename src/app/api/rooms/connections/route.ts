import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: { message: 'roomId is required' } },
        { status: 400 }
      );
    }

    const connections = await db.roomConnection.findMany({
      where: {
        OR: [{ roomAId: roomId }, { roomBId: roomId }],
      },
      include: {
        roomA: { select: { id: true, number: true, name: true, floor: true, roomType: { select: { name: true, code: true } } } },
        roomB: { select: { id: true, number: true, name: true, floor: true, roomType: { select: { name: true, code: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error fetching room connections:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch connections' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomAId, roomBId, type, tenantId } = body;

    if (!roomAId || !roomBId || !tenantId) {
      return NextResponse.json(
        { success: false, error: { message: 'roomAId, roomBId, and tenantId are required' } },
        { status: 400 }
      );
    }

    if (roomAId === roomBId) {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot connect a room to itself' } },
        { status: 400 }
      );
    }

    // Check if connection already exists (in either direction)
    const existing = await db.roomConnection.findFirst({
      where: {
        OR: [
          { roomAId, roomBId },
          { roomAId: roomBId, roomBId: roomAId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: 'These rooms are already connected' } },
        { status: 409 }
      );
    }

    const connection = await db.roomConnection.create({
      data: {
        tenantId,
        roomAId,
        roomBId,
        type: type || 'adjoining',
      },
      include: {
        roomA: { select: { id: true, number: true, name: true, floor: true, roomType: { select: { name: true, code: true } } } },
        roomB: { select: { id: true, number: true, name: true, floor: true, roomType: { select: { name: true, code: true } } } },
      },
    });

    return NextResponse.json({ success: true, data: connection }, { status: 201 });
  } catch (error) {
    console.error('Error creating room connection:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create connection' } },
      { status: 500 }
    );
  }
}
