import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/bookings/guarantees - List bookings requiring guarantees with overdue status
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const overdueOnly = searchParams.get('overdue') === 'true';
    const guaranteeType = searchParams.get('guaranteeType');

    const now = new Date();

    const where: Record<string, unknown> = {
      tenantId,
      depositRequired: true,
      guaranteeType: { not: 'none' },
    };

    if (propertyId) where.propertyId = propertyId;
    if (guaranteeType) where.guaranteeType = guaranteeType;

    if (overdueOnly) {
      where.depositPaid = false;
      where.depositDeadline = { lt: now };
    }

    const bookings = await db.booking.findMany({
      where,
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        roomType: {
          select: { id: true, name: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { depositDeadline: 'asc' },
    });

    // Calculate days until deadline for each booking
    const enriched = bookings.map((b) => {
      let daysUntilDeadline: number | null = null;
      let isOverdue = false;

      if (b.depositDeadline) {
        const diffMs = b.depositDeadline.getTime() - now.getTime();
        daysUntilDeadline = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isOverdue = diffMs < 0;
      }

      return {
        ...b,
        daysUntilDeadline,
        isOverdue,
        guaranteeStatus: b.depositPaid
          ? 'paid'
          : isOverdue
            ? 'overdue'
            : daysUntilDeadline !== null && daysUntilDeadline <= 3
              ? 'due_soon'
              : 'pending',
      };
    });

    // Stats
    const baseWhere: Record<string, unknown> = {
      tenantId,
      depositRequired: true,
      guaranteeType: { not: 'none' },
    };
    if (propertyId) baseWhere.propertyId = propertyId;

    const stats = {
      totalRequiringGuarantee: await db.booking.count({ where: baseWhere }),
      paid: await db.booking.count({ where: { ...baseWhere, depositPaid: true } }),
      pending: await db.booking.count({
        where: {
          ...baseWhere,
          depositPaid: false,
          depositDeadline: { gt: now },
        },
      }),
      overdue: await db.booking.count({
        where: {
          ...baseWhere,
          depositPaid: false,
          depositDeadline: { lt: now },
        },
      }),
      dueSoon: await db.booking.count({
        where: {
          ...baseWhere,
          depositPaid: false,
          depositDeadline: {
            gt: now,
            lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      totalDepositAmount: (
        await db.booking.aggregate({
          where: { ...baseWhere, depositPaid: true },
          _sum: { depositAmount: true },
        })
      )._sum.depositAmount || 0,
      outstandingAmount: (
        await db.booking.aggregate({
          where: { ...baseWhere, depositPaid: false },
          _sum: { depositAmount: true },
        })
      )._sum.depositAmount || 0,
    };

    return NextResponse.json({ success: true, data: enriched, stats });
  } catch (error) {
    console.error('[Guarantees] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guarantee bookings' } },
      { status: 500 }
    );
  }
}

// PUT /api/bookings/guarantees - Update guarantee status, mark deposit paid, attach card token
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { bookingId, depositPaid, guaranteeCardToken, guaranteeReference, guaranteeType, notes } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (depositPaid !== undefined) updateData.depositPaid = depositPaid;
    if (guaranteeCardToken !== undefined) updateData.guaranteeCardToken = guaranteeCardToken;
    if (guaranteeReference !== undefined) updateData.guaranteeReference = guaranteeReference;
    if (guaranteeType !== undefined) updateData.guaranteeType = guaranteeType;
    if (notes !== undefined) updateData.internalNotes = notes;

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        roomType: { select: { id: true, name: true } },
      },
    });

    // Create audit log entry
    if (depositPaid && !booking.depositPaid) {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'bookings',
          action: 'guarantee.deposit_paid',
          entityType: 'Booking',
          entityId: bookingId,
          newValue: JSON.stringify({ depositPaid: true, amount: booking.depositAmount }),
          userId: auth.userId,
        },
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Guarantees] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update guarantee' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings/guarantees - Auto-enforce guarantee deadlines - cancel bookings past deposit deadline
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const now = new Date();

    // Find all bookings past deposit deadline without payment
    const overdueBookings = await db.booking.findMany({
      where: {
        tenantId,
        depositRequired: true,
        depositPaid: false,
        guaranteeType: { not: 'none' },
        depositDeadline: { lt: now },
        status: { in: ['confirmed', 'tentative'] },
      },
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    if (overdueBookings.length === 0) {
      return NextResponse.json({
        success: true,
        data: { processedCount: 0, cancelledCount: 0 },
        message: 'No overdue guarantee bookings found',
      });
    }

    let cancelledCount = 0;
    const results: Array<{ bookingId: string; confirmationCode: string; cancelled: boolean; reason: string }> = [];

    for (const booking of overdueBookings) {
      try {
        // Cancel the booking
        await db.booking.update({
          where: { id: booking.id },
          data: {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: 'system',
            cancellationReason: 'Auto-cancelled: Deposit deadline passed without payment',
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'bookings',
            action: 'guarantee.auto_cancel',
            entityType: 'Booking',
            entityId: booking.id,
            oldValue: JSON.stringify({ status: booking.status }),
            newValue: JSON.stringify({ status: 'cancelled', reason: 'Deposit deadline passed' }),
          },
        });

        // Create notification
        await db.notification.create({
          data: {
            tenantId,
            userId: booking.primaryGuestId,
            type: 'booking',
            category: 'warning',
            title: 'Booking Auto-Cancelled',
            message: `Your booking ${booking.confirmationCode} at ${booking.property.name} has been auto-cancelled because the deposit deadline has passed without payment. Please contact the hotel for assistance.`,
            priority: 'high',
          },
        });

        cancelledCount++;
        results.push({
          bookingId: booking.id,
          confirmationCode: booking.confirmationCode,
          cancelled: true,
          reason: 'Deposit deadline passed',
        });
      } catch (bookingError) {
        console.error(`[Guarantees] Failed to cancel booking ${booking.id}:`, bookingError);
        results.push({
          bookingId: booking.id,
          confirmationCode: booking.confirmationCode,
          cancelled: false,
          reason: `Error: ${bookingError}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount: overdueBookings.length,
        cancelledCount,
        results,
      },
      message: `Auto-enforcement complete: ${cancelledCount} booking(s) cancelled out of ${overdueBookings.length} overdue`,
    });
  } catch (error) {
    console.error('[Guarantees] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to auto-enforce guarantee deadlines' } },
      { status: 500 }
    );
  }
}
