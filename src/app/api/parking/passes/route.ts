import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/parking/passes - List parking passes
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'parking.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'all') where.status = status;

    // Auto-expire passes
    await db.parkingPass.updateMany({
      where: {
        tenantId: user.tenantId,
        status: 'active',
        endDate: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    const passes = await db.parkingPass.findMany({
      where,
      include: {
        slot: { select: { id: true, number: true, floor: true, type: true } },
        vehicle: { select: { id: true, licensePlate: true, make: true, model: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: passes.length,
      active: passes.filter(p => p.status === 'active').length,
      expired: passes.filter(p => p.status === 'expired').length,
      suspended: passes.filter(p => p.status === 'suspended').length,
      cancelled: passes.filter(p => p.status === 'cancelled').length,
      totalRevenue: passes.filter(p => p.paymentStatus === 'paid').reduce((acc, p) => acc + p.amount, 0),
    };

    return NextResponse.json({ success: true, data: passes, stats });
  } catch (error) {
    console.error('Error fetching parking passes:', error);
    return NextResponse.json({ error: 'Failed to fetch parking passes' }, { status: 500 });
  }
}

// POST /api/parking/passes - Create a new parking pass
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'parking.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId, vehicleId, slotId, holderName, holderEmail, holderPhone,
      licensePlate, startDate, duration, amount, autoRenew,
    } = body;

    if (!propertyId || !holderName || !licensePlate || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, holderName, licensePlate, startDate' },
        { status: 400 }
      );
    }

    // Calculate end date based on duration
    const start = new Date(startDate);
    let endDate = new Date(start);

    switch (duration) {
      case 'weekly': endDate.setDate(endDate.getDate() + 7); break;
      case 'monthly': endDate.setMonth(endDate.getMonth() + 1); break;
      case 'quarterly': endDate.setMonth(endDate.getMonth() + 3); break;
      case 'yearly': endDate.setFullYear(endDate.getFullYear() + 1); break;
      default: endDate.setMonth(endDate.getMonth() + 1); break;
    }

    const pass = await db.$transaction(async (tx) => {
      const newPass = await tx.parkingPass.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          vehicleId: vehicleId || null,
          slotId: slotId || null,
          holderName,
          holderEmail: holderEmail || null,
          holderPhone: holderPhone || null,
          licensePlate,
          startDate: start,
          endDate,
          duration: duration || 'monthly',
          amount: amount || 0,
          currency: 'USD',
          status: 'active',
          autoRenew: autoRenew || false,
          paymentStatus: amount > 0 ? 'paid' : 'pending',
        },
        include: {
          slot: { select: { id: true, number: true, floor: true } },
          vehicle: { select: { id: true, licensePlate: true, make: true, model: true } },
        },
      });

      // Update slot status if a slot is assigned
      if (slotId) {
        await tx.parkingSlot.update({
          where: { id: slotId },
          data: { status: 'reserved' },
        });
      }

      return newPass;
    });

    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    console.error('Error creating parking pass:', error);
    return NextResponse.json({ error: 'Failed to create parking pass' }, { status: 500 });
  }
}

// PUT /api/parking/passes - Renew/suspend/cancel pass
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'parking.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields: id, action' }, { status: 400 });
    }

    const existing = await db.parkingPass.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
    }

    let updated;
    switch (action) {
      case 'renew': {
        const newEndDate = new Date(existing.endDate);
        switch (existing.duration) {
          case 'weekly': newEndDate.setDate(newEndDate.getDate() + 7); break;
          case 'monthly': newEndDate.setMonth(newEndDate.getMonth() + 1); break;
          case 'quarterly': newEndDate.setMonth(newEndDate.getMonth() + 3); break;
          case 'yearly': newEndDate.setFullYear(newEndDate.getFullYear() + 1); break;
        }
        updated = await db.parkingPass.update({
          where: { id },
          data: { endDate: newEndDate, status: 'active', startDate: new Date(existing.endDate) },
        });
        break;
      }
      case 'suspend':
        updated = await db.parkingPass.update({
          where: { id },
          data: { status: 'suspended' },
        });
        break;
      case 'cancel':
        updated = await db.parkingPass.update({
          where: { id },
          data: { status: 'cancelled' },
        });
        if (existing.slotId) {
          await db.parkingSlot.update({
            where: { id: existing.slotId },
            data: { status: 'available' },
          });
        }
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: renew, suspend, cancel' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating parking pass:', error);
    return NextResponse.json({ error: 'Failed to update parking pass' }, { status: 500 });
  }
}
