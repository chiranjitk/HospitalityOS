import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const updateChargeSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  currency: z.string().length(3).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).optional(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  maxAmount: z.number().positive().optional().nullable(),
});

// ─── GET: Get single scheduled charge ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.view') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const charge = await db.scheduledCharge.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
            checkIn: true,
            checkOut: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        folio: { select: { id: true, folioNumber: true, status: true, balance: true, totalAmount: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!charge) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled charge not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: charge });
  } catch (error) {
    console.error('[ScheduledCharges GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch scheduled charge' } }, { status: 500 });
  }
}

// ─── PATCH: Update scheduled charge (pause/resume, modify amount) ───
export async function PATCH(
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
    const body = await request.json();
    const parsed = updateChargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const existing = await db.scheduledCharge.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled charge not found' } }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const charge = await db.scheduledCharge.update({
      where: { id },
      data: updateData,
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
        action: 'update',
        entityType: 'ScheduledCharge',
        entityId: id,
        oldValue: `$${existing.amount}/${existing.frequency} (${existing.isActive ? 'active' : 'paused'})`,
        newValue: `$${charge.amount}/${charge.frequency} (${charge.isActive ? 'active' : 'paused'})`,
      },
    });

    return NextResponse.json({ success: true, data: charge });
  } catch (error) {
    console.error('[ScheduledCharges PATCH/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update scheduled charge' } }, { status: 500 });
  }
}
