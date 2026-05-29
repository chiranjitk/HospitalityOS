import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { postBEODeposit, getBEOSummary } from '@/lib/events/beo-folio-service';

// POST /api/events/beo/[id]/deposit — Pay deposit for BEO
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { amount, paymentMethod, gatewayToken } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'A positive deposit amount is required' }, { status: 400 });
    }

    const validMethods = ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'upi', 'wallet', 'cheque', 'split', 'complementary', 'room_charge'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` }, { status: 400 });
    }

    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const result = await postBEODeposit(id, user.tenantId, amount, paymentMethod, gatewayToken);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('POST /api/events/beo/[id]/deposit:', error);
    if (error instanceof Error) {
      if (error.message.includes('Cannot process deposit')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('exceeds remaining')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('must be positive')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
    }
    return NextResponse.json({ success: false, error: 'Failed to process BEO deposit' }, { status: 500 });
  }
}

// GET /api/events/beo/[id]/deposit — Get deposit status for BEO
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.view', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const summary = await getBEOSummary(id);

    return NextResponse.json({
      success: true,
      data: {
        beoId: beo.id,
        orderNumber: beo.orderNumber,
        totalAmount: beo.totalAmount,
        depositRequired: summary.depositRequired,
        depositPaid: summary.depositPaid,
        outstandingDeposit: summary.outstandingDeposit,
        depositStatus: summary.outstandingDeposit <= 0 ? 'fully_paid' : beo.depositPaid > 0 ? 'partially_paid' : 'unpaid',
        grandTotal: summary.grandTotal,
        payments: summary.payments,
      },
    });
  } catch (error: unknown) {
    console.error('GET /api/events/beo/[id]/deposit:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch deposit status' }, { status: 500 });
  }
}
