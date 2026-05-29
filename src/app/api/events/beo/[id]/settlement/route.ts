import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { postBEOfinalSettlement, getBEOSummary } from '@/lib/events/beo-folio-service';

// POST /api/events/beo/[id]/settlement — Process final settlement
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { paymentMethod, gatewayToken } = body;

    const validMethods = ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'upi', 'wallet', 'cheque', 'split', 'complementary', 'room_charge'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` }, { status: 400 });
    }

    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Verify charges have been posted to folio first
    const existingFolioLines = await db.folioLineItem.findMany({
      where: {
        referenceType: 'BanquetEventOrder',
        referenceId: id,
        category: { notIn: ['deposit', 'payment'] },
      },
      select: { id: true },
      take: 1,
    });

    if (existingFolioLines.length === 0) {
      return NextResponse.json({ success: false, error: 'Charges must be posted to folio before settlement. Call POST /folio first.' }, { status: 400 });
    }

    const result = await postBEOfinalSettlement(id, user.tenantId, paymentMethod, gatewayToken);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('POST /api/events/beo/[id]/settlement:', error);
    if (error instanceof Error) {
      if (error.message.includes('Cannot settle BEO')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('No folio found')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('already closed')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
    }
    return NextResponse.json({ success: false, error: 'Failed to process BEO settlement' }, { status: 500 });
  }
}

// GET /api/events/beo/[id]/settlement — Get settlement status
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
        clientName: beo.clientName,
        status: beo.status,
        totalCharges: summary.totalCharges,
        serviceCharge: summary.serviceCharge,
        tax: summary.tax,
        grandTotal: summary.grandTotal,
        totalPayments: summary.payments.reduce((sum, p) => sum + p.amount, 0),
        outstandingBalance: summary.outstandingBalance,
        settlementStatus: summary.outstandingBalance <= 0 ? 'settled' : beo.status === 'completed' ? 'completed' : 'pending',
        folioId: summary.folioId,
        folioNumber: summary.folioNumber,
        folioStatus: summary.folioStatus,
        payments: summary.payments,
      },
    });
  } catch (error: unknown) {
    console.error('GET /api/events/beo/[id]/settlement:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch settlement status' }, { status: 500 });
  }
}
