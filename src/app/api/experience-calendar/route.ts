import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience-calendar - Bookings for calendar view
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const experienceId = searchParams.get('experienceId');
    const propertyId = searchParams.get('propertyId');

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      bookingDate: { gte: startDate, lte: endDate },
      deletedAt: null,
    };

    if (experienceId) {
      where.experienceId = experienceId;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Fetch all bookings in the date range with experience details
    const bookings = await db.experienceBooking.findMany({
      where,
      include: {
        experience: {
          select: { id: true, name: true, category: true, maxParticipants: true },
        },
      },
      orderBy: { bookingDate: 'asc' },
    });

    // Fetch all active experiences for the filter dropdown
    const experiences = await db.experience.findMany({
      where: { tenantId: user.tenantId, status: 'active', deletedAt: null },
      select: { id: true, name: true, category: true },
      orderBy: { name: 'asc' },
    });

    // Group bookings by date
    const bookingsByDate: Record<string, typeof bookings> = {};
    bookings.forEach(booking => {
      const dateKey = new Date(booking.bookingDate).toISOString().split('T')[0];
      if (!bookingsByDate[dateKey]) {
        bookingsByDate[dateKey] = [];
      }
      bookingsByDate[dateKey].push(booking);
    });

    // Build daily summary
    const dailySummary: Array<{
      date: string;
      totalBookings: number;
      totalGuests: number;
      totalRevenue: number;
      maxCapacity: number;
      status: 'available' | 'few_left' | 'fully_booked' | 'unavailable';
    }> = [];

    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookingsByDate[dateKey] || [];

      const totalBookings = dayBookings.length;
      const totalGuests = dayBookings.reduce((sum, b) => sum + b.numberOfGuests, 0);
      const totalRevenue = dayBookings.reduce((sum, b) => sum + b.totalPrice, 0);

      // Calculate max capacity across all active experiences
      const maxCapacity = experiences.reduce((sum, exp) => sum + (exp as unknown as { maxParticipants: number }).maxParticipants || 10, 0);
      const confirmedBookings = dayBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;

      let status: 'available' | 'few_left' | 'fully_booked' | 'unavailable' = 'available';
      if (maxCapacity > 0) {
        const utilization = confirmedBookings / maxCapacity;
        if (utilization >= 1) {
          status = 'fully_booked';
        } else if (utilization >= 0.75) {
          status = 'few_left';
        }
      }

      const dateObj = new Date(dateKey);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj < today) {
        status = 'unavailable';
      }

      dailySummary.push({
        date: dateKey,
        totalBookings,
        totalGuests,
        totalRevenue,
        maxCapacity,
        status,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bookingsByDate,
        dailySummary,
        experiences,
      },
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch calendar data' } },
      { status: 500 }
    );
  }
}
