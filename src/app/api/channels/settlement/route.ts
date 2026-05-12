import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Helper: get authenticated user
async function getUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return null;
  }
  return user;
}

// Helper: auth + permission check
function checkPerm(user: any, perm: string) {
  return hasPermission(user, perm);
}

// ============================================================
// GET /api/channels/settlement
// Supports:
//   - List settlements (with filters)
//   - action=discrepancy-report  → items with discrepancies
//   - action=summary            → financial summary by channel
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = user.tenantId;

    // ---- Discrepancy Report ----
    if (action === 'discrepancy-report') {
      const discrepancyItems = await db.channelSettlementItem.findMany({
        where: {
          tenantId,
          status: { in: ['discrepancy', 'missing', 'overpaid'] },
          discrepancy: { not: 0 },
        },
        include: {
          settlement: {
            select: {
              id: true,
              settlementRef: true,
              channelCode: true,
              periodFrom: true,
              periodTo: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      const totalDiscrepancy = discrepancyItems.reduce(
        (sum, item) => sum + Math.abs(item.discrepancy),
        0
      );

      return NextResponse.json({
        success: true,
        data: discrepancyItems,
        stats: {
          totalItems: discrepancyItems.length,
          totalDiscrepancy,
          byStatus: {
            discrepancy: discrepancyItems.filter(i => i.status === 'discrepancy').length,
            missing: discrepancyItems.filter(i => i.status === 'missing').length,
            overpaid: discrepancyItems.filter(i => i.status === 'overpaid').length,
          },
        },
      });
    }

    // ---- Financial Summary by Channel ----
    if (action === 'summary') {
      const settlements = await db.channelSettlement.findMany({
        where: { tenantId },
        select: {
          channelCode: true,
          totalGross: true,
          totalCommission: true,
          totalNet: true,
          totalReceived: true,
          status: true,
        },
      });

      const channelMap: Record<string, {
        channelCode: string;
        totalGross: number;
        totalCommission: number;
        totalNet: number;
        totalReceived: number;
        outstanding: number;
        count: number;
        pending: number;
        received: number;
        disputed: number;
      }> = {};

      for (const s of settlements) {
        if (!channelMap[s.channelCode]) {
          channelMap[s.channelCode] = {
            channelCode: s.channelCode,
            totalGross: 0,
            totalCommission: 0,
            totalNet: 0,
            totalReceived: 0,
            outstanding: 0,
            count: 0,
            pending: 0,
            received: 0,
            disputed: 0,
          };
        }
        const ch = channelMap[s.channelCode];
        ch.totalGross += s.totalGross;
        ch.totalCommission += s.totalCommission;
        ch.totalNet += s.totalNet;
        ch.totalReceived += s.totalReceived;
        ch.outstanding += s.totalNet - s.totalReceived;
        ch.count++;
        if (s.status === 'pending') ch.pending++;
        if (s.status === 'received' || s.status === 'reconciled') ch.received++;
        if (s.status === 'disputed') ch.disputed++;
      }

      return NextResponse.json({
        success: true,
        data: Object.values(channelMap),
        totals: {
          totalGross: settlements.reduce((s, x) => s + x.totalGross, 0),
          totalCommission: settlements.reduce((s, x) => s + x.totalCommission, 0),
          totalNet: settlements.reduce((s, x) => s + x.totalNet, 0),
          totalReceived: settlements.reduce((s, x) => s + x.totalReceived, 0),
          totalOutstanding: settlements.reduce((s, x) => s + (x.totalNet - x.totalReceived), 0),
        },
      });
    }

    // ---- List Settlements (default) ----
    const connectionId = searchParams.get('connectionId') || undefined;
    const status = searchParams.get('status') || undefined;
    const periodFrom = searchParams.get('periodFrom');
    const periodTo = searchParams.get('periodTo');

    const where: any = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (status) where.status = status;
    if (periodFrom || periodTo) {
      where.periodFrom = {};
      if (periodFrom) where.periodFrom.gte = new Date(periodFrom);
      if (periodTo) where.periodFrom.lte = new Date(periodTo);
    }

    const settlements = await db.channelSettlement.findMany({
      where,
      include: {
        settlementItems: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { periodFrom: 'desc' },
      take: 200,
    });

    // Stats
    const allSettlements = await db.channelSettlement.findMany({
      where: { tenantId },
    });
    const stats = {
      total: allSettlements.length,
      totalSettled: allSettlements
        .filter(s => s.status === 'received' || s.status === 'reconciled')
        .reduce((sum, s) => sum + s.totalNet, 0),
      pending: allSettlements
        .filter(s => s.status === 'pending' || s.status === 'partial')
        .reduce((sum, s) => sum + (s.totalNet - s.totalReceived), 0),
      disputed: allSettlements
        .filter(s => s.status === 'disputed')
        .reduce((sum, s) => sum + s.totalNet, 0),
      totalGross: allSettlements.reduce((s, x) => s + x.totalGross, 0),
      totalCommission: allSettlements.reduce((s, x) => s + x.totalCommission, 0),
      totalNet: allSettlements.reduce((s, x) => s + x.totalNet, 0),
      totalReceived: allSettlements.reduce((s, x) => s + x.totalReceived, 0),
    };

    return NextResponse.json({
      success: true,
      data: settlements,
      stats,
    });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settlements' } },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/channels/settlement
// Supports:
//   - Create settlement (with items)
//   - action=reconcile        → auto-reconcile a settlement
//   - action=mark-received    → mark settlement as received
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;
    const tenantId = user.tenantId;

    // ---- Auto-Reconcile a Settlement ----
    if (action === 'reconcile' && body.settlementId) {
      const settlement = await db.channelSettlement.findFirst({
        where: { id: body.settlementId, tenantId },
        include: { settlementItems: true },
      });

      if (!settlement) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
          { status: 404 }
        );
      }

      // Get bookings from this tenant that fall within settlement period
      const bookings = await db.booking.findMany({
        where: {
          tenantId,
          checkIn: { gte: settlement.periodFrom, lte: settlement.periodTo },
          status: { notIn: ['cancelled', 'draft'] },
        },
        include: {
          primaryGuest: { select: { firstName: true, lastName: true } },
          roomType: { select: { name: true } },
        },
      });

      let matched = 0;
      let discrepancies = 0;
      let missing = 0;
      const updatePromises: any[] = [];

      for (const item of settlement.settlementItems) {
        // Try to match by channelBookingRef (externalRef on booking)
        let matchedBooking = bookings.find(
          b => b.externalRef === item.channelBookingRef
        );

        // Try to match by guest name + check-in date
        if (!matchedBooking && item.guestName && item.checkIn) {
          matchedBooking = bookings.find(
            b =>
              `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`.toLowerCase().trim() ===
                item.guestName!.toLowerCase().trim() &&
              b.checkIn.toISOString().slice(0, 10) ===
                item.checkIn!.toISOString().slice(0, 10)
          );
        }

        // Try to match by gross amount + check-in date (within 1 day)
        if (!matchedBooking && item.grossAmount > 0 && item.checkIn) {
          const dayBefore = new Date(item.checkIn);
          dayBefore.setDate(dayBefore.getDate() - 1);
          const dayAfter = new Date(item.checkIn);
          dayAfter.setDate(dayAfter.getDate() + 1);
          matchedBooking = bookings.find(
            b =>
              Math.abs(b.totalAmount - item.grossAmount) < 1 &&
              b.checkIn >= dayBefore &&
              b.checkIn <= dayAfter
          );
        }

        if (matchedBooking) {
          const discrepancy = item.netAmount - matchedBooking.totalAmount;
          const status = Math.abs(discrepancy) < 1 ? 'matched' : 'discrepancy';
          if (status === 'matched') matched++;
          else discrepancies++;

          updatePromises.push(
            db.channelSettlementItem.update({
              where: { id: item.id },
              data: {
                bookingId: matchedBooking.id,
                receivedAmount: matchedBooking.totalAmount,
                discrepancy: Math.round(discrepancy * 100) / 100,
                status,
                matchedAt: new Date(),
              },
            })
          );
        } else {
          missing++;
          updatePromises.push(
            db.channelSettlementItem.update({
              where: { id: item.id },
              data: { status: 'missing' },
            })
          );
        }
      }

      await Promise.all(updatePromises);

      // Update settlement status
      const totalItems = settlement.settlementItems.length;
      const newStatus =
        missing === 0 && discrepancies === 0
          ? 'reconciled'
          : missing === totalItems
            ? 'disputed'
            : 'partial';

      await db.channelSettlement.update({
        where: { id: settlement.id },
        data: { status: newStatus },
      });

      return NextResponse.json({
        success: true,
        message: `Reconciliation complete: ${matched} matched, ${discrepancies} discrepancies, ${missing} missing`,
        data: { matched, discrepancies, missing, newStatus },
      });
    }

    // ---- Mark Settlement as Received ----
    if (action === 'mark-received' && body.settlementId) {
      const amountReceived = body.amountReceived ?? 0;
      const settlement = await db.channelSettlement.findFirst({
        where: { id: body.settlementId, tenantId },
      });

      if (!settlement) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
          { status: 404 }
        );
      }

      const totalReceived = settlement.totalReceived + amountReceived;
      const newStatus =
        totalReceived >= settlement.totalNet ? 'received' : 'partial';

      const updated = await db.channelSettlement.update({
        where: { id: settlement.id },
        data: {
          totalReceived,
          status: newStatus,
          settlementDate: settlement.settlementDate || new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Settlement marked as ${newStatus}`,
        data: updated,
      });
    }

    // ---- Create Settlement (default) ----
    const {
      connectionId,
      channelCode,
      settlementRef,
      periodFrom,
      periodTo,
      totalBookings,
      totalGross,
      totalCommission,
      totalNet,
      totalReceived,
      currency,
      settlementDate,
      dueDate,
      notes,
      rawSettlement,
      items,
    } = body;

    if (!connectionId || !channelCode || !settlementRef || !periodFrom || !periodTo) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: connectionId, channelCode, settlementRef, periodFrom, periodTo' } },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await db.channelSettlement.findFirst({
      where: {
        tenantId,
        connectionId,
        settlementRef,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Settlement with this reference already exists' } },
        { status: 409 }
      );
    }

    const settlement = await db.channelSettlement.create({
      data: {
        tenantId,
        connectionId,
        channelCode,
        settlementRef,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        totalBookings: totalBookings || 0,
        totalGross: totalGross || 0,
        totalCommission: totalCommission || 0,
        totalNet: totalNet || 0,
        totalReceived: totalReceived || 0,
        currency: currency || 'USD',
        settlementDate: settlementDate ? new Date(settlementDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        rawSettlement: rawSettlement || null,
        settlementItems: items
          ? {
              create: items.map((item: any) => ({
                tenantId,
                bookingId: item.bookingId || null,
                channelBookingRef: item.channelBookingRef || null,
                guestName: item.guestName || null,
                checkIn: item.checkIn ? new Date(item.checkIn) : null,
                checkOut: item.checkOut ? new Date(item.checkOut) : null,
                roomType: item.roomType || null,
                grossAmount: item.grossAmount || 0,
                commissionAmount: item.commissionAmount || 0,
                netAmount: item.netAmount || 0,
                receivedAmount: item.receivedAmount || 0,
                discrepancy: item.discrepancy || 0,
                status: item.status || 'matched',
              })),
            }
          : undefined,
      },
      include: { settlementItems: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Settlement created successfully',
      data: settlement,
    });
  } catch (error) {
    console.error('Error creating settlement:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create settlement' } },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /api/channels/settlement
// Update settlement status or fields
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, notes, dueDate } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Settlement ID is required' } },
        { status: 400 }
      );
    }

    const settlement = await db.channelSettlement.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!settlement) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await db.channelSettlement.update({
      where: { id },
      data: updateData,
      include: { settlementItems: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Settlement updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating settlement:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settlement' } },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/channels/settlement
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Settlement ID is required' } },
        { status: 400 }
      );
    }

    const settlement = await db.channelSettlement.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!settlement) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
        { status: 404 }
      );
    }

    // Delete items first, then settlement (cascade)
    await db.channelSettlementItem.deleteMany({
      where: { settlementId: id },
    });

    await db.channelSettlement.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Settlement deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete settlement' } },
      { status: 500 }
    );
  }
}
