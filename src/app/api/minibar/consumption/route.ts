import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/minibar/consumption - List minibar consumptions with filters & pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const bookingId = searchParams.get('bookingId');
    const postedToFolio = searchParams.get('postedToFolio');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.MinibarConsumptionWhereInput = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (roomId) where.roomId = roomId;
    if (bookingId) where.bookingId = bookingId;
    if (postedToFolio !== null && postedToFolio !== undefined) {
      where.postedToFolio = postedToFolio === 'true';
    }
    if (dateFrom || dateTo) {
      where.consumedAt = {};
      if (dateFrom) where.consumedAt.gte = new Date(dateFrom);
      if (dateTo) where.consumedAt.lte = new Date(dateTo);
    }

    const [consumptions, total] = await Promise.all([
      db.minibarConsumption.findMany({
        where,
        include: {
          booking: {
            select: { id: true, confirmationCode: true, primaryGuest: { select: { id: true, firstName: true, lastName: true } } },
          },
          room: {
            select: { id: true, number: true, floor: true },
          },
          folio: {
            select: { id: true, folioNumber: true },
          },
        },
        orderBy: { consumedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.minibarConsumption.count({ where }),
    ]);

    // Calculate totals
    const totals = await db.minibarConsumption.aggregate({
      where,
      _sum: { totalPrice: true, quantity: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        consumptions,
        totals: {
          count: totals._count,
          totalAmount: totals._sum.totalPrice || 0,
          totalQuantity: totals._sum.quantity || 0,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/minibar/consumption]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/minibar/consumption - Log minibar consumption (auto-posts to folio)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, bookingId, folioId, roomId, itemId, itemName, quantity, unitPrice, consumedAt, notes } = body;

    if (!propertyId || !bookingId || !roomId || !itemId || !itemName) {
      return NextResponse.json({ success: false, error: 'propertyId, bookingId, roomId, itemId, and itemName are required' }, { status: 400 });
    }

    const qty = quantity || 1;
    const price = unitPrice || 0;
    const totalPrice = qty * price;
    const consumptionDate = consumedAt ? new Date(consumedAt) : new Date();

    // Resolve folio: use provided folioId or find active folio for the booking
    let resolvedFolioId = folioId;
    if (!resolvedFolioId) {
      const activeFolio = await db.folio.findFirst({
        where: {
          bookingId,
          status: 'open',
        },
      });
      if (activeFolio) {
        resolvedFolioId = activeFolio.id;
      }
    }

    // Validate folio exists and belongs to the booking
    let folio = null;
    if (resolvedFolioId) {
      folio = await db.folio.findFirst({
        where: { id: resolvedFolioId, bookingId, tenantId: user.tenantId },
      });
      if (!folio) {
        return NextResponse.json({ success: false, error: 'Folio not found for this booking' }, { status: 400 });
      }
    }

    // Create consumption record
    const consumption = await db.minibarConsumption.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        bookingId,
        folioId: resolvedFolioId,
        roomId,
        itemId,
        itemName,
        quantity: qty,
        unitPrice: price,
        totalPrice,
        consumedAt: consumptionDate,
        postedToFolio: false,
        consumedBy: user.id,
        notes: notes || null,
      },
    });

    // Auto-post to folio if an active folio exists
    if (folio && folio.status === 'open') {
      try {
        // FIX: Use $transaction for atomic folio operations + consistent balance formula
        await db.$transaction(async (tx) => {
          // M-4 FIX: Calculate tax from property tax settings
          let taxRate = 0;
          const prop = await tx.property.findFirst({
            where: { id: propertyId },
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
            } catch { taxRate = (prop.defaultTaxRate || 0) / 100; }
          }
          const taxAmount = Math.round(totalPrice * taxRate * 100) / 100;

          await tx.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: `Minibar: ${itemName} x${qty}`,
              category: 'minibar',
              quantity: qty,
              unitPrice: price,
              totalAmount: totalPrice,
              taxAmount,
              serviceDate: consumptionDate,
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
            where: { id: consumption.id },
            data: {
              postedToFolio: true,
              postedAt: new Date(),
            },
          });
        });

        consumption.postedToFolio = true;
        consumption.postedAt = new Date();
      } catch (folioError) {
        console.error('[POST /api/minibar/consumption] Auto-post to folio failed:', folioError);
        // Consumption is still created, just not posted
      }
    }

    return NextResponse.json({ success: true, data: consumption }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/minibar/consumption]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
