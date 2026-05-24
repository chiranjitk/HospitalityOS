import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage', 'restaurant.read', 'restaurant.*', '*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    // Fetch tenant's properties once for scoping
    const tenantProperties = await db.property.findMany({ where: { tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
    const propertyIds = tenantProperties.map(p => p.id);

    const menuBoards = await db.menuItem.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      _min: { price: true },
      _max: { price: true },
      where: { isAvailable: true, deletedAt: null, propertyId: { in: propertyIds } },
    });

    const categories = await db.orderCategory.findMany({
      where: { status: 'active', propertyId: { in: propertyIds } },
      include: { menuItems: { where: { isAvailable: true, deletedAt: null }, take: 5, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    // Build board configs from categories
    const boards = categories.map((cat, index) => ({
      id: `board-${cat.id}`,
      name: `${cat.name} Menu Board`,
      screen: `Screen ${index + 1}`,
      categoryIds: [cat.id],
      categories: [{ id: cat.id, name: cat.name, itemCount: cat.menuItems.length }],
      status: 'active' as const,
      lastUpdated: new Date().toISOString(),
    }));

    const totalItems = await db.menuItem.count({ where: { isAvailable: true, deletedAt: null, propertyId: { in: propertyIds } } });

    return NextResponse.json({
      success: true,
      data: { boards, totalItems, totalCategories: categories.length },
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
    const { name, screen, categoryIds } = body;

    if (!name || !categoryIds?.length) {
      return NextResponse.json(
        { success: false, error: 'Name and categoryIds are required' },
        { status: 400 }
      );
    }

    const categories = await db.orderCategory.findMany({
      where: { id: { in: categoryIds }, status: 'active' },
      include: { menuItems: { where: { isAvailable: true, deletedAt: null }, take: 10 } },
    });

    const board = {
      id: `board-${Date.now()}`,
      name,
      screen: screen || 'Screen 1',
      categoryIds,
      categories: categories.map((c) => ({ id: c.id, name: c.name, itemCount: c.menuItems.length })),
      status: 'active' as const,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: board });
  } catch (error: unknown) {
    console.error('Failed to create menu board:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create menu board' },
      { status: 500 }
    );
  }
}
