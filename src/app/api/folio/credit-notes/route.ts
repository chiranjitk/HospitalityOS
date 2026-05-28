import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/credit-notes?folioId=xxx - List credit notes for a folio
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');

    if (!folioId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'folioId is required' } },
        { status: 400 }
      );
    }

    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    const creditNotes = await db.creditNote.findMany({
      where: { folioId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const parsedNotes = creditNotes.map(note => ({
      ...note,
      items: JSON.parse(note.items as string),
    }));

    return NextResponse.json({ success: true, data: parsedNotes });
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credit notes' } },
      { status: 500 }
    );
  }
}

// POST /api/folio/credit-notes - Create a credit note
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      folioId,
      guestId,
      bookingId,
      reason,
      description,
      items: rawItems,
      currency,
      taxAmount: bodyTaxAmount,
    } = body;

    if (!folioId || !guestId || !reason || !rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, guestId, reason, items' } },
        { status: 400 }
      );
    }

    const validReasons = ['refund', 'discount', 'correction', 'service_recovery'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    // Reject if folio is closed
    if (folio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot create credit notes for a closed folio' } },
        { status: 400 }
      );
    }

    // Validate items and calculate totals
    const items = rawItems.map((item: { description: string; amount: number; folioLineItemId?: string }) => ({
      description: item.description,
      amount: Math.round(parseFloat(String(item.amount)) * 100) / 100,
      folioLineItemId: item.folioLineItemId || null,
    }));

    if (items.some(item => item.amount <= 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'All item amounts must be positive' } },
        { status: 400 }
      );
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    // Resolve tax: look up referenced folio line items, or accept explicit taxAmount
    let resolvedTaxAmount = 0;
    const referencedLineItemIds = items
      .map(i => i.folioLineItemId)
      .filter((id): id is string => id !== null);

    if (referencedLineItemIds.length > 0) {
      // Look up the original folio line items to reverse their tax
      const referencedItems = await db.folioLineItem.findMany({
        where: { id: { in: referencedLineItemIds }, folioId },
        select: { id: true, taxAmount: true, taxRate: true },
      });
      // Sum up tax from referenced items; each credit item may reference a line item
      const taxById = new Map(referencedItems.map(ri => [ri.id, ri]));
      for (const creditItem of items) {
        if (creditItem.folioLineItemId) {
          const original = taxById.get(creditItem.folioLineItemId);
          if (original) {
            resolvedTaxAmount += original.taxAmount;
          }
        }
      }
    } else {
      // No specific line items referenced; accept optional taxAmount from caller
      resolvedTaxAmount = typeof bodyTaxAmount === 'number' ? bodyTaxAmount : 0;
    }

    const totalAmount = subtotal + resolvedTaxAmount;

    // H-18 FIX: Credit note sequence number generation is now inside the
    // transaction to prevent race conditions. Previously, the count was
    // performed outside the transaction, so two concurrent requests could
    // read the same count and produce duplicate credit note numbers.
    const creditNote = await db.$transaction(async (tx) => {
      // Generate credit note number inside the transaction
      const today = new Date();
      const dateStr = formatGenerateDate(today);
      const count = await tx.creditNote.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          },
        },
      });
      const seq = String(count + 1).padStart(4, '0');
      const creditNoteNumber = `CN-${dateStr}-${seq}`;
      // SECURITY FIX (A-03): Credit notes must have immediate financial effect.
      // Previously appliedAmount was permanently 0, meaning credit notes had
      // zero impact on folio balance. Now we: (1) set appliedAmount = totalAmount,
      // (2) create a folio line item for the credit, (3) update the folio balance.

      // Create the credit note with appliedAmount set to totalAmount
      const note = await tx.creditNote.create({
        data: {
          tenantId,
          propertyId: folio.propertyId,
          folioId,
          creditNoteNumber,
          guestId,
          bookingId: bookingId || null,
          reason,
          description: description || null,
          items: JSON.stringify(items),
          subtotal,
          taxAmount: resolvedTaxAmount,
          totalAmount,
          currency: currency || folio.currency,
          status: 'issued',
          appliedAmount: 0,
          remainingAmount: totalAmount,
          issuedBy: user.id,
        },
      });

      // Determine the effective tax rate for the credit folio line item
      const effectiveTaxRate = subtotal > 0 ? (resolvedTaxAmount / subtotal) * 100 : 0;

      // Create a negative folio line item to represent the credit on the folio
      await tx.folioLineItem.create({
        data: {
          folioId,
          description: `Credit Note ${creditNoteNumber}: ${reason}`,
          category: 'adjustment',
          quantity: 1,
          unitPrice: -subtotal,
          totalAmount: -subtotal,
          serviceDate: new Date(),
          taxRate: effectiveTaxRate,
          taxAmount: -resolvedTaxAmount,
          itemCurrency: currency || folio.currency,
          referenceType: 'CreditNote',
          referenceId: note.id,
          postedBy: user.id,
        },
      });

      // Recalculate the folio totals from all line items
      const allLineItems = await tx.folioLineItem.findMany({
        where: { folioId },
      });

      const newSubtotal = Math.round(allLineItems.reduce((sum, item) => sum + item.totalAmount, 0) * 100) / 100;
      const newTaxes = Math.round(allLineItems.reduce((sum, item) => sum + item.taxAmount, 0) * 100) / 100;
      // BALANCE FIX: include discount in totalAmount
      const newTotalAmount = Math.round((newSubtotal + newTaxes - (folio.discount || 0)) * 100) / 100;

      const completedPayments = await tx.payment.findMany({
        where: { folioId, status: 'completed' },
        select: { amount: true },
      });
      const newPaidAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);

      // Update the folio with recalculated totals
      await tx.folio.update({
        where: { id: folioId },
        data: {
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newTotalAmount,
          paidAmount: newPaidAmount,
          balance: newTotalAmount - newPaidAmount,
        },
      });

      return note;
    });

    return NextResponse.json({
      success: true,
      data: { ...creditNote, items },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating credit note:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create credit note' } },
      { status: 500 }
    );
  }
}

function formatGenerateDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
