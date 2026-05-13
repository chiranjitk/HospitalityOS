import { NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type IdentityVerificationSettings } from '@/lib/wifi-settings';

const TENANT_ID = 'tenant_01';

export async function GET() {
  try {
    const settings = await getWifiSettings(TENANT_ID, 'identity_verification');
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[GET /api/wifi/identity-logs/settings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load identity verification settings' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<IdentityVerificationSettings>;

    // ── Validation ──────────────────────────────────────────────
    if (body.otpExpirySeconds !== undefined) {
      if (typeof body.otpExpirySeconds !== 'number' || body.otpExpirySeconds < 60 || body.otpExpirySeconds > 900) {
        return NextResponse.json(
          { success: false, error: 'otpExpirySeconds must be between 60 and 900' },
          { status: 400 },
        );
      }
    }

    if (body.otpMaxRetries !== undefined) {
      if (typeof body.otpMaxRetries !== 'number' || body.otpMaxRetries < 1 || body.otpMaxRetries > 10) {
        return NextResponse.json(
          { success: false, error: 'otpMaxRetries must be between 1 and 10' },
          { status: 400 },
        );
      }
    }

    if (body.requiredMethods !== undefined) {
      if (!Array.isArray(body.requiredMethods) || body.requiredMethods.length === 0) {
        return NextResponse.json(
          { success: false, error: 'requiredMethods must be a non-empty array' },
          { status: 400 },
        );
      }
    }

    // Merge with existing settings so partial updates work
    const existing = await getWifiSettings(TENANT_ID, 'identity_verification');
    const merged: IdentityVerificationSettings = {
      ...existing,
      ...body,
    };

    await setWifiSettings(TENANT_ID, 'identity_verification', merged);

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    console.error('[PUT /api/wifi/identity-logs/settings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save identity verification settings' },
      { status: 500 },
    );
  }
}
