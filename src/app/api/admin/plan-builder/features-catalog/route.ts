/**
 * GET /api/admin/plan-builder/features-catalog
 *
 * Returns the complete features catalog from feature-flags.ts, grouped by:
 *   - base features (locked / always-enabled)
 *   - addon features grouped by subcategory
 *
 * Each feature includes: id, name, description, category, subcategory,
 * alwaysEnabled, dependencies.
 *
 * Also includes default limit configs for addon modules (mirrored from
 * license-enforcement.ts MODULE_DEFAULTS).
 *
 * Used by the frontend module picker / plan builder UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import {
  FEATURES,
  getBaseFeatures,
  getAddonFeatures,
  getAddonsBySubcategory,
  ADDON_SUBCATEGORIES,
} from '@/lib/feature-flags';
import type { FeatureConfig } from '@/lib/feature-flags';

// Default module limit configs — mirrors MODULE_DEFAULTS from license-enforcement.ts
const MODULE_DEFAULT_CONFIGS: Record<
  string,
  {
    limitType: string;
    limitValue: number;
    moduleName: string;
    billingDimension?: string;
  }
> = {
  wifi: { limitType: 'concurrent_users', limitValue: 100, moduleName: 'WiFi & Network' },
  pos: { limitType: 'users', limitValue: 10, moduleName: 'Restaurant & POS' },
  crm: { limitType: 'users', limitValue: 5, moduleName: 'CRM & Marketing' },
  channel_manager: { limitType: 'properties', limitValue: 5, moduleName: 'Channel Manager' },
  guest_experience: { limitType: 'users', limitValue: 50, moduleName: 'Guest Experience' },
  reports: { limitType: 'users', limitValue: 5, moduleName: 'Reports & BI' },
  staff_management: { limitType: 'staff', limitValue: 20, moduleName: 'Staff Management' },
  events: { limitType: 'bookings', limitValue: 50, moduleName: 'Events / MICE' },
  parking: { limitType: 'devices', limitValue: 100, moduleName: 'Parking Management' },
  surveillance: { limitType: 'devices', limitValue: 10, moduleName: 'Surveillance' },
  iot: { limitType: 'devices', limitValue: 50, moduleName: 'Smart Hotel / IoT' },
};

// =====================================================
// ROUTE
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const baseFeatureIds = getBaseFeatures();
    const addonFeatureIds = getAddonFeatures();
    const addonsBySub = getAddonsBySubcategory();

    // Build base features list
    const baseFeatures = baseFeatureIds.map((id) => {
      const cfg = FEATURES[id];
      return {
        id,
        name: cfg.name,
        description: cfg.description,
        category: cfg.category,
        subcategory: cfg.subcategory ?? null,
        icon: cfg.icon ?? null,
        alwaysEnabled: true,
        locked: true,
        dependencies: cfg.dependencies ?? [],
        menuItems: cfg.menuItems,
        apiRoutes: cfg.apiRoutes,
      };
    });

    // Build addon features grouped by subcategory
    const addonGroups: Array<{
      subcategory: string;
      subcategoryInfo: {
        name: string;
        description: string;
        icon: string;
      };
      features: Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        subcategory: string | undefined;
        icon: string | undefined;
        alwaysEnabled: boolean | undefined;
        locked: boolean;
        dependencies: string[] | undefined;
        menuItems: string[];
        apiRoutes: string[];
        defaultLimits: {
          limitType: string;
          limitValue: number;
          moduleName: string;
        } | null;
      }>;
    }> = [];

    for (const [subcategory, features] of Object.entries(addonsBySub)) {
      const subInfo = (ADDON_SUBCATEGORIES as Record<string, { name: string; description: string; icon: string }>)[subcategory] ?? {
        name: subcategory,
        description: '',
        icon: 'puzzle',
      };

      addonGroups.push({
        subcategory,
        subcategoryInfo: subInfo,
        features: features.map((cfg) => ({
          id: cfg.id,
          name: cfg.name,
          description: cfg.description,
          category: cfg.category,
          subcategory: cfg.subcategory,
          icon: cfg.icon,
          alwaysEnabled: cfg.alwaysEnabled,
          locked: false,
          dependencies: cfg.dependencies,
          menuItems: cfg.menuItems,
          apiRoutes: cfg.apiRoutes,
          defaultLimits: MODULE_DEFAULT_CONFIGS[cfg.id]
            ? {
                limitType: MODULE_DEFAULT_CONFIGS[cfg.id].limitType,
                limitValue: MODULE_DEFAULT_CONFIGS[cfg.id].limitValue,
                moduleName: MODULE_DEFAULT_CONFIGS[cfg.id].moduleName,
              }
            : null,
        })),
      });
    }

    // Flat addon list with limit configs
    const addonFeaturesFlat = addonFeatureIds.map((id) => {
      const cfg = FEATURES[id];
      return {
        id,
        name: cfg.name,
        description: cfg.description,
        category: cfg.category,
        subcategory: cfg.subcategory ?? null,
        icon: cfg.icon ?? null,
        alwaysEnabled: cfg.alwaysEnabled,
        locked: false,
        dependencies: cfg.dependencies ?? [],
        menuItems: cfg.menuItems,
        apiRoutes: cfg.apiRoutes,
        defaultLimits: MODULE_DEFAULT_CONFIGS[id]
          ? {
              limitType: MODULE_DEFAULT_CONFIGS[id].limitType,
              limitValue: MODULE_DEFAULT_CONFIGS[id].limitValue,
              moduleName: MODULE_DEFAULT_CONFIGS[id].moduleName,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        baseFeatures,
        addonFeatures: addonFeaturesFlat,
        addonGroups,
        moduleDefaultConfigs: MODULE_DEFAULT_CONFIGS,
        categoryInfo: {
          base: {
            name: 'Base Modules',
            description: 'Core functionality — always enabled, required for hotel operations',
            locked: true,
          },
          addons: {
            name: 'Addon Modules',
            description: 'Optional features that can be enabled or disabled based on your plan',
            locked: false,
          },
        },
        subcategoryInfo: ADDON_SUBCATEGORIES,
        totalBaseFeatures: baseFeatureIds.length,
        totalAddonFeatures: addonFeatureIds.length,
      },
    });
  } catch (error) {
    console.error('[plan-builder] GET features-catalog error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch features catalog' },
      { status: 500 }
    );
  }
}
