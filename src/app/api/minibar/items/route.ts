import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { transformRecords, transformRecord, statusToIsActive } from '@/lib/api-transform';

// GET /api/minibar/items - List minibar items with filters & pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sortBy = searchParams.get('sortBy') || 'sortOrder';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.MinibarItemWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';
    const status = searchParams.get('status');
    if (!isActive && status) where.isActive = status === 'active';
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const orderBy: Prisma.MinibarItemOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder === 'desc' ? 'desc' : 'asc';
    } else if (sortBy === 'category') {
      orderBy.category = sortOrder === 'desc' ? 'desc' : 'asc';
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.sortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    }

    const [items, total] = await Promise.all([
      db.minibarItem.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.minibarItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: transformRecords(items as unknown as Record<string, unknown>[]),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/minibar/items]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/minibar/items - Create a new minibar item
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, name, category, sku, costPrice, sellPrice, currency, imageUrl, isActive, sortOrder } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: 'propertyId and name are required' }, { status: 400 });
    }

    const item = await db.minibarItem.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category: category || 'beverage',
        sku: sku || null,
        costPrice: costPrice ?? 0,
        sellPrice: sellPrice ?? 0,
        currency: currency || 'USD',
        imageUrl: imageUrl || null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/minibar/items]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
