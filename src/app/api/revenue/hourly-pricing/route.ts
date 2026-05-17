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
  calculateLinearOccupancyPrice,
  type SensitivityLevel,
} from '@/lib/revenue/hourly-pricing-engine';

// GET /api/revenue/hourly-pricing — Get current hourly rates for a property
// Supports ?detail=rooms to get per-room pricing data
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
  const detail = searchParams.get('detail');

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

    // Per-room detail mode for linear pricing page
    if (detail === 'rooms') {
      return await handleRoomDetail(tenantId, propertyId, roomTypeId);
    }

    // Default: room-type level rates
    const cachedRates = getCachedRates(tenantId, propertyId);

    const filteredRates = roomTypeId
      ? cachedRates.filter(r => r.roomTypeId === roomTypeId)
      : cachedRates;

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

    const config = await getLinearPricingConfig(tenantId, propertyId);
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

// PUT /api/revenue/hourly-pricing — Update pricing for a specific room
export async function PUT(request: NextRequest) {
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
  const { roomId, price, suggestedPrice, propertyId } = body;

  if (!roomId || price === undefined) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomId and price are required' } },
      { status: 400 }
    );
  }

  try {
    // Find the room and verify it belongs to the tenant's property
    const room = await db.room.findUnique({
      where: { id: roomId, deletedAt: null },
      include: {
        roomType: { select: { id: true, name: true, basePrice: true, totalRooms: true } },
        property: { select: { id: true, tenantId: true } },
      },
    });

    if (!room || room.property.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    const oldPrice = room.roomType.basePrice;
    const newPrice = Math.round(Number(price) * 100) / 100;

    // Update the room type's base price
    await db.roomType.update({
      where: { id: room.roomTypeId },
      data: { basePrice: newPrice },
    });

    // Clear rate cache for this room type
    clearRateCache(tenantId, room.propertyId, room.roomTypeId);

    // Record the price change in audit log
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'revenue',
        action: 'manual_price_update',
        entityType: 'Room',
        entityId: roomId,
        oldValue: JSON.stringify({ price: oldPrice, roomNumber: room.number }),
        newValue: JSON.stringify({
          price: newPrice,
          suggestedPrice: suggestedPrice ?? null,
          roomNumber: room.number,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        roomId,
        roomNumber: room.number,
        previousPrice: oldPrice,
        newPrice,
        suggestedPrice: suggestedPrice ?? null,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating room pricing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update room pricing' } },
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

    const sensitivityOverride = sensitivity && ['conservative', 'moderate', 'aggressive'].includes(sensitivity)
      ? sensitivity as SensitivityLevel
      : undefined;

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
// Per-Room Detail Handler
// ============================================================

async function handleRoomDetail(
  tenantId: string,
  propertyId: string,
  roomTypeIdFilter?: string | null
) {
  // Get linear pricing config
  const config = await getLinearPricingConfig(tenantId, propertyId);

  // Fetch all rooms for this property
  const where: Record<string, unknown> = {
    propertyId,
    deletedAt: null,
  };
  if (roomTypeIdFilter) {
    where.roomTypeId = roomTypeIdFilter;
  }

  const rooms = await db.room.findMany({
    where,
    include: {
      roomType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          totalRooms: true,
        },
      },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  // Calculate occupancy per room type
  const roomTypeOccupancy = new Map<string, { sold: number; total: number }>();

  for (const room of rooms) {
    const rtId = room.roomTypeId;
    if (!roomTypeOccupancy.has(rtId)) {
      const total = room.roomType.totalRooms || 1;
      // Count bookings for this room type
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const sold = await db.booking.count({
        where: {
          tenantId,
          propertyId,
          roomTypeId: rtId,
          checkIn: { lte: todayEnd },
          checkOut: { gt: todayStart },
          status: { in: ['confirmed', 'reserved', 'checked_in'] },
          deletedAt: null,
        },
      });

      roomTypeOccupancy.set(rtId, { sold, total });
    }
  }

  // Calculate suggested price per room type
  const roomTypeSuggestedPrice = new Map<string, number>();

  for (const [rtId, occ] of roomTypeOccupancy) {
    try {
      const roomType = rooms.find(r => r.roomTypeId === rtId)?.roomType;
      if (!roomType) continue;

      if (config.enabled) {
        const suggestedPrice = calculateLinearOccupancyPrice(
          tenantId,
          propertyId,
          rtId,
          occ.sold,
          occ.total,
          roomType.basePrice,
          config
        );
        roomTypeSuggestedPrice.set(rtId, suggestedPrice);
      } else {
        // If linear pricing is disabled, suggested = current
        roomTypeSuggestedPrice.set(rtId, roomType.basePrice);
      }
    } catch {
      // Fall back to base price
      const roomType = rooms.find(r => r.roomTypeId === rtId)?.roomType;
      if (roomType) {
        roomTypeSuggestedPrice.set(rtId, roomType.basePrice);
      }
    }
  }

  // Build per-room pricing data
  const roomPricingData = rooms.map((room) => {
    const occ = roomTypeOccupancy.get(room.roomTypeId);
    const occupancyRate = occ ? Math.round((occ.sold / occ.total) * 100) : 0;
    const suggestedPrice = roomTypeSuggestedPrice.get(room.roomTypeId) ?? room.roomType.basePrice;

    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeName: room.roomType.name,
      roomTypeId: room.roomTypeId,
      floor: room.floor,
      currentPrice: room.roomType.basePrice,
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      occupancyRate,
      status: room.status,
      lastUpdated: room.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    success: true,
    data: roomPricingData,
  });
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
