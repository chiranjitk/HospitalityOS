import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/corporate-accounts/[id]/invoices — Auto-generated invoices for corporate account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: accountId } = await params;

    // Verify account exists
    const account = await db.corporateAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Corporate account not found' } },
        { status: 404 }
      );
    }

    // Fetch city ledger invoices for this account
    const invoices = await db.cityLedgerInvoice.findMany({
      where: {
        tenantId: user.tenantId,
        accountName: account.companyName,
      },
      include: {
        items: true,
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
    });

    // Group by billing period (month)
    const groupedByPeriod: Record<string, typeof invoices> = {};
    for (const invoice of invoices) {
      const period = invoice.invoiceDate.toISOString().slice(0, 7); // YYYY-MM
      if (!groupedByPeriod[period]) {
        groupedByPeriod[period] = [];
      }
      groupedByPeriod[period].push(invoice);
    }

    // Calculate due dates based on billing terms
    function calculateDueDate(invoiceDate: Date, billingTerms: string): Date {
      const dueDate = new Date(invoiceDate);
      const termsMap: Record<string, number> = {
        cod: 0,
        net_15: 15,
        net_30: 30,
        net_45: 45,
        net_60: 60,
      };
      const days = termsMap[billingTerms] || 30;
      dueDate.setDate(dueDate.getDate() + days);
      return dueDate;
    }

    // Summary stats
    const totalBilled = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      const dueDate = calculateDueDate(inv.invoiceDate, account.billingTerms);
      return new Date() > dueDate;
    });

    // Credit limit check: flag when outstanding balance exceeds credit limit
    const outstandingBalance = totalBilled - totalPaid;
    const isCreditLimitExceeded = account.creditLimit != null
      && account.creditLimit > 0
      && outstandingBalance > account.creditLimit;
    const creditLimitRemaining = account.creditLimit != null && account.creditLimit > 0
      ? Math.max(0, account.creditLimit - outstandingBalance)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          companyName: account.companyName,
          accountType: account.accountType,
          billingTerms: account.billingTerms,
          creditLimit: account.creditLimit,
          creditLimitExceeded: isCreditLimitExceeded,
          creditLimitRemaining,
        },
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString(),
          dueDate: calculateDueDate(inv.invoiceDate, account.billingTerms).toISOString(),
          subtotal: inv.subtotal,
          tax: inv.tax,
          total: inv.total,
          paidAmount: inv.paidAmount,
          balance: inv.total - inv.paidAmount,
          currency: inv.currency,
          status: inv.status,
          itemCount: inv.items.length,
          paymentCount: inv.payments.length,
          notes: inv.notes,
          createdAt: inv.createdAt.toISOString(),
        })),
        groupedByPeriod: Object.entries(groupedByPeriod).map(([period, periodInvoices]) => ({
          period,
          invoiceCount: periodInvoices.length,
          totalAmount: periodInvoices.reduce((sum, inv) => sum + inv.total, 0),
          paidAmount: periodInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
          balance: periodInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0),
        })),
        summary: {
          totalInvoices: invoices.length,
          totalBilled,
          totalPaid,
          outstandingBalance: totalBilled - totalPaid,
          overdueCount: overdueInvoices.length,
          overdueAmount: overdueInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0),
          periodsCovered: Object.keys(groupedByPeriod).length,
        },
      },
    });
  } catch (error) {
    console.error('[corporate-accounts/[id]/invoices GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch corporate invoices' } },
      { status: 500 }
    );
  }
}
