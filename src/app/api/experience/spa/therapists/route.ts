import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/spa/therapists
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    const where: any = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const therapists = await db.spaTherapist.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: therapists });
  } catch (error) {
    console.error('Error fetching spa therapists:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch therapists' }, { status: 500 });
  }
}

// POST /api/experience/spa/therapists
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
    const { name, phone, email, specializations, certifications, commissionRate, rating, status, propertyId } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Missing required field: name' }, { status: 400 });
    }

    // Validate commissionRate 0-100
    if (commissionRate !== undefined && commissionRate !== null) {
      const parsedCommission = parseFloat(commissionRate);
      if (parsedCommission < 0 || parsedCommission > 100) {
        return NextResponse.json({ success: false, error: 'commissionRate must be between 0 and 100' }, { status: 400 });
      }
    }

    // Validate rating 0-5
    if (rating !== undefined && rating !== null) {
      const parsedRating = parseFloat(rating);
      if (parsedRating < 0 || parsedRating > 5) {
        return NextResponse.json({ success: false, error: 'rating must be between 0 and 5' }, { status: 400 });
      }
    }

    const therapist = await db.spaTherapist.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        phone: phone || null,
        email: email || null,
        specializations: specializations ? JSON.stringify(specializations) : '[]',
        certifications: certifications ? JSON.stringify(certifications) : '[]',
        commissionRate: commissionRate ? parseFloat(commissionRate) : 0,
        rating: rating ? parseFloat(rating) : 0,
        status: status || 'available',
      },
    });

    return NextResponse.json({ success: true, data: therapist }, { status: 201 });
  } catch (error) {
    console.error('Error creating spa therapist:', error);
    return NextResponse.json({ success: false, error: 'Failed to create therapist' }, { status: 500 });
  }
}
