import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/dashboard/stats - Lightweight dashboard statistics
// Returns just the numeric stats portion of the dashboard (no chart data, arrivals, etc.)
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
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const prevWeekAgo = new Date(weekAgo);
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7);

    // Get properties
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Core counts
    const [occupiedRooms, activeWifiSessions, pendingServiceRequests, allStockItems] = await Promise.all([
      db.room.count({
        where: { propertyId: { in: propertyIds }, status: 'occupied', deletedAt: null },
      }),
      db.wiFiSession.count({ where: { status: 'active', tenantId } }),
      db.serviceRequest.count({ where: { status: 'pending', propertyId: { in: propertyIds } } }),
      db.stockItem.findMany({
        where: { tenantId },
        select: { quantity: true, reorderPoint: true },
      }),
    ]);

    const lowStockItems = allStockItems.filter(item => item.quantity <= (item.reorderPoint ?? 0)).length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Bookings for revenue and counts
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
        adults: true,
        children: true,
      },
    });

    const checkedIn = bookings.filter(b => b.status === 'checked_in');
    const totalGuests = checkedIn.reduce((sum, b) => sum + b.adults + b.children, 0);

    const arrivalsToday = bookings.filter(b => {
      const ci = new Date(b.checkIn);
      ci.setHours(0, 0, 0, 0);
      return ci.getTime() === today.getTime() && ['confirmed', 'checked_in'].includes(b.status);
    }).length;

    const departuresToday = bookings.filter(b => {
      const co = new Date(b.checkOut);
      co.setHours(0, 0, 0, 0);
      return co.getTime() === today.getTime() && b.status === 'checked_in';
    }).length;

    const pendingBookings = bookings.filter(b => b.status === 'confirmed').length;

    // Revenue
    const todaysRevenue = bookings
      .filter(b => {
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        return ci < tomorrow && co >= today && !['cancelled', 'draft', 'no_show'].includes(b.status);
      })
      .reduce((sum, b) => {
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        const nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)));
        return sum + (b.totalAmount / nights);
      }, 0);

    const weekRevenue = bookings
      .filter(b => new Date(b.checkIn) >= weekAgo && !['cancelled', 'draft', 'no_show'].includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const monthRevenue = bookings
      .filter(b => new Date(b.checkIn) >= monthAgo && !['cancelled', 'draft', 'no_show'].includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // ADR & RevPAR
    const paidBookings = bookings.filter(b => !['cancelled', 'draft', 'no_show'].includes(b.status) && b.totalAmount > 0);
    const totalNights = paidBookings.reduce((sum, b) => {
      return sum + Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const adr = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0;
    const revpar = totalRooms > 0 && adr > 0 ? Math.round(adr * (occupancyRate / 100)) : 0;

    // Previous week revenue for change calculation
    const prevWeekBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: prevWeekAgo, lt: weekAgo },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
      },
      select: { totalAmount: true },
    });
    const prevWeekRevenue = prevWeekBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const revenueChange = prevWeekRevenue > 0
      ? Math.round((((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100) * 10) / 10
      : (weekRevenue > 0 ? 100 : null);

    return NextResponse.json({
      success: true,
      data: {
        revenue: {
          today: Math.round(todaysRevenue),
          thisWeek: weekRevenue,
          thisMonth: monthRevenue,
          change: revenueChange,
        },
        occupancy: {
          today: occupancyRate,
          occupiedRooms,
          totalRooms,
        },
        bookings: {
          today: arrivalsToday,
          inHouse: checkedIn.length,
          pending: pendingBookings,
          departingToday: departuresToday,
        },
        guests: {
          totalGuests,
          arriving: arrivalsToday,
          departing: departuresToday,
        },
        adr,
        revpar,
        activeWifiSessions,
        pendingServiceRequests,
        lowStockItems,
      },
    });
  } catch (error) {
    console.error('Dashboard stats API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard stats' } },
      { status: 500 }
    );
  }
}
