/**
 * L-29: Energy Schedule Evaluate API
 *
 * POST /api/iot/energy/schedule/evaluate
 *
 * Evaluate current schedule against time + occupancy to determine optimal settings.
 * Returns the active schedule entries for the current time/day.
 * Considers occupancy override.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import {
  evaluateEnergySchedule,
  generateOptimalSchedule,
  type OccupancyStatus,
} from '@/lib/iot/energy-scheduler';

// ---------------------------------------------------------------------------
// POST: Evaluate current schedule against time + occupancy
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'energy.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      propertyId,
      roomTypeId,
      occupancyStatus,
      generateSuggestion,
      historicalUsage,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId is required',
          },
        },
        { status: 400 },
      );
    }

    // Validate occupancy status if provided
    const validOccupancyStatuses: OccupancyStatus[] = ['occupied', 'vacant', 'unknown'];
    if (occupancyStatus && !validOccupancyStatuses.includes(occupancyStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid occupancyStatus. Must be one of: ${validOccupancyStatuses.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // Evaluate active schedules
    const results = await evaluateEnergySchedule(
      propertyId,
      user.tenantId,
      roomTypeId || undefined,
      occupancyStatus || undefined,
    );

    // Generate optimal schedule suggestion if requested
    let suggestion = null;
    if (generateSuggestion) {
      suggestion = generateOptimalSchedule(propertyId, historicalUsage);
      // Fill in the tenantId
      suggestion.tenantId = user.tenantId;
    }

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        currentTime: new Date().toISOString(),
        currentDayOfWeek: new Date().getDay(),
        currentHour: new Date().getHours(),
        occupancyStatus: occupancyStatus || 'unknown',
        activeEntries: results,
        totalActiveSchedules: results.length,
        suggestion,
      },
    });
  } catch (error) {
    console.error('[EnergySchedule/Evaluate] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to evaluate energy schedule',
        },
      },
      { status: 500 },
    );
  }
}
