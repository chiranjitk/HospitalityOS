import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/marketing/upsell/offers — list upsell offers
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const offerType = searchParams.get('offerType');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (campaignId) where.campaignId = campaignId;
    if (offerType) where.offerType = offerType;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const offers = await db.upsellOffer.findMany({
      where,
      include: { upsellCampaign: { select: { name: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: offers });
  } catch (error) {
    console.error('Error listing upsell offers:', error);
    return NextResponse.json({ success: false, error: 'Failed to list offers' }, { status: 500 });
  }
}

// POST /api/marketing/upsell/offers — create an upsell offer
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['marketing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { campaignId, name, description, offerType, originalPrice, upsellPrice, discount, availability, maxQuantity, sortOrder } = body;

    if (!campaignId || !name) {
      return NextResponse.json({ success: false, error: 'campaignId and name are required' }, { status: 400 });
    }

    const offer = await db.upsellOffer.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        name,
        description: description ?? null,
        offerType: offerType ?? 'upgrade',
        originalPrice: originalPrice ?? 0,
        upsellPrice: upsellPrice ?? 0,
        discount: discount ?? 0,
        availability: availability ?? 'always',
        maxQuantity: maxQuantity ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: offer }, { status: 201 });
  } catch (error) {
    console.error('Error creating upsell offer:', error);
    return NextResponse.json({ success: false, error: 'Failed to create offer' }, { status: 500 });
  }
}
