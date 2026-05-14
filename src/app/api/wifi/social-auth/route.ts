import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/wifi/social-auth
 * Return configured social login providers for the tenant's WiFi.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const propertyId = searchParams.get('propertyId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Read social auth settings from WiFiSettings
    const settings = await db.wiFiSettings.findMany({
      where: {
        tenantId,
        propertyId: propertyId || null,
        key: {
          in: ['social_google_enabled', 'social_facebook_enabled', 'social_google_client_id', 'social_facebook_client_id'],
        },
      },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const providers: Array<{
      id: string;
      name: string;
      enabled: boolean;
      clientId?: string;
    }> = [
      {
        id: 'google',
        name: 'Google',
        enabled: settingsMap['social_google_enabled'] === 'true',
        clientId: settingsMap['social_google_client_id'] || undefined,
      },
      {
        id: 'facebook',
        name: 'Facebook',
        enabled: settingsMap['social_facebook_enabled'] === 'true',
        clientId: settingsMap['social_facebook_client_id'] || undefined,
      },
    ];

    // Only return enabled providers (or all with status for admin use)
    return NextResponse.json({ providers });
  } catch (error) {
    console.error('[WiFi Social Auth] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
