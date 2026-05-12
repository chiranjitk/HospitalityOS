import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { Prisma } from '@prisma/client';

// ============================================
// GET handler
// ============================================
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const tenantId = user.tenantId;

    if (action === 'summary') {
      return handleSummary(request, tenantId);
    }
    if (action === 'forecast') {
      return handleForecast(request, tenantId);
    }
    if (action === 'config') {
      return handleGetConfig(tenantId);
    }

    // Default: pace data
    return handlePaceData(request, tenantId);
  } catch (error) {
    console.error('Booking pace error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking pace data' } },
      { status: 500 }
    );
  }
}

// ============================================
// POST handler (snapshot)
// ============================================
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'snapshot') {
      return handleSnapshot(user.tenantId, body);
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Unknown action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Booking pace POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process booking pace request' } },
      { status: 500 }
    );
  }
}

// ============================================
// PUT handler (update config)
// ============================================
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    if (body.action === 'update-config') {
      return handleUpdateConfig(user.tenantId, body);
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Unknown action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Booking pace PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking pace config' } },
      { status: 500 }
    );
  }
}

// ============================================
// Handle: Pace Data (main comparison view)
// ============================================
async function handlePaceData(request: NextRequest, tenantId: string) {
  const searchParams = request.nextUrl.searchParams;
  const arrivalFromStr = searchParams.get('arrivalFrom');
  const arrivalToStr = searchParams.get('arrivalTo');
  const channelCode = searchParams.get('channelCode');
  const roomTypeId = searchParams.get('roomTypeId');
  const comparisonPeriodOverride = searchParams.get('comparisonPeriod');

  // Default arrival range: next 90 days
  const now = new Date();
  const arrivalFrom = arrivalFromStr ? new Date(arrivalFromStr) : new Date(now.getTime());
  const arrivalTo = arrivalToStr ? new Date(arrivalToStr) : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if (isNaN(arrivalFrom.getTime()) || isNaN(arrivalTo.getTime())) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date range' } },
      { status: 400 }
    );
  }

  // Get config for comparison period
  const config = await db.bookingPaceConfig.findUnique({
    where: { tenantId },
  });

  const comparisonPeriod = comparisonPeriodOverride || config?.comparisonPeriod || 'same_period_last_year';

  // Calculate comparison date range
  const daySpan = Math.ceil((arrivalTo.getTime() - arrivalFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  let comparisonFrom: Date;
  let comparisonTo: Date;

  switch (comparisonPeriod) {
    case 'same_period_last_year':
      comparisonFrom = new Date(arrivalFrom);
      comparisonFrom.setFullYear(comparisonFrom.getFullYear() - 1);
      comparisonTo = new Date(arrivalTo);
      comparisonTo.setFullYear(comparisonTo.getFullYear() - 1);
      break;
    case 'same_period_last_month':
      comparisonFrom = new Date(arrivalFrom);
      comparisonFrom.setMonth(comparisonFrom.getMonth() - 1);
      comparisonTo = new Date(arrivalTo);
      comparisonTo.setMonth(comparisonTo.getMonth() - 1);
      break;
    case 'rolling_30_days':
      comparisonFrom = new Date(now.getTime() - (30 + daySpan) * 24 * 60 * 60 * 1000);
      comparisonTo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      comparisonFrom = new Date(arrivalFrom);
      comparisonFrom.setFullYear(comparisonFrom.getFullYear() - 1);
      comparisonTo = new Date(arrivalTo);
      comparisonTo.setFullYear(comparisonTo.getFullYear() - 1);
  }

  // Build common where clause
  const buildWhere = (aFrom: Date, aTo: Date): Prisma.BookingWhereInput => {
    const where: Prisma.BookingWhereInput = {
      tenantId,
      checkIn: { gte: aFrom, lte: aTo },
      status: { notIn: ['draft'] },
    };
    if (channelCode) {
      where.source = channelCode;
    }
    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }
    return where;
  };

  // Fetch current period bookings
  const currentBookings = await db.booking.findMany({
    where: buildWhere(arrivalFrom, arrivalTo),
    select: {
      id: true,
      checkIn: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      source: true,
      roomTypeId: true,
      nights: true,
    },
  });

  // Fetch comparison period bookings
  const comparisonBookings = await db.booking.findMany({
    where: buildWhere(comparisonFrom, comparisonTo),
    select: {
      id: true,
      checkIn: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      source: true,
      roomTypeId: true,
      nights: true,
    },
  });

  // Group by days-before-arrival for both periods
  // For current period: days before = arrivalDate - now
  // For comparison period: days before = arrivalDate - snapshotDate (adjusted)

  const paceInterval = config?.paceIntervalDays || 1;

  type PaceRow = {
    daysBeforeBucket: number;
    currentBookings: number;
    currentRooms: number;
    currentRevenue: number;
    currentCancellations: number;
    comparisonBookings: number;
    comparisonRooms: number;
    comparisonRevenue: number;
    comparisonCancellations: number;
  };

  // Build pace data grouped by days-before-arrival bucket
  const paceMap = new Map<number, PaceRow>();
  const maxDays = 120;

  for (let d = 0; d <= maxDays; d += paceInterval) {
    paceMap.set(d, {
      daysBeforeBucket: d,
      currentBookings: 0,
      currentRooms: 0,
      currentRevenue: 0,
      currentCancellations: 0,
      comparisonBookings: 0,
      comparisonRooms: 0,
      comparisonRevenue: 0,
      comparisonCancellations: 0,
    });
  }

  // Process current period
  currentBookings.forEach((b) => {
    const daysBefore = Math.max(0, Math.ceil((new Date(b.checkIn).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const bucket = Math.min(maxDays, Math.floor(daysBefore / paceInterval) * paceInterval);
    const row = paceMap.get(bucket);
    if (!row) return;
    row.currentBookings++;
    row.currentRooms++;
    if (b.status !== 'cancelled') {
      row.currentRevenue += b.totalAmount || 0;
    } else {
      row.currentCancellations++;
    }
  });

  // Process comparison period (shift dates)
  const compSnapshotBase = comparisonFrom;
  comparisonBookings.forEach((b) => {
    const daysBefore = Math.max(0, Math.ceil((new Date(b.checkIn).getTime() - compSnapshotBase.getTime()) / (24 * 60 * 60 * 1000)));
    const bucket = Math.min(maxDays, Math.floor(daysBefore / paceInterval) * paceInterval);
    const row = paceMap.get(bucket);
    if (!row) return;
    row.comparisonBookings++;
    row.comparisonRooms++;
    if (b.status !== 'cancelled') {
      row.comparisonRevenue += b.totalAmount || 0;
    } else {
      row.comparisonCancellations++;
    }
  });

  // Filter out empty buckets (both 0) and sort
  const paceData = Array.from(paceMap.values())
    .filter((r) => r.currentBookings > 0 || r.comparisonBookings > 0)
    .sort((a, b) => a.daysBeforeBucket - b.daysBeforeBucket);

  // Channel breakdown
  const channelBreakdown = buildChannelBreakdown(currentBookings, comparisonBookings, now, compSnapshotBase, paceInterval, maxDays);

  // Get channel connections for display names
  const channelNames = await getChannelNames(tenantId);

  return NextResponse.json({
    success: true,
    data: {
      paceData,
      channelBreakdown,
      channelNames,
      period: {
        arrivalFrom: arrivalFrom.toISOString(),
        arrivalTo: arrivalTo.toISOString(),
        comparisonFrom: comparisonFrom.toISOString(),
        comparisonTo: comparisonTo.toISOString(),
        comparisonPeriod,
        daySpan,
      },
      snapshotDate: now.toISOString(),
    },
  });
}

// ============================================
// Handle: Summary
// ============================================
async function handleSummary(request: NextRequest, tenantId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFuture = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Current period bookings (next 90 days)
  const currentBookings = await db.booking.findMany({
    where: {
      tenantId,
      checkIn: { gte: now, lte: ninetyDaysFuture },
      status: { notIn: ['draft'] },
    },
    select: {
      id: true,
      checkIn: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      source: true,
    },
  });

  // Last year same period
  const lastYearFrom = new Date(now);
  lastYearFrom.setFullYear(lastYearFrom.getFullYear() - 1);
  const lastYearTo = new Date(ninetyDaysFuture);
  lastYearTo.setFullYear(lastYearTo.getFullYear() - 1);

  const lastYearBookings = await db.booking.findMany({
    where: {
      tenantId,
      checkIn: { gte: lastYearFrom, lte: lastYearTo },
      status: { notIn: ['draft'] },
    },
    select: {
      id: true,
      checkIn: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      source: true,
    },
  });

  const currentActive = currentBookings.filter(b => b.status !== 'cancelled');
  const lastYearActive = lastYearBookings.filter(b => b.status !== 'cancelled');

  const totalPace = currentActive.length;
  const totalPaceRevenue = currentActive.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const lastYearTotal = lastYearActive.length;
  const lastYearRevenue = lastYearActive.reduce((s, b) => s + (b.totalAmount || 0), 0);

  const paceVsLastYearPct = lastYearTotal > 0
    ? ((totalPace - lastYearTotal) / lastYearTotal) * 100
    : totalPace > 0 ? 100 : 0;

  const revenueVsLastYearPct = lastYearRevenue > 0
    ? ((totalPaceRevenue - lastYearRevenue) / lastYearRevenue) * 100
    : totalPaceRevenue > 0 ? 100 : 0;

  // Top channel
  const channelCountMap = new Map<string, { bookings: number; revenue: number }>();
  currentActive.forEach(b => {
    const source = b.source || 'direct';
    const existing = channelCountMap.get(source) || { bookings: 0, revenue: 0 };
    existing.bookings++;
    existing.revenue += b.totalAmount || 0;
    channelCountMap.set(source, existing);
  });

  let topChannel = 'N/A';
  let topChannelRevenue = 0;
  channelCountMap.forEach((v, k) => {
    if (v.revenue > topChannelRevenue) {
      topChannelRevenue = v.revenue;
      topChannel = k;
    }
  });

  // On-track indicator
  const onTrack = Math.abs(paceVsLastYearPct) <= 10 ? 'on_track' : paceVsLastYearPct > 0 ? 'ahead' : 'behind';

  // Pace ADR
  const paceADR = totalPace > 0 ? totalPaceRevenue / totalPace : 0;
  const lastYearADR = lastYearTotal > 0 ? lastYearRevenue / lastYearTotal : 0;

  // Cancellation rate
  const cancelRate = currentBookings.length > 0
    ? (currentBookings.filter(b => b.status === 'cancelled').length / currentBookings.length) * 100
    : 0;

  // Snapshot count
  const snapshotCount = await db.bookingPaceSnapshot.count({
    where: { tenantId },
  });

  const channelNames = await getChannelNames(tenantId);

  return NextResponse.json({
    success: true,
    data: {
      totalPace,
      totalPaceRevenue,
      paceVsLastYearPct,
      revenueVsLastYearPct,
      lastYearTotal,
      lastYearRevenue,
      topChannel,
      topChannelRevenue,
      topChannelDisplayName: channelNames[topChannel] || formatChannelName(topChannel),
      onTrack,
      paceADR,
      lastYearADR,
      cancelRate,
      snapshotCount,
      channelCount: channelCountMap.size,
      periodLabel: 'Next 90 Days',
    },
  });
}

// ============================================
// Handle: Forecast
// ============================================
async function handleForecast(request: NextRequest, tenantId: string) {
  const now = new Date();
  const ninetyDaysFuture = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Get bookings for next 90 days
  const currentBookings = await db.booking.findMany({
    where: {
      tenantId,
      checkIn: { gte: now, lte: ninetyDaysFuture },
      status: { notIn: ['draft', 'cancelled'] },
    },
    select: {
      checkIn: true,
      totalAmount: true,
    },
  });

  // Group by week
  const weeklyData = new Map<string, { bookings: number; revenue: number }>();
  for (let w = 0; w < 13; w++) {
    const weekStart = new Date(now.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const key = `week_${w}`;
    weeklyData.set(key, { bookings: 0, revenue: 0 });

    currentBookings.forEach(b => {
      const ci = new Date(b.checkIn);
      if (ci >= weekStart && ci < weekEnd) {
        const d = weeklyData.get(key)!;
        d.bookings++;
        d.revenue += b.totalAmount || 0;
      }
    });
  }

  // Simple linear forecast based on first 4 weeks trend
  const first4Weeks = Array.from(weeklyData.entries()).slice(0, 4);
  const avgFirst4 = first4Weeks.reduce((sum, [, d]) => sum + d.bookings, 0) / 4;

  const forecastWeeks = Array.from(weeklyData.entries()).map(([week, data], i) => {
    const forecastBookings = Math.round(avgFirst4 * (1 + (i - 2) * 0.02));
    const forecastRevenue = forecastBookings * (data.bookings > 0 ? data.revenue / data.bookings : 0);
    const actualBookings = data.bookings;
    const actualRevenue = data.revenue;

    return {
      week,
      weekNumber: i + 1,
      startDate: new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString(),
      actualBookings,
      actualRevenue,
      forecastBookings: Math.max(0, forecastBookings),
      forecastRevenue: Math.max(0, forecastRevenue),
      variance: actualBookings - Math.max(0, forecastBookings),
    };
  });

  // Total forecast
  const totalActual = currentBookings.length;
  const totalRevenue = currentBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalForecast = forecastWeeks.reduce((s, w) => s + w.forecastBookings, 0);
  const totalForecastRevenue = forecastWeeks.reduce((s, w) => s + w.forecastRevenue, 0);

  return NextResponse.json({
    success: true,
    data: {
      weekly: forecastWeeks,
      totalActual,
      totalRevenue,
      totalForecast,
      totalForecastRevenue,
      pacingPercent: totalForecast > 0 ? (totalActual / totalForecast) * 100 : 0,
    },
  });
}

// ============================================
// Handle: Get Config
// ============================================
async function handleGetConfig(tenantId: string) {
  const config = await db.bookingPaceConfig.findUnique({
    where: { tenantId },
  });

  return NextResponse.json({
    success: true,
    data: config || {
      tenantId,
      comparisonPeriod: 'same_period_last_year',
      lookbackDays: 90,
      paceIntervalDays: 1,
      isActive: true,
    },
  });
}

// ============================================
// Handle: Update Config
// ============================================
async function handleUpdateConfig(tenantId: string, body: Record<string, unknown>) {
  const { comparisonPeriod, lookbackDays, paceIntervalDays, isActive, customPeriodFrom, customPeriodTo } = body;

  const updateData: Prisma.BookingPaceConfigUpsertArgs['update'] = {};
  if (comparisonPeriod && typeof comparisonPeriod === 'string') {
    (updateData as Record<string, unknown>).comparisonPeriod = comparisonPeriod;
  }
  if (lookbackDays !== undefined && typeof lookbackDays === 'number') {
    (updateData as Record<string, unknown>).lookbackDays = lookbackDays;
  }
  if (paceIntervalDays !== undefined && typeof paceIntervalDays === 'number') {
    (updateData as Record<string, unknown>).paceIntervalDays = paceIntervalDays;
  }
  if (isActive !== undefined && typeof isActive === 'boolean') {
    (updateData as Record<string, unknown>).isActive = isActive;
  }
  if (customPeriodFrom) {
    (updateData as Record<string, unknown>).customPeriodFrom = new Date(customPeriodFrom as string);
  }
  if (customPeriodTo) {
    (updateData as Record<string, unknown>).customPeriodTo = new Date(customPeriodTo as string);
  }

  const config = await db.bookingPaceConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      comparisonPeriod: (comparisonPeriod as string) || 'same_period_last_year',
      lookbackDays: (lookbackDays as number) || 90,
      paceIntervalDays: (paceIntervalDays as number) || 1,
      isActive: isActive !== false,
      customPeriodFrom: customPeriodFrom ? new Date(customPeriodFrom as string) : null,
      customPeriodTo: customPeriodTo ? new Date(customPeriodTo as string) : null,
    },
    update: updateData,
  });

  return NextResponse.json({
    success: true,
    data: config,
  });
}

// ============================================
// Handle: Create Snapshot
// ============================================
async function handleSnapshot(tenantId: string, body: Record<string, unknown>) {
  const now = new Date();
  const lookbackDays = (body.lookbackDays as number) || 90;

  const futureDate = new Date(now.getTime() + lookbackDays * 24 * 60 * 60 * 1000);

  // Get all bookings arriving in the next lookback period
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      checkIn: { gte: now, lte: futureDate },
      status: { notIn: ['draft'] },
    },
    select: {
      id: true,
      checkIn: true,
      totalAmount: true,
      status: true,
      source: true,
      roomTypeId: true,
    },
  });

  // Group by (arrivalDate, channelCode, roomTypeId)
  const groupMap = new Map<string, {
    arrivalDate: Date;
    daysBeforeArrival: number;
    channelCode: string | null;
    roomTypeId: string | null;
    totalBookings: number;
    totalRooms: number;
    totalRevenue: number;
    cancellations: number;
    netBookings: number;
  }>();

  bookings.forEach((b) => {
    const arrivalDate = new Date(b.checkIn);
    const daysBefore = Math.max(0, Math.ceil((arrivalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const channelCode = b.source || null;
    const roomTypeId = b.roomTypeId || null;
    const key = `${arrivalDate.toISOString().split('T')[0]}_${channelCode || 'all'}_${roomTypeId || 'all'}`;

    const existing = groupMap.get(key);
    if (existing) {
      existing.totalBookings++;
      existing.totalRooms++;
      if (b.status === 'cancelled') {
        existing.cancellations++;
      } else {
        existing.totalRevenue += b.totalAmount || 0;
        existing.netBookings++;
      }
    } else {
      groupMap.set(key, {
        arrivalDate,
        daysBeforeArrival: daysBefore,
        channelCode,
        roomTypeId,
        totalBookings: 1,
        totalRooms: 1,
        totalRevenue: b.status !== 'cancelled' ? (b.totalAmount || 0) : 0,
        cancellations: b.status === 'cancelled' ? 1 : 0,
        netBookings: b.status !== 'cancelled' ? 1 : 0,
      });
    }
  });

  // Upsert snapshots
  const operations = Array.from(groupMap.values()).map((g) => {
    const adr = g.netBookings > 0 ? g.totalRevenue / g.netBookings : 0;
    return db.bookingPaceSnapshot.upsert({
      where: {
        tenantId_arrivalDate_snapshotDate_channelCode_roomTypeId: {
          tenantId,
          arrivalDate: g.arrivalDate,
          snapshotDate: now,
          channelCode: g.channelCode,
          roomTypeId: g.roomTypeId,
        },
      },
      create: {
        tenantId,
        arrivalDate: g.arrivalDate,
        snapshotDate: now,
        daysBeforeArrival: g.daysBeforeArrival,
        channelCode: g.channelCode,
        roomTypeId: g.roomTypeId,
        totalBookings: g.totalBookings,
        totalRooms: g.totalRooms,
        totalRevenue: g.totalRevenue,
        adr,
        cancellations: g.cancellations,
        netBookings: g.netBookings,
      },
      update: {
        totalBookings: g.totalBookings,
        totalRooms: g.totalRooms,
        totalRevenue: g.totalRevenue,
        adr,
        cancellations: g.cancellations,
        netBookings: g.netBookings,
        daysBeforeArrival: g.daysBeforeArrival,
      },
    });
  });

  await Promise.all(operations);

  return NextResponse.json({
    success: true,
    data: {
      snapshotDate: now.toISOString(),
      snapshotsCreated: groupMap.size,
      lookbackDays,
    },
  });
}

// ============================================
// Helpers
// ============================================

function buildChannelBreakdown(
  currentBookings: Array<{ checkIn: Date | string; createdAt: Date | string; totalAmount: number; status: string; source: string }>,
  comparisonBookings: Array<{ checkIn: Date | string; createdAt: Date | string; totalAmount: number; status: string; source: string }>,
  now: Date,
  compBase: Date,
  paceInterval: number,
  maxDays: number,
) {
  type ChannelRow = {
    channel: string;
    currentBookings: number;
    currentRevenue: number;
    comparisonBookings: number;
    comparisonRevenue: number;
    variancePct: number;
  };

  const channelMap = new Map<string, ChannelRow>();

  currentBookings.forEach((b) => {
    if (b.status === 'cancelled') return;
    const ch = b.source || 'direct';
    const existing = channelMap.get(ch) || {
      channel: ch,
      currentBookings: 0,
      currentRevenue: 0,
      comparisonBookings: 0,
      comparisonRevenue: 0,
      variancePct: 0,
    };
    existing.currentBookings++;
    existing.currentRevenue += b.totalAmount || 0;
    channelMap.set(ch, existing);
  });

  comparisonBookings.forEach((b) => {
    if (b.status === 'cancelled') return;
    const ch = b.source || 'direct';
    const existing = channelMap.get(ch) || {
      channel: ch,
      currentBookings: 0,
      currentRevenue: 0,
      comparisonBookings: 0,
      comparisonRevenue: 0,
      variancePct: 0,
    };
    existing.comparisonBookings++;
    existing.comparisonRevenue += b.totalAmount || 0;
    channelMap.set(ch, existing);
  });

  const result = Array.from(channelMap.values());
  result.forEach(r => {
    r.variancePct = r.comparisonBookings > 0
      ? ((r.currentBookings - r.comparisonBookings) / r.comparisonBookings) * 100
      : r.currentBookings > 0 ? 100 : 0;
  });

  result.sort((a, b) => b.currentRevenue - a.currentRevenue);
  return result;
}

async function getChannelNames(tenantId: string): Promise<Record<string, string>> {
  const connections = await db.channelConnection.findMany({
    where: { tenantId },
    select: { channel: true, displayName: true },
  });

  const names: Record<string, string> = {};
  connections.forEach(c => {
    names[c.channel] = c.displayName || formatChannelName(c.channel);
  });
  return names;
}

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
  };
  return nameMap[source] || source.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
