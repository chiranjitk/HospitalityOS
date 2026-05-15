import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/events/history
 * List event history from AutomationExecutionLog.
 * Filter by event type, date range, status.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('eventType');
    const status = searchParams.get('status');
    const startTimeStr = searchParams.get('startTime');
    const endTimeStr = searchParams.get('endTime');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Build where clause
    const where: Record<string, unknown> = {
      rule: { tenantId: user.tenantId },
    };

    if (status) {
      where.status = status;
    }

    if (startTimeStr || endTimeStr) {
      where.executedAt = {};
      if (startTimeStr) {
        (where.executedAt as Record<string, unknown>).gte = new Date(startTimeStr);
      }
      if (endTimeStr) {
        (where.executedAt as Record<string, unknown>).lte = new Date(endTimeStr);
      }
    }

    // If eventType filter, we need to match rules by triggerEvent
    let ruleIdsFilter: string[] | undefined;
    if (eventType) {
      const matchingRules = await db.automationRule.findMany({
        where: {
          tenantId: user.tenantId,
          triggerEvent: eventType,
        },
        select: { id: true },
      });
      ruleIdsFilter = matchingRules.map((r) => r.id);
      if (ruleIdsFilter.length === 0) {
        return NextResponse.json({ logs: [], total: 0, page, pageSize });
      }
    }

    if (ruleIdsFilter) {
      where.ruleId = { in: ruleIdsFilter };
    }

    const [logs, total] = await Promise.all([
      db.automationExecutionLog.findMany({
        where,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              triggerEvent: true,
              isActive: true,
            },
          },
        },
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
      db.automationExecutionLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        ruleId: log.ruleId,
        ruleName: log.rule.name,
        eventType: log.rule.triggerEvent,
        status: log.status,
        errorMessage: log.errorMessage,
        actionsResult: log.actionsResult,
        triggerData: log.triggerData,
        executedAt: log.executedAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('[Events History] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
