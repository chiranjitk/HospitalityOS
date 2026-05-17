/**
 * RevPAR Optimization Engine
 * Calculates current ADR, occupancy, and RevPAR metrics
 * and generates rate adjustment suggestions to maximize revenue.
 */

import { db } from '@/lib/db';

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

  // Iterate day by day
  for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    // Get check-ins for this day
    const checkins = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        actualCheckIn: { gte: dayStart, lte: dayEnd },
        status: { in: ['checked_in', 'checked_out'] },
        deletedAt: null,
      },
    });

    // Get guests in-house (occupancy) for this day
    // Those who checked in before or on this day, and haven't checked out yet
    const inHouse = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        checkIn: { lte: dayEnd },
        checkOut: { gt: dayStart },
        status: { in: ['checked_in', 'confirmed', 'reserved'] },
        deletedAt: null,
      },
    });

    // Get revenue for this day (from bookings that overlap this day)
    const overlappingBookings = await db.booking.findMany({
      where: {
        tenantId,
        propertyId,
        checkIn: { lte: dayEnd },
        checkOut: { gt: dayStart },
        status: { in: ['checked_in', 'checked_out', 'confirmed'] },
        deletedAt: null,
      },
      select: { totalAmount: true, checkIn: true, checkOut: true },
    });

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

    const availableRooms = totalRooms; // Simplified: all rooms are available
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
    const { date, occupancy, adr, revpar, dayOfWeek, totalRevenue } = metric;
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
