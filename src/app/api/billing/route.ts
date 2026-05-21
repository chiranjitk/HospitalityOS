import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing - Billing module overview with actual summary data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'billing.view') && !hasPermission(user, 'billing.*') && !hasPermission(user, 'invoices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Query billing summary data from the database
    const [totalReceivable, totalPayable, overdueCount, recentInvoices, recentDeposits] = await Promise.all([
      // Total receivable: sum of folio balances where balance > 0
      db.folio.aggregate({
        where: { tenantId, status: { in: ['open', 'checked_in', 'checked_out'] } },
        _sum: { balance: true },
      }),
      // Total payable: sum of AP invoices
      db.aPInvoice.aggregate({
        where: { tenantId, status: { in: ['pending', 'approved', 'partial'] } },
        _sum: { totalAmount: true },
      }),
      // Overdue count: invoices past due date with unpaid balance
      db.folio.count({
        where: {
          tenantId,
          status: 'checked_out',
          balance: { gt: 0 },
          checkOut: { lt: new Date() },
        },
      }),
      // Recent invoices
      db.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, invoiceNumber: true, totalAmount: true, status: true, createdAt: true },
      }),
      // Recent deposits
      db.deposit.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, amount: true, status: true, type: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        module: 'billing',
        summary: {
          totalReceivable: totalReceivable._sum.balance || 0,
          totalPayable: totalPayable._sum.totalAmount || 0,
          overdueFolios: overdueCount,
        },
        recentInvoices,
        recentDeposits,
        endpoints: {
          deposits: '/api/billing/deposits',
          exchangeRates: '/api/billing/exchange-rates',
          exchangeRatesConvert: '/api/billing/exchange-rates/convert',
          exchangeRatesAutoFetch: '/api/billing/exchange-rates/auto-fetch',
          financing: '/api/billing/financing',
          financingInstallments: '/api/billing/financing/installments',
          apInvoices: '/api/billing/ap/invoices',
          apWorkflow: '/api/billing/ap-workflow',
          taxExemptions: '/api/billing/tax-exemptions',
          autoInvoice: '/api/billing/auto-invoice',
          routingRules: '/api/billing/routing-rules',
        },
      },
    });
  } catch (error) {
    console.error('Billing overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch billing overview' } },
      { status: 500 }
    );
  }
}
