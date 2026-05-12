/**
 * WiFi Device Single Resource API
 *
 * GET    — Get device details
 * PATCH  — Update device (approve/revoke, toggle autoAuth, update info)
 * DELETE — Remove device registration
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';

const TENANT_ID = 'tenant_01';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/wifi/devices/[id] — Get device details
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const device = await db.wiFiDevice.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error('Error fetching WiFi device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch WiFi device' },
      { status: 500 }
    );
  }
}

// PATCH /api/wifi/devices/[id] — Update device
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    // Verify the device belongs to this tenant
    const existing = await db.wiFiDevice.findFirst({
      where: { id, tenantId: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    // Build update payload — only allow specific fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.isApproved !== undefined) updateData.isApproved = !!data.isApproved;
    if (data.autoAuth !== undefined) updateData.autoAuth = !!data.autoAuth;
    if (data.deviceName !== undefined) updateData.deviceName = data.deviceName;
    if (data.deviceType !== undefined) updateData.deviceType = data.deviceType;
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
    if (data.userAgent !== undefined) updateData.userAgent = data.userAgent;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.lastSeen !== undefined) updateData.lastSeen = new Date(data.lastSeen as string);

    const device = await db.wiFiDevice.update({
      where: { id },
      data: updateData,
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
      data: device,
      message: 'Device updated successfully',
    });
  } catch (error) {
    console.error('Error updating WiFi device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update WiFi device' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/devices/[id] — Remove device registration
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Verify the device belongs to this tenant
    const existing = await db.wiFiDevice.findFirst({
      where: { id, tenantId: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    await db.wiFiDevice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Device removed successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete WiFi device' },
      { status: 500 }
    );
  }
}
