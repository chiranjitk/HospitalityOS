import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// =====================================================
// HELPER: Parse action from query params or body
// =====================================================
function getAction(request: NextRequest): string | null {
  const urlAction = request.nextUrl.searchParams.get('action');
  return urlAction || null;
}

// =====================================================
// GET /api/channels/inventory-pool
//   - List pools (with optional ?action=availability&poolId=X&startDate=Y&endDate=Z)
// =====================================================
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const action = getAction(request);
    const tenantId = user.tenantId;

    // Availability action
    if (action === 'availability') {
      const poolId = request.nextUrl.searchParams.get('poolId');
      const startDateStr = request.nextUrl.searchParams.get('startDate');
      const endDateStr = request.nextUrl.searchParams.get('endDate');

      if (!poolId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolId is required' } },
          { status: 400 }
        );
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = startDateStr ? new Date(startDateStr) : today;
      const endDate = endDateStr ? new Date(endDateStr) : new Date(today.getTime() + 13 * 86400000);
      endDate.setHours(23, 59, 59, 999);

      // Verify pool belongs to tenant
      const pool = await db.inventoryPool.findFirst({
        where: { id: poolId, tenantId },
      });
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
          { status: 404 }
        );
      }

      // Get daily records
      const dailyRecords = await db.inventoryPoolDaily.findMany({
        where: {
          poolId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      });

      // Build date array and fill gaps
      const dates: string[] = [];
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
      }

      const dailyMap = new Map(dailyRecords.map(r => [r.date.toISOString().split('T')[0], r]));

      const availability = dates.map(dateStr => {
        const record = dailyMap.get(dateStr);
        const totalAvailable = pool.totalRooms - pool.bufferRooms;
        const totalBooked = record?.totalBooked || 0;
        const remaining = Math.max(0, totalAvailable - totalBooked);
        return {
          date: dateStr,
          totalAvailable,
          totalBooked,
          remaining,
          bufferRooms: pool.bufferRooms,
          allocations: record?.allocations ? JSON.parse(record.allocations) : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: { poolId: pool.id, poolName: pool.name, availability },
      });
    }

    // Default: list pools
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const where: any = { tenantId };
    if (propertyId) where.propertyId = propertyId;

    const pools = await db.inventoryPool.findMany({
      where,
      include: {
        poolChannels: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute stats
    const totalPools = pools.length;
    const totalRoomsPooled = pools.reduce((s, p) => s + p.totalRooms, 0);
    const activeChannels = new Set();
    for (const p of pools) {
      for (const ch of p.poolChannels) {
        if (ch.isActive) activeChannels.add(ch.connectionId);
      }
    }

    // Compute average utilization from daily data
    const allDaily = await db.inventoryPoolDaily.findMany({
      where: { tenantId: tenantId },
    });
    let totalUtil = 0;
    let utilCount = 0;
    for (const d of allDaily) {
      const avail = d.totalAvailable - d.bufferRooms;
      if (avail > 0) {
        totalUtil += (d.totalBooked / avail) * 100;
        utilCount++;
      }
    }
    const avgUtilization = utilCount > 0 ? Math.round(totalUtil / utilCount) : 0;

    return NextResponse.json({
      success: true,
      data: {
        pools,
        stats: {
          totalPools,
          totalRoomsPooled,
          activeChannels: activeChannels.size,
          avgUtilization,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching inventory pools:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory pools' } },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/channels/inventory-pool
//   - Create pool (default)
//   - ?action=add-channel : Add channel to pool
//   - ?action=calculate-allocation : Calculate daily allocations
// =====================================================
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const action = getAction(request);
    const tenantId = user.tenantId;
    const body = await request.json();

    // Add channel to pool
    if (action === 'add-channel') {
      const { poolId, connectionId, channelCode, weight, minAllocation, maxAllocation, priority } = body;

      if (!poolId || !connectionId || !channelCode) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolId, connectionId, and channelCode are required' } },
          { status: 400 }
        );
      }

      // Verify pool
      const pool = await db.inventoryPool.findFirst({
        where: { id: poolId, tenantId },
      });
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
          { status: 404 }
        );
      }

      // Check if channel already exists
      const existing = await db.inventoryPoolChannel.findUnique({
        where: { poolId_connectionId: { poolId, connectionId } },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: 'Channel already exists in this pool' } },
          { status: 409 }
        );
      }

      const channel = await db.inventoryPoolChannel.create({
        data: {
          tenantId,
          poolId,
          connectionId,
          channelCode,
          weight: weight ?? 1,
          minAllocation: minAllocation ?? 0,
          maxAllocation: maxAllocation ?? null,
          priority: priority ?? 0,
        },
      });

      return NextResponse.json({ success: true, data: channel });
    }

    // Calculate allocation
    if (action === 'calculate-allocation') {
      const { poolId, startDate, endDate } = body;

      if (!poolId || !startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolId, startDate, and endDate are required' } },
          { status: 400 }
        );
      }

      // Verify pool
      const pool = await db.inventoryPool.findFirst({
        where: { id: poolId, tenantId },
        include: { poolChannels: { where: { isActive: true } } },
      });
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
          { status: 404 }
        );
      }

      if (pool.poolChannels.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'No active channels in pool' } },
          { status: 400 }
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const channels = pool.poolChannels;
      const sellableRooms = Math.max(0, pool.totalRooms - pool.bufferRooms);

      // Build dates
      const dates: Date[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        dates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      const results: any[] = [];

      for (const date of dates) {
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        // Allocate based on strategy
        const allocations: Record<string, number> = {};

        switch (pool.allocationStrategy) {
          case 'equal': {
            const base = Math.floor(sellableRooms / channels.length);
            let remainder = sellableRooms - base * channels.length;
            for (const ch of channels) {
              let alloc = base + (remainder > 0 ? 1 : 0);
              if (remainder > 0) remainder--;
              alloc = Math.max(alloc, ch.minAllocation);
              if (ch.maxAllocation != null) alloc = Math.min(alloc, ch.maxAllocation);
              allocations[ch.connectionId] = alloc;
            }
            break;
          }
          case 'priority': {
            // Higher priority channels get rooms first
            const sorted = [...channels].sort((a, b) => b.priority - a.priority);
            let remaining = sellableRooms;
            for (const ch of sorted) {
              let alloc = Math.min(
                Math.max(ch.minAllocation, remaining),
                ch.maxAllocation ?? Infinity
              );
              remaining -= alloc;
              allocations[ch.connectionId] = alloc;
            }
            break;
          }
          case 'weighted': {
            const totalWeight = channels.reduce((s, ch) => s + ch.weight, 0);
            if (totalWeight === 0) break;
            let remaining = sellableRooms;
            const rawAllocs = channels.map(ch => ({
              connectionId: ch.connectionId,
              raw: (ch.weight / totalWeight) * sellableRooms,
              min: ch.minAllocation,
              max: ch.maxAllocation,
            }));

            // First pass: floor allocation
            for (const r of rawAllocs) {
              allocations[r.connectionId] = Math.max(Math.floor(r.raw), r.min);
              if (r.max != null) allocations[r.connectionId] = Math.min(allocations[r.connectionId], r.max);
            }
            const used = Object.values(allocations).reduce((s, v) => s + v, 0);
            let leftover = sellableRooms - used;
            if (leftover > 0) {
              // Distribute leftovers proportionally
              const fracParts = rawAllocs.map(r => ({
                connectionId: r.connectionId,
                frac: r.raw - Math.floor(r.raw),
                max: r.max,
              })).sort((a, b) => b.frac - a.frac);
              for (const fp of fracParts) {
                if (leftover <= 0) break;
                const add = Math.min(leftover, 1);
                if (fp.max == null || (allocations[fp.connectionId] + add) <= fp.max) {
                  allocations[fp.connectionId] += add;
                  leftover -= add;
                }
              }
            }
            break;
          }
          case 'percentage': {
            // weight is treated as percentage (0-100)
            const totalPct = channels.reduce((s, ch) => s + ch.weight, 0);
            if (totalPct === 0) break;
            let remaining = sellableRooms;
            for (const ch of channels) {
              let alloc = Math.round((ch.weight / totalPct) * sellableRooms);
              alloc = Math.max(alloc, ch.minAllocation);
              if (ch.maxAllocation != null) alloc = Math.min(alloc, ch.maxAllocation);
              allocations[ch.connectionId] = alloc;
              remaining -= alloc;
            }
            // Distribute any remainder to first channel that can take it
            if (remaining !== 0) {
              for (const ch of channels) {
                if (remaining === 0) break;
                const current = allocations[ch.connectionId];
                if (ch.maxAllocation == null || current + remaining <= ch.maxAllocation) {
                  allocations[ch.connectionId] += remaining;
                  remaining = 0;
                }
              }
            }
            break;
          }
        }

        // Upsert daily record
        const existing = await db.inventoryPoolDaily.findUnique({
          where: { poolId_date: { poolId, date: dateOnly } },
        });

        if (existing) {
          await db.inventoryPoolDaily.update({
            where: { id: existing.id },
            data: {
              totalAvailable: sellableRooms,
              bufferRooms: pool.bufferRooms,
              allocations: JSON.stringify(allocations),
            },
          });
        } else {
          await db.inventoryPoolDaily.create({
            data: {
              tenantId,
              poolId,
              date: dateOnly,
              totalAvailable: sellableRooms,
              totalBooked: 0,
              bufferRooms: pool.bufferRooms,
              allocations: JSON.stringify(allocations),
            },
          });
        }

        // Get channel names for response
        const connectionIds = Object.keys(allocations);
        const connections = connectionIds.length > 0
          ? await db.channelConnection.findMany({
              where: { id: { in: connectionIds } },
              select: { id: true, displayName: true, channel: true },
            })
          : [];

        const connMap = new Map(connections.map(c => [c.id, c]));

        results.push({
          date: dateOnly.toISOString().split('T')[0],
          sellableRooms,
          allocations: Object.entries(allocations).map(([connId, count]) => ({
            connectionId: connId,
            displayName: connMap.get(connId)?.displayName || connMap.get(connId)?.channel || connId,
            channelCode: connMap.get(connId)?.channel || '',
            allocated: count,
          })),
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          poolId: pool.id,
          poolName: pool.name,
          strategy: pool.allocationStrategy,
          totalRooms: pool.totalRooms,
          bufferRooms: pool.bufferRooms,
          sellableRooms,
          channelCount: channels.length,
          results,
        },
      });
    }

    // Default: create pool
    const { name, description, propertyId, roomTypeId, totalRooms, bufferRooms, overbookingLimit, allocationStrategy, channels } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } },
        { status: 400 }
      );
    }

    const pool = await db.inventoryPool.create({
      data: {
        tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        roomTypeId: roomTypeId || null,
        totalRooms: totalRooms ?? 0,
        bufferRooms: bufferRooms ?? 0,
        overbookingLimit: overbookingLimit ?? 0,
        allocationStrategy: allocationStrategy || 'equal',
      },
    });

    // Create channels if provided
    if (channels && Array.isArray(channels)) {
      for (const ch of channels) {
        if (!ch.connectionId || !ch.channelCode) continue;
        await db.inventoryPoolChannel.create({
          data: {
            tenantId,
            poolId: pool.id,
            connectionId: ch.connectionId,
            channelCode: ch.channelCode,
            weight: ch.weight ?? 1,
            minAllocation: ch.minAllocation ?? 0,
            maxAllocation: ch.maxAllocation ?? null,
            priority: ch.priority ?? 0,
          },
        });
      }
    }

    const createdPool = await db.inventoryPool.findFirst({
      where: { id: pool.id },
      include: { poolChannels: true },
    });

    return NextResponse.json({ success: true, data: createdPool });
  } catch (error: any) {
    console.error('Error in POST /api/channels/inventory-pool:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A record with this combination already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT /api/channels/inventory-pool
//   - Update pool settings (default)
//   - ?action=update-channel : Update channel allocation settings
// =====================================================
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const action = getAction(request);
    const tenantId = user.tenantId;
    const body = await request.json();

    // Update channel settings
    if (action === 'update-channel') {
      const { poolId, connectionId, weight, minAllocation, maxAllocation, priority, isActive } = body;

      if (!poolId || !connectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolId and connectionId are required' } },
          { status: 400 }
        );
      }

      // Verify pool belongs to tenant
      const pool = await db.inventoryPool.findFirst({
        where: { id: poolId, tenantId },
      });
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
          { status: 404 }
        );
      }

      const channel = await db.inventoryPoolChannel.findUnique({
        where: { poolId_connectionId: { poolId, connectionId } },
      });
      if (!channel) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found in pool' } },
          { status: 404 }
        );
      }

      const updated = await db.inventoryPoolChannel.update({
        where: { id: channel.id },
        data: {
          ...(weight !== undefined ? { weight } : {}),
          ...(minAllocation !== undefined ? { minAllocation } : {}),
          ...(maxAllocation !== undefined ? { maxAllocation } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // Default: update pool
    const { id, name, description, propertyId, roomTypeId, totalRooms, bufferRooms, overbookingLimit, allocationStrategy, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.inventoryPool.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      );
    }

    const updated = await db.inventoryPool.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(propertyId !== undefined ? { propertyId: propertyId || null } : {}),
        ...(roomTypeId !== undefined ? { roomTypeId: roomTypeId || null } : {}),
        ...(totalRooms !== undefined ? { totalRooms } : {}),
        ...(bufferRooms !== undefined ? { bufferRooms } : {}),
        ...(overbookingLimit !== undefined ? { overbookingLimit } : {}),
        ...(allocationStrategy !== undefined ? { allocationStrategy } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in PUT /api/channels/inventory-pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update pool' } },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/channels/inventory-pool
//   - Delete pool (default)
//   - ?action=remove-channel : Remove channel from pool
// =====================================================
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const action = getAction(request);
    const tenantId = user.tenantId;
    const body = await request.json();

    // Remove channel from pool
    if (action === 'remove-channel') {
      const { poolId, connectionId } = body;

      if (!poolId || !connectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolId and connectionId are required' } },
          { status: 400 }
        );
      }

      // Verify pool belongs to tenant
      const pool = await db.inventoryPool.findFirst({
        where: { id: poolId, tenantId },
      });
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
          { status: 404 }
        );
      }

      const channel = await db.inventoryPoolChannel.findUnique({
        where: { poolId_connectionId: { poolId, connectionId } },
      });
      if (!channel) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found in pool' } },
          { status: 404 }
        );
      }

      await db.inventoryPoolChannel.delete({
        where: { id: channel.id },
      });

      return NextResponse.json({
        success: true,
        data: { id: channel.id, removed: true },
      });
    }

    // Default: delete pool
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.inventoryPool.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found' } },
        { status: 404 }
      );
    }

    // Delete related records (cascade should handle, but be explicit)
    await db.inventoryPoolDaily.deleteMany({ where: { poolId: id } });
    await db.inventoryPoolChannel.deleteMany({ where: { poolId: id } });
    await db.inventoryPool.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('Error in DELETE /api/channels/inventory-pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete pool' } },
      { status: 500 }
    );
  }
}
