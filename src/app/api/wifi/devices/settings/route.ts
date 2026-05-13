/**
 * WiFi Device Management Settings API
 *
 * GET  — Retrieve device management settings
 * PUT  — Update device management settings (maxDevicesPerGuest, defaultAutoAuth, autoCleanupDays)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type DeviceManagementSettings } from '@/lib/wifi-settings';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/devices/settings
export async function GET() {
  try {
    const settings = await getWifiSettings(TENANT_ID, 'device_management');
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching device management settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device management settings' },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/devices/settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { maxDevicesPerGuest, defaultAutoAuth, autoCleanupDays } = body as Partial<DeviceManagementSettings>;

    // Validate maxDevicesPerGuest: must be integer 1-20
    const maxDevices = typeof maxDevicesPerGuest === 'number' ? Math.floor(maxDevicesPerGuest) : undefined;
    if (maxDevices === undefined || maxDevices < 1 || maxDevices > 20) {
      return NextResponse.json(
        { success: false, error: 'maxDevicesPerGuest must be an integer between 1 and 20' },
        { status: 400 },
      );
    }

    // Validate defaultAutoAuth: must be boolean
    if (typeof defaultAutoAuth !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'defaultAutoAuth must be a boolean' },
        { status: 400 },
      );
    }

    // Validate autoCleanupDays: must be integer 1-365
    const cleanupDays = typeof autoCleanupDays === 'number' ? Math.floor(autoCleanupDays) : undefined;
    if (cleanupDays === undefined || cleanupDays < 1 || cleanupDays > 365) {
      return NextResponse.json(
        { success: false, error: 'autoCleanupDays must be an integer between 1 and 365' },
        { status: 400 },
      );
    }

    const settings: DeviceManagementSettings = {
      maxDevicesPerGuest: maxDevices,
      defaultAutoAuth,
      autoCleanupDays: cleanupDays,
    };

    await setWifiSettings(TENANT_ID, 'device_management', settings);

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating device management settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update device management settings' },
      { status: 500 },
    );
  }
}
