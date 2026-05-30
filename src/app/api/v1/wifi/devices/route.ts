import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize MAC address to AA:BB:CC:DD:EE:FF format */
function normalizeMac(mac: string): string {
  return mac
    .replace(/[^0-9a-fA-F]/g, '')
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, '$1:');
}

/** Validate MAC address (6 hex pairs, separators optional) */
function isValidMac(mac: string): boolean {
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
  return cleaned.length === 12;
}

/** Parse device type from User-Agent */
function parseDeviceType(ua: string): string {
  if (/iPhone/i.test(ua)) return 'phone';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && /WebKit/i.test(ua) && !/Safari/i.test(ua))) return 'tablet';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet';
  if (/SmartTV|InternetTV|APPLETV/i.test(ua)) return 'tv';
  if (/Watch/i.test(ua)) return 'watch';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'laptop';
  return 'unknown';
}

/** Parse device name from User-Agent */
function parseDeviceName(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  if (/Linux/i.test(ua)) return 'Linux PC';
  if (/SmartTV/i.test(ua)) return 'Smart TV';
  return 'Unknown Device';
}

// ─── GET /api/v1/wifi/devices ──────────────────────────────────────────────────
// List devices for a user. Supports filtering by username, userId, or guestId.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const userId = searchParams.get('userId');
    const guestId = searchParams.get('guestId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const propertyId = searchParams.get('propertyId');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (username) {
      // Find WiFiUser by username, then get their devices
      const wifiUser = await db.wiFiUser.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!wifiUser) {
        return NextResponse.json({ success: true, data: [], total: 0 });
      }
      where.wifiUserId = wifiUser.id;
    } else if (userId) {
      where.wifiUserId = userId;
    } else if (guestId) {
      where.guestId = guestId;
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAMS', message: 'username, userId, or guestId is required' } },
        { status: 400 }
      );
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const devices = await db.wiFiUserDevice.findMany({
      where,
      orderBy: { lastSeen: 'desc' },
    });

    const total = await db.wiFiUserDevice.count({ where });

    return NextResponse.json({
      success: true,
      data: devices,
      total,
    });
  } catch (error) {
    console.error('[WiFiUserDevice] List error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch devices' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/v1/wifi/devices ─────────────────────────────────────────────────
// Register or update a device for a WiFiUser. Upserts by (wifiUserId, macAddress).

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      wifiUserId,
      macAddress,
      deviceName,
      deviceType,
      userAgent,
      ipAddress,
      guestId: bodyGuestId,
      source = 'login',
      propertyId: bodyPropertyId,
    } = body;

    if (!wifiUserId || !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'wifiUserId and macAddress are required' } },
        { status: 400 }
      );
    }

    if (!isValidMac(macAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid MAC address format. Expected: AA:BB:CC:DD:EE:FF' } },
        { status: 400 }
      );
    }

    const normalizedMac = normalizeMac(macAddress);

    // Fetch WiFiUser to resolve tenantId, propertyId, and guestId
    const wifiUser = await db.wiFiUser.findUnique({
      where: { id: wifiUserId },
      select: { id: true, tenantId: true, propertyId: true, guestId: true },
    });

    if (!wifiUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFiUser not found' } },
        { status: 404 }
      );
    }

    const resolvedTenantId = wifiUser.tenantId;
    const resolvedPropertyId = bodyPropertyId || wifiUser.propertyId;
    const resolvedGuestId = bodyGuestId || wifiUser.guestId || undefined;

    // Check if this is the first device for the user (auto-set as primary)
    const existingDeviceCount = await db.wiFiUserDevice.count({
      where: { wifiUserId, isActive: true },
    });

    // Upsert: create if new, update lastSeen if existing
    const device = await db.wiFiUserDevice.upsert({
      where: {
        wifiUserId_macAddress: {
          wifiUserId,
          macAddress: normalizedMac,
        },
      },
      create: {
        tenantId: resolvedTenantId,
        wifiUserId,
        propertyId: resolvedPropertyId,
        guestId: resolvedGuestId,
        macAddress: normalizedMac,
        deviceName: deviceName || parseDeviceName(userAgent || ''),
        deviceType: deviceType || parseDeviceType(userAgent || ''),
        userAgent: userAgent?.substring(0, 500),
        ipAddress: ipAddress || undefined,
        source,
        isPrimary: existingDeviceCount === 0,
        lastSeen: new Date(),
      },
      update: {
        ipAddress: ipAddress || undefined,
        userAgent: userAgent?.substring(0, 500) || undefined,
        deviceName: deviceName || undefined,
        deviceType: deviceType || undefined,
        lastSeen: new Date(),
        isActive: true, // Re-activate if was deactivated
      },
    });

    // Determine if this was a create or update based on timestamps
    const isNew = device.createdAt.getTime() === device.updatedAt.getTime();

    return NextResponse.json(
      { success: true, data: device },
      { status: isNew ? 201 : 200 }
    );
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This device is already registered for this user' } },
        { status: 409 }
      );
    }
    console.error('[WiFiUserDevice] Create/Update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register device' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/v1/wifi/devices ────────────────────────────────────────────────
// Deactivate a device, or clear all devices for a user (checkout).

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const clearAll = searchParams.get('clearAll') === 'true';

    // Bulk clear: deactivate all devices for a user
    if (userId && clearAll) {
      const result = await db.wiFiUserDevice.updateMany({
        where: { wifiUserId: userId },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        data: { deactivated: result.count },
        message: `Deactivated ${result.count} device(s)`,
      });
    }

    // Single device deactivation via body
    const body = await request.json().catch(() => null);
    const { id, macAddress, wifiUserId } = body || {};

    if (id) {
      const device = await db.wiFiUserDevice.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        data: device,
        message: 'Device deactivated',
      });
    }

    if (macAddress && wifiUserId) {
      const normalizedMac = normalizeMac(macAddress);
      const device = await db.wiFiUserDevice.findUnique({
        where: { wifiUserId_macAddress: { wifiUserId, macAddress: normalizedMac } },
      });
      if (!device) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } },
          { status: 404 }
        );
      }
      await db.wiFiUserDevice.update({
        where: { id: device.id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'Device deactivated' });
    }

    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAMS', message: 'id, or (macAddress + wifiUserId), or (userId + clearAll=true) required' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[WiFiUserDevice] Delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate device' } },
      { status: 500 }
    );
  }
}
