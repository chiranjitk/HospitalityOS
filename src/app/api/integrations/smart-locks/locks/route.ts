import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { auditLogService } from '@/lib/services/audit-service';

// GET /api/integrations/smart-locks/locks — list smart locks
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const provider = searchParams.get('provider');
    const isActive = searchParams.get('isActive');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (provider) where.provider = provider;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';
    if (status) where.lockStatus = status;

    const locks = await db.smartLock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Include recent access log count for each lock
    const lockIds = locks.map(l => l.id);
    const accessLogCounts = lockIds.length > 0
      ? await db.smartLockAccessLog.groupBy({
          by: ['lockId'],
          where: { lockId: { in: lockIds } },
          _count: true,
        })
      : [];

    const accessLogMap = new Map(accessLogCounts.map((a) => [a.lockId, a._count]));

    const enrichedLocks = locks.map(l => ({
      ...l,
      recentAccessEvents: accessLogMap.get(l.id) || 0,
    }));

    return NextResponse.json({ success: true, data: enrichedLocks });
  } catch (error) {
    console.error('Error listing smart locks:', error);
    return NextResponse.json({ success: false, error: 'Failed to list smart locks' }, { status: 500 });
  }
}

// POST /api/integrations/smart-locks/locks — create a smart lock
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, roomId, name, provider, lockId, firmwareVersion, batteryLevel, signalStrength, doorStatus, lockStatus } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: 'propertyId and name are required' }, { status: 400 });
    }

    // Validate doorStatus if provided
    const validDoorStatuses = ['open', 'closed', 'ajar', 'unknown'];
    if (doorStatus && !validDoorStatuses.includes(doorStatus)) {
      return NextResponse.json({ success: false, error: `Invalid doorStatus. Must be one of: ${validDoorStatuses.join(', ')}` }, { status: 400 });
    }

    // Validate lockStatus if provided
    const validLockStatuses = ['locked', 'unlocked', 'jammed', 'unknown'];
    if (lockStatus && !validLockStatuses.includes(lockStatus)) {
      return NextResponse.json({ success: false, error: `Invalid lockStatus. Must be one of: ${validLockStatuses.join(', ')}` }, { status: 400 });
    }

    // Validate provider if provided
    const validProviders = ['assa_abloy', 'salto', 'dormakaba', 'onity', 'saflok', 'custom'];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json({ success: false, error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` }, { status: 400 });
    }

    // Validate batteryLevel if provided (0-100)
    if (batteryLevel !== undefined && (typeof batteryLevel !== 'number' || batteryLevel < 0 || batteryLevel > 100)) {
      return NextResponse.json({ success: false, error: 'batteryLevel must be between 0 and 100' }, { status: 400 });
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Verify room belongs to tenant if provided
    if (roomId) {
      const room = await db.room.findFirst({ where: { id: roomId, tenantId: user.tenantId } });
      if (!room) {
        return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
      }
    }

    const lock = await db.smartLock.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        roomId: roomId ?? null,
        name,
        provider: provider ?? 'assa_abloy',
        lockId: lockId ?? null,
        firmwareVersion: firmwareVersion ?? null,
        batteryLevel: batteryLevel ?? 100,
        signalStrength: signalStrength ?? null,
        doorStatus: doorStatus ?? 'closed',
        lockStatus: lockStatus ?? 'locked',
        lastActivity: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: lock }, { status: 201 });
  } catch (error) {
    console.error('Error creating smart lock:', error);
    return NextResponse.json({ success: false, error: 'Failed to create smart lock' }, { status: 500 });
  }
}
