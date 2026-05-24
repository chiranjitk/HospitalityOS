import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience-bookings - List bookings with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_bookings.view') && !hasPermission(user, 'experience.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const experienceId = sp.get('experienceId');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const page = sp.get('page');
    const limit = sp.get('limit');

    const where: Record<string, unknown> = { tenantId: user.tenantId, deletedAt: null };

    if (status) where.status = status;
    if (experienceId) where.experienceId = experienceId;

    if (startDate || endDate) {
      where.bookingDate = {};
      if (startDate) (where.bookingDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.bookingDate as Record<string, unknown>).lte = new Date(endDate);
    }

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 50;
    const offsetNum = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      db.experienceBooking.findMany({
        where,
        include: {
          experience: { select: { id: true, name: true, basePrice: true, duration: true, maxParticipants: true } },
        },
        orderBy: { bookingDate: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      db.experienceBooking.count({ where }),
    ]);

    // Calculate summary stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [totalBookings, todayBookings, confirmedBookings, totalRevenue] = await Promise.all([
      db.experienceBooking.count({ where: { ...where } }),
      db.experienceBooking.count({
        where: {
          ...where,
          bookingDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      db.experienceBooking.count({
        where: { ...where, status: 'confirmed' },
      }),
      db.experienceBooking.aggregate({
        where: { ...where, status: { in: ['confirmed', 'completed'] } },
        _sum: { totalPrice: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalBookings,
        todayBookings,
        confirmedBookings,
        revenue: totalRevenue._sum.totalPrice || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching experience bookings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings' } },
      { status: 500 }
    );
  }
}

// POST /api/experience-bookings - Create booking
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_bookings.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      experienceId,
      guestName,
      guestEmail,
      guestPhone,
      bookingDate,
      bookingTime,
      numberOfGuests,
      specialRequests,
    } = body;

    if (!experienceId || !guestName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: experienceId, guestName, bookingDate, bookingTime' } },
        { status: 400 }
      );
    }

    const guestCount = numberOfGuests || 1;
    if (guestCount < 1 || guestCount > 20) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Number of guests must be between 1 and 20' } },
        { status: 400 }
      );
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!experience) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 }
      );
    }

    if (guestCount > experience.maxParticipants) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Maximum ${experience.maxParticipants} participants allowed for this experience` } },
        { status: 400 }
      );
    }

    // Check capacity for the date/time slot
    const existingBookings = await db.experienceBooking.findMany({
      where: {
        experienceId,
        bookingDate: new Date(bookingDate),
        bookingTime,
        status: { in: ['pending', 'confirmed', 'in_progress'] },
        deletedAt: null,
      },
      select: { numberOfGuests: true },
    });

    const bookedGuestCount = existingBookings.reduce((sum, b) => sum + b.numberOfGuests, 0);
    if (bookedGuestCount + guestCount > experience.maxParticipants) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Only ${experience.maxParticipants - bookedGuestCount} spots remaining for this time slot` } },
        { status: 400 }
      );
    }

    const totalPrice = Math.round((experience.basePrice || 0) * guestCount * 100) / 100;

    // Wrap booking creation + count increment in db.$transaction
    const booking = await db.$transaction(async (tx) => {
      const newBooking = await tx.experienceBooking.create({
        data: {
          tenantId: user.tenantId,
          experienceId,
          guestName,
          guestEmail,
          guestPhone,
          bookingDate: new Date(bookingDate),
          bookingTime,
          numberOfGuests: guestCount,
          totalPrice,
          specialRequests,
          status: 'pending',
        },
        include: { experience: { select: { id: true, name: true, basePrice: true, duration: true } } },
      });

      // Update experience booking count
      await tx.experience.update({
        where: { id: experienceId },
        data: { totalBookings: { increment: 1 } },
      });

      return newBooking;
    });

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' } },
      { status: 500 }
    );
  }
}

// PUT /api/experience-bookings - Update booking (status transitions and guest details)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_bookings.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, cancellationReason, guestName, guestEmail, guestPhone, numberOfGuests, specialRequests } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Booking ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experienceBooking.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: { experience: { select: { id: true, maxParticipants: true, basePrice: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const updateData: Record<string, unknown> = {};

    // Handle status transitions
    if (status) {
      if (!validTransitions[existing.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: `Cannot transition from ${existing.status} to ${status}` } },
          { status: 400 }
        );
      }

      updateData.status = status;

      if (status === 'confirmed') {
        updateData.confirmedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = cancellationReason || null;
      }
    }

    // Allow updating guest details
    if (guestName !== undefined) updateData.guestName = guestName;
    if (guestEmail !== undefined) updateData.guestEmail = guestEmail;
    if (guestPhone !== undefined) updateData.guestPhone = guestPhone;
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests;

    // Allow updating number of guests (only for pending/confirmed)
    if (numberOfGuests !== undefined) {
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: 'Can only update guest count for pending or confirmed bookings' } },
          { status: 400 }
        );
      }
      if (numberOfGuests < 1 || numberOfGuests > 20) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Number of guests must be between 1 and 20' } },
          { status: 400 }
        );
      }
      if (existing.experience && numberOfGuests > existing.experience.maxParticipants) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Maximum ${existing.experience.maxParticipants} participants allowed` } },
          { status: 400 }
        );
      }
      updateData.numberOfGuests = numberOfGuests;
      // Recalculate total price
      updateData.totalPrice = (existing.experience?.basePrice || 0) * numberOfGuests;
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.experienceBooking.update({
        where: { id },
        data: updateData,
        include: { experience: { select: { id: true, name: true, basePrice: true, duration: true } } },
      });

      // If status changed to completed, decrement experience booking count
      if (status === 'completed' && existing.status !== 'completed') {
        // No counter increment needed - just status change
      }
      // If status changed to cancelled from non-cancelled, decrement totalBookings
      if (status === 'cancelled' && existing.status !== 'cancelled') {
        await tx.experience.update({
          where: { id: existing.experienceId },
          data: { totalBookings: { decrement: 1 } },
        });
      }

      return result;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' } },
      { status: 500 }
    );
  }
}

// DELETE /api/experience-bookings - Soft delete booking
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_bookings.cancel')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Booking ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experienceBooking.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Only allow soft delete for pending or cancelled bookings
    if (!['pending', 'cancelled'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot delete a booking with status: ${existing.status}. Only pending or cancelled bookings can be deleted.` } },
        { status: 400 }
      );
    }

    const deleted = await db.experienceBooking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete booking' } },
      { status: 500 }
    );
  }
}
