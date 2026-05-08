import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/marketing/upsell/campaigns — list upsell campaigns
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
    const status = searchParams.get('status');
    const campaignType = searchParams.get('campaignType');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (campaignType) where.campaignType = campaignType;

    const campaigns = await db.upsellCampaign.findMany({
      where,
      include: { offers: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Error listing upsell campaigns:', error);
    return NextResponse.json({ success: false, error: 'Failed to list campaigns' }, { status: 500 });
  }
}

// POST /api/marketing/upsell/campaigns — create an upsell campaign
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
    const { name, description, campaignType, triggerDaysBefore, targetSegment, propertyId, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const campaign = await db.upsellCampaign.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description ?? null,
        campaignType: campaignType ?? 'pre_arrival',
        triggerDaysBefore: triggerDaysBefore ?? null,
        targetSegment: JSON.stringify(targetSegment ?? []),
        propertyId: propertyId ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'draft',
      },
    });

    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (error) {
    console.error('Error creating upsell campaign:', error);
    return NextResponse.json({ success: false, error: 'Failed to create campaign' }, { status: 500 });
  }
}
