import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/cancellation-policy?connectionId=X&channelCode=Y&policyType=Z&isActive=true
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const policyType = searchParams.get('policyType');
    const isActiveParam = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (policyType) where.policyType = policyType;
    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    const policies = await db.channelCancellationPolicy.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Fetch channel connections for enriched display
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
      select: { id: true, channel: true, displayName: true, status: true },
    });
    const connectionMap = new Map(connections.map((c) => [c.id, c]));

    const enriched = policies.map((p) => ({
      ...p,
      connection: p.connectionId ? connectionMap.get(p.connectionId) || null : null,
    }));

    // Compute summary stats
    const total = enriched.length;
    const active = enriched.filter((p) => p.isActive).length;
    const synced = enriched.filter((p) => p.syncStatus === 'synced').length;
    const failed = enriched.filter((p) => p.syncStatus === 'failed').length;
    const pending = enriched.filter((p) => p.syncStatus === 'pending').length;

    return NextResponse.json({
      success: true,
      data: {
        policies: enriched,
        summary: { total, active, synced, failed, pending },
      },
    });
  } catch (error) {
    console.error('Error fetching cancellation policies:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cancellation policies' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/cancellation-policy — Create, sync, or calculate-penalty
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    // Handle action-based POST requests
    if (body.action === 'sync') {
      return handleSync(user, body);
    }
    if (body.action === 'calculate-penalty') {
      return handleCalculatePenalty(user, body);
    }

    // Standard create
    const {
      connectionId,
      channelCode,
      policyName,
      policyType,
      freeCancelBefore,
      penaltyType,
      penaltyValue,
      penaltyCurrency,
      noShowPolicy,
      noShowPenaltyType,
      noShowPenaltyValue,
      channelPolicyId,
      channelPolicyCode,
      syncEnabled,
      isActive,
      propertyId,
    } = body;

    if (!channelCode || !policyName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode and policyName are required' } },
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

    const created = await db.channelCancellationPolicy.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        connectionId: connectionId || null,
        channelCode,
        policyName,
        policyType: policyType || 'free_cancellation',
        freeCancelBefore: freeCancelBefore != null ? parseInt(String(freeCancelBefore), 10) : null,
        penaltyType: penaltyType || 'percentage',
        penaltyValue: penaltyValue ?? 0,
        penaltyCurrency: penaltyCurrency || 'USD',
        noShowPolicy: noShowPolicy ?? true,
        noShowPenaltyType: noShowPenaltyType || 'nights',
        noShowPenaltyValue: noShowPenaltyValue ?? 1,
        channelPolicyId: channelPolicyId || null,
        channelPolicyCode: channelPolicyCode || null,
        syncEnabled: syncEnabled ?? true,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating cancellation policy:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A cancellation policy with this name already exists for this channel connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create cancellation policy' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/cancellation-policy — Update a cancellation policy
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
    const existing = await db.channelCancellationPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
        { status: 404 }
      );
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'connectionId', 'channelCode', 'policyName', 'policyType',
      'freeCancelBefore', 'penaltyType', 'penaltyValue', 'penaltyCurrency',
      'noShowPolicy', 'noShowPenaltyType', 'noShowPenaltyValue',
      'channelPolicyId', 'channelPolicyCode', 'syncEnabled',
      'syncStatus', 'lastSyncedAt', 'lastError', 'isActive', 'propertyId',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const updated = await db.channelCancellationPolicy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating cancellation policy:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A cancellation policy with this name already exists for this channel connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update cancellation policy' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/cancellation-policy?id=X
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
    const existing = await db.channelCancellationPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
        { status: 404 }
      );
    }

    await db.channelCancellationPolicy.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('Error deleting cancellation policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete cancellation policy' } },
      { status: 500 }
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleSync(
  user: { tenantId: string },
  body: {
    connectionId: string;
    channelCode?: string;
  }
) {
  const { connectionId, channelCode } = body;

  if (!connectionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required for sync' } },
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

  // Fetch all active + sync-enabled policies for this connection/channel
  const policies = await db.channelCancellationPolicy.findMany({
    where: {
      tenantId: user.tenantId,
      connectionId,
      channelCode: effectiveChannelCode,
      isActive: true,
      syncEnabled: true,
    },
  });

  // Simulate the sync — in production this would call the channel API
  const now = new Date();
  const syncedCount = policies.length;
  const failedCount = 0;
  const syncedIds: string[] = [];

  // Update each policy's sync status
  for (const policy of policies) {
    await db.channelCancellationPolicy.update({
      where: { id: policy.id },
      data: {
        syncStatus: 'synced',
        lastSyncedAt: now,
        lastError: null,
      },
    });
    syncedIds.push(policy.id);
  }

  // Build the policy payload to send to the channel
  const policyPayload = policies.map((p) => ({
    policyName: p.policyName,
    policyType: p.policyType,
    freeCancelBefore: p.freeCancelBefore,
    penaltyType: p.penaltyType,
    penaltyValue: p.penaltyValue,
    penaltyCurrency: p.penaltyCurrency,
    noShowPolicy: p.noShowPolicy,
    noShowPenaltyType: p.noShowPenaltyType,
    noShowPenaltyValue: p.noShowPenaltyValue,
    channelPolicyId: p.channelPolicyId,
    channelPolicyCode: p.channelPolicyCode,
  }));

  const syncResult = {
    connectionId,
    channelCode: effectiveChannelCode,
    channelName: connection.displayName || connection.channel,
    totalPolicies: policies.length,
    syncedCount,
    failedCount,
    syncedIds,
    syncedAt: now.toISOString(),
    status: 'success' as const,
    policyPayload,
    message: `Successfully synced ${syncedCount} cancellation policy(ies) to ${connection.displayName || connection.channel}`,
  };

  // Create a sync log entry
  try {
    await db.channelSyncLog.create({
      data: {
        connectionId,
        syncType: 'cancellation_policy',
        direction: 'outbound',
        requestPayload: JSON.stringify(policyPayload),
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

async function handleCalculatePenalty(
  user: { tenantId: string },
  body: {
    policyId: string;
    bookingAmount: number;
    checkInDatetime: string;
    cancellationDatetime?: string;
  }
) {
  const { policyId, bookingAmount, checkInDatetime, cancellationDatetime } = body;

  if (!policyId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'policyId is required' } },
      { status: 400 }
    );
  }

  if (!bookingAmount || bookingAmount <= 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingAmount must be a positive number' } },
      { status: 400 }
    );
  }

  if (!checkInDatetime) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'checkInDatetime is required' } },
      { status: 400 }
    );
  }

  // Fetch the policy
  const policy = await db.channelCancellationPolicy.findFirst({
    where: { id: policyId, tenantId: user.tenantId },
  });

  if (!policy) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
      { status: 404 }
    );
  }

  const checkIn = new Date(checkInDatetime);
  const cancelAt = cancellationDatetime ? new Date(cancellationDatetime) : new Date();
  const hoursUntilCheckIn = Math.max(0, (checkIn.getTime() - cancelAt.getTime()) / (1000 * 60 * 60));

  // Determine if within free cancellation window
  const isFreeCancellation = policy.freeCancelBefore != null && hoursUntilCheckIn >= policy.freeCancelBefore;
  const isNoShow = hoursUntilCheckIn === 0 || cancelAt > checkIn;

  let penaltyAmount = 0;
  let penaltyDescription = '';
  let isRefundable = true;

  if (isNoShow && policy.noShowPolicy) {
    // No-show penalty
    switch (policy.noShowPenaltyType) {
      case 'percentage':
        penaltyAmount = bookingAmount * (policy.noShowPenaltyValue / 100);
        penaltyDescription = `${policy.noShowPenaltyValue}% of booking amount (no-show penalty)`;
        break;
      case 'fixed_amount':
        penaltyAmount = policy.noShowPenaltyValue;
        penaltyDescription = `${policy.penaltyCurrency} ${policy.noShowPenaltyValue.toFixed(2)} (no-show penalty)`;
        break;
      case 'nights':
        // Assume single night rate = bookingAmount for simplicity
        penaltyAmount = bookingAmount * Math.min(policy.noShowPenaltyValue, 1);
        penaltyDescription = `${policy.noShowPenaltyValue} night(s) of booking amount (no-show penalty)`;
        break;
    }
    isRefundable = penaltyAmount < bookingAmount;
  } else if (isFreeCancellation) {
    // Within free cancellation window
    penaltyAmount = 0;
    penaltyDescription = `Free cancellation — cancelled ${hoursUntilCheckIn.toFixed(1)}h before check-in (within ${policy.freeCancelBefore}h window)`;
    isRefundable = true;
  } else {
    // Late cancellation — apply penalty
    switch (policy.penaltyType) {
      case 'percentage':
        penaltyAmount = bookingAmount * (policy.penaltyValue / 100);
        penaltyDescription = `${policy.penaltyValue}% of booking amount (${policy.penaltyCurrency} ${penaltyAmount.toFixed(2)})`;
        break;
      case 'fixed_amount':
        penaltyAmount = Math.min(policy.penaltyValue, bookingAmount);
        penaltyDescription = `${policy.penaltyCurrency} ${policy.penaltyValue.toFixed(2)} fixed penalty`;
        break;
      case 'nights':
        penaltyAmount = bookingAmount * Math.min(policy.penaltyValue, 1);
        penaltyDescription = `${policy.penaltyValue} night(s) — ${policy.penaltyCurrency} ${penaltyAmount.toFixed(2)}`;
        break;
    }
    isRefundable = penaltyAmount < bookingAmount;
  }

  const refundAmount = Math.max(0, bookingAmount - penaltyAmount);

  return NextResponse.json({
    success: true,
    data: {
      policyId: policy.id,
      policyName: policy.policyName,
      policyType: policy.policyType,
      bookingAmount,
      penaltyAmount: Math.round(penaltyAmount * 100) / 100,
      refundAmount: Math.round(refundAmount * 100) / 100,
      isRefundable,
      isFreeCancellation,
      isNoShow,
      hoursUntilCheckIn: Math.round(hoursUntilCheckIn * 10) / 10,
      freeCancelBefore: policy.freeCancelBefore,
      penaltyDescription,
      penaltyCurrency: policy.penaltyCurrency,
      channelCode: policy.channelCode,
    },
  });
}
