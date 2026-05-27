import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings, setWifiSettings, type ConsentManagementSettings } from '@/lib/wifi-settings';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// GET /api/wifi/consent-logs/settings — Retrieve consent management settings
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied: requires wifi.manage' } },
      { status: 403 },
    );
  }

  try {
    const settings = await getWifiSettings(auth.tenantId, 'consent_management');
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
// Also syncs showMarketingOptIn + consentText to all PortalPage designSettings
// so the Portal Designer and GDPR Consent Management stay in sync.
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied: requires wifi.manage' } },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const settings: ConsentManagementSettings = {
      consentText: typeof body.consentText === 'string' ? body.consentText : '',
      requiredTypes: Array.isArray(body.requiredTypes) ? body.requiredTypes : ['wifi_access'],
      retentionDays: typeof body.retentionDays === 'number' ? body.retentionDays : 90,
      showMarketingOptIn: typeof body.showMarketingOptIn === 'boolean' ? body.showMarketingOptIn : false,
      cookiePolicyUrl: typeof body.cookiePolicyUrl === 'string' ? body.cookiePolicyUrl : '',
    };

    await setWifiSettings(auth.tenantId, 'consent_management', settings);

    // ── Sync to Portal Designer: update termsText + marketingOptIn in all portal pages ──
    // This ensures the Portal Designer reflects the GDPR Consent Management settings.
    // Sync direction: GDPR settings → Portal Designer (termsText, marketingOptIn.enabled, termsUrl)
    try {
      const portalPages = await db.portalPage.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, designSettings: true },
      });

      for (const page of portalPages) {
        try {
          let ds: Record<string, unknown> = {};
          if (page.designSettings) {
            ds = typeof page.designSettings === 'string' ? JSON.parse(page.designSettings) : page.designSettings;
          }

          // Ensure marketingOptIn object exists
          if (!ds.marketingOptIn || typeof ds.marketingOptIn !== 'object') {
            ds.marketingOptIn = { enabled: false, emailConsent: true, phoneConsent: false, consentText: '' };
          }

          // Sync the enabled flag from GDPR settings → portal designer
          (ds.marketingOptIn as Record<string, unknown>).enabled = settings.showMarketingOptIn;

          // Sync consent text: GDPR consentText → portal termsText + marketingOptIn.consentText
          if (settings.consentText) {
            // Update the main termsText in designSettings (what guests see in Terms modal)
            ds.termsText = settings.consentText;
            // Also update marketingOptIn.consentText as fallback
            if (!(ds.marketingOptIn as Record<string, unknown>).consentText) {
              (ds.marketingOptIn as Record<string, unknown>).consentText = settings.consentText;
            }
          }

          // Sync cookiePolicyUrl → termsUrl if portal has no custom termsUrl
          if (settings.cookiePolicyUrl && !ds.termsUrl) {
            ds.termsUrl = settings.cookiePolicyUrl;
          }

          await db.portalPage.update({
            where: { id: page.id },
            data: {
              designSettings: JSON.stringify(ds),
              // Also sync termsText to the dedicated PortalPage column
              ...(settings.consentText ? { termsText: settings.consentText } : {}),
            },
          });
        } catch {
          // Skip individual page sync failures — don't block the settings save
        }
      }

      if (portalPages.length > 0) {
        console.log(`[F13] Synced termsText + marketingOptIn to ${portalPages.length} portal page(s)`);
      }
    } catch (err) {
      // Non-fatal: portal sync failure should not block the settings save
      console.warn('[F13] Portal page sync failed (non-fatal):', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[F13] Error saving consent settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save consent settings' } },
      { status: 500 },
    );
  }
}
