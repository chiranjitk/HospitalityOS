import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

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

    // Execute the charge: create folio line item
    const lineItem = await db.folioLineItem.create({
      data: {
        folioId: charge.folioId,
        description: `${charge.description} (Scheduled - ${charge.frequency})`,
        category: charge.category || charge.chargeType,
        quantity: 1,
        unitPrice: charge.amount,
        totalAmount: charge.amount,
        serviceDate: new Date(),
        referenceType: 'ScheduledCharge',
        referenceId: charge.id,
        postedBy: user.id,
      },
    });

    // Update folio balance
    await db.folio.update({
      where: { id: charge.folioId },
      data: {
        subtotal: { increment: charge.amount },
        totalAmount: { increment: charge.amount },
        balance: { increment: charge.amount },
      },
    });

    // Create execution record
    const execution = await db.scheduledChargeExecution.create({
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

    // Update scheduled charge
    const newExecutedCount = charge.executedCount + 1;
    let nextExecutionAt = charge.nextExecutionAt;

    // For recurring charges, calculate next execution
    if (charge.frequency !== 'once') {
      nextExecutionAt = calculateNextExecution(new Date(), charge.frequency);

      // Auto-deactivate if past end date
      if (charge.endDate && nextExecutionAt > charge.endDate) {
        await db.scheduledCharge.update({
          where: { id },
          data: { isActive: false, lastExecutedAt: new Date(), executedCount: newExecutedCount },
        });
      } else {
        await db.scheduledCharge.update({
          where: { id },
          data: { nextExecutionAt, lastExecutedAt: new Date(), executedCount: newExecutedCount },
        });
      }
    } else {
      // One-time charge: deactivate after execution
      await db.scheduledCharge.update({
        where: { id },
        data: { isActive: false, lastExecutedAt: new Date(), executedCount: newExecutedCount },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: charge.tenantId,
        userId: user.id,
        module: 'scheduled-charges',
        action: 'execute',
        entityType: 'ScheduledCharge',
        entityId: id,
        newValue: `Manually executed scheduled charge: $${charge.amount} on folio ${charge.folio.folioNumber}`,
      },
    });

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

    // If execution fails mid-way, create a failed execution record
    if (params) {
      try {
        const { id } = await params;
        await db.scheduledChargeExecution.create({
          data: {
            tenantId: '00000000-0000-0000-0000-000000000000',
            scheduledChargeId: id,
            folioId: '00000000-0000-0000-0000-000000000000',
            amount: 0,
            status: 'failed',
            error: (error as Error).message,
            executedAt: new Date(),
            executionDate: new Date(),
          },
        });
      } catch {
        // Best effort logging
      }
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
