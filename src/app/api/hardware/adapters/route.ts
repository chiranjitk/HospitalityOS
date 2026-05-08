import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { encryptObject } from '@/lib/encryption';
import type { HardwareProviderId } from '@/lib/hardware/types';

/** All known hardware provider identifiers. */
const VALID_PROVIDER_IDS: HardwareProviderId[] = [
  'simulator',
  'assa-abloy-visionline',
  'salto-ks',
  'dormakaba-saflok',
  'nuki',
  'seam',
  'stripe-terminal',
  'square-terminal',
  'adyen-terminal',
  'verifone-engage',
  'ingenico',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a serialisable representation of a HardwareAdapter row with
 * credentials masked so they are never exposed via the API.
 */
function maskAdapter(row: {
  id: string;
  tenantId: string;
  propertyId: string;
  providerId: string;
  category: string;
  displayName: string;
  config: string;
  credentials: string;
  enabled: boolean;
  healthStatus: string;
  lastHealthyAt: Date | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    propertyId: row.propertyId,
    providerId: row.providerId,
    category: row.category,
    displayName: row.displayName,
    config: row.config,
    credentials: row.credentials ? '***ENCRYPTED***' : undefined,
    enabled: row.enabled,
    healthStatus: row.healthStatus,
    lastHealthyAt: row.lastHealthyAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET — List hardware adapters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.view', 'hardware.view', 'settings.view'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const providerId = searchParams.get('providerId');
    const propertyId = searchParams.get('propertyId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (category) where.category = category;
    if (providerId) where.providerId = providerId;
    if (propertyId) where.propertyId = propertyId;
    if (isActive !== null && isActive !== undefined) {
      where.enabled = isActive === 'true';
    }

    const adapters = await db.hardwareAdapter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: adapters.map(maskAdapter),
    });
  } catch (error) {
    console.error('[HAL:API] Error listing hardware adapters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list hardware adapters' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a hardware adapter
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.manage', 'settings.edit'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId,
      providerId,
      category,
      label,
      configJson,
      credentialsJson,
      vendorPropertyId,
      webhookUrl,
      webhookSecret,
    } = body;

    // --- Validation ---
    if (!propertyId || !providerId || !category) {
      return NextResponse.json(
        { success: false, error: 'propertyId, providerId, and category are required' },
        { status: 400 },
      );
    }

    if (category !== 'lock' && category !== 'terminal') {
      return NextResponse.json(
        { success: false, error: 'category must be "lock" or "terminal"' },
        { status: 400 },
      );
    }

    if (!VALID_PROVIDER_IDS.includes(providerId as HardwareProviderId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid providerId. Must be one of: ${VALID_PROVIDER_IDS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Check for existing adapter for the same property+provider
    const existing = await db.hardwareAdapter.findUnique({
      where: { propertyId_providerId: { propertyId, providerId } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An adapter already exists for this property and provider' },
        { status: 409 },
      );
    }

    // --- Build config JSON ---
    const configPayload: Record<string, unknown> = {
      ...(configJson ?? {}),
    };
    if (vendorPropertyId) configPayload.vendorPropertyId = vendorPropertyId;
    if (webhookUrl) configPayload.webhookUrl = webhookUrl;

    // --- Encrypt credentials ---
    const credsPayload: Record<string, unknown> = {
      ...(credentialsJson ?? {}),
    };
    if (webhookSecret) credsPayload.webhookSecret = webhookSecret;

    const encryptedCredentials = Object.keys(credsPayload).length > 0
      ? encryptObject(credsPayload)
      : '{}';

    // --- Create ---
    const adapter = await db.hardwareAdapter.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        providerId,
        category,
        displayName: label || providerId,
        config: JSON.stringify(configPayload),
        credentials: encryptedCredentials,
        enabled: true,
      },
    });

    return NextResponse.json(
      { success: true, data: maskAdapter(adapter) },
      { status: 201 },
    );
  } catch (error) {
    console.error('[HAL:API] Error creating hardware adapter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create hardware adapter' },
      { status: 500 },
    );
  }
}
