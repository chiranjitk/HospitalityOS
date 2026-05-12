import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = startDateStr ? new Date(startDateStr) : thirtyDaysAgo;
    const endDate = endDateStr ? new Date(endDateStr) : now;

    // Validate date range
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date range' } },
        { status: 400 }
      );
    }

    // Base booking query filter
    const bookingWhere: Record<string, unknown> = {
      tenantId,
      status: { notIn: ['draft'] },
      createdAt: { gte: startDate, lte: endDate },
    };
    if (propertyId) {
      bookingWhere.propertyId = propertyId;
    }

    // 1. Get all bookings with source data for channel analysis
    const bookings = await db.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        source: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        checkIn: true,
        checkOut: true,
        propertyId: true,
        channelId: true,
      },
    });

    // 2. Get commission records for these bookings
    const bookingIds = bookings.map(b => b.id);
    const commissionRecords = bookingIds.length > 0
      ? await db.commissionRecord.findMany({
          where: {
            bookingId: { in: bookingIds },
          },
          select: {
            bookingId: true,
            commissionAmount: true,
            bookingAmount: true,
            sourceType: true,
            sourceName: true,
          },
        })
      : [];

    // 3. Get channel connections for the tenant
    const connectionWhere: Record<string, unknown> = { tenantId };
    if (propertyId) {
      connectionWhere.propertyId = propertyId;
    }
    const channelConnections = await db.channelConnection.findMany({
      where: connectionWhere,
      select: {
        id: true,
        channel: true,
        displayName: true,
        propertyId: true,
        lastSyncAt: true,
        status: true,
      },
    });

    // 4. Get sync logs for these connections
    const connectionIds = channelConnections.map(c => c.id);
    const syncLogs = connectionIds.length > 0
      ? await db.channelSyncLog.findMany({
          where: {
            connectionId: { in: connectionIds },
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            connectionId: true,
            status: true,
            createdAt: true,
          },
        })
      : [];

    // Build commission map per booking
    const commissionMap = new Map<string, { commissionAmount: number; bookingAmount: number; sourceType: string; sourceName: string }>();
    commissionRecords.forEach(cr => {
      commissionMap.set(cr.bookingId, {
        commissionAmount: cr.commissionAmount,
        bookingAmount: cr.bookingAmount,
        sourceType: cr.sourceType,
        sourceName: cr.sourceName || '',
      });
    });

    // Build sync log map per connection
    const syncMap = new Map<string, { logs: typeof syncLogs }>();
    syncLogs.forEach(log => {
      const existing = syncMap.get(log.connectionId) || { logs: [] };
      existing.logs.push(log);
      syncMap.set(log.connectionId, existing);
    });

    // Map channel names from connections
    const connectionChannelMap = new Map<string, { channel: string; displayName: string | null; propertyId: string | null }>();
    channelConnections.forEach(conn => {
      connectionChannelMap.set(conn.id, {
        channel: conn.channel,
        displayName: conn.displayName,
        propertyId: conn.propertyId,
      });
    });

    // 5. Group bookings by source (channel)
    const channelGroups = new Map<string, typeof bookings>();
    bookings.forEach(booking => {
      const source = booking.source || 'direct';
      const existing = channelGroups.get(source) || [];
      existing.push(booking);
      channelGroups.set(source, existing);
    });

    // 6. Build per-channel analytics
    const channelAnalytics: Array<{
      channel: string;
      displayName: string;
      bookings: number;
      revenue: number;
      cancelledBookings: number;
      totalBookings: number;
      cancellationRate: number;
      commissionTotal: number;
      netRevenue: number;
      commissionRate: number;
      avgLeadTimeDays: number;
      adr: number;
      totalNights: number;
      syncSuccessRate: number;
      syncTotal: number;
      syncErrors: number;
      lastSyncAt: string | null;
    }> = [];

    const totalNightsPerBooking = (b: { checkIn: Date; checkOut: Date }) => {
      const diffMs = new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime();
      return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    };

    channelGroups.forEach((channelBookings, source) => {
      const totalBookings = channelBookings.length;
      const cancelledBookings = channelBookings.filter(b => b.status === 'cancelled').length;
      const revenue = channelBookings
        .filter(b => b.status !== 'cancelled')
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

      // Commission
      let commissionTotal = 0;
      channelBookings.forEach(b => {
        const commission = commissionMap.get(b.id);
        if (commission) {
          commissionTotal += commission.commissionAmount || 0;
        }
      });

      const netRevenue = revenue - commissionTotal;
      const commissionRate = revenue > 0 ? (commissionTotal / revenue) * 100 : 0;

      // ADR (Average Daily Rate) = Total Revenue / Total Room Nights
      const totalNights = channelBookings
        .filter(b => b.status !== 'cancelled')
        .reduce((sum, b) => sum + totalNightsPerBooking(b), 0);
      const adr = totalNights > 0 ? revenue / totalNights : 0;

      // Average lead time (days between createdAt and checkIn)
      const leadTimes = channelBookings
        .filter(b => b.status !== 'cancelled')
        .map(b => {
          const diffMs = new Date(b.checkIn).getTime() - new Date(b.createdAt).getTime();
          return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        });
      const avgLeadTimeDays = leadTimes.length > 0
        ? leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length
        : 0;

      // Sync data for this channel
      const matchingConnections = channelConnections.filter(c => c.channel === source);
      let syncTotal = 0;
      let syncErrors = 0;
      let lastSyncAt: string | null = null;

      matchingConnections.forEach(conn => {
        const syncData = syncMap.get(conn.id);
        if (syncData) {
          syncData.logs.forEach(log => {
            syncTotal++;
            if (log.status === 'failed') syncErrors++;
          });
        }
        if (conn.lastSyncAt && (!lastSyncAt || conn.lastSyncAt > new Date(lastSyncAt))) {
          lastSyncAt = conn.lastSyncAt.toISOString();
        }
      });

      const syncSuccessRate = syncTotal > 0 ? ((syncTotal - syncErrors) / syncTotal) * 100 : 0;

      // Get display name from connection
      const connMeta = matchingConnections.find(c => c.displayName);
      const displayName = connMeta?.displayName || formatChannelName(source);

      channelAnalytics.push({
        channel: source,
        displayName,
        bookings: totalBookings,
        revenue,
        cancelledBookings,
        totalBookings,
        cancellationRate,
        commissionTotal,
        netRevenue,
        commissionRate,
        avgLeadTimeDays,
        adr,
        totalNights,
        syncSuccessRate,
        syncTotal,
        syncErrors,
        lastSyncAt,
      });
    });

    // Sort by revenue descending
    channelAnalytics.sort((a, b) => b.revenue - a.revenue);

    // 7. Summary stats
    const totalRevenue = channelAnalytics.reduce((sum, c) => sum + c.revenue, 0);
    const totalBookings = channelAnalytics.reduce((sum, c) => sum + c.bookings, 0);
    const totalCommissions = channelAnalytics.reduce((sum, c) => sum + c.commissionTotal, 0);
    const avgCommissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;
    const totalCancelled = channelAnalytics.reduce((sum, c) => sum + c.cancelledBookings, 0);
    const overallCancellationRate = totalBookings > 0 ? (totalCancelled / totalBookings) * 100 : 0;
    const bestChannel = channelAnalytics.length > 0 ? channelAnalytics[0] : null;

    // 8. Daily booking trend for last 30 days
    const dailyTrend: Array<{ date: string; channel: string; bookings: number; revenue: number }> = [];
    const dailyMap = new Map<string, Map<string, { bookings: number; revenue: number }>>();

    bookings.forEach(booking => {
      const dateKey = new Date(booking.createdAt).toISOString().split('T')[0];
      const source = booking.source || 'direct';

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, new Map());
      }
      const channelDayMap = dailyMap.get(dateKey)!;
      if (!channelDayMap.has(source)) {
        channelDayMap.set(source, { bookings: 0, revenue: 0 });
      }
      const dayData = channelDayMap.get(source)!;
      dayData.bookings++;
      if (booking.status !== 'cancelled') {
        dayData.revenue += booking.totalAmount || 0;
      }
    });

    dailyMap.forEach((channelDayMap, dateKey) => {
      channelDayMap.forEach((data, source) => {
        dailyTrend.push({
          date: dateKey,
          channel: source,
          bookings: data.bookings,
          revenue: data.revenue,
        });
      });
    });

    dailyTrend.sort((a, b) => a.date.localeCompare(b.date));

    // 9. Top / Bottom performers
    const sortedByNetRevenue = [...channelAnalytics].sort((a, b) => b.netRevenue - a.netRevenue);
    const topPerformers = sortedByNetRevenue.slice(0, 3);
    const bottomPerformers = sortedByNetRevenue.filter(c => c.revenue > 0).slice(-3).reverse();

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalBookings,
          totalCommissions,
          avgCommissionRate,
          overallCancellationRate,
          bestChannel: bestChannel ? {
            name: bestChannel.displayName,
            revenue: bestChannel.revenue,
          } : null,
          channelCount: channelAnalytics.length,
          totalNetRevenue: totalRevenue - totalCommissions,
          dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        },
        channels: channelAnalytics,
        dailyTrend,
        topPerformers,
        bottomPerformers,
        connections: channelConnections,
      },
    });
  } catch (error) {
    console.error('Error fetching channel analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel analytics' } },
      { status: 500 }
    );
  }
}

// Helper: format channel source names
function formatChannelName(source: string): string {
  const nameMap: Record<string, string> = {
    'booking_com': 'Booking.com',
    'expedia': 'Expedia',
    'airbnb': 'Airbnb',
    'hotels_com': 'Hotels.com',
    'agoda': 'Agoda',
    'vrbo': 'Vrbo',
    'tripadvisor': 'TripAdvisor',
    'makemytrip': 'MakeMyTrip',
    'goibibo': 'Goibibo',
    'oyo': 'OYO',
    'direct': 'Direct Booking',
    'walk_in': 'Walk-in',
    'phone': 'Phone',
    'email': 'Email',
    'website': 'Website',
    'agent': 'Travel Agent',
    'corporate': 'Corporate',
    'group': 'Group',
    'whatsapp': 'WhatsApp',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'google_hotels': 'Google Hotels',
    'trivago': 'Trivago',
    'priceline': 'Priceline',
    'hostelworld': 'Hostelworld',
    'despegar': 'Despegar',
    'cts': 'CTS',
  };

  if (nameMap[source]) return nameMap[source];

  // Try to format underscore-separated names
  return source
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
