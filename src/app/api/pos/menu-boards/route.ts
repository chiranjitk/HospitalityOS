import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const menuBoards = await db.menuItem.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      _min: { price: true },
      _max: { price: true },
      where: { isActive: true },
    });

    const categories = await db.menuCategory.findMany({
      where: { isActive: true },
      include: { items: { where: { isActive: true }, take: 5, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    // Build board configs from categories
    const boards = categories.map((cat, index) => ({
      id: `board-${cat.id}`,
      name: `${cat.name} Menu Board`,
      screen: `Screen ${index + 1}`,
      categoryIds: [cat.id],
      categories: [{ id: cat.id, name: cat.name, itemCount: cat.items.length }],
      status: 'active' as const,
      lastUpdated: new Date().toISOString(),
    }));

    const totalItems = await db.menuItem.count({ where: { isActive: true } });

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
    const body = await req.json();
    const { name, screen, categoryIds } = body;

    if (!name || !categoryIds?.length) {
      return NextResponse.json(
        { success: false, error: 'Name and categoryIds are required' },
        { status: 400 }
      );
    }

    const categories = await db.menuCategory.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      include: { items: { where: { isActive: true }, take: 10 } },
    });

    const board = {
      id: `board-${Date.now()}`,
      name,
      screen: screen || 'Screen 1',
      categoryIds,
      categories: categories.map((c) => ({ id: c.id, name: c.name, itemCount: c.items.length })),
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
