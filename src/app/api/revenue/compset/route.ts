import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/revenue/compset - List all competitive sets for tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const segment = searchParams.get('segment');

    const where: Record<string, unknown> = { tenantId: ctx.tenantId, isActive: true };
    if (propertyId) where.propertyId = propertyId;
    if (segment) where.segment = segment;

    const compSets = await db.competitiveSet.findMany({
      where,
      include: {
        _count: {
          select: { members: true, metrics: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get latest metric for each compset
    const enrichedSets = await Promise.all(
      compSets.map(async (cs) => {
        const latestMetric = await db.compSetMetric.findFirst({
          where: {
            competitiveSetId: cs.id,
            tenantId: ctx.tenantId,
          },
          orderBy: { date: 'desc' },
        });

        return {
          id: cs.id,
          name: cs.name,
          description: cs.description,
          segment: cs.segment,
          propertyId: cs.propertyId,
          propertyName: cs.property.name,
          memberCount: cs._count.members,
          metricsCount: cs._count.metrics,
          latestRgi: latestMetric?.rgi ?? null,
          latestAdrIndex: latestMetric?.adrIndex ?? null,
          latestMpi: latestMetric?.mpi ?? null,
          latestRevparIndex: latestMetric?.revparIndex ?? null,
          latestDate: latestMetric?.date?.toISOString() ?? null,
          createdAt: cs.createdAt.toISOString(),
          updatedAt: cs.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedSets,
    });
  } catch (error) {
    console.error('Error fetching competitive sets:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch competitive sets' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/compset - Create new competitive set
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { name, description, segment, propertyId, members } = body;

    // Validate required fields
    if (!name || !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and propertyId are required' } },
        { status: 400 }
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

    // Verify property exists
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: ctx.tenantId },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Create competitive set with optional initial members
    const compSet = await db.competitiveSet.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        name,
        description: description || null,
        segment: segment || 'primary',
        members: members
          ? {
              create: members.map((m: Record<string, unknown>, index: number) => ({
                tenantId: ctx.tenantId,
                hotelName: m.hotelName as string,
                hotelCode: (m.hotelCode as string) || null,
                starRating: (m.starRating as number) || null,
                totalRooms: (m.totalRooms as number) || null,
                proximityKm: (m.proximityKm as number) || null,
                channel: (m.channel as string) || 'direct',
                competitorId: (m.competitorId as string) || null,
                url: (m.url as string) || null,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        members: true,
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: compSet },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating competitive set:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create competitive set' } },
      { status: 500 }
    );
  }
}
