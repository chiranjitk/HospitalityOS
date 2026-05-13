import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// HELPERS
// ============================================

function deriveRate(
  sourceRate: number,
  derivationType: string,
  adjustmentValue: number,
  roundingMethod: string,
  floorRate?: number | null,
  ceilingRate?: number | null,
): number {
  let derived = sourceRate;

  switch (derivationType) {
    case 'percentage':
      derived = sourceRate * (1 + adjustmentValue / 100);
      break;
    case 'fixed_amount':
      derived = sourceRate + adjustmentValue;
      break;
    case 'margin':
      if (adjustmentValue >= 100) return sourceRate;
      derived = sourceRate / (1 - adjustmentValue / 100);
      break;
    case 'seasonal_percentage':
      // Same as percentage but designed for seasonal overrides
      derived = sourceRate * (1 + adjustmentValue / 100);
      break;
    case 'competitor_based':
      derived = sourceRate * (adjustmentValue / 100);
      break;
    default:
      derived = sourceRate;
  }

  // Apply rounding
  switch (roundingMethod) {
    case 'up':
      derived = Math.ceil(derived);
      break;
    case 'down':
      derived = Math.floor(derived);
      break;
    case 'nearest':
      derived = Math.round(derived);
      break;
    case 'none':
    default:
      derived = Math.round(derived * 100) / 100;
      break;
  }

  // Apply floor / ceiling
  if (floorRate !== null && floorRate !== undefined && derived < floorRate) derived = floorRate;
  if (ceilingRate !== null && ceilingRate !== undefined && derived > ceilingRate) derived = ceilingRate;

  return derived;
}

function appliesToDate(appliesTo: string, date: Date, specificDates?: string | null): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  switch (appliesTo) {
    case 'all':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekends':
      return day === 0 || day === 6;
    case 'specific_dates':
      if (!specificDates) return true;
      try {
        const ranges = JSON.parse(specificDates) as Array<{ start: string; end: string }>;
        const dateStr = date.toISOString().split('T')[0];
        return ranges.some((r) => dateStr >= r.start && dateStr <= r.end);
      } catch {
        return true;
      }
    default:
      return true;
  }
}

const SAMPLE_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================
// GET - List derived rate plans or handle actions
// ============================================
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Handle "preview" action
    if (action === 'preview') {
      return handlePreview(searchParams);
    }

    // Handle "snapshots" action
    if (action === 'snapshots') {
      return handleSnapshots(searchParams);
    }

    // Default: list derived rate plans
    const tenantId = searchParams.get('tenantId') || SAMPLE_TENANT_ID;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const sourceRatePlanId = searchParams.get('sourceRatePlanId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (sourceRatePlanId) where.sourceRatePlanId = sourceRatePlanId;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const plans = await db.derivedRatePlan.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Enrich with source rate plan names and connection display names
    const ratePlanIds = [...new Set(plans.map((p) => p.sourceRatePlanId))];
    const connectionIds = [...new Set(plans.map((p) => p.connectionId).filter(Boolean))] as string[];

    const [ratePlans, connections] = await Promise.all([
      ratePlanIds.length > 0
        ? db.ratePlan.findMany({ where: { id: { in: ratePlanIds } }, select: { id: true, name: true, basePrice: true } })
        : [],
      connectionIds.length > 0
        ? db.channelConnection.findMany({ where: { id: { in: connectionIds } }, select: { id: true, displayName: true, channel: true } })
        : [],
    ]);

    const rpMap = new Map(ratePlans.map((rp) => [rp.id, rp]));
    const connMap = new Map(connections.map((c) => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }]));

    const enrichedPlans = plans.map((plan) => {
      const rp = rpMap.get(plan.sourceRatePlanId);
      const conn = plan.connectionId ? connMap.get(plan.connectionId) : null;
      return {
        ...plan,
        sourceRatePlanName: rp?.name || 'Unknown',
        sourceBasePrice: rp?.basePrice || 0,
        connectionDisplayName: conn?.displayName || null,
        connectionChannel: conn?.channel || null,
      };
    });

    const total = await db.derivedRatePlan.count({ where });

    return NextResponse.json({
      success: true,
      data: enrichedPlans,
      pagination: { total },
    });
  } catch (error) {
    console.error('Error fetching derived rate plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch derived rate plans' } },
      { status: 500 },
    );
  }
}

// ============================================
// POST - Create derived plan or handle actions
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle "generate" action
    if (action === 'generate') {
      return handleGenerate(body);
    }

    // Handle "sync" action
    if (action === 'sync') {
      return handleSync(body);
    }

    // Default: create a new derived rate plan
    const {
      tenantId,
      name,
      description,
      connectionId,
      channelCode,
      sourceRatePlanId,
      roomTypeId,
      derivationType,
      adjustmentValue,
      roundingMethod,
      floorRate,
      ceilingRate,
      minStay,
      maxStay,
      appliesTo,
      specificDates,
      autoSync,
      syncInterval,
      isActive,
      effectiveFrom,
      effectiveTo,
    } = body;

    if (!name || !sourceRatePlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name and sourceRatePlanId are required' } },
        { status: 400 },
      );
    }

    const validDerivationTypes = ['percentage', 'fixed_amount', 'margin', 'seasonal_percentage', 'competitor_based'];
    if (derivationType && !validDerivationTypes.includes(derivationType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid derivationType. Must be: ${validDerivationTypes.join(', ')}` } },
        { status: 400 },
      );
    }

    const plan = await db.derivedRatePlan.create({
      data: {
        tenantId: tenantId || SAMPLE_TENANT_ID,
        name,
        description: description || null,
        connectionId: connectionId || null,
        channelCode: channelCode || '',
        sourceRatePlanId,
        roomTypeId: roomTypeId || null,
        derivationType: derivationType || 'percentage',
        adjustmentValue: adjustmentValue ?? 0,
        roundingMethod: roundingMethod || 'nearest',
        floorRate: floorRate ?? null,
        ceilingRate: ceilingRate ?? null,
        minStay: minStay ?? null,
        maxStay: maxStay ?? null,
        appliesTo: appliesTo || 'all',
        specificDates: specificDates || null,
        autoSync: autoSync ?? true,
        syncInterval: syncInterval ?? 60,
        isActive: isActive ?? true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating derived rate plan:', error);
    const msg = error instanceof Error && error.message.includes('Unique')
      ? 'A derived rate plan with this combination already exists'
      : 'Failed to create derived rate plan';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500 },
    );
  }
}

// ============================================
// PUT - Update a derived rate plan
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Plan ID is required' } },
        { status: 400 },
      );
    }

    const existing = await db.derivedRatePlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Derived rate plan not found' } },
        { status: 404 },
      );
    }

    const ALLOWED_FIELDS = [
      'name', 'description', 'connectionId', 'channelCode', 'sourceRatePlanId', 'roomTypeId',
      'derivationType', 'adjustmentValue', 'roundingMethod', 'floorRate', 'ceilingRate',
      'minStay', 'maxStay', 'appliesTo', 'specificDates', 'autoSync', 'syncInterval',
      'isActive', 'effectiveFrom', 'effectiveTo',
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

    const plan = await db.derivedRatePlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error updating derived rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update derived rate plan' } },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE - Delete a derived rate plan
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Plan ID is required' } },
        { status: 400 },
      );
    }

    const existing = await db.derivedRatePlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Derived rate plan not found' } },
        { status: 404 },
      );
    }

    // Delete snapshots first
    await db.derivedRateSnapshot.deleteMany({ where: { derivedPlanId: id } });
    await db.derivedRatePlan.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Derived rate plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting derived rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete derived rate plan' } },
      { status: 500 },
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handlePreview(searchParams: URLSearchParams) {
  const planId = searchParams.get('planId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const baseRateStr = searchParams.get('baseRate');

  if (!planId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'planId is required' } },
      { status: 400 },
    );
  }

  const plan = await db.derivedRatePlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Derived rate plan not found' } },
      { status: 404 },
    );
  }

  // Get source rate plan base price if no baseRate provided
  let baseRate = baseRateStr ? parseFloat(baseRateStr) : 0;
  if (!baseRate) {
    const rp = await db.ratePlan.findUnique({ where: { id: plan.sourceRatePlanId }, select: { basePrice: true } });
    baseRate = rp?.basePrice || 0;
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
  endDate.setDate(endDate.getDate() + 30); // Default 30 days

  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const previewRows = dates.map((dateStr) => {
    const date = new Date(dateStr);
    const applies = appliesToDate(plan.appliesTo, date, plan.specificDates);
    if (!applies) {
      return { date: dateStr, sourceRate: baseRate, derivedRate: baseRate, adjustmentApplied: 0, applies: false };
    }
    const derived = deriveRate(baseRate, plan.derivationType, plan.adjustmentValue, plan.roundingMethod, plan.floorRate, plan.ceilingRate);
    return {
      date: dateStr,
      sourceRate: baseRate,
      derivedRate: derived,
      adjustmentApplied: derived - baseRate,
      applies: true,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      planId: plan.id,
      planName: plan.name,
      derivationType: plan.derivationType,
      adjustmentValue: plan.adjustmentValue,
      floorRate: plan.floorRate,
      ceilingRate: plan.ceilingRate,
      dateRange: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      rows: previewRows,
    },
  });
}

async function handleSnapshots(searchParams: URLSearchParams) {
  const derivedPlanId = searchParams.get('derivedPlanId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  if (!derivedPlanId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'derivedPlanId is required' } },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = { derivedPlanId };
  if (startDateStr && endDateStr) {
    where.date = { gte: new Date(startDateStr), lte: new Date(endDateStr) };
  }

  const snapshots = await db.derivedRateSnapshot.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ success: true, data: snapshots });
}

async function handleGenerate(body: Record<string, unknown>) {
  const { planId, startDate, endDate, baseRate: baseRateStr } = body;

  if (!planId || !startDate || !endDate) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'planId, startDate, and endDate are required' } },
      { status: 400 },
    );
  }

  const plan = await db.derivedRatePlan.findUnique({ where: { id: planId as string } });
  if (!plan) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Derived rate plan not found' } },
      { status: 404 },
    );
  }

  let baseRate = baseRateStr ? parseFloat(baseRateStr as string) : 0;
  if (!baseRate) {
    const rp = await db.ratePlan.findUnique({ where: { id: plan.sourceRatePlanId }, select: { basePrice: true } });
    baseRate = rp?.basePrice || 0;
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  const created: unknown[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const date = new Date(current);

    if (!appliesToDate(plan.appliesTo, date, plan.specificDates)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const derived = deriveRate(baseRate, plan.derivationType, plan.adjustmentValue, plan.roundingMethod, plan.floorRate, plan.ceilingRate);

    const snapshot = await db.derivedRateSnapshot.upsert({
      where: {
        derivedPlanId_date: {
          derivedPlanId: plan.id,
          date: new Date(dateStr),
        },
      },
      create: {
        tenantId: plan.tenantId,
        derivedPlanId: plan.id,
        date: new Date(dateStr),
        sourceRate: baseRate,
        derivedRate: derived,
        adjustmentApplied: derived - baseRate,
      },
      update: {
        sourceRate: baseRate,
        derivedRate: derived,
        adjustmentApplied: derived - baseRate,
      },
    });

    created.push(snapshot);
    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json({
    success: true,
    data: { count: created.length, snapshots: created },
    message: `Generated ${created.length} rate snapshots`,
  });
}

async function handleSync(body: Record<string, unknown>) {
  const { planId } = body;

  if (!planId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'planId is required' } },
      { status: 400 },
    );
  }

  const plan = await db.derivedRatePlan.findUnique({ where: { id: planId as string } });
  if (!plan) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Derived rate plan not found' } },
      { status: 404 },
    );
  }

  if (!plan.connectionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Plan has no channel connection configured' } },
      { status: 400 },
    );
  }

  // Simulate sync to channel
  // In production, this would push rates via the channel API (Booking.com, Expedia, etc.)
  const now = new Date();
  const syncStatus = 'success';

  await db.derivedRatePlan.update({
    where: { id: plan.id },
    data: {
      lastSyncAt: now,
      lastSyncStatus: syncStatus,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      planId: plan.id,
      channelCode: plan.channelCode,
      syncStatus,
      syncedAt: now.toISOString(),
    },
    message: `Successfully synced rates to ${plan.channelCode}`,
  });
}
