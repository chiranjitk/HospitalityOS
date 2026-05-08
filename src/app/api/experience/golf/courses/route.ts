import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/golf/courses
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
    const isActive = searchParams.get('isActive');
    const propertyId = searchParams.get('propertyId');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');

    const where: any = { tenantId: user.tenantId };
    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }
    if (propertyId) where.propertyId = propertyId;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await db.golfCourse.findMany({
      where,
      include: {
        _count: { select: { teeTimes: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('Error fetching golf courses:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch courses' }, { status: 500 });
  }
}

// POST /api/experience/golf/courses
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
    const { name, description, holes, par, yardage, difficulty, facilities, propertyId } = body;

    if (!name || !par || !propertyId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, par, propertyId' }, { status: 400 });
    }

    const course = await db.golfCourse.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        description: description || null,
        holes: holes || 18,
        par,
        yardage: yardage || null,
        difficulty: difficulty || 'moderate',
        facilities: facilities ? JSON.stringify(facilities) : '{}',
      },
    });

    return NextResponse.json({ success: true, data: course }, { status: 201 });
  } catch (error) {
    console.error('Error creating golf course:', error);
    return NextResponse.json({ success: false, error: 'Failed to create course' }, { status: 500 });
  }
}
