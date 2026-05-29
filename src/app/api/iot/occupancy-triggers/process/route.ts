/**
 * L-28: Occupancy Trigger Process API
 *
 * POST /api/iot/occupancy-triggers/process
 *
 * Called by IoT devices when a new sensor reading arrives.
 * Accepts { sensorId, value, rawValue?, confidence?, timestamp }
 * Finds matching rules and executes their actions.
 * Uses fire-and-forget for non-critical actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateOccupancyRules,
  type OccupancyReading,
} from '@/lib/iot/occupancy-automation';

// ---------------------------------------------------------------------------
// POST: Process an incoming occupancy reading against all active rules
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sensorId, value, rawValue, confidence, timestamp } = body;

    // Validate required fields
    if (!sensorId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sensorId is required',
          },
        },
        { status: 400 },
      );
    }

    if (value === undefined || value === null || typeof value !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'value is required and must be a number (0.0–1.0)',
          },
        },
        { status: 400 },
      );
    }

    // Validate value range
    if (value < 0 || value > 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'value must be between 0.0 and 1.0',
          },
        },
        { status: 400 },
      );
    }

    // Validate optional fields
    if (rawValue !== undefined && typeof rawValue !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'rawValue must be a number if provided',
          },
        },
        { status: 400 },
      );
    }

    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'confidence must be a number between 0.0 and 1.0 if provided',
          },
        },
        { status: 400 },
      );
    }

    const reading: OccupancyReading = {
      sensorId,
      value,
      rawValue,
      confidence,
      timestamp,
    };

    // Process the reading against all matching rules
    const result = await evaluateOccupancyRules(sensorId, reading);

    return NextResponse.json({
      success: true,
      data: {
        sensorId,
        value,
        processedAt: new Date().toISOString(),
        matchedRules: result.matchedRules,
        totalMatched: result.matchedRules.length,
      },
    });
  } catch (error) {
    console.error('[OccupancyTriggers/Process] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process occupancy reading',
        },
      },
      { status: 500 },
    );
  }
}
