import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/tax-mapping?connectionId=X&channelCode=Y&taxType=Z&isActive=true
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const taxType = searchParams.get('taxType');
    const isActiveParam = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (taxType) where.taxType = taxType;
    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    const mappings = await db.channelTaxMapping.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Fetch channel connections for enriched display
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
      select: { id: true, channel: true, displayName: true, status: true },
    });
    const connectionMap = new Map(connections.map((c) => [c.id, c]));

    const enriched = mappings.map((m) => ({
      ...m,
      connection: m.connectionId ? connectionMap.get(m.connectionId) || null : null,
    }));

    // Compute summary stats
    const total = enriched.length;
    const active = enriched.filter((m) => m.isActive).length;
    const inclusive = enriched.filter((m) => m.displayMode === 'inclusive' && m.isActive).length;
    const exclusive = enriched.filter((m) => m.displayMode === 'exclusive' && m.isActive).length;
    const showSeparately = enriched.filter((m) => m.displayMode === 'show_separately' && m.isActive).length;

    return NextResponse.json({
      success: true,
      data: {
        mappings: enriched,
        summary: { total, active, inclusive, exclusive, showSeparately },
      },
    });
  } catch (error) {
    console.error('Error fetching tax mappings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tax mappings' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/tax-mapping — Create, preview, or bulk-sync
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    // Handle action-based POST requests
    if (body.action === 'preview') {
      return handlePreview(user, body);
    }
    if (body.action === 'bulk-sync') {
      return handleBulkSync(user, body);
    }

    // Standard create
    const {
      connectionId,
      channelCode,
      internalTaxId,
      internalTaxName,
      taxType,
      taxRate,
      displayMode,
      channelTaxCode,
      channelTaxName,
      appliesTo,
      isIncludedInRate,
      isActive,
      propertyId,
    } = body;

    if (!channelCode || !internalTaxName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode and internalTaxName are required' } },
        { status: 400 }
      );
    }

    // Verify connection belongs to tenant if provided
    if (connectionId) {
      const connection = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });
      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }
    }

    const created = await db.channelTaxMapping.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        connectionId: connectionId || null,
        channelCode,
        internalTaxId: internalTaxId || null,
        internalTaxName,
        taxType: taxType || 'occupancy',
        taxRate: taxRate ?? 0,
        displayMode: displayMode || 'inclusive',
        channelTaxCode: channelTaxCode || null,
        channelTaxName: channelTaxName || null,
        appliesTo: appliesTo || 'room_rate',
        isIncludedInRate: isIncludedInRate ?? true,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating tax mapping:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A tax mapping with this configuration already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create tax mapping' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/tax-mapping — Update a tax mapping
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify record belongs to tenant
    const existing = await db.channelTaxMapping.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tax mapping not found' } },
        { status: 404 }
      );
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'connectionId', 'channelCode', 'internalTaxId', 'internalTaxName',
      'taxType', 'taxRate', 'displayMode', 'channelTaxCode', 'channelTaxName',
      'appliesTo', 'isIncludedInRate', 'isActive', 'propertyId',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const updated = await db.channelTaxMapping.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating tax mapping:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A tax mapping with this configuration already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tax mapping' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/tax-mapping?id=X
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify record belongs to tenant
    const existing = await db.channelTaxMapping.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tax mapping not found' } },
        { status: 404 }
      );
    }

    await db.channelTaxMapping.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('Error deleting tax mapping:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tax mapping' } },
      { status: 500 }
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handlePreview(
  user: { tenantId: string },
  body: {
    baseRate: number;
    connectionId?: string;
    channelCode?: string;
  }
) {
  const { baseRate, connectionId, channelCode } = body;

  if (!baseRate || baseRate <= 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseRate must be a positive number' } },
      { status: 400 }
    );
  }

  if (!connectionId && !channelCode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId or channelCode is required' } },
      { status: 400 }
    );
  }

  // Fetch applicable active tax mappings
  const where: Record<string, unknown> = {
    tenantId: user.tenantId,
    isActive: true,
  };
  if (connectionId) where.connectionId = connectionId;
  if (channelCode) where.channelCode = channelCode;

  const mappings = await db.channelTaxMapping.findMany({ where });

  if (mappings.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        baseRate,
        totalTaxes: 0,
        finalRate: baseRate,
        breakdown: [],
        channelCode: channelCode || mappings[0]?.channelCode || '',
        note: 'No active tax mappings found for this channel',
      },
    });
  }

  const effectiveChannelCode = channelCode || mappings[0].channelCode;

  // Calculate tax breakdown
  let inclusiveTotal = 0;
  let exclusiveTotal = 0;
  const breakdown = [];

  for (const mapping of mappings) {
    const taxAmount = baseRate * (mapping.taxRate / 100);

    if (mapping.displayMode === 'inclusive' && mapping.isIncludedInRate) {
      inclusiveTotal += taxAmount;
    } else if (mapping.displayMode === 'exclusive') {
      exclusiveTotal += taxAmount;
    } else {
      // show_separately
      exclusiveTotal += taxAmount;
    }

    breakdown.push({
      id: mapping.id,
      taxName: mapping.internalTaxName,
      channelTaxName: mapping.channelTaxName || mapping.internalTaxName,
      taxType: mapping.taxType,
      taxRate: mapping.taxRate,
      displayMode: mapping.displayMode,
      appliesTo: mapping.appliesTo,
      isIncludedInRate: mapping.isIncludedInRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      channelTaxCode: mapping.channelTaxCode,
    });
  }

  const netRate = baseRate - inclusiveTotal;
  const finalRate = baseRate + exclusiveTotal;
  const totalTaxes = inclusiveTotal + exclusiveTotal;

  return NextResponse.json({
    success: true,
    data: {
      baseRate,
      netRate: Math.round(netRate * 100) / 100,
      inclusiveTaxes: Math.round(inclusiveTotal * 100) / 100,
      exclusiveTaxes: Math.round(exclusiveTotal * 100) / 100,
      totalTaxes: Math.round(totalTaxes * 100) / 100,
      finalRate: Math.round(finalRate * 100) / 100,
      breakdown,
      channelCode: effectiveChannelCode,
      note: `Final guest rate: ${finalRate.toFixed(2)} (base ${baseRate} + ${exclusiveTotal.toFixed(2)} taxes; ${inclusiveTotal.toFixed(2)} taxes included in base)`,
    },
  });
}

async function handleBulkSync(
  user: { tenantId: string },
  body: {
    connectionId: string;
    channelCode?: string;
    mappings?: Array<Record<string, unknown>>;
  }
) {
  const { connectionId, channelCode } = body;

  if (!connectionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required for bulk sync' } },
      { status: 400 }
    );
  }

  // Verify connection belongs to tenant
  const connection = await db.channelConnection.findFirst({
    where: { id: connectionId, tenantId: user.tenantId },
  });

  if (!connection) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
      { status: 404 }
    );
  }

  const effectiveChannelCode = channelCode || connection.channel;

  // Fetch all active mappings for this connection/channel
  const mappings = await db.channelTaxMapping.findMany({
    where: {
      tenantId: user.tenantId,
      connectionId,
      channelCode: effectiveChannelCode,
      isActive: true,
    },
  });

  // Build the tax payload to send to the channel
  const taxPayload = mappings.map((m) => ({
    internalTaxId: m.internalTaxId,
    internalTaxName: m.internalTaxName,
    taxType: m.taxType,
    taxRate: m.taxRate,
    displayMode: m.displayMode,
    channelTaxCode: m.channelTaxCode,
    channelTaxName: m.channelTaxName,
    appliesTo: m.appliesTo,
    isIncludedInRate: m.isIncludedInRate,
  }));

  // Simulate the sync — in production this would call the channel API
  const syncResult = {
    connectionId,
    channelCode: effectiveChannelCode,
    channelName: connection.displayName || connection.channel,
    totalMappings: mappings.length,
    syncedAt: new Date().toISOString(),
    status: 'success' as const,
    taxPayload,
    message: `Successfully synced ${mappings.length} tax mapping(s) to ${connection.displayName || connection.channel}`,
  };

  // Create a sync log entry
  try {
    await db.channelSyncLog.create({
      data: {
        connectionId,
        syncType: 'tax_mapping',
        direction: 'outbound',
        requestPayload: JSON.stringify(taxPayload),
        responsePayload: JSON.stringify(syncResult),
        status: 'success',
        statusCode: 200,
      },
    });
  } catch (logErr) {
    console.error('Error creating sync log:', logErr);
  }

  return NextResponse.json({
    success: true,
    data: syncResult,
  });
}
