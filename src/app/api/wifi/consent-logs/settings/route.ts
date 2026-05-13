import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type ConsentManagementSettings } from '@/lib/wifi-settings';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/consent-logs/settings — Retrieve consent management settings
export async function GET() {
  try {
    const settings = await getWifiSettings(TENANT_ID, 'consent_management');
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[F13] Error fetching consent settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch consent settings' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/consent-logs/settings — Persist consent management settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const settings: ConsentManagementSettings = {
      consentText: typeof body.consentText === 'string' ? body.consentText : '',
      requiredTypes: Array.isArray(body.requiredTypes) ? body.requiredTypes : ['wifi_access'],
      retentionDays: typeof body.retentionDays === 'number' ? body.retentionDays : 90,
      showMarketingOptIn: typeof body.showMarketingOptIn === 'boolean' ? body.showMarketingOptIn : false,
      cookiePolicyUrl: typeof body.cookiePolicyUrl === 'string' ? body.cookiePolicyUrl : '',
    };

    await setWifiSettings(TENANT_ID, 'consent_management', settings);

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[F13] Error saving consent settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save consent settings' } },
      { status: 500 },
    );
  }
}
