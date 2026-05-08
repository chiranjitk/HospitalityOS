import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/smart-locks — Smart Locks dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view smart lock data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const floor = searchParams.get('floor');
    const status = searchParams.get('status');

    // Fetch all locks
    const lockWhere: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (status) {
      if (status === 'low_battery') {
        lockWhere.batteryLevel = { lte: 15 };
      } else {
        lockWhere.lockStatus = status;
      }
    }

    const locks = await db.smartLock.findMany({
      where: lockWhere,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch recent access logs
    const accessLogs = await db.smartLockAccessLog.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Compute provider summaries
    const providerMap = new Map<string, { provider: string; totalLocks: number; onlineLocks: number }>();
    for (const lock of locks) {
      const key = lock.provider;
      const existing = providerMap.get(key) ?? { provider: key, totalLocks: 0, onlineLocks: 0 };
      existing.totalLocks += 1;
      if (lock.lockStatus !== 'offline' && lock.doorStatus !== 'jammed') existing.onlineLocks += 1;
      providerMap.set(key, existing);
    }
    const providers = Array.from(providerMap.values()).map(p => ({
      id: `prov-${p.provider}`,
      name: p.provider,
      model: '',
      protocol: 'BLE + RFID',
      totalLocks: p.totalLocks,
      onlineLocks: p.onlineLocks,
      firmware: '',
      apiVersion: '',
      status: 'connected',
      lastHeartbeat: new Date().toISOString(),
    }));

    const roomLocks = locks.map(l => ({
      id: l.id,
      roomId: l.roomId ?? null,
      roomNumber: l.roomId ?? l.name,
      floor: 0,
      provider: l.provider,
      lockId: l.lockId ?? null,
      batteryLevel: l.batteryLevel,
      status: l.lockStatus === 'offline' || l.lockStatus === 'disabled' ? 'offline' : l.batteryLevel <= 15 ? 'low_battery' : 'online',
      doorStatus: l.doorStatus,
      lastActivity: l.lastActivity?.toISOString() ?? null,
      firmwareVersion: l.firmwareVersion ?? null,
      signalStrength: l.signalStrength ?? null,
      guestAssigned: false,
      guestName: null,
    }));

    const filteredLocks = floor
      ? roomLocks.filter(l => l.floor === parseInt(floor))
      : roomLocks;

    const formattedLogs = accessLogs.map(log => ({
      id: log.id,
      lockId: log.lockId,
      roomNumber: null,
      accessType: log.accessMethod,
      userId: log.userId ?? log.guestId ?? null,
      userName: null,
      method: log.accessMethod,
      timestamp: log.createdAt.toISOString(),
      result: log.success ? 'granted' : 'denied',
    }));

    const keyCards: unknown[] = [];

    const stats = {
      totalLocks: locks.length,
      onlineLocks: locks.filter(l => l.lockStatus !== 'offline' && l.lockStatus !== 'disabled').length,
      offlineLocks: locks.filter(l => l.lockStatus === 'offline' || l.lockStatus === 'disabled').length,
      lowBatteryLocks: locks.filter(l => l.batteryLevel <= 15).length,
      criticalBatteryLocks: locks.filter(l => l.batteryLevel <= 8).length,
      totalProviders: providers.length,
      activeKeyCards: 0,
      totalAccessEvents: accessLogs.length,
      deniedAccessToday: accessLogs.filter(l => !l.success).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        providers,
        roomLocks: filteredLocks,
        accessLogs: formattedLogs,
        keyCards,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching smart lock data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch smart lock data' } },
      { status: 500 }
    );
  }
}
