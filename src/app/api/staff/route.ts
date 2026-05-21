import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff - Staff management module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'staff.*') && !hasPermission(user, 'users.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'staff',
        description: 'Staff management module for tasks, attendance, leave, performance, payroll, shifts, and communication',
        endpoints: {
          tasks: '/api/staff/tasks',
          taskById: '/api/staff/tasks/[id]',
          attendance: '/api/staff/attendance',
          leave: '/api/staff/leave',
          performance: '/api/staff/performance',
          payroll: '/api/staff/payroll',
          payrollProcess: '/api/staff/payroll/process',
          payrollPayslips: '/api/staff/payroll/payslips/[id]',
          payrollCompliance: '/api/staff/payroll/compliance',
          payrollCalendar: '/api/staff/payroll/calendar',
          channels: '/api/staff/channels',
          channelMessages: '/api/staff/channels/[id]/messages',
          shifts: '/api/staff/shifts',
          shiftById: '/api/staff/shifts/[id]',
        },
      },
      message: 'Staff module — explore the endpoints above for tasks, attendance, payroll, shifts, and more',
    });
  } catch (error) {
    console.error('Staff overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch staff overview' } },
      { status: 500 }
    );
  }
}
