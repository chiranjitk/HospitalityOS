import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  calculateHourlyRate,
  runHourlyPricingCycle,
  getCachedRates,
  clearRateCache,
  getLinearPricingConfig,
  setLinearPricingConfig,
  getOccupancyTiers,
  type SensitivityLevel,
} from '@/lib/revenue/hourly-pricing-engine';

// GET /api/revenue/hourly-pricing — Get current hourly rates for a property
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  const tenantId = user.tenantId;
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  const roomTypeId = searchParams.get('roomTypeId');

  if (!propertyId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
      { status: 400 }
    );
  }

  try {
    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true, name: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Get cached rates
    const cachedRates = getCachedRates(tenantId, propertyId);

    // If filtering by room type
    const filteredRates = roomTypeId
      ? cachedRates.filter(r => r.roomTypeId === roomTypeId)
      : cachedRates;

    // If no cached rates, calculate on-demand for requested room types
    let rates = [...filteredRates];
    if (rates.length === 0) {
      const roomTypes = roomTypeId
        ? await db.roomType.findMany({
            where: { id: roomTypeId, propertyId, status: 'active', deletedAt: null },
            select: { id: true },
          })
        : await db.roomType.findMany({
            where: { propertyId, status: 'active', deletedAt: null },
            select: { id: true },
          });

      for (const rt of roomTypes) {
        try {
          const result = await calculateHourlyRate(tenantId, propertyId, rt.id);
          rates.push({
            roomTypeId: rt.id,
            rate: result.newRate,
            trigger: result.trigger,
            confidence: result.confidence,
            calculatedAt: result.timestamp,
            occupancyAtCalc: 0,
          });
        } catch {
          // Skip room types that fail
        }
      }
    }

    // Get linear pricing config
    const config = await getLinearPricingConfig(tenantId, propertyId);

    // Get occupancy tiers
    const tiers = getOccupancyTiers();

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        propertyName: property.name,
        rates,
        config: {
          enabled: config.enabled,
          sensitivity: config.sensitivity,
          perRoomIncrement: config.perRoomIncrement,
        },
        tiers,
        totalRates: rates.length,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching hourly rates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch hourly rates' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/hourly-pricing — Trigger hourly pricing cycle or configure settings
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  if (!hasPermission(user, 'revenue:write')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  const tenantId = user.tenantId;
  const body = await request.json();
  const { propertyId, roomTypeId, sensitivity, enabled, action } = body;

  try {
    // Determine action
    if (action === 'configure') {
      // Configure hourly pricing settings
      if (!propertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
          { status: 400 }
        );
      }

      const configUpdate: Record<string, unknown> = {};
      if (sensitivity && ['conservative', 'moderate', 'aggressive'].includes(sensitivity)) {
        configUpdate.sensitivity = sensitivity;
      }
      if (typeof enabled === 'boolean') {
        configUpdate.enabled = enabled;
      }

      const updatedConfig = await setLinearPricingConfig(tenantId, propertyId, configUpdate);

      return NextResponse.json({
        success: true,
        data: {
          configured: true,
          propertyId,
          config: updatedConfig,
        },
      });
    }

    if (action === 'clear_cache') {
      // Clear rate cache
      clearRateCache(tenantId, propertyId, roomTypeId);

      return NextResponse.json({
        success: true,
        data: {
          cleared: true,
          propertyId: propertyId || 'all',
          roomTypeId: roomTypeId || 'all',
        },
      });
    }

    // Default action: run hourly pricing cycle
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required to run pricing cycle' } },
        { status: 400 }
      );
    }

    // Validate sensitivity if provided
    const sensitivityOverride = sensitivity && ['conservative', 'moderate', 'aggressive'].includes(sensitivity)
      ? sensitivity as SensitivityLevel
      : undefined;

    // Run the hourly pricing cycle
    const result = await runHourlyPricingCycle(
      tenantId,
      propertyId,
      sensitivityOverride
    );

    return NextResponse.json({
      success: result.ratesChanged >= 0,
      data: result,
    });
  } catch (error) {
    console.error('Error running hourly pricing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run hourly pricing cycle' } },
      { status: 500 }
    );
  }
}

// ============================================================
// Auth & Permission Helpers (inlined to avoid circular deps)
// ============================================================

import { getUserFromRequest, hasPermission as checkPermission } from '@/lib/auth-helpers';

async function requireAuth(request: NextRequest) {
  return getUserFromRequest(request);
}

function hasPermission(user: Awaited<ReturnType<typeof getUserFromRequest>>, permission: string): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  if (user.roleName === 'admin' || user.permissions.includes('*')) return true;
  return user.permissions.includes(permission);
}
