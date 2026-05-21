import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/dashboard/kpis - Key Performance Indicators
// Returns a lightweight KPI summary: ADR, RevPAR, Occupancy, and revenue metrics
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'dashboard.view') && !hasPermission(user, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const prevWeekAgo = new Date(weekAgo);
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7);
    const prevMonthAgo = new Date(monthAgo);
    prevMonthAgo.setDate(prevMonthAgo.getDate() - 30);

    // Get properties
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Occupancy
    const occupiedRooms = await db.room.count({
      where: { propertyId: { in: propertyIds }, status: 'occupied', deletedAt: null },
    });
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Bookings for revenue, ADR, RevPAR
    const bookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
        OR: [{ checkIn: { gte: monthAgo } }, { status: 'checked_in' }],
      },
      select: {
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        status: true,
      },
    });

    const paidBookings = bookings.filter(b => !['cancelled', 'draft', 'no_show'].includes(b.status) && b.totalAmount > 0);
    const totalNights = paidBookings.reduce((sum, b) => {
      return sum + Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const adr = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0;
    const revpar = totalRooms > 0 && adr > 0 ? Math.round(adr * (occupancyRate / 100)) : 0;

    // Week revenue for trend
    const weekRevenue = bookings
      .filter(b => new Date(b.checkIn) >= weekAgo && !['cancelled', 'draft', 'no_show'].includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const monthRevenue = bookings
      .filter(b => new Date(b.checkIn) >= monthAgo && !['cancelled', 'draft', 'no_show'].includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // Previous periods for trend comparison
    const [prevWeekBookings, prevMonthBookings] = await Promise.all([
      db.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          checkIn: { gte: prevWeekAgo, lt: weekAgo },
          status: { notIn: ['cancelled'] },
          deletedAt: null,
        },
        select: { totalAmount: true },
      }),
      db.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          checkIn: { gte: prevMonthAgo, lt: monthAgo },
          status: { notIn: ['cancelled'] },
          deletedAt: null,
        },
        select: { totalAmount: true },
      }),
    ]);

    const prevWeekRevenue = prevWeekBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const prevMonthRevenue = prevMonthBookings.reduce((sum, b) => sum + b.totalAmount, 0);

    const revenueWeekChange = prevWeekRevenue > 0
      ? Math.round((((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100) * 10) / 10
      : (weekRevenue > 0 ? 100 : null);

    const revenueMonthChange = prevMonthRevenue > 0
      ? Math.round((((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) * 10) / 10
      : (monthRevenue > 0 ? 100 : null);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          adr: {
            value: adr,
            unit: 'currency',
            label: 'Average Daily Rate',
          },
          revpar: {
            value: revpar,
            unit: 'currency',
            label: 'Revenue Per Available Room',
          },
          occupancy: {
            value: occupancyRate,
            unit: 'percent',
            label: 'Occupancy Rate',
          },
          revenueWeek: {
            value: weekRevenue,
            unit: 'currency',
            label: 'Weekly Revenue',
            change: revenueWeekChange,
          },
          revenueMonth: {
            value: monthRevenue,
            unit: 'currency',
            label: 'Monthly Revenue',
            change: revenueMonthChange,
          },
        },
        totalRooms,
        occupiedRooms,
        totalBookings: paidBookings.length,
        totalRoomNights: totalNights,
      },
    });
  } catch (error) {
    console.error('Dashboard KPIs API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard KPIs' } },
      { status: 500 }
    );
  }
}
