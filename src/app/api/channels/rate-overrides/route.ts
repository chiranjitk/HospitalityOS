import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: apply a single override to a base rate
function applyOverride(baseRate: number, overrideType: string, overrideValue: number, minRate?: number | null, maxRate?: number | null): number {
  let result = baseRate;

  switch (overrideType) {
    case 'percentage':
      result = baseRate * (1 + overrideValue / 100);
      break;
    case 'fixed_amount':
      result = baseRate + overrideValue;
      break;
    case 'set_to':
      result = overrideValue;
      break;
    default:
      result = baseRate;
  }

  // Round to 2 decimal places
  result = Math.round(result * 100) / 100;

  // Apply min/max constraints
  if (minRate !== null && minRate !== undefined && result < minRate) result = minRate;
  if (maxRate !== null && maxRate !== undefined && result > maxRate) result = maxRate;

  return result;
}

// Helper: check if a date matches the appliesTo rule
function dateMatchesAppliesTo(date: Date, appliesTo: string, specificDates?: string | null): boolean {
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  switch (appliesTo) {
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'specific_dates':
      if (!specificDates) return true;
      try {
        const dateRanges = JSON.parse(specificDates);
        const dateStr = date.toISOString().split('T')[0];
        return dateRanges.some((dr: { start: string; end: string }) => dateStr >= dr.start && dateStr <= dr.end);
      } catch {
        return true;
      }
    case 'all':
    default:
      return true;
  }
}

// Helper: check if override is within effective date range
function isEffective(override: { effectiveFrom?: Date | null; effectiveTo?: Date | null; isActive: boolean }): boolean {
  if (!override.isActive) return false;
  const now = new Date();
  if (override.effectiveFrom && now < override.effectiveFrom) return false;
  if (override.effectiveTo && now > override.effectiveTo) return false;
  return true;
}

// GET /api/channels/rate-overrides - List overrides with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const roomTypeId = searchParams.get('roomTypeId');
    const ratePlanId = searchParams.get('ratePlanId');
    const isActive = searchParams.get('isActive');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (ratePlanId) where.ratePlanId = ratePlanId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const overrides = await db.channelRateOverride.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Enrich with connection display names, room type names, and rate plan names
    const connectionIds = [...new Set(overrides.map(o => o.connectionId).filter(Boolean))] as string[];
    const roomTypeIds = [...new Set(overrides.map(o => o.roomTypeId).filter(Boolean))] as string[];
    const ratePlanIds = [...new Set(overrides.map(o => o.ratePlanId).filter(Boolean))] as string[];

    const [connections, roomTypes, ratePlans] = await Promise.all([
      connectionIds.length > 0
        ? db.channelConnection.findMany({ where: { id: { in: connectionIds } }, select: { id: true, displayName: true, channel: true } })
        : [],
      roomTypeIds.length > 0
        ? db.roomType.findMany({ where: { id: { in: roomTypeIds } }, select: { id: true, name: true } })
        : [],
      ratePlanIds.length > 0
        ? db.ratePlan.findMany({ where: { id: { in: ratePlanIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const connectionMap = new Map(connections.map(c => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }]));
    const roomTypeMap = new Map(roomTypes.map(rt => [rt.id, rt.name]));
    const ratePlanMap = new Map(ratePlans.map(rp => [rp.id, rp.name]));

    const enriched = overrides.map(override => ({
      ...override,
      connectionDisplayName: override.connectionId ? connectionMap.get(override.connectionId)?.displayName || 'Unknown' : null,
      connectionChannel: override.connectionId ? connectionMap.get(override.connectionId)?.channel || null : null,
      roomTypeName: override.roomTypeId ? roomTypeMap.get(override.roomTypeId) || 'Unknown' : null,
      ratePlanName: override.ratePlanId ? ratePlanMap.get(override.ratePlanId) || 'Unknown' : null,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error('Error fetching rate overrides:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate overrides' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/rate-overrides - Create override, calculate, or batch-calculate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle 'calculate' action: Given baseRate + connectionId + date, find matching overrides
    if (action === 'calculate') {
      const { baseRate, connectionId, date, roomTypeId, ratePlanId } = body;

      if (baseRate === undefined || baseRate === null || baseRate < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseRate must be a positive number' } },
          { status: 400 }
        );
      }
      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required' } },
          { status: 400 }
        );
      }

      const targetDate = date ? new Date(date) : new Date();

      // Find the connection to get the channel code
      const connection = await db.channelConnection.findUnique({
        where: { id: connectionId },
        select: { channel: true, tenantId: true },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      // Find all matching overrides for this connection and tenant
      const where: Record<string, unknown> = {
        tenantId: connection.tenantId,
        channelCode: connection.channel,
        isActive: true,
      };

      // Include overrides specific to this connection OR that have no connection (broad channel rules)
      const overrides = await db.channelRateOverride.findMany({
        where: {
          tenantId: connection.tenantId,
          channelCode: connection.channel,
          isActive: true,
          OR: [
            { connectionId: connectionId },
            { connectionId: null },
          ],
          ...(roomTypeId ? { OR: [{ roomTypeId }, { roomTypeId: null }] } : {}),
          ...(ratePlanId ? { OR: [{ ratePlanId }, { ratePlanId: null }] } : {}),
        },
        orderBy: { priority: 'desc' },
      });

      // Filter overrides by date applicability and effective dates
      const matchingOverrides = overrides.filter(o =>
        isEffective(o) && dateMatchesAppliesTo(targetDate, o.appliesTo, o.specificDates)
      );

      // Apply overrides in priority order (highest first)
      const breakdown: Array<{
        overrideId: string;
        overrideName: string;
        overrideType: string;
        overrideValue: number;
        rateBefore: number;
        rateAfter: number;
      }> = [];

      let currentRate = baseRate;

      for (const override of matchingOverrides) {
        const rateBefore = currentRate;
        currentRate = applyOverride(currentRate, override.overrideType, override.overrideValue, override.minRate, override.maxRate);

        breakdown.push({
          overrideId: override.id,
          overrideName: override.name,
          overrideType: override.overrideType,
          overrideValue: override.overrideValue,
          rateBefore: Math.round(rateBefore * 100) / 100,
          rateAfter: Math.round(currentRate * 100) / 100,
        });

        // If set_to was used, no further overrides needed
        if (override.overrideType === 'set_to') break;
      }

      const difference = Math.round((currentRate - baseRate) * 100) / 100;
      const differencePercent = baseRate > 0 ? Math.round((difference / baseRate) * 10000) / 100 : 0;

      return NextResponse.json({
        success: true,
        data: {
          baseRate: Math.round(baseRate * 100) / 100,
          finalRate: currentRate,
          difference,
          differencePercent,
          currency: matchingOverrides[0]?.currency || 'USD',
          overridesApplied: matchingOverrides.length,
          breakdown,
          date: targetDate.toISOString().split('T')[0],
          connectionId,
          channelCode: connection.channel,
        },
      });
    }

    // Handle 'batch-calculate' action: Given baseRates + date range + connectionId
    if (action === 'batch-calculate') {
      const { baseRate, connectionId, dateRange, roomTypeId, ratePlanId } = body;

      if (baseRate === undefined || baseRate === null || baseRate < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseRate must be a positive number' } },
          { status: 400 }
        );
      }
      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required' } },
          { status: 400 }
        );
      }

      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date();
      const endDate = dateRange?.end ? new Date(dateRange.end) : new Date(startDate);

      // Find the connection
      const connection = await db.channelConnection.findUnique({
        where: { id: connectionId },
        select: { channel: true, tenantId: true },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      // Generate date range
      const dates: string[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // Find matching overrides
      const overrides = await db.channelRateOverride.findMany({
        where: {
          tenantId: connection.tenantId,
          channelCode: connection.channel,
          isActive: true,
          OR: [
            { connectionId: connectionId },
            { connectionId: null },
          ],
          ...(roomTypeId ? { OR: [{ roomTypeId }, { roomTypeId: null }] } : {}),
          ...(ratePlanId ? { OR: [{ ratePlanId }, { ratePlanId: null }] } : {}),
        },
        orderBy: { priority: 'desc' },
      });

      // Calculate for each date
      const results = dates.map(dateStr => {
        const date = new Date(dateStr);
        const matchingOverrides = overrides.filter(o =>
          isEffective(o) && dateMatchesAppliesTo(date, o.appliesTo, o.specificDates)
        );

        let currentRate = baseRate;
        const appliedOverrides: string[] = [];

        for (const override of matchingOverrides) {
          currentRate = applyOverride(currentRate, override.overrideType, override.overrideValue, override.minRate, override.maxRate);
          appliedOverrides.push(override.name);
          if (override.overrideType === 'set_to') break;
        }

        return {
          date: dateStr,
          baseRate: Math.round(baseRate * 100) / 100,
          finalRate: Math.round(currentRate * 100) / 100,
          difference: Math.round((currentRate - baseRate) * 100) / 100,
          overridesApplied: matchingOverrides.length,
          overrideNames: appliedOverrides,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          connectionId,
          channelCode: connection.channel,
          baseRate: Math.round(baseRate * 100) / 100,
          dates: results,
          summary: {
            totalDates: dates.length,
            minRate: Math.min(...results.map(r => r.finalRate)),
            maxRate: Math.max(...results.map(r => r.finalRate)),
            avgRate: Math.round((results.reduce((sum, r) => sum + r.finalRate, 0) / results.length) * 100) / 100,
            datesWithOverrides: results.filter(r => r.overridesApplied > 0).length,
          },
        },
      });
    }

    // Default: Create a new override
    const {
      tenantId,
      propertyId,
      connectionId,
      channelCode,
      name,
      description,
      roomTypeId,
      ratePlanId,
      overrideType,
      overrideValue,
      currency,
      minRate,
      maxRate,
      appliesTo,
      specificDates,
      priority,
      isActive,
      effectiveFrom,
      effectiveTo,
    } = body;

    // Validate required fields
    if (!tenantId || !channelCode || !name || overrideValue === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId, channelCode, name, and overrideValue are required' } },
        { status: 400 }
      );
    }

    // Validate overrideType
    const validTypes = ['percentage', 'fixed_amount', 'set_to'];
    if (overrideType && !validTypes.includes(overrideType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid overrideType. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate appliesTo
    const validAppliesTo = ['all', 'weekdays', 'weekends', 'specific_dates'];
    if (appliesTo && !validAppliesTo.includes(appliesTo)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid appliesTo. Must be one of: ${validAppliesTo.join(', ')}` } },
        { status: 400 }
      );
    }

    const override = await db.channelRateOverride.create({
      data: {
        tenantId,
        propertyId: propertyId || null,
        connectionId: connectionId || null,
        channelCode,
        name,
        description: description || null,
        roomTypeId: roomTypeId || null,
        ratePlanId: ratePlanId || null,
        overrideType: overrideType || 'percentage',
        overrideValue,
        currency: currency || 'USD',
        minRate: minRate !== undefined && minRate !== null ? minRate : null,
        maxRate: maxRate !== undefined && maxRate !== null ? maxRate : null,
        appliesTo: appliesTo || 'all',
        specificDates: specificDates || null,
        priority: priority !== undefined ? priority : 0,
        isActive: isActive !== undefined ? isActive : true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    return NextResponse.json({ success: true, data: override }, { status: 201 });
  } catch (error) {
    console.error('Error in rate-overrides POST:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/rate-overrides - Update an override
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Override ID is required' } },
        { status: 400 }
      );
    }

    // Verify override exists
    const existing = await db.channelRateOverride.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate override not found' } },
        { status: 404 }
      );
    }

    const ALLOWED_FIELDS = [
      'name', 'description', 'connectionId', 'channelCode', 'roomTypeId', 'ratePlanId',
      'overrideType', 'overrideValue', 'currency', 'minRate', 'maxRate',
      'appliesTo', 'specificDates', 'priority', 'isActive', 'effectiveFrom', 'effectiveTo',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updates) {
        if (field === 'effectiveFrom' || field === 'effectiveTo') {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const override = await db.channelRateOverride.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: override });
  } catch (error) {
    console.error('Error updating rate override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate override' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/rate-overrides - Delete an override
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Override ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelRateOverride.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate override not found' } },
        { status: 404 }
      );
    }

    await db.channelRateOverride.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Rate override deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rate override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate override' } },
      { status: 500 }
    );
  }
}
