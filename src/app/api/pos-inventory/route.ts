import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// GET /api/pos-inventory
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

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
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const items = await db.inventoryItem.findMany({
      where,
      include: {
        _count: { select: { movements: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Low stock alerts
    const lowStockItems = items.filter(i => i.currentStock <= i.lowStockThreshold);
    const outOfStockItems = items.filter(i => i.currentStock <= 0);

    return NextResponse.json({
      success: true,
      data: items,
      meta: { lowStockCount: lowStockItems.length, outOfStockCount: outOfStockItems.length },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory' } }, { status: 500 });
  }
}

// POST /api/pos-inventory
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, name, category, currentStock = 0, unit = 'pcs', unitCost = 0, lowStockThreshold = 10, reorderLevel = 5, supplierName, supplierContact } = body;

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

    const itemStatus = currentStock <= 0 ? 'out_of_stock' : currentStock <= lowStockThreshold ? 'low_stock' : 'in_stock';

    const item = await db.inventoryItem.create({
      data: {
        propertyId, name, category, currentStock, unit, unitCost,
        lowStockThreshold, reorderLevel, supplierName, supplierContact,
        status: itemStatus,
        lastRestocked: currentStock > 0 ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inventory item' } }, { status: 500 });
  }
}

// PUT /api/pos-inventory
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, unit, unitCost, lowStockThreshold, reorderLevel, supplierName, supplierContact } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (unit !== undefined) data.unit = unit;
    if (unitCost !== undefined) data.unitCost = unitCost;
    if (lowStockThreshold !== undefined) data.lowStockThreshold = lowStockThreshold;
    if (reorderLevel !== undefined) data.reorderLevel = reorderLevel;
    if (supplierName !== undefined) data.supplierName = supplierName;
    if (supplierContact !== undefined) data.supplierContact = supplierContact;

    const item = await db.inventoryItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inventory item' } }, { status: 500 });
  }
}

// DELETE /api/pos-inventory
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

    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 });
    }

    await db.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete inventory item' } }, { status: 500 });
  }
}
