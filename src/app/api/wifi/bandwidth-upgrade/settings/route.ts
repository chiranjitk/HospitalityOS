/**
 * WiFi Bandwidth Upsell Settings API
 *
 * GET  — Retrieve bandwidth upsell settings and tiers
 * PUT  — Update bandwidth upsell settings and tiers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type BandwidthUpsellSettings } from '@/lib/wifi-settings';
import { requireAuth } from '@/lib/auth/tenant-context';
import { z } from 'zod';

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
    const body = await request.json();

    // Zod schema validation for settings body
    const settingsSchema = z.object({
      upsellEnabled: z.boolean(),
      chargeToRoom: z.boolean(),
      defaultCurrency: z.string().min(1),
      tiers: z.array(z.object({
        planId: z.string(),
        price: z.number().min(0),
        bandwidthMbps: z.number().min(0),
        durationHours: z.number().min(0).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })).min(0),
      maxRefundHours: z.number().min(0).optional(),
      minUpgradeHoursBeforeExpiry: z.number().min(0).optional(),
    });

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      // Fall back to basic validation for backwards compatibility
      const data = body as BandwidthUpsellSettings;
      if (typeof data.upsellEnabled !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'upsellEnabled must be a boolean.' },
          { status: 400 },
        );
      }
      if (typeof data.chargeToRoom !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'chargeToRoom must be a boolean.' },
          { status: 400 },
        );
      }
      if (typeof data.defaultCurrency !== 'string' || !data.defaultCurrency) {
        return NextResponse.json(
          { success: false, error: 'defaultCurrency is required.' },
          { status: 400 },
        );
      }
      if (!Array.isArray(data.tiers)) {
        return NextResponse.json(
          { success: false, error: 'tiers must be an array.' },
          { status: 400 },
        );
      }

      await setWifiSettings(auth.tenantId, SETTINGS_KEY, data);
      return NextResponse.json({ success: true, data });
    }

    // Schema validation passed — save the parsed data
    await setWifiSettings(auth.tenantId, SETTINGS_KEY, parsed.data as BandwidthUpsellSettings);
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (error) {
    console.error('Error saving bandwidth upsell settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bandwidth upsell settings.' },
      { status: 500 },
    );
  }
}
