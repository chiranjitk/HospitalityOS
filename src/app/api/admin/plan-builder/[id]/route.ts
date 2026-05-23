/**
 * Plan Builder — Single Plan Operations
 *
 * GET    /api/admin/plan-builder/[id]   — Get one plan with full detail
 * PUT    /api/admin/plan-builder/[id]   — Update plan (partial)
 * DELETE /api/admin/plan-builder/[id]   — Soft-delete (isActive=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import { FEATURES, getBaseFeatures } from '@/lib/feature-flags';
import type { FeatureConfig } from '@/lib/feature-flags';
import {
  parseFeatures,
  serializeFeatures,
  enrichPlan,
  type PlanFeaturesPayload,
  type PlanCreateBody,
} from '../route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =====================================================
// HELPERS
// =====================================================

/** Find plan by UUID id or by name slug */
async function findPlan(idOrName: string) {
  // Try UUID first, then fall back to name lookup
  const byId = await db.registrationPlan.findFirst({
    where: { id: idOrName },
    include: { _count: { select: { licenseKeys: true } } },
  });
  if (byId) return byId;

  return db.registrationPlan.findFirst({
    where: { name: idOrName },
    include: { _count: { select: { licenseKeys: true } } },
  });
}

function buildAllAvailableFeatures() {
  return Object.entries(FEATURES).map(([id, config]) => ({ id, config }));
}

// =====================================================
// GET — Single plan
// =====================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const plan = await findPlan(id);
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const subscriberCount = await db.tenant.count({
      where: { plan: plan.name, deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      data: enrichPlan(plan, subscriberCount, buildAllAvailableFeatures()),
    });
  } catch (error) {
    console.error('[plan-builder] GET [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT — Update plan
// =====================================================

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const existing = await findPlan(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const body: Partial<PlanCreateBody> = await request.json();

    // ── Validate ──
    if (body.displayName !== undefined && (!body.displayName || typeof body.displayName !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'displayName must be a non-empty string' },
        { status: 400 }
      );
    }
    if (body.monthlyPrice !== undefined && (typeof body.monthlyPrice !== 'number' || body.monthlyPrice < 0)) {
      return NextResponse.json(
        { success: false, error: 'monthlyPrice must be a non-negative number' },
        { status: 400 }
      );
    }
    if (body.maxProperties !== undefined && (typeof body.maxProperties !== 'number' || body.maxProperties < 1)) {
      return NextResponse.json(
        { success: false, error: 'maxProperties must be at least 1' },
        { status: 400 }
      );
    }
    if (body.maxUsers !== undefined && (typeof body.maxUsers !== 'number' || body.maxUsers < 1)) {
      return NextResponse.json(
        { success: false, error: 'maxUsers must be at least 1' },
        { status: 400 }
      );
    }

    // ── Check for name uniqueness if changing ──
    if (body.name && body.name !== existing.name) {
      const conflict = await db.registrationPlan.findFirst({
        where: { name: body.name },
        select: { id: true },
      });
      if (conflict && conflict.id !== existing.id) {
        return NextResponse.json(
          { success: false, error: `Plan with name "${body.name}" already exists` },
          { status: 409 }
        );
      }
    }

    // ── Build update data for scalar columns ──
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.displayName !== undefined) updateData.displayName = body.displayName.trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.monthlyPrice !== undefined) updateData.price = body.monthlyPrice;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.maxProperties !== undefined) updateData.maxProperties = body.maxProperties;
    if (body.maxUsers !== undefined) updateData.maxUsers = body.maxUsers;
    if (body.maxRoomsPerProperty !== undefined) updateData.maxRoomsPerProperty = body.maxRoomsPerProperty;
    if (body.maxStaff !== undefined) updateData.maxStaff = body.maxStaff;
    if (body.trialDays !== undefined) updateData.trialDays = body.trialDays;
    if (body.isPopular !== undefined) updateData.highlighted = body.isPopular;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    // ── Build features payload (merge with existing) ──
    const currentPayload = parseFeatures(existing.features);

    if (body.features !== undefined) {
      const baseFeatures = getBaseFeatures();
      const requested = body.features.filter((f) => FEATURES[f]);
      currentPayload.enabled = [...new Set([...baseFeatures, ...requested])];
    }

    if (body.yearlyPrice !== undefined) currentPayload.yearlyPrice = body.yearlyPrice;
    if (body.deploymentType !== undefined) currentPayload.deploymentType = body.deploymentType;
    if (body.setupFee !== undefined) currentPayload.setupFee = body.setupFee;
    if (body.storageLimitMb !== undefined) currentPayload.storageLimitMb = body.storageLimitMb;
    if (body.isCustom !== undefined) currentPayload.isCustom = body.isCustom;
    if (body.addonPricing !== undefined) currentPayload.addonPricing = body.addonPricing;
    if (body.limits !== undefined) currentPayload.limits = body.limits;

    updateData.features = serializeFeatures(currentPayload);

    // ── Update plan ──
    const updated = await db.registrationPlan.update({
      where: { id: existing.id },
      data: updateData,
      include: { _count: { select: { licenseKeys: true } } },
    });

    // ── Cascade limit changes to active tenants if requested ──
    const shouldCascade = (request.nextUrl.searchParams.get('cascade') ?? 'true') === 'true';
    let updatedTenantCount = 0;

    if (shouldCascade) {
      const tenantUpdate: Record<string, unknown> = {};
      if (body.maxProperties !== undefined) tenantUpdate.maxProperties = body.maxProperties;
      if (body.maxUsers !== undefined) tenantUpdate.maxUsers = body.maxUsers;
      if (body.maxRoomsPerProperty !== undefined) tenantUpdate.maxRooms = body.maxRoomsPerProperty;

      const hasLimitChanges = Object.keys(tenantUpdate).length > 0;
      if (hasLimitChanges) {
        const result = await db.tenant.updateMany({
          where: { plan: existing.name, deletedAt: null },
          data: tenantUpdate,
        });
        updatedTenantCount = result.count;
      }

      // If features changed, update tenant.features for all tenants on this plan
      if (body.features !== undefined) {
        const featureFlagsObj: Record<string, boolean> = {};
        for (const fid of currentPayload.enabled) {
          featureFlagsObj[fid] = true;
        }
        const ffResult = await db.tenant.updateMany({
          where: { plan: existing.name, deletedAt: null },
          data: { features: JSON.stringify(featureFlagsObj) },
        });
        if (ffResult.count > 0) updatedTenantCount = ffResult.count;
      }
    }

    const subscriberCount = await db.tenant.count({
      where: { plan: updated.name, deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      data: enrichPlan(updated, subscriberCount, buildAllAvailableFeatures()),
      message: `Plan updated successfully${updatedTenantCount > 0 ? ` (${updatedTenantCount} tenant(s) updated)` : ''}`,
    });
  } catch (error) {
    console.error('[plan-builder] PUT [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE — Soft-delete plan
// =====================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const existing = await findPlan(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    // ── Check for active tenants on this plan ──
    const activeTenants = await db.tenant.findMany({
      where: { plan: existing.name, deletedAt: null },
      select: { id: true, name: true },
    });

    if (activeTenants.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete plan "${existing.displayName}" — ${activeTenants.length} active tenant(s) still assigned`,
          data: { tenants: activeTenants.map((t) => ({ id: t.id, name: t.name })) },
        },
        { status: 409 }
      );
    }

    // ── Check for unused but unexpired license keys ──
    const activeKeys = await db.licenseKey.count({
      where: {
        planId: existing.id,
        status: { in: ['active', 'activated'] },
      },
    });

    if (activeKeys > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete plan "${existing.displayName}" — ${activeKeys} active license key(s) still exist`,
          data: { activeLicenseKeys: activeKeys },
        },
        { status: 409 }
      );
    }

    // ── Soft-delete ──
    await db.registrationPlan.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Plan "${existing.displayName}" deleted successfully`,
    });
  } catch (error) {
    console.error('[plan-builder] DELETE [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
