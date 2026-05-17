import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Helper function to generate folio number
function generateFolioNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FOL-${timestamp}-${random}`;
}

// POST /api/folios/[id]/split - Split a folio into two
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }
  const tenantId = user.tenantId;

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      targetGuestId,
      lineItemIds,
      splitType,
      amount,
    } = body;

    // Validate required fields
    if (!targetGuestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: targetGuestId' } },
        { status: 400 }
      );
    }

    if (!splitType || !['items', 'amount'].includes(splitType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'splitType must be "items" or "amount"' } },
        { status: 400 }
      );
    }

    if (splitType === 'items' && (!lineItemIds || !Array.isArray(lineItemIds) || lineItemIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'lineItemIds must be a non-empty array when splitType is "items"' } },
        { status: 400 }
      );
    }

    if (splitType === 'amount' && (!amount || parseFloat(amount) <= 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'amount must be a positive number when splitType is "amount"' } },
        { status: 400 }
      );
    }

    // Fetch source folio with line items
    const sourceFolio = await db.folio.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: {
          orderBy: { serviceDate: 'desc' },
        },
      },
    });

    if (!sourceFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    // Validate source folio is open or partially_paid
    if (!['open', 'partially_paid'].includes(sourceFolio.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Folio must be open or partially paid to split' } },
        { status: 400 }
      );
    }

    // Validate target guest exists
    const targetGuest = await db.guest.findUnique({
      where: { id: targetGuestId, deletedAt: null },
    });

    if (!targetGuest) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GUEST', message: 'Target guest not found' } },
        { status: 400 }
      );
    }

    // Validate line item IDs belong to this folio
    let itemsToMove: typeof sourceFolio.lineItems = [];
    let splitAmount = 0;

    if (splitType === 'items') {
      itemsToMove = sourceFolio.lineItems.filter((item) => lineItemIds.includes(item.id));
      if (itemsToMove.length !== lineItemIds.length) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ITEMS', message: 'Some line item IDs do not belong to this folio' } },
          { status: 400 }
        );
      }
      splitAmount = itemsToMove.reduce(
        (sum, item) => sum + item.totalAmount + item.taxAmount,
        0
      );
    } else {
      splitAmount = parseFloat(amount);
      // Ensure amount does not exceed folio balance
      if (splitAmount > sourceFolio.totalAmount - sourceFolio.paidAmount) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_AMOUNT', message: 'Split amount exceeds the remaining folio balance' } },
          { status: 400 }
        );
      }
    }

    if (splitAmount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Split amount must be greater than zero' } },
        { status: 400 }
      );
    }

    // Execute the split in a transaction
    const result = await db.$transaction(async (tx) => {
      // Generate new folio number
      const newFolioNumber = generateFolioNumber();

      // Calculate the split values for the new folio
      let newSubtotal = 0;
      let newTaxes = 0;

      if (splitType === 'items') {
        newSubtotal = itemsToMove.reduce((sum, item) => sum + item.totalAmount, 0);
        newTaxes = itemsToMove.reduce((sum, item) => sum + item.taxAmount, 0);
      } else {
        // SECURITY FIX (F-02): Use largest-remainder method to prevent
        // phantom pennies. Math.round() on subtotal and taxes independently
        // can cause newSubtotal + newTaxes != splitAmount.
        if (sourceFolio.totalAmount > 0) {
          const ratio = splitAmount / sourceFolio.totalAmount;
          const rawSubtotalCents = sourceFolio.subtotal * ratio * 100;
          const rawTaxesCents = sourceFolio.taxes * ratio * 100;
          const targetCents = Math.round(splitAmount * 100);

          // Floor both values
          const floorSubtotalCents = Math.floor(rawSubtotalCents);
          const floorTaxesCents = Math.floor(rawTaxesCents);

          // Calculate remainder to ensure exact sum match
          const remainder = targetCents - floorSubtotalCents - floorTaxesCents;

          // Distribute remainder to the component with the largest fractional part
          const fracSubtotal = rawSubtotalCents - floorSubtotalCents;
          const fracTaxes = rawTaxesCents - floorTaxesCents;

          if (remainder > 0) {
            if (fracSubtotal >= fracTaxes) {
              newSubtotal = (floorSubtotalCents + remainder) / 100;
              newTaxes = floorTaxesCents / 100;
            } else {
              newSubtotal = floorSubtotalCents / 100;
              newTaxes = (floorTaxesCents + remainder) / 100;
            }
          } else if (remainder < 0) {
            if (fracSubtotal <= fracTaxes) {
              newSubtotal = (floorSubtotalCents + remainder) / 100;
              newTaxes = floorTaxesCents / 100;
            } else {
              newSubtotal = floorSubtotalCents / 100;
              newTaxes = (floorTaxesCents + remainder) / 100;
            }
          } else {
            newSubtotal = floorSubtotalCents / 100;
            newTaxes = floorTaxesCents / 100;
          }
        } else {
          newSubtotal = splitAmount;
          newTaxes = 0;
        }
      }

      const newTotalAmount = newSubtotal + newTaxes;

      // Create new folio for target guest
      const newFolio = await tx.folio.create({
        data: {
          tenantId,
          propertyId: sourceFolio.propertyId,
          bookingId: sourceFolio.bookingId,
          guestId: targetGuestId,
          folioNumber: newFolioNumber,
          currency: sourceFolio.currency,
          status: 'open',
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newTotalAmount,
          paidAmount: 0,
          balance: newTotalAmount,
        },
        include: {
          booking: {
            select: {
              id: true,
              confirmationCode: true,
              primaryGuest: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          lineItems: {
            orderBy: { serviceDate: 'desc' },
          },
        },
      });

      if (splitType === 'items') {
        // Move line items to the new folio
        for (const item of itemsToMove) {
          await tx.folioLineItem.update({
            where: { id: item.id },
            data: { folioId: newFolio.id },
          });
        }
      } else {
        // Create a single line item on the new folio for the split amount
        await tx.folioLineItem.create({
          data: {
            folioId: newFolio.id,
            description: 'Split from folio ' + sourceFolio.folioNumber,
            category: 'other',
            quantity: 1,
            unitPrice: newSubtotal,
            totalAmount: newSubtotal,
            serviceDate: new Date(),
            taxRate: sourceFolio.totalAmount > 0 && sourceFolio.subtotal > 0
              ? (newTaxes / newSubtotal) * 100
              : 0,
            taxAmount: newTaxes,
            itemCurrency: sourceFolio.currency,
            postedBy: user.id,
          },
        });
      }

      // Recalculate source folio totals
      const remainingLineItems = await tx.folioLineItem.findMany({
        where: { folioId: sourceFolio.id },
      });

      const recalcSubtotal = remainingLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const recalcTaxes = remainingLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const recalcTotal = recalcSubtotal + recalcTaxes;
      const recalcBalance = recalcTotal - sourceFolio.paidAmount;

      // Update source folio
      const updatedSourceFolio = await tx.folio.update({
        where: { id: sourceFolio.id },
        data: {
          subtotal: recalcSubtotal,
          taxes: recalcTaxes,
          totalAmount: recalcTotal,
          balance: Math.max(0, recalcBalance),
        },
        include: {
          booking: {
            select: {
              id: true,
              confirmationCode: true,
              primaryGuest: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          lineItems: {
            orderBy: { serviceDate: 'desc' },
          },
        },
      });

      // Create audit log entries for both folios
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          module: 'billing',
          action: 'folio.split',
          entityType: 'Folio',
          entityId: sourceFolio.id,
          oldValue: JSON.stringify({
            folioNumber: sourceFolio.folioNumber,
            totalAmount: sourceFolio.totalAmount,
          }),
          newValue: JSON.stringify({
            newFolioNumber: newFolioNumber,
            newFolioId: newFolio.id,
            splitType,
            splitAmount,
            targetGuestId,
            remainingTotal: recalcTotal,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          module: 'billing',
          action: 'folio.split.created',
          entityType: 'Folio',
          entityId: newFolio.id,
          oldValue: null,
          newValue: JSON.stringify({
            folioNumber: newFolioNumber,
            sourceFolioId: sourceFolio.id,
            sourceFolioNumber: sourceFolio.folioNumber,
            splitType,
            totalAmount: newTotalAmount,
            targetGuestId,
          }),
        },
      });

      return { sourceFolio: updatedSourceFolio, newFolio };
    });

    return NextResponse.json({
      success: true,
      data: {
        sourceFolio: result.sourceFolio,
        newFolio: result.newFolio,
      },
      message: 'Folio split successfully',
    });
  } catch (error) {
    console.error('Error splitting folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to split folio' } },
      { status: 500 }
    );
  }
}
