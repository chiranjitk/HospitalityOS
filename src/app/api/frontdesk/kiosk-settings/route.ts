import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// Zod schema for kiosk settings validation
const kioskSettingsSchema = z.object({
  hotelName: z.string().min(1).max(100).optional(),
  welcomeMessage: z.string().min(1).max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().url().optional().nullable(),
  backgroundStyle: z.enum(['gradient', 'solid', 'image']).optional(),
  idleTimeout: z.number().int().min(30).max(300).optional(),
  showClock: z.boolean().optional(),
  showLanguageSwitch: z.boolean().optional(),
  enableCheckIn: z.boolean().optional(),
  enableCheckOut: z.boolean().optional(),
  enablePayment: z.boolean().optional(),
  termsContent: z.string().max(5000).optional(),
  requirePaymentOnCheckout: z.boolean().optional(),
});

// Default kiosk settings
const DEFAULTS = {
  hotelName: 'StaySuite',
  welcomeMessage: 'Welcome! Please select an option below.',
  primaryColor: '#10b981',
  logoUrl: null,
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

// GET - Fetch kiosk settings for the current property
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'frontdesk.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get the first property for this tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        properties: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant || !tenant.properties[0]) {
      return NextResponse.json(
        { success: false, error: 'No properties found' },
        { status: 404 }
      );
    }

    const propertyId = tenant.properties[0].id;

    // Try to find existing kiosk settings
    const settings = await db.kioskSettings.findUnique({
      where: { propertyId },
    });

    // Return existing settings merged with defaults (for any missing fields)
    const data = settings
      ? {
          id: settings.id,
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
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        }
      : {
          // No settings yet — return defaults
          ...DEFAULTS,
          propertyId,
        };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching kiosk settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch kiosk settings' },
      { status: 500 }
    );
  }
}

// PUT - Save/update kiosk settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'frontdesk.manage') && !hasPermission(user, 'frontdesk.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    // Validate input with Zod
    const validation = kioskSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const validated = validation.data;

    // Get the first property for this tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        properties: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant || !tenant.properties[0]) {
      return NextResponse.json(
        { success: false, error: 'No properties found' },
        { status: 404 }
      );
    }

    const propertyId = tenant.properties[0].id;

    // Upsert kiosk settings
    const settings = await db.kioskSettings.upsert({
      where: { propertyId },
      create: {
        propertyId,
        tenantId,
        hotelName: validated.hotelName ?? DEFAULTS.hotelName,
        welcomeMessage: validated.welcomeMessage ?? DEFAULTS.welcomeMessage,
        primaryColor: validated.primaryColor ?? DEFAULTS.primaryColor,
        logoUrl: validated.logoUrl !== undefined ? validated.logoUrl : DEFAULTS.logoUrl,
        backgroundStyle: validated.backgroundStyle ?? DEFAULTS.backgroundStyle,
        idleTimeout: validated.idleTimeout ?? DEFAULTS.idleTimeout,
        showClock: validated.showClock ?? DEFAULTS.showClock,
        showLanguageSwitch: validated.showLanguageSwitch ?? DEFAULTS.showLanguageSwitch,
        enableCheckIn: validated.enableCheckIn ?? DEFAULTS.enableCheckIn,
        enableCheckOut: validated.enableCheckOut ?? DEFAULTS.enableCheckOut,
        enablePayment: validated.enablePayment ?? DEFAULTS.enablePayment,
        termsContent: validated.termsContent ?? DEFAULTS.termsContent,
        requirePaymentOnCheckout: validated.requirePaymentOnCheckout ?? DEFAULTS.requirePaymentOnCheckout,
      },
      update: {
        ...(validated.hotelName !== undefined && { hotelName: validated.hotelName }),
        ...(validated.welcomeMessage !== undefined && { welcomeMessage: validated.welcomeMessage }),
        ...(validated.primaryColor !== undefined && { primaryColor: validated.primaryColor }),
        ...(validated.logoUrl !== undefined && { logoUrl: validated.logoUrl }),
        ...(validated.backgroundStyle !== undefined && { backgroundStyle: validated.backgroundStyle }),
        ...(validated.idleTimeout !== undefined && { idleTimeout: validated.idleTimeout }),
        ...(validated.showClock !== undefined && { showClock: validated.showClock }),
        ...(validated.showLanguageSwitch !== undefined && { showLanguageSwitch: validated.showLanguageSwitch }),
        ...(validated.enableCheckIn !== undefined && { enableCheckIn: validated.enableCheckIn }),
        ...(validated.enableCheckOut !== undefined && { enableCheckOut: validated.enableCheckOut }),
        ...(validated.enablePayment !== undefined && { enablePayment: validated.enablePayment }),
        ...(validated.termsContent !== undefined && { termsContent: validated.termsContent }),
        ...(validated.requirePaymentOnCheckout !== undefined && { requirePaymentOnCheckout: validated.requirePaymentOnCheckout }),
      },
    });

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Kiosk settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving kiosk settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save kiosk settings' },
      { status: 500 }
    );
  }
}
