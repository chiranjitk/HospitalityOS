import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/menu-variants
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const menuItemId = searchParams.get('menuItemId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
    }

    const where: Record<string, unknown> = { propertyId };
    if (menuItemId) where.menuItemId = menuItemId;

    const variants = await db.menuVariant.findMany({
      where,
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: variants });
  } catch (error) {
    console.error('Error fetching menu variants:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch menu variants' } }, { status: 500 });
  }
}

// POST /api/menu-variants
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, menuItemId, name, price, sku, calories, isAvailable = true, isDefault = false, sortOrder = 0 } = body;

    if (!propertyId || !menuItemId || !name || price === undefined) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId, menuItemId, name, and price are required' } }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await db.menuVariant.updateMany({
        where: { menuItemId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const variant = await db.menuVariant.create({
      data: { propertyId, menuItemId, name, price, sku, calories, isAvailable, isDefault, sortOrder },
      include: { menuItem: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: variant }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu variant:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create menu variant' } }, { status: 500 });
  }
}

// PUT /api/menu-variants
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, price, sku, calories, isAvailable, isDefault, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.menuVariant.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } }, menuItem: { select: { id: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Variant not found' } }, { status: 404 });
    }

    // If setting as default, unset any existing default for same menu item
    if (isDefault && !existing.isDefault) {
      await db.menuVariant.updateMany({
        where: { menuItemId: existing.menuItemId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = price;
    if (sku !== undefined) data.sku = sku;
    if (calories !== undefined) data.calories = calories;
    if (isAvailable !== undefined) data.isAvailable = isAvailable;
    if (isDefault !== undefined) data.isDefault = isDefault;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const variant = await db.menuVariant.update({
      where: { id },
      data,
      include: { menuItem: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: variant });
  } catch (error) {
    console.error('Error updating menu variant:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update menu variant' } }, { status: 500 });
  }
}

// DELETE /api/menu-variants
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.menuVariant.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Variant not found' } }, { status: 404 });
    }

    await db.menuVariant.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting menu variant:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete menu variant' } }, { status: 500 });
  }
}
