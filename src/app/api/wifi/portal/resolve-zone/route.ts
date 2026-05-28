import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWifiSettings } from '@/lib/wifi-settings';

// ---------------------------------------------------------------------------
// IPv4 CIDR matching helpers (fallback only — primary matching uses PostgreSQL inet)
// ---------------------------------------------------------------------------

function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * matchesCIDR — handles both CIDR (10.0.0.0/24) and plain IP (10.0.0.5) formats.
 * Plain IPs are treated as /32 host routes.
 */
function matchesCIDR(ip: string, cidr: string): boolean {
  const parts = cidr.split('/');
  // If no CIDR bits, treat as /32 (single host)
  const range = parts[0];
  const bits = parts.length === 2 ? parseInt(parts[1], 10) : 32;
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

async function buildPortalConfig(portalId: string, language?: string | null) {
  // Normalize language: accept query param, default to 'en', validate against common codes
  const lang = (language?.trim() || 'en').substring(0, 10);
  const portal = await db.captivePortal.findFirst({
    where: { id: portalId, enabled: true },
    include: {
      portalPages: {
        where: { language: lang },
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
  let portalPage = portal.portalPages[0];

  // Fallback to 'en' if no page found for the requested language
  if (!portalPage && lang !== 'en') {
    const fallbackPage = await db.portalPage.findFirst({
      where: { portalId, language: 'en', active: true },
    });
    if (fallbackPage) portalPage = fallbackPage;
  }
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

  // Build the safe response object
  // tenantId and propertyId are included so the SurveyWidget can call
  // the public satisfaction API endpoints (which require these as query params).
  return {
    name: portal.name,
    slug: portal.slug,
    tenantId: portal.tenantId,
    propertyId: portal.propertyId,
    // Prefer PortalPage.authFlow (set via Portal Designer) over
    // CaptivePortal.authMethod (set via Portal Instances tab) so that
    // the auth flow the admin configured in the designer always wins.
    authMethod: portalPage?.authFlow || portal.authMethod,
    sessionTimeout: portal.sessionTimeout,
    autoAuthEnabled: portal.autoAuthEnabled ?? true,
    // Convert bytes/sec to Mbps for guest-friendly display
    maxBandwidthDown: Math.round(portal.maxBandwidthDown / 1000000) || 5,
    maxBandwidthUp: Math.round(portal.maxBandwidthUp / 1000000) || 1,
    // ── Roaming configuration (F11) ──
    roamingMode: portal.roamingMode || 'auth_origin',
    allowsRoamingFrom: (() => {
      try { return portal.allowsRoamingFrom ? JSON.parse(portal.allowsRoamingFrom) : []; }
      catch { return []; }
    })(),
    bandwidthPolicy: portal.bandwidthPolicy || 'zone',
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
      showHotelInfo: (designSettings.showHotelInfo as boolean) ?? false,
      amenities: amenities,
      showAmenities: (designSettings.showAmenities as boolean) ?? false,
      showSocialMedia: (designSettings.showSocialMedia as boolean) ?? false,
      socialLinks: socialLinks,
      showClock: (designSettings.showClock as boolean) ?? false,
      showWeather: (designSettings.showWeather as boolean) ?? false,
      promotionTitle: (designSettings.promotionTitle as string) || '',
      promotionDesc: (designSettings.promotionDesc as string) || '',
      showPromotion: (designSettings.showPromotion as boolean) ?? false,
      termsText: (designSettings.termsText as string) || portalPage?.termsText || '',
      termsUrl: (designSettings.termsUrl as string) || portalPage?.termsUrl || '',
      showBranding: portalPage?.showBranding ?? false,
      title: portalPage?.title || 'Welcome',
      subtitle: portalPage?.subtitle || 'Connect to WiFi',

      // ── Feature 1: Multi-Language Portal ──
      languages: (designSettings.languages as string[]) || [],
      defaultLanguage: (designSettings.defaultLanguage as string) || 'en',
      enableMultiLanguage: (designSettings.enableMultiLanguage as boolean) || false,
      translations: (designSettings.translations as Record<string, Record<string, string>>) || {},

      // ── Feature 2: Guest Marketing Opt-In ──
      marketingOptIn: {
        enabled: Boolean(designSettings.marketingOptIn?.enabled),
        emailConsent: Boolean(designSettings.marketingOptIn?.emailConsent),
        phoneConsent: Boolean(designSettings.marketingOptIn?.phoneConsent),
        consentText: String(designSettings.marketingOptIn?.consentText || ''),
      },

      // ── Feature 3: Multi-Slide Promotion Carousel ──
      customAmenities: (designSettings.customAmenities as Array<{ name: string; icon: string }>) || [],
      // showPromotions: ONLY true when parent promotion toggle is ON AND carousel mode is selected
      showPromotions: (((designSettings.showPromotion as boolean) ?? false) && ((designSettings.useCarouselMode as boolean) ?? false)),
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

  // ── GDPR Consent Management sync (Feature 13) ──
  // Merge WiFiSettings.consent_management into the portal config so the
  // guest-facing portal and the admin GDPR dashboard stay in sync.
  // The GDPR settings act as a global override for marketing opt-in visibility.
  try {
    if (portal.tenantId) {
      const gdprSettings = await getWifiSettings(portal.tenantId, 'consent_management');
      if (gdprSettings) {
        // If GDPR consent management explicitly enables/disables marketing opt-in,
        // override the portal designer's local marketingOptIn.enabled setting.
        // This ensures a single source of truth: GDPR Consent Management page.
        if (typeof gdprSettings.showMarketingOptIn === 'boolean') {
          config.design.marketingOptIn.enabled = gdprSettings.showMarketingOptIn;
        }
        // Use GDPR consent text as fallback if portal designer's consent text is empty
        if (!config.design.marketingOptIn.consentText && gdprSettings.consentText) {
          config.design.marketingOptIn.consentText = gdprSettings.consentText;
        }
        // Expose GDPR retention info for the consent log (not shown to guest)
        (config as Record<string, unknown>).gdprConsentConfig = {
          retentionDays: gdprSettings.retentionDays || 90,
          requiredTypes: gdprSettings.requiredTypes || ['wifi_access'],
          cookiePolicyUrl: gdprSettings.cookiePolicyUrl || '',
        };
      }
    }
  } catch (err) {
    // Non-fatal: GDPR settings fetch failure should not break the portal
    console.warn('[Resolve Zone] GDPR consent settings fetch failed:', err instanceof Error ? err.message : err);
  }

  return config;
}

// ---------------------------------------------------------------------------
// GET handler — PUBLIC endpoint (no auth)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Default portal resolution helper
// ---------------------------------------------------------------------------

async function resolveDefaultPortal(lang: string | null) {
  const defaultPortal = await db.captivePortal.findFirst({
    where: { isDefault: true, enabled: true },
  });
  if (!defaultPortal) {
    return NextResponse.json({
      success: true,
      data: { zone: null, portalId: null, matchedSubnet: null, config: null },
    });
  }
  const config = await buildPortalConfig(defaultPortal.id, lang);
  return NextResponse.json({
    success: true,
    data: {
      zone: config?.slug ?? defaultPortal.slug,
      portalId: defaultPortal.id,
      matchedSubnet: null,
      isDefault: true,
      matchedBy: 'default',
      roamingMode: config?.roamingMode ?? 'auth_origin',
      allowsRoamingFrom: config?.allowsRoamingFrom ?? [],
      bandwidthPolicy: config?.bandwidthPolicy ?? 'zone',
      config,
    },
  });
}

// ---------------------------------------------------------------------------
// GET handler — PUBLIC endpoint (no auth)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 0. Extract optional language parameter (defaults to 'en')
    const lang = request.nextUrl.searchParams.get('lang');

    // 1. Extract & normalize client IP
    const rawIp = extractClientIp(request);
    const clientIp = normalizeIp(rawIp);

    if (!clientIp) {
      console.warn('[Resolve Zone] Cannot determine client IP — falling back to default portal');
      return resolveDefaultPortal(lang);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1: CIDR subnet match via PostgreSQL native inet <<= operator
    // ══════════════════════════════════════════════════════════════════════════
    // Uses PostgreSQL's native inet comparison which is more accurate than
    // JS-based CIDR matching. Handles both CIDR (10.0.0.0/24) and plain IP
    // (10.0.0.5) formats stored in PortalMapping.subnet.
    try {
      const cidrMatches = await db.$queryRawUnsafe(`
        SELECT pm.id, pm."portalId", pm.subnet, pm."fallbackPortalId", pm.priority
        FROM "PortalMapping" pm
        JOIN "CaptivePortal" cp ON cp.id = pm."portalId"
        JOIN "Tenant" t ON t.id = pm."tenantId"
        WHERE pm.enabled = true
          AND pm.subnet IS NOT NULL
          AND cp.enabled = true
          AND (t."deletedAt" IS NULL)
          AND pm.subnet ~ '^\\d+\\.\\d+\\.\\d+\\.\\d+(/\\d+)?$'
          AND $1::inet <<= CASE
            WHEN pm.subnet ~ '/' THEN pm.subnet::inet
            ELSE (pm.subnet || '/32')::inet
          END
        ORDER BY pm.priority DESC
        LIMIT 1
      `, clientIp) as Array<{ id: string; portalId: string; subnet: string; fallbackPortalId: string | null; priority: number }>;

      if (cidrMatches.length > 0) {
        const matched = cidrMatches[0];
        console.log(`[Resolve Zone] CIDR match: client ${clientIp} → portal ${matched.portalId} via subnet ${matched.subnet}`);
        const config = await buildPortalConfig(matched.portalId, lang);

        if (config) {
          return NextResponse.json({
            success: true,
            data: {
              zone: config.slug,
              portalId: matched.portalId,
              matchedSubnet: matched.subnet,
              isDefault: false,
              matchedBy: 'subnet',
              roamingMode: config.roamingMode,
              allowsRoamingFrom: config.allowsRoamingFrom,
              bandwidthPolicy: config.bandwidthPolicy,
              config,
            },
          });
        }

        // Matched portal disabled → try fallback portal
        if (matched.fallbackPortalId) {
          const fallbackConfig = await buildPortalConfig(matched.fallbackPortalId, lang);
          return NextResponse.json({
            success: true,
            data: {
              zone: fallbackConfig?.slug ?? null,
              portalId: matched.fallbackPortalId,
              matchedSubnet: matched.subnet,
              isDefault: false,
              matchedBy: 'subnet-fallback',
              roamingMode: fallbackConfig?.roamingMode ?? 'auth_origin',
              allowsRoamingFrom: fallbackConfig?.allowsRoamingFrom ?? [],
              bandwidthPolicy: fallbackConfig?.bandwidthPolicy ?? 'zone',
              config: fallbackConfig,
            },
          });
        }
      }
    } catch (err) {
      console.error('[Resolve Zone] CIDR lookup error (falling through to range check):', err);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2: IP Range fallback — match via IpPoolRange (startIp..endIp)
    // ══════════════════════════════════════════════════════════════════════════
    // This catches cases where:
    //   - PortalMapping.subnet is null (pool created without subnet, only ranges)
    //   - Client IP falls within a pool's IP ranges but not the subnet CIDR
    //   - Legacy mappings with broken subnet (missing /32 from formatInet bug)
    try {
      const rangeMatches = await db.$queryRawUnsafe(`
        SELECT pm.id, pm."portalId", pm.subnet, pm."fallbackPortalId", pm.priority,
               ipr."startIp"::text AS "rangeStart", ipr."endIp"::text AS "rangeEnd"
        FROM "PortalMapping" pm
        JOIN "CaptivePortal" cp ON cp.id = pm."portalId"
        JOIN "Tenant" t ON t.id = pm."tenantId"
        JOIN "IpPool" ip ON (
          -- Exact subnet match (CIDR format)
          ip.subnet::text = pm.subnet
          -- Handle legacy /32 stripped: IpPool 10.0.0.5/32 ↔ PortalMapping 10.0.0.5
          OR (ip.subnet IS NOT NULL AND pm.subnet IS NOT NULL
              AND replace(ip.subnet::text, '/32', '') = pm.subnet)
          -- Handle PortalMapping 10.0.0.5/32 ↔ IpPool 10.0.0.5
          OR (ip.subnet IS NOT NULL AND pm.subnet IS NOT NULL
              AND ip.subnet::text = replace(pm.subnet, '/32', ''))
          -- Handle PortalMapping with subnet but IpPool has no subnet (null match)
          OR (pm.subnet IS NULL AND ip.subnet IS NULL)
        )
        JOIN "IpPoolRange" ipr ON ipr."poolId" = ip.id
        WHERE pm.enabled = true
          AND cp.enabled = true
          AND (t."deletedAt" IS NULL)
          AND ip.enabled = true
          AND $1::inet BETWEEN ipr."startIp" AND ipr."endIp"
        ORDER BY pm.priority DESC
        LIMIT 1
      `, clientIp) as Array<{ id: string; portalId: string; subnet: string | null; fallbackPortalId: string | null; priority: number; rangeStart: string; rangeEnd: string }>;

      if (rangeMatches.length > 0) {
        const matched = rangeMatches[0];
        console.log(`[Resolve Zone] Range match: client ${clientIp} → portal ${matched.portalId} via range ${matched.rangeStart}–${matched.rangeEnd}`);
        const config = await buildPortalConfig(matched.portalId, lang);

        if (config) {
          return NextResponse.json({
            success: true,
            data: {
              zone: config.slug,
              portalId: matched.portalId,
              matchedSubnet: matched.subnet || `${matched.rangeStart}-${matched.rangeEnd}`,
              isDefault: false,
              matchedBy: 'range',
              roamingMode: config.roamingMode,
              allowsRoamingFrom: config.allowsRoamingFrom,
              bandwidthPolicy: config.bandwidthPolicy,
              config,
            },
          });
        }

        // Matched portal disabled → try fallback
        if (matched.fallbackPortalId) {
          const fallbackConfig = await buildPortalConfig(matched.fallbackPortalId, lang);
          return NextResponse.json({
            success: true,
            data: {
              zone: fallbackConfig?.slug ?? null,
              portalId: matched.fallbackPortalId,
              matchedSubnet: matched.subnet,
              isDefault: false,
              matchedBy: 'range-fallback',
              roamingMode: fallbackConfig?.roamingMode ?? 'auth_origin',
              allowsRoamingFrom: fallbackConfig?.allowsRoamingFrom ?? [],
              bandwidthPolicy: fallbackConfig?.bandwidthPolicy ?? 'zone',
              config: fallbackConfig,
            },
          });
        }
      }
    } catch (err) {
      console.error('[Resolve Zone] Range lookup error:', err);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3: No match at all → fall back to the default portal (isDefault=true)
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`[Resolve Zone] No match for client ${clientIp} — falling back to default portal`);
    return resolveDefaultPortal(lang);
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
