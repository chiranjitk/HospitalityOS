import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Simple in-memory cache for dashboard data (keyed by tenantId)
const dashboardCache = new Map<string, { data: any; timestamp: number }>();
setInterval(() => { const now = Date.now(); for (const [key, val] of dashboardCache.entries()) { if (now - val.timestamp > 15000) dashboardCache.delete(key); } }, 60_000).unref();
const DASHBOARD_CACHE_TTL = 15000; // 15 seconds

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'dashboard.view') && !hasPermission(user, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId; // Use authenticated user's tenant

    // Check cache first
    const cached = dashboardCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Get current date info
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
    const prevMonthAgo = new Date(monthAgo);
    prevMonthAgo.setDate(prevMonthAgo.getDate() - 30);
    const next30Days = new Date(today);
    next30Days.setDate(next30Days.getDate() + 30);

    // Get all properties for tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true, name: true },
    });

    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Bookings stats — date-filtered to last 30 days, next 30 days, or currently checked-in
    const bookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
        OR: [
          { checkIn: { gte: monthAgo } },
          { status: 'checked_in' },
        ],
      },
      select: {
        id: true,
        propertyId: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        status: true,
        adults: true,
        children: true,
        roomTypeId: true,
        source: true,
        createdAt: true,
      },
    });

    // Get previous period bookings for comparison
    const prevWeekBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: prevWeekAgo, lt: weekAgo },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
      },
      select: { totalAmount: true },
    });

    const prevMonthBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: prevMonthAgo, lt: monthAgo },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
      },
      select: { totalAmount: true },
    });

    // Get room types for mapping
    const roomTypes = await db.roomType.findMany({
      where: { propertyId: { in: propertyIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    const roomTypeMap = new Map(roomTypes.map(rt => [rt.id, rt.name]));

    // Today's stats — revenue from all active/paid stays that overlap today
    const todaysRevenue = bookings
      .filter(b => {
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        // Include bookings that overlap today (checked in today OR currently staying through today)
        return checkIn < tomorrow && checkOut >= today && !['cancelled', 'draft', 'no_show'].includes(b.status);
      })
      .reduce((sum, b) => {
        // Prorate: calculate daily rate and count only today's portion
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        const totalNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        const dailyRate = b.totalAmount / totalNights;
        return sum + dailyRate;
      }, 0);

    // Currently checked in
    const checkedIn = bookings.filter(b => b.status === 'checked_in');
    const totalGuests = checkedIn.reduce((sum, b) => sum + b.adults + b.children, 0);

    // Occupancy calculation
    const occupiedRooms = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'occupied',
        deletedAt: null,
      },
    });

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Arrivals today
    const arrivalsToday = bookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      return checkIn.getTime() === today.getTime() && ['confirmed', 'checked_in'].includes(b.status);
    }).length;

    // Departures today
    const departuresToday = bookings.filter(b => {
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      return checkOut.getTime() === today.getTime() && b.status === 'checked_in';
    }).length;

    // Revenue this week
    const weekRevenue = bookings
      .filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= weekAgo && !['cancelled', 'draft', 'no_show'].includes(b.status);
      })
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // Revenue this month
    const monthRevenue = bookings
      .filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= monthAgo && !['cancelled', 'draft', 'no_show'].includes(b.status);
      })
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // Average Daily Rate (ADR)
    const paidBookings = bookings.filter(b => !['cancelled', 'draft', 'no_show'].includes(b.status) && b.totalAmount > 0);
    const totalNights = paidBookings.reduce((sum, b) => {
      const nights = Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
      return sum + nights;
    }, 0);
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const adr = totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : 0;

    // RevPAR = ADR × Occupancy Rate (correct hospitality formula)
    const revpar = totalRooms > 0 && adr > 0 ? Math.round((adr * (occupancyRate / 100)) * 100) / 100 : 0;

    // Pending bookings
    const pendingBookings = bookings.filter(b => b.status === 'confirmed').length;

    // WiFi sessions (tenant-scoped)
    const activeWifiSessions = await db.wiFiSession.count({
      where: { 
        status: 'active',
        tenantId,
      },
    });

    // Service requests (tenant-scoped)
    const pendingServiceRequests = await db.serviceRequest.count({
      where: { 
        status: 'pending',
        propertyId: { in: propertyIds },
      },
    });

    // Low stock items
    const allStockItems = await db.stockItem.findMany({
      where: { tenantId },
      select: { quantity: true, reorderPoint: true, name: true },
    });
    const lowStockItems = allStockItems.filter(item => item.quantity <= (item.reorderPoint ?? 0)).length;

    // Arrivals today detail - fetch bookings with room info
    const arrivalsTodayDetail = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: today, lt: tomorrow },
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true } },
        room: { 
          select: { 
            number: true,
            roomType: { select: { name: true } }
          } 
        },
      },
      orderBy: { checkIn: 'asc' },
      take: 10,
    });

    // Departures today detail
    const departuresTodayDetail = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkOut: { gte: today, lt: tomorrow },
        status: 'checked_in',
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true } },
        room: { 
          select: { 
            number: true,
            roomType: { select: { name: true } }
          } 
        },
        folios: { select: { balance: true } },
      },
      orderBy: { checkOut: 'asc' },
      take: 10,
    });

    // Revenue chart data - Last 7 days
    const revenueChartData: Array<{ date: string; revenue: number; bookings: number; occupancy: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Use overlap-based approach for both revenue and occupancy to ensure consistency
      const overlappingBookings = bookings.filter(b => {
        if (['cancelled', 'draft', 'no_show'].includes(b.status)) return false;
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        return ci < nextDate && co > date;  // Booking overlaps this day
      });

      // Prorate daily revenue from all bookings overlapping this day
      const dayRevenue = overlappingBookings.reduce((sum, b) => {
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        const totalNights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)));
        const dailyRate = b.totalAmount / totalNights;
        return sum + dailyRate;
      }, 0);

      // Also count new bookings starting on this day for the bookings count
      const dayNewBookings = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= date && checkIn < nextDate && !['cancelled', 'draft', 'no_show'].includes(b.status);
      });

      const dayOccupiedRooms = overlappingBookings.length;
      const dayOccupancy = totalRooms > 0 ? Math.round((dayOccupiedRooms / totalRooms) * 100) : 0;
      
      revenueChartData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: Math.round(dayRevenue * 100) / 100,
        bookings: dayNewBookings.length,
        occupancy: dayOccupancy,
      });
    }

    // Occupancy by room type
    const roomsByType = await db.room.groupBy({
      by: ['roomTypeId'],
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
      },
      _count: { id: true },
    });

    const occupiedByType = await db.room.groupBy({
      by: ['roomTypeId'],
      where: {
        propertyId: { in: propertyIds },
        status: 'occupied',
        deletedAt: null,
      },
      _count: { id: true },
    });

    const occupancyByRoomType = roomTypes.map(rt => {
      const total = roomsByType.find(r => r.roomTypeId === rt.id)?._count.id || 0;
      const occupied = occupiedByType.find(r => r.roomTypeId === rt.id)?._count.id || 0;
      return {
        name: rt.name,
        value: total > 0 ? Math.round((occupied / total) * 100) : 0,
      };
    });

    // Booking sources distribution
    const sourceGroups = bookings.reduce((acc, b) => {
      acc[b.source] = (acc[b.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bookingSources = Object.entries(sourceGroups)
      .map(([source, count]) => ({
        source: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        bookings: count,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    // Hourly activity (check-ins and check-outs by hour for today)
    const hourlyActivity: Array<{ hour: string; checkins: number; checkouts: number }> = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(today);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hour + 1);

      const checkins = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= hourStart && checkIn < hourEnd;
      }).length;

      const checkouts = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        return checkOut >= hourStart && checkOut < hourEnd;
      }).length;

      hourlyActivity.push({
        hour: hour.toString().padStart(2, '0'),
        checkins,
        checkouts,
      });
    }

    // Alerts and notifications
    const alerts: Array<{ id: string; type: string; severity: string; title: string; message: string; timestamp: Date }> = [];

    // Low stock alerts
    const lowStockAlerts = allStockItems
      .filter(item => item.quantity <= (item.reorderPoint ?? 0))
      .slice(0, 5)
      .map(item => ({
        id: `stock-${item.name}`,
        type: 'inventory',
        severity: item.quantity === 0 ? 'critical' : 'warning',
        title: item.quantity === 0 ? 'Out of Stock' : 'Low Stock',
        message: `${item.name} - ${item.quantity} remaining`,
        timestamp: new Date(),
      }));

    alerts.push(...lowStockAlerts);

    // Pending service requests
    if (pendingServiceRequests > 0) {
      alerts.push({
        id: 'service-pending',
        type: 'service',
        severity: 'warning',
        title: 'Pending Service Requests',
        message: `${pendingServiceRequests} service requests awaiting attention`,
        timestamp: new Date(),
      });
    }

    // Rooms needing attention (maintenance or dirty)
    const roomsNeedingAttention = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['maintenance', 'cleaning'] },
        deletedAt: null,
      },
    });

    if (roomsNeedingAttention > 0) {
      alerts.push({
        id: 'rooms-attention',
        type: 'room',
        severity: 'info',
        title: 'Rooms Needing Attention',
        message: `${roomsNeedingAttention} rooms require housekeeping or maintenance`,
        timestamp: new Date(),
      });
    }

    // Recent activity
    const recentBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const recentActivity = recentBookings.map(b => {
      let type: 'booking' | 'check_in' | 'check_out' | 'payment' = 'booking';
      let title = 'New Booking';
      
      if (b.status === 'checked_in') {
        type = 'check_in';
        title = 'Check-in';
      } else if (b.status === 'checked_out') {
        type = 'check_out';
        title = 'Check-out';
      }

      return {
        id: b.id,
        type,
        title,
        description: `${b.room?.number ? `Room ${b.room.number}` : 'Room TBD'} - ${roomTypeMap.get(b.roomTypeId) || 'Standard'}`,
        guest: {
          name: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
          initials: `${b.primaryGuest.firstName[0]}${b.primaryGuest.lastName[0]}`,
        },
        room: b.room?.number,
        timestamp: b.updatedAt,
        status: b.status,
        amount: b.totalAmount,
      };
    });

    // Tasks for today
    const todaysTasks = await db.task.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['pending', 'in_progress'] },
        scheduledAt: { gte: today, lt: tomorrow },
      },
      include: {
        room: { select: { number: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    // Command center stats
    const roomsByStatus = await db.room.groupBy({
      by: ['status'],
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
      },
      _count: { id: true },
    });

    const roomStatusCounts = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      dirty: 0,
      out_of_order: 0,
    };

    roomsByStatus.forEach(r => {
      if (r.status in roomStatusCounts) {
        roomStatusCounts[r.status as keyof typeof roomStatusCounts] = r._count.id;
      }
    });

    // Upcoming check-ins (next 3 hours)
    const now = new Date();
    const threeHoursLater = new Date(now);
    threeHoursLater.setHours(threeHoursLater.getHours() + 3);

    const upcomingCheckIns = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'confirmed',
        checkIn: { gte: now, lte: threeHoursLater },
        deletedAt: null,
      },
    });

    // Staff on duty (tenant-scoped)
    const staffOnDuty = await db.user.count({
      where: {
        tenantId,
        status: 'active',
      },
    });

    // Calculate actual change percentages from previous periods
    const prevWeekRevenue = prevWeekBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const prevMonthRevenue = prevMonthBookings.reduce((sum, b) => sum + b.totalAmount, 0);

    // Only show change % when we have meaningful previous data
    const revenueChange = prevWeekRevenue > 0 
      ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 
      : (weekRevenue > 0 ? 100 : 0); // 100% growth from zero, or 0 if both are zero

    // Get previous period occupancy for comparison
    const prevOccupiedRooms = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'occupied',
        deletedAt: null,
        updatedAt: { gte: prevWeekAgo, lt: weekAgo },
      },
    });

    const occupancyChange = totalRooms > 0 
      ? ((occupancyRate / 100) - (prevOccupiedRooms / totalRooms)) * 100 
      : 0;

    // GAP-005: Multi-property dashboard - break down key metrics by property
    const propertyMetrics = await Promise.all(properties.map(async (prop) => {
      const propRooms = await db.room.count({ where: { propertyId: prop.id, deletedAt: null } });
      const propOccupied = await db.room.count({ where: { propertyId: prop.id, status: 'occupied', deletedAt: null } });
      const propOccupancyRate = propRooms > 0 ? Math.round((propOccupied / propRooms) * 100) : 0;

      // Revenue today (prorated from overlapping bookings)
      const propBookings = bookings.filter(b => b.propertyId === prop.id);
      const propRevenueToday = propBookings
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

      // Arrivals and departures today
      const propArrivals = propBookings.filter(b => {
        const ci = new Date(b.checkIn);
        ci.setHours(0, 0, 0, 0);
        return ci.getTime() === today.getTime() && ['confirmed', 'checked_in'].includes(b.status);
      }).length;

      const propDepartures = propBookings.filter(b => {
        const co = new Date(b.checkOut);
        co.setHours(0, 0, 0, 0);
        return co.getTime() === today.getTime() && b.status === 'checked_in';
      }).length;

      // ADR for this property
      const propPaidBookings = propBookings.filter(b => !['cancelled', 'draft', 'no_show'].includes(b.status) && b.totalAmount > 0);
      const propTotalNights = propPaidBookings.reduce((sum, b) => {
        const nights = Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
        return sum + nights;
      }, 0);
      const propTotalRevenue = propPaidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const propAdr = propTotalNights > 0 ? Math.round((propTotalRevenue / propTotalNights) * 100) / 100 : 0;

      return {
        id: prop.id,
        name: prop.name,
        totalRooms: propRooms,
        occupiedRooms: propOccupied,
        occupancyRate: propOccupancyRate,
        revenueToday: Math.round(propRevenueToday * 100) / 100,
        arrivalsToday: propArrivals,
        departuresToday: propDepartures,
        adr: propAdr,
      };
    }));

    const responseData = {
      success: true,
      data: {
        stats: {
          revenue: {
            today: todaysRevenue,
            thisWeek: weekRevenue,
            thisMonth: monthRevenue,
            change: prevWeekRevenue > 0 ? Math.round(revenueChange * 10) / 10 : null,
          },
          occupancy: {
            today: occupancyRate,
            thisWeek: occupancyRate,
            thisMonth: occupancyRate,
            change: Math.round(occupancyChange * 10) / 10,
          },
          bookings: {
            today: arrivalsToday,              // Arrivals today (new check-ins)
            inHouse: checkedIn.length,         // Currently in-house bookings
            thisWeek: bookings.filter(b => new Date(b.checkIn) >= weekAgo).length,
            thisMonth: bookings.filter(b => new Date(b.checkIn) >= monthAgo).length,
            pending: pendingBookings,
          },
          guests: {
            checkedIn: checkedIn.length,      // Number of checked-in bookings
            totalGuests: totalGuests,          // Total guests (adults + children) across checked-in bookings
            total: totalGuests,                // Alias for backward compat
            arriving: arrivalsToday,
            departing: departuresToday,
          },
          adr,
          revpar,
          activeWifiSessions,
          pendingServiceRequests,
          lowStockItems,
        },
        arrivalsToday: arrivalsTodayDetail.map(b => ({
          id: b.id,
          confirmationCode: b.confirmationCode,
          guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
          roomType: b.room?.roomType?.name || roomTypeMap.get(b.roomTypeId) || 'Standard',
          roomNumber: b.room?.number,
          nights: Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24)),
          status: b.status,
          time: b.checkIn.toISOString(),
        })),
        departuresToday: departuresTodayDetail.map(b => ({
          id: b.id,
          confirmationCode: b.confirmationCode,
          guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
          roomType: b.room?.roomType?.name || roomTypeMap.get(b.roomTypeId) || 'Standard',
          roomNumber: b.room?.number,
          balance: b.folios?.reduce((sum, f) => sum + f.balance, 0) || 0,
          status: 'on_time',
          time: b.checkOut.toISOString(),
        })),
        charts: {
          revenue: revenueChartData,
          occupancyByRoomType: occupancyByRoomType,
          bookingSources: bookingSources,
          hourlyActivity: hourlyActivity,
        },
        alerts,
        recentActivity,
        commandCenter: {
          rooms: roomStatusCounts,
          totalRooms,
          upcomingCheckIns,
          staffOnDuty,
          todaysTasks: todaysTasks.map(t => ({
            id: t.id,
            type: t.type,
            title: t.title,
            room: t.room?.number,
            status: t.status,
            priority: t.priority,
            scheduledAt: t.scheduledAt,
            assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
          })),
        },
        // GAP-005: Multi-property breakdown for property comparison view
        properties: propertyMetrics,
      },
    };

    // Store in cache before returning
    dashboardCache.set(tenantId, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard data' } },
      { status: 500 }
    );
  }
}
