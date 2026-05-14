/**
 * License Enforcement Library for StaySuite HospitalityOS
 *
 * Server-side utility for checking, enforcing, and tracking module-level
 * license limits. Integrates with LicenseModuleEntitlement and
 * LicenseUsageLog Prisma models.
 */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { FEATURES } from './feature-flags';
import cache from './cache';

// =====================================================
// TYPES
// =====================================================

export interface LicenseCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percent: number;
  isUnlimited: boolean;
  isWarning: boolean;
  isExceeded: boolean;
  moduleKey: string;
  moduleName: string;
  hardLimit: boolean;
  entitlementId?: string;
}

export interface LicenseOverview {
  baseLimits: {
    rooms: LicenseCheckResult;
    properties: LicenseCheckResult;
    users: LicenseCheckResult;
  };
  entitlements: LicenseCheckResult[];
  warnings: LicenseCheckResult[];
  exceeded: LicenseCheckResult[];
  plan: string;
  tenantId: string;
}

// =====================================================
// DEFAULT MODULE ENTITLEMENT CONFIGS
// =====================================================

interface ModuleDefaultConfig {
  limitType: string;
  limitValue: number;
  moduleName: string;
  billingDimension?: string;
}

const MODULE_DEFAULTS: Record<string, ModuleDefaultConfig> = {
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
// CACHE HELPERS (30s TTL)
// =====================================================

const CACHE_TTL_SECONDS = 30;

function cacheKey(tenantId: string, moduleKey: string): string {
  return `license:entitlement:${tenantId}:${moduleKey}`;
}

function getCachedEntitlement(tenantId: string, moduleKey: string) {
  return cache.get<LicenseCheckResult>(cacheKey(tenantId, moduleKey));
}

function setCachedEntitlement(tenantId: string, moduleKey: string, result: LicenseCheckResult) {
  cache.set(cacheKey(tenantId, moduleKey), result, CACHE_TTL_SECONDS);
}

function invalidateCache(tenantId: string, moduleKey: string) {
  cache.delete(cacheKey(tenantId, moduleKey));
}

// =====================================================
// CORE FUNCTIONS
// =====================================================

/**
 * Check if a specific module's usage is within license limits
 */
export async function checkModuleLimit(
  tenantId: string,
  moduleKey: string
): Promise<LicenseCheckResult> {
  // Check cache first
  const cached = getCachedEntitlement(tenantId, moduleKey);
  if (cached) return cached;

  const entitlement = await db.licenseModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });

  if (!entitlement || !entitlement.isValid) {
    // No entitlement = unlimited (not enforced)
    const result: LicenseCheckResult = {
      allowed: true,
      current: 0,
      limit: 0,
      percent: 0,
      isUnlimited: true,
      isWarning: false,
      isExceeded: false,
      moduleKey,
      moduleName: FEATURES[moduleKey as keyof typeof FEATURES]?.name || moduleKey,
      hardLimit: true,
    };
    setCachedEntitlement(tenantId, moduleKey, result);
    return result;
  }

  const isUnlimited = entitlement.limitValue === 0;
  const percent = isUnlimited ? 0 : (entitlement.currentUsage / entitlement.limitValue) * 100;
  const isWarning = !isUnlimited && percent >= entitlement.warningThreshold * 100;
  const isExceeded = !isUnlimited && entitlement.currentUsage > entitlement.limitValue;
  const allowed = isUnlimited || !isExceeded || !entitlement.hardLimit;

  const result: LicenseCheckResult = {
    allowed,
    current: entitlement.currentUsage,
    limit: entitlement.limitValue,
    percent: Math.round(percent * 100) / 100,
    isUnlimited,
    isWarning,
    isExceeded,
    moduleKey,
    moduleName: entitlement.moduleName,
    hardLimit: entitlement.hardLimit,
    entitlementId: entitlement.id,
  };

  setCachedEntitlement(tenantId, moduleKey, result);
  return result;
}

/**
 * Check room count against Tenant.maxRooms (PMS base module)
 */
export async function checkRoomLimit(tenantId: string): Promise<LicenseCheckResult> {
  // Check cache first
  const cached = getCachedEntitlement(tenantId, '__rooms__');
  if (cached) return cached;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId, deletedAt: null },
    select: { maxRooms: true },
  });

  const limit = tenant?.maxRooms ?? 50;

  const current = await db.room.count({
    where: {
      property: { tenantId },
      deletedAt: null,
    },
  });

  const isUnlimited = limit === 0;
  const percent = isUnlimited ? 0 : (current / limit) * 100;
  const isWarning = !isUnlimited && percent >= 80;
  const isExceeded = !isUnlimited && current > limit;

  const result: LicenseCheckResult = {
    allowed: !isExceeded,
    current,
    limit,
    percent: Math.round(percent * 100) / 100,
    isUnlimited,
    isWarning,
    isExceeded,
    moduleKey: 'pms',
    moduleName: 'Property Management (Rooms)',
    hardLimit: true,
  };

  setCachedEntitlement(tenantId, '__rooms__', result);
  return result;
}

/**
 * Check concurrent users (active WiFiSessions for gateway enforcement)
 */
export async function checkConcurrentUsers(tenantId: string): Promise<LicenseCheckResult> {
  // Check cache first
  const cached = getCachedEntitlement(tenantId, 'wifi');
  if (cached) return cached;

  const entitlement = await db.licenseModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey: 'wifi' } },
  });

  // Count active WiFi sessions
  const current = await db.wiFiSession.count({
    where: {
      tenantId,
      status: 'active',
      endTime: null,
    },
  });

  // If no wifi entitlement, use unlimited
  if (!entitlement || !entitlement.isValid) {
    const result: LicenseCheckResult = {
      allowed: true,
      current,
      limit: 0,
      percent: 0,
      isUnlimited: true,
      isWarning: false,
      isExceeded: false,
      moduleKey: 'wifi',
      moduleName: 'WiFi & Network',
      hardLimit: true,
    };
    setCachedEntitlement(tenantId, 'wifi', result);
    return result;
  }

  const isUnlimited = entitlement.limitValue === 0;
  const percent = isUnlimited ? 0 : (current / entitlement.limitValue) * 100;
  const isWarning = !isUnlimited && percent >= entitlement.warningThreshold * 100;
  const isExceeded = !isUnlimited && current > entitlement.limitValue;
  const allowed = isUnlimited || !isExceeded || !entitlement.hardLimit;

  // Update current usage in real time
  await db.licenseModuleEntitlement.update({
    where: { id: entitlement.id },
    data: {
      currentUsage: current,
      peakUsage: Math.max(entitlement.peakUsage, current),
    },
  });

  const result: LicenseCheckResult = {
    allowed,
    current,
    limit: entitlement.limitValue,
    percent: Math.round(percent * 100) / 100,
    isUnlimited,
    isWarning,
    isExceeded,
    moduleKey: 'wifi',
    moduleName: entitlement.moduleName,
    hardLimit: entitlement.hardLimit,
    entitlementId: entitlement.id,
  };

  setCachedEntitlement(tenantId, 'wifi', result);
  return result;
}

/**
 * Increment usage counter for a module
 */
export async function incrementUsage(
  tenantId: string,
  moduleKey: string,
  amount: number = 1
): Promise<void> {
  const entitlement = await db.licenseModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });

  if (!entitlement) return;

  await db.licenseModuleEntitlement.update({
    where: { id: entitlement.id },
    data: {
      currentUsage: { increment: amount },
      peakUsage: Math.max(entitlement.peakUsage, entitlement.currentUsage + amount),
    },
  });

  invalidateCache(tenantId, moduleKey);
}

/**
 * Decrement usage counter for a module
 */
export async function decrementUsage(
  tenantId: string,
  moduleKey: string,
  amount: number = 1
): Promise<void> {
  const entitlement = await db.licenseModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });

  if (!entitlement) return;

  const newUsage = Math.max(0, entitlement.currentUsage - amount);

  await db.licenseModuleEntitlement.update({
    where: { id: entitlement.id },
    data: { currentUsage: newUsage },
  });

  invalidateCache(tenantId, moduleKey);
}

/**
 * Refresh usage counter from actual data source
 * For wifi: count active WiFi sessions
 * For other modules: leave as-is (manual tracking)
 */
export async function refreshUsage(
  tenantId: string,
  moduleKey: string
): Promise<void> {
  const entitlement = await db.licenseModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  });

  if (!entitlement) return;

  let currentUsage = entitlement.currentUsage;

  if (moduleKey === 'wifi') {
    // Recount active WiFi sessions
    currentUsage = await db.wiFiSession.count({
      where: {
        tenantId,
        status: 'active',
        endTime: null,
      },
    });
  }

  const newPeak = Math.max(entitlement.peakUsage, currentUsage);

  await db.licenseModuleEntitlement.update({
    where: { id: entitlement.id },
    data: {
      currentUsage,
      peakUsage: newPeak,
    },
  });

  // Log usage snapshot
  const isUnlimited = entitlement.limitValue === 0;
  const usagePercent = isUnlimited ? 0 : (currentUsage / entitlement.limitValue) * 100;

  await db.licenseUsageLog.create({
    data: {
      tenantId,
      entitlementId: entitlement.id,
      moduleKey,
      usageValue: currentUsage,
      limitValue: entitlement.limitValue,
      usagePercent: Math.round(usagePercent * 100) / 100,
    },
  });

  invalidateCache(tenantId, moduleKey);
}

/**
 * Middleware-style check that returns 403 if license exceeded
 * Returns null if allowed (caller should proceed)
 */
export async function requireLicense(
  moduleKey: string,
  tenantId: string
): Promise<NextResponse | null> {
  const check = await checkModuleLimit(tenantId, moduleKey);

  if (!check.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `License limit exceeded for ${check.moduleName}`,
        code: 'LICENSE_EXCEEDED',
        details: {
          moduleKey: check.moduleKey,
          current: check.current,
          limit: check.limit,
          percent: check.percent,
        },
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get full license overview for tenant dashboard
 */
export async function getTenantLicenseOverview(tenantId: string): Promise<LicenseOverview> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId, deletedAt: null },
    select: { plan: true, maxRooms: true, maxProperties: true, maxUsers: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Check base limits
  const roomCheck = await checkRoomLimit(tenantId);

  // Count properties
  const propertyCount = await db.property.count({
    where: { tenantId, deletedAt: null },
  });
  const propertyLimit = tenant.maxProperties;
  const propertyIsUnlimited = propertyLimit === 0;
  const propertyPercent = propertyIsUnlimited ? 0 : (propertyCount / propertyLimit) * 100;
  const propertiesCheck: LicenseCheckResult = {
    allowed: propertyIsUnlimited || propertyCount <= propertyLimit,
    current: propertyCount,
    limit: propertyLimit,
    percent: Math.round(propertyPercent * 100) / 100,
    isUnlimited: propertyIsUnlimited,
    isWarning: !propertyIsUnlimited && propertyPercent >= 80,
    isExceeded: !propertyIsUnlimited && propertyCount > propertyLimit,
    moduleKey: 'pms',
    moduleName: 'Properties',
    hardLimit: true,
  };

  // Count users
  const userCount = await db.user.count({
    where: { tenantId, deletedAt: null, status: 'active' },
  });
  const userLimit = tenant.maxUsers;
  const userIsUnlimited = userLimit === 0;
  const userPercent = userIsUnlimited ? 0 : (userCount / userLimit) * 100;
  const usersCheck: LicenseCheckResult = {
    allowed: userIsUnlimited || userCount <= userLimit,
    current: userCount,
    limit: userLimit,
    percent: Math.round(userPercent * 100) / 100,
    isUnlimited: userIsUnlimited,
    isWarning: !userIsUnlimited && userPercent >= 80,
    isExceeded: !userIsUnlimited && userCount > userLimit,
    moduleKey: 'admin',
    moduleName: 'Users',
    hardLimit: true,
  };

  // Check all entitlements
  const entitlements = await db.licenseModuleEntitlement.findMany({
    where: { tenantId, isValid: true },
    orderBy: { moduleKey: 'asc' },
  });

  const moduleChecks: LicenseCheckResult[] = [];
  for (const ent of entitlements) {
    const check = await checkModuleLimit(tenantId, ent.moduleKey);
    moduleChecks.push(check);
  }

  const warnings = [...moduleChecks.filter(m => m.isWarning)];
  const exceeded = [...moduleChecks.filter(m => m.isExceeded)];

  // Also check base limits for warnings
  if (roomCheck.isWarning) warnings.push(roomCheck);
  if (roomCheck.isExceeded) exceeded.push(roomCheck);
  if (propertiesCheck.isWarning) warnings.push(propertiesCheck);
  if (propertiesCheck.isExceeded) exceeded.push(propertiesCheck);
  if (usersCheck.isWarning) warnings.push(usersCheck);
  if (usersCheck.isExceeded) exceeded.push(usersCheck);

  return {
    baseLimits: {
      rooms: roomCheck,
      properties: propertiesCheck,
      users: usersCheck,
    },
    entitlements: moduleChecks,
    warnings,
    exceeded,
    plan: tenant.plan || 'trial',
    tenantId,
  };
}

/**
 * Seed default entitlements for enabled addon modules.
 * Called when feature flags are updated.
 */
export async function seedEntitlements(
  tenantId: string,
  moduleKeys: string[]
): Promise<{ seeded: string[]; skipped: string[] }> {
  const seeded: string[] = [];
  const skipped: string[] = [];

  for (const key of moduleKeys) {
    const config = MODULE_DEFAULTS[key];
    if (!config) {
      skipped.push(key);
      continue;
    }

    // Check if entitlement already exists
    const existing = await db.licenseModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
    });

    if (existing) {
      skipped.push(key);
      continue;
    }

    // Create default entitlement
    await db.licenseModuleEntitlement.create({
      data: {
        tenantId,
        moduleKey: key,
        moduleName: config.moduleName,
        limitType: config.limitType,
        limitValue: config.limitValue,
        warningThreshold: 0.8,
        hardLimit: true,
        billingDimension: config.billingDimension || null,
        currentUsage: 0,
        peakUsage: 0,
        isValid: true,
      },
    });

    seeded.push(key);
    invalidateCache(tenantId, key);
  }

  return { seeded, skipped };
}

/**
 * Get usage history for a module (for charts)
 */
export async function getUsageHistory(
  tenantId: string,
  moduleKey: string,
  days: number = 30
): Promise<Array<{ sampledAt: string; usageValue: number; limitValue: number; usagePercent: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await db.licenseUsageLog.findMany({
    where: {
      tenantId,
      moduleKey,
      sampledAt: { gte: since },
    },
    orderBy: { sampledAt: 'asc' },
    select: {
      sampledAt: true,
      usageValue: true,
      limitValue: true,
      usagePercent: true,
    },
  });

  return logs.map(log => ({
    sampledAt: log.sampledAt.toISOString(),
    usageValue: log.usageValue,
    limitValue: log.limitValue,
    usagePercent: log.usagePercent,
  }));
}
