import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// Salary base rates by designation (INR)
const DESIGNATION_SALARIES: Record<string, number> = {
  'Front Desk Manager': 45000,
  'Receptionist': 22000,
  'HK Supervisor': 28000,
  'Room Attendant': 16000,
  'F&B Manager': 50000,
  'Captain': 24000,
  'Executive Chef': 75000,
  'Sous Chef': 42000,
  'Maintenance Lead': 30000,
  'Security Officer': 25000,
  'Spa Manager': 40000,
  'Accounts Manager': 48000,
  'Steward': 18000,
  'Commis Chef': 20000,
  'Concierge': 26000,
  'Electrician': 22000,
  'Therapist': 28000,
};

const DEFAULT_BASE = 25000;

// GET /api/staff/payroll/payslips/[id] — Get individual payslip detail with full breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['staff.view', 'payroll.view', 'payroll.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // The id format is "YYYY-MM-userId" — extract userId and month
    const parts = id.split('-');
    let userId: string;
    let month: string;

    if (parts.length >= 9) {
      // UUID format: YYYY-MM-{uuid}
      month = `${parts[0]}-${parts[1]}`;
      userId = parts.slice(2).join('-');
    } else {
      // Fallback: treat entire id as userId
      userId = id;
      month = new Date().toISOString().substring(0, 7);
    }

    // Fetch the staff user
    const staffUser = await db.user.findFirst({
      where: { id: userId, tenantId: user.tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        department: true,
        preferences: true,
        createdAt: true,
        tenant: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    if (!staffUser) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    // Parse preferences
    let prefs: Record<string, string> = {};
    try { prefs = typeof staffUser.preferences === 'string' ? JSON.parse(staffUser.preferences) : (staffUser.preferences as unknown as Record<string, string>); } catch { prefs = {}; }

    // Fetch attendance for the month
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0, 23, 59, 59, 999);

    const attendanceRecords = await db.staffAttendance.findMany({
      where: {
        userId,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        status: true,
        lateMinutes: true,
        date: true,
      },
    });

    const daysWorked = attendanceRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
    const totalDays = attendanceRecords.length || 26;
    const lateMinutes = attendanceRecords.reduce((s, a) => s + a.lateMinutes, 0);
    const leaveDays = totalDays - daysWorked;

    // Calculate salary
    const designation = staffUser.jobTitle || 'Staff';
    const base = DESIGNATION_SALARIES[designation] || DEFAULT_BASE;
    const hra = Math.round(base * 0.4);
    const da = Math.round(base * 0.1);
    const specialAllowance = Math.round(base * 0.2);
    const overtime = 0;
    const bonus = 0;
    const conveyance = 1600;
    const medical = 1250;
    const totalEarnings = base + hra + da + specialAllowance + overtime + bonus + conveyance + medical;

    const pf = Math.round((base + da) * 0.12);
    const esi = base <= 21000 ? Math.round(base * 0.0075) : 0;
    const tds = Math.round(totalEarnings * 0.05);
    const profTax = 200;
    const loanEmi = 0;
    const advanceRecovery = 0;
    const lateDeduction = lateMinutes > 30 ? 200 : 0;
    const leaveAdjustment = leaveDays > 0 ? Math.round(base / 30) * leaveDays : 0;
    const totalDeductions = pf + esi + tds + profTax + loanEmi + advanceRecovery + lateDeduction + leaveAdjustment;
    const netPay = totalEarnings - totalDeductions;

    // Build payslip
    const payslip = {
      id: `${month}-${userId}`,
      userId,
      month,
      generatedAt: new Date().toISOString(),
      company: {
        name: staffUser.tenant?.name || 'StaySuite Hotel',
        address: staffUser.tenant?.address || '',
      },
      employee: {
        id: userId,
        name: `${staffUser.firstName} ${staffUser.lastName}`,
        employeeId: `EMP-${userId.substring(0, 6).toUpperCase()}`,
        email: staffUser.email || '',
        phone: staffUser.phone || '',
        department: staffUser.department || 'General',
        designation,
        dateOfJoining: staffUser.createdAt?.toISOString().split('T')[0],
        pan: prefs.pan || '',
        bankAccount: prefs.bankAccount || '',
      },
      attendance: {
        daysWorked,
        totalDays,
        leaveDays,
        lateMinutes,
        paidDays: daysWorked,
      },
      earnings: {
        basicSalary: base,
        hra,
        da,
        specialAllowance,
        overtime,
        bonus,
        conveyance,
        medical,
        totalEarnings,
      },
      deductions: {
        pf,
        esi,
        tds,
        profTax,
        loanEmi,
        advanceRecovery,
        lateDeduction,
        leaveAdjustment,
        totalDeductions,
      },
      netPay,
      yearToDate: {
        gross: totalEarnings * 1, // Would aggregate from all months
        deductions: totalDeductions * 1,
        net: netPay * 1,
      },
    };

    return NextResponse.json({ success: true, data: payslip });
  } catch (error) {
    console.error('GET /api/staff/payroll/payslips/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payslip' }, { status: 500 });
  }
}
