import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { getAgentStatement } from '@/lib/billing/commission-engine';

// ──────────────────────────────────────────────
// GET /api/commissions/agent-statement
//
// Query params:
//   agentId (required)
//   periodStart (required, ISO date)
//   periodEnd (required, ISO date)
//   format (optional: 'json' | 'csv', default 'json')
//
// Returns agent commission statement with bookings,
// payments, TDS deductions, and outstanding balance.
// Supports CSV download via Accept: text/csv or format=csv
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['commissions.view', 'commissions.*', 'billing.view', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const agentId = sp.get('agentId');
    const periodStartStr = sp.get('periodStart');
    const periodEndStr = sp.get('periodEnd');
    const format = sp.get('format') || 'json';

    // Validate required params
    if (!agentId) {
      return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 });
    }
    if (!periodStartStr) {
      return NextResponse.json({ success: false, error: 'periodStart is required' }, { status: 400 });
    }
    if (!periodEndStr) {
      return NextResponse.json({ success: false, error: 'periodEnd is required' }, { status: 400 });
    }

    const periodStart = new Date(periodStartStr);
    const periodEnd = new Date(periodEndStr);

    if (isNaN(periodStart.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid periodStart date' }, { status: 400 });
    }
    if (isNaN(periodEnd.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid periodEnd date' }, { status: 400 });
    }
    if (periodStart >= periodEnd) {
      return NextResponse.json({ success: false, error: 'periodEnd must be after periodStart' }, { status: 400 });
    }

    // Verify agent belongs to tenant
    const agent = await db.travelAgent.findFirst({
      where: { id: agentId, tenantId: user.tenantId },
      select: { id: true, agencyName: true },
    });

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Travel agent not found' }, { status: 404 });
    }

    const statement = await getAgentStatement(agentId, user.tenantId, periodStart, periodEnd);

    if (!statement) {
      return NextResponse.json({ success: false, error: 'Could not generate statement for the given period' }, { status: 404 });
    }

    // CSV export
    if (format === 'csv' || request.headers.get('accept') === 'text/csv') {
      const csvContent = generateCSVStatement(statement);
      const filename = `commission-statement-${agent.agencyName.replace(/\s+/g, '-')}-${periodStart.toISOString().split('T')[0]}-to-${periodEnd.toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: statement,
    });
  } catch (error) {
    console.error('[GET /api/commissions/agent-statement]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate agent statement' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// CSV Generator
// ──────────────────────────────────────────────

function generateCSVStatement(statement: Awaited<ReturnType<typeof getAgentStatement>>): string {
  if (!statement) return 'No data';

  const lines: string[] = [];

  // Header
  lines.push(`Commission Statement - ${statement.agentName}`);
  lines.push(`Period: ${statement.periodStart.toISOString().split('T')[0]} to ${statement.periodEnd.toISOString().split('T')[0]}`);
  lines.push(`Currency: ${statement.currency}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('Total Commission Earned,' + statement.totalEarned.toFixed(2));
  lines.push('TDS Deducted,' + statement.totalTDS.toFixed(2));
  lines.push('Net Payable,' + statement.netPayable.toFixed(2));
  lines.push('Total Paid,' + statement.paymentHistory.reduce((s, p) => s + p.amount, 0).toFixed(2));
  lines.push('Outstanding Balance,' + statement.outstandingBalance.toFixed(2));
  lines.push('');

  // Booking details
  lines.push('BOOKING DETAILS');
  lines.push('Confirmation Code,Guest Name,Check-In,Check-Out,Booking Amount,Commission,Status');
  for (const b of statement.bookings) {
    lines.push(
      [
        b.confirmationCode,
        b.guestName,
        b.checkIn.toISOString().split('T')[0],
        b.checkOut.toISOString().split('T')[0],
        b.bookingAmount.toFixed(2),
        b.commissionAmount.toFixed(2),
        b.commissionStatus,
      ].join(',')
    );
  }
  lines.push('');

  // Payment history
  if (statement.paymentHistory.length > 0) {
    lines.push('PAYMENT HISTORY');
    lines.push('Payment ID,Amount,Method,Reference,Date');
    for (const p of statement.paymentHistory) {
      lines.push(
        [
          p.paymentId,
          p.amount.toFixed(2),
          p.paymentMethod || 'N/A',
          p.reference || 'N/A',
          p.paidAt.toISOString().split('T')[0],
        ].join(',')
      );
    }
  }

  return lines.join('\n');
}
