import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/priority
// GET /api/channels/priority?action=sync-order
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId') || undefined;

    if (action === 'sync-order') {
      // Return recommended sync order based on current priorities
      const priorities = await db.channelPriority.findMany({
        where: { tenantId, ...(propertyId ? { propertyId } : {}), isActive: true },
        orderBy: { priority: 'asc' },
        include: {
          // We enrich below by fetching connections separately
        },
      });

      const connectionIds = priorities.map((p) => p.connectionId);
      const connections = connectionIds.length > 0
        ? await db.channelConnection.findMany({
            where: { id: { in: connectionIds } },
            select: { id: true, channel: true, displayName: true, status: true },
          })
        : [];

      const connMap = new Map(connections.map((c) => [c.id, c]));

      const syncOrder = priorities
        .map((p, idx) => ({
          ...p,
          syncOrder: idx + 1,
          connection: connMap.get(p.connectionId) || null,
        }));

      return NextResponse.json({
        success: true,
        data: syncOrder,
      });
    }

    // Default: list all channel priorities with enriched connection data
    const priorities = await db.channelPriority.findMany({
      where: { tenantId, ...(propertyId ? { propertyId } : {}), isActive: true },
      orderBy: { priority: 'asc' },
    });

    const connectionIds = priorities.map((p) => p.connectionId);
    const connections = connectionIds.length > 0
      ? await db.channelConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, channel: true, displayName: true, status: true, lastSyncAt: true },
        })
      : [];

    const connMap = new Map(connections.map((c) => [c.id, c]));

    const enriched = priorities.map((p) => ({
      ...p,
      connection: connMap.get(p.connectionId) || null,
    }));

    // Also fetch connections that don't have priority config yet
    const existingConnIds = new Set(priorities.map((p) => p.connectionId));
    const activeConnections = await db.channelConnection.findMany({
      where: {
        tenantId,
        ...(propertyId ? { propertyId } : {}),
        status: 'active',
        ...(existingConnIds.size > 0 ? { id: { notIn: Array.from(existingConnIds) } } : {}),
      },
      select: { id: true, channel: true, displayName: true, status: true },
      orderBy: { channel: 'asc' },
    });

    const preferred = priorities.find((p) => p.preferredChannel);
    const avgPriority = priorities.length > 0
      ? Math.round((priorities.reduce((s, p) => s + p.priority, 0) / priorities.length) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        priorities: enriched,
        unconfigured: activeConnections,
        summary: {
          totalConfigured: priorities.length,
          totalUnconfigured: activeConnections.length,
          preferredChannel: preferred
            ? { id: preferred.id, channelCode: preferred.channelCode, connectionId: preferred.connectionId }
            : null,
          avgPriority,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching channel priorities:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel priorities' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/priority
// POST /api/channels/priority?action=reorder
// POST /api/channels/priority?action=set-preferred
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reorder') {
      return handleReorder(body, user.tenantId);
    }

    if (action === 'set-preferred') {
      return handleSetPreferred(body, user.tenantId);
    }

    // Default: create a priority config
    return handleCreate(body, user.tenantId);
  } catch (error) {
    console.error('Error in POST channel priority:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

async function handleCreate(body: Record<string, unknown>, tenantId: string) {
  const { connectionId, channelCode, priority, propertyId, syncOrder, preferredChannel, inventoryWeight, rateWeight, bookingWeight, maxInventoryPercent, notes, isActive } = body;

  if (!connectionId || !channelCode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId and channelCode are required' } },
      { status: 400 }
    );
  }

  // Verify connection belongs to tenant
  const connection = await db.channelConnection.findFirst({
    where: { id: connectionId as string, tenantId },
  });

  if (!connection) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
      { status: 404 }
    );
  }

  const created = await db.channelPriority.create({
    data: {
      tenantId,
      connectionId: connectionId as string,
      channelCode: channelCode as string,
      propertyId: (propertyId as string) || null,
      priority: (priority as number) ?? 5,
      syncOrder: (syncOrder as number) ?? 0,
      preferredChannel: (preferredChannel as boolean) ?? false,
      inventoryWeight: (inventoryWeight as number) ?? 1,
      rateWeight: (rateWeight as number) ?? 1,
      bookingWeight: (bookingWeight as number) ?? 1,
      maxInventoryPercent: (maxInventoryPercent as number) ?? 100,
      notes: (notes as string) || null,
      isActive: (isActive as boolean) ?? true,
    },
  });

  return NextResponse.json({ success: true, data: created });
}

async function handleReorder(body: Record<string, unknown>, tenantId: string) {
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'items array is required with at least one entry' } },
      { status: 400 }
    );
  }

  // Update each item's priority and syncOrder
  const updates = items.map((item: { id: string; priority: number; syncOrder?: number }) =>
    db.channelPriority.updateMany({
      where: { id: item.id, tenantId },
      data: {
        priority: item.priority,
        ...(item.syncOrder !== undefined ? { syncOrder: item.syncOrder } : {}),
      },
    })
  );

  await Promise.all(updates);

  return NextResponse.json({
    success: true,
    data: { updated: items.length },
  });
}

async function handleSetPreferred(body: Record<string, unknown>, tenantId: string) {
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
      { status: 400 }
    );
  }

  // Verify the record belongs to tenant
  const record = await db.channelPriority.findFirst({
    where: { id: id as string, tenantId },
  });

  if (!record) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Priority record not found' } },
      { status: 404 }
    );
  }

  // Unset all preferred channels for this tenant (and optionally property)
  await db.channelPriority.updateMany({
    where: {
      tenantId,
      ...(record.propertyId ? { propertyId: record.propertyId } : {}),
      preferredChannel: true,
    },
    data: { preferredChannel: false },
  });

  // Set the requested one as preferred
  const updated = await db.channelPriority.update({
    where: { id: id as string },
    data: { preferredChannel: true },
  });

  return NextResponse.json({ success: true, data: updated });
}

// PUT /api/channels/priority
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, priority, syncOrder, preferredChannel, inventoryWeight, rateWeight, bookingWeight, maxInventoryPercent, notes, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const record = await db.channelPriority.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Priority record not found' } },
        { status: 404 }
      );
    }

    // If setting preferredChannel=true, unset others first
    if (preferredChannel === true && !record.preferredChannel) {
      await db.channelPriority.updateMany({
        where: {
          tenantId: user.tenantId,
          ...(record.propertyId ? { propertyId: record.propertyId } : {}),
          preferredChannel: true,
        },
        data: { preferredChannel: false },
      });
    }

    const updated = await db.channelPriority.update({
      where: { id },
      data: {
        ...(priority !== undefined ? { priority } : {}),
        ...(syncOrder !== undefined ? { syncOrder } : {}),
        ...(preferredChannel !== undefined ? { preferredChannel } : {}),
        ...(inventoryWeight !== undefined ? { inventoryWeight } : {}),
        ...(rateWeight !== undefined ? { rateWeight } : {}),
        ...(bookingWeight !== undefined ? { bookingWeight } : {}),
        ...(maxInventoryPercent !== undefined ? { maxInventoryPercent } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating channel priority:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update channel priority' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/priority?id=X
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const record = await db.channelPriority.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Priority record not found' } },
        { status: 404 }
      );
    }

    await db.channelPriority.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id: record.id, deleted: true },
    });
  } catch (error) {
    console.error('Error deleting channel priority:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete channel priority' } },
      { status: 500 }
    );
  }
}
