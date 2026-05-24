import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ── Zod Schema ──
const transferSchema = z.object({
  destinationFolioId: z.string().uuid('Invalid destination folio ID'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
  referenceType: z.string().optional(),
});

// ── POST /api/folios/[id]/transfer — Transfer charges between folios ──
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
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const { destinationFolioId, amount, description, referenceType } = parsed.data;

    // Fetch source and destination folios
    const [sourceFolio, destinationFolio] = await Promise.all([
      db.folio.findFirst({
        where: { id, tenantId },
      }),
      db.folio.findFirst({
        where: { id: destinationFolioId, tenantId },
      }),
    ]);

    if (!sourceFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Source folio not found' } },
        { status: 404 }
      );
    }

    if (!destinationFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Destination folio not found' } },
        { status: 404 }
      );
    }

    // ── F-05: Cross-property transfer guard ──
    if (sourceFolio.propertyId !== destinationFolio.propertyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CROSS_PROPERTY_TRANSFER',
            message: 'Cannot transfer charges between folios at different properties. Use city ledger or inter-property billing instead.',
          },
        },
        { status: 400 }
      );
    }

    // Validate source folio is open
    if (sourceFolio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot transfer from a closed folio' } },
        { status: 400 }
      );
    }

    // Validate destination folio is open
    if (destinationFolio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot transfer to a closed folio' } },
        { status: 400 }
      );
    }

    // Validate transfer amount doesn't exceed source folio balance
    if (amount > sourceFolio.balance) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: `Transfer amount (${amount}) exceeds source folio balance (${sourceFolio.balance})`,
          },
        },
        { status: 400 }
      );
    }

    // Prevent self-transfer
    if (sourceFolio.id === destinationFolio.id) {
      return NextResponse.json(
        { success: false, error: { code: 'SELF_TRANSFER', message: 'Cannot transfer charges to the same folio' } },
        { status: 400 }
      );
    }

    // ── F-06: Cross-currency transfer guard ──
    let transferAmount = amount;
    let exchangeRateApplied: number | null = null;
    const sourceCurrency = sourceFolio.currency || 'USD';
    const destinationCurrency = destinationFolio.currency || 'USD';

    if (sourceCurrency !== destinationCurrency) {
      // Look up exchange rate from the exchange rates table
      const exchangeRateRecord = await db.exchangeRate.findFirst({
        where: {
          tenantId,
          fromCurrency: sourceCurrency,
          toCurrency: destinationCurrency,
          isActive: true,
        },
        orderBy: { effectiveDate: 'desc' },
      });

      if (!exchangeRateRecord) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NO_EXCHANGE_RATE',
              message: `No exchange rate available for ${sourceCurrency} to ${destinationCurrency}. Please configure the exchange rate in settings before performing cross-currency transfers.`,
            },
          },
          { status: 400 }
        );
      }

      exchangeRateApplied = exchangeRateRecord.rate;
      transferAmount = amount * exchangeRateRecord.rate;
    }

    // Execute the transfer in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create debit line item on source folio (negative amount reduces balance)
      const debitItem = await tx.folioLineItem.create({
        data: {
          folioId: sourceFolio.id,
          description: description || `Transfer to folio ${destinationFolio.folioNumber || destinationFolioId.substring(0, 8)}`,
          category: 'adjustment',
          quantity: 1,
          unitPrice: -amount, // Negative to represent debit
          totalAmount: -amount,
          taxAmount: 0,
          serviceDate: new Date(),
          referenceType: referenceType || 'FolioTransfer',
          referenceId: destinationFolioId,
          itemCurrency: sourceCurrency,
          postedBy: user.id,
        },
      });

      // Create credit line item on destination folio (positive amount increases balance)
      const creditItem = await tx.folioLineItem.create({
        data: {
          folioId: destinationFolio.id,
          description: description || `Transfer from folio ${sourceFolio.folioNumber || id.substring(0, 8)}${exchangeRateApplied ? ` (${sourceCurrency} ${amount.toFixed(2)} @ ${exchangeRateApplied})` : ''}`,
          category: 'adjustment',
          quantity: 1,
          unitPrice: transferAmount,
          totalAmount: transferAmount,
          taxAmount: 0,
          serviceDate: new Date(),
          referenceType: referenceType || 'FolioTransfer',
          referenceId: sourceFolio.id,
          itemCurrency: destinationCurrency,
          postedBy: user.id,
        },
      });

      // ── Recalculate source folio totals from ALL line items ──
      const sourceItems = await tx.folioLineItem.findMany({
        where: { folioId: sourceFolio.id },
      });
      const srcSubtotal = sourceItems.reduce((s, i) => s + i.totalAmount, 0);
      const srcTaxes = sourceItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
      const srcTotal = srcSubtotal + srcTaxes - (sourceFolio.discount || 0);
      const srcBalance = srcTotal - (sourceFolio.paidAmount || 0);

      const updatedSource = await tx.folio.update({
        where: { id: sourceFolio.id },
        data: {
          subtotal: srcSubtotal,
          taxAmount: srcTaxes,
          totalAmount: srcTotal,
          balance: srcBalance,
        },
      });

      // ── Recalculate destination folio totals from ALL line items ──
      const destItems = await tx.folioLineItem.findMany({
        where: { folioId: destinationFolio.id },
      });
      const destSubtotal = destItems.reduce((s, i) => s + i.totalAmount, 0);
      const destTaxes = destItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
      const destTotal = destSubtotal + destTaxes - (destinationFolio.discount || 0);
      const destBalance = destTotal - (destinationFolio.paidAmount || 0);

      const updatedDestination = await tx.folio.update({
        where: { id: destinationFolio.id },
        data: {
          subtotal: destSubtotal,
          taxAmount: destTaxes,
          totalAmount: destTotal,
          balance: destBalance,
        },
      });

      // Create audit trail entries
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          module: 'billing',
          action: 'folio.transfer_out',
          entityType: 'Folio',
          entityId: sourceFolio.id,
          oldValue: JSON.stringify({ balance: sourceFolio.balance }),
          newValue: JSON.stringify({
            destinationFolioId,
            destinationFolioNumber: destinationFolio.folioNumber,
            amount,
            currency: sourceCurrency,
            newBalance: updatedSource.balance,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          module: 'billing',
          action: 'folio.transfer_in',
          entityType: 'Folio',
          entityId: destinationFolio.id,
          oldValue: JSON.stringify({ balance: destinationFolio.balance }),
          newValue: JSON.stringify({
            sourceFolioId: sourceFolio.id,
            sourceFolioNumber: sourceFolio.folioNumber,
            amount: transferAmount,
            currency: destinationCurrency,
            originalAmount: amount,
            originalCurrency: sourceCurrency,
            exchangeRate: exchangeRateApplied,
            newBalance: updatedDestination.balance,
          }),
        },
      });

      return {
        source: updatedSource,
        destination: updatedDestination,
        debitItem,
        creditItem,
        exchangeRateApplied,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        transferredAmount: amount,
        transferredCurrency: sourceCurrency,
        receivedAmount: transferAmount,
        receivedCurrency: destinationCurrency,
        exchangeRate: exchangeRateApplied,
        source: result.source,
        destination: result.destination,
      },
      message: 'Folio transfer completed successfully',
    });
  } catch (error) {
    console.error('Error transferring folio charges:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to transfer folio charges' } },
      { status: 500 }
    );
  }
}
