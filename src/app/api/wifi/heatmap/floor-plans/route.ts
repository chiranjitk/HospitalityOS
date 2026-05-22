import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth/tenant-context';

// GET - List floor plans for a property
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || '';

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { tenantId, propertyId };
    const floorPlans = await db.wiFiFloorPlan.findMany({
      where,
      orderBy: [{ floorNumber: 'asc' }, { floorName: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        floorName: true,
        floorNumber: true,
        width: true,
        height: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { readings: true } },
      },
    });

    return NextResponse.json({ data: floorPlans });
  } catch (error) {
    console.error('[heatmap/floor-plans] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch floor plans' }, { status: 500 });
  }
}

// POST - Create floor plan with SVG data
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const body = await request.json();
    const {
      propertyId,
      floorName,
      floorNumber = 1,
      svgData,
      width = 800,
      height = 600,
    } = body;

    if (!propertyId || !floorName || !svgData) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, floorName, svgData' },
        { status: 400 }
      );
    }

    const floorPlan = await db.wiFiFloorPlan.create({
      data: {
        tenantId,
        propertyId,
        floorName,
        floorNumber,
        svgData,
        width,
        height,
      },
    });

    return NextResponse.json({ data: floorPlan }, { status: 201 });
  } catch (error) {
    console.error('[heatmap/floor-plans] POST error:', error);
    return NextResponse.json({ error: 'Failed to create floor plan' }, { status: 500 });
  }
}
