import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

const MAX_LIMIT = 100;

// GET - List campaigns with pagination, filters, search
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const slot = searchParams.get('slot') || '';
    const advertiser = searchParams.get('advertiser') || '';
    const startDateFrom = searchParams.get('startDateFrom') || '';
    const startDateTo = searchParams.get('startDateTo') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), MAX_LIMIT);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (slot) where.slot = slot;
    if (advertiser) where.advertiser = { contains: advertiser };
    if (startDateFrom || startDateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (startDateFrom) dateFilter.gte = new Date(startDateFrom);
      if (startDateTo) dateFilter.lte = new Date(startDateTo);
      where.startDate = dateFilter;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { advertiser: { contains: search } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      db.portalAdCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.portalAdCampaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching ad campaigns:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ad campaigns' } },
      { status: 500 }
    );
  }
}

// POST - Create campaign with validation
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign name is required' } },
        { status: 400 }
      );
    }
    if (!body.advertiser?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Advertiser is required' } },
        { status: 400 }
      );
    }
    if (!body.creativeUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Creative URL is required' } },
        { status: 400 }
      );
    }

    // Validate creativeType
    const validCreativeTypes = ['image', 'video', 'html'];
    const creativeType = body.creativeType || 'image';
    if (!validCreativeTypes.includes(creativeType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid creative type. Must be image, video, or html' } },
        { status: 400 }
      );
    }

    // Validate slot
    const validSlots = ['banner', 'interstitial', 'footer', 'sidebar'];
    const slot = body.slot || 'banner';
    if (!validSlots.includes(slot)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid slot. Must be banner, interstitial, footer, or sidebar' } },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'paused', 'completed'];
    const status = body.status || 'active';
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
        { status: 400 }
      );
    }

    // Validate dates
    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date and end date are required' } },
        { status: 400 }
      );
    }
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (start >= end) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date must be before end date' } },
        { status: 400 }
      );
    }

    // Validate budget
    if (body.maxBudget !== undefined && body.maxBudget !== null && body.maxBudget < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Max budget cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate priority
    if (body.priority !== undefined && body.priority !== null && body.priority < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Priority cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate targeting JSON if provided
    let targeting = '{}';
    if (body.targeting) {
      try {
        if (typeof body.targeting === 'string') {
          JSON.parse(body.targeting);
          targeting = body.targeting;
        } else {
          targeting = JSON.stringify(body.targeting);
        }
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Targeting must be valid JSON' } },
          { status: 400 }
        );
      }
    }

    const campaign = await db.portalAdCampaign.create({
      data: {
        tenantId,
        name: body.name.trim(),
        advertiser: body.advertiser.trim(),
        creativeUrl: body.creativeUrl.trim(),
        creativeType,
        linkUrl: body.linkUrl?.trim() || null,
        slot,
        priority: body.priority ?? 0,
        status,
        startDate: start,
        endDate: end,
        maxBudget: body.maxBudget ?? null,
        targeting,
      },
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error creating ad campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create ad campaign' } },
      { status: 500 }
    );
  }
}
