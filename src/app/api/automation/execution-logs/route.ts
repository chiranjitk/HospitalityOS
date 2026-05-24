import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/automation/execution-logs - List execution logs
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'automation.view') && !hasPermission(user, 'rules.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const ruleId = searchParams.get('ruleId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Prisma.AutomationExecutionLogWhereInput = {
      rule: { tenantId },
    };
    if (ruleId) where.ruleId = ruleId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.executedAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
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
            },
          },
        },
        orderBy: { executedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.automationExecutionLog.count({ where }),
    ]);

    // Calculate stats using aggregation instead of loading all rows
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCount, successCount, failedCount, todayCount] = await Promise.all([
      db.automationExecutionLog.count({ where: { rule: { tenantId } } }),
      db.automationExecutionLog.count({ where: { rule: { tenantId }, status: 'success' } }),
      db.automationExecutionLog.count({ where: { rule: { tenantId }, status: 'failed' } }),
      db.automationExecutionLog.count({
        where: { rule: { tenantId }, executedAt: { gte: today } },
      }),
    ]);

    const stats = {
      totalExecutions: totalCount,
      successful: successCount,
      failed: failedCount,
      successRate: totalCount > 0
        ? Math.round((successCount / totalCount) * 100)
        : 0,
      executionsToday: todayCount,
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: logs.map((log) => ({
          ...log,
          ruleName: log.rule.name,
        })),
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching execution logs:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch execution logs' } },
      { status: 500 }
    );
  }
}

// POST /api/automation/execution-logs - Create an execution log
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

    // Permission check
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'rules.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      ruleId,
      triggerData,
      status,
      errorMessage,
      actionsResult,
    } = body;

    if (!ruleId || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID and status are required' } },
        { status: 400 }
      );
    }

    // Verify rule exists and belongs to user's tenant
    const rule = await db.automationRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Automation rule not found' } },
        { status: 404 }
      );
    }

    // GAP-FIX(17b): Create execution log + update rule count atomically in transaction
    const log = await db.$transaction(async (tx) => {
      const createdLog = await tx.automationExecutionLog.create({
        data: {
          ruleId,
          triggerData: triggerData ? JSON.stringify(triggerData) : null,
          status,
          errorMessage,
          actionsResult: actionsResult ? JSON.stringify(actionsResult) : null,
        },
      });

      // Update rule execution stats
      await tx.automationRule.update({
        where: { id: ruleId },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });

      return createdLog;
    });

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error creating execution log:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create execution log' } },
      { status: 500 }
    );
  }
}

// DELETE /api/automation/execution-logs - Delete execution logs (cleanup)
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - admin only for bulk deletion
    if (!hasPermission(user, 'automation.manage') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const ruleId = searchParams.get('ruleId');
    const beforeDate = searchParams.get('beforeDate');
    const olderThanDays = searchParams.get('olderThanDays');
    const days = olderThanDays ? parseInt(olderThanDays, 10) : NaN;

    const where: Prisma.AutomationExecutionLogWhereInput = {
      rule: { tenantId: user.tenantId }, // Ensure only tenant's logs are deleted
    };

    if (ruleId) {
      where.ruleId = ruleId;
    }

    if (beforeDate) {
      where.executedAt = { lt: new Date(beforeDate) };
    } else if (olderThanDays && !isNaN(days) && days > 0) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      where.executedAt = { lt: date };
    }

    const result = await db.automationExecutionLog.deleteMany({
      where,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Deleted ${result.count} execution logs`,
        deletedCount: result.count,
      },
    });
  } catch (error) {
    console.error('Error deleting execution logs:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete execution logs' } },
      { status: 500 }
    );
  }
}
