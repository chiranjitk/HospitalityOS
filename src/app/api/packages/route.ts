import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';

// GET /api/packages - List package plans with filters & pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sortBy = searchParams.get('sortBy') || 'sortOrder';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.PackagePlanWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (status) where.status = status;

    const orderByField = ['name', 'status', 'startDate', 'endDate', 'createdAt', 'sortOrder'].includes(sortBy) ? sortBy : 'sortOrder';
    const orderBy: Prisma.PackagePlanOrderByWithRelationInput = {};
    (orderBy as Record<string, string>)[orderByField] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [packages, total] = await Promise.all([
      db.packagePlan.findMany({
        where,
        include: {
          components: {
            orderBy: { sortOrder: 'asc' },
          },
          rates: {
            orderBy: { startDate: 'asc' },
          },
          _count: {
            select: { components: true, rates: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.packagePlan.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        packages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/packages]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/packages - Create a package plan with components
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      baseRoomTypeId,
      roomRateInclusive,
      startDate,
      endDate,
      minNights,
      maxNights,
      totalBasePrice,
      currency,
      sortOrder,
      status,
      components,
    } = body;

    if (!propertyId || !name || !baseRoomTypeId || !startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'propertyId, name, baseRoomTypeId, startDate, and endDate are required',
      }, { status: 400 });
    }

    // Validate room type exists
    const roomType = await db.roomType.findFirst({
      where: { id: baseRoomTypeId, propertyId },
    });

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Room type not found' }, { status: 400 });
    }

    // Calculate total base price from components if not provided
    let calculatedBasePrice = totalBasePrice || 0;
    if ((!totalBasePrice || totalBasePrice === 0) && components && Array.isArray(components)) {
      calculatedBasePrice = components
        .filter((c: { isIncluded: boolean }) => c.isIncluded !== false)
        .reduce((sum: number, c: { unitCost: number }) => sum + (c.unitCost || 0), 0);
    }

    const pkg = await db.$transaction(async (tx) => {
      const newPackage = await tx.packagePlan.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          name,
          description: description || null,
          baseRoomTypeId,
          roomRateInclusive: roomRateInclusive ?? false,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          minNights: minNights ?? 1,
          maxNights: maxNights ?? null,
          totalBasePrice: calculatedBasePrice,
          currency: currency || 'USD',
          sortOrder: sortOrder ?? 0,
          status: status || 'active',
          components: components && Array.isArray(components) ? {
            create: components.map((c: {
              componentType: string;
              referenceId?: string;
              referenceName?: string;
              includedQty?: number;
              unitCost?: number;
              isIncluded?: boolean;
              sortOrder?: number;
            }) => ({
              componentType: c.componentType,
              referenceId: c.referenceId || null,
              referenceName: c.referenceName || null,
              includedQty: c.includedQty ?? 1,
              unitCost: c.unitCost ?? 0,
              isIncluded: c.isIncluded ?? true,
              sortOrder: c.sortOrder ?? 0,
            })),
          } : undefined,
        },
        include: {
          components: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      return newPackage;
    });

    // Audit log (non-blocking)
    try {
      await audit(request, 'rooms', 'create', 'package', pkg.id, undefined, {
        propertyId,
        name,
        baseRoomTypeId,
        totalBasePrice: calculatedBasePrice,
        currency: currency || 'USD',
        status: status || 'active',
        startDate,
        endDate,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, data: pkg }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/packages]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
