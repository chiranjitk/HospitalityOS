import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/resort/timeshare/ownerships - List timeshare ownerships
 * Query params: page, limit, status, unitId, search
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
    const status = searchParams.get('status');
    const unitId = searchParams.get('unitId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (unitId) where.unitId = unitId;
    if (search) {
      where.OR = [
        { ownerName: { contains: search, mode: 'insensitive' } },
        { ownerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [ownerships, total] = await Promise.all([
      db.timeshareOwnership.findMany({
        where,
        include: {
          timeshareUnit: {
            select: { id: true, unitNumber: true, seasonType: true, pointsValue: true, usageType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.timeshareOwnership.count({ where }),
    ]);

    // Stats
    const [activeCount, totalMF, totalPurchase] = await Promise.all([
      db.timeshareOwnership.count({ where: { tenantId: user.tenantId, status: 'active' } }),
      db.timeshareOwnership.aggregate({
        where: { tenantId: user.tenantId, status: 'active' },
        _sum: { annualMf: true },
      }),
      db.timeshareOwnership.aggregate({
        where: { tenantId: user.tenantId },
        _sum: { purchasePrice: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: ownerships.map(o => ({
        id: o.id,
        unitId: o.unitId,
        ownerId: o.ownerId,
        ownerName: o.ownerName,
        ownerEmail: o.ownerEmail,
        ownerPhone: o.ownerPhone,
        startDate: o.startDate.toISOString(),
        endDate: o.endDate?.toISOString(),
        purchasePrice: o.purchasePrice,
        annualMf: o.annualMf,
        status: o.status,
        notes: o.notes,
        unit: o.timeshareUnit,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      stats: {
        activeCount,
        expiredCount: total - activeCount,
        totalAnnualMF: totalMF._sum.annualMf || 0,
        totalPurchaseValue: totalPurchase._sum.purchasePrice || 0,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching timeshare ownerships:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch timeshare ownerships' }, { status: 500 });
  }
}

/**
 * POST /api/resort/timeshare/ownerships - Create a new timeshare ownership
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
    const { unitId, ownerId, ownerName, ownerEmail, ownerPhone, startDate, endDate, purchasePrice, annualMf, status, notes } = body;

    if (!unitId || !ownerName || !startDate || purchasePrice === undefined) {
      return NextResponse.json({ success: false, error: 'unitId, ownerName, startDate, and purchasePrice are required' }, { status: 400 });
    }

    // Verify unit belongs to tenant
    const unit = await db.timeshareUnit.findFirst({ where: { id: unitId, tenantId: user.tenantId } });
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Timeshare unit not found' }, { status: 404 });
    }

    const ownership = await db.timeshareOwnership.create({
      data: {
        tenantId: user.tenantId,
        unitId,
        ownerId: ownerId || null,
        ownerName,
        ownerEmail: ownerEmail || null,
        ownerPhone: ownerPhone || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        purchasePrice: parseFloat(purchasePrice),
        annualMf: parseFloat(annualMf) || 0,
        status: status || 'active',
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: ownership.id,
        ...ownership,
        startDate: ownership.startDate.toISOString(),
        endDate: ownership.endDate?.toISOString(),
        createdAt: ownership.createdAt.toISOString(),
        updatedAt: ownership.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating timeshare ownership:', error);
    return NextResponse.json({ success: false, error: 'Failed to create timeshare ownership' }, { status: 500 });
  }
}
