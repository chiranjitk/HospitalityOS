import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// L-22: Menu boards are persisted via the MenuBoard and MenuBoardItem database models.
// This route now uses the persisted models instead of building boards in memory.

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage', 'restaurant.read', 'restaurant.*', '*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    // Fetch tenant's properties for scoping
    const tenantProperties = await db.property.findMany({ where: { tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
    const propertyIds = tenantProperties.map(p => p.id);

    // Fetch persisted menu boards from database
    const boards = await db.menuBoard.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: {
        items: {
          where: {},
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalItems = boards.reduce((sum, b) => sum + (b.items?.length || 0), 0);

    // Also build a dynamic category-based view for backward compatibility
    const categories = await db.orderCategory.findMany({
      where: { status: 'active', propertyId: { in: propertyIds } },
      include: { menuItems: { where: { isAvailable: true, deletedAt: null }, take: 5, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    const dynamicBoards = categories.map((cat, index) => ({
      id: `board-${cat.id}`,
      name: `${cat.name} Menu Board`,
      screen: `Screen ${index + 1}`,
      categoryIds: [cat.id],
      categories: [{ id: cat.id, name: cat.name, itemCount: cat.menuItems.length }],
      status: 'active' as const,
      lastUpdated: new Date().toISOString(),
      source: 'dynamic' as const,
    }));

    const totalCategories = categories.length;

    return NextResponse.json({
      success: true,
      data: {
        boards,
        totalItems,
        totalCategories,
        dynamicBoards,
        totalBoards: boards.length + dynamicBoards.length,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch menu boards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch menu boards' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage', 'pos.*', 'restaurant.write', '*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, propertyId, location, orientation, resolution, theme, items } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // L-22: Persist menu board to database
    const board = await db.menuBoard.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        propertyId: propertyId || null,
        location: location || 'main',
        orientation: orientation || 'landscape',
        resolution: resolution || '1920x1080',
        theme: theme || 'default',
        isActive: true,
      },
    });

    // Create menu board items if provided
    if (items && Array.isArray(items)) {
      await db.menuBoardItem.createMany({
        data: items.map((item: Record<string, unknown>, index: number) => ({
          boardId: board.id,
          name: item.name || `Item ${index + 1}`,
          description: item.description || null,
          price: Number(item.price) || 0,
          currency: item.currency || 'USD',
          category: item.category || 'uncategorized',
          imageUrl: item.imageUrl || null,
          position: index,
        })),
      });
    }

    const completeBoard = await db.menuBoard.findUnique({
      where: { id: board.id },
      include: { items: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json({ success: true, data: completeBoard }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create menu board:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create menu board' },
      { status: 500 }
    );
  }
}
