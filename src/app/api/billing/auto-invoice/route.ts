import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing/auto-invoice — Get auto-invoicing status and next scheduled run
export async function GET(request: NextRequest) {
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

    // Count city ledger accounts with outstanding balances
    const outstandingInvoices = await db.cityLedgerInvoice.findMany({
      where: {
        tenantId: user.tenantId,
        status: { notIn: ['paid', 'cancelled'] },
      },
      select: {
        id: true,
        accountName: true,
        accountType: true,
        total: true,
        paidAmount: true,
        dueDate: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 500,
    });

    // Group by account
    const accountMap: Record<string, {
      accountName: string;
      accountType: string;
      totalOutstanding: number;
      invoiceCount: number;
      overdueCount: number;
      overdueAmount: number;
    }> = {};

    for (const inv of outstandingInvoices) {
      const balance = inv.total - inv.paidAmount;
      if (balance <= 0) continue;

      if (!accountMap[inv.accountName]) {
        accountMap[inv.accountName] = {
          accountName: inv.accountName,
          accountType: inv.accountType,
          totalOutstanding: 0,
          invoiceCount: 0,
          overdueCount: 0,
          overdueAmount: 0,
        };
      }

      const acc = accountMap[inv.accountName];
      acc.totalOutstanding += balance;
      acc.invoiceCount += 1;

      if (inv.dueDate && new Date() > inv.dueDate) {
        acc.overdueCount += 1;
        acc.overdueAmount += balance;
      }
    }

    const accounts = Object.values(accountMap);

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        lastRunAt: null,
        nextScheduledRun: getNextBillingDate(),
        accountsPending: accounts.length,
        accounts,
        summary: {
          totalOutstanding: accounts.reduce((sum, a) => sum + a.totalOutstanding, 0),
          totalOverdue: accounts.reduce((sum, a) => sum + a.overdueAmount, 0),
          accountsWithOverdue: accounts.filter((a) => a.overdueCount > 0).length,
        },
      },
    });
  } catch (error) {
    console.error('[auto-invoice GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch auto-invoicing status' } },
      { status: 500 }
    );
  }
}

// POST /api/billing/auto-invoice — Trigger auto-invoicing for a billing cycle
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { billingPeriodEnd, propertyId, accountType } = body;

    const periodEnd = billingPeriodEnd ? new Date(billingPeriodEnd) : new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 30);

    // Find all city ledger invoices that need invoicing
    const whereClause: Record<string, unknown> = {
      tenantId: user.tenantId,
      status: { in: ['draft', 'sent', 'partial'] },
    };

    if (propertyId) whereClause.propertyId = propertyId;
    if (accountType) whereClause.accountType = accountType;

    const outstandingInvoices = await db.cityLedgerInvoice.findMany({
      where: whereClause,
      include: { items: true },
      orderBy: { invoiceDate: 'desc' },
    });

    // Group by account
    const accountGroups: Record<string, typeof outstandingInvoices> = {};
    for (const inv of outstandingInvoices) {
      const key = `${inv.accountName}__${inv.accountType}`;
      if (!accountGroups[key]) {
        accountGroups[key] = [];
      }
      accountGroups[key].push(inv);
    }

    // Create invoice records for each account group
    const createdInvoices: Array<{
      accountName: string;
      accountType: string;
      invoiceNumber: string;
      total: number;
      billingTerms: string;
      dueDate: string;
    }> = [];

    const defaultBillingTerms = 'net_30';

    for (const [key, invoices] of Object.entries(accountGroups)) {
      const [accountName, accountType] = key.split('__');
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);

      if (totalAmount <= 0) continue;

      // Check if a corporate account exists for billing terms
      const corporateAccount = await db.corporateAccount.findFirst({
        where: {
          tenantId: user.tenantId,
          companyName: accountName,
          isActive: true,
        },
      });

      const billingTerms = corporateAccount?.billingTerms || defaultBillingTerms;
      const dueDate = calculateDueDate(periodEnd, billingTerms);

      // Fetch actual tax rate from property config instead of hardcoded 10%
      let taxRate = 0.10;
      if (invoices[0].propertyId) {
        const propConfig = await db.property.findUnique({
          where: { id: invoices[0].propertyId },
          select: { taxRate: true },
        });
        if (propConfig && typeof propConfig.taxRate === 'number' && propConfig.taxRate >= 0) {
          taxRate = propConfig.taxRate;
        }
      }

      // Generate invoice number with uniqueness guard (retry on conflict)
      let invoiceNumber = generateInvoiceNumber(accountType);
      let invoice: any = null;
      let createAttempts = 0;
      const MAX_CREATE_ATTEMPTS = 5;
      while (createAttempts < MAX_CREATE_ATTEMPTS) {
        try {
          invoice = await db.cityLedgerInvoice.create({
            data: {
              tenantId: user.tenantId,
              propertyId: invoices[0].propertyId,
              accountName,
              accountType: accountType || 'corporate',
              invoiceNumber,
              invoiceDate: periodEnd,
              dueDate,
              subtotal: Math.round(totalAmount * (1 - taxRate) * 100) / 100,
              tax: Math.round(totalAmount * taxRate * 100) / 100,
              total: totalAmount,
              currency: 'USD',
              status: 'sent',
              notes: `Auto-generated invoice consolidating ${invoices.length} charge(s) from billing period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
            },
          });
          break;
        } catch (createErr: any) {
          if (createErr?.code === 'P2002') {
            createAttempts++;
            invoiceNumber = generateInvoiceNumber(accountType);
          } else {
            throw createErr;
          }
        }
      }
      if (!invoice) {
        throw new Error(`Failed to create unique invoice number after ${MAX_CREATE_ATTEMPTS} attempts`);
      }

      // Mark source invoices as 'consolidated' after creating new invoice
      await db.cityLedgerInvoice.updateMany({
        where: { id: { in: invoices.map(inv => inv.id) } },
        data: { status: 'consolidated' },
      });

      createdInvoices.push({
        accountName,
        accountType: accountType || 'corporate',
        invoiceNumber: invoice.invoiceNumber,
        total: totalAmount,
        billingTerms,
        dueDate: dueDate.toISOString(),
      });
    }

    // Audit trail
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'billing',
        action: 'auto_invoice_generated',
        entityType: 'CityLedgerInvoice',
        newValue: JSON.stringify({
          invoicesCreated: createdInvoices.length,
          totalAmount: createdInvoices.reduce((sum, inv) => sum + inv.total, 0),
          periodEnd: periodEnd.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        invoicesCreated: createdInvoices.length,
        totalAmountInvoiced: createdInvoices.reduce((sum, inv) => sum + inv.total, 0),
        period: {
          start: periodStart.toISOString().slice(0, 10),
          end: periodEnd.toISOString().slice(0, 10),
        },
        invoices: createdInvoices,
      },
    });
  } catch (error) {
    console.error('[auto-invoice POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate auto-invoices' } },
      { status: 500 }
    );
  }
}

/**
 * calculateDueDate — Calculates the due date based on payment terms.
 */
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

/**
 * generateInvoiceNumber — Generates a sequential invoice number.
 */
function generateInvoiceNumber(accountType: string): string {
  const prefix = accountType === 'travel_agent' ? 'TA' : accountType === 'government' ? 'GOV' : 'CL';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const extra = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}-${extra}`;
}

/**
 * getNextBillingDate — Returns the next billing cycle end date (1st of next month).
 */
function getNextBillingDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
