import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/menu-boards/[id]/items
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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isAvailable = searchParams.get('isAvailable');

    const board = await db.menuBoard.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!board) {
      return NextResponse.json({ success: false, error: 'Menu board not found' }, { status: 404 });
    }

    const where: any = { boardId: id };
    if (category) where.category = category;
    if (isAvailable !== null && isAvailable !== undefined && isAvailable !== 'all') {
      where.isAvailable = isAvailable === 'true';
    }

    const items = await db.menuBoardItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching menu board items:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch items' }, { status: 500 });
  }
}

// POST /api/pos/menu-boards/[id]/items
export async function POST(
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
    const { name, description, price, currency, category, imageUrl, isAvailable, isFeatured, sortOrder, menuItemId } = body;

    const board = await db.menuBoard.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!board) {
      return NextResponse.json({ success: false, error: 'Menu board not found' }, { status: 404 });
    }

    if (!name || !category || price === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, category, price' }, { status: 400 });
    }

    const item = await db.menuBoardItem.create({
      data: {
        boardId: id,
        menuItemId: menuItemId || null,
        name,
        description: description || null,
        price: parseFloat(price),
        currency: currency || 'USD',
        category,
        imageUrl: imageUrl || null,
        isAvailable: isAvailable !== false,
        isFeatured: isFeatured || false,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu board item:', error);
    return NextResponse.json({ success: false, error: 'Failed to create item' }, { status: 500 });
  }
}
