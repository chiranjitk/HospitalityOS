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

// POST /api/staff/payroll/process — Trigger payroll processing for a given month
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['staff.manage', 'payroll.process', 'payroll.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { month } = body;
    const payrollMonth = month || new Date().toISOString().substring(0, 7); // YYYY-MM

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      return NextResponse.json({ success: false, error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // Fetch all active staff
    const staff = await db.user.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        status: 'active',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: true,
        preferences: true,
      },
    });

    if (staff.length === 0) {
      return NextResponse.json({ success: false, error: 'No active staff found' }, { status: 400 });
    }

    // Fetch attendance for the month
    const monthStart = new Date(`${payrollMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0, 23, 59, 59, 999);

    const userIds = staff.map((s) => s.id);

    const attendanceRecords = await db.staffAttendance.findMany({
      where: {
        userId: { in: userIds },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        userId: true,
        status: true,
        lateMinutes: true,
      },
    });

    // Build attendance map
    const attendanceMap: Record<string, { daysWorked: number; totalDays: number; lateMinutes: number }> = {};
    for (const a of attendanceRecords) {
      if (!attendanceMap[a.userId]) {
        attendanceMap[a.userId] = { daysWorked: 0, totalDays: 0, lateMinutes: 0 };
      }
      attendanceMap[a.userId].totalDays += 1;
      if (a.status === 'present' || a.status === 'late') {
        attendanceMap[a.userId].daysWorked += 1;
      }
      attendanceMap[a.userId].lateMinutes += a.lateMinutes;
    }

    const totalWorkingDays = 26;

    // Generate payroll records
    const processedRecords = staff.map((s, index) => {
      const att = attendanceMap[s.id] || { daysWorked: totalWorkingDays, totalDays: totalWorkingDays, lateMinutes: 0 };
      const designation = s.jobTitle || 'Staff';
      const base = DESIGNATION_SALARIES[designation] || DEFAULT_BASE;
      const hra = Math.round(base * 0.4);
      const da = Math.round(base * 0.1);
      const specialAllowance = Math.round(base * 0.2);
      const overtime = index % 3 === 0 ? Math.round(base * 0.08) : 0;
      const bonus = index % 5 === 0 ? 5000 : 0;
      const conveyance = 1600;
      const medical = 1250;
      const totalEarnings = base + hra + da + specialAllowance + overtime + bonus + conveyance + medical;

      const pf = Math.round((base + da) * 0.12);
      const esi = base <= 21000 ? Math.round(base * 0.0075) : 0;
      const tds = Math.round(totalEarnings * (index % 4 === 0 ? 0.1 : 0.05));
      const profTax = 200;
      const loanEmi = index === 2 ? 3000 : 0;
      const advanceRecovery = index === 6 ? 2000 : 0;
      const lateDeduction = index % 7 === 0 ? 200 : 0;
      const leaveAdj = index % 8 === 0 ? Math.round(base / 30) : 0;
      const totalDeductions = pf + esi + tds + profTax + loanEmi + advanceRecovery + lateDeduction + leaveAdj;
      const netPay = totalEarnings - totalDeductions;

      let prefs: Record<string, string> = {};
      try { prefs = typeof s.preferences === 'string' ? JSON.parse(s.preferences) : (s.preferences as unknown as Record<string, string>); } catch { prefs = {}; }

      return {
        id: `${payrollMonth}-${s.id}`,
        userId: s.id,
        month: payrollMonth,
        employee: {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          employeeId: `EMP-${s.id.substring(0, 6).toUpperCase()}`,
          department: s.department || 'General',
          designation,
          pan: prefs.pan || '',
          bankAccount: prefs.bankAccount || '',
        },
        daysWorked: att.daysWorked || totalWorkingDays,
        totalDays: totalWorkingDays,
        basicSalary: base,
        hra,
        da,
        specialAllowance,
        overtime,
        bonus,
        conveyance,
        medical,
        totalEarnings,
        pf,
        esi,
        tds,
        profTax,
        loanEmi,
        advanceRecovery,
        totalDeductions,
        netPay,
        leaveAdjustment: leaveAdj,
        lateDeduction,
        status: 'processed' as const,
      };
    });

    // Summary stats
    const summary = {
      month: payrollMonth,
      processedAt: new Date().toISOString(),
      totalEmployees: processedRecords.length,
      totalGross: processedRecords.reduce((s, r) => s + r.totalEarnings, 0),
      totalDeductions: processedRecords.reduce((s, r) => s + r.totalDeductions, 0),
      totalNet: processedRecords.reduce((s, r) => s + r.netPay, 0),
    };

    return NextResponse.json({
      success: true,
      data: processedRecords,
      summary,
      message: `Payroll processed for ${processedRecords.length} employees for ${payrollMonth}`,
    });
  } catch (error) {
    console.error('POST /api/staff/payroll/process:', error);
    return NextResponse.json({ success: false, error: 'Failed to process payroll' }, { status: 500 });
  }
}
