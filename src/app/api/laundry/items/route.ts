import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';
import { transformRecords, transformRecord, statusToIsActive } from '@/lib/api-transform';

// GET /api/laundry/items - List laundry items with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const serviceType = searchParams.get('serviceType');
    const isActive = searchParams.get('isActive');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sortBy = searchParams.get('sortBy') || 'sortOrder';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.LaundryItemWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (category) where.category = category;
    if (serviceType) where.serviceType = serviceType;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';
    const status = searchParams.get('status');
    if (!isActive && status) where.isActive = status === 'active';

    const orderByField = ['name', 'category', 'serviceType', 'createdAt', 'sortOrder'].includes(sortBy) ? sortBy : 'sortOrder';
    const orderBy: Prisma.LaundryItemOrderByWithRelationInput = {};
    (orderBy as Record<string, string>)[orderByField] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [items, total] = await Promise.all([
      db.laundryItem.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.laundryItem.count({ where }),
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
    console.error('[GET /api/laundry/items]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/laundry/items - Create a laundry item
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.create') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, name, category, serviceType, unitPrice, currency, turnaroundHours, isActive, sortOrder } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: 'propertyId and name are required' }, { status: 400 });
    }

    const item = await db.laundryItem.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category: category || 'guest',
        serviceType: serviceType || 'wash',
        unitPrice: unitPrice ?? 0,
        currency: currency || 'USD',
        turnaroundHours: turnaroundHours ?? 24,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/laundry/items]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
