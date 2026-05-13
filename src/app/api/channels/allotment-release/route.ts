import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere } from '@/lib/auth/tenant-context';

// =====================================================
// GET /api/channels/allotment-release
// Query params: connectionId, channelCode, roomTypeId, isActive, action=logs, ruleId, startDate, endDate
// =====================================================
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    // ---- Logs action ----
    if (action === 'logs') {
      const ruleId = searchParams.get('ruleId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

      const where: Record<string, unknown> = tenantWhere(user);
      if (ruleId) where.ruleId = ruleId;
      if (startDate || endDate) {
        where.date = {};
        if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        db.allotmentReleaseLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.allotmentReleaseLog.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: { logs, total, page, limit, pages: Math.ceil(total / limit) },
      });
    }

    // ---- Stats action ----
    if (action === 'stats') {
      const [totalRules, activeRules, totalReleasedResult, pendingRelease] = await Promise.all([
        db.allotmentReleaseRule.count({ where: tenantWhere(user) }),
        db.allotmentReleaseRule.count({ where: tenantWhere(user, { isActive: true }) }),
        db.allotmentReleaseLog.aggregate({
          _sum: { roomsReleased: true },
          where: tenantWhere(user),
        }),
        db.allotmentReleaseRule.count({
          where: tenantWhere(user, { isActive: true, autoRelease: true }),
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalRules,
          activeRules,
          totalReleased: totalReleasedResult._sum.roomsReleased || 0,
          pendingRelease,
        },
      });
    }

    // ---- Default: List rules ----
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const roomTypeId = searchParams.get('roomTypeId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = tenantWhere(user);
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const rules = await db.allotmentReleaseRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { rules } });
  } catch (error) {
    console.error('[AllotmentRelease] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch allotment release data' } },
      { status: 500 },
    );
  }
}

// =====================================================
// POST /api/channels/allotment-release
// Body can be:
//   { action: "create", ...ruleData }
//   { action: "update", id, ...ruleData }
//   { action: "delete", id }
//   { action: "preview", ruleId, startDate, endDate }
//   { action: "release-now", ruleId, dates[] }
//   { action: "process-releases" }
// =====================================================
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return handleCreate(user, body);
      case 'update':
        return handleUpdate(user, body);
      case 'delete':
        return handleDelete(user, body);
      case 'preview':
        return handlePreview(user, body);
      case 'release-now':
        return handleReleaseNow(user, body);
      case 'process-releases':
        return handleProcessReleases(user);
      default:
        // Default to create if no action specified
        return handleCreate(user, body);
    }
  } catch (error) {
    console.error('[AllotmentRelease] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } },
      { status: 500 },
    );
  }
}

// =====================================================
// PUT /api/channels/allotment-release
// =====================================================
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    return handleUpdate(user, body);
  } catch (error) {
    console.error('[AllotmentRelease] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rule' } },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE /api/channels/allotment-release?id=X
// =====================================================
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
      { status: 400 },
    );
  }

  return handleDelete(user, { id });
}

// =====================================================
// HANDLERS
// =====================================================

async function handleCreate(user: { tenantId: string }, body: Record<string, unknown>) {
  const {
    propertyId,
    connectionId,
    channelCode,
    roomTypeId,
    releaseType = 'graduated',
    releaseSchedule = '[]',
    releaseAllDays = 7,
    releasePercentPerDay = 10,
    startReleaseFrom,
    endReleaseAt,
    minAllotment = 0,
    autoRelease = true,
    isActive = true,
  } = body;

  if (!channelCode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode is required' } },
      { status: 400 },
    );
  }

  // Validate releaseSchedule JSON
  let parsedSchedule: unknown[];
  try {
    parsedSchedule = JSON.parse(releaseSchedule as string);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'releaseSchedule must be valid JSON' } },
      { status: 400 },
    );
  }

  const rule = await db.allotmentReleaseRule.create({
    data: {
      tenantId: user.tenantId,
      propertyId: (propertyId as string) || null,
      connectionId: (connectionId as string) || null,
      channelCode: channelCode as string,
      roomTypeId: (roomTypeId as string) || null,
      releaseType: releaseType as string,
      releaseSchedule: JSON.stringify(parsedSchedule),
      releaseAllDays: releaseAllDays as number,
      releasePercentPerDay: releasePercentPerDay as number,
      startReleaseFrom: startReleaseFrom ? new Date(startReleaseFrom as string) : null,
      endReleaseAt: endReleaseAt ? new Date(endReleaseAt as string) : null,
      minAllotment: minAllotment as number,
      autoRelease: autoRelease as boolean,
      isActive: isActive as boolean,
    },
  });

  return NextResponse.json({ success: true, data: { rule } });
}

async function handleUpdate(user: { tenantId: string }, body: Record<string, unknown>) {
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
      { status: 400 },
    );
  }

  // Verify rule belongs to tenant
  const existing = await db.allotmentReleaseRule.findFirst({
    where: { id: id as string, tenantId: user.tenantId },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      { status: 404 },
    );
  }

  // Build update data
  const data: Record<string, unknown> = {};
  if (updates.channelCode !== undefined) data.channelCode = updates.channelCode;
  if (updates.connectionId !== undefined) data.connectionId = (updates.connectionId as string) || null;
  if (updates.propertyId !== undefined) data.propertyId = (updates.propertyId as string) || null;
  if (updates.roomTypeId !== undefined) data.roomTypeId = (updates.roomTypeId as string) || null;
  if (updates.releaseType !== undefined) data.releaseType = updates.releaseType;
  if (updates.releaseSchedule !== undefined) {
    try {
      JSON.parse(updates.releaseSchedule as string);
      data.releaseSchedule = updates.releaseSchedule;
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'releaseSchedule must be valid JSON' } },
        { status: 400 },
      );
    }
  }
  if (updates.releaseAllDays !== undefined) data.releaseAllDays = updates.releaseAllDays;
  if (updates.releasePercentPerDay !== undefined) data.releasePercentPerDay = updates.releasePercentPerDay;
  if (updates.startReleaseFrom !== undefined) data.startReleaseFrom = updates.startReleaseFrom ? new Date(updates.startReleaseFrom as string) : null;
  if (updates.endReleaseAt !== undefined) data.endReleaseAt = updates.endReleaseAt ? new Date(updates.endReleaseAt as string) : null;
  if (updates.minAllotment !== undefined) data.minAllotment = updates.minAllotment;
  if (updates.autoRelease !== undefined) data.autoRelease = updates.autoRelease;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  const rule = await db.allotmentReleaseRule.update({
    where: { id: id as string },
    data,
  });

  return NextResponse.json({ success: true, data: { rule } });
}

async function handleDelete(user: { tenantId: string }, body: Record<string, unknown>) {
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
      { status: 400 },
    );
  }

  const existing = await db.allotmentReleaseRule.findFirst({
    where: { id: id as string, tenantId: user.tenantId },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      { status: 404 },
    );
  }

  await db.allotmentReleaseRule.delete({
    where: { id: id as string },
  });

  return NextResponse.json({ success: true, data: { deleted: true, id } });
}

async function handlePreview(user: { tenantId: string }, body: Record<string, unknown>) {
  const { ruleId, startDate, endDate } = body;

  if (!ruleId || !startDate || !endDate) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'ruleId, startDate, and endDate are required' } },
      { status: 400 },
    );
  }

  const rule = await db.allotmentReleaseRule.findFirst({
    where: { id: ruleId as string, tenantId: user.tenantId },
  });
  if (!rule) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      { status: 404 },
    );
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate preview releases for each date in range
  const previewItems: Array<{
    date: string;
    daysBeforeArrival: number;
    releasePercent: number;
    currentAllotment: number;
    estimatedRelease: number;
    estimatedAfter: number;
  }> = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    const arrivalDate = new Date(cursor);
    arrivalDate.setHours(0, 0, 0, 0);
    const diffMs = arrivalDate.getTime() - today.getTime();
    const daysBefore = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysBefore <= 0) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const { releasePercent } = calculateRelease(rule, daysBefore);

    // Find current allocation for this date
    let currentAllotment = 0;
    if (rule.connectionId && rule.roomTypeId) {
      const alloc = await db.channelRestriction.findUnique({
        where: {
          connectionId_roomTypeId_startDate: {
            connectionId: rule.connectionId,
            roomTypeId: rule.roomTypeId,
            startDate: cursor,
          },
        },
      });
      if (alloc && !alloc.closed) {
        currentAllotment = Math.round(alloc.rateMin || 0);
      }
    }

    const estimatedRelease = Math.max(0, Math.round(currentAllotment * (releasePercent / 100)));
    const estimatedAfter = Math.max(rule.minAllotment, currentAllotment - estimatedRelease);

    previewItems.push({
      date: cursor.toISOString().split('T')[0],
      daysBeforeArrival: daysBefore,
      releasePercent,
      currentAllotment,
      estimatedRelease,
      estimatedAfter,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({
    success: true,
    data: {
      ruleId: rule.id,
      channelCode: rule.channelCode,
      releaseType: rule.releaseType,
      preview: previewItems,
    },
  });
}

async function handleReleaseNow(user: { tenantId: string }, body: Record<string, unknown>) {
  const { ruleId, dates } = body;

  if (!ruleId || !dates || !Array.isArray(dates)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'ruleId and dates array are required' } },
      { status: 400 },
    );
  }

  const rule = await db.allotmentReleaseRule.findFirst({
    where: { id: ruleId as string, tenantId: user.tenantId },
  });
  if (!rule) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      { status: 404 },
    );
  }

  if (!rule.connectionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule must have a connectionId to release' } },
      { status: 400 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: unknown[] = [];

  for (const dateStr of dates) {
    const arrivalDate = new Date(dateStr as string);
    arrivalDate.setHours(0, 0, 0, 0);
    const diffMs = arrivalDate.getTime() - today.getTime();
    const daysBefore = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysBefore <= 0) continue;

    const { releasePercent } = calculateRelease(rule, daysBefore);
    if (releasePercent <= 0) continue;

    // Find current allocation
    let allocRecord = await db.channelRestriction.findUnique({
      where: {
        connectionId_roomTypeId_startDate: {
          connectionId: rule.connectionId,
          roomTypeId: rule.roomTypeId || '',
          startDate: arrivalDate,
        },
      },
    });

    if (!allocRecord || allocRecord.closed) continue;

    const currentAllotment = Math.round(allocRecord.rateMin || 0);
    const roomsToRelease = Math.max(0, Math.round(currentAllotment * (releasePercent / 100)));
    const newAllotment = Math.max(rule.minAllotment, currentAllotment - roomsToRelease);

    if (roomsToRelease === 0) continue;

    // Update the allocation
    await db.channelRestriction.update({
      where: { id: allocRecord.id },
      data: {
        rateMin: newAllotment,
        syncStatus: 'pending',
      },
    });

    // Create release log
    const log = await db.allotmentReleaseLog.create({
      data: {
        tenantId: user.tenantId,
        ruleId: rule.id,
        connectionId: rule.connectionId,
        channelCode: rule.channelCode,
        roomTypeId: rule.roomTypeId,
        date: arrivalDate,
        roomsReleased: roomsToRelease,
        roomsBefore: currentAllotment,
        roomsAfter: newAllotment,
        releaseType: rule.releaseType,
        daysBeforeArrival: daysBefore,
        triggeredBy: 'manual',
      },
    });

    results.push(log);
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: results.length,
      releases: results,
    },
  });
}

async function handleProcessReleases(user: { tenantId: string }) {
  // Find all active auto-release rules
  const rules = await db.allotmentReleaseRule.findMany({
    where: tenantWhere(user, { isActive: true, autoRelease: true }),
  });

  if (rules.length === 0) {
    return NextResponse.json({
      success: true,
      data: { processed: 0, releases: [], message: 'No active auto-release rules found' },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allReleases: unknown[] = [];
  let totalReleased = 0;

  for (const rule of rules) {
    if (!rule.connectionId || !rule.roomTypeId) continue;

    // Check effective date range
    if (rule.startReleaseFrom && rule.startReleaseFrom > today) continue;
    if (rule.endReleaseAt && rule.endReleaseAt < today) continue;

    // Look ahead 90 days for releases
    const lookAheadEnd = new Date(today);
    lookAheadEnd.setDate(lookAheadEnd.getDate() + 90);

    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1); // Start from tomorrow

    while (cursor <= lookAheadEnd) {
      const diffMs = cursor.getTime() - today.getTime();
      const daysBefore = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const { releasePercent } = calculateRelease(rule, daysBefore);
      if (releasePercent <= 0) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      // Find allocation for this date
      let allocRecord;
      try {
        allocRecord = await db.channelRestriction.findUnique({
          where: {
            connectionId_roomTypeId_startDate: {
              connectionId: rule.connectionId,
              roomTypeId: rule.roomTypeId,
              startDate: cursor,
            },
          },
        });
      } catch {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      if (!allocRecord || allocRecord.closed) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const currentAllotment = Math.round(allocRecord.rateMin || 0);

      // Check if already processed for this date and rule today
      const existingLog = await db.allotmentReleaseLog.findFirst({
        where: {
          ruleId: rule.id,
          connectionId: rule.connectionId,
          date: cursor,
          createdAt: { gte: new Date(today.getTime() - 24 * 60 * 60 * 1000) },
        },
      });

      if (existingLog) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const roomsToRelease = Math.max(0, Math.round(currentAllotment * (releasePercent / 100)));
      const newAllotment = Math.max(rule.minAllotment, currentAllotment - roomsToRelease);

      if (roomsToRelease === 0) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      // Update allocation
      await db.channelRestriction.update({
        where: { id: allocRecord.id },
        data: {
          rateMin: newAllotment,
          syncStatus: 'pending',
        },
      });

      // Create release log
      const log = await db.allotmentReleaseLog.create({
        data: {
          tenantId: user.tenantId,
          ruleId: rule.id,
          connectionId: rule.connectionId,
          channelCode: rule.channelCode,
          roomTypeId: rule.roomTypeId,
          date: cursor,
          roomsReleased: roomsToRelease,
          roomsBefore: currentAllotment,
          roomsAfter: newAllotment,
          releaseType: rule.releaseType,
          daysBeforeArrival: daysBefore,
          triggeredBy: 'auto',
        },
      });

      allReleases.push(log);
      totalReleased += roomsToRelease;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: allReleases.length,
      totalRoomsReleased: totalReleased,
      releases: allReleases,
    },
  });
}

// =====================================================
// HELPERS
// =====================================================

interface ReleaseCalculation {
  releasePercent: number;
}

function calculateRelease(rule: {
  releaseType: string;
  releaseSchedule: string;
  releaseAllDays: number;
  releasePercentPerDay: number;
}, daysBefore: number): ReleaseCalculation {
  if (rule.releaseType === 'fixed') {
    // Release all rooms N days before arrival
    if (daysBefore <= rule.releaseAllDays) {
      return { releasePercent: 100 };
    }
    return { releasePercent: 0 };
  }

  if (rule.releaseType === 'percentage') {
    // Release X% per day as arrival approaches
    // Calculate based on how many "release days" have passed
    const daysIntoRelease = Math.max(0, rule.releaseAllDays - daysBefore);
    const releasePercent = Math.min(100, daysIntoRelease * rule.releasePercentPerDay);
    return { releasePercent };
  }

  // Default: graduated release
  try {
    const schedule: Array<{ daysBefore: number; releasePercent: number }> = JSON.parse(rule.releaseSchedule);
    if (!schedule || schedule.length === 0) return { releasePercent: 0 };

    // Sort by daysBefore ascending (so closest to arrival has highest priority)
    const sorted = [...schedule].sort((a, b) => a.daysBefore - b.daysBefore);

    // Find the applicable step: the step whose daysBefore is >= current daysBefore
    // This gives us the cumulative release percentage
    let applicablePercent = 0;
    for (const step of sorted) {
      if (daysBefore <= step.daysBefore) {
        applicablePercent = Math.max(applicablePercent, step.releasePercent);
      }
    }

    return { releasePercent: applicablePercent };
  } catch {
    return { releasePercent: 0 };
  }
}
