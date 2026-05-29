/**
 * Commission Payments Cron Job
 *
 * GET /api/cron/commission-payments?cron=true
 *
 * Automatically processes commission payments for agents:
 * - Finds invoices past their due date that haven't been paid
 * - For COD agents: marks as overdue (notification only)
 * - For auto-pay agents: processes payment via commission payment router
 * - Supports net_15, net_30, net_45, net_60 payment terms
 *
 * Triggered by external cron/scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// L-37: CRON_SECRET env var configuration
const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

interface OverdueInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  agentId: string;
  agentName: string;
  total: number;
  dueDate: string;
  paymentTerms: string;
  daysOverdue: number;
  action: string; // 'marked_overdue' | 'auto_paid' | 'notification_sent'
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cronMode = searchParams.get('cron') === 'true';

  if (!cronMode) {
    return NextResponse.json({
      success: false,
      error: 'This endpoint is for cron automation only. Use ?cron=true with proper auth.',
    }, { status: 400 });
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();

    // Find all tenants
    const tenants = await db.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    });

    const results: OverdueInvoiceResult[] = [];
    let totalAutoPaid = 0;
    let totalMarkedOverdue = 0;
    const errors: string[] = [];

    for (const tenant of tenants) {
      try {
        // Find overdue commission invoices (sent status, past due date, unpaid)
        const overdueInvoices = await db.cityLedgerInvoice.findMany({
          where: {
            tenantId: tenant.id,
            accountType: 'travel_agent',
            status: 'sent',
            dueDate: { lt: today },
          },
          include: {
            travelAgent: {
              select: { id: true, agencyName: true, paymentTerms: true, autoPayEnabled: false },
            },
            payments: {
              select: { id: true, amount: true },
            },
          },
          orderBy: { dueDate: 'asc' },
        });

        for (const invoice of overdueInvoices) {
          try {
            if (!invoice.travelAgent) continue;

            const agent = invoice.travelAgent;
            const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
            const remainingBalance = invoice.total - totalPaid;

            if (remainingBalance <= 0.01) {
              // Already fully paid — update status
              await db.cityLedgerInvoice.update({
                where: { id: invoice.id },
                data: { status: 'paid', paidAmount: invoice.total },
              });
              continue;
            }

            const daysOverdue = Math.ceil(
              (today.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            // Check if agent has auto-pay enabled (stored in CityLedgerAccount)
            const ledgerAccount = await db.cityLedgerAccount.findFirst({
              where: {
                tenantId: tenant.id,
                accountType: 'travel_agent',
                accountCode: agent.id,
              },
              select: { autoPayEnabled: true },
            });

            const isAutoPay = ledgerAccount?.autoPayEnabled === true;
            const isCOD = agent.paymentTerms === 'cod';

            if (isAutoPay) {
              // Process auto-payment
              const paymentRecord = await db.$transaction(async (tx) => {
                // Create commission payment record
                const payment = await tx.commissionPayment.create({
                  data: {
                    tenantId: tenant.id,
                    propertyId: invoice.propertyId,
                    commissionRecordIds: JSON.stringify([]), // Will be populated from the invoice items
                    payeeName: agent.agencyName,
                    payeeType: 'travel_agent',
                    totalAmount: remainingBalance,
                    paymentMethod: 'auto_pay',
                    reference: `AUTO-${invoice.invoiceNumber}`,
                    paidAt: new Date(),
                    notes: `Auto-payment for commission invoice ${invoice.invoiceNumber}`,
                  },
                });

                // Create city ledger payment
                await tx.cityLedgerPayment.create({
                  data: {
                    tenantId: tenant.id,
                    propertyId: invoice.propertyId,
                    invoiceId: invoice.id,
                    amount: remainingBalance,
                    paymentMethod: 'auto_pay',
                    reference: `AUTO-${invoice.invoiceNumber}`,
                    paidAt: new Date(),
                    notes: 'Auto-processed by commission payments cron',
                  },
                });

                // Update invoice status and paid amount
                const newPaidAmount = invoice.paidAmount + remainingBalance;
                const newStatus = newPaidAmount >= invoice.total - 0.01 ? 'paid' : 'partial';
                await tx.cityLedgerInvoice.update({
                  where: { id: invoice.id },
                  data: { paidAmount: newPaidAmount, status: newStatus },
                });

                // Update commission records to 'paid' if invoice is fully paid
                if (newStatus === 'paid') {
                  // Find commission records linked to this invoice period
                  const records = await tx.commissionRecord.findMany({
                    where: {
                      tenantId: tenant.id,
                      sourceType: 'travel_agent',
                      status: 'invoiced',
                      travelAgentId: agent.id,
                    },
                    select: { id: true },
                  });

                  if (records.length > 0) {
                    await tx.commissionRecord.updateMany({
                      where: { id: { in: records.map(r => r.id) } },
                      data: { status: 'paid', paidAt: new Date() },
                    });

                    // Update the payment's record IDs
                    await tx.commissionPayment.update({
                      where: { id: payment.id },
                      data: { commissionRecordIds: JSON.stringify(records.map(r => r.id)) },
                    });
                  }
                }

                return payment;
              });

              totalAutoPaid++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                agentId: agent.id,
                agentName: agent.agencyName,
                total: remainingBalance,
                dueDate: invoice.dueDate.toISOString().split('T')[0],
                paymentTerms: agent.paymentTerms,
                daysOverdue,
                action: 'auto_paid',
              });

              console.log(`[CommissionPaymentCron] Auto-paid ${remainingBalance} for ${agent.agencyName} (${invoice.invoiceNumber})`);
            } else {
              // Mark as overdue (notification only)
              await db.cityLedgerInvoice.update({
                where: { id: invoice.id },
                data: { status: 'overdue' },
              });

              totalMarkedOverdue++;
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                agentId: agent.id,
                agentName: agent.agencyName,
                total: remainingBalance,
                dueDate: invoice.dueDate.toISOString().split('T')[0],
                paymentTerms: agent.paymentTerms,
                daysOverdue,
                action: isCOD ? 'cod_overdue' : 'marked_overdue',
              });
            }
          } catch (invoiceError) {
            const message = invoiceError instanceof Error ? invoiceError.message : 'Unknown error';
            errors.push(`Invoice ${invoice.invoiceNumber}: ${message}`);
          }
        }
      } catch (tenantError) {
        console.error(`[CommissionPaymentCron] Error processing tenant ${tenant.name}:`, tenantError);
      }
    }

    // Audit log
    const tenantsProcessed = new Set(results.map(r => r.invoiceId));
    for (const tenantId of tenants.map(t => t.id)) {
      try {
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'commissions',
            action: 'payment',
            entityType: 'CronJob',
            newValue: JSON.stringify({
              job: 'commission-payments',
              overdueProcessed: results.length,
              autoPaid: totalAutoPaid,
              markedOverdue: totalMarkedOverdue,
              errors: errors.length,
            }),
          },
        });
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      processedDate: today.toISOString().split('T')[0],
      totalInvoicesProcessed: results.length,
      totalAutoPaid,
      totalMarkedOverdue,
      results,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('[Cron] Commission payments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
