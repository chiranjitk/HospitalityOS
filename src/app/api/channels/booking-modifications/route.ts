import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ──────────────────────────────────────────────
// GET /api/channels/booking-modifications
// List modifications with filtering. Pass ?action=summary for stats.
// ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view booking modifications' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = user.tenantId;

    // ── Summary endpoint ──
    if (action === 'summary') {
      const [all, byStatus, byType, byChannel] = await Promise.all([
        db.bookingModification.count({ where: { tenantId } }),
        db.bookingModification.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { status: true },
        }),
        db.bookingModification.groupBy({
          by: ['modificationType'],
          where: { tenantId },
          _count: { modificationType: true },
        }),
        db.bookingModification.groupBy({
          by: ['channelCode'],
          where: { tenantId },
          _count: { channelCode: true },
        }),
      ]);

      const priceResult = await db.bookingModification.aggregate({
        where: { tenantId },
        _sum: { priceDifference: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          total: all,
          byStatus: Object.fromEntries(byStatus.map(b => [b.status, b._count.status])),
          byType: Object.fromEntries(byType.map(b => [b.modificationType, b._count.modificationType])),
          byChannel: Object.fromEntries(byChannel.map(b => [b.channelCode, b._count.channelCode])),
          totalPriceDifference: Math.round((priceResult._sum.priceDifference || 0) * 100) / 100,
        },
      });
    }

    // ── List endpoint with filters ──
    const connectionId = searchParams.get('connectionId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const modificationType = searchParams.get('modificationType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;
    if (modificationType) where.modificationType = modificationType;

    const [modifications, total] = await Promise.all([
      db.bookingModification.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.bookingModification.count({ where }),
    ]);

    // Stats alongside list
    const stats = await db.bookingModification.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    });

    return NextResponse.json({
      success: true,
      data: modifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map(s => [s.status, s._count.status])),
    });
  } catch (error) {
    console.error('Error fetching booking modifications:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking modifications' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/channels/booking-modifications
// Create a modification request (simulates OTA amendment)
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create booking modifications' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      connectionId,
      channelCode,
      bookingId,
      channelBookingRef,
      modificationType,
      previousValue,
      newValue,
      previousCheckIn,
      newCheckIn,
      previousCheckOut,
      newCheckOut,
      previousRoomType,
      newRoomType,
      previousAdults,
      newAdults,
      previousChildren,
      newChildren,
      previousRate,
      newRate,
      priceDifference,
      autoApply,
      requiresApproval,
    } = body;

    if (!channelCode || !modificationType) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode and modificationType are required' } },
        { status: 400 }
      );
    }

    // For auto-apply modifications, skip approval and apply immediately
    const willAutoApply = autoApply === true && requiresApproval !== true;
    const finalStatus = willAutoApply ? 'applied' : 'pending';

    const modification = await db.bookingModification.create({
      data: {
        tenantId: user.tenantId,
        connectionId: connectionId || null,
        channelCode,
        bookingId: bookingId || null,
        channelBookingRef: channelBookingRef || null,
        modificationType,
        previousValue: previousValue || null,
        newValue: newValue || null,
        previousCheckIn: previousCheckIn ? new Date(previousCheckIn) : null,
        newCheckIn: newCheckIn ? new Date(newCheckIn) : null,
        previousCheckOut: previousCheckOut ? new Date(previousCheckOut) : null,
        newCheckOut: newCheckOut ? new Date(newCheckOut) : null,
        previousRoomType: previousRoomType || null,
        newRoomType: newRoomType || null,
        previousAdults: previousAdults ?? null,
        newAdults: newAdults ?? null,
        previousChildren: previousChildren ?? null,
        newChildren: newChildren ?? null,
        previousRate: previousRate ?? null,
        newRate: newRate ?? null,
        priceDifference: priceDifference ?? 0,
        status: finalStatus,
        autoApply: autoApply ?? false,
        requiresApproval: requiresApproval ?? true,
        requestedAt: new Date(),
        processedAt: willAutoApply ? new Date() : null,
        processedBy: willAutoApply ? user.id : null,
      },
    });

    // If auto-applied, also update the underlying booking
    if (willAutoApply && bookingId) {
      try {
        const booking = await db.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId } });
        if (!booking) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
            { status: 404 }
          );
        }
        if (booking) {
          const updateData: Record<string, unknown> = {};
          if (newCheckIn) updateData.checkIn = new Date(newCheckIn);
          if (newCheckOut) updateData.checkOut = new Date(newCheckOut);
          if (newAdults !== undefined && newAdults !== null) updateData.adults = newAdults;
          if (newChildren !== undefined && newChildren !== null) updateData.children = newChildren;
          if (newRate !== undefined && newRate !== null) updateData.roomRate = newRate;

          if (Object.keys(updateData).length > 0) {
            await db.booking.update({
              where: { id: bookingId },
              data: updateData,
            });
          }
        }
      } catch (bookingErr) {
        // Mark as failed if booking update fails
        await db.bookingModification.update({
          where: { id: modification.id },
          data: {
            status: 'failed',
            errorMessage: bookingErr instanceof Error ? bookingErr.message : 'Booking update failed',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: modification,
      message: willAutoApply ? 'Modification auto-applied successfully' : 'Modification created, pending approval',
    });
  } catch (error) {
    console.error('Error creating booking modification:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking modification' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// PUT /api/channels/booking-modifications
// Actions: approve, reject, apply
// ──────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to process booking modifications' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, rejectionReason } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and action are required' } },
        { status: 400 }
      );
    }

    // SECURITY FIX: Verify modification belongs to user's tenant
    const existing = await db.bookingModification.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking modification not found' } },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: `Modification is already ${existing.status}` } },
        { status: 409 }
      );
    }

    // ── APPROVE ──
    if (action === 'approve') {
      const updated = await db.bookingModification.update({
        where: { id },
        data: {
          status: 'approved',
          processedAt: new Date(),
          processedBy: user.id,
        },
      });

      // Apply the approved change to the underlying booking
      if (existing.bookingId) {
        try {
          const booking = await db.booking.findFirst({ where: { id: existing.bookingId, tenantId: user.tenantId } });
          if (!booking) {
            return NextResponse.json(
              { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
              { status: 404 }
            );
          }
          if (booking) {
            const updateData: Record<string, unknown> = {};
            if (existing.newCheckIn) updateData.checkIn = existing.newCheckIn;
            if (existing.newCheckOut) updateData.checkOut = existing.newCheckOut;
            if (existing.newAdults !== null && existing.newAdults !== undefined) updateData.adults = existing.newAdults;
            if (existing.newChildren !== null && existing.newChildren !== undefined) updateData.children = existing.newChildren;
            if (existing.newRate !== null && existing.newRate !== undefined) updateData.roomRate = existing.newRate;

            if (Object.keys(updateData).length > 0) {
              await db.booking.update({
                where: { id: existing.bookingId },
                data: updateData,
              });
            }

            // Mark as applied
            await db.bookingModification.update({
              where: { id },
              data: { status: 'applied' },
            });

            // Create audit log
            await db.bookingAuditLog.create({
              data: {
                bookingId: existing.bookingId,
                action: 'modification_applied',
                oldStatus: booking.status,
                newStatus: booking.status,
                notes: `Channel modification approved: ${existing.modificationType} from ${existing.channelCode}`,
                performedBy: user.id,
              },
            });
          }
        } catch (applyErr) {
          await db.bookingModification.update({
            where: { id },
            data: {
              status: 'failed',
              errorMessage: applyErr instanceof Error ? applyErr.message : 'Failed to apply to booking',
            },
          });
        }
      }

      const final = await db.bookingModification.findUnique({ where: { id } });
      return NextResponse.json({ success: true, data: final, message: 'Modification approved and applied' });
    }

    // ── REJECT ──
    if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'rejectionReason is required' } },
          { status: 400 }
        );
      }

      const updated = await db.bookingModification.update({
        where: { id },
        data: {
          status: 'rejected',
          processedAt: new Date(),
          processedBy: user.id,
          rejectionReason,
        },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Modification rejected' });
    }

    // ── APPLY (for autoApply items that were pending) ──
    if (action === 'apply') {
      if (!existing.autoApply) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Only auto-apply modifications can be force-applied' } },
          { status: 400 }
        );
      }

      let bookingUpdated = false;
      if (existing.bookingId) {
        try {
          // SECURITY FIX: Verify booking belongs to user's tenant
          const booking = await db.booking.findFirst({ where: { id: existing.bookingId, tenantId: user.tenantId } });
          if (booking) {
            const updateData: Record<string, unknown> = {};
            if (existing.newCheckIn) updateData.checkIn = existing.newCheckIn;
            if (existing.newCheckOut) updateData.checkOut = existing.newCheckOut;
            if (existing.newAdults !== null && existing.newAdults !== undefined) updateData.adults = existing.newAdults;
            if (existing.newChildren !== null && existing.newChildren !== undefined) updateData.children = existing.newChildren;
            if (existing.newRate !== null && existing.newRate !== undefined) updateData.roomRate = existing.newRate;

            if (Object.keys(updateData).length > 0) {
              await db.booking.update({
                where: { id: existing.bookingId },
                data: updateData,
              });
              bookingUpdated = true;
            }
          }
        } catch (applyErr) {
          const updated = await db.bookingModification.update({
            where: { id },
            data: {
              status: 'failed',
              errorMessage: applyErr instanceof Error ? applyErr.message : 'Failed to apply to booking',
            },
          });
          return NextResponse.json({ success: false, data: updated, message: 'Modification apply failed' });
        }
      }

      const updated = await db.bookingModification.update({
        where: { id },
        data: {
          status: 'applied',
          processedAt: new Date(),
          processedBy: user.id,
        },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Modification applied successfully' });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action. Use: approve, reject, or apply' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing booking modification:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process booking modification' } },
      { status: 500 }
    );
  }
}
