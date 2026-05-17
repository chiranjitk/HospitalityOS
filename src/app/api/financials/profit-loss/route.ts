import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/auth-helpers';

// ──────────────────────────────────────────────
// GET /api/financials/profit-loss — P&L Statement
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check: restrict P&L to users with financial reporting access
    if (!hasPermission(user, 'financials:read') && !hasPermission(user, 'reports:financial') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions to view P&L' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || undefined;
    const dateFrom = sp.get('dateFrom') ? new Date(sp.get('dateFrom')!) : undefined;
    const dateTo = sp.get('dateTo') ? new Date(sp.get('dateTo')!) : undefined;

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    // Date range filter on journal entries
    const entryWhere: Record<string, unknown> = { ...where };
    if (dateFrom) entryWhere.date = { ...(entryWhere.date as Record<string, unknown> || {}), gte: dateFrom };
    if (dateTo) entryWhere.date = { ...(entryWhere.date as Record<string, unknown> || {}), lte: dateTo };
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      entryWhere.date = dateFilter;
    }
    entryWhere.status = 'posted';

    // Get all journal entry lines for posted entries within the date range
    const journalLines = await db.journalEntryLine.findMany({
      where: {
        journalEntry: entryWhere,
      },
      include: {
        financialAccount: {
          select: { id: true, code: true, name: true, accountType: true, category: true, subCategory: true },
        },
      },
    });

    // Aggregate by category and account type
    const revenueByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};
    const revenueAccounts: Record<string, { code: string; name: string; category: string; total: number }> = {};
    const expenseAccounts: Record<string, { code: string; name: string; category: string; total: number }> = {};

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const line of journalLines) {
      const account = line.financialAccount;
      const category = account.category || 'other';
      const accountKey = account.id;
      const debit = line.debitAmount || 0;
      const credit = line.creditAmount || 0;

      if (account.accountType === 'revenue') {
        // Revenue accounts: credits increase revenue
        const amount = credit - debit;
        if (amount !== 0) {
          revenueByCategory[category] = (revenueByCategory[category] || 0) + amount;
          if (!revenueAccounts[accountKey]) {
            revenueAccounts[accountKey] = { code: account.code, name: account.name, category, total: 0 };
          }
          revenueAccounts[accountKey].total += amount;
          totalRevenue += amount;
        }
      } else if (account.accountType === 'expense') {
        // Expense accounts: debits increase expenses
        const amount = debit - credit;
        if (amount !== 0) {
          expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
          if (!expenseAccounts[accountKey]) {
            expenseAccounts[accountKey] = { code: account.code, name: account.name, category, total: 0 };
          }
          expenseAccounts[accountKey].total += amount;
          totalExpenses += amount;
        }
      }
    }

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const categoryLabels: Record<string, string> = {
      room: 'Room Revenue',
      f_b: 'Food & Beverage',
      spa: 'Spa & Wellness',
      events: 'Events & Banquets',
      parking: 'Parking',
      other: 'Other',
    };

    return NextResponse.json({
      success: true,
      data: {
        period: { dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() },
        revenue: {
          total: totalRevenue,
          byCategory: Object.entries(revenueByCategory).map(([category, amount]) => ({
            category,
            label: categoryLabels[category] || category,
            amount,
          })),
          accounts: Object.values(revenueAccounts).sort((a, b) => b.total - a.total),
        },
        expenses: {
          total: totalExpenses,
          byCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
            category,
            label: categoryLabels[category] || category,
            amount,
          })),
          accounts: Object.values(expenseAccounts).sort((a, b) => b.total - a.total),
        },
        netProfit,
        profitMargin,
      },
    });
  } catch (error) {
    console.error('[GET /api/financials/profit-loss]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate P&L statement' }, { status: 500 });
  }
}
