import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/folio/credit-notes/[id]/cancel - Cancel a credit note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const { id } = await params;

    const creditNote = await db.creditNote.findFirst({
      where: { id, tenantId },
    });

    if (!creditNote) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Credit note not found' } }, { status: 404 });
    }

    if (creditNote.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_CANCELLED', message: 'Credit note is already cancelled' } },
        { status: 400 }
      );
    }

    // If the credit note has been applied, we need to reverse the credit
    if (creditNote.appliedAmount > 0) {
      const result = await db.$transaction(async (tx) => {
        // Reverse the credit on folio
        await tx.folioLineItem.create({
          data: {
            folioId: creditNote.folioId,
            description: `Reversal: Cancelled credit note ${creditNote.creditNoteNumber}`,
            category: 'miscellaneous',
            quantity: 1,
            unitPrice: creditNote.appliedAmount,
            totalAmount: creditNote.appliedAmount,
            taxRate: 0,
            taxAmount: 0,
            serviceDate: new Date(),
            postedBy: user.id,
          },
        });

        // BALANCE FIX: Recalculate from ALL line items instead of using increment to prevent drift
        const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: creditNote.folioId } });
        const newSubtotal = Math.round(allLineItems.reduce((sum, item) => sum + item.totalAmount, 0) * 100) / 100;
        const newTaxes = Math.round(allLineItems.reduce((sum, item) => sum + item.taxAmount, 0) * 100) / 100;
        const folioData = await tx.folio.findUnique({ where: { id: creditNote.folioId } });
        const newTotalAmount = Math.round((newSubtotal + newTaxes - (folioData?.discount || 0)) * 100) / 100;
        const completedPayments = await tx.payment.findMany({
          where: { folioId: creditNote.folioId, status: 'completed' },
          select: { amount: true },
        });
        const newPaidAmount = Math.round(completedPayments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
        const newBalance = Math.max(0, Math.round((newTotalAmount - newPaidAmount) * 100) / 100);

        await tx.folio.update({
          where: { id: creditNote.folioId },
          data: {
            subtotal: newSubtotal,
            taxes: newTaxes,
            totalAmount: newTotalAmount,
            paidAmount: newPaidAmount,
            balance: newBalance,
          },
        });

        const updatedNote = await tx.creditNote.update({
          where: { id },
          data: {
            status: 'cancelled',
            appliedAmount: 0,
            remainingAmount: creditNote.totalAmount,
          },
        });

        return updatedNote;
      });

      return NextResponse.json({ success: true, data: result });
    }

    const updatedNote = await db.creditNote.update({
      where: { id },
      data: { status: 'cancelled', remainingAmount: creditNote.totalAmount },
    });

    return NextResponse.json({ success: true, data: updatedNote });
  } catch (error) {
    console.error('Error cancelling credit note:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel credit note' } },
      { status: 500 }
    );
  }
}
