import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/staff/payroll/calendar — List payroll calendar entries (monthly processing schedule)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['staff.view', 'payroll.view', 'payroll.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || new Date().getFullYear().toString(), 10);

    // Generate payroll calendar for all 12 months of the given year
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const targetYear = year || currentYear;

    // Get total staff count for the tenant
    const totalEmployees = await db.user.count({
      where: { tenantId: user.tenantId, deletedAt: null, status: 'active' },
    });

    // Generate calendar entries
    const calendar = months.map((monthName, monthIndex) => {
      const isCurrentYear = targetYear === currentYear;
      const isPast = isCurrentYear && monthIndex < currentMonth;
      const isCurrent = isCurrentYear && monthIndex === currentMonth;
      const isFuture = isCurrentYear && monthIndex > currentMonth;
      const isDifferentYear = targetYear !== currentYear;
      const isPastYear = isDifferentYear && targetYear < currentYear;

      let status: 'completed' | 'in_progress' | 'upcoming';
      if (isPast || isPastYear) {
        status = 'completed';
      } else if (isCurrent) {
        status = 'in_progress';
      } else {
        status = 'upcoming';
      }

      // Calculate processing date (25th of each month) and payment date (last day)
      const processingDate = new Date(targetYear, monthIndex, 25);
      const paymentDate = new Date(targetYear, monthIndex + 1, 0); // Last day of month

      const formatPaymentDate = (d: Date) => {
        const shortMonth = months[monthIndex].substring(0, 3);
        return `${d.getDate()} ${shortMonth} ${targetYear}`;
      };

      const monthKey = `${targetYear}-${String(monthIndex + 1).padStart(2, '0')}`;

      return {
        month: `${monthName} ${targetYear}`,
        monthKey,
        status,
        processingDate: formatPaymentDate(processingDate),
        paymentDate: formatPaymentDate(paymentDate),
        totalEmployees,
        totalNetPay: 0, // Populated from actual payroll data if available
      };
    });

    // Add summary stats
    const completedCount = calendar.filter((c) => c.status === 'completed').length;
    const inProgressCount = calendar.filter((c) => c.status === 'in_progress').length;
    const upcomingCount = calendar.filter((c) => c.status === 'upcoming').length;

    return NextResponse.json({
      success: true,
      data: calendar,
      stats: {
        totalMonths: 12,
        completed: completedCount,
        inProgress: inProgressCount,
        upcoming: upcomingCount,
        year: targetYear,
      },
    });
  } catch (error) {
    console.error('GET /api/staff/payroll/calendar:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payroll calendar' }, { status: 500 });
  }
}
