import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/resort/timeshare/units - List timeshare units
 * Query params: page, limit, seasonType, usageType, search, isActive
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['resort.timeshare.view', 'resort.*', 'pms.view', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const seasonType = searchParams.get('seasonType');
    const usageType = searchParams.get('usageType');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (seasonType && seasonType !== 'all') where.seasonType = seasonType;
    if (usageType && usageType !== 'all') where.usageType = usageType;
    if (isActive !== null && isActive !== undefined && isActive !== 'all') where.isActive = isActive === 'true';
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.unitNumber = { contains: search, mode: 'insensitive' };
    }

    const [units, total] = await Promise.all([
      db.timeshareUnit.findMany({
        where,
        include: {
          ownerships: {
            where: { status: 'active' },
            select: { id: true, ownerName: true, status: true },
          },
        },
        orderBy: { unitNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.timeshareUnit.count({ where }),
    ]);

    // Get stats
    const [totalUnits, activeUnits, totalOwnerships, totalAnnualMF] = await Promise.all([
      db.timeshareUnit.count({ where: { tenantId: user.tenantId } }),
      db.timeshareUnit.count({ where: { tenantId: user.tenantId, isActive: true } }),
      db.timeshareOwnership.count({ where: { tenantId: user.tenantId, status: 'active' } }),
      db.timeshareOwnership.aggregate({
        where: { tenantId: user.tenantId, status: 'active' },
        _sum: { annualMf: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: units.map(u => ({
        id: u.id,
        propertyId: u.propertyId,
        unitNumber: u.unitNumber,
        roomTypeId: u.roomTypeId,
        seasonType: u.seasonType,
        weekNumber: u.weekNumber,
        pointsValue: u.pointsValue,
        usageType: u.usageType,
        isActive: u.isActive,
        activeOwnerships: u.ownerships.length,
        ownerships: u.ownerships,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
      stats: {
        totalUnits,
        activeUnits,
        totalOwnerships,
        totalAnnualMF: totalAnnualMF._sum.annualMf || 0,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching timeshare units:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch timeshare units' }, { status: 500 });
  }
}

/**
 * POST /api/resort/timeshare/units - Create a new timeshare unit
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['resort.timeshare.manage', 'resort.*', 'pms.manage', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, unitNumber, roomTypeId, seasonType, weekNumber, pointsValue, usageType } = body;

    if (!propertyId || !unitNumber || !roomTypeId) {
      return NextResponse.json({ success: false, error: 'propertyId, unitNumber, and roomTypeId are required' }, { status: 400 });
    }

    const unit = await db.timeshareUnit.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        unitNumber,
        roomTypeId,
        seasonType: seasonType || 'annual',
        weekNumber: weekNumber || null,
        pointsValue: pointsValue || 0,
        usageType: usageType || 'full_ownership',
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: unit.id,
        ...unit,
        createdAt: unit.createdAt.toISOString(),
        updatedAt: unit.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating timeshare unit:', error);
    return NextResponse.json({ success: false, error: 'Failed to create timeshare unit' }, { status: 500 });
  }
}
