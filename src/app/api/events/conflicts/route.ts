import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/events/conflicts - Check for scheduling conflicts
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'events.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const eventSpaceId = searchParams.get('eventSpaceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const excludeEventId = searchParams.get('excludeEventId');

    if (!eventSpaceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: eventSpaceId, startDate, endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 dates.' },
        { status: 400 }
      );
    }

    // Find overlapping events in the same space
    // Two events overlap if: existingStart < newEnd AND existingEnd > newStart
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      spaceId: eventSpaceId,
      status: { notIn: ['cancelled'] },
      startDate: { lt: end },
      endDate: { gt: start },
    };

    if (excludeEventId) {
      where.id = { not: excludeEventId };
    }

    const conflicts = await db.event.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({
      conflicts,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
    });
  } catch (error) {
    console.error('Error checking event conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to check scheduling conflicts' },
      { status: 500 }
    );
  }
}
