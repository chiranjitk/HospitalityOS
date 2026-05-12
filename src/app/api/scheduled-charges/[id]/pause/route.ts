import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ─── POST: Pause a scheduled charge ───
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

    if (!charge.isActive) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Charge is already paused' } }, { status: 400 });
    }

    const updated = await db.scheduledCharge.update({
      where: { id },
      data: { isActive: false },
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
        action: 'pause',
        entityType: 'ScheduledCharge',
        entityId: id,
        newValue: `Paused scheduled charge: ${charge.description}`,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[ScheduledCharges Pause POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to pause scheduled charge' } }, { status: 500 });
  }
}
