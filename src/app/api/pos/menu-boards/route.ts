import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/menu-boards
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage', 'pos.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const location = searchParams.get('location');
    const propertyId = searchParams.get('propertyId');
    const search = searchParams.get('search');

    const where: any = { tenantId: user.tenantId };
    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }
    if (location) where.location = location;
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const boards = await db.menuBoard.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: boards });
  } catch (error) {
    console.error('Error fetching menu boards:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch menu boards' }, { status: 500 });
  }
}

// POST /api/pos/menu-boards
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage', 'pos.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, location, orientation, resolution, theme, propertyId } = body;

    if (!name || !location) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, location' }, { status: 400 });
    }

    const board = await db.menuBoard.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        location,
        orientation: orientation || 'landscape',
        resolution: resolution || '1920x1080',
        theme: theme || 'default',
      },
    });

    return NextResponse.json({ success: true, data: board }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu board:', error);
    return NextResponse.json({ success: false, error: 'Failed to create menu board' }, { status: 500 });
  }
}
