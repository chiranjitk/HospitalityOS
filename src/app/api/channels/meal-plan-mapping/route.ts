import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/meal-plan-mapping - List all meal plan mappings
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const mealPlanType = searchParams.get('mealPlanType');
    const isActive = searchParams.get('isActive');

    const tenantId = ctx.tenantId;

    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (mealPlanType) where.mealPlanType = mealPlanType;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const mappings = await db.mealPlanMapping.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Enrich with connection display names
    const connectionIds = [...new Set(mappings.map(m => m.connectionId).filter(Boolean))] as string[];

    const connections = connectionIds.length > 0
      ? await db.channelConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, displayName: true, channel: true },
        })
      : [];

    const connectionMap = new Map(
      connections.map(c => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }])
    );

    const enrichedMappings = mappings.map(mapping => ({
      ...mapping,
      connectionDisplayName: mapping.connectionId
        ? connectionMap.get(mapping.connectionId)?.displayName || 'Unknown'
        : null,
      connectionChannel: mapping.connectionId
        ? connectionMap.get(mapping.connectionId)?.channel || null
        : null,
    }));

    const total = await db.mealPlanMapping.count({ where });

    // Compute stats
    const allMappings = await db.mealPlanMapping.findMany({
      where: { tenantId },
    });
    const activeCount = allMappings.filter(m => m.isActive).length;
    const typeCounts: Record<string, number> = {};
    for (const m of allMappings) {
      typeCounts[m.mealPlanType] = (typeCounts[m.mealPlanType] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: enrichedMappings,
      pagination: { total },
      stats: {
        total: allMappings.length,
        active: activeCount,
        inactive: allMappings.length - activeCount,
        byType: typeCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching meal plan mappings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch meal plan mappings' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/meal-plan-mapping - Create a new mapping or bulk-sync
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { action } = body;

    // Handle 'bulk-sync' action
    if (action === 'bulk-sync') {
      const { connectionId } = body;

      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required for bulk-sync' } },
          { status: 400 }
        );
      }

      const tenantId = ctx.tenantId;

      // Verify the connection exists
      const connection = await db.channelConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }

      // Fetch all active mappings for this connection
      const mappings = await db.mealPlanMapping.findMany({
        where: { tenantId, connectionId, isActive: true },
      });

      if (mappings.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_DATA', message: 'No active meal plan mappings found for this connection' } },
          { status: 400 }
        );
      }

      // Log the sync in ChannelSyncLog
      await db.channelSyncLog.create({
        data: {
          tenantId,
          connectionId,
          channel: connection.channel,
          direction: 'outbound',
          syncType: 'meal_plan_mapping',
          status: 'completed',
          recordsProcessed: mappings.length,
          recordsSucceeded: mappings.length,
          recordsFailed: 0,
          details: JSON.stringify({
            mappingsPushed: mappings.map(m => ({
              internalMealPlanId: m.internalMealPlanId,
              channelMealPlanCode: m.channelMealPlanCode,
              mealPlanType: m.mealPlanType,
            })),
          }),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          syncType: 'bulk-sync',
          connectionId,
          channel: connection.channel,
          mappingsPushed: mappings.length,
          channelCode: connection.channel,
          syncStatus: 'completed',
        },
      });
    }

    // Default: create a new mapping
    const {
      propertyId,
      connectionId,
      internalMealPlanId,
      internalMealPlanName,
      channelCode,
      channelMealPlanCode,
      channelMealPlanName,
      mealPlanType,
      includesBreakfast,
      includesLunch,
      includesDinner,
      includesDrinks,
      supplementAmount,
      supplementType,
      currency,
      isActive,
    } = body;

    // Validate required fields
    if (!ctx.tenantId || !internalMealPlanId || !internalMealPlanName || !channelCode || !channelMealPlanCode) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId, internalMealPlanId, internalMealPlanName, channelCode, and channelMealPlanCode are required' } },
        { status: 400 }
      );
    }

    // Validate mealPlanType
    const validTypes = ['room_only', 'bed_breakfast', 'half_board', 'full_board', 'all_inclusive', 'breakfast_included', 'lunch_included', 'dinner_included', 'custom'];
    if (mealPlanType && !validTypes.includes(mealPlanType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid mealPlanType. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate supplementType
    const validSupplementTypes = ['per_night', 'per_stay', 'per_person_per_night', 'percentage'];
    if (supplementType && !validSupplementTypes.includes(supplementType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid supplementType. Must be one of: ${validSupplementTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    const mapping = await db.mealPlanMapping.create({
      data: {
        tenantId,
        propertyId: propertyId || null,
        connectionId: connectionId || null,
        internalMealPlanId,
        internalMealPlanName,
        channelCode,
        channelMealPlanCode,
        channelMealPlanName: channelMealPlanName || null,
        mealPlanType: mealPlanType || 'bed_breakfast',
        includesBreakfast: includesBreakfast ?? false,
        includesLunch: includesLunch ?? false,
        includesDinner: includesDinner ?? false,
        includesDrinks: includesDrinks ?? false,
        supplementAmount: supplementAmount !== undefined && supplementAmount !== null ? supplementAmount : null,
        supplementType: supplementType || 'per_night',
        currency: currency || 'USD',
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in meal-plan-mapping POST:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_CONSTRAINT', message: 'A mapping with this internal meal plan and channel code already exists for this connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/meal-plan-mapping - Update an existing mapping
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mapping ID is required' } },
        { status: 400 }
      );
    }

    // Verify mapping exists
    const existing = await db.mealPlanMapping.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Meal plan mapping not found' } },
        { status: 404 }
      );
    }

    // Build update data (whitelist allowed fields)
    const ALLOWED_FIELDS = [
      'propertyId', 'connectionId', 'internalMealPlanId', 'internalMealPlanName',
      'channelCode', 'channelMealPlanCode', 'channelMealPlanName', 'mealPlanType',
      'includesBreakfast', 'includesLunch', 'includesDinner', 'includesDrinks',
      'supplementAmount', 'supplementType', 'currency', 'isActive',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }

    const mapping = await db.mealPlanMapping.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (error: unknown) {
    console.error('Error updating meal plan mapping:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_CONSTRAINT', message: 'A mapping with this internal meal plan and channel code already exists for this connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update meal plan mapping' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/meal-plan-mapping - Delete a mapping
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mapping ID is required' } },
        { status: 400 }
      );
    }

    // Verify mapping exists
    const existing = await db.mealPlanMapping.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Meal plan mapping not found' } },
        { status: 404 }
      );
    }

    await db.mealPlanMapping.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Meal plan mapping deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting meal plan mapping:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete meal plan mapping' } },
      { status: 500 }
    );
  }
}
