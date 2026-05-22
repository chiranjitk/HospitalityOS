import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth/tenant-context';

// GET - Single floor plan with latest readings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const { id } = await params;

    const floorPlan = await db.wiFiFloorPlan.findFirst({
      where: { id, tenantId },
      include: {
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!floorPlan) {
      return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
    }

    return NextResponse.json({ data: floorPlan });
  } catch (error) {
    console.error('[heatmap/floor-plans/:id] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch floor plan' }, { status: 500 });
  }
}

// PATCH - Update floor plan SVG or settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const { id } = await params;

    const body = await request.json();
    const { floorName, floorNumber, svgData, width, height, isActive } = body;

    // Check ownership
    const existing = await db.wiFiFloorPlan.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (floorName !== undefined) updateData.floorName = floorName;
    if (floorNumber !== undefined) updateData.floorNumber = floorNumber;
    if (svgData !== undefined) updateData.svgData = svgData;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.wiFiFloorPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[heatmap/floor-plans/:id] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update floor plan' }, { status: 500 });
  }
}

// DELETE - Remove floor plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const { id } = await params;

    // Check ownership
    const existing = await db.wiFiFloorPlan.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
    }

    await db.wiFiFloorPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[heatmap/floor-plans/:id] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete floor plan' }, { status: 500 });
  }
}
