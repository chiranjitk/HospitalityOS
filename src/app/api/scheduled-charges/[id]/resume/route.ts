import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ─── POST: Resume a paused scheduled charge ───
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.edit') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const charge = await db.scheduledCharge.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!charge) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled charge not found' } }, { status: 404 });
    }

    if (charge.isActive) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Charge is already active' } }, { status: 400 });
    }

    // Recalculate next execution from now
    const nextExecution = calculateNextExecution(new Date(), charge.frequency);

    const updated = await db.scheduledCharge.update({
      where: { id },
      data: { isActive: true, nextExecutionAt: nextExecution },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        folio: { select: { id: true, folioNumber: true, status: true, balance: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'scheduled-charges',
        action: 'resume',
        entityType: 'ScheduledCharge',
        entityId: id,
        newValue: `Resumed scheduled charge: ${charge.description}`,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[ScheduledCharges Resume POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resume scheduled charge' } }, { status: 500 });
  }
}

// ─── Helper ───
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
