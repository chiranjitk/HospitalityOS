import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  FEATURES,
  PLAN_FEATURES,
  FEATURE_CATEGORIES,
  isBaseFeature,
  getDependentFeatures,
} from '@/lib/feature-flags';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { seedEntitlements } from '@/lib/license-enforcement';
import cache from '@/lib/cache';

// GET - Get feature flags for tenant
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Note: All authenticated users can read feature flags (needed for menu visibility)
    // Only admins can modify feature flags (see PUT handler)

    const tenantId = user.tenantId;

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get default features for plan
    const planKey = tenant.plan || 'trial';
    const defaultFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.trial;

    // Parse tenant-specific feature overrides from database
    let tenantOverrides: Record<string, boolean> = {};
    try {
      if (tenant.features) {
        tenantOverrides = JSON.parse(tenant.features);
      }
    } catch {
      tenantOverrides = {};
    }

    // Build features list - merge defaults with tenant overrides
    const allFeatureKeys = [...new Set([...defaultFeatures, ...Object.keys(FEATURES)])];
    
    const features = allFeatureKeys.map(key => {
      const config = FEATURES[key as keyof typeof FEATURES];
      const isDefaultEnabled = defaultFeatures.includes(key);
      const tenantOverride = tenantOverrides[key];
      
      return {
        id: key,
        key: key,
        name: config?.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: config?.description || '',
        enabled: tenantOverride !== undefined ? tenantOverride : isDefaultEnabled,
        category: config?.category || 'standard',
        isAddon: config?.category === 'addons',
        alwaysEnabled: config?.alwaysEnabled || false,
      };
    });

    // Group by category for UI
    const categories = Object.entries(FEATURE_CATEGORIES).map(([key, info]) => ({
      id: key,
      name: info.name,
      description: info.description,
      color: info.color,
      features: features.filter(f => f.category === key),
    }));

    // Return only enabled feature keys for the context
    const enabledFeatureKeys = features.filter(f => f.enabled).map(f => f.key);

    const featureFlags = {
      features,
      categories,
      enabledFeatures: enabledFeatureKeys,
      plan: planKey,
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: featureFlags,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

// PUT - Update feature flags for tenant
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Platform admin only
    if (!user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { features } = body;

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Build features map from the request
    const featuresMap: Record<string, boolean> = {};
    const rejectedKeys: string[] = [];
    
    if (Array.isArray(features)) {
      for (const f of features) {
        const key = f.key;
        const enabled = f.enabled;

        // Validate: reject unknown feature keys
        if (!FEATURES[key]) {
          console.warn(`[Feature Flags] Rejecting unknown feature key: ${key}`);
          rejectedKeys.push(key);
          continue;
        }

        // Protect base features from being disabled
        if (isBaseFeature(key) && !enabled) {
          console.warn(`[Feature Flags] Rejecting disable of base feature: ${key} (user: ${user.id})`);
          rejectedKeys.push(key);
          continue;
        }

        featuresMap[key] = enabled;
      }
    }

    // Check dependency chains - prevent disabling a feature that others depend on
    const changedKeys = Object.keys(featuresMap);
    for (const key of changedKeys) {
      if (featuresMap[key] === false) {
        const dependents = getDependentFeatures(key);
        for (const depId of dependents) {
          if (featuresMap[depId] === true) {
            console.warn(`[Feature Flags] ${depId} depends on ${key} which is being disabled`);
            rejectedKeys.push(depId);
          }
        }
      }
    }

    // Get existing features and merge
    let existingFeatures: Record<string, boolean> = {};
    try {
      if (tenant.features) {
        existingFeatures = JSON.parse(tenant.features);
      }
    } catch {
      existingFeatures = {};
    }

    // Merge with new values (only non-rejected)
    const updatedFeatures = { ...existingFeatures, ...featuresMap };

    // Update tenant features
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        features: JSON.stringify(updatedFeatures),
      },
    });

    // Auto-seed license entitlements for newly enabled addon modules
    const newlyEnabledKeys: string[] = [];
    const newlyDisabledKeys: string[] = [];
    for (const key of changedKeys) {
      if (featuresMap[key] === true && existingFeatures[key] !== true) {
        newlyEnabledKeys.push(key);
      }
      if (featuresMap[key] === false && existingFeatures[key] !== false) {
        newlyDisabledKeys.push(key);
      }
    }
    if (newlyEnabledKeys.length > 0) {
      try {
        const seedResult = await seedEntitlements(tenantId, newlyEnabledKeys);
        if (seedResult.seeded.length > 0) {
          console.log(`[Feature Flags] Auto-seeded entitlements for: ${seedResult.seeded.join(', ')}`);
        }
      } catch (seedError) {
        console.error('[Feature Flags] Failed to seed entitlements:', seedError);
        // Don't block feature flag update for entitlement seeding failure
      }
    }

    // Revoke entitlements for newly disabled features
    if (newlyDisabledKeys.length > 0) {
      try {
        const updateResult = await db.licenseModuleEntitlement.updateMany({
          where: {
            tenantId,
            moduleKey: { in: newlyDisabledKeys },
            isValid: true,
          },
          data: { isValid: false },
        });
        if (updateResult.count > 0) {
          console.log(`[Feature Flags] Revoked entitlements for ${updateResult.count} disabled module(s): ${newlyDisabledKeys.join(', ')}`);
          // Invalidate cache for revoked modules
          for (const key of newlyDisabledKeys) {
            cache.delete(`license:entitlement:${tenantId}:${key}`);
          }
        }
      } catch (revokeError) {
        console.error('[Feature Flags] Failed to revoke entitlements:', revokeError);
        // Don't block feature flag update for entitlement revocation failure
      }
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          module: 'settings',
          action: 'FEATURE_FLAGS_UPDATED',
          entityType: 'Tenant',
          entityId: tenantId,
          userId: user.id,
          tenantId,
          oldValue: JSON.stringify(existingFeatures),
          newValue: JSON.stringify(updatedFeatures),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditError) {
      // Audit log failure should not block the feature flag update
      console.error('[Feature Flags] Failed to create audit log:', auditError);
    }

    // Get plan defaults
    const planKey = tenant.plan || 'trial';
    const defaultFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.trial;

    // Build response
    const allFeatureKeys = [...new Set([...defaultFeatures, ...Object.keys(FEATURES)])];
    const enabledFeatures = allFeatureKeys.filter(key => {
      const override = updatedFeatures[key];
      if (override !== undefined) return override;
      return defaultFeatures.includes(key);
    });

    return NextResponse.json({
      success: true,
      data: { 
        tenantId, 
        features: Array.isArray(features) ? features : [],
        enabledFeatures,
        rejectedKeys: rejectedKeys.length > 0 ? rejectedKeys : undefined,
      },
      message: rejectedKeys.length > 0
        ? 'Feature flags updated with some rejected changes'
        : 'Feature flags updated successfully',
    });
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update feature flags' },
      { status: 500 }
    );
  }
}
