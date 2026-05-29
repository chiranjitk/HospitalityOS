import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { addDays, subDays, format } from 'date-fns';
import { analyzeBookingPace } from '@/lib/revenue/time-series-forecast';

// GET /api/revenue/booking-pace?propertyId=...&arrivalDate=...
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'revenue.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const tenantId = ctx.tenantId;
    const searchParams = request.nextUrl.searchParams;

    // Resolve property ID (auto-detect first property if not provided)
    const propertyId = await resolvePropertyId(ctx, searchParams.get('propertyId'));

    // Arrival date: default = today + 30 days
    const arrivalDateStr = searchParams.get('arrivalDate');
    const arrivalDate = arrivalDateStr
      ? new Date(arrivalDateStr)
      : addDays(new Date(), 30);

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    // Fetch historical bookings with checkIn dates and createdAt timestamps
    const lookbackDays = 365;
    const historicalBookings = await db.booking.findMany({
      where: {
        tenantId,
        propertyId,
        status: { notIn: ['cancelled', 'no_show'] },
        checkIn: { gte: subDays(new Date(), lookbackDays), lte: addDays(arrivalDate, 30) },
      },
      select: {
        checkIn: true,
        createdAt: true,
      },
    });

    // Count current bookings for the target arrival date
    const currentBookingsForTarget = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        status: { notIn: ['cancelled', 'no_show'] },
        checkIn: { gte: arrivalDate, lt: addDays(arrivalDate, 1) },
      },
    });

    // Total rooms for the property
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { totalRooms: true, name: true },
    });
    const totalRooms = property?.totalRooms || 100;

    // Run booking pace analysis
    const paceResult = analyzeBookingPace(
      historicalBookings,
      currentBookingsForTarget,
      arrivalDate,
    );

    // Get pricing context
    const competitorRates = await db.competitorPrice.findMany({
      where: {
        tenantId,
        propertyId,
        date: arrivalDate,
      },
      select: { price: true },
    });
    const avgCompetitorRate = competitorRates.length > 0
      ? competitorRates.reduce((s, c) => s + c.price, 0) / competitorRates.length
      : 0;

    // Generate pricing recommendations based on pace
    const pricingRecommendations = generatePricingRecommendations(
      paceResult,
      totalRooms,
      avgCompetitorRate,
    );

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: propertyId,
          name: property?.name || 'Unknown',
          totalRooms,
        },
        arrivalDate: paceResult.arrivalDate,
        daysUntilArrival: paceResult.daysUntilArrival,
        pace: {
          status: paceResult.status,
          paceIndex: paceResult.paceIndex,
          currentBookings: paceResult.currentPace,
          expectedBookings: paceResult.expectedPace,
          predictedTotalDemand: paceResult.predictedTotal,
          predictedOccupancy: Math.min(100, Math.round((paceResult.predictedTotal / totalRooms) * 100)),
          confidence: Math.round(paceResult.confidence * 100) / 100,
        },
        paceCurve: paceResult.paceCurve,
        recommendation: paceResult.recommendation,
        pricing: pricingRecommendations,
      },
    });
  } catch (error) {
    console.error('Error analyzing booking pace:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze booking pace' } },
      { status: 500 }
    );
  }
}

function generatePricingRecommendations(
  pace: { status: string; paceIndex: number; predictedTotal: number; daysUntilArrival: number },
  totalRooms: number,
  avgCompetitorRate: number,
) {
  const recommendations: Array<{
    action: string;
    rateChange: number;
    reasoning: string;
    expectedImpact: string;
    priority: string;
  }> = [];

  const predictedOccupancy = Math.min(100, (pace.predictedTotal / totalRooms) * 100);

  switch (pace.status) {
    case 'strong_ahead':
      recommendations.push({
        action: 'Increase rates',
        rateChange: 15,
        reasoning: `Booking pace ${Math.round((pace.paceIndex - 1) * 100)}% above average. Strong demand signal supports rate increase.`,
        expectedImpact: `+${Math.round(15 * predictedOccupancy / 100)}% RevPAR`,
        priority: 'high',
      });
      if (avgCompetitorRate > 0) {
        recommendations.push({
          action: 'Position above competition',
          rateChange: 5,
          reasoning: 'With strong demand, position rates above competitor average to maximize yield.',
          expectedImpact: '+5% ADR',
          priority: 'medium',
        });
      }
      break;

    case 'ahead':
      recommendations.push({
        action: 'Gradual rate increase',
        rateChange: 8,
        reasoning: `Booking pace is slightly ahead of average. Gradual increases capture demand at higher rates.`,
        expectedImpact: `+${Math.round(8 * predictedOccupancy / 100)}% RevPAR`,
        priority: 'medium',
      });
      break;

    case 'on_track':
      if (predictedOccupancy > 85) {
        recommendations.push({
          action: 'Monitor and adjust',
          rateChange: 5,
          reasoning: `Pace is average but predicted occupancy is ${Math.round(predictedOccupancy)}%. Consider moderate increases.`,
          expectedImpact: '+3% RevPAR',
          priority: 'low',
        });
      } else {
        recommendations.push({
          action: 'Hold current rates',
          rateChange: 0,
          reasoning: 'Booking pace is tracking historical average. No immediate pricing action needed.',
          expectedImpact: 'Maintain current revenue trajectory',
          priority: 'low',
        });
      }
      break;

    case 'behind':
      if (pace.daysUntilArrival > 21) {
        recommendations.push({
          action: 'Launch targeted promotion',
          rateChange: -10,
          reasoning: `Booking pace ${Math.round((1 - pace.paceIndex) * 100)}% behind average with ${pace.daysUntilArrival} days remaining. Promotional pricing recommended.`,
          expectedImpact: `Stimulate ${Math.round((1 - pace.paceIndex) * 20)}% more bookings`,
          priority: 'high',
        });
      } else if (pace.daysUntilArrival > 7) {
        recommendations.push({
          action: 'Last-minute deal package',
          rateChange: -15,
          reasoning: `Booking pace behind with only ${pace.daysUntilArrival} days left. Aggressive promotion needed.`,
          expectedImpact: 'Fill remaining inventory',
          priority: 'high',
        });
      } else {
        recommendations.push({
          action: 'Flash sale or opaque channel pricing',
          rateChange: -20,
          reasoning: `Very close to arrival (${pace.daysUntilArrival} days) with weak pace. Use flash sale or opaque channels.`,
          expectedImpact: 'Minimize revenue loss from empty rooms',
          priority: 'urgent',
        });
      }
      break;
  }

  return recommendations;
}
