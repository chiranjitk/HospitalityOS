import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

// GET /api/inventory - List inventory items with filtering, pagination, stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.view') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100);
    const statsOnly = searchParams.get('stats') === 'true';

    // Resolve propertyId: if not provided, use the first property for the tenant
    let resolvedPropertyId = propertyId;
    if (!resolvedPropertyId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!firstProperty) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for your tenant' } },
          { status: 400 }
        );
      }
      resolvedPropertyId = firstProperty.id;
    } else {
      // Verify property belongs to user's tenant
      const property = await db.property.findFirst({
        where: { id: resolvedPropertyId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
          { status: 400 }
        );
      }
    }

    const where: Record<string, unknown> = { propertyId: resolvedPropertyId, deletedAt: null };

    if (category && category !== 'all') {
      where.category = category;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Stats endpoint
    if (statsOnly) {
      const [allItems, lowStockItems, outOfStockItems, totalValueResult] = await Promise.all([
        db.inventoryItem.count({ where }),
        db.inventoryItem.count({ where: { ...where, status: 'low_stock', deletedAt: null } }),
        db.inventoryItem.count({ where: { ...where, status: 'out_of_stock', deletedAt: null } }),
        db.inventoryItem.aggregate({
          where,
          _sum: { currentStock: true, unitCost: true },
        }),
      ]);

      // Calculate total value = sum of (currentStock * unitCost) for each item
      const itemsForValue = await db.inventoryItem.findMany({
        where,
        select: { currentStock: true, unitCost: true },
      });
      const totalValue = itemsForValue.reduce((sum, item) => {
        return sum + (Number(item.currentStock) * Number(item.unitCost));
      }, 0);

      return NextResponse.json({
        success: true,
        data: {
          totalItems: allItems,
          lowStockAlerts: lowStockItems,
          outOfStock: outOfStockItems,
          totalValue,
        },
      });
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        include: {
          _count: { select: { movements: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip,
      }),
      db.inventoryItem.count({ where }),
    ]);

    // Add computed value to each item
    const itemsWithValue = items.map(item => ({
      ...item,
      value: Number(item.currentStock) * Number(item.unitCost),
    }));

    // Low stock / out of stock counts for meta
    const lowStockCount = await db.inventoryItem.count({
      where: { ...where, status: 'low_stock', deletedAt: null },
    });
    const outOfStockCount = await db.inventoryItem.count({
      where: { ...where, status: 'out_of_stock', deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      data: itemsWithValue,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory - Create inventory item
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.create') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      name,
      category,
      currentStock = 0,
      unit = 'pcs',
      unitCost = 0,
      lowStockThreshold = 10,
      reorderLevel = 5,
      supplierName,
      supplierContact,
    } = body;

    if (!propertyId || !name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId and name are required' } },
        { status: 400 }
      );
    }

    if (currentStock < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'currentStock cannot be negative' } },
        { status: 400 }
      );
    }

    if (unitCost < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'unitCost cannot be negative' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // Auto-calculate status based on stock vs threshold
    const itemStatus = currentStock <= 0
      ? 'out_of_stock'
      : currentStock <= lowStockThreshold
        ? 'low_stock'
        : 'in_stock';

    const item = await db.inventoryItem.create({
      data: {
        propertyId,
        name: name.trim(),
        category: category || null,
        currentStock,
        unit,
        unitCost,
        lowStockThreshold,
        reorderLevel,
        supplierName: supplierName || null,
        supplierContact: supplierContact || null,
        status: itemStatus,
        lastRestocked: currentStock > 0 ? new Date() : null,
      },
      include: {
        _count: { select: { movements: true } },
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inventory item' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory - Update inventory item
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.update') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user's tenant
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const data: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'category', 'unit', 'unitCost', 'lowStockThreshold',
      'reorderLevel', 'supplierName', 'supplierContact',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field];
      }
    }

    // Auto-update status if currentStock or lowStockThreshold changes
    const newStock = updateData.currentStock !== undefined ? updateData.currentStock : Number(existing.currentStock);
    const newThreshold = updateData.lowStockThreshold !== undefined ? updateData.lowStockThreshold : Number(existing.lowStockThreshold);

    if (updateData.currentStock !== undefined || updateData.lowStockThreshold !== undefined) {
      data.status = newStock <= 0
        ? 'out_of_stock'
        : newStock <= newThreshold
          ? 'low_stock'
          : 'in_stock';
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data,
      include: {
        _count: { select: { movements: true } },
      },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inventory item' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory - Soft delete inventory item
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'inventory.delete') && !hasPermission(user, 'inventory.*') && !hasPermission(user, '*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user's tenant
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    await db.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete inventory item' } },
      { status: 500 }
    );
  }
}
