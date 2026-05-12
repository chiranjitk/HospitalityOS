import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/menu-modifiers
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const search = searchParams.get('search');
    const isAvailable = searchParams.get('isAvailable');

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

    const where: Record<string, unknown> = { propertyId, deletedAt: null };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (isAvailable !== null && isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    const modifiers = await db.menuModifier.findMany({
      where,
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        items: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: modifiers });
  } catch (error) {
    console.error('Error fetching menu modifiers:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch menu modifiers' } }, { status: 500 });
  }
}

// POST /api/menu-modifiers
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, name, selectionType = 'optional', minSelections = 0, maxSelections = 1, isAvailable = true, itemIds = [], options = [] } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId and name are required' } }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
    }

    const modifier = await db.menuModifier.create({
      data: {
        propertyId,
        name,
        selectionType,
        minSelections,
        maxSelections,
        isAvailable,
        options: {
          create: (options || []).map((opt: { name: string; priceAdjustment?: number; isAvailable?: boolean; isDefault?: boolean; sortOrder?: number }, idx: number) => ({
            propertyId,
            name: opt.name,
            priceAdjustment: opt.priceAdjustment || 0,
            isAvailable: opt.isAvailable !== false,
            isDefault: opt.isDefault || false,
            sortOrder: opt.sortOrder ?? idx,
          })),
        },
        items: itemIds.length > 0 ? {
          connect: itemIds.map((id: string) => ({ id })),
        } : undefined,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        items: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: modifier }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu modifier:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create menu modifier' } }, { status: 500 });
  }
}

// PUT /api/menu-modifiers
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, selectionType, minSelections, maxSelections, isAvailable, itemIds, options } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.menuModifier.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Modifier group not found' } }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (selectionType !== undefined) data.selectionType = selectionType;
    if (minSelections !== undefined) data.minSelections = minSelections;
    if (maxSelections !== undefined) data.maxSelections = maxSelections;
    if (isAvailable !== undefined) data.isAvailable = isAvailable;

    if (itemIds !== undefined) {
      data.items = { set: itemIds.map((iId: string) => ({ id: iId })) };
    }

    if (options !== undefined) {
      // Delete existing options and recreate
      await db.menuModifierOption.deleteMany({ where: { modifierGroupId: id } });
      data.options = {
        create: options.map((opt: { name: string; priceAdjustment?: number; isAvailable?: boolean; isDefault?: boolean; sortOrder?: number }, idx: number) => ({
          propertyId: existing.propertyId,
          name: opt.name,
          priceAdjustment: opt.priceAdjustment || 0,
          isAvailable: opt.isAvailable !== false,
          isDefault: opt.isDefault || false,
          sortOrder: opt.sortOrder ?? idx,
        })),
      };
    }

    const modifier = await db.menuModifier.update({
      where: { id },
      data,
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        items: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: modifier });
  } catch (error) {
    console.error('Error updating menu modifier:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update menu modifier' } }, { status: 500 });
  }
}

// DELETE /api/menu-modifiers
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

    const existing = await db.menuModifier.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Modifier group not found' } }, { status: 404 });
    }

    await db.menuModifier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting menu modifier:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete menu modifier' } }, { status: 500 });
  }
}
