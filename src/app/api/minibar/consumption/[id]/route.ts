import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/minibar/consumption/[id] - Get a single consumption record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const consumption = await db.minibarConsumption.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        room: {
          select: { id: true, name: true, roomNumber: true },
        },
        folio: {
          select: { id: true, folioNumber: true, status: true },
        },
      },
    });

    if (!consumption) {
      return NextResponse.json({ success: false, error: 'Consumption record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: consumption });
  } catch (error) {
    console.error('[GET /api/minibar/consumption/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/minibar/consumption/[id] - Update a consumption record (e.g., post to folio, update notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.minibarConsumption.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Consumption record not found' }, { status: 404 });
    }

    const { notes, quantity, unitPrice, consumedAt, postToFolio } = body;

    // Recalculate if quantity or price changed
    let totalPrice = existing.totalPrice;
    let recalc = false;
    if (quantity !== undefined || unitPrice !== undefined) {
      const qty = quantity ?? existing.quantity;
      const price = unitPrice ?? existing.unitPrice;
      totalPrice = qty * price;
      recalc = true;
    }

    const consumption = await db.minibarConsumption.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(quantity !== undefined && { quantity }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(recalc && { totalPrice }),
        ...(consumedAt !== undefined && { consumedAt: new Date(consumedAt) }),
      },
    });

    // Handle explicit post-to-folio request
    if (postToFolio && !existing.postedToFolio) {
      try {
        const folio = await db.folio.findFirst({
          where: {
            bookingId: existing.bookingId,
            status: 'open',
            tenantId: user.tenantId,
          },
        });

        if (folio) {
          await db.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: `Minibar: ${existing.itemName} x${consumption.quantity}`,
              category: 'minibar',
              quantity: consumption.quantity,
              unitPrice: consumption.unitPrice,
              totalAmount: consumption.totalPrice,
              serviceDate: consumption.consumedAt,
              referenceType: 'minibar_consumption',
              referenceId: consumption.id,
              postedBy: user.id,
            },
          });

          const newBalance = folio.balance + consumption.totalPrice;
          await db.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: { increment: consumption.totalPrice },
              totalAmount: { increment: consumption.totalPrice },
              balance: newBalance,
            },
          });

          const updated = await db.minibarConsumption.update({
            where: { id },
            data: { postedToFolio: true, postedAt: new Date() },
          });

          return NextResponse.json({ success: true, data: updated });
        }
      } catch (folioError) {
        console.error('[PATCH /api/minibar/consumption/[id]] Post to folio failed:', folioError);
        return NextResponse.json({
          success: true,
          data: { ...consumption, folioPostError: 'Failed to post to folio' },
        });
      }
    }

    return NextResponse.json({ success: true, data: consumption });
  } catch (error) {
    console.error('[PATCH /api/minibar/consumption/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
