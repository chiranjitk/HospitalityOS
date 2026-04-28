import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience-revenue - Revenue analytics data
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const experienceId = searchParams.get('experienceId');
    const groupBy = searchParams.get('groupBy') || 'experience'; // experience, week, month

    // Build date range - default to current month
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      bookingDate: { gte: start, lte: end },
    };

    if (experienceId) {
      where.experienceId = experienceId;
    }

    // Total revenue, bookings, avg value
    const aggregateData = await db.experienceBooking.aggregate({
      where,
      _sum: { totalPrice: true },
      _count: { id: true },
      _avg: { totalPrice: true },
    });

    // Cancellation rate
    const cancelledCount = await db.experienceBooking.count({
      where: { ...where, status: 'cancelled' },
    });

    const confirmedCount = await db.experienceBooking.count({
      where: { ...where, status: { in: ['confirmed', 'completed'] } },
    });

    const totalBookings = aggregateData._count.id || 1;
    const cancellationRate = (cancelledCount / totalBookings) * 100;

    // Revenue by experience
    const revenueByExperience = await db.experienceBooking.groupBy({
      by: ['experienceId'],
      where,
      _sum: { totalPrice: true },
      _count: { id: true },
      _avg: { totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
    });

    // Enrich with experience names
    const experienceIds = revenueByExperience.map(r => r.experienceId);
    const experiences = experienceIds.length > 0
      ? await db.experience.findMany({
          where: { id: { in: experienceIds } },
          select: { id: true, name: true, category: true },
        })
      : [];

    const experienceMap = new Map(experiences.map(e => [e.id, e]));

    const enrichedRevenue = revenueByExperience.map(r => ({
      experienceId: r.experienceId,
      experienceName: experienceMap.get(r.experienceId)?.name || 'Unknown',
      category: experienceMap.get(r.experienceId)?.category || null,
      revenue: r._sum.totalPrice || 0,
      bookings: r._count.id,
      avgBookingValue: r._avg.totalPrice || 0,
    }));

    // Booking status distribution
    const statusDistribution = await db.experienceBooking.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    // Revenue trend (by week or month)
    let trendData: Array<{ period: string; revenue: number; bookings: number }> = [];

    if (groupBy === 'week') {
      // Get all bookings in the date range
      const bookings = await db.experienceBooking.findMany({
        where,
        select: { bookingDate: true, totalPrice: true },
        orderBy: { bookingDate: 'asc' },
      });

      // Group by week
      const weekMap = new Map<string, { revenue: number; bookings: number }>();
      bookings.forEach(b => {
        const d = new Date(b.bookingDate);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split('T')[0];
        const existing = weekMap.get(key) || { revenue: 0, bookings: 0 };
        existing.revenue += b.totalPrice;
        existing.bookings += 1;
        weekMap.set(key, existing);
      });

      trendData = Array.from(weekMap.entries()).map(([period, data]) => ({
        period,
        revenue: data.revenue,
        bookings: data.bookings,
      })).sort((a, b) => a.period.localeCompare(b.period));
    } else {
      // Group by month
      const monthAgg = await db.experienceBooking.groupBy({
        by: ['bookingDate'],
        where,
        _sum: { totalPrice: true },
        _count: { id: true },
      });

      const monthMap = new Map<string, { revenue: number; bookings: number }>();
      monthAgg.forEach(r => {
        const key = new Date(r.bookingDate).toISOString().slice(0, 7); // YYYY-MM
        const existing = monthMap.get(key) || { revenue: 0, bookings: 0 };
        existing.revenue += r._sum.totalPrice || 0;
        existing.bookings += r._count.id;
        monthMap.set(key, existing);
      });

      trendData = Array.from(monthMap.entries()).map(([period, data]) => ({
        period,
        revenue: data.revenue,
        bookings: data.bookings,
      })).sort((a, b) => a.period.localeCompare(b.period));
    }

    // Top 5 experiences by revenue
    const topExperiences = enrichedRevenue.slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue: aggregateData._sum.totalPrice || 0,
          totalBookings: aggregateData._count.id,
          avgBookingValue: aggregateData._avg.totalPrice || 0,
          cancellationRate: Math.round(cancellationRate * 100) / 100,
        },
        revenueByExperience: enrichedRevenue,
        statusDistribution: statusDistribution.map(s => ({
          status: s.status,
          count: s._count.id,
          percentage: (s._count.id / totalBookings) * 100,
        })),
        trendData,
        topExperiences,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error) {
    console.error('Error fetching experience revenue:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch revenue data' } },
      { status: 500 }
    );
  }
}
