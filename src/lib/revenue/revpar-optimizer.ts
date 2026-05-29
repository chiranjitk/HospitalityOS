/**
 * RevPAR Optimization Engine
 * Calculates current ADR, occupancy, and RevPAR metrics
 * and generates rate adjustment suggestions to maximize revenue.
 *
 * Enhanced with time-series forecasting (Holt-Winters, ARIMA, Regression, Ensemble).
 * The existing rules-based engine remains the default; time-series is opt-in.
 */

import { db } from '@/lib/db';
import {
  runTimeSeriesForecast,
  type TimeSeriesForecastResult,
  type RegressionFeatureRow,
} from '@/lib/revenue/time-series-forecast';
import { addDays, subDays } from 'date-fns';

export interface RevPARMetrics {
  propertyId: string;
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  adr: number; // Average Daily Rate
  occupancy: number; // Percentage 0-100
  revpar: number; // Revenue Per Available Room
  totalRevenue: number;
  dayOfWeek: number;
}

export interface RevPARSuggestion {
  date: string;
  dayOfWeek: string;
  currentAdr: number;
  currentOccupancy: number;
  currentRevpar: number;
  suggestedRateChange: number; // percentage, e.g. +10 or -5
  suggestedNewRate: number;
  expectedOccupancy: number;
  expectedRevpar: number;
  expectedRevenueImpact: number;
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  factors: string[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get current metrics for a property over a date range.
 * H-47: Optimized to use a single aggregate query instead of per-day N+1 queries.
 * Previously this iterated day-by-day, running 3 separate queries per day (checkins, inHouse, revenue).
 * Now it fetches all overlapping bookings once and processes them in memory.
 */
export async function getCurrentMetrics(
  tenantId: string,
  propertyId: string,
  dateRange: { start: Date; end: Date }
): Promise<RevPARMetrics[]> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { totalRooms: true },
  });

  const totalRooms = property?.totalRooms || 100;
  const metrics: RevPARMetrics[] = [];

  // H-47: Fetch all bookings that overlap the date range in a single query,
  // then compute per-day metrics in memory to avoid N+1 database queries.
  const allBookings = await db.booking.findMany({
    where: {
      tenantId,
      propertyId,
      status: { in: ['checked_in', 'checked_out', 'confirmed'] },
      deletedAt: null,
      checkIn: { lte: dateRange.end },
      checkOut: { gt: dateRange.start },
    },
    select: {
      totalAmount: true,
      checkIn: true,
      checkOut: true,
      actualCheckIn: true,
    },
  });

  // Also get check-in events for the date range
  const checkinEvents = allBookings.filter(b =>
    b.actualCheckIn &&
    b.actualCheckIn >= dateRange.start &&
    b.actualCheckIn <= dateRange.end
  );

  // Iterate day by day and compute metrics from the pre-fetched data
  for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    // Count check-ins for this day
    const checkins = checkinEvents.filter(b =>
      b.actualCheckIn && b.actualCheckIn >= dayStart && b.actualCheckIn <= dayEnd
    ).length;

    // Count guests in-house (occupancy) for this day
    const inHouse = allBookings.filter(b =>
      b.checkIn <= dayEnd && b.checkOut > dayStart
    ).length;

    // Calculate revenue for this day from overlapping bookings
    const overlappingBookings = allBookings.filter(b =>
      b.checkIn <= dayEnd && b.checkOut > dayStart
    );

    let dayRevenue = 0;
    for (const b of overlappingBookings) {
      const stayStart = b.checkIn < dayStart ? dayStart : b.checkIn;
      const stayEnd = b.checkOut > dayEnd ? dayEnd : b.checkOut;
      const nights = Math.max(1, Math.ceil(
        (stayEnd.getTime() - stayStart.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const totalNights = Math.max(1, Math.ceil(
        (b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      ));
      dayRevenue += (b.totalAmount / totalNights) * nights;
    }

    const availableRooms = totalRooms;
    const occupiedRooms = Math.min(inHouse, totalRooms);
    const occupancy = availableRooms > 0 ? (occupiedRooms / availableRooms) * 100 : 0;
    const adr = occupiedRooms > 0 ? dayRevenue / occupiedRooms : 0;
    const revpar = availableRooms > 0 ? dayRevenue / availableRooms : 0;

    metrics.push({
      propertyId,
      date: d.toISOString().split('T')[0],
      totalRooms,
      occupiedRooms,
      availableRooms,
      adr: Math.round(adr * 100) / 100,
      occupancy: Math.round(occupancy * 10) / 10,
      revpar: Math.round(revpar * 100) / 100,
      totalRevenue: Math.round(dayRevenue * 100) / 100,
      dayOfWeek: d.getDay(),
    });
  }

  return metrics;
}

/**
 * Generate RevPAR optimization suggestions.
 */
export async function optimizeRevPAR(
  tenantId: string,
  propertyId: string,
  dateRange: { start: Date; end: Date }
): Promise<RevPARSuggestion[]> {
  const metrics = await getCurrentMetrics(tenantId, propertyId, dateRange);

  if (metrics.length === 0) {
    return [];
  }

  // Calculate property-wide averages for context
  const avgOccupancy = metrics.reduce((sum, m) => sum + m.occupancy, 0) / metrics.length;
  const avgADR = metrics.reduce((sum, m) => sum + m.adr, 0) / metrics.length;

  // Get competitor pricing context
  const competitorRates = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId,
      date: { gte: dateRange.start, lte: dateRange.end },
    },
    select: { date: true, price: true },
  });

  // Build avg competitor rate map by date
  const competitorMap = new Map<string, number>();
  for (const cr of competitorRates) {
    const dateKey = new Date(cr.date).toISOString().split('T')[0];
    const existing = competitorMap.get(dateKey) || 0;
    competitorMap.set(dateKey, existing + cr.price);
  }

  // Count competitor entries per date
  const competitorCountMap = new Map<string, number>();
  for (const cr of competitorRates) {
    const dateKey = new Date(cr.date).toISOString().split('T')[0];
    competitorCountMap.set(dateKey, (competitorCountMap.get(dateKey) || 0) + 1);
  }

  // Get events near the property
  const events = await db.event.findMany({
    where: {
      tenantId,
      propertyId,
      startDate: { lte: new Date(dateRange.end.getTime() + 7 * 24 * 60 * 60 * 1000) },
      endDate: { gte: dateRange.start },
    },
    select: { startDate: true, endDate: true, name: true },
  });

  const suggestions: RevPARSuggestion[] = [];

  for (const metric of metrics) {
    const { date, occupancy, adr, revpar, dayOfWeek, totalRevenue, totalRooms } = metric;
    const factors: string[] = [];
    let suggestedChange = 0;
    let reasoning = '';
    let priority: RevPARSuggestion['priority'] = 'low';
    let expectedOccupancy = occupancy;
    let expectedRevenueImpact = 0;

    // Core occupancy-based strategy
    if (occupancy < 60) {
      // Low occupancy: suggest lowering rates 5-15% to drive demand
      suggestedChange = -(5 + (60 - occupancy) * 0.25);
      reasoning = 'Low occupancy — rate reduction recommended to stimulate demand.';
      priority = occupancy < 40 ? 'urgent' : 'high';
      expectedOccupancy = Math.min(95, occupancy + Math.abs(suggestedChange) * 1.5);
      factors.push('low_occupancy');
    } else if (occupancy < 80) {
      // Moderate occupancy: hold rates, add value packages
      suggestedChange = 0;
      reasoning = 'Moderate occupancy — maintain current rates. Consider value-add packages.';
      priority = 'medium';
      expectedOccupancy = occupancy + 2;
      factors.push('moderate_occupancy');
    } else if (occupancy < 95) {
      // High occupancy: raise rates 5-20%
      suggestedChange = 5 + (occupancy - 80) * 1.0;
      reasoning = 'High demand — rate increase recommended to maximize revenue.';
      priority = 'high';
      expectedOccupancy = Math.max(70, occupancy - suggestedChange * 0.3);
      factors.push('high_occupancy');
    } else {
      // Near/full: aggressive rate increases 15-30%
      suggestedChange = 15 + (occupancy - 95) * 3.0;
      reasoning = 'Near-full occupancy — aggressive rate increase opportunity.';
      priority = 'urgent';
      expectedOccupancy = Math.max(65, occupancy - suggestedChange * 0.4);
      factors.push('very_high_occupancy');
    }

    // Clamp suggested change
    suggestedChange = Math.max(-20, Math.min(30, suggestedChange));

    // Day-of-week adjustments
    if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday, Saturday
      if (occupancy < 85) {
        suggestedChange += 3; // Weekend premium
        factors.push('weekend_demand');
      }
    } else if (dayOfWeek === 0 || dayOfWeek === 3) { // Sunday, Wednesday
      if (occupancy < 70) {
        suggestedChange -= 3; // Midweek discount opportunity
        factors.push('midweek_softness');
      }
    }

    // Competitor pricing consideration
    const dateKey = date;
    const competitorTotal = competitorMap.get(dateKey) || 0;
    const competitorCount = competitorCountMap.get(dateKey) || 0;
    const avgCompetitorRate = competitorCount > 0 ? competitorTotal / competitorCount : 0;

    if (avgCompetitorRate > 0) {
      if (adr > avgCompetitorRate * 1.15) {
        suggestedChange -= 5; // We're too expensive
        factors.push('above_market_rate');
      } else if (adr < avgCompetitorRate * 0.85) {
        suggestedChange += 5; // We're significantly cheaper
        factors.push('below_market_rate');
      }
    }

    // Event impact
    const eventImpact = events.filter(e => {
      const eventStart = new Date(e.startDate);
      const eventEnd = new Date(e.endDate);
      const metricDate = new Date(date);
      return metricDate >= new Date(eventStart.getTime() - 3 * 24 * 60 * 60 * 1000)
        && metricDate <= new Date(eventEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
    });

    if (eventImpact.length > 0) {
      suggestedChange += eventImpact.length * 5;
      factors.push('nearby_events');
    }

    // Recalculate after adjustments
    suggestedChange = Math.max(-20, Math.min(30, suggestedChange));

    const suggestedNewRate = adr * (1 + suggestedChange / 100);
    const expectedRevpar = (suggestedNewRate * expectedOccupancy) / 100;
    expectedRevenueImpact = (expectedRevpar - revpar) * (totalRooms || 100);

    // Skip trivial suggestions
    if (Math.abs(suggestedChange) < 1) continue;

    suggestions.push({
      date,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      currentAdr: adr,
      currentOccupancy: occupancy,
      currentRevpar: revpar,
      suggestedRateChange: Math.round(suggestedChange * 10) / 10,
      suggestedNewRate: Math.round(suggestedNewRate * 100) / 100,
      expectedOccupancy: Math.round(expectedOccupancy * 10) / 10,
      expectedRevpar: Math.round(expectedRevpar * 100) / 100,
      expectedRevenueImpact: Math.round(expectedRevenueImpact * 100) / 100,
      reasoning,
      priority,
      factors,
    });
  }

  // Sort by expected revenue impact (descending)
  suggestions.sort((a, b) => Math.abs(b.expectedRevenueImpact) - Math.abs(a.expectedRevenueImpact));

  return suggestions;
}

// ─── Time-Series Enhanced Forecasting ────────────────────────────────────────

export interface TimeSeriesRevPARSuggestion extends RevPARSuggestion {
  forecastOccupancy: number;
  forecastOccupancyLower: number;
  forecastOccupancyUpper: number;
  forecastConfidence: number;
  forecastModel: string;
  forecastModelMAPE: number;
  tsFactors: string[];
}

export interface ForecastWithTimeSeriesResult {
  suggestions: TimeSeriesRevPARSuggestion[];
  forecastDetails: TimeSeriesForecastResult;
  method: 'timeseries' | 'rules_fallback';
  reason: string;
}

/**
 * Generate RevPAR optimization suggestions using time-series forecasting.
 * Runs all 5 models, selects best by cross-validation MAPE,
 * and returns optimization suggestions using the best forecast.
 * Falls back to rules-based engine when insufficient data.
 */
export async function forecastWithTimeSeries(
  tenantId: string,
  propertyId: string,
  dateRange: { start: Date; end: Date }
): Promise<ForecastWithTimeSeriesResult> {
  // 1. Gather historical data (last 90-365 days)
  const lookbackDays = 180;
  const historicalStart = subDays(dateRange.start, lookbackDays);

  // Fetch property info
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { totalRooms: true },
  });
  const totalRooms = property?.totalRooms || 100;

  // Fetch all bookings in the historical window
  const allBookings = await db.booking.findMany({
    where: {
      tenantId,
      propertyId,
      status: { in: ['checked_in', 'checked_out', 'confirmed'] },
      deletedAt: null,
      checkIn: { lte: dateRange.start },
      checkOut: { gt: historicalStart },
    },
    select: {
      totalAmount: true,
      checkIn: true,
      checkOut: true,
      actualCheckIn: true,
    },
  });

  // Build daily occupancy time series
  const occupancyMap = new Map<string, number>();
  for (let d = new Date(historicalStart); d <= dateRange.start; d = addDays(d, 1)) {
    const dayStr = d.toISOString().split('T')[0];
    occupancyMap.set(dayStr, 0);
  }

  for (const b of allBookings) {
    const start = new Date(b.checkIn);
    const end = new Date(b.checkOut);
    for (let d = start; d < end; d = addDays(d, 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const current = occupancyMap.get(dayStr) || 0;
      occupancyMap.set(dayStr, current + 1);
    }
  }

  // Build sorted arrays
  const historicalDates = Array.from(occupancyMap.keys()).sort();
  const historicalData = historicalDates.map(d => {
    const occupied = occupancyMap.get(d) || 0;
    return Math.min(100, (occupied / totalRooms) * 100);
  });

  // Check if we have enough data for time-series
  if (historicalData.length < 30) {
    // Fall back to rules-based engine
    const rulesSuggestions = await optimizeRevPAR(tenantId, propertyId, dateRange);
    return {
      suggestions: rulesSuggestions.map(s => ({
        ...s,
        forecastOccupancy: s.expectedOccupancy,
        forecastOccupancyLower: s.expectedOccupancy * 0.9,
        forecastOccupancyUpper: Math.min(100, s.expectedOccupancy * 1.1),
        forecastConfidence: 0.3,
        forecastModel: 'rules_fallback',
        forecastModelMAPE: Infinity,
        tsFactors: [],
      })),
      forecastDetails: {
        ensemble: {
          prediction: [], lower: [], upper: [],
          confidence: 0.3, modelWeights: [], breakdown: [],
        },
        holtWinters: {
          predictions: [], lower: [], upper: [],
          level: [], trend: [], seasonal: [],
          alpha: 0, beta: 0, gamma: 0, period: 7,
          type: 'additive', mape: Infinity,
        },
        arima: {
          predictions: [], residuals: [],
          modelOrder: { p: 0, d: 0, q: 0 },
          arCoeffs: [], maCoeffs: [],
          aic: 0, bic: 0, mape: Infinity, isStationary: true,
        },
        regression: null,
        bestModel: 'insufficient_data', bestMAPE: Infinity,
        seasonalPeriod: 7, isStationary: true,
        dataPoints: historicalData.length,
        stationarity: { isStationary: false, adfStat: 0, pValue: 1 },
      },
      method: 'rules_fallback',
      reason: `Insufficient historical data (${historicalData.length} days, need ≥30). Using rules-based engine.`,
    };
  }

  // Build feature rows for regression
  const features: RegressionFeatureRow[] = historicalDates.map(dateStr => {
    const d = new Date(dateStr);
    return {
      dayOfWeek: d.getDay(),
      month: d.getMonth(),
      dayOfYear: Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)),
      isHoliday: false, // Could be enhanced with holiday calendar
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      leadTime: 0,
      eventsCount: 0,
      competitorPrice: 0,
      weatherScore: 50,
    };
  });

  // Calculate horizon (days from start to end)
  const horizon = Math.max(1, Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  ));

  // Run the full time-series forecast pipeline
  const forecastResult = runTimeSeriesForecast({
    historicalData,
    historicalDates,
    horizon,
    features,
  });

  // Get competitor and event data for the forecast period
  const competitorRates = await db.competitorPrice.findMany({
    where: {
      tenantId, propertyId,
      date: { gte: dateRange.start, lte: dateRange.end },
    },
    select: { date: true, price: true },
  });
  const competitorMap = new Map<string, number>();
  const competitorCountMap = new Map<string, number>();
  for (const cr of competitorRates) {
    const dateKey = new Date(cr.date).toISOString().split('T')[0];
    competitorMap.set(dateKey, (competitorMap.get(dateKey) || 0) + cr.price);
    competitorCountMap.set(dateKey, (competitorCountMap.get(dateKey) || 0) + 1);
  }

  const events = await db.event.findMany({
    where: {
      tenantId, propertyId,
      startDate: { lte: new Date(dateRange.end.getTime() + 7 * 24 * 60 * 60 * 1000) },
      endDate: { gte: dateRange.start },
    },
    select: { startDate: true, endDate: true, name: true },
  });

  // Get current metrics for recent ADR context
  const recentMetrics = await getCurrentMetrics(tenantId, propertyId, {
    start: subDays(dateRange.start, 14),
    end: dateRange.start,
  });
  const avgADR = recentMetrics.length > 0
    ? recentMetrics.reduce((s, m) => s + m.adr, 0) / recentMetrics.length
    : 0;

  // Generate TS-enhanced suggestions
  const suggestions: TimeSeriesRevPARSuggestion[] = [];
  const futureDates: string[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = addDays(dateRange.start, i);
    futureDates.push(d.toISOString().split('T')[0]);
  }

  for (let i = 0; i < Math.min(horizon, forecastResult.ensemble.prediction.length); i++) {
    const dateStr = futureDates[i];
    const forecastOcc = forecastResult.ensemble.prediction[i] || 0;
    const forecastLower = forecastResult.ensemble.lower[i] || 0;
    const forecastUpper = forecastResult.ensemble.upper[i] || 0;
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay();

    const factors: string[] = [];
    let suggestedChange = 0;
    let reasoning = '';
    let priority: RevPARSuggestion['priority'] = 'low';
    let expectedOccupancy = forecastOcc;

    // Rate strategy based on forecast occupancy
    if (forecastOcc < 50) {
      suggestedChange = -(10 + (50 - forecastOcc) * 0.2);
      reasoning = `TS forecast: Low occupancy (${Math.round(forecastOcc)}%). Rate reduction recommended.`;
      priority = forecastOcc < 30 ? 'urgent' : 'high';
      expectedOccupancy = Math.min(85, forecastOcc + Math.abs(suggestedChange) * 1.2);
      factors.push('ts_low_occupancy');
    } else if (forecastOcc < 70) {
      suggestedChange = -3;
      reasoning = `TS forecast: Moderate occupancy (${Math.round(forecastOcc)}%). Slight reduction to capture demand.`;
      priority = 'medium';
      expectedOccupancy = forecastOcc + 5;
      factors.push('ts_moderate_occupancy');
    } else if (forecastOcc < 85) {
      suggestedChange = 5 + (forecastOcc - 70) * 0.5;
      reasoning = `TS forecast: Good demand (${Math.round(forecastOcc)}%). Rate increase opportunity.`;
      priority = 'medium';
      expectedOccupancy = Math.max(60, forecastOcc - suggestedChange * 0.2);
      factors.push('ts_good_demand');
    } else {
      suggestedChange = 10 + (forecastOcc - 85) * 1.5;
      reasoning = `TS forecast: High demand (${Math.round(forecastOcc)}%). Aggressive rate increase.`;
      priority = forecastOcc > 95 ? 'urgent' : 'high';
      expectedOccupancy = Math.max(55, forecastOcc - suggestedChange * 0.3);
      factors.push('ts_high_demand');
    }

    // Weekend adjustments
    if (dayOfWeek === 5 || dayOfWeek === 6 && forecastOcc < 90) {
      suggestedChange += 3;
      factors.push('ts_weekend_premium');
    }

    // Competitor pricing
    const compTotal = competitorMap.get(dateStr) || 0;
    const compCount = competitorCountMap.get(dateStr) || 0;
    const avgCompRate = compCount > 0 ? compTotal / compCount : 0;
    if (avgCompRate > 0 && avgADR > 0) {
      if (avgADR > avgCompRate * 1.15) {
        suggestedChange -= 4;
        factors.push('ts_above_competitor');
      } else if (avgADR < avgCompRate * 0.85) {
        suggestedChange += 4;
        factors.push('ts_below_competitor');
      }
    }

    // Event impact
    const eventImpact = events.filter(e => {
      const eStart = new Date(e.startDate);
      const eEnd = new Date(e.endDate);
      return d >= new Date(eStart.getTime() - 3 * 24 * 60 * 60 * 1000)
        && d <= new Date(eEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
    });
    if (eventImpact.length > 0) {
      suggestedChange += eventImpact.length * 4;
      factors.push('ts_event_impact');
    }

    suggestedChange = Math.max(-20, Math.min(30, suggestedChange));

    const suggestedNewRate = avgADR * (1 + suggestedChange / 100);
    const expectedRevpar = (suggestedNewRate * expectedOccupancy) / 100;
    const expectedRevenueImpact = (expectedRevpar - (avgADR * forecastOcc / 100)) * totalRooms;

    if (Math.abs(suggestedChange) < 1) continue;

    suggestions.push({
      date: dateStr,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      currentAdr: avgADR,
      currentOccupancy: forecastOcc,
      currentRevpar: avgADR * forecastOcc / 100,
      suggestedRateChange: Math.round(suggestedChange * 10) / 10,
      suggestedNewRate: Math.round(suggestedNewRate * 100) / 100,
      expectedOccupancy: Math.round(expectedOccupancy * 10) / 10,
      expectedRevpar: Math.round(expectedRevpar * 100) / 100,
      expectedRevenueImpact: Math.round(expectedRevenueImpact * 100) / 100,
      reasoning,
      priority,
      factors,
      forecastOccupancy: Math.round(forecastOcc * 10) / 10,
      forecastOccupancyLower: Math.round(forecastLower * 10) / 10,
      forecastOccupancyUpper: Math.round(forecastUpper * 10) / 10,
      forecastConfidence: forecastResult.ensemble.confidence,
      forecastModel: forecastResult.bestModel,
      forecastModelMAPE: forecastResult.bestMAPE,
      tsFactors: [
        `seasonal_period=${forecastResult.seasonalPeriod}`,
        `stationary=${forecastResult.isStationary}`,
        `data_points=${forecastResult.dataPoints}`,
      ],
    });
  }

  // Sort by revenue impact
  suggestions.sort((a, b) => Math.abs(b.expectedRevenueImpact) - Math.abs(a.expectedRevenueImpact));

  return {
    suggestions,
    forecastDetails: forecastResult,
    method: 'timeseries',
    reason: `Time-series forecast using ${forecastResult.bestModel} (MAPE: ${Math.round(forecastResult.bestMAPE * 100) / 100}%). ${forecastResult.dataPoints} data points analyzed.`,
  };
}
