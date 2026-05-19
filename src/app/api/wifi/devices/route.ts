/**
 * WiFi Device Registration API
 *
 * GET  — List registered devices with filters and pagination
 * POST — Register a new device (auto-approved by default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { requireAuth } from '@/lib/auth/tenant-context';

const DEFAULT_MAX_DEVICES = 5;

// GET /api/wifi/devices — List registered devices
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const propertyId = searchParams.get('propertyId');
    const deviceType = searchParams.get('deviceType');
    const isApproved = searchParams.get('isApproved');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
    };

    if (guestId) where.guestId = guestId;
    if (propertyId) where.propertyId = propertyId;
    if (deviceType) where.deviceType = deviceType;
    if (isApproved !== null && isApproved !== undefined && isApproved !== '') {
      where.isApproved = isApproved === 'true';
    }

    // Search by guest name or MAC address
    if (search) {
      where.OR = [
        { macAddress: { contains: search, mode: 'insensitive' } },
        { guest: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ] } },
        { deviceName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [devices, total] = await Promise.all([
      db.wiFiDevice.findMany({
        where,
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          property: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiDevice.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: devices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch WiFi devices' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/devices — Register a new device
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const { guestId, macAddress, deviceName, deviceType, ipAddress, propertyId } = data;

    // Validate required fields
    if (!guestId || !macAddress) {
      return NextResponse.json(
        { success: false, error: 'guestId and macAddress are required' },
        { status: 400 }
      );
    }

    // Check for existing device with the same MAC address
    const existingDevice = await db.wiFiDevice.findUnique({
      where: {
        tenantId_macAddress: {
          tenantId: auth.tenantId,
          macAddress: macAddress as string,
        },
      },
    });

    if (existingDevice) {
      // Update last seen for the existing device
      const updated = await db.wiFiDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastSeen: new Date(),
          ipAddress: ipAddress as string || existingDevice.ipAddress,
          userAgent: (data.userAgent as string) || existingDevice.userAgent,
        },
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          property: {
            select: { id: true, name: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Device already registered — updated last seen timestamp',
      });
    }

    // Count existing devices for this guest
    const deviceCount = await db.wiFiDevice.count({
      where: {
        tenantId: auth.tenantId,
        guestId: guestId as string,
      },
    });

    if (deviceCount >= DEFAULT_MAX_DEVICES) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum device limit reached (${DEFAULT_MAX_DEVICES} devices per guest)`,
        },
        { status: 400 }
      );
    }

    // Create new device — auto-approved by default
    const device = await db.wiFiDevice.create({
      data: {
        tenantId: auth.tenantId,
        guestId: guestId as string,
        propertyId: (propertyId as string) || null,
        macAddress: macAddress as string,
        deviceName: (deviceName as string) || null,
        deviceType: (deviceType as string) || 'other',
        ipAddress: (ipAddress as string) || null,
        userAgent: (data.userAgent as string) || null,
        isApproved: true,
        autoAuth: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: device,
        message: 'Device registered successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error registering WiFi device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register WiFi device' },
      { status: 500 }
    );
  }
}
