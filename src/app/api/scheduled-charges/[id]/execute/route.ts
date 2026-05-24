import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// ─── POST: Execute a scheduled charge now (manual trigger) ───
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.execute') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    // Fetch scheduled charge with related data
    const charge = await db.scheduledCharge.findFirst({
      where: { id, tenantId: user.tenantId, isActive: true },
      include: {
        folio: { select: { id: true, folioNumber: true, status: true } },
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
          },
        },
      },
    });

    if (!charge) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Active scheduled charge not found' } }, { status: 404 });
    }

    if (charge.folio.status !== 'open') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Cannot post charge to a closed folio' } }, { status: 400 });
    }

    // Check max amount cap
    if (charge.maxAmount) {
      const totalExecuted = await db.scheduledChargeExecution.aggregate({
        where: { scheduledChargeId: id, status: 'success' },
        _sum: { amount: true },
      });
      const totalSoFar = totalExecuted._sum.amount || 0;
      if (totalSoFar + charge.amount > charge.maxAmount) {
        // Auto-pause the charge
        await db.scheduledCharge.update({
          where: { id },
          data: { isActive: false },
        });

        return NextResponse.json({
          success: false,
          error: {
            code: 'MAX_AMOUNT_REACHED',
            message: `Charge would exceed maximum amount ($${charge.maxAmount}). Total executed so far: $${totalSoFar.toFixed(2)}. Scheduled charge has been paused.`,
          },
        }, { status: 400 });
      }
    }

    // Execute the charge atomically: folio line item + folio balance + execution record
    const result = await db.$transaction(async (tx) => {
      // Look up property tax rate
      let taxRate = 0;
      try {
        const scFolio = await tx.folio.findUnique({ where: { id: charge.folioId }, select: { propertyId: true } });
        if (scFolio) {
          const scProp = await tx.property.findUnique({ where: { id: scFolio.propertyId }, select: { defaultTaxRate: true, taxComponents: true } });
          if (scProp) {
            if (scProp.taxComponents) {
              const tc = JSON.parse(scProp.taxComponents);
              if (Array.isArray(tc) && tc.length > 0) {
                taxRate = tc.reduce((s: number, c: { rate: number }) => s + (c.rate || 0), 0) / 100;
              } else {
                taxRate = (scProp.defaultTaxRate || 0) / 100;
              }
            } else {
              taxRate = (scProp.defaultTaxRate || 0) / 100;
            }
          }
        }
      } catch { /* use default 0 */ }

      const taxAmount = Math.round(charge.amount * taxRate * 100) / 100;
      const totalWithTax = Math.round((charge.amount + taxAmount) * 100) / 100;

      const lineItem = await tx.folioLineItem.create({
        data: {
          folioId: charge.folioId,
          description: `${charge.description} (Scheduled - ${charge.frequency})`,
          category: charge.category || charge.chargeType,
          quantity: 1,
          unitPrice: charge.amount,
          totalAmount: totalWithTax,
          taxRate: Math.round(taxRate * 100) / 100,
          taxAmount,
          serviceDate: new Date(),
          referenceType: 'ScheduledCharge',
          referenceId: charge.id,
          postedBy: user.id,
        },
      });

      // Update folio balance
      await tx.folio.update({
        where: { id: charge.folioId },
        data: {
          subtotal: { increment: charge.amount },
          taxes: { increment: taxAmount },
          totalAmount: { increment: totalWithTax },
          balance: { increment: totalWithTax },
        },
      });

      // Create execution record
      const execution = await tx.scheduledChargeExecution.create({
        data: {
          tenantId: charge.tenantId,
          scheduledChargeId: charge.id,
          folioId: charge.folioId,
          amount: charge.amount,
          currency: charge.currency,
          executedAt: new Date(),
          executionDate: new Date(),
          status: 'success',
          postedBy: user.id,
        },
      });

      // Update scheduled charge metadata
      const newExecutedCount = charge.executedCount + 1;
      let nextExecutionAt = charge.nextExecutionAt;

      if (charge.frequency !== 'once') {
        nextExecutionAt = calculateNextExecution(new Date(), charge.frequency);

        if (charge.endDate && nextExecutionAt > charge.endDate) {
          await tx.scheduledCharge.update({
            where: { id },
            data: { isActive: false, lastExecutedAt: new Date(), executedCount: newExecutedCount },
          });
        } else {
          await tx.scheduledCharge.update({
            where: { id },
            data: { nextExecutionAt, lastExecutedAt: new Date(), executedCount: newExecutedCount },
          });
        }
      } else {
        await tx.scheduledCharge.update({
          where: { id },
          data: { isActive: false, lastExecutedAt: new Date(), executedCount: newExecutedCount },
        });
      }

      return { lineItem, execution, newExecutedCount };
    });

    const { lineItem, execution, newExecutedCount } = result;

    // Audit log (non-blocking)
    try {
      await auditLogService.logWithContext(
        {
          tenantId: charge.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'payment',
          entityType: 'scheduled_charge',
          entityId: id,
          newValue: {
            amount: charge.amount,
            folioNumber: charge.folio.folioNumber,
            frequency: charge.frequency,
            executedCount: newExecutedCount,
          },
          description: `Manually executed scheduled charge: $${charge.amount} on folio ${charge.folio.folioNumber}`,
        },
        request,
      );
    } catch (auditErr) {
      console.error('[ScheduledCharges Execute] audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        execution,
        lineItemId: lineItem.id,
        amount: charge.amount,
        folioNumber: charge.folio.folioNumber,
        totalExecutions: newExecutedCount,
        isActive: charge.frequency !== 'once' && (!charge.endDate || calculateNextExecution(new Date(), charge.frequency) <= (charge.endDate || new Date('2099-12-31'))),
      },
    });
  } catch (error) {
    console.error('[ScheduledCharges Execute POST] Error:', error);

    // If execution fails mid-way and we have the charge data, create a failed execution record
    try {
      if (charge) {
        await db.scheduledChargeExecution.create({
          data: {
            tenantId: charge.tenantId,
            scheduledChargeId: charge.id,
            folioId: charge.folioId,
            amount: 0,
            status: 'failed',
            error: (error as Error).message,
            executedAt: new Date(),
            executionDate: new Date(),
          },
        });
      }
    } catch {
      // Best effort logging
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute scheduled charge' } }, { status: 500 });
  }
}

// ─── Helper: Calculate next execution date based on frequency ───
function calculateNextExecution(fromDate: Date, frequency: string): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}
