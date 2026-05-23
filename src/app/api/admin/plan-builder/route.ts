/**
 * Plan Builder API — comprehensive plan management for StaySuite HospitalityOS
 *
 * Uses RegistrationPlan table (tied to LicenseKey) instead of SubscriptionPlan.
 *
 * GET    /api/admin/plan-builder            — List all plans with detailed feature info
 * POST   /api/admin/plan-builder            — Create a new plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import {
  FEATURES,
  PLAN_FEATURES,
  getBaseFeatures,
  getAddonFeatures,
  getAddonsBySubcategory,
  ADDON_SUBCATEGORIES,
} from '@/lib/feature-flags';
import type { FeatureConfig } from '@/lib/feature-flags';

// =====================================================
// TYPES
// =====================================================

/** The stored JSON structure inside RegistrationPlan.features */
export interface PlanFeaturesPayload {
  enabled: string[];
  yearlyPrice?: number;
  deploymentType?: 'cloud' | 'onprem' | 'both';
  setupFee?: number;
  storageLimitMb?: number;
  isCustom?: boolean;
  addonPricing?: Array<{
    featureId: string;
    included: boolean;
    monthlyPrice: number;
  }>;
  limits?: Array<{
    moduleKey: string;
    limitType: string;
    limitValue: number;
  }>;
}

/** What the frontend sends when creating/updating a plan */
export interface PlanCreateBody {
  name?: string;
  displayName: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  deploymentType?: 'cloud' | 'onprem' | 'both';
  setupFee?: number;
  maxProperties?: number;
  maxUsers?: number;
  maxRoomsPerProperty?: number;
  maxStaff?: number;
  storageLimitMb?: number;
  trialDays?: number;
  isPopular?: boolean;
  isCustom?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  features?: string[];
  addonPricing?: PlanFeaturesPayload['addonPricing'];
  limits?: PlanFeaturesPayload['limits'];
}

// =====================================================
// HELPERS
// =====================================================

/** Parse the features JSON column — handles both legacy array and new object format */
export function parseFeatures(raw: string | null | undefined): PlanFeaturesPayload {
  if (!raw) return { enabled: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { enabled: parsed };
    if (parsed && typeof parsed === 'object') {
      return { enabled: parsed.enabled || [], ...parsed };
    }
    return { enabled: [] };
  } catch {
    return { enabled: [] };
  }
}

/** Serialise a payload back into the features JSON column */
export function serializeFeatures(payload: PlanFeaturesPayload): string {
  return JSON.stringify(payload);
}

/** Auto-generate a URL-safe slug from a display name */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Enrich a plan record with parsed feature details, categories, etc. */
export function enrichPlan(
  plan: {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    price: number;
    currency: string;
    maxProperties: number;
    maxRoomsPerProperty: number;
    maxUsers: number;
    maxStaff: number;
    features: string;
    sortOrder: number;
    isActive: boolean;
    highlighted: boolean;
    trialDays: number | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { licenseKeys: number };
  },
  subscriberCount: number,
  allAvailableFeatures: Array<{ id: string; config: FeatureConfig }>
) {
  const payload = parseFeatures(plan.features);
  const enabledIds = payload.enabled;

  // Build detailed feature configs for each enabled feature
  const parsedFeaturesDetailed = enabledIds
    .map((id) => {
      const cfg = FEATURES[id];
      if (!cfg) return null;
      return { ...cfg };
    })
    .filter(Boolean) as Array<{ id: string } & FeatureConfig>;

  // Group features by category and subcategory
  const featureCategories: Record<string, Record<string, string[]>> = {
    base: {},
    addons: {},
  };

  for (const fid of enabledIds) {
    const cfg = FEATURES[fid];
    if (!cfg) continue;
    const cat = cfg.category;
    const sub = cfg.subcategory || '_general';
    if (!featureCategories[cat]) featureCategories[cat] = {};
    if (!featureCategories[cat][sub]) featureCategories[cat][sub] = [];
    featureCategories[cat][sub].push(fid);
  }

  return {
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    description: plan.description ?? '',
    monthlyPrice: plan.price,
    yearlyPrice: payload.yearlyPrice ?? 0,
    currency: plan.currency,
    deploymentType: payload.deploymentType ?? 'cloud',
    setupFee: payload.setupFee ?? 0,
    maxProperties: plan.maxProperties,
    maxUsers: plan.maxUsers,
    maxRoomsPerProperty: plan.maxRoomsPerProperty,
    maxStaff: plan.maxStaff,
    storageLimitMb: payload.storageLimitMb ?? 1000,
    trialDays: plan.trialDays,
    isPopular: plan.highlighted,
    isCustom: payload.isCustom ?? false,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,

    // Parsed feature data
    parsedFeatures: enabledIds,
    parsedAddonModules: payload.addonPricing ?? [],
    parsedFeaturesDetailed,
    featureCategories,

    // All available features for the picker
    allAvailableFeatures,

    // Counts
    subscriberCount,
    licenseKeyCount: plan._count?.licenseKeys ?? 0,

    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

// =====================================================
// SEED DATA
// =====================================================

const defaultRegistrationPlans: Array<{
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  maxProperties: number;
  maxRoomsPerProperty: number;
  maxUsers: number;
  maxStaff: number;
  trialDays: number | null;
  highlighted: boolean;
  sortOrder: number;
  features: string;
}> = [
  {
    name: 'trial',
    displayName: 'Trial',
    description: 'Free trial with base modules — 14 days, up to 15 rooms',
    price: 0,
    currency: 'INR',
    maxProperties: 1,
    maxRoomsPerProperty: 15,
    maxUsers: 3,
    maxStaff: 5,
    trialDays: 14,
    highlighted: false,
    sortOrder: 0,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.trial,
      yearlyPrice: 0,
      deploymentType: 'both',
      setupFee: 0,
      storageLimitMb: 500,
      isCustom: false,
    }),
  },
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Essential PMS for small hotels & guesthouses — up to 30 rooms',
    price: 4999,
    currency: 'INR',
    maxProperties: 1,
    maxRoomsPerProperty: 30,
    maxUsers: 5,
    maxStaff: 10,
    trialDays: null,
    highlighted: false,
    sortOrder: 1,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.starter,
      yearlyPrice: 49990,
      deploymentType: 'cloud',
      setupFee: 0,
      storageLimitMb: 2000,
      isCustom: false,
    }),
  },
  {
    name: 'professional',
    displayName: 'Professional',
    description: 'Full-featured PMS with WiFi & channels — up to 80 rooms',
    price: 9999,
    currency: 'INR',
    maxProperties: 2,
    maxRoomsPerProperty: 80,
    maxUsers: 15,
    maxStaff: 20,
    trialDays: null,
    highlighted: true,
    sortOrder: 2,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.professional,
      yearlyPrice: 99990,
      deploymentType: 'both',
      setupFee: 0,
      storageLimitMb: 10000,
      isCustom: false,
    }),
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Unlimited scale with all modules — up to 200 rooms per property',
    price: 17999,
    currency: 'INR',
    maxProperties: 5,
    maxRoomsPerProperty: 200,
    maxUsers: 30,
    maxStaff: 50,
    trialDays: null,
    highlighted: false,
    sortOrder: 3,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.enterprise,
      yearlyPrice: 179990,
      deploymentType: 'both',
      setupFee: 0,
      storageLimitMb: 50000,
      isCustom: true,
    }),
  },
  {
    name: 'onprem-professional',
    displayName: 'Professional On-Prem',
    description: 'Full WiFi Gateway + all professional modules — data sovereignty',
    price: 14999,
    currency: 'INR',
    maxProperties: 2,
    maxRoomsPerProperty: 80,
    maxUsers: 15,
    maxStaff: 20,
    trialDays: null,
    highlighted: true,
    sortOrder: 4,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.professional,
      yearlyPrice: 149990,
      deploymentType: 'onprem',
      setupFee: 75000,
      storageLimitMb: 100000,
      isCustom: false,
    }),
  },
  {
    name: 'onprem-enterprise',
    displayName: 'Enterprise On-Prem',
    description: 'Complete StaySuite with every module — unlimited scale',
    price: 24999,
    currency: 'INR',
    maxProperties: 10,
    maxRoomsPerProperty: 9999,
    maxUsers: 999,
    maxStaff: 200,
    trialDays: null,
    highlighted: false,
    sortOrder: 5,
    features: serializeFeatures({
      enabled: PLAN_FEATURES.enterprise,
      yearlyPrice: 249990,
      deploymentType: 'onprem',
      setupFee: 150000,
      storageLimitMb: 500000,
      isCustom: true,
    }),
  },
];

async function ensurePlansSeeded() {
  const existing = await db.registrationPlan.count();
  if (existing === 0) {
    await db.registrationPlan.createMany({ data: defaultRegistrationPlans });
    console.log('[plan-builder] Seeded', defaultRegistrationPlans.length, 'default plans');
  }
}

// =====================================================
// ROUTES
// =====================================================

// GET — List all plans with detailed feature info
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    await ensurePlansSeeded();

    // Fetch all plans (active + inactive) ordered by sortOrder
    const plans = await db.registrationPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { licenseKeys: true } } },
    });

    // Get subscriber counts from Tenant.plan (which stores plan name)
    const tenantCounts = await db.tenant.groupBy({
      by: ['plan'],
      where: { deletedAt: null },
      _count: { plan: true },
    });
    const countMap = new Map(tenantCounts.map((t) => [t.plan, t._count.plan]));

    // Build all available features list
    const allAvailableFeatures = Object.entries(FEATURES).map(([id, config]) => ({
      id,
      config,
    }));

    const enriched = plans.map((plan) =>
      enrichPlan(
        { ...plan, _count: plan._count },
        countMap.get(plan.name) || 0,
        allAvailableFeatures
      )
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[plan-builder] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

// POST — Create a new plan
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body: PlanCreateBody = await request.json();

    // ── Validate required fields ──
    if (!body.displayName || typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'displayName is required' },
        { status: 400 }
      );
    }

    // ── Determine slug ──
    let name = body.name;
    if (!name) {
      name = slugify(body.displayName);
    }
    // Ensure uniqueness
    const slugBase = name;
    let suffix = 1;
    while (
      await db.registrationPlan.findFirst({ where: { name }, select: { id: true } })
    ) {
      name = `${slugBase}-${suffix++}`;
      if (suffix > 100) {
        return NextResponse.json(
          { success: false, error: 'Could not generate a unique plan name' },
          { status: 409 }
        );
      }
    }

    // ── Build features payload ──
    const baseFeatures = getBaseFeatures();
    const requestedFeatures: string[] = body.features ?? [];
    // Auto-add all base (alwaysEnabled) features
    const enabledFeatures = Array.from(
      new Set([...baseFeatures, ...requestedFeatures.filter((f) => FEATURES[f])])
    );

    const featuresPayload: PlanFeaturesPayload = {
      enabled: enabledFeatures,
      yearlyPrice: body.yearlyPrice ?? 0,
      deploymentType: body.deploymentType ?? 'cloud',
      setupFee: body.setupFee ?? 0,
      storageLimitMb: body.storageLimitMb ?? 1000,
      isCustom: body.isCustom ?? false,
      addonPricing: body.addonPricing ?? [],
      limits: body.limits ?? [],
    };

    // ── Get next sortOrder ──
    const maxSort = await db.registrationPlan.aggregate({ _max: { sortOrder: true } });

    // ── Create plan ──
    const plan = await db.registrationPlan.create({
      data: {
        name,
        displayName: body.displayName.trim(),
        description: body.description ?? '',
        price: typeof body.monthlyPrice === 'number' ? body.monthlyPrice : 0,
        currency: body.currency ?? 'INR',
        maxProperties: typeof body.maxProperties === 'number' ? body.maxProperties : 1,
        maxUsers: typeof body.maxUsers === 'number' ? body.maxUsers : 5,
        maxRoomsPerProperty: typeof body.maxRoomsPerProperty === 'number' ? body.maxRoomsPerProperty : 50,
        maxStaff: typeof body.maxStaff === 'number' ? body.maxStaff : 10,
        trialDays: body.trialDays ?? null,
        highlighted: body.isPopular ?? false,
        isActive: body.isActive ?? true,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : (maxSort._max.sortOrder ?? -1) + 1,
        features: serializeFeatures(featuresPayload),
      },
    });

    // Build all available features list for enrichment
    const allAvailableFeatures = Object.entries(FEATURES).map(([id, config]) => ({
      id,
      config,
    }));

    return NextResponse.json(
      {
        success: true,
        data: enrichPlan(plan, 0, allAvailableFeatures),
        message: 'Plan created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[plan-builder] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}
