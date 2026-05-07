import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await db.gstEInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        gstSettings: { select: { id: true, gstin: true, legalName: true, tradeName: true, stateCode: true, stateName: true, address: true, city: true, pincode: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'E-invoice not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[EInvoices GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch e-invoice' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const cancelReason = body.cancelReason || 'Cancelled by user';

    const existing = await db.gstEInvoice.findFirst({
      where: { id, tenantId: user.tenantId, status: { in: ['generated', 'draft'] } },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'E-invoice not found or cannot be cancelled' } }, { status: 404 });
    }

    const invoice = await db.gstEInvoice.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason,
      },
    });

    return NextResponse.json({ success: true, data: invoice, message: 'E-invoice cancelled successfully' });
  } catch (error) {
    console.error('[EInvoices DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel e-invoice' } }, { status: 500 });
  }
}
