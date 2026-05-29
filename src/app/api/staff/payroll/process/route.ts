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

// In-memory idempotency tracker for payroll processing
const payrollProcessingCache = new Map<string, { status: string; startedAt: number }>();
// Clean up stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of payrollProcessingCache.entries()) {
    if (now - val.startedAt > 30 * 60 * 1000) payrollProcessingCache.delete(key);
  }
}, 30 * 60 * 1000).unref();

// POST /api/staff/payroll/process — Trigger payroll processing and persist to DB (M-69)
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
    const { month, currency, force } = body;
    const payrollMonth = month || new Date().toISOString().substring(0, 7); // YYYY-MM
    const payrollCurrency = currency || 'USD'; // M-69: no longer hardcoded to INR

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      return NextResponse.json({ success: false, error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // Idempotency check: prevent duplicate payroll processing for same tenant+month
    const cacheKey = `${user.tenantId}:${payrollMonth}`;
    const existingRun = payrollProcessingCache.get(cacheKey);
    if (existingRun && existingRun.status === 'processing') {
      return NextResponse.json({
        success: false,
        error: `Payroll for ${payrollMonth} is already being processed. Please wait.`,
        retryAfter: 30,
      }, { status: 409 });
    }

    // Check for existing persisted records (M-69)
    if (!force) {
      const existingRecords = await db.payrollRecord.findMany({
        where: { tenantId: user.tenantId, month: payrollMonth },
        take: 1,
      });
      if (existingRecords.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Payroll for ${payrollMonth} has already been processed. Use force=true to re-process.`,
          alreadyProcessed: true,
        }, { status: 409 });
      }
    }

    payrollProcessingCache.set(cacheKey, { status: 'processing', startedAt: Date.now() });

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
      payrollProcessingCache.delete(cacheKey);
      return NextResponse.json({ success: false, error: 'No active staff found' }, { status: 400 });
    }

    // Fetch attendance for the month
    const [yearStr, monthStr] = payrollMonth.split('-').map(Number);
    const monthStart = new Date(yearStr, monthStr - 1, 1);
    const monthEnd = new Date(yearStr, monthStr, 0, 23, 59, 59, 999);

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

    // M-72: Calculate total working days dynamically
    const totalWorkingDays = await getWorkingDaysForMonth(yearStr, monthStr, user.tenantId);

    // Load tenant currency as fallback
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { currency: true },
    });
    const effectiveCurrency = payrollCurrency || tenant?.currency || 'USD';

    // Generate payroll records and persist to DB (M-69)
    const processedRecords = [];

    await db.$transaction(async (tx) => {
      for (const s of staff) {
        const att = attendanceMap[s.id] || { daysWorked: totalWorkingDays, totalDays: totalWorkingDays, lateMinutes: 0 };
        const designation = s.jobTitle || 'Staff';
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
        const lateDeduction = att.lateMinutes > 30 ? 200 : 0;
        const absentDays = Math.max(0, totalWorkingDays - att.daysWorked);
        const leaveAdjustment = absentDays > 0 ? Math.round(base / totalWorkingDays) * absentDays : 0;
        const totalDeductions = pf + esi + tds + profTax + loanEmi + advanceRecovery + lateDeduction + leaveAdjustment;
        const netPay = totalEarnings - totalDeductions;

        // M-69: Persist to PayrollRecord table using upsert (supports re-processing with force=true)
        const record = await tx.payrollRecord.upsert({
          where: {
            tenantId_userId_month: {
              tenantId: user.tenantId,
              userId: s.id,
              month: payrollMonth,
            },
          },
          create: {
            tenantId: user.tenantId,
            userId: s.id,
            month: payrollMonth,
            currency: effectiveCurrency,
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
            lateDeduction,
            leaveAdjustment,
            totalDeductions,
            netPay,
            daysWorked: att.daysWorked,
            totalWorkingDays,
            status: 'processed',
            processedBy: user.id,
            processedAt: new Date(),
          },
          update: {
            currency: effectiveCurrency,
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
            lateDeduction,
            leaveAdjustment,
            totalDeductions,
            netPay,
            daysWorked: att.daysWorked,
            totalWorkingDays,
            status: 'processed',
            processedBy: user.id,
            processedAt: new Date(),
          },
        });

        let prefs: Record<string, string> = {};
        try { prefs = typeof s.preferences === 'string' ? JSON.parse(s.preferences) : (s.preferences as unknown as Record<string, string>); } catch { prefs = {}; }

        processedRecords.push({
          id: record.id,
          userId: s.id,
          month: payrollMonth,
          currency: effectiveCurrency,
          employee: {
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            employeeId: `EMP-${s.id.substring(0, 6).toUpperCase()}`,
            department: s.department || 'General',
            designation,
            pan: prefs.pan || '',
            bankAccount: prefs.bankAccount || '',
          },
          daysWorked: att.daysWorked,
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
          status: 'processed' as const,
          processedAt: record.processedAt?.toISOString(),
        });
      }
    });

    // Mark payroll as completed in idempotency cache
    payrollProcessingCache.set(cacheKey, { status: 'completed', startedAt: Date.now() });

    // Summary stats
    const summary = {
      month: payrollMonth,
      processedAt: new Date().toISOString(),
      totalEmployees: processedRecords.length,
      totalGross: processedRecords.reduce((s, r) => s + r.totalEarnings, 0),
      totalDeductions: processedRecords.reduce((s, r) => s + r.totalDeductions, 0),
      totalNet: processedRecords.reduce((s, r) => s + r.netPay, 0),
      currency: effectiveCurrency,
      totalWorkingDays,
    };

    return NextResponse.json({
      success: true,
      data: processedRecords,
      summary,
      message: `Payroll processed and persisted for ${processedRecords.length} employees for ${payrollMonth}`,
    });
  } catch (error) {
    console.error('POST /api/staff/payroll/process:', error);
    return NextResponse.json({ success: false, error: 'Failed to process payroll' }, { status: 500 });
  }
}
