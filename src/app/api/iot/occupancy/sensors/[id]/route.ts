import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/iot/occupancy/sensors/[id]
 * Get sensor details with latest reading.
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

    const sensor = await db.occupancySensor.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        room: {
          select: { id: true, number: true, name: true, floor: true },
        },
      },
    });

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    // Get latest reading
    const latestReading = await db.occupancyReading.findFirst({
      where: { sensorId: id },
      orderBy: { timestamp: 'desc' },
    });

    return NextResponse.json({
      sensor: {
        id: sensor.id,
        name: sensor.name,
        sensorType: sensor.sensorType,
        protocol: sensor.protocol,
        deviceId: sensor.deviceId,
        status: sensor.status,
        batteryLevel: sensor.batteryLevel,
        lastReading: sensor.lastReading,
        config: sensor.config,
        propertyId: sensor.propertyId,
        roomId: sensor.roomId,
        room: sensor.room,
        latestReading: latestReading
          ? {
              value: latestReading.value,
              rawValue: latestReading.rawValue,
              confidence: latestReading.confidence,
              timestamp: latestReading.timestamp,
            }
          : null,
        createdAt: sensor.createdAt,
        updatedAt: sensor.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Occupancy Sensor Detail] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/iot/occupancy/sensors/[id]
 * Remove a specific sensor.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const deleted = await db.occupancySensor.deleteMany({
      where: { id, tenantId: user.tenantId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('[Occupancy Sensor Detail] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
