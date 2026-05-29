import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  getLinearPricingConfig,
  setLinearPricingConfig,
  getOccupancyTiers,
  calculateLinearOccupancyPrice,
  type LinearPricingConfig,
} from '@/lib/revenue/hourly-pricing-engine';

// GET /api/revenue/linear-pricing — Get linear pricing configuration for a property
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true, name: true, totalRooms: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Get current config
    const config = await getLinearPricingConfig(tenantId, propertyId);

    // Get occupancy tiers
    const tiers = getOccupancyTiers();

    // Build response with per-room pricing examples
    const totalRooms = property.totalRooms || 50;
    const basePrice = await getAverageBasePrice(tenantId, propertyId);
    const priceExamples = buildPriceExamples(config, totalRooms, basePrice);

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        propertyName: property.name,
        totalRooms,
        basePrice,
        config: {
          enabled: config.enabled,
          sensitivity: config.sensitivity,
          floorMultipliers: config.floorMultipliers,
          ceilingMultipliers: config.ceilingMultipliers,
          perRoomIncrement: config.perRoomIncrement,
        },
        tiers,
        priceExamples,
        revenueProjection: calculateRevenueProjection(config, totalRooms, basePrice),
      },
    });
  } catch (error) {
    console.error('Error fetching linear pricing config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch linear pricing config' } },
      { status: 500 }
    );
  }
}

// PUT /api/revenue/linear-pricing — Update linear pricing settings
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;
    const body = await request.json();
    const { propertyId, floorMultipliers, ceilingMultipliers, sensitivity, enabled, perRoomIncrement } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    // Validate floor multipliers if provided
    if (floorMultipliers) {
      const validation = validateMultipliers(floorMultipliers, 'floor');
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error } },
          { status: 400 }
        );
      }
    }

    // Validate ceiling multipliers if provided
    if (ceilingMultipliers) {
      const validation = validateMultipliers(ceilingMultipliers, 'ceiling');
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error } },
          { status: 400 }
        );
      }
    }

    // Validate ceiling > floor for each tier if both are provided
    if (floorMultipliers && ceilingMultipliers) {
      for (const tier of ['low', 'medium', 'high', 'premium', 'lastRoom'] as const) {
        if (ceilingMultipliers[tier] <= floorMultipliers[tier]) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: `Ceiling must be greater than floor for tier "${tier}"` } },
            { status: 400 }
          );
        }
      }
    }

    // Validate sensitivity if provided
    if (sensitivity && !['conservative', 'moderate', 'aggressive'].includes(sensitivity)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Sensitivity must be conservative, moderate, or aggressive' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Build config update
    const configUpdate: Partial<LinearPricingConfig> = {};
    if (floorMultipliers) configUpdate.floorMultipliers = floorMultipliers;
    if (ceilingMultipliers) configUpdate.ceilingMultipliers = ceilingMultipliers;
    if (sensitivity) configUpdate.sensitivity = sensitivity;
    if (typeof enabled === 'boolean') configUpdate.enabled = enabled;
    if (typeof perRoomIncrement === 'boolean') configUpdate.perRoomIncrement = perRoomIncrement;

    // Update config
    const updatedConfig = await setLinearPricingConfig(tenantId, propertyId, configUpdate);

    // Build updated price examples
    const totalRooms = await getPropertyTotalRooms(tenantId, propertyId);
    const basePrice = await getAverageBasePrice(tenantId, propertyId);
    const priceExamples = buildPriceExamples(updatedConfig, totalRooms, basePrice);

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        propertyId,
        config: {
          enabled: updatedConfig.enabled,
          sensitivity: updatedConfig.sensitivity,
          floorMultipliers: updatedConfig.floorMultipliers,
          ceilingMultipliers: updatedConfig.ceilingMultipliers,
          perRoomIncrement: updatedConfig.perRoomIncrement,
        },
        priceExamples,
        revenueProjection: calculateRevenueProjection(updatedConfig, totalRooms, basePrice),
      },
    });
  } catch (error) {
    console.error('Error updating linear pricing config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update linear pricing config' } },
      { status: 500 }
    );
  }
}

// ============================================================
// Helper Functions
// ============================================================

function validateMultipliers(
  multipliers: Record<string, number>,
  type: 'floor' | 'ceiling'
): { valid: boolean; error?: string } {
  const requiredKeys = ['low', 'medium', 'high', 'premium', 'lastRoom'];
  for (const key of requiredKeys) {
    if (multipliers[key] === undefined || multipliers[key] === null) {
      return { valid: false, error: `Missing ${type} multiplier for tier "${key}"` };
    }
    if (typeof multipliers[key] !== 'number' || isNaN(multipliers[key])) {
      return { valid: false, error: `${type} multiplier for tier "${key}" must be a number` };
    }
    if (multipliers[key] < 0.5 || multipliers[key] > 3.0) {
      return { valid: false, error: `${type} multiplier for tier "${key}" must be between 0.5 and 3.0` };
    }
  }
  return { valid: true };
}

async function getPropertyTotalRooms(tenantId: string, propertyId: string): Promise<number> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { totalRooms: true },
  });
  return property?.totalRooms || 50;
}

async function getAverageBasePrice(tenantId: string, propertyId: string): Promise<number> {
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, status: 'active', deletedAt: null },
    select: { basePrice: true },
  });
  if (roomTypes.length === 0) return 150; // Default
  return roomTypes.reduce((sum, rt) => sum + rt.basePrice, 0) / roomTypes.length;
}

/**
 * Build example prices at different occupancy levels for preview.
 */
function buildPriceExamples(
  config: LinearPricingConfig,
  totalRooms: number,
  basePrice: number
): Array<{
  roomsSold: number;
  occupancyPercent: number;
  tier: string;
  price: number;
  changeFromBase: number;
  changePercent: number;
}> {
  if (!config.enabled) return [];

  const examples: Array<{
    roomsSold: number;
    occupancyPercent: number;
    tier: string;
    price: number;
    changeFromBase: number;
    changePercent: number;
  }> = [];

  // Sample at key occupancy levels
  const sampleLevels = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 98, 99, 100];

  for (const level of sampleLevels) {
    const roomsSold = Math.round((level / 100) * totalRooms);
    const price = calculateLinearOccupancyPrice(
      'preview',
      'preview',
      'preview',
      roomsSold,
      totalRooms,
      basePrice,
      config
    );

    // Determine tier
    let tier = 'low';
    if (level >= 95) tier = 'lastRoom';
    else if (level >= 80) tier = 'premium';
    else if (level >= 60) tier = 'high';
    else if (level >= 30) tier = 'medium';

    examples.push({
      roomsSold,
      occupancyPercent: level,
      tier,
      price,
      changeFromBase: Math.round((price - basePrice) * 100) / 100,
      changePercent: basePrice > 0 ? Math.round(((price - basePrice) / basePrice) * 10000) / 100 : 0,
    });
  }

  return examples;
}

/**
 * Calculate revenue projection comparing flat vs linear pricing.
 */
function calculateRevenueProjection(
  config: LinearPricingConfig,
  totalRooms: number,
  basePrice: number
): {
  flatRevenue: number;
  linearRevenue: number;
  improvement: number;
  improvementPercent: number;
} {
  if (!config.enabled || totalRooms === 0) {
    return { flatRevenue: basePrice * totalRooms, linearRevenue: basePrice * totalRooms, improvement: 0, improvementPercent: 0 };
  }

  // Assume 75% average occupancy for projection
  const avgOccupancy = 0.75;
  const roomsSold = Math.round(avgOccupancy * totalRooms);

  const flatRevenue = basePrice * roomsSold;

  // Calculate average linear price across all rooms sold
  let linearTotal = 0;
  for (let i = 1; i <= roomsSold; i++) {
    linearTotal += calculateLinearOccupancyPrice(
      'projection',
      'projection',
      'projection',
      i,
      totalRooms,
      basePrice,
      config
    );
  }

  const linearRevenue = linearTotal;
  const improvement = linearRevenue - flatRevenue;
  const improvementPercent = flatRevenue > 0 ? (improvement / flatRevenue) * 100 : 0;

  return {
    flatRevenue: Math.round(flatRevenue * 100) / 100,
    linearRevenue: Math.round(linearRevenue * 100) / 100,
    improvement: Math.round(improvement * 100) / 100,
    improvementPercent: Math.round(improvementPercent * 100) / 100,
  };
}
