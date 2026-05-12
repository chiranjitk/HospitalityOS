import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

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

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (provider) where.provider = provider;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const locks = await db.smartLock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: locks });
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
