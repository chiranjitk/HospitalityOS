import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/minibar/setup/[roomId] - Get minibar setup for a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;

    const setup = await db.minibarSetup.findUnique({
      where: { roomId },
      include: {
        room: {
          select: { id: true, name: true, roomNumber: true, floor: true },
        },
      },
    });

    if (!setup || setup.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: 'Minibar setup not found' }, { status: 404 });
    }

    // Parse itemJson for convenience
    let items = [];
    try {
      items = JSON.parse(setup.itemJson);
    } catch {
      items = [];
    }

    return NextResponse.json({ success: true, data: { ...setup, items } });
  } catch (error) {
    console.error('[GET /api/minibar/setup/[roomId]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/minibar/setup/[roomId] - Update minibar setup for a specific room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;
    const body = await request.json();
    const { itemJson, lastRestockedAt, restockedBy } = body;

    const existing = await db.minibarSetup.findUnique({
      where: { roomId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: 'Minibar setup not found for this room' }, { status: 404 });
    }

    const setup = await db.minibarSetup.update({
      where: { roomId },
      data: {
        ...(itemJson !== undefined && { itemJson: JSON.stringify(itemJson) }),
        ...(lastRestockedAt !== undefined && { lastRestockedAt: lastRestockedAt ? new Date(lastRestockedAt) : null }),
        ...(restockedBy !== undefined && { restockedBy }),
      },
      include: {
        room: {
          select: { id: true, name: true, roomNumber: true, floor: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: setup });
  } catch (error) {
    console.error('[PUT /api/minibar/setup/[roomId]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
