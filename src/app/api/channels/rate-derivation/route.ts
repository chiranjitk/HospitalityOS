import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// Helper: derive rate based on operation, adjustment value, and rounding method
function deriveRate(baseRate: number, operation: string, adjustmentValue: number, roundingMethod: string): number {
  let derived = baseRate;

  switch (operation) {
    case 'percentage':
      derived = baseRate * (1 + adjustmentValue / 100);
      break;
    case 'fixed_amount':
      derived = baseRate + adjustmentValue;
      break;
    case 'margin':
      // margin: derived = baseRate / (1 - marginPercent/100)
      if (adjustmentValue >= 100) return baseRate; // avoid division by zero or negative
      derived = baseRate / (1 - adjustmentValue / 100);
      break;
    case 'competitor_match':
      // competitor_match is essentially a percentage override
      derived = baseRate * (adjustmentValue / 100);
      break;
    default:
      derived = baseRate;
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
      // keep as-is with 2 decimal precision
      derived = Math.round(derived * 100) / 100;
      break;
  }

  return derived;
}

// Helper: apply min/max/floor/ceiling constraints
function applyConstraints(
  rate: number,
  minRate?: number | null,
  maxRate?: number | null,
  floorRate?: number | null,
  ceilingRate?: number | null,
): number {
  if (floorRate !== null && floorRate !== undefined && rate < floorRate) rate = floorRate;
  if (ceilingRate !== null && ceilingRate !== undefined && rate > ceilingRate) rate = ceilingRate;
  if (minRate !== null && minRate !== undefined && rate < minRate) rate = minRate;
  if (maxRate !== null && maxRate !== undefined && rate > maxRate) rate = maxRate;
  return rate;
}

// GET /api/channels/rate-derivation - List all derivation rules
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'channels.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const connectionId = searchParams.get('connectionId');
    const sourceRatePlanId = searchParams.get('sourceRatePlanId');
    const isActive = searchParams.get('isActive');
    const channelCode = searchParams.get('channelCode');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (sourceRatePlanId) where.sourceRatePlanId = sourceRatePlanId;
    if (channelCode) where.channelCode = channelCode;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const rules = await db.rateDerivationRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Enrich with source rate plan names and connection display names
    const ratePlanIds = [...new Set(rules.map(r => r.sourceRatePlanId))];
    const connectionIds = [...new Set(rules.map(r => r.connectionId).filter(Boolean))] as string[];

    const [ratePlans, connections] = await Promise.all([
      ratePlanIds.length > 0
        ? db.ratePlan.findMany({ where: { id: { in: ratePlanIds } }, select: { id: true, name: true } })
        : [],
      connectionIds.length > 0
        ? db.channelConnection.findMany({ where: { id: { in: connectionIds } }, select: { id: true, displayName: true, channel: true } })
        : [],
    ]);

    const ratePlanMap = new Map(ratePlans.map(rp => [rp.id, rp.name]));
    const connectionMap = new Map(connections.map(c => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }]));

    const enrichedRules = rules.map(rule => ({
      ...rule,
      sourceRatePlanName: ratePlanMap.get(rule.sourceRatePlanId) || 'Unknown',
      connectionDisplayName: rule.connectionId ? connectionMap.get(rule.connectionId)?.displayName || 'Unknown' : null,
      connectionChannel: rule.connectionId ? connectionMap.get(rule.connectionId)?.channel || null : null,
    }));

    const total = await db.rateDerivationRule.count({ where });

    return NextResponse.json({
      success: true,
      data: enrichedRules,
      pagination: { total },
    });
  } catch (error) {
    console.error('Error fetching rate derivation rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate derivation rules' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/rate-derivation - Create a new rule or perform actions
export async function POST(request: NextRequest) {
  const ctx = await requirePermission(request, 'channels.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    // Handle 'calculate' action
    if (action === 'calculate') {
      const { baseRate, ruleId } = body;
      if (!baseRate || baseRate < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseRate must be a positive number' } },
          { status: 400 }
        );
      }
      if (!ruleId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'ruleId is required' } },
          { status: 400 }
        );
      }

      const rule = await db.rateDerivationRule.findUnique({ where: { id: ruleId } });
      if (!rule) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
          { status: 404 }
        );
      }

      // Check effective dates
      const now = new Date();
      if (rule.effectiveFrom && now < rule.effectiveFrom) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_EFFECTIVE', message: 'Rule is not yet effective' } },
          { status: 400 }
        );
      }
      if (rule.effectiveTo && now > rule.effectiveTo) {
        return NextResponse.json(
          { success: false, error: { code: 'EXPIRED', message: 'Rule has expired' } },
          { status: 400 }
        );
      }
      if (!rule.isActive) {
        return NextResponse.json(
          { success: false, error: { code: 'INACTIVE', message: 'Rule is not active' } },
          { status: 400 }
        );
      }

      let derived = deriveRate(baseRate, rule.operation, rule.adjustmentValue, rule.roundingMethod);
      derived = applyConstraints(derived, rule.minRate, rule.maxRate, rule.floorRate, rule.ceilingRate);

      return NextResponse.json({
        success: true,
        data: {
          baseRate,
          derivedRate: derived,
          ruleId: rule.id,
          ruleName: rule.name,
          operation: rule.operation,
          adjustmentValue: rule.adjustmentValue,
          roundingMethod: rule.roundingMethod,
          floorRate: rule.floorRate,
          ceilingRate: rule.ceilingRate,
          minRate: rule.minRate,
          maxRate: rule.maxRate,
        },
      });
    }

    // Handle 'bulk-calculate' action
    if (action === 'bulk-calculate') {
      const { baseRate, ruleIds, dateRange } = body;
      if (!baseRate || baseRate < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseRate must be a positive number' } },
          { status: 400 }
        );
      }
      if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'ruleIds must be a non-empty array' } },
          { status: 400 }
        );
      }

      const rules = await db.rateDerivationRule.findMany({
        where: { id: { in: ruleIds } },
      });

      if (rules.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'No rules found' } },
          { status: 404 }
        );
      }

      // Generate date range
      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date();
      const endDate = dateRange?.end ? new Date(dateRange.end) : new Date(startDate);
      const dates: string[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // Calculate for each rule per date
      const results = rules.map(rule => {
        const dateResults = dates.map(date => {
          // Check appliesTo logic
          const dayOfWeek = new Date(date).getDay(); // 0=Sun, 6=Sat
          let applies = false;
          switch (rule.appliesTo) {
            case 'all': applies = true; break;
            case 'weekdays': applies = dayOfWeek >= 1 && dayOfWeek <= 5; break;
            case 'weekends': applies = dayOfWeek === 0 || dayOfWeek === 6; break;
            case 'specific_dates':
              if (rule.specificDates) {
                try {
                  const dateRanges = JSON.parse(rule.specificDates);
                  applies = dateRanges.some((dr: { start: string; end: string }) => date >= dr.start && date <= dr.end);
                } catch { applies = true; }
              }
              break;
            default: applies = true;
          }

          if (!applies || !rule.isActive) {
            return { date, applies: false, baseRate, derivedRate: baseRate };
          }

          let derived = deriveRate(baseRate, rule.operation, rule.adjustmentValue, rule.roundingMethod);
          derived = applyConstraints(derived, rule.minRate, rule.maxRate, rule.floorRate, rule.ceilingRate);
          return { date, applies: true, baseRate, derivedRate: derived };
        });

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          operation: rule.operation,
          adjustmentValue: rule.adjustmentValue,
          results: dateResults,
        };
      });

      return NextResponse.json({
        success: true,
        data: { dates, rules: results },
      });
    }

    // Default: create a new rule
    const {
      tenantId,
      name,
      description,
      connectionId,
      sourceRatePlanId,
      channelCode,
      operation,
      adjustmentValue,
      roundingMethod,
      minRate,
      maxRate,
      floorRate,
      ceilingRate,
      appliesTo,
      specificDates,
      priority,
      isActive,
      effectiveFrom,
      effectiveTo,
    } = body;

    // Validate required fields
    if (!tenantId || !name || !sourceRatePlanId || adjustmentValue === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId, name, sourceRatePlanId, and adjustmentValue are required' } },
        { status: 400 }
      );
    }

    // Validate operation
    const validOperations = ['percentage', 'fixed_amount', 'margin', 'competitor_match'];
    if (operation && !validOperations.includes(operation)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid operation. Must be one of: ${validOperations.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate rounding method
    const validRounding = ['nearest', 'up', 'down', 'none'];
    if (roundingMethod && !validRounding.includes(roundingMethod)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid roundingMethod. Must be one of: ${validRounding.join(', ')}` } },
        { status: 400 }
      );
    }

    const rule = await db.rateDerivationRule.create({
      data: {
        tenantId,
        name,
        description: description || null,
        connectionId: connectionId || null,
        sourceRatePlanId,
        channelCode: channelCode || null,
        operation: operation || 'percentage',
        adjustmentValue,
        roundingMethod: roundingMethod || 'nearest',
        minRate: minRate !== undefined && minRate !== null ? minRate : null,
        maxRate: maxRate !== undefined && maxRate !== null ? maxRate : null,
        floorRate: floorRate !== undefined && floorRate !== null ? floorRate : null,
        ceilingRate: ceilingRate !== undefined && ceilingRate !== null ? ceilingRate : null,
        appliesTo: appliesTo || 'all',
        specificDates: specificDates || null,
        priority: priority !== undefined ? priority : 0,
        isActive: isActive !== undefined ? isActive : true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error in rate-derivation POST:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/rate-derivation - Update an existing rule
export async function PUT(request: NextRequest) {
  const ctx = await requirePermission(request, 'channels.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    // Verify rule exists
    const existing = await db.rateDerivationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    // Build update data (whitelist allowed fields)
    const ALLOWED_FIELDS = [
      'name', 'description', 'connectionId', 'sourceRatePlanId', 'channelCode',
      'operation', 'adjustmentValue', 'roundingMethod', 'minRate', 'maxRate',
      'floorRate', 'ceilingRate', 'appliesTo', 'specificDates', 'priority',
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

    const rule = await db.rateDerivationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error updating rate derivation rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate derivation rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/rate-derivation - Delete a rule
export async function DELETE(request: NextRequest) {
  const ctx = await requirePermission(request, 'channels.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    // Verify rule exists
    const existing = await db.rateDerivationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    await db.rateDerivationRule.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Rate derivation rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rate derivation rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate derivation rule' } },
      { status: 500 }
    );
  }
}
