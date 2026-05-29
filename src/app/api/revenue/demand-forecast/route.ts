import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { format, addDays, eachDayOfInterval, subDays, getDay, getMonth, parseISO } from 'date-fns';
import { runTimeSeriesForecast, type RegressionFeatureRow, analyzeBookingPace } from '@/lib/revenue/time-series-forecast';

// GET /api/revenue/demand-forecast - Get demand forecast
// ?model=rules (default) | timeseries | ensemble
export async function GET(request: NextRequest) {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

  try {
    const tenantId = ctx.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const horizon = Math.min(parseInt(searchParams.get('horizon') || '30', 10), 90); // Cap at 90 days
    const roomType = searchParams.get('roomType');
    const model = searchParams.get('model') || 'rules'; // rules | timeseries | ensemble

    // M-65: Apply roomType filter to bookings and rooms queries
    const roomTypeFilter = roomType || null;

    // Get total rooms for occupancy calculation (filtered via property → tenant)
    const propertyIds = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const roomsWhere: Record<string, unknown> = { deletedAt: null, propertyId: { in: propertyIds.map(p => p.id) } };
    if (roomTypeFilter) roomsWhere.roomTypeId = roomTypeFilter;
    const rooms = await db.room.findMany({
      where: roomsWhere,
      select: { status: true, roomTypeId: true },
    });

    const totalRooms = rooms.length || 1; // Avoid division by zero

    // M-66: Determine actual data availability for confidence scoring
    const ninetyDaysAgo = subDays(new Date(), 90);
    const earliestBooking = await db.booking.findFirst({
      where: { tenantId, status: { notIn: ['cancelled', 'no_show'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const earliestCheckin = await db.booking.findFirst({
      where: { tenantId, status: { notIn: ['cancelled', 'no_show'] }, checkIn: { not: null } },
      orderBy: { checkIn: 'asc' },
      select: { checkIn: true },
    });

    const now = new Date();
    const dataStartDate = earliestBooking?.createdAt || earliestCheckin?.checkIn || now;
    const availableDays = Math.max(0, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
    const dataAvailableRatio = Math.min(1, availableDays / 90);

    // Use the earlier of 90 days ago or actual data start for queries
    const effectiveStartDate = dataStartDate > ninetyDaysAgo ? dataStartDate : ninetyDaysAgo;

    // Get historical booking data for analysis
    const bookingWhere: Record<string, unknown> = {
      tenantId,
      status: { notIn: ['cancelled', 'no_show'] },
      createdAt: { gte: effectiveStartDate },
    };
    if (roomTypeFilter) bookingWhere.roomTypeId = roomTypeFilter;
    const bookings = await db.booking.findMany({
      where: bookingWhere,
      include: {
        roomType: { select: { name: true, id: true } },
      },
    });

    // Get historical check-ins for pattern analysis
    const checkInWhere: Record<string, unknown> = {
      tenantId,
      status: { notIn: ['cancelled', 'no_show'] },
      checkIn: { gte: effectiveStartDate },
    };
    if (roomTypeFilter) checkInWhere.roomTypeId = roomTypeFilter;
    const checkIns = await db.booking.findMany({
      where: checkInWhere,
      select: {
        checkIn: true,
        checkOut: true,
        roomId: true,
      },
    });

    // ─── Time-Series / Ensemble path ─────────────────────────────────────
    if (model === 'timeseries' || model === 'ensemble') {
      return handleTimeSeriesForecast({
        tenantId,
        propertyIds,
        totalRooms,
        checkIns,
        bookings,
        effectiveStartDate,
        horizon,
        roomTypeFilter,
        availableDays,
        dataAvailableRatio,
        model,
      });
    }

    // ─── Rules-based path (default, backward compatible) ──────────────────
    return handleRulesBasedForecast({
      tenantId,
      propertyIds,
      totalRooms,
      checkIns,
      bookings,
      effectiveStartDate,
      horizon,
      availableDays,
      dataAvailableRatio,
    });
  } catch (error) {
    console.error('Error generating demand forecast:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate demand forecast' } },
      { status: 500 }
    );
  }
}

// ─── Time-Series Forecast Handler ────────────────────────────────────────────

async function handleTimeSeriesForecast(params: {
  tenantId: string;
  propertyIds: Array<{ id: string }>;
  totalRooms: number;
  checkIns: Array<{ checkIn: Date; checkOut: Date; roomId: string }>;
  bookings: Array<{ createdAt: Date; checkIn: Date; checkOut: Date; roomType: { name: string; id: string } }>;
  effectiveStartDate: Date;
  horizon: number;
  roomTypeFilter: string | null;
  availableDays: number;
  dataAvailableRatio: number;
  model: string;
}) {
  const {
    tenantId, propertyIds, totalRooms, checkIns, bookings,
    effectiveStartDate, horizon, availableDays, dataAvailableRatio, model,
  } = params;

  // Build daily occupancy time series
  const occupancyByDay = new Map<string, number>();
  for (const booking of checkIns) {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    for (let d = start; d < end; d = addDays(d, 1)) {
      const dayStr = format(d, 'yyyy-MM-dd');
      const current = occupancyByDay.get(dayStr) || 0;
      occupancyByDay.set(dayStr, current + 1);
    }
  }

  // Build sorted historical data arrays
  const historicalDates: string[] = [];
  for (let d = new Date(effectiveStartDate); d <= new Date(); d = addDays(d, 1)) {
    historicalDates.push(format(d, 'yyyy-MM-dd'));
  }

  const historicalData = historicalDates.map(d => {
    const occupied = occupancyByDay.get(d) || 0;
    return Math.min(100, (occupied / totalRooms) * 100);
  });

  // Build feature rows for regression
  const features: RegressionFeatureRow[] = historicalDates.map(dateStr => {
    const d = new Date(dateStr);
    return {
      dayOfWeek: d.getDay(),
      month: d.getMonth(),
      dayOfYear: Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)),
      isHoliday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      leadTime: 0,
      eventsCount: 0,
      competitorPrice: 0,
      weatherScore: 50,
    };
  });

  // Run time-series forecast
  const tsResult = runTimeSeriesForecast({
    historicalData,
    historicalDates,
    horizon,
    features,
  });

  // Generate forecast dates
  const startDate = new Date();
  const endDate = addDays(startDate, horizon);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Build forecast data from ensemble
  const forecastData = days.map((day, index) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const actualOccupied = occupancyByDay.get(dayStr);
    const actual = index < 7 && actualOccupied !== undefined
      ? Math.min(100, Math.round((actualOccupied / totalRooms) * 100))
      : undefined;

    return {
      date: dayStr,
      predicted: Math.round(Math.min(100, Math.max(0, tsResult.ensemble.prediction[index] || 0))),
      actual,
      lowerBound: Math.round(Math.max(0, tsResult.ensemble.lower[index] || 0)),
      upperBound: Math.round(Math.min(100, tsResult.ensemble.upper[index] || 100)),
      confidence: Math.round(tsResult.ensemble.confidence * 100 * Math.max(0.5, 1 - index * 0.01)),
    };
  });

  // Booking pace analysis (for arrival date = today + 30)
  const arrivalDate = addDays(new Date(), 30);
  const allHistoricalBookings = await db.booking.findMany({
    where: {
      tenantId,
      status: { notIn: ['cancelled', 'no_show'] },
      checkIn: { gte: subDays(effectiveStartDate, 90), lte: addDays(new Date(), 60) },
    },
    select: { checkIn: true, createdAt: true },
  });

  const currentBookingsForTarget = await db.booking.count({
    where: {
      tenantId,
      status: { notIn: ['cancelled', 'no_show'] },
      checkIn: { gte: arrivalDate, lt: addDays(arrivalDate, 1) },
    },
  });

  const paceAnalysis = analyzeBookingPace(
    allHistoricalBookings,
    currentBookingsForTarget,
    arrivalDate,
  );

  // Generate insights from time-series forecast
  const peakDays = forecastData.filter(d => d.predicted >= 85);
  const lowDays = forecastData.filter(d => d.predicted < 50);

  const insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'info';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    date: string;
  }> = [];

  if (peakDays.length > 0) {
    insights.push({
      id: '1', type: 'opportunity', title: 'High Demand Period (TS)',
      description: `${peakDays.length} days predicted 85%+ occupancy by ${tsResult.bestModel}. Consider rate increases.`,
      impact: 'high', date: peakDays[0].date,
    });
  }
  if (lowDays.length > 0) {
    insights.push({
      id: '2', type: 'warning', title: 'Low Demand Period (TS)',
      description: `${lowDays.length} days predicted below 50% occupancy. Consider promotions.`,
      impact: 'medium', date: lowDays[0].date,
    });
  }
  if (paceAnalysis.status === 'behind') {
    insights.push({
      id: '3', type: 'warning', title: 'Booking Pace Behind',
      description: paceAnalysis.recommendation,
      impact: 'medium', date: paceAnalysis.arrivalDate,
    });
  } else if (paceAnalysis.status === 'strong_ahead' || paceAnalysis.status === 'ahead') {
    insights.push({
      id: '3', type: 'info', title: 'Strong Booking Pace',
      description: paceAnalysis.recommendation,
      impact: 'high', date: paceAnalysis.arrivalDate,
    });
  }

  // Save forecast to DemandForecast table
  const firstPropertyId = propertyIds[0]?.id;
  if (firstPropertyId) {
    for (let i = 0; i < Math.min(forecastData.length, 30); i++) {
      const d = forecastData[i];
      await db.demandForecast.upsert({
        where: {
          id: `${firstPropertyId}-${d.date}`,
        },
        create: {
          id: `${firstPropertyId}-${d.date}`,
          tenantId,
          propertyId: firstPropertyId,
          date: new Date(d.date + 'T00:00:00.000Z'),
          demandScore: Math.round(d.predicted),
          occupancyForecast: d.predicted,
          seasonalFactor: tsResult.holtWinters.period > 0 ? 1 : 0,
          confidence: d.confidence / 100,
          generatedBy: 'ml_timeseries',
          modelVersion: 'ts-v1',
        },
        update: {
          demandScore: Math.round(d.predicted),
          occupancyForecast: d.predicted,
          confidence: d.confidence / 100,
          generatedBy: model === 'ensemble' ? 'ml_timeseries_ensemble' : 'ml_timeseries',
          modelVersion: 'ts-v1',
        },
      });
    }
  }

  // Events
  const dbEvents = await db.event.findMany({
    where: {
      tenantId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      status: { in: ['confirmed', 'active'] },
    },
    select: { id: true, name: true, type: true, startDate: true, expectedAttendance: true },
  });

  const eventImpacts = dbEvents
    .map(e => ({
      id: e.id,
      name: e.name,
      type: e.type || 'event',
      date: format(new Date(e.startDate), 'yyyy-MM-dd'),
      expectedImpact: Math.min(30, Math.round((e.expectedAttendance || 50) / totalRooms * 2)),
      confidence: 85,
      radius: Math.ceil((e.expectedAttendance || 50) / totalRooms * 2),
    }))
    .sort((a, b) => a.expectedImpact - b.expectedImpact);

  const avgPredictedOccupancy = Math.round(forecastData.reduce((sum, d) => sum + d.predicted, 0) / forecastData.length);

  return NextResponse.json({
    success: true,
    data: {
      forecast: forecastData.map(d => ({
        ...d,
        isWeekend: getDay(parseISO(d.date)) === 0 || getDay(parseISO(d.date)) === 6,
        hasEvent: eventImpacts.some(e => e.date === d.date),
      })),
      insights: insights.map(i => ({
        ...i,
        action: i.type === 'opportunity' ? 'Adjust Pricing' : undefined,
      })),
      seasonalTrends: [],
      eventImpacts,
      metrics: {
        accuracy: Math.round(tsResult.ensemble.confidence * 100),
        avgPredictedOccupancy,
        peakDays: peakDays.length,
        lowDays: lowDays.length,
        seasonalFactor: Math.round(tsResult.seasonalPeriod * 10) / 10,
        bookingPace: Math.round(paceAnalysis.paceIndex * 100) / 100,
        pickupRate: paceAnalysis.predictedTotal,
      },
      dataAvailability: {
        availableDays,
        targetDays: 90,
        ratio: Math.round(dataAvailableRatio * 100) / 100,
        confidence: Math.round(tsResult.ensemble.confidence * 100),
        model: `time_series_${tsResult.bestModel}`,
        propertyType: 'hotel',
        daysOfWeekWithData: availableDays >= 7 ? 7 : 0,
        monthsWithData: Math.min(12, Math.floor(availableDays / 30)),
        trendAvailable: true,
      },
      // Time-series specific metadata
      timeSeries: {
        model: model === 'ensemble' ? 'ensemble' : tsResult.bestModel,
        bestModel: tsResult.bestModel,
        bestMAPE: Math.round(tsResult.bestMAPE * 100) / 100,
        seasonalPeriod: tsResult.seasonalPeriod,
        isStationary: tsResult.isStationary,
        dataPoints: tsResult.dataPoints,
        holtWinters: {
          type: tsResult.holtWinters.type,
          alpha: tsResult.holtWinters.alpha,
          beta: tsResult.holtWinters.beta,
          gamma: tsResult.holtWinters.gamma,
          period: tsResult.holtWinters.period,
          mape: Math.round(tsResult.holtWinters.mape * 100) / 100,
        },
        arima: {
          order: tsResult.arima.modelOrder,
          aic: Math.round(tsResult.arima.aic * 100) / 100,
          bic: Math.round(tsResult.arima.bic * 100) / 100,
          mape: Math.round(tsResult.arima.mape * 100) / 100,
        },
        modelWeights: tsResult.ensemble.modelWeights,
        bookingPace: {
          status: paceAnalysis.status,
          paceIndex: paceAnalysis.paceIndex,
          currentPace: paceAnalysis.currentPace,
          predictedTotal: paceAnalysis.predictedTotal,
          recommendation: paceAnalysis.recommendation,
          confidence: paceAnalysis.confidence,
        },
      },
    },
  });
}

// ─── Rules-Based Forecast Handler (original logic) ──────────────────────────

async function handleRulesBasedForecast(params: {
  tenantId: string;
  propertyIds: Array<{ id: string }>;
  totalRooms: number;
  checkIns: Array<{ checkIn: Date; checkOut: Date; roomId: string }>;
  bookings: Array<{ createdAt: Date; checkIn: Date; checkOut: Date; roomType: { name: string; id: string } }>;
  effectiveStartDate: Date;
  horizon: number;
  availableDays: number;
  dataAvailableRatio: number;
}) {
  const {
    tenantId, totalRooms, checkIns, bookings,
    effectiveStartDate, horizon, availableDays, dataAvailableRatio,
  } = params;

  const PROPERTY_TYPE_DEFAULTS: Record<string, number[]> = {
    hotel:       [65, 60, 55, 55, 60, 80, 85],
    resort:      [55, 50, 50, 50, 55, 90, 92],
    hostel:      [70, 65, 60, 65, 70, 90, 88],
    apartment:   [50, 50, 50, 50, 50, 60, 60],
    villa:       [40, 40, 40, 40, 45, 70, 75],
    guesthouse:  [60, 55, 55, 55, 60, 75, 80],
  };

  const firstProperty = params.propertyIds.length > 0
    ? await db.property.findFirst({ where: { id: params.propertyIds[0].id }, select: { type: true } })
    : null;
  const propertyType = firstProperty?.type || 'hotel';
  const defaultDowFactors = PROPERTY_TYPE_DEFAULTS[propertyType] || PROPERTY_TYPE_DEFAULTS.hotel;

  const dayOfWeekOccupancy: Record<number, { total: number; occupied: number }> = {};
  for (let i = 0; i < 7; i++) dayOfWeekOccupancy[i] = { total: 0, occupied: 0 };

  const occupancyByDay = new Map<string, number>();
  for (const booking of checkIns) {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    for (let d = start; d < end; d = addDays(d, 1)) {
      const dayStr = format(d, 'yyyy-MM-dd');
      occupancyByDay.set(dayStr, (occupancyByDay.get(dayStr) || 0) + 1);
    }
  }

  for (const [dayStr, occupied] of occupancyByDay) {
    const day = new Date(dayStr);
    const dow = getDay(day);
    dayOfWeekOccupancy[dow].total++;
    dayOfWeekOccupancy[dow].occupied += occupied;
  }

  const dayOfWeekFactors: number[] = [];
  const daysOfWeekWithData = Object.values(dayOfWeekOccupancy).filter(d => d.total > 0).length;
  for (let i = 0; i < 7; i++) {
    const data = dayOfWeekOccupancy[i];
    if (data.total > 0) {
      const avgOccupied = data.occupied / data.total;
      const actualFactor = (avgOccupied / totalRooms) * 100;
      const blendWeight = Math.min(1, availableDays / 30);
      dayOfWeekFactors[i] = Math.round((actualFactor * blendWeight + defaultDowFactors[i] * (1 - blendWeight)) * 10) / 10;
    } else {
      dayOfWeekFactors[i] = defaultDowFactors[i];
    }
  }

  const monthlyOccupancy: Record<number, { total: number; occupied: number }> = {};
  for (let i = 0; i < 12; i++) monthlyOccupancy[i] = { total: 0, occupied: 0 };
  for (const [dayStr, occupied] of occupancyByDay) {
    const month = getMonth(new Date(dayStr));
    monthlyOccupancy[month].total++;
    monthlyOccupancy[month].occupied += occupied;
  }

  const effectiveDays = Math.max(30, Math.ceil((new Date().getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const overallAvgOccupancy = bookings.length > 0
    ? (checkIns.length / totalRooms) * (effectiveDays / 30)
    : defaultDowFactors.reduce((a, b) => a + b, 0) / 7;

  const monthlyFactors: number[] = [];
  const monthsWithData = Object.values(monthlyOccupancy).filter(m => m.total > 0).length;
  for (let i = 0; i < 12; i++) {
    const data = monthlyOccupancy[i];
    monthlyFactors[i] = data.total > 0
      ? (overallAvgOccupancy > 0 ? ((data.occupied / data.total) / totalRooms * 100) / overallAvgOccupancy : 1)
      : 1;
  }

  const thirtyDaysAgo = subDays(new Date(), 30);
  const sixtyDaysAgo = subDays(new Date(), 60);
  const recentBookings = bookings.filter(b => new Date(b.createdAt) >= thirtyDaysAgo).length;
  const earlierBookings = bookings.filter(b => {
    const date = new Date(b.createdAt);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  }).length;
  const canComputeTrend = availableDays >= 60 && earlierBookings > 0;
  const trendFactor = canComputeTrend
    ? Math.min(1.5, Math.max(0.5, (recentBookings / 30) / (earlierBookings / 30)))
    : 1;

  const startDate = new Date();
  const endDate = addDays(startDate, horizon);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const forecastData = days.map((day, index) => {
    const dow = getDay(day);
    const month = getMonth(day);
    let baseOccupancy = dayOfWeekFactors[dow] || 50;
    baseOccupancy *= (monthlyFactors[month] || 1);
    baseOccupancy *= trendFactor;
    baseOccupancy *= (1 - index * 0.002);
    const confidence = Math.max(50, 90 - index * 0.3);
    const margin = 5 + index * 0.15;
    const predicted = Math.min(100, Math.max(0, baseOccupancy));
    const dayStr = format(day, 'yyyy-MM-dd');
    const actualOccupied = occupancyByDay.get(dayStr);
    const actual = index < 7 && actualOccupied !== undefined
      ? Math.min(100, Math.round((actualOccupied / totalRooms) * 100))
      : undefined;
    return {
      date: dayStr,
      predicted: Math.round(predicted),
      actual,
      lowerBound: Math.round(Math.max(0, predicted - margin)),
      upperBound: Math.round(Math.min(100, predicted + margin)),
      confidence: Math.round(confidence),
    };
  });

  const peakDays = forecastData.filter(d => d.predicted >= 85);
  const lowDays = forecastData.filter(d => d.predicted < 50);

  const insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'info';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    date: string;
  }> = [];

  if (peakDays.length > 0) {
    insights.push({
      id: '1', type: 'opportunity', title: 'High Demand Period',
      description: `${peakDays.length} days with predicted 85%+ occupancy. Consider rate increases of 15-20%.`,
      impact: 'high', date: peakDays[0].date,
    });
  }
  if (lowDays.length > 0) {
    insights.push({
      id: '2', type: 'warning', title: 'Low Demand Period',
      description: `${lowDays.length} days with predicted occupancy below 50%. Consider promotional offers.`,
      impact: 'medium', date: lowDays[0].date,
    });
  }
  if (trendFactor > 1.1) {
    insights.push({
      id: '3', type: 'info', title: 'Upward Booking Trend',
      description: `Booking velocity increased ${Math.round((trendFactor - 1) * 100)}% vs previous period.`,
      impact: 'medium', date: format(addDays(startDate, 7), 'yyyy-MM-dd'),
    });
  } else if (trendFactor < 0.9) {
    insights.push({
      id: '3', type: 'warning', title: 'Declining Booking Trend',
      description: `Booking velocity decreased ${Math.round((1 - trendFactor) * 100)}% vs previous period.`,
      impact: 'medium', date: format(addDays(startDate, 7), 'yyyy-MM-dd'),
    });
  }

  const dataConfidence = Math.min(95, Math.round(40 + dataAvailableRatio * 55));
  const seasonalTrends = [
    { season: 'Winter (Dec-Feb)', avgOccupancy: Math.round((dayOfWeekFactors.reduce((a, b) => a + b, 0) / 7) * 0.85), trend: -3, peak: 'Dec 25', low: 'Jan 10' },
    { season: 'Spring (Mar-May)', avgOccupancy: Math.round((dayOfWeekFactors.reduce((a, b) => a + b, 0) / 7) * 1.05), trend: 5, peak: 'Apr 15', low: 'Mar 5' },
    { season: 'Summer (Jun-Aug)', avgOccupancy: Math.round((dayOfWeekFactors.reduce((a, b) => a + b, 0) / 7) * 1.15), trend: 8, peak: 'Jul 15', low: 'Jun 5' },
    { season: 'Monsoon (Jul-Sep)', avgOccupancy: Math.round((dayOfWeekFactors.reduce((a, b) => a + b, 0) / 7) * 0.75), trend: -8, peak: 'Aug 15', low: 'Jul 25' },
  ];

  const dbEvents = await db.event.findMany({
    where: { tenantId, startDate: { lte: endDate }, endDate: { gte: startDate }, status: { in: ['confirmed', 'active'] } },
    select: { id: true, name: true, type: true, startDate: true, expectedAttendance: true },
  });

  const eventImpacts = dbEvents
    .map(e => ({
      id: e.id, name: e.name, type: e.type || 'event',
      date: format(new Date(e.startDate), 'yyyy-MM-dd'),
      expectedImpact: Math.min(30, Math.round((e.expectedAttendance || 50) / totalRooms * 2)),
      confidence: 85, radius: Math.ceil((e.expectedAttendance || 50) / totalRooms * 2),
    }))
    .sort((a, b) => a.expectedImpact - b.expectedImpact);

  const avgPredictedOccupancy = Math.round(forecastData.reduce((sum, d) => sum + d.predicted, 0) / forecastData.length);

  return NextResponse.json({
    success: true,
    data: {
      forecast: forecastData.map(d => ({
        ...d,
        isWeekend: getDay(parseISO(d.date)) === 0 || getDay(parseISO(d.date)) === 6,
        hasEvent: eventImpacts.some(e => e.date === d.date),
      })),
      insights: insights.map(i => ({ ...i, action: i.type === 'opportunity' ? 'Adjust Pricing' : undefined })),
      seasonalTrends,
      eventImpacts,
      metrics: {
        accuracy: dataConfidence,
        avgPredictedOccupancy,
        peakDays: peakDays.length,
        lowDays: lowDays.length,
        seasonalFactor: Math.round((monthlyFactors[getMonth(new Date())] || 1) * 10) / 10,
        bookingPace: trendFactor > 1 ? Math.round(trendFactor * 10) / 10 : 0.8,
        pickupRate: Math.round(recentBookings / 30),
      },
      dataAvailability: {
        availableDays, targetDays: 90,
        ratio: Math.round(dataAvailableRatio * 100) / 100,
        confidence: dataConfidence,
        model: availableDays >= 90 ? 'full_historical' : availableDays >= 30 ? 'partial_with_defaults' : 'property_type_defaults',
        propertyType, daysOfWeekWithData, monthsWithData, trendAvailable: canComputeTrend,
      },
    },
  });
}
