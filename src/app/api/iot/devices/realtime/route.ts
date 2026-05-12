import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { subMinutes } from 'date-fns';

interface RealtimeDevice {
  id: string;
  name: string;
  type: string;
  status: string;
  isOnline: boolean;
  lastReading: {
    value: number;
    unit: string;
    type: string;
    timestamp: string;
  } | null;
  batteryLevel: number | null;
  lastHeartbeat: string | null;
  room: {
    number: string;
    name: string | null;
  } | null;
  currentState: Record<string, unknown>;
}

/**
 * GET /api/iot/devices/realtime - Returns current state of all devices
 * Query params:
 *   - roomId: Filter by room
 *   - propertyId: Filter by property
 *   - type: Filter by device type
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'devices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    const propertyId = searchParams.get('propertyId');
    const deviceType = searchParams.get('type');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (roomId) where.roomId = roomId;
    if (deviceType) where.type = deviceType;

    // Fetch devices with latest readings
    const devices = await db.ioTDevice.findMany({
      where,
      include: {
        room: {
          select: { number: true, name: true },
        },
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Offline threshold: 5 minutes without heartbeat
    const offlineThreshold = subMinutes(new Date(), 5);

    const realtimeDevices: RealtimeDevice[] = devices.map(device => {
      const lastReading = device.readings[0] || null;
      const config = device.config ? JSON.parse(device.config) : {};
      const currentState = device.currentState ? JSON.parse(device.currentState) : {};

      // Determine if device is online
      const isOnline = device.lastHeartbeat
        ? new Date(device.lastHeartbeat) > offlineThreshold
        : false;

      // Extract battery level from config or latest reading
      let batteryLevel: number | null = null;
      if (config.batteryLevel !== undefined) {
        batteryLevel = config.batteryLevel;
      } else if (currentState.battery !== undefined) {
        batteryLevel = typeof currentState.battery === 'number' ? currentState.battery : null;
      }
      // Check readings for battery type
      if (batteryLevel === null && lastReading && lastReading.type === 'battery') {
        batteryLevel = lastReading.value;
      }

      return {
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        isOnline,
        lastReading: lastReading ? {
          value: lastReading.value,
          unit: lastReading.unit || '',
          type: lastReading.type,
          timestamp: lastReading.timestamp.toISOString(),
        } : null,
        batteryLevel,
        lastHeartbeat: device.lastHeartbeat?.toISOString() || null,
        room: device.room ? {
          number: device.room.number,
          name: device.room.name,
        } : null,
        currentState,
      };
    });

    // Calculate stats
    const onlineCount = realtimeDevices.filter(d => d.isOnline).length;
    const offlineCount = realtimeDevices.filter(d => !d.isOnline).length;
    const lowBattery = realtimeDevices.filter(d => d.batteryLevel !== null && d.batteryLevel < 20).length;

    // Group by type for summary
    const byType: Record<string, { total: number; online: number }> = {};
    realtimeDevices.forEach(d => {
      if (!byType[d.type]) byType[d.type] = { total: 0, online: 0 };
      byType[d.type].total++;
      if (d.isOnline) byType[d.type].online++;
    });

    return NextResponse.json({
      success: true,
      devices: realtimeDevices,
      stats: {
        total: realtimeDevices.length,
        online: onlineCount,
        offline: offlineCount,
        lowBattery,
        byType,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching realtime devices:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device states' } },
      { status: 500 }
    );
  }
}
