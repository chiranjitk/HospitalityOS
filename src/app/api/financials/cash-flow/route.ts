import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const forecastSchema = z.object({
  propertyId: z.string().uuid().optional(),
  period: z.string().min(1, 'Period date is required'),
  openingBalance: z.number().min(0).default(0),
  totalInflow: z.number().min(0).default(0),
  totalOutflow: z.number().min(0).default(0),
  roomRevenue: z.number().min(0).default(0),
  fbRevenue: z.number().min(0).default(0),
  otherRevenue: z.number().min(0).default(0),
  payrollExpense: z.number().min(0).default(0),
  opexExpense: z.number().min(0).default(0),
  capexExpense: z.number().min(0).default(0),
  forecastType: z.enum(['actual', 'projected', 'adjusted']).default('projected'),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/financials/cash-flow — List cash flow forecasts
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'financials:read') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || undefined;
    const year = sp.get('year') ? parseInt(sp.get('year')!) : new Date().getFullYear();
    const forecastType = sp.get('forecastType') || undefined;

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (forecastType) where.forecastType = forecastType;

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    where.period = { gte: startOfYear, lte: endOfYear };

    const forecasts = await db.cashFlowForecast.findMany({
      where,
      orderBy: { period: 'asc' },
    });

    // Aggregate totals
    const totalInflow = forecasts.reduce((s, f) => s + (f.totalInflow || 0), 0);
    const totalOutflow = forecasts.reduce((s, f) => s + (f.totalOutflow || 0), 0);
    const netCashFlow = totalInflow - totalOutflow;

    return NextResponse.json({
      success: true,
      data: forecasts,
      aggregates: { totalInflow, totalOutflow, netCashFlow, year },
    });
  } catch (error) {
    console.error('[GET /api/financials/cash-flow]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cash flow forecasts' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/financials/cash-flow — Create or update forecast
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'financials:write') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = forecastSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;
    const period = new Date(data.period);
    const netCashFlow = (data.totalInflow || 0) - (data.totalOutflow || 0);
    const closingBalance = (data.openingBalance || 0) + netCashFlow;

    // Upsert by tenant + property + period + forecastType
    const forecast = await db.cashFlowForecast.upsert({
      where: {
        tenantId_propertyId_period_forecastType: {
          tenantId: user.tenantId,
          propertyId: data.propertyId || null,
          period,
          forecastType: data.forecastType,
        },
      },
      update: {
        openingBalance: data.openingBalance,
        totalInflow: data.totalInflow,
        totalOutflow: data.totalOutflow,
        netCashFlow,
        closingBalance,
        roomRevenue: data.roomRevenue,
        fbRevenue: data.fbRevenue,
        otherRevenue: data.otherRevenue,
        payrollExpense: data.payrollExpense,
        opexExpense: data.opexExpense,
        capexExpense: data.capexExpense,
        notes: data.notes,
      },
      create: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        period,
        openingBalance: data.openingBalance,
        totalInflow: data.totalInflow,
        totalOutflow: data.totalOutflow,
        netCashFlow,
        closingBalance,
        roomRevenue: data.roomRevenue,
        fbRevenue: data.fbRevenue,
        otherRevenue: data.otherRevenue,
        payrollExpense: data.payrollExpense,
        opexExpense: data.opexExpense,
        capexExpense: data.capexExpense,
        forecastType: data.forecastType,
        notes: data.notes,
      },
    });

    return NextResponse.json({ success: true, data: forecast }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/financials/cash-flow]', error);
    return NextResponse.json({ success: false, error: 'Failed to save cash flow forecast' }, { status: 500 });
  }
}
