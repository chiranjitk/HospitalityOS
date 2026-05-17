import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  runHourlyPricingCycle,
  clearRateCache,
  getLinearPricingConfig,
  calculateLinearOccupancyPrice,
} from '@/lib/revenue/hourly-pricing-engine';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/revenue/hourly-pricing/apply-all — Apply all suggested prices for a property
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
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
  const { propertyId } = body;

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

    // Get linear pricing config
    const config = await getLinearPricingConfig(tenantId, propertyId);

    // Get all room types for this property
    const roomTypes = await db.roomType.findMany({
      where: { propertyId, status: 'active', deletedAt: null },
      select: { id: true, name: true, basePrice: true, totalRooms: true },
    });

    const updatedRooms: Array<{
      roomTypeId: string;
      roomTypeName: string;
      previousPrice: number;
      newPrice: number;
      roomsAffected: number;
    }> = [];

    let totalRatesChanged = 0;

    for (const roomType of roomTypes) {
      try {
        // Calculate current occupancy
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const roomsSold = await db.booking.count({
          where: {
            tenantId,
            propertyId,
            roomTypeId: roomType.id,
            checkIn: { lte: todayEnd },
            checkOut: { gt: todayStart },
            status: { in: ['confirmed', 'reserved', 'checked_in'] },
            deletedAt: null,
          },
        });

        const totalRooms = roomType.totalRooms || 1;

        // Calculate suggested price using linear pricing engine
        const suggestedPrice = config.enabled
          ? calculateLinearOccupancyPrice(
              tenantId,
              propertyId,
              roomType.id,
              roomsSold,
              totalRooms,
              roomType.basePrice,
              config
            )
          : roomType.basePrice;

        const roundedSuggested = Math.round(suggestedPrice * 100) / 100;

        // Only update if there's a meaningful difference
        if (Math.abs(roundedSuggested - roomType.basePrice) > 0.01) {
          await db.roomType.update({
            where: { id: roomType.id },
            data: { basePrice: roundedSuggested },
          });

          totalRatesChanged++;

          updatedRooms.push({
            roomTypeId: roomType.id,
            roomTypeName: roomType.name,
            previousPrice: roomType.basePrice,
            newPrice: roundedSuggested,
            roomsAffected: totalRooms,
          });
        }
      } catch (error) {
        console.error(`Error applying suggested price for room type ${roomType.id}:`, error);
      }
    }

    // Clear rate cache after applying all
    clearRateCache(tenantId, propertyId);

    // Record in audit log
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'revenue',
        action: 'apply_all_suggested_prices',
        entityType: 'Property',
        entityId: propertyId,
        newValue: JSON.stringify({
          totalRatesChanged,
          updatedRooms,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        totalRatesChanged,
        totalRoomTypes: roomTypes.length,
        updatedRooms,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Error applying all suggested prices:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply all suggested prices' } },
      { status: 500 }
    );
  }
}
