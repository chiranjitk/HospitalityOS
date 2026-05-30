import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════
// GET /api/wifi/users/[id]/devices
// List all WiFiUserDevice records for a given WiFiUser
// ═══════════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_USER_ID', message: 'User ID is required' } }, { status: 400 });
    }

    const devices = await db.wiFiUserDevice.findMany({
      where: { wifiUserId: userId },
      select: {
        id: true,
        macAddress: true,
        deviceName: true,
        deviceType: true,
        ipAddress: true,
        isPrimary: true,
        isActive: true,
        source: true,
        firstSeen: true,
        lastSeen: true,
      },
      orderBy: [{ isActive: 'desc' }, { lastSeen: 'desc' }],
    });

    const safeDevices = devices.map(d => ({
      ...d,
      firstSeen: d.firstSeen ? String(d.firstSeen) : null,
      lastSeen: d.lastSeen ? String(d.lastSeen) : null,
    }));

    return NextResponse.json({ success: true, data: safeDevices });
  } catch (error) {
    console.error('[UserDevices:GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch devices' } }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/wifi/users/[id]/devices
// Register a new MAC device for a user (admin action)
// ═══════════════════════════════════════════════════════════════
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { macAddress, deviceName, deviceType } = body as {
      macAddress?: string;
      deviceName?: string;
      deviceType?: string;
    };

    if (!macAddress) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_MAC', message: 'MAC address is required' } }, { status: 400 });
    }

    // Validate MAC format
    const normalized = macAddress.replace(/[:\-\.\s]/g, '').toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(normalized)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_MAC', message: 'Invalid MAC address format' } }, { status: 400 });
    }
    const formattedMac = normalized.match(/.{2}/g)?.join(':') || '';

    // Check user exists
    const user = await db.wiFiUser.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, propertyId: true, guestId: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'WiFi user not found' } }, { status: 404 });
    }

    // Check if MAC already registered for this user
    const existing = await db.wiFiUserDevice.findUnique({
      where: {
        wifiUserId_macAddress: { wifiUserId: userId, macAddress: formattedMac },
      },
    });

    if (existing) {
      // Reactivate if inactive
      const updated = await db.wiFiUserDevice.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          deviceName: deviceName || existing.deviceName,
          deviceType: deviceType || existing.deviceType,
          lastSeen: new Date(),
        },
      });
      return NextResponse.json({ success: true, data: updated, message: 'Device reactivated' });
    }

    // Count existing active devices
    const activeCount = await db.wiFiUserDevice.count({
      where: { wifiUserId: userId, isActive: true },
    });

    const device = await db.wiFiUserDevice.create({
      data: {
        tenantId: user.tenantId,
        wifiUserId: userId,
        propertyId: user.propertyId,
        guestId: user.guestId || null,
        macAddress: formattedMac,
        deviceName: deviceName || 'Manual Registration',
        deviceType: deviceType || 'unknown',
        userAgent: null,
        ipAddress: null,
        isPrimary: activeCount === 0, // First device becomes primary
        isActive: true,
        source: 'admin',
        firstSeen: new Date(),
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: device, message: 'Device registered successfully' });
  } catch (error) {
    console.error('[UserDevices:POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register device' } }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/wifi/users/[id]/devices
// Update a device (toggle active, rename, set primary)
// Body: { deviceId, isActive?, deviceName?, isPrimary? }
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { deviceId, isActive, deviceName, isPrimary } = body as {
      deviceId?: string;
      isActive?: boolean;
      deviceName?: string;
      isPrimary?: boolean;
    };

    if (!deviceId) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'Device ID is required' } }, { status: 400 });
    }

    // Verify device belongs to this user
    const device = await db.wiFiUserDevice.findFirst({
      where: { id: deviceId, wifiUserId: userId },
    });
    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found for this user' } }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (deviceName !== undefined) updateData.deviceName = deviceName;

    // If setting as primary, unset all other primaries for this user
    if (isPrimary === true) {
      await db.wiFiUserDevice.updateMany({
        where: { wifiUserId: userId, isPrimary: true },
        data: { isPrimary: false },
      });
      updateData.isPrimary = true;
    }

    const updated = await db.wiFiUserDevice.update({
      where: { id: deviceId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[UserDevices:PATCH] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update device' } }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/wifi/users/[id]/devices?deviceId=xxx
// Remove a device from a user
// ═══════════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'Device ID is required' } }, { status: 400 });
    }

    // Verify device belongs to this user
    const device = await db.wiFiUserDevice.findFirst({
      where: { id: deviceId, wifiUserId: userId },
    });
    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found for this user' } }, { status: 404 });
    }

    await db.wiFiUserDevice.delete({
      where: { id: deviceId },
    });

    return NextResponse.json({ success: true, message: 'Device removed' });
  } catch (error) {
    console.error('[UserDevices:DELETE] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove device' } }, { status: 500 });
  }
}
