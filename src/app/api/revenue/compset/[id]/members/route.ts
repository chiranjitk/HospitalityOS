import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/revenue/compset/[id]/members - List all members with latest price data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    // Verify compset exists
    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { propertyId: true },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    const members = await db.compSetMember.findMany({
      where: { competitiveSetId: id, tenantId: ctx.tenantId },
      orderBy: { sortOrder: 'asc' },
    });

    // Get latest price data for each member
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const memberNames = members.map((m) => m.hotelName);
    const recentPrices = await db.competitorPrice.findMany({
      where: {
        tenantId: ctx.tenantId,
        propertyId: compSet.propertyId,
        competitorName: { in: memberNames },
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    // Build latest price map
    const latestPriceMap = new Map<string, { price: number; date: Date }>();
    for (const price of recentPrices) {
      if (!latestPriceMap.has(price.competitorName)) {
        latestPriceMap.set(price.competitorName, {
          price: price.price,
          date: price.date,
        });
      }
    }

    const enrichedMembers = members.map((m) => {
      const latestPrice = latestPriceMap.get(m.hotelName);
      return {
        ...m,
        latestPrice: latestPrice?.price ?? null,
        latestPriceDate: latestPrice?.date?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, data: enrichedMembers });
  } catch (error) {
    console.error('Error fetching compset members:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch members' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/compset/[id]/members - Add member(s)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const body = await request.json();

    // Verify compset exists
    const compSet = await db.competitiveSet.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!compSet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Competitive set not found' } },
        { status: 404 }
      );
    }

    // Support single or batch
    const membersData = Array.isArray(body) ? body : [body];

    // Validate members
    for (const member of membersData) {
      if (!member.hotelName || typeof member.hotelName !== 'string') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Each member must have a hotelName' } },
          { status: 400 }
        );
      }
    }

    // Get current max sort order
    const maxSortOrder = await db.compSetMember.findFirst({
      where: { competitiveSetId: id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    let nextSortOrder = (maxSortOrder?.sortOrder || 0) + 1;

    // Create members
    const createdMembers = await Promise.all(
      membersData.map((member: Record<string, unknown>) =>
        db.compSetMember.create({
          data: {
            tenantId: ctx.tenantId,
            competitiveSetId: id,
            hotelName: member.hotelName as string,
            hotelCode: (member.hotelCode as string) || null,
            starRating: (member.starRating as number) || null,
            totalRooms: (member.totalRooms as number) || null,
            proximityKm: (member.proximityKm as number) || null,
            channel: (member.channel as string) || 'direct',
            competitorId: (member.competitorId as string) || null,
            url: (member.url as string) || null,
            sortOrder: nextSortOrder++,
          },
        })
      )
    );

    return NextResponse.json({ success: true, data: createdMembers }, { status: 201 });
  } catch (error) {
    console.error('Error adding compset members:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add members' } },
      { status: 500 }
    );
  }
}

// PUT /api/revenue/compset/[id]/members - Update member details
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id: competitiveSetId } = await params;
    const body = await request.json();
    const { memberId, hotelName, hotelCode, starRating, totalRooms, proximityKm, channel, url, sortOrder } = body;

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'memberId is required' } },
        { status: 400 }
      );
    }

    // Verify member exists in this compset
    const existing = await db.compSetMember.findFirst({
      where: { id: memberId, competitiveSetId, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found in this competitive set' } },
        { status: 404 }
      );
    }

    const updated = await db.compSetMember.update({
      where: { id: memberId },
      data: {
        ...(hotelName !== undefined && { hotelName }),
        ...(hotelCode !== undefined && { hotelCode }),
        ...(starRating !== undefined && { starRating }),
        ...(totalRooms !== undefined && { totalRooms }),
        ...(proximityKm !== undefined && { proximityKm }),
        ...(channel !== undefined && { channel }),
        ...(url !== undefined && { url }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating compset member:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update member' } },
      { status: 500 }
    );
  }
}

// DELETE /api/revenue/compset/[id]/members - Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { id: competitiveSetId } = await params;
    const { searchParams } = request.nextUrl;
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'memberId is required' } },
        { status: 400 }
      );
    }

    // Verify member exists
    const existing = await db.compSetMember.findFirst({
      where: { id: memberId, competitiveSetId, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    await db.compSetMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Member removed' },
    });
  } catch (error) {
    console.error('Error removing compset member:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}
