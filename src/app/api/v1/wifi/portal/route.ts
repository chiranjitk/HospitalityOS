import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const propertyId = searchParams.get('propertyId');

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_SLUG',
            message: 'Portal zone slug is required. Provide ?slug=<zone>',
          },
        },
        { status: 400 }
      );
    }

    // Build the query
    const whereClause: Record<string, unknown> = {
      slug,
      enabled: true,
    };

    // Optionally filter by propertyId
    if (propertyId) {
      whereClause.propertyId = propertyId;
    }

    // Fetch the portal with related data
    const portal = await db.captivePortal.findFirst({
      where: whereClause,
      include: {
        portalPages: {
          where: { language: 'en' },
          take: 1,
        },
        portalMappings: {
          where: { enabled: true },
        },
      },
    });

    if (!portal) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PORTAL_NOT_FOUND',
            message: `No active portal found for zone "${slug}". Please contact front desk for assistance.`,
          },
        },
        { status: 404 }
      );
    }

    // Parse design settings from the portal page
    const portalPage = portal.portalPages[0];
    let designSettings: Record<string, unknown> = {};
    if (portalPage) {
      try {
        designSettings = portalPage.designSettings
          ? JSON.parse(portalPage.designSettings)
          : {};
      } catch {
        designSettings = {};
      }
    }

    // Parse SSID list from the portal
    let ssidList: string[] = [];
    try {
      ssidList = portal.ssidList ? JSON.parse(portal.ssidList) : [];
    } catch {
      ssidList = [];
    }

    // Extract SSIDs from mappings if available
    const mappingSsids = portal.portalMappings
      .map((m) => m.ssid)
      .filter((s): s is string => Boolean(s));
    const allSsids = [...new Set([...ssidList, ...mappingSsids])];

    // Parse social links from design settings
    const socialLinks: Array<{ platform: string; url: string }> =
      (designSettings.socialLinks as Array<{ platform: string; url: string }>) || [];
    const amenities: string[] = (designSettings.amenities as string[]) || [];

    // Build the safe response object — NO internal IDs, secrets, tenant info
    const safeData = {
      name: portal.name,
      slug: portal.slug,
      authMethod: portal.authMethod,
      sessionTimeout: portal.sessionTimeout,
      // Convert bytes/sec to Mbps for guest-friendly display
      maxBandwidthDown: Math.round(portal.maxBandwidthDown / 1000000) || 5,
      maxBandwidthUp: Math.round(portal.maxBandwidthUp / 1000000) || 1,
      design: {
        layoutType: (designSettings.layoutType as string) || 'centered',
        backgroundType: (designSettings.backgroundType as string) || 'gradient',
        gradientFrom: (designSettings.gradientFrom as string) || '#0ea5e9',
        gradientTo: (designSettings.gradientTo as string) || '#065f46',
        backgroundColor: portalPage?.backgroundColor || '#ffffff',
        textColor: portalPage?.textColor || '#1f2937',
        accentColor: portalPage?.accentColor || '#0d9488',
        backgroundImage: portalPage?.backgroundImage || '',
        backgroundOverlay: (designSettings.backgroundOverlay as number) || 40,
        fontFamily: (designSettings.fontFamily as string) || 'Inter',
        headingFontFamily: (designSettings.headingFontFamily as string) || 'Inter',
        formStyle: (designSettings.formStyle as string) || 'rounded',
        inputStyle: (designSettings.inputStyle as string) || 'rounded',
        buttonStyle: (designSettings.buttonStyle as string) || 'filled',
        buttonSize: (designSettings.buttonSize as string) || 'medium',
        cardShadow: (designSettings.cardShadow as string) || 'medium',
        animationType: (designSettings.animationType as string) || 'fade',
        welcomeMessage: (designSettings.welcomeMessage as string) || '',
        hotelName: (designSettings.hotelName as string) || '',
        hotelAddress: (designSettings.hotelAddress as string) || '',
        hotelPhone: (designSettings.hotelPhone as string) || '',
        hotelWebsite: (designSettings.hotelWebsite as string) || '',
        logoUrl: portalPage?.logoUrl || '',
        showHotelInfo: (designSettings.showHotelInfo as boolean) || false,
        amenities,
        showAmenities: (designSettings.showAmenities as boolean) || false,
        showSocialMedia: (designSettings.showSocialMedia as boolean) || false,
        socialLinks,
        showClock: (designSettings.showClock as boolean) || false,
        showWeather: (designSettings.showWeather as boolean) || false,
        promotionTitle: (designSettings.promotionTitle as string) || '',
        promotionDesc: (designSettings.promotionDesc as string) || '',
        showPromotion: (designSettings.showPromotion as boolean) || false,
        termsText: portalPage?.termsText || '',
        termsUrl: portalPage?.termsUrl || '',
        showBranding: portalPage?.showBranding ?? true,
        title: portalPage?.title || 'Welcome',
        subtitle: portalPage?.subtitle || 'Connect to WiFi',
      },
      ssids: allSsids,
      termsRequired: !!(portalPage?.termsText || portalPage?.termsUrl),
    };

    return NextResponse.json({ success: true, data: safeData });
  } catch (error) {
    console.error('[Portal Config API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to load portal configuration. Please try again or contact front desk.',
        },
      },
      { status: 500 }
    );
  }
}
