import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/iot/occupancy/sensors/[id]/readings
 * Get sensor readings with date range filter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const startTimeStr = searchParams.get('startTime');
    const endTimeStr = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify sensor exists and belongs to tenant
    const sensor = await db.occupancySensor.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    const where: Record<string, unknown> = { sensorId: id };

    if (startTimeStr) {
      where.timestamp = { ...(where.timestamp as Record<string, unknown>), gte: new Date(startTimeStr) };
    }
    if (endTimeStr) {
      where.timestamp = { ...(where.timestamp as Record<string, unknown>), lte: new Date(endTimeStr) };
    }

    const [readings, total] = await Promise.all([
      db.occupancyReading.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: Math.min(limit, 1000),
        skip: offset,
      }),
      db.occupancyReading.count({ where }),
    ]);

    return NextResponse.json({
      sensorId: id,
      readings: readings.map((r) => ({
        id: r.id,
        value: r.value,
        rawValue: r.rawValue,
        confidence: r.confidence,
        timestamp: r.timestamp,
        isOccupied: r.value >= 0.5,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Occupancy Readings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/iot/occupancy/sensors/[id]/readings
 * Submit a new reading from an IoT device.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify sensor exists
    const sensor = await db.occupancySensor.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, tenantId: true },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { value, rawValue, confidence, timestamp } = body as {
      value: number;
      rawValue?: number;
      confidence?: number;
      timestamp?: string;
    };

    if (typeof value !== 'number' || value < 0 || value > 1) {
      return NextResponse.json(
        { error: 'value must be a number between 0.0 and 1.0' },
        { status: 400 }
      );
    }

    const readingTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Create reading
    const reading = await db.occupancyReading.create({
      data: {
        sensorId: id,
        tenantId: sensor.tenantId,
        value,
        rawValue: rawValue ?? null,
        confidence: confidence ?? null,
        timestamp: readingTimestamp,
      },
    });

    // Update sensor's lastReading
    await db.occupancySensor.update({
      where: { id },
      data: { lastReading: readingTimestamp },
    });

    return NextResponse.json({ reading }, { status: 201 });
  } catch (error) {
    console.error('[Occupancy Readings] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
