/**
 * WiFi Device Lookup API
 *
 * POST — Look up a MAC address for captive portal auto-authentication.
 *        Returns device info + guest info if the MAC belongs to a known,
 *        approved device with autoAuth enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = 'tenant_01';

// POST /api/wifi/devices/lookup — Look up MAC address
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { macAddress } = body;

    if (!macAddress) {
      return NextResponse.json(
        { success: false, error: 'macAddress is required' },
        { status: 400 }
      );
    }

    const device = await db.wiFiDevice.findUnique({
      where: {
        tenantId_macAddress: {
          tenantId: TENANT_ID,
          macAddress,
        },
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No registered device found for this MAC address',
      });
    }

    // Update last seen timestamp
    await db.wiFiDevice.update({
      where: { id: device.id },
      data: { lastSeen: new Date() },
    });

    // Check if device is eligible for auto-authentication
    const isAutoAuthEligible = device.isApproved && device.autoAuth;

    return NextResponse.json({
      success: true,
      found: true,
      eligible: isAutoAuthEligible,
      data: {
        id: device.id,
        macAddress: device.macAddress,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        isApproved: device.isApproved,
        autoAuth: device.autoAuth,
        firstSeen: device.firstSeen,
        lastSeen: new Date(),
        guest: device.guest
          ? {
              id: device.guest.id,
              name: `${device.guest.firstName} ${device.guest.lastName}`,
              email: device.guest.email,
            }
          : null,
        property: device.property
          ? {
              id: device.property.id,
              name: device.property.name,
            }
          : null,
      },
      message: isAutoAuthEligible
        ? 'Device eligible for auto-authentication'
        : 'Device found but not eligible for auto-authentication',
    });
  } catch (error) {
    console.error('Error looking up WiFi device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to look up WiFi device' },
      { status: 500 }
    );
  }
}
