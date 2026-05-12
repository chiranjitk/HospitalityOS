import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default kiosk settings returned when no DB record exists
const DEFAULTS = {
  hotelName: 'StaySuite',
  welcomeMessage: 'Welcome! Please select an option below.',
  primaryColor: '#10b981',
  logoUrl: null as string | null,
  backgroundStyle: 'gradient' as const,
  idleTimeout: 120,
  showClock: true,
  showLanguageSwitch: true,
  enableCheckIn: true,
  enableCheckOut: true,
  enablePayment: false,
  termsContent: "By using this kiosk, I agree to the hotel's terms and conditions.",
  requirePaymentOnCheckout: false,
};

/**
 * GET /api/kiosk/public-settings?propertyId=XXX
 *
 * Public (unauthenticated) endpoint for the standalone kiosk page to fetch
 * its configuration. No auth required — safe to call from any origin on the
 * same host.
 *
 * Query params:
 *   propertyId (optional, UUID) – fetch settings for a specific property.
 *                                 If omitted, falls back to the first property
 *                                 of the first tenant (demo / single-tenant setups).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPropertyId = searchParams.get('propertyId');

    let propertyId: string | null = rawPropertyId;

    // Fallback: if no propertyId provided, find the first property of the first tenant
    if (!propertyId) {
      const tenant = await db.tenant.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          properties: {
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!tenant || !tenant.properties[0]) {
        // No tenants/properties at all — just return defaults
        return NextResponse.json({ success: true, data: { ...DEFAULTS } });
      }

      propertyId = tenant.properties[0].id;
    }

    // Look up existing kiosk settings for the property
    const settings = await db.kioskSettings.findUnique({
      where: { propertyId },
    });

    const data = settings
      ? {
          propertyId: settings.propertyId,
          hotelName: settings.hotelName,
          welcomeMessage: settings.welcomeMessage,
          primaryColor: settings.primaryColor,
          logoUrl: settings.logoUrl,
          backgroundStyle: settings.backgroundStyle,
          idleTimeout: settings.idleTimeout,
          showClock: settings.showClock,
          showLanguageSwitch: settings.showLanguageSwitch,
          enableCheckIn: settings.enableCheckIn,
          enableCheckOut: settings.enableCheckOut,
          enablePayment: settings.enablePayment,
          termsContent: settings.termsContent,
          requirePaymentOnCheckout: settings.requirePaymentOnCheckout,
        }
      : {
          ...DEFAULTS,
          propertyId,
        };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[kiosk/public-settings] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch kiosk settings' },
      { status: 500 },
    );
  }
}
