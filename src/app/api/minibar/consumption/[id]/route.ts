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
          select: { id: true, number: true, floor: true },
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
            status: { in: ['open', 'partially_paid'] },
            tenantId: user.tenantId,
          },
        });

        if (folio) {
          // FIX: Use $transaction for atomic folio operations + consistent balance formula
          await db.$transaction(async (tx) => {
            // M-4 FIX: Calculate tax from property tax settings
            let taxRate = 0;
            const prop = await tx.property.findFirst({
              where: { id: existing.propertyId },
              select: { defaultTaxRate: true, taxComponents: true },
            });
            if (prop) {
              try {
                const tc = JSON.parse(prop.taxComponents || '[]');
                if (Array.isArray(tc) && tc.length > 0) {
                  taxRate = tc.reduce((sum: number, c: { rate: number }) => sum + (c.rate || 0), 0) / 100;
                } else {
                  taxRate = (prop.defaultTaxRate || 0) / 100;
                }
              } catch {
                taxRate = (prop.defaultTaxRate || 0) / 100;
              }
            }
            const taxAmount = Math.round(consumption.totalPrice * taxRate * 100) / 100;

            await tx.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: `Minibar: ${existing.itemName} x${consumption.quantity}`,
                category: 'minibar',
                quantity: consumption.quantity,
                unitPrice: consumption.unitPrice,
                totalAmount: consumption.totalPrice,
                taxAmount,
                serviceDate: consumption.consumedAt,
                referenceType: 'minibar_consumption',
                referenceId: consumption.id,
                postedBy: user.id,
              },
            });

            // Recalculate folio totals from ALL line items (consistent pattern)
            const allLineItems = await tx.folioLineItem.findMany({
              where: { folioId: folio.id },
              select: { totalAmount: true, taxAmount: true },
            });
            const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
            const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
            const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

            await tx.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance: newTotal - (folio.paidAmount || 0),
              },
            });

            // Mark consumption as posted
            await tx.minibarConsumption.update({
              where: { id },
              data: { postedToFolio: true, postedAt: new Date() },
            });
          });

          consumption.postedToFolio = true;
          consumption.postedAt = new Date();

          return NextResponse.json({ success: true, data: consumption });
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
