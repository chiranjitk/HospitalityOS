import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { postConsumptionToFolio } from '@/lib/minibar/auto-charge';

// POST /api/minibar/consumption/reconcile
// Reconcile a pending consumption (one without bookingId/folioId) to a booking.
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['minibar.manage', 'inventory.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { consumptionId, bookingId } = body;

    if (!consumptionId || !bookingId) {
      return NextResponse.json(
        { success: false, error: 'consumptionId and bookingId are required' },
        { status: 400 }
      );
    }

    // Find the consumption
    const consumption = await db.minibarConsumption.findFirst({
      where: {
        id: consumptionId,
        tenantId: user.tenantId,
        postedToFolio: false,
      },
    });

    if (!consumption) {
      return NextResponse.json(
        { success: false, error: 'Pending consumption not found or already posted' },
        { status: 404 }
      );
    }

    // Verify booking exists and belongs to tenant
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId: user.tenantId },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 400 });
    }

    // Find active folio for the booking
    const folio = await db.folio.findFirst({
      where: {
        bookingId,
        tenantId: user.tenantId,
        status: 'open',
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: 'No open folio found for this booking' },
        { status: 400 }
      );
    }

    // Update consumption with booking and folio
    await db.minibarConsumption.update({
      where: { id: consumptionId },
      data: {
        bookingId: booking.id,
        folioId: folio.id,
        consumedBy: user.id,
        notes: (consumption.notes || '').replace('Pending reconciliation.', '').replace('IoT auto-detected consumption — no active booking found. Pending reconciliation.', '').trim() + ' Reconciled to booking ' + booking.confirmationCode,
      },
    });

    // Post to folio
    try {
      const minibarItem = await db.minibarItem.findFirst({
        where: { id: consumption.itemId },
        select: { id: true, name: true, sellPrice: true, tenantId: true, propertyId: true },
      });

      if (minibarItem) {
        await postConsumptionToFolio(
          {
            id: consumption.id,
            totalPrice: consumption.totalPrice,
            quantity: consumption.quantity,
            unitPrice: consumption.unitPrice,
            itemName: consumption.itemName,
            consumedAt: consumption.consumedAt,
          },
          { id: folio.id, bookingId: booking.id, tenantId: user.tenantId, status: folio.status },
          user.tenantId,
          minibarItem,
        );
      }

      // Audit log
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'minibar',
          action: 'update',
          entityType: 'MinibarConsumption',
          entityId: consumptionId,
          oldValue: JSON.stringify({ previousStatus: 'pending' }),
          newValue: JSON.stringify({
            reconciledToBooking: booking.id,
            folioId: folio.id,
            folioPosted: true,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          consumptionId,
          bookingId,
          folioId: folio.id,
          folioPosted: true,
          message: 'Consumption reconciled and posted to folio',
        },
      });
    } catch (folioError) {
      console.error('[reconcile] Folio posting failed:', folioError);
      return NextResponse.json({
        success: true,
        data: {
          consumptionId,
          bookingId,
          folioId: folio.id,
          folioPosted: false,
          message: 'Consumption linked to booking but folio posting failed',
        },
      });
    }
  } catch (error) {
    console.error('[POST /api/minibar/consumption/reconcile]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
