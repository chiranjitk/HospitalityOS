import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/packages/[id] - Get a single package plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const pkg = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
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
    });

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: pkg });
  } catch (error) {
    console.error('[GET /api/packages/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/packages/[id] - Update a package plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    const {
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
    } = body;

    const pkg = await db.packagePlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(baseRoomTypeId !== undefined && { baseRoomTypeId }),
        ...(roomRateInclusive !== undefined && { roomRateInclusive }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(minNights !== undefined && { minNights }),
        ...(maxNights !== undefined && { maxNights }),
        ...(totalBasePrice !== undefined && { totalBasePrice }),
        ...(currency !== undefined && { currency }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
      include: {
        components: {
          orderBy: { sortOrder: 'asc' },
        },
        rates: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    return NextResponse.json({ success: true, data: pkg });
  } catch (error) {
    console.error('[PUT /api/packages/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/packages/[id] - Delete a package plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    // Delete components and rates first (cascade should handle this, but explicit for safety)
    await db.$transaction(async (tx) => {
      await tx.packageComponent.deleteMany({ where: { packagePlanId: id } });
      await tx.packageRate.deleteMany({ where: { packagePlanId: id } });
      await tx.packagePlan.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/packages/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
