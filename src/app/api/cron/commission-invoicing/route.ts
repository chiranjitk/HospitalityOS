/**
 * Commission Invoicing Cron Job
 *
 * GET /api/cron/commission-invoicing?cron=true
 *
 * Automatically generates monthly commission invoices for travel agents
 * with accrued commission records. Runs monthly on the 1st (configurable).
 * Triggered by external cron/scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCommissionInvoice } from '@/lib/billing/commission-engine';

// L-37: CRON_SECRET env var configuration
const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

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
    // Configuration: invoicing day (default: 1 = first of month)
    const invoicingDay = parseInt(searchParams.get('invoicingDay') || process.env.COMMISSION_INVOICING_DAY || '1', 10);

    // Safety check: only run on the configured day (unless force=true)
    const force = searchParams.get('force') === 'true';
    const today = new Date();
    if (!force && today.getDate() !== invoicingDay) {
      return NextResponse.json({
        success: true,
        message: `Not the configured invoicing day (day ${invoicingDay}). Use ?force=true to override.`,
        skipped: true,
      });
    }

    // Determine period: last month by default
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1); // First day of previous month

    // Allow override via query params
    const overridePeriodStart = searchParams.get('periodStart');
    const overridePeriodEnd = searchParams.get('periodEnd');
    const actualPeriodStart = overridePeriodStart ? new Date(overridePeriodStart) : periodStart;
    const actualPeriodEnd = overridePeriodEnd ? new Date(overridePeriodEnd) : periodEnd;

    // Find all tenants
    const tenants = await db.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    });

    const results: Array<{
      tenantId: string;
      tenantName: string;
      agentId: string;
      agentName: string;
      invoiceId?: string;
      invoiceNumber?: string;
      totalCommission: number;
      tdsAmount: number;
      netPayable: number;
      recordCount: number;
      error?: string;
    }> = [];

    let totalInvoicesGenerated = 0;

    for (const tenant of tenants) {
      try {
        // Find all active travel agents for this tenant
        const agents = await db.travelAgent.findMany({
          where: {
            tenantId: tenant.id,
            status: 'active',
            isActive: true,
          },
          select: { id: true, agencyName: true },
        });

        for (const agent of agents) {
          try {
            // Find rules linked to this agent
            const agentRules = await db.commissionRule.findMany({
              where: {
                tenantId: tenant.id,
                sourceType: 'travel_agent',
                sourceId: agent.id,
                isActive: true,
              },
              select: { id: true },
            });

            const ruleIds = agentRules.map(r => r.id);

            // Check if there are any accrued records for this agent in the period
            const accruedCount = await db.commissionRecord.count({
              where: {
                tenantId: tenant.id,
                ruleId: { in: ruleIds },
                status: 'accrued',
                createdAt: { gte: actualPeriodStart, lt: actualPeriodEnd },
              },
            });

            if (accruedCount === 0) continue;

            // Generate the invoice
            const invoiceResult = await generateCommissionInvoice(
              agent.id,
              tenant.id,
              actualPeriodStart,
              actualPeriodEnd,
            );

            if (invoiceResult) {
              totalInvoicesGenerated++;
              results.push({
                tenantId: tenant.id,
                tenantName: tenant.name,
                agentId: agent.id,
                agentName: agent.agencyName,
                invoiceId: invoiceResult.invoiceId,
                invoiceNumber: invoiceResult.invoiceNumber,
                totalCommission: invoiceResult.totalCommission,
                tdsAmount: invoiceResult.tdsAmount,
                netPayable: invoiceResult.netPayable,
                recordCount: invoiceResult.recordCount,
              });

              // Log notification stub (in production, send email)
              console.log(`[CommissionCron] Invoice ${invoiceResult.invoiceNumber} generated for ${agent.agencyName} (${tenant.name})`);
            } else {
              results.push({
                tenantId: tenant.id,
                tenantName: tenant.name,
                agentId: agent.id,
                agentName: agent.agencyName,
                totalCommission: 0,
                tdsAmount: 0,
                netPayable: 0,
                recordCount: 0,
                error: 'Invoice generation returned null',
              });
            }
          } catch (agentError) {
            const message = agentError instanceof Error ? agentError.message : 'Unknown error';
            results.push({
              tenantId: tenant.id,
              tenantName: tenant.name,
              agentId: agent.id,
              agentName: agent.agencyName,
              totalCommission: 0,
              tdsAmount: 0,
              netPayable: 0,
              recordCount: 0,
              error: message,
            });
          }
        }
      } catch (tenantError) {
        console.error(`[CommissionCron] Error processing tenant ${tenant.name}:`, tenantError);
      }
    }

    // Audit log (one per tenant)
    const tenantsProcessed = new Set(results.map(r => r.tenantId));
    for (const tenantId of tenantsProcessed) {
      try {
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'commissions',
            action: 'create',
            entityType: 'CronJob',
            newValue: JSON.stringify({
              job: 'commission-invoicing',
              periodStart: actualPeriodStart.toISOString().split('T')[0],
              periodEnd: actualPeriodEnd.toISOString().split('T')[0],
              invoicesGenerated: results.filter(r => r.tenantId === tenantId && r.invoiceId).length,
              totalAgentsProcessed: results.filter(r => r.tenantId === tenantId).length,
            }),
          },
        });
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      periodStart: actualPeriodStart.toISOString().split('T')[0],
      periodEnd: actualPeriodEnd.toISOString().split('T')[0],
      invoicesGenerated: totalInvoicesGenerated,
      totalAgentsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error('[Cron] Commission invoicing error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
