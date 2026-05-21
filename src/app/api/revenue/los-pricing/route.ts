import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// Default LOS tiers if none exist for a room type
const DEFAULT_LOS_TIERS = [
  { minNights: 1, maxNights: 2, label: '1-2 nights', discountPercent: 0 },
  { minNights: 3, maxNights: 5, label: '3-5 nights', discountPercent: 5 },
  { minNights: 6, maxNights: 7, label: '6-7 nights', discountPercent: 10 },
  { minNights: 8, maxNights: 14, label: '8-14 nights', discountPercent: 15 },
  { minNights: 15, maxNights: 21, label: '15-21 nights', discountPercent: 20 },
  { minNights: 22, maxNights: null, label: '22+ nights', discountPercent: 25 },
];

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');

    if (!propertyId || !roomTypeId) {
      return NextResponse.json(
        { success: false, error: 'propertyId and roomTypeId are required' },
        { status: 400 }
      );
    }

    // Fetch existing tiers
    let tiers = await db.losPricingTier.findMany({
      where: {
        tenantId,
        propertyId,
        roomTypeId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Return defaults if no tiers configured
    if (tiers.length === 0) {
      tiers = DEFAULT_LOS_TIERS.map((t, i) => ({
        id: `default-${i}`,
        tenantId,
        propertyId,
        roomTypeId,
        minNights: t.minNights,
        maxNights: t.maxNights,
        label: t.label,
        discountPercent: t.discountPercent,
        isActive: true,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    return NextResponse.json({ success: true, data: tiers });
  } catch (error) {
    console.error('Error fetching LOS pricing tiers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch LOS tiers' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const body = await request.json();
    const { propertyId, roomTypeId, tiers } = body;

    if (!propertyId || !roomTypeId || !Array.isArray(tiers)) {
      return NextResponse.json(
        { success: false, error: 'propertyId, roomTypeId, and tiers array are required' },
        { status: 400 }
      );
    }

    // Validate tiers
    for (const tier of tiers) {
      if (typeof tier.minNights !== 'number' || tier.minNights < 1) {
        return NextResponse.json(
          { success: false, error: 'Each tier must have a valid minNights >= 1' },
          { status: 400 }
        );
      }
      if (typeof tier.discountPercent !== 'number' || tier.discountPercent < 0) {
        return NextResponse.json(
          { success: false, error: 'Each tier must have a valid discountPercent >= 0' },
          { status: 400 }
        );
      }
    }

    // Delete existing tiers and create new ones
    await db.losPricingTier.deleteMany({
      where: { tenantId, propertyId, roomTypeId },
    });

    const created = await db.losPricingTier.createMany({
      data: tiers.map((tier: Record<string, unknown>, index: number) => ({
        tenantId,
        propertyId,
        roomTypeId,
        minNights: tier.minNights as number,
        maxNights: (tier.maxNights as number) || null,
        label: (tier.label as string) || `${tier.minNights}+ nights`,
        discountPercent: tier.discountPercent as number,
        isActive: tier.isActive !== false,
        sortOrder: index,
      })),
    });

    return NextResponse.json({
      success: true,
      data: { created: created.count },
      message: `Updated ${created.count} LOS pricing tiers`,
    });
  } catch (error) {
    console.error('Error updating LOS pricing tiers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update LOS tiers' },
      { status: 500 }
    );
  }
}
