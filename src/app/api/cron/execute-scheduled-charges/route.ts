import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── POST: Cron endpoint to auto-execute due scheduled charges ───
// This endpoint is called by a cron scheduler to process all scheduled charges
// whose nextExecutionAt is on or before the current time.
export async function POST(request: NextRequest) {
  try {
    // Simple API key check for cron endpoint
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET environment variable is not set. Refusing to process.');
      return NextResponse.json({ success: false, error: { code: 'CONFIG_ERROR', message: 'Cron secret not configured' } }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron credentials' } }, { status: 401 });
    }

    const now = new Date();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Find all scheduled charges that are due
    const dueCharges = await db.scheduledCharge.findMany({
      where: {
        isActive: true,
        nextExecutionAt: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      include: {
        folio: { select: { id: true, folioNumber: true, status: true } },
        booking: { select: { id: true, confirmationCode: true, status: true } },
      },
      take: 500, // Process in batches to prevent timeouts
    });

    for (const charge of dueCharges) {
      processed++;

      try {
        // Validate charge prerequisites
        if (charge.folio.status !== 'open') {
          skipped++;
          await db.scheduledCharge.update({
            where: { id: charge.id },
            data: { isActive: false },
          });
          continue;
        }

        // Check max amount cap
        if (charge.maxAmount) {
          const totalExecuted = await db.scheduledChargeExecution.aggregate({
            where: { scheduledChargeId: charge.id, status: 'success' },
            _sum: { amount: true },
          });
          const totalSoFar = totalExecuted._sum.amount || 0;
          if (totalSoFar + charge.amount > charge.maxAmount) {
            await db.scheduledCharge.update({
              where: { id: charge.id },
              data: { isActive: false },
            });
            skipped++;
            continue;
          }
        }

        // Execute: create folio line item
        await db.folioLineItem.create({
          data: {
            folioId: charge.folioId,
            description: `${charge.description} (Auto-scheduled - ${charge.frequency})`,
            category: charge.category || charge.chargeType,
            quantity: 1,
            unitPrice: charge.amount,
            totalAmount: charge.amount,
            serviceDate: now,
            referenceType: 'ScheduledCharge',
            referenceId: charge.id,
            postedBy: 'system',
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
        await db.scheduledChargeExecution.create({
          data: {
            tenantId: charge.tenantId,
            scheduledChargeId: charge.id,
            folioId: charge.folioId,
            amount: charge.amount,
            currency: charge.currency,
            executedAt: now,
            executionDate: now,
            status: 'success',
            postedBy: 'system',
          },
        });

        // Calculate next execution
        const newExecutedCount = charge.executedCount + 1;
        const nextExecutionAt = calculateNextExecution(now, charge.frequency);

        if (charge.frequency === 'once' || (charge.endDate && nextExecutionAt > charge.endDate)) {
          // Deactivate: one-time charge or past end date
          await db.scheduledCharge.update({
            where: { id: charge.id },
            data: { isActive: false, lastExecutedAt: now, executedCount: newExecutedCount },
          });
        } else {
          await db.scheduledCharge.update({
            where: { id: charge.id },
            data: { nextExecutionAt, lastExecutedAt: now, executedCount: newExecutedCount },
          });
        }

        succeeded++;
      } catch (err) {
        failed++;

        // Create failed execution record
        try {
          await db.scheduledChargeExecution.create({
            data: {
              tenantId: charge.tenantId,
              scheduledChargeId: charge.id,
              folioId: charge.folioId,
              amount: 0,
              currency: charge.currency,
              executedAt: now,
              executionDate: now,
              status: 'failed',
              error: (err as Error).message,
              postedBy: 'system',
            },
          });
        } catch {
          // Best effort
        }

        errors.push(`Charge ${charge.id}: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        executedAt: now.toISOString(),
        processed,
        succeeded,
        failed,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Cron ExecuteScheduledCharges] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Cron execution failed' } }, { status: 500 });
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
