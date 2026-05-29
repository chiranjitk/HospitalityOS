import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/revenue/compset/[id] - Full compset detail with members and latest metrics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId, isActive: true },
      include: {
        members: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        property: {
          select: { id: true, name: true, totalRooms: true },
        },
      },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Get latest metrics
    const latestMetrics = await db.compSetMetric.findMany({
      where: {
        competitiveSetId: id,
        tenantId: ctx.tenantId,
      },
      orderBy: { date: 'desc' },
      take: 30,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...compSet,
        latestMetrics,
      },
    });
  } catch (error) {
    console.error('Error fetching competitive set:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch competitive set' } },
      { status: 500 }
    );
  }
}

// PUT /api/revenue/compset/[id] - Update compset
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const body = await request.json();
    const { name, description, segment } = body;

    // Validate exists
    const existing = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Validate segment
    const validSegments = ['primary', 'secondary', 'luxury', 'budget', 'resort', 'extended_stay'];
    if (segment && !validSegments.includes(segment)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Segment must be one of: ${validSegments.join(', ')}` } },
        { status: 400 }
      );
    }

    const updated = await db.competitiveSet.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(segment !== undefined && { segment }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating competitive set:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update competitive set' } },
      { status: 500 }
    );
  }
}

// DELETE /api/revenue/compset/[id] - Soft delete
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const existing = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    await db.competitiveSet.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Competitive set deactivated' },
    });
  } catch (error) {
    console.error('Error deleting competitive set:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete competitive set' } },
      { status: 500 }
    );
  }
}
