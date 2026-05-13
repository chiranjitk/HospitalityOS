/**
 * WiFi Bandwidth Upsell Settings API
 *
 * GET  — Retrieve bandwidth upsell settings and tiers
 * PUT  — Update bandwidth upsell settings and tiers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type BandwidthUpsellSettings } from '@/lib/wifi-settings';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const SETTINGS_KEY = 'bandwidth_upsell';

// GET /api/wifi/bandwidth-upgrade/settings
export async function GET() {
  try {
    const settings = await getWifiSettings(TENANT_ID, SETTINGS_KEY);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching bandwidth upsell settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bandwidth upsell settings.' },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/bandwidth-upgrade/settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as BandwidthUpsellSettings;

    // Basic validation
    if (typeof body.upsellEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'upsellEnabled must be a boolean.' },
        { status: 400 },
      );
    }
    if (typeof body.chargeToRoom !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'chargeToRoom must be a boolean.' },
        { status: 400 },
      );
    }
    if (typeof body.defaultCurrency !== 'string' || !body.defaultCurrency) {
      return NextResponse.json(
        { success: false, error: 'defaultCurrency is required.' },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.tiers)) {
      return NextResponse.json(
        { success: false, error: 'tiers must be an array.' },
        { status: 400 },
      );
    }

    await setWifiSettings(TENANT_ID, SETTINGS_KEY, body);

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error('Error saving bandwidth upsell settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bandwidth upsell settings.' },
      { status: 500 },
    );
  }
}
