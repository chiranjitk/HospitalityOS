import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/golf/tee-times
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
    const courseId = searchParams.get('courseId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    const where: any = { tenantId: user.tenantId };
    if (courseId) where.courseId = courseId;
    if (status && status !== 'all') where.status = status;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const teeTimes = await db.golfTeeTime.findMany({
      where,
      include: {
        golfCourse: { select: { id: true, name: true, holes: true, par: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ success: true, data: teeTimes });
  } catch (error) {
    console.error('Error fetching golf tee times:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tee times' }, { status: 500 });
  }
}

// POST /api/experience/golf/tee-times
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
    const { courseId, guestId, bookingId, date, startTime, endTime, players, maxPlayers, holes, greenFee, cartFee, clubRentalFee, totalAmount, status, guestName, guestPhone, notes } = body;

    if (!courseId || !date || !startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'Missing required fields: courseId, date, startTime, endTime' }, { status: 400 });
    }

    // Validate endTime > startTime
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return NextResponse.json({ success: false, error: 'endTime must be after startTime' }, { status: 400 });
    }

    // Double-booking check: same course + date + overlapping time
    const overlappingTeeTimes = await db.golfTeeTime.findMany({
      where: {
        courseId,
        date: new Date(date),
        status: { notIn: ['cancelled'] },
        startTime: { lt: end },
        endTime: { gt: start },
        tenantId: user.tenantId,
      },
    });
    if (overlappingTeeTimes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Course already has a booking overlapping this time slot. Conflicting tee time(s): ${overlappingTeeTimes.length}`,
      }, { status: 409 });
    }

    const teeTime = await db.golfTeeTime.create({
      data: {
        tenantId: user.tenantId,
        courseId,
        guestId: guestId || null,
        bookingId: bookingId || null,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        players: players || 1,
        maxPlayers: maxPlayers || 4,
        holes: holes || 18,
        greenFee: greenFee ? parseFloat(greenFee) : 0,
        cartFee: cartFee ? parseFloat(cartFee) : 0,
        clubRentalFee: clubRentalFee ? parseFloat(clubRentalFee) : 0,
        totalAmount: totalAmount ? parseFloat(totalAmount) : 0,
        status: status || 'available',
        guestName: guestName || null,
        guestPhone: guestPhone || null,
        notes: notes || null,
      },
      include: {
        golfCourse: { select: { id: true, name: true, holes: true, par: true } },
      },
    });

    return NextResponse.json({ success: true, data: teeTime }, { status: 201 });
  } catch (error) {
    console.error('Error creating golf tee time:', error);
    return NextResponse.json({ success: false, error: 'Failed to create tee time' }, { status: 500 });
  }
}
