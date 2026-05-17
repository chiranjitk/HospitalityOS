import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/auth-helpers';

// ──────────────────────────────────────────────
// GET /api/financials/profit-loss/export — Export P&L as CSV
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: restrict P&L export to users with financial reporting access
    if (!hasPermission(user, 'financials:read') && !hasPermission(user, 'reports:financial') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions to export P&L' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || undefined;
    const dateFrom = sp.get('dateFrom') ? new Date(sp.get('dateFrom')!) : undefined;
    const dateTo = sp.get('dateTo') ? new Date(sp.get('dateTo')!) : undefined;
    const format = sp.get('format') || 'csv';

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const entryWhere: Record<string, unknown> = { ...where, status: 'posted' };
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      entryWhere.date = dateFilter;
    }

    const journalLines = await db.journalEntryLine.findMany({
      where: { journalEntry: entryWhere },
      include: {
        financialAccount: {
          select: { id: true, code: true, name: true, accountType: true, category: true },
        },
      },
    });

    const categoryLabels: Record<string, string> = {
      room: 'Room Revenue', f_b: 'Food & Beverage', spa: 'Spa & Wellness',
      events: 'Events & Banquets', parking: 'Parking', other: 'Other',
    };

    const revenueByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const line of journalLines) {
      const account = line.financialAccount;
      const category = account.category || 'other';
      const debit = line.debitAmount || 0;
      const credit = line.creditAmount || 0;

      if (account.accountType === 'revenue') {
        const amount = credit - debit;
        if (amount !== 0) {
          revenueByCategory[category] = (revenueByCategory[category] || 0) + amount;
          totalRevenue += amount;
        }
      } else if (account.accountType === 'expense') {
        const amount = debit - credit;
        if (amount !== 0) {
          expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
          totalExpenses += amount;
        }
      }
    }

    const netProfit = totalRevenue - totalExpenses;

    if (format === 'csv') {
      const rows: string[] = [];
      rows.push('Type,Category,Amount');
      rows.push(`Revenue,Total,${totalRevenue.toFixed(2)}`);
      for (const [cat, amt] of Object.entries(revenueByCategory)) {
        rows.push(`Revenue,${categoryLabels[cat] || cat},${amt.toFixed(2)}`);
      }
      rows.push(`Expenses,Total,${totalExpenses.toFixed(2)}`);
      for (const [cat, amt] of Object.entries(expenseByCategory)) {
        rows.push(`Expenses,${categoryLabels[cat] || cat},${amt.toFixed(2)}`);
      }
      rows.push(`Net Profit,,${netProfit.toFixed(2)}`);
      rows.push(`Profit Margin,,${(totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0).toFixed(2)}%`);

      const csv = rows.join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="profit-loss-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: JSON download
    return NextResponse.json({
      success: true,
      data: {
        revenue: { total: totalRevenue, byCategory: revenueByCategory },
        expenses: { total: totalExpenses, byCategory: expenseByCategory },
        netProfit,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('[GET /api/financials/profit-loss/export]', error);
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 });
  }
}
