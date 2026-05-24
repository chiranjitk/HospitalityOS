import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/folio/credit-notes/[id]/apply - Apply credit note to folio
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

    if (creditNote.status === 'cancelled' || creditNote.status === 'expired') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot apply a ${creditNote.status} credit note` } },
        { status: 400 }
      );
    }

    // Prevent double-dip: if already applied, reject
    if (creditNote.status === 'applied') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_APPLIED', message: 'This credit note has already been fully applied' } },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const applyAmount = Math.round(creditNote.remainingAmount * 100) / 100;

      // Create credit line item on folio
      await tx.folioLineItem.create({
        data: {
          folioId: creditNote.folioId,
          description: `Credit Note ${creditNote.creditNoteNumber}: ${creditNote.reason}`,
          category: 'discount',
          quantity: 1,
          unitPrice: -applyAmount,
          totalAmount: -applyAmount,
          taxRate: 0,
          taxAmount: 0,
          serviceDate: new Date(),
          postedBy: user.id,
        },
      });

      // BALANCE FIX: Recalculate folio from ALL line items instead of using decrement
      // This prevents drift if folio was modified concurrently
      const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: creditNote.folioId } });
      const newSubtotal = Math.round(allLineItems.reduce((sum, li) => sum + li.totalAmount, 0) * 100) / 100;
      const newTaxes = Math.round(allLineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0) * 100) / 100;
      const folioData = await tx.folio.findUnique({ where: { id: creditNote.folioId } });
      const newTotalAmount = Math.round((newSubtotal + newTaxes - (folioData?.discount || 0)) * 100) / 100;
      const newPaidAmount = (folioData?.paidAmount || 0);
      const newBalance = Math.round((newTotalAmount - newPaidAmount) * 100) / 100;

      const updatedFolio = await tx.folio.update({
        where: { id: creditNote.folioId },
        data: {
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newTotalAmount,
          paidAmount: newPaidAmount,
          balance: newBalance,
        },
      });

      // Update credit note
      let newStatus: string;
      let appliedAmount: number;
      let remainingAmount: number;

      if (creditNote.status === 'issued') {
        // First time applying
        appliedAmount = applyAmount;
        remainingAmount = 0;
        newStatus = 'applied';
      } else {
        // Partially applied - apply remaining
        appliedAmount = creditNote.appliedAmount + applyAmount;
        remainingAmount = 0;
        newStatus = 'applied';
      }

      const updatedNote = await tx.creditNote.update({
        where: { id },
        data: {
          status: newStatus,
          appliedAmount,
          remainingAmount,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      return { creditNote: updatedNote, folio: updatedFolio };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error applying credit note:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply credit note' } },
      { status: 500 }
    );
  }
}
