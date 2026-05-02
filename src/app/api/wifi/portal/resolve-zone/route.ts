import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// IPv4 CIDR matching helpers (no external packages required)
// ---------------------------------------------------------------------------

function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function matchesCIDR(ip: string, cidr: string): boolean {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;

  const range = parts[0];
  const bits = parseInt(parts[1], 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const mask = ~((1 << (32 - bits)) - 1);
  const ipNum = ipToInt(ip);
  const rangeNum = ipToInt(range);
  return (ipNum & mask) === (rangeNum & mask);
}

// ---------------------------------------------------------------------------
// Client IP extraction
// ---------------------------------------------------------------------------

function extractClientIp(request: NextRequest): string | null {
  // 1. Check x-forwarded-for (comma-separated, first = original client)
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // 2. Check x-real-ip
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  // 3. Fallback – not available in Next.js Edge/standard API routes,
  //    but we return null and the caller handles it.
  return null;
}

/**
 * Strip IPv6-mapped IPv4 prefix (::ffff:) and any brackets.
 * Handles:
 *   ::ffff:192.168.1.1  →  192.168.1.1
 *   192.168.1.1         →  192.168.1.1
 */
function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;

  let ip = raw.trim();

  // Remove surrounding brackets (e.g. from [::ffff:10.0.0.1]:port)
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }

  // Strip ::ffff: prefix
  const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Match) return v4Match[1];

  // Plain IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;

  // Not a usable IPv4 address
  return null;
}

// ---------------------------------------------------------------------------
// Portal config builder (mirrors /api/v1/wifi/portal response structure)
// ---------------------------------------------------------------------------

async function buildPortalConfig(portalId: string) {
  const portal = await db.captivePortal.findFirst({
    where: { id: portalId, enabled: true },
    include: {
      portalPages: {
        where: { language: 'en' },
        take: 1,
      },
      portalMappings: {
        where: { enabled: true },
      },
      authMethods: {
        where: { enabled: true },
        orderBy: { priority: 'asc' },
      },
    },
  });

  if (!portal) return null;

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
  return {
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
      gradientAngle: (designSettings.gradientAngle as number) || 135,
      backgroundColor: portalPage?.backgroundColor || '#ffffff',
      textColor: portalPage?.textColor || '#ffffff',
      accentColor: portalPage?.accentColor || '#0d9488',
      backgroundImage: portalPage?.backgroundImage || '',
      backgroundOverlay: (designSettings.backgroundOverlay as number) || 40,
      fontFamily: (designSettings.fontFamily as string) || 'Inter, system-ui, sans-serif',
      headingFontFamily: (designSettings.headingFontFamily as string) || 'Inter, system-ui, sans-serif',
      formStyle: (designSettings.formStyle as string) || 'rounded',
      inputStyle: (designSettings.inputStyle as string) || 'rounded',
      buttonStyle: (designSettings.buttonStyle as string) || 'filled',
      buttonSize: (designSettings.buttonSize as string) || 'medium',
      cardShadow: (designSettings.cardShadow as string) || 'medium',
      animationType: (designSettings.animationType as string) || 'fade',
      logoSize: (designSettings.logoSize as string) || 'large',
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
      termsText: (designSettings.termsText as string) || portalPage?.termsText || '',
      termsUrl: (designSettings.termsUrl as string) || portalPage?.termsUrl || '',
      showBranding: portalPage?.showBranding ?? true,
      title: portalPage?.title || 'Welcome',
      subtitle: portalPage?.subtitle || 'Connect to WiFi',

      // ── Feature 1: Multi-Language Portal ──
      languages: (designSettings.languages as string[]) || ['en'],
      defaultLanguage: (designSettings.defaultLanguage as string) || 'en',
      enableMultiLanguage: (designSettings.enableMultiLanguage as boolean) || false,

      // ── Feature 2: Guest Marketing Opt-In ──
      marketingOptIn: (designSettings.marketingOptIn as { enabled: boolean; emailConsent: boolean; phoneConsent: boolean; consentText: string }) || { enabled: false, emailConsent: false, phoneConsent: false, consentText: '' },

      // ── Feature 3: Multi-Slide Promotion Carousel ──
      customAmenities: (designSettings.customAmenities as Array<{ name: string; icon: string }>) || [],
      // Derive showPromotions from useCarouselMode + having slides with content
      showPromotions: ((designSettings.useCarouselMode as boolean) && ((designSettings.promotions as Array<Record<string, string>>) || []).some((p: Record<string, string>) => p.title || p.description)) || (designSettings.showPromotions as boolean) || false,
      useCarouselMode: (designSettings.useCarouselMode as boolean) || false,
      promotions: ((designSettings.promotions as Array<Record<string, string>>) || []).map((p: Record<string, string>) => ({
        id: p.id || `promo-${Math.random().toString(36).slice(2, 8)}`,
        title: p.title || '',
        description: p.description || '',
        imageUrl: p.imageUrl || '',
        linkUrl: p.linkUrl || '',
        backgroundColor: p.backgroundColor || p.bgColor || '#f59e0b',
      })),

      // ── Feature 4: Post-Connect Guest Survey ──
      surveyConfig: (designSettings.surveyConfig as { enabled: boolean; question: string; options: string[]; thankYouMessage: string }) || { enabled: false, question: '', options: [], thankYouMessage: '' },

      // ── Feature 5: Weather Widget ──
      weatherLocation: (designSettings.weatherLocation as string) || '',

      // ── Feature 9: Content Block Reordering ──
      contentBlockOrder: (designSettings.contentBlockOrder as string[]) || [],

      // ── Feature 14: Portal Scheduling ──
      scheduleConfig: (designSettings.scheduleConfig as { enabled: boolean; schedules: Array<{ id: string; name: string; days: number[]; startTime: string; endTime: string; designOverrides: Record<string, unknown> }> }) || { enabled: false, schedules: [] },
    },
    ssids: allSsids,
    termsRequired: !!(portalPage?.termsText || portalPage?.termsUrl),
    // List of enabled auth methods with labels (same as /api/v1/wifi/portal)
    authMethods: portal.authMethods.map((am) => {
      let config: Record<string, unknown> = {};
      try {
        config = am.config ? JSON.parse(am.config) : {};
      } catch {
        config = {};
      }
      return {
        method: am.method,
        label: (config.label as string) || am.method,
        description: (config.description as string) || '',
      };
    }),
    // Form fields configuration from PortalPage (same as /api/v1/wifi/portal)
    formFields: portalPage?.formFields
      ? (() => {
          try {
            return JSON.parse(portalPage.formFields);
          } catch {
            return null;
          }
        })()
      : null,
  };
}

// ---------------------------------------------------------------------------
// GET handler — PUBLIC endpoint (no auth)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Extract & normalize client IP
    const rawIp = extractClientIp(request);
    const clientIp = normalizeIp(rawIp);

    if (!clientIp) {
      // Cannot determine client IP — fall back to the default portal
      const defaultPortal = await db.captivePortal.findFirst({
        where: { isDefault: true, enabled: true },
      });
      if (defaultPortal) {
        const config = await buildPortalConfig(defaultPortal.id);
        return NextResponse.json({
          success: true,
          data: {
            zone: config?.slug ?? defaultPortal.slug,
            portalId: defaultPortal.id,
            matchedSubnet: null,
            isDefault: true,
            config,
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { zone: null, portalId: null, matchedSubnet: null, config: null },
      });
    }

    // 2. Fetch all enabled PortalMappings that have a subnet configured,
    //    sorted by priority descending (higher priority checked first)
    const mappings = await db.portalMapping.findMany({
      where: {
        enabled: true,
        subnet: { not: null },
      },
      orderBy: { priority: 'desc' },
    });

    // 3. Match client IP against each mapping's subnet CIDR
    let matchedMapping: (typeof mappings)[number] | null = null;

    for (const mapping of mappings) {
      if (!mapping.subnet) continue;
      if (matchesCIDR(clientIp, mapping.subnet)) {
        matchedMapping = mapping;
        break;
      }
    }

    // 4. No subnet match → fall back to the default portal (isDefault=true)
    if (!matchedMapping) {
      const defaultPortal = await db.captivePortal.findFirst({
        where: { isDefault: true, enabled: true },
      });
      if (defaultPortal) {
        const config = await buildPortalConfig(defaultPortal.id);
        return NextResponse.json({
          success: true,
          data: {
            zone: config?.slug ?? defaultPortal.slug,
            portalId: defaultPortal.id,
            matchedSubnet: null,
            isDefault: true,
            config,
          },
        });
      }
      // No default portal configured → return null
      return NextResponse.json({
        success: true,
        data: { zone: null, portalId: null, matchedSubnet: null, config: null },
      });
    }

    // 5. Match found — build the full portal config
    const config = await buildPortalConfig(matchedMapping.portalId);

    // If the matched portal is disabled or deleted, fall back to fallbackPortalId
    if (!config && matchedMapping.fallbackPortalId) {
      const fallbackConfig = await buildPortalConfig(matchedMapping.fallbackPortalId);
      return NextResponse.json({
        success: true,
        data: {
          zone: fallbackConfig?.slug ?? null,
          portalId: matchedMapping.fallbackPortalId,
          matchedSubnet: matchedMapping.subnet,
          config: fallbackConfig,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        zone: config?.slug ?? null,
        portalId: matchedMapping.portalId,
        matchedSubnet: matchedMapping.subnet,
        config,
      },
    });
  } catch (error) {
    console.error('[Resolve Zone API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            'Unable to resolve WiFi zone. Please try again or contact front desk.',
        },
      },
      { status: 500 }
    );
  }
}
