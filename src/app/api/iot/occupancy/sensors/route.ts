import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/iot/occupancy/sensors
 * List occupancy sensors with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');
    const sensorType = searchParams.get('sensorType');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (roomId) where.roomId = roomId;
    if (status) where.status = status;
    if (sensorType) where.sensorType = sensorType;

    const sensors = await db.occupancySensor.findMany({
      where,
      include: {
        room: {
          select: { id: true, number: true, name: true },
        },
        _count: {
          select: { readings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      sensors: sensors.map((s) => ({
        id: s.id,
        name: s.name,
        sensorType: s.sensorType,
        protocol: s.protocol,
        deviceId: s.deviceId,
        status: s.status,
        batteryLevel: s.batteryLevel,
        lastReading: s.lastReading,
        propertyId: s.propertyId,
        roomId: s.roomId,
        room: s.room,
        totalReadings: s._count.readings,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total: sensors.length,
    });
  } catch (error) {
    console.error('[Occupancy Sensors] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/iot/occupancy/sensors
 * Register a new occupancy sensor.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const { hasPermission: hp } = await import('@/lib/auth-helpers');
    if (!hp(user, 'iot.manage') && !hp(user, 'devices.manage')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, propertyId, roomId, sensorType, protocol, deviceId, config } = body as {
      name: string;
      propertyId: string;
      roomId?: string;
      sensorType: string;
      protocol: string;
      deviceId: string;
      config?: string;
    };

    if (!name || !propertyId || !sensorType || !protocol || !deviceId) {
      return NextResponse.json(
        { error: 'name, propertyId, sensorType, protocol, and deviceId are required' },
        { status: 400 }
      );
    }

    const validSensorTypes = ['motion', 'co2', 'door', 'infrared', 'pressure'];
    if (!validSensorTypes.includes(sensorType)) {
      return NextResponse.json(
        { error: `Invalid sensorType. Must be one of: ${validSensorTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validProtocols = ['mqtt', 'zigbee', 'z-wave', 'ble'];
    if (!validProtocols.includes(protocol)) {
      return NextResponse.json(
        { error: `Invalid protocol. Must be one of: ${validProtocols.join(', ')}` },
        { status: 400 }
      );
    }

    const sensor = await db.occupancySensor.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        roomId: roomId || null,
        name,
        sensorType,
        protocol,
        deviceId,
        config: config || null,
      },
      include: {
        room: {
          select: { id: true, number: true, name: true },
        },
      },
    });

    return NextResponse.json({ sensor }, { status: 201 });
  } catch (error) {
    console.error('[Occupancy Sensors] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/iot/occupancy/sensors
 * Update an occupancy sensor.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const { hasPermission: hp } = await import('@/lib/auth-helpers');
    if (!hp(user, 'iot.manage') && !hp(user, 'devices.manage')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, status, batteryLevel, config, roomId } = body as {
      id: string;
      name?: string;
      status?: string;
      batteryLevel?: number;
      config?: string;
      roomId?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel;
    if (config !== undefined) updateData.config = config;
    if (roomId !== undefined) updateData.roomId = roomId;

    const sensor = await db.occupancySensor.updateMany({
      where: { id, tenantId: user.tenantId },
      data: updateData,
    });

    if (sensor.count === 0) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    return NextResponse.json({ updated: true, id });
  } catch (error) {
    console.error('[Occupancy Sensors] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/iot/occupancy/sensors
 * Remove an occupancy sensor (by query param id or body id).
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const { hasPermission: hp } = await import('@/lib/auth-helpers');
    if (!hp(user, 'iot.manage') && !hp(user, 'devices.manage')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get('id');

    if (!sensorId) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const deleted = await db.occupancySensor.deleteMany({
      where: { id: sensorId, tenantId: user.tenantId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: sensorId });
  } catch (error) {
    console.error('[Occupancy Sensors] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
