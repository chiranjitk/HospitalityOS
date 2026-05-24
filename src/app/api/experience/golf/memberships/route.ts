import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/golf/memberships
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.view', 'experience.golf', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const membershipType = searchParams.get('membershipType');
    const propertyId = searchParams.get('propertyId');
    const search = searchParams.get('search');
    const guestId = searchParams.get('guestId');

    const where: any = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (membershipType) where.membershipType = membershipType;
    if (propertyId) where.propertyId = propertyId;
    if (guestId) where.guestId = guestId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const memberships = await db.golfMembership.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: memberships });
  } catch (error) {
    console.error('Error fetching golf memberships:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch memberships' }, { status: 500 });
  }
}

// POST /api/experience/golf/memberships
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.golf', 'experience.manage', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { guestId, membershipType, name, startDate, endDate, monthlyFee, joiningFee, totalPaid, status, autoRenew, benefits, notes, propertyId } = body;

    if (!name || !startDate || !endDate || !propertyId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, startDate, endDate, propertyId' }, { status: 400 });
    }

    // Validate all fee values >= 0
    if (monthlyFee !== undefined && parseFloat(monthlyFee) < 0) {
      return NextResponse.json({ success: false, error: 'monthlyFee must be >= 0' }, { status: 400 });
    }
    if (joiningFee !== undefined && parseFloat(joiningFee) < 0) {
      return NextResponse.json({ success: false, error: 'joiningFee must be >= 0' }, { status: 400 });
    }
    if (totalPaid !== undefined && parseFloat(totalPaid) < 0) {
      return NextResponse.json({ success: false, error: 'totalPaid must be >= 0' }, { status: 400 });
    }

    const membership = await db.golfMembership.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        guestId: guestId || null,
        membershipType: membershipType || 'annual',
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyFee: monthlyFee ? parseFloat(monthlyFee) : 0,
        joiningFee: joiningFee ? parseFloat(joiningFee) : 0,
        totalPaid: totalPaid ? parseFloat(totalPaid) : 0,
        status: status || 'active',
        autoRenew: autoRenew || false,
        benefits: benefits ? JSON.stringify(benefits) : '{}',
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, data: membership }, { status: 201 });
  } catch (error) {
    console.error('Error creating golf membership:', error);
    return NextResponse.json({ success: false, error: 'Failed to create membership' }, { status: 500 });
  }
}
