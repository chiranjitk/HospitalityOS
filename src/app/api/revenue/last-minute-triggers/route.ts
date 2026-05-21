import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  getTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  evaluateLastMinuteTriggers,
  runLastMinuteAutomation,
  getTriggerLogs,
} from '@/lib/revenue/last-minute-triggers';

/**
 * GET /api/revenue/last-minute-triggers
 * - List triggers + execution log
 * - Query params: propertyId (required), logs (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const includeLogs = searchParams.get('logs') === 'true';

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    // Get triggers
    const triggers = await getTriggers(ctx.tenantId, propertyId);

    // Get logs if requested
    const logs = includeLogs ? await getTriggerLogs(ctx.tenantId, propertyId) : [];

    // Summary stats
    const enabledCount = triggers.filter(t => t.enabled).length;
    const actionBreakdown = {
      increase_rate: triggers.filter(t => t.action === 'increase_rate').length,
      decrease_rate: triggers.filter(t => t.action === 'decrease_rate').length,
      send_offer: triggers.filter(t => t.action === 'send_offer').length,
      release_inventory: triggers.filter(t => t.action === 'release_inventory').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        triggers,
        logs,
        summary: {
          total: triggers.length,
          enabled: enabledCount,
          disabled: triggers.length - enabledCount,
          actionBreakdown,
        },
      },
    });
  } catch (error) {
    console.error('Error in last-minute-triggers GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch triggers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/revenue/last-minute-triggers
 * - Create new trigger OR evaluate triggers
 * - Body: { action: 'create', ...triggerData } or { action: 'evaluate', propertyId }
 * - Also supports: { action: 'run', propertyId? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { action: opAction, propertyId, ...triggerData } = body;

    // Evaluate mode (dry run)
    if (opAction === 'evaluate') {
      if (!propertyId) {
        return NextResponse.json({ success: false, error: 'propertyId is required for evaluate' }, { status: 400 });
      }
      const results = await evaluateLastMinuteTriggers(ctx.tenantId, propertyId);
      return NextResponse.json({
        success: true,
        data: {
          results,
          wouldFire: results.filter(r => r.fired).length,
          wouldSkip: results.filter(r => !r.fired).length,
        },
      });
    }

    // Run mode (actually execute)
    if (opAction === 'run') {
      const result = await runLastMinuteAutomation(ctx.tenantId, propertyId || undefined);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Create trigger mode
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    if (!triggerData.name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const validActions = ['increase_rate', 'decrease_rate', 'send_offer', 'release_inventory'];
    if (triggerData.action && !validActions.includes(triggerData.action)) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const trigger = await createTrigger(ctx.tenantId, propertyId, {
      name: triggerData.name,
      enabled: triggerData.enabled ?? true,
      triggerHoursBeforeCheckin: triggerData.triggerHoursBeforeCheckin ?? 48,
      action: triggerData.action ?? 'decrease_rate',
      value: triggerData.value ?? 10,
      minOccupancy: triggerData.minOccupancy ?? 0,
      maxOccupancy: triggerData.maxOccupancy ?? 100,
      channelScope: triggerData.channelScope ?? 'all',
      roomTypeIds: triggerData.roomTypeIds ?? [],
      repeatOnDays: triggerData.repeatOnDays ?? [0, 1, 2, 3, 4, 5, 6],
    });

    return NextResponse.json({ success: true, data: trigger }, { status: 201 });
  } catch (error) {
    console.error('Error in last-minute-triggers POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create trigger or run evaluation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/revenue/last-minute-triggers
 * - Update trigger
 * - Body: { triggerId, ...updates }
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { triggerId, ...updates } = body;

    if (!triggerId) {
      return NextResponse.json({ success: false, error: 'triggerId is required' }, { status: 400 });
    }

    const trigger = await updateTrigger(ctx.tenantId, triggerId, updates);

    if (!trigger) {
      return NextResponse.json({ success: false, error: 'Trigger not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: trigger });
  } catch (error) {
    console.error('Error in last-minute-triggers PUT:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trigger' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/revenue/last-minute-triggers
 * - Delete trigger
 * - Body: { triggerId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { triggerId } = body;

    if (!triggerId) {
      return NextResponse.json({ success: false, error: 'triggerId is required' }, { status: 400 });
    }

    const deleted = await deleteTrigger(ctx.tenantId, triggerId);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Trigger not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Trigger deleted successfully' });
  } catch (error) {
    console.error('Error in last-minute-triggers DELETE:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete trigger' },
      { status: 500 }
    );
  }
}
