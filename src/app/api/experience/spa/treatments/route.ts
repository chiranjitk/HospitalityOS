import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/spa/treatments
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.view', 'experience.spa', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    const where: any = { tenantId: user.tenantId };
    if (category && category !== 'all') where.category = category;
    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (propertyId) where.propertyId = propertyId;

    const treatments = await db.spaTreatment.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: treatments });
  } catch (error) {
    console.error('Error fetching spa treatments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch treatments' }, { status: 500 });
  }
}

// POST /api/experience/spa/treatments
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.spa', 'experience.manage', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, durationMinutes, price, currency, maxGuests, isActive, propertyId } = body;

    if (!name || !category || !durationMinutes || price === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, category, durationMinutes, price' }, { status: 400 });
    }

    // Validate price >= 0
    if (parseFloat(price) < 0) {
      return NextResponse.json({ success: false, error: 'Price must be >= 0' }, { status: 400 });
    }

    // Validate maxGuests 1-50
    if (maxGuests !== undefined && (maxGuests < 1 || maxGuests > 50)) {
      return NextResponse.json({ success: false, error: 'maxGuests must be between 1 and 50' }, { status: 400 });
    }

    const treatment = await db.spaTreatment.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        category,
        durationMinutes,
        price: parseFloat(price),
        currency: currency || 'USD',
        maxGuests: maxGuests || 1,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ success: true, data: treatment }, { status: 201 });
  } catch (error) {
    console.error('Error creating spa treatment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create treatment' }, { status: 500 });
  }
}
