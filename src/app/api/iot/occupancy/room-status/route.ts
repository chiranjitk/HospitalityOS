import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/iot/occupancy/room-status
 * Get room occupancy status based on sensor data.
 * Aggregates readings to determine if each room is occupied/vacant.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const { hasPermission } = await import('@/lib/auth-helpers');
    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'devices.view')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Fetch all occupancy sensors for the property that are assigned to rooms
    const sensors = await db.occupancySensor.findMany({
      where: {
        tenantId: user.tenantId,
        propertyId,
        roomId: { not: null },
        status: 'active',
      },
      select: {
        id: true,
        roomId: true,
        sensorType: true,
        lastReading: true,
        room: {
          select: {
            id: true,
            number: true,
            name: true,
            floor: true,
            status: true,
          },
        },
      },
    });

    if (sensors.length === 0) {
      return NextResponse.json({
        rooms: [],
        total: 0,
        message: 'No occupancy sensors configured for this property',
      });
    }

    // Group sensors by room
    const roomSensorMap = new Map<string, typeof sensors>();
    for (const sensor of sensors) {
      if (sensor.roomId) {
        const existing = roomSensorMap.get(sensor.roomId) || [];
        existing.push(sensor);
        roomSensorMap.set(sensor.roomId, existing);
      }
    }

    // For each room, fetch latest readings and determine occupancy
    const roomStatuses = [];

    for (const [roomId, roomSensors] of roomSensorMap.entries()) {
      const room = roomSensors[0].room;
      if (!room) continue;

      // Fetch latest reading for each sensor in this room
      const sensorReadings = await Promise.all(
        roomSensors.map(async (sensor) => {
          const latestReading = await db.occupancyReading.findFirst({
            where: {
              sensorId: sensor.id,
              timestamp: {
                gte: new Date(Date.now() - 30 * 60 * 1000), // last 30 minutes
              },
            },
            orderBy: { timestamp: 'desc' },
          });

          return {
            sensorId: sensor.id,
            sensorType: sensor.sensorType,
            lastReading: sensor.lastReading,
            latestValue: latestReading?.value ?? null,
            latestTimestamp: latestReading?.timestamp ?? null,
            confidence: latestReading?.confidence ?? null,
          };
        })
      );

      // Determine room occupancy using weighted aggregation
      // Motion sensors are most reliable, CO2 is secondary
      let occupiedWeight = 0;
      let totalWeight = 0;

      for (const reading of sensorReadings) {
        if (reading.latestValue === null) continue;

        let weight = 1;
        if (reading.sensorType === 'motion') weight = 3;
        else if (reading.sensorType === 'infrared') weight = 2.5;
        else if (reading.sensorType === 'door') weight = 2;
        else if (reading.sensorType === 'co2') weight = 1.5;
        else if (reading.sensorType === 'pressure') weight = 1.5;

        occupiedWeight += reading.latestValue * weight * (reading.confidence ?? 0.8);
        totalWeight += weight * (reading.confidence ?? 0.8);
      }

      const occupancyScore = totalWeight > 0 ? occupiedWeight / totalWeight : 0;
      const isOccupied = occupancyScore >= 0.4; // 40% threshold

      // Check data freshness
      const latestTimestamp = sensorReadings
        .map((r) => r.latestTimestamp)
        .filter((t): t is Date => t !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      const isStale = latestTimestamp
        ? Date.now() - latestTimestamp.getTime() > 15 * 60 * 1000 // 15 minutes
        : true;

      roomStatuses.push({
        roomId: room.id,
        roomNumber: room.number,
        roomName: room.name,
        floor: room.floor,
        roomStatus: room.status,
        isOccupied,
        occupancyScore: Math.round(occupancyScore * 100) / 100,
        isStale,
        lastSensorUpdate: latestTimestamp?.toISOString() ?? null,
        sensorCount: roomSensors.length,
        sensorTypes: roomSensors.map((s) => s.sensorType),
      });
    }

    // Sort by occupancy score (occupied first)
    roomStatuses.sort((a, b) => b.occupancyScore - a.occupancyScore);

    return NextResponse.json({
      rooms: roomStatuses,
      total: roomStatuses.length,
      occupied: roomStatuses.filter((r) => r.isOccupied).length,
      vacant: roomStatuses.filter((r) => !r.isOccupied && !r.isStale).length,
      unknown: roomStatuses.filter((r) => r.isStale).length,
    });
  } catch (error) {
    console.error('[Room Occupancy Status] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
