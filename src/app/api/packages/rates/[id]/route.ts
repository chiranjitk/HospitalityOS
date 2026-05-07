import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/packages/rates/[id] - Get a single package rate
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

    const rate = await db.packageRate.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        packagePlan: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!rate) {
      return NextResponse.json({ success: false, error: 'Package rate not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rate });
  } catch (error) {
    console.error('[GET /api/packages/rates/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/packages/rates/[id] - Update a package rate
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

    const existing = await db.packageRate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Package rate not found' }, { status: 404 });
    }

    const {
      roomTypeId,
      startDate,
      endDate,
      price,
      currency,
      minStay,
      maxStay,
      status,
    } = body;

    const rate = await db.packageRate.update({
      where: { id },
      data: {
        ...(roomTypeId !== undefined && { roomTypeId }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(price !== undefined && { price }),
        ...(currency !== undefined && { currency }),
        ...(minStay !== undefined && { minStay }),
        ...(maxStay !== undefined && { maxStay }),
        ...(status !== undefined && { status }),
      },
      include: {
        packagePlan: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: rate });
  } catch (error) {
    console.error('[PUT /api/packages/rates/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/packages/rates/[id] - Delete a package rate
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

    const existing = await db.packageRate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Package rate not found' }, { status: 404 });
    }

    await db.packageRate.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/packages/rates/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
