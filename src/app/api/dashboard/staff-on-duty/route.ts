import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const now = new Date();

    // Find users who are currently on duty (shifts that overlap with now)
    // Note: startTime and endTime are String fields (e.g. "09:00"), so we compare today's shifts
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM

    const activeSchedules = await db.staffSchedule.findMany({
      where: {
        tenantId,
        status: 'scheduled',
        date: {
          gte: new Date(todayStr + 'T00:00:00.000Z'),
          lt: new Date(todayStr + 'T23:59:59.999Z'),
        },
        startTime: { lte: currentTimeStr },
        endTime: { gte: currentTimeStr },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
            department: true,
          },
        },
        shiftTemplate: {
          select: {
            name: true,
            shiftType: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    const staffOnDuty = activeSchedules.map((schedule) => {
      const firstName = schedule.user.firstName || '';
      const lastName = schedule.user.lastName || '';
      return {
        id: schedule.userId,
        name: `${firstName} ${lastName}`.trim(),
        avatar: schedule.user.avatar,
        initials: `${firstName[0] || ''}${lastName[0] || ''}`,
        role: schedule.user.jobTitle || schedule.department || schedule.shiftTemplate?.name || 'Staff',
        shiftStart: schedule.startTime,
        shiftEnd: schedule.endTime,
        department: schedule.department || null,
        shiftType: schedule.shiftTemplate?.shiftType || 'regular',
        isOnline: schedule.status === 'scheduled',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        staff: staffOnDuty,
        totalOnDuty: staffOnDuty.length,
      },
    });
  } catch (error) {
    console.error('[Staff On-Duty API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch staff on duty' } },
      { status: 500 }
    );
  }
}
