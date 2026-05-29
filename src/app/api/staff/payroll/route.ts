import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { getWorkingDaysForMonth } from '@/lib/staff/working-days';

// Salary base rates by designation — used as defaults when no persisted salary exists
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

// Generate payroll calculation for a given user
function calculatePayroll(
  user: { id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null; preferences: string },
  attendance: { daysWorked: number; totalDays: number; lateMinutes: number },
  month: string,
  totalWorkingDays: number,
  status: 'processed' | 'pending' | 'on_hold'
) {
  const designation = user.jobTitle || 'Staff';
  const base = DESIGNATION_SALARIES[designation] || DEFAULT_BASE;
  const hra = Math.round(base * 0.4);
  const da = Math.round(base * 0.1);
  const specialAllowance = Math.round(base * 0.2);
  const overtime = 0;
  const bonus = 0;
  const conveyance = 1600;
  const medical = 1250;
  const totalEarnings = Math.round((base + hra + da + specialAllowance + overtime + bonus + conveyance + medical) * 100) / 100;

  // Deductions
  const pf = Math.round((base + da) * 0.12);
  const esi = totalEarnings <= 21000 ? Math.round(base * 0.0075) : 0;
  const tds = Math.round(totalEarnings * 0.05);
  const profTax = 200;
  const loanEmi = 0;
  const advanceRecovery = 0;
  const lateDeduction = attendance.lateMinutes > 30 ? 200 : 0;
  // Multiply leave deduction by actual absent days
  const absentDays = attendance.totalDays - attendance.daysWorked;
  const leaveAdjustment = absentDays > 0 ? Math.round(base / totalWorkingDays) * absentDays : 0;
  const totalDeductions = pf + esi + tds + profTax + loanEmi + advanceRecovery + lateDeduction + leaveAdjustment;
  const netPay = Math.round((totalEarnings - totalDeductions) * 100) / 100;

  // Parse preferences for pan/bank info
  let prefs: Record<string, string> = {};
  try { prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : (user.preferences as unknown as Record<string, string>); } catch { prefs = {}; }

  return {
    id: `${month}-${user.id}`,
    userId: user.id,
    month,
    employee: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      employeeId: `EMP-${user.id.substring(0, 6).toUpperCase()}`,
      department: user.department || 'General',
      designation,
      pan: prefs.pan || '',
      bankAccount: prefs.bankAccount || '',
    },
    daysWorked: attendance.daysWorked,
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
    leaveAdjustment,
    lateDeduction,
    status,
  };
}

// GET /api/staff/payroll — List payroll records with filters, search, pagination, summary stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['staff.view', 'staff.manage', 'staff.*', 'payroll.view', 'payroll.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const department = sp.get('department');
    const status = sp.get('status');
    const search = sp.get('search');
    const month = sp.get('month') || new Date().toISOString().substring(0, 7); // YYYY-MM

    // Validate month is not in the future
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (month > currentMonth) {
      return NextResponse.json({ success: false, error: 'Cannot fetch payroll for a future month' }, { status: 400 });
    }
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
    const offset = parseInt(sp.get('offset') || '0', 10);

    // M-72: Calculate dynamic working days for the month
    const [yearStr, monthStr] = month.split('-').map(Number);
    const totalWorkingDays = await getWorkingDaysForMonth(yearStr, monthStr, user.tenantId);

    // M-69: First check for persisted payroll records in DB
    const persistedWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
      month,
    };
    if (status && status !== 'all') persistedWhere.status = status;

    const persistedRecords = await db.payrollRecord.findMany({
      where: persistedWhere,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    });

    // If persisted records exist, return them (M-69: payroll persistence)
    if (persistedRecords.length > 0) {
      let filtered = persistedRecords;

      // Apply department and search filters on persisted records
      if (department && department !== 'all') {
        filtered = filtered.filter(r => r.user.department === department);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(r =>
          r.user.firstName.toLowerCase().includes(s) ||
          r.user.lastName.toLowerCase().includes(s) ||
          r.user.email.toLowerCase().includes(s)
        );
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      const payrollRecords = paginated.map(r => {
        const prefsStr = (r.user as unknown as { preferences?: string }).preferences || '{}';
        let prefs: Record<string, string> = {};
        try { prefs = JSON.parse(prefsStr); } catch { prefs = {}; }

        return {
          id: r.id,
          userId: r.userId,
          month: r.month,
          currency: r.currency,
          employee: {
            id: r.user.id,
            name: `${r.user.firstName} ${r.user.lastName}`,
            employeeId: `EMP-${r.user.id.substring(0, 6).toUpperCase()}`,
            department: r.user.department || 'General',
            designation: r.user.jobTitle || 'Staff',
            pan: prefs.pan || '',
            bankAccount: prefs.bankAccount || '',
          },
          daysWorked: r.daysWorked,
          totalDays: r.totalWorkingDays,
          basicSalary: r.basicSalary,
          hra: r.hra,
          da: r.da,
          specialAllowance: r.specialAllowance,
          overtime: r.overtime,
          bonus: r.bonus,
          conveyance: r.conveyance,
          medical: r.medical,
          totalEarnings: r.totalEarnings,
          pf: r.pf,
          esi: r.esi,
          tds: r.tds,
          profTax: r.profTax,
          loanEmi: r.loanEmi,
          advanceRecovery: r.advanceRecovery,
          totalDeductions: r.totalDeductions,
          netPay: r.netPay,
          leaveAdjustment: r.leaveAdjustment,
          lateDeduction: r.lateDeduction,
          status: r.status,
          processedAt: r.processedAt?.toISOString(),
        };
      });

      const allForStats = status && status !== 'all' ? filtered : persistedRecords;
      const summary = {
        totalGross: allForStats.reduce((s, r) => s + r.totalEarnings, 0),
        totalDeductions: allForStats.reduce((s, r) => s + r.totalDeductions, 0),
        totalNet: allForStats.reduce((s, r) => s + r.netPay, 0),
        processedCount: persistedRecords.filter((r) => r.status === 'processed').length,
        pendingCount: persistedRecords.filter((r) => r.status === 'pending').length,
        onHoldCount: persistedRecords.filter((r) => r.status === 'on_hold').length,
        totalEmployees: persistedRecords.length,
      };

      const deptBreakdown: Record<string, { total: number; count: number }> = {};
      for (const r of payrollRecords) {
        const dept = r.employee.department;
        if (!deptBreakdown[dept]) deptBreakdown[dept] = { total: 0, count: 0 };
        deptBreakdown[dept].total += r.netPay;
        deptBreakdown[dept].count += 1;
      }

      return NextResponse.json({
        success: true,
        data: payrollRecords,
        pagination: { total, limit, offset },
        summary,
        departmentBreakdown: deptBreakdown,
        source: 'persisted',
      });
    }

    // No persisted records — compute on the fly (preview mode)
    const userWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
      status: 'active',
    };

    if (department && department !== 'all') {
      userWhere.department = department;
    }

    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalStaff = await db.user.count({ where: userWhere });

    const staff = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: true,
        preferences: true,
        createdAt: true,
      },
      orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
      take: limit,
      skip: offset,
    });

    // Fetch attendance for the given month
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const monthEnd = new Date(yearStr, monthStr, 0, 23, 59, 59, 999);

    const userIds = staff.map((s) => s.id);

    const attendanceRecords = userIds.length > 0
      ? await db.staffAttendance.findMany({
          where: {
            userId: { in: userIds },
            date: { gte: monthStart, lte: monthEnd },
          },
          select: {
            userId: true,
            status: true,
            lateMinutes: true,
          },
        })
      : [];

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

    // Generate payroll records
    const payrollRecords = staff.map((s) => {
      const att = attendanceMap[s.id] || { daysWorked: totalWorkingDays, totalDays: totalWorkingDays, lateMinutes: 0 };
      const recordStatus: 'processed' | 'pending' | 'on_hold' = status === 'processed' ? 'processed' : status === 'on_hold' ? 'on_hold' : 'pending';
      return calculatePayroll(s, att, month, totalWorkingDays, recordStatus);
    });

    // Compute summary stats
    const allProcessed = status === 'processed' || status === null || status === 'all'
      ? payrollRecords
      : payrollRecords.filter((r) => r.status === status);

    const summary = {
      totalGross: allProcessed.reduce((s, r) => s + r.totalEarnings, 0),
      totalDeductions: allProcessed.reduce((s, r) => s + r.totalDeductions, 0),
      totalNet: allProcessed.reduce((s, r) => s + r.netPay, 0),
      processedCount: payrollRecords.filter((r) => r.status === 'processed').length,
      pendingCount: payrollRecords.filter((r) => r.status === 'pending').length,
      onHoldCount: payrollRecords.filter((r) => r.status === 'on_hold').length,
      totalEmployees: totalStaff,
    };

    // Department breakdown
    const deptBreakdown: Record<string, { total: number; count: number }> = {};
    for (const r of payrollRecords) {
      const dept = r.employee.department;
      if (!deptBreakdown[dept]) deptBreakdown[dept] = { total: 0, count: 0 };
      deptBreakdown[dept].total += r.netPay;
      deptBreakdown[dept].count += 1;
    }

    return NextResponse.json({
      success: true,
      data: payrollRecords,
      pagination: { total: totalStaff, limit, offset },
      summary,
      departmentBreakdown: deptBreakdown,
      source: 'computed',
    });
  } catch (error) {
    console.error('GET /api/staff/payroll:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payroll records' }, { status: 500 });
  }
}
