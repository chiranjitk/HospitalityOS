import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/menu-boards/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage', 'pos.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const board = await db.menuBoard.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!board) {
      return NextResponse.json({ success: false, error: 'Menu board not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: board });
  } catch (error) {
    console.error('Error fetching menu board:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch menu board' }, { status: 500 });
  }
}

// PUT /api/pos/menu-boards/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage', 'pos.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.menuBoard.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Menu board not found' }, { status: 404 });
    }

    const { name, description, location, orientation, resolution, theme, isActive } = body;

    const board = await db.menuBoard.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(orientation !== undefined && { orientation }),
        ...(resolution !== undefined && { resolution }),
        ...(theme !== undefined && { theme }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: board });
  } catch (error) {
    console.error('Error updating menu board:', error);
    return NextResponse.json({ success: false, error: 'Failed to update menu board' }, { status: 500 });
  }
}

// DELETE /api/pos/menu-boards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage', 'pos.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.menuBoard.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Menu board not found' }, { status: 404 });
    }

    await db.menuBoard.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting menu board:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete menu board' }, { status: 500 });
  }
}
