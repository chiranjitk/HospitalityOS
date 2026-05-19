/**
 * WiFi Bandwidth Upsell Settings API
 *
 * GET  — Retrieve bandwidth upsell settings and tiers
 * PUT  — Update bandwidth upsell settings and tiers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type BandwidthUpsellSettings } from '@/lib/wifi-settings';
import { requireAuth } from '@/lib/auth/tenant-context';

const SETTINGS_KEY = 'bandwidth_upsell';

// GET /api/wifi/bandwidth-upgrade/settings
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const settings = await getWifiSettings(auth.tenantId, SETTINGS_KEY);
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

    await setWifiSettings(auth.tenantId, SETTINGS_KEY, body);

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error('Error saving bandwidth upsell settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bandwidth upsell settings.' },
      { status: 500 },
    );
  }
}
