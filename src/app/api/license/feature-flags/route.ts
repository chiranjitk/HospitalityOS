import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  FEATURES,
  PLAN_FEATURES,
  isBaseFeature,
  getDependentFeatures,
} from '@/lib/feature-flags';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/license/feature-flags
 *
 * Returns feature flags for the authenticated user's tenant,
 * scoped to license/subscription context. The response shape is
 * kept minimal — just the resolved feature list — so the license
 * management UI can determine which modules are active without
 * pulling in category metadata or plan details.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // All authenticated users can read their tenant's feature flags
    // (needed for the license management panel to show enabled modules).

    // ── Tenant lookup (from session) ───────────────────────────────
    const tenantId = user.tenantId;

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // ── Resolve feature flags ───────────────────────────────────────
    // Plan defaults
    const planKey = tenant.plan || 'trial';
    const defaultFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.trial;

    // Tenant-specific overrides stored as JSON in the tenant record
    let tenantOverrides: Record<string, boolean> = {};
    try {
      if (tenant.features) {
        tenantOverrides = JSON.parse(tenant.features);
      }
    } catch {
      tenantOverrides = {};
    }

    // Merge plan defaults + all known feature keys so nothing is missed
    const allFeatureKeys = [
      ...new Set([...defaultFeatures, ...Object.keys(FEATURES)]),
    ];

    const features = allFeatureKeys.map((key) => {
      const config = FEATURES[key as keyof typeof FEATURES];
      const isDefaultEnabled = defaultFeatures.includes(key);
      const tenantOverride = tenantOverrides[key];

      return {
        id: key,
        key,
        name:
          config?.name ||
          key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: config?.description || '',
        enabled: tenantOverride !== undefined ? tenantOverride : isDefaultEnabled,
        category: config?.category || 'standard',
        isAddon: config?.category === 'addons',
        alwaysEnabled: config?.alwaysEnabled || false,
      };
    });

    return NextResponse.json({
      success: true,
      data: { features },
    });
  } catch (error) {
    console.error('[License Feature Flags] Error fetching feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}
