import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { evaluateAndExecuteRules, TriggerPayload } from '@/lib/automation/trigger-engine';
import { z } from 'zod';

// ── Zod Schema ──
const triggerSchema = z.object({
  eventType: z.enum([
    'booking.created',
    'booking.confirmed',
    'booking.cancelled',
    'booking.modified',
    'guest.check_in',
    'guest.check_out',
    'guest.created',
    'guest.birthday',
    'payment.received',
    'payment.failed',
    'feedback.received',
    'review.submitted',
    'loyalty.tier_upgraded',
    'task.completed',
    'task.overdue',
    'room.status_changed',
    'wifi.session_started',
    'scheduled.daily',
    'scheduled.weekly',
  ]),
  propertyId: z.string().optional(),
  entityId: z.string().optional(),
  data: z.record(z.unknown()).default({}),
});

// ── POST /api/automation/trigger — Fire an automation event ──
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check — allow system automation or users with manage permission
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'automation.execute') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = triggerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const { eventType, propertyId, entityId, data } = parsed.data;

    const payload: TriggerPayload = {
      eventType,
      tenantId: user.tenantId,
      propertyId: propertyId || undefined,
      entityId: entityId || undefined,
      data,
    };

    // Evaluate and execute all matching rules
    const results = await evaluateAndExecuteRules(payload);

    const summary = {
      totalRulesEvaluated: results.length,
      matched: results.filter((r) => r.matched).length,
      actionsExecuted: results.reduce((sum, r) => sum + r.actionsExecuted, 0),
      errors: results.filter((r) => r.errors.length > 0).length,
      results,
    };

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[AutomationTrigger POST] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process automation trigger' } },
      { status: 500 }
    );
  }
}
