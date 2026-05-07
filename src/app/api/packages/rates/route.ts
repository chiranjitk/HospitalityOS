import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/packages/rates - List package rates with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const packagePlanId = searchParams.get('packagePlanId');
    const roomTypeId = searchParams.get('roomTypeId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.PackageRateWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (packagePlanId) where.packagePlanId = packagePlanId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) where.startDate.gte = new Date(dateFrom);
      if (dateTo) {
        where.OR = [
          { startDate: { lte: new Date(dateTo) } },
          { endDate: { gte: new Date(dateFrom) } },
        ];
      }
    }

    const [rates, total] = await Promise.all([
      db.packageRate.findMany({
        where,
        include: {
          packagePlan: {
            select: { id: true, name: true },
          },
        },
        orderBy: { startDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.packageRate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/packages/rates]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/packages/rates - Create a package rate
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      propertyId,
      packagePlanId,
      roomTypeId,
      startDate,
      endDate,
      price,
      currency,
      minStay,
      maxStay,
      status,
    } = body;

    if (!propertyId || !packagePlanId || !roomTypeId || !startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'propertyId, packagePlanId, roomTypeId, startDate, and endDate are required',
      }, { status: 400 });
    }

    // Validate package plan exists and belongs to tenant
    const pkg = await db.packagePlan.findFirst({
      where: { id: packagePlanId, tenantId: user.tenantId, propertyId },
    });

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 400 });
    }

    // Validate room type exists
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, propertyId, tenantId: user.tenantId },
    });

    if (!roomType) {
      return NextResponse.json({ success: false, error: 'Room type not found' }, { status: 400 });
    }

    // Check for unique constraint violation (packagePlanId + roomTypeId + startDate)
    const existingRate = await db.packageRate.findUnique({
      where: {
        packagePlanId_roomTypeId_startDate: {
          packagePlanId,
          roomTypeId,
          startDate: new Date(startDate),
        },
      },
    });

    if (existingRate) {
      return NextResponse.json({
        success: false,
        error: 'A rate already exists for this package, room type, and start date. Use PUT to update it.',
      }, { status: 409 });
    }

    const rate = await db.packageRate.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        packagePlanId,
        roomTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        price: price ?? 0,
        currency: currency || 'USD',
        minStay: minStay ?? 1,
        maxStay: maxStay ?? null,
        status: status || 'active',
      },
      include: {
        packagePlan: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: rate }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/packages/rates]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
