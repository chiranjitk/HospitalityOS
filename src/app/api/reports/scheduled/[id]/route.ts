import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, requireAuth } from '@/lib/auth/tenant-context';
import { calculateNextRun } from '@/lib/jobs/scheduler';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helper: compute nextRunAt
// ---------------------------------------------------------------------------
function computeNextRun(params: {
  frequency: string;
  time: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}): Date {
  return calculateNextRun({
    frequency: params.frequency,
    time: params.time,
    dayOfWeek: params.dayOfWeek ?? null,
    dayOfMonth: params.dayOfMonth ?? null,
  });
}

// ---------------------------------------------------------------------------
// GET /api/reports/scheduled/[id] – Get a single scheduled report
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.view' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const report = await db.scheduledReport.findFirst({
      where: { id, tenantId: context.tenantId },
      include: {
        history: {
          orderBy: { generatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        recipients: JSON.parse(report.recipients || '[]'),
        filters: JSON.parse(report.filters || '{}'),
        history: report.history.map((h) => ({
          ...h,
          metadata: JSON.parse(h.metadata || '{}'),
        })),
      },
    });
  } catch (error) {
    console.error('[ScheduledReports] GET [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled report' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/reports/scheduled/[id] – Update a single scheduled report
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.manage') && !hasPermission(context, 'reports.*')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.manage' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.scheduledReport.findFirst({
      where: { id, tenantId: context.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Build update payload
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.reportType !== undefined) data.reportType = body.reportType;
    if (body.frequency !== undefined) data.frequency = body.frequency;
    if (body.dayOfWeek !== undefined) data.dayOfWeek = body.dayOfWeek;
    if (body.dayOfMonth !== undefined) data.dayOfMonth = body.dayOfMonth;
    if (body.time !== undefined) data.time = body.time;
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.format !== undefined) data.format = body.format;
    if (body.deliveryMethod !== undefined) data.deliveryMethod = body.deliveryMethod;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.recipients !== undefined) data.recipients = JSON.stringify(body.recipients);
    if (body.filters !== undefined) data.filters = JSON.stringify(body.filters);

    // Recompute nextRunAt if schedule-related fields changed
    const scheduleFieldsChanged =
      body.frequency !== undefined ||
      body.time !== undefined ||
      body.dayOfWeek !== undefined ||
      body.dayOfMonth !== undefined ||
      body.timezone !== undefined;

    if (scheduleFieldsChanged || body.isActive === true) {
      const merged = {
        frequency: (data.frequency as string) || existing.frequency,
        time: (data.time as string) || existing.time,
        dayOfWeek: (data.dayOfWeek as number | null) ?? existing.dayOfWeek,
        dayOfMonth: (data.dayOfMonth as number | null) ?? existing.dayOfMonth,
      };
      data.nextRunAt = computeNextRun(merged);
    }

    // If deactivated, clear nextRunAt
    if (body.isActive === false) {
      data.nextRunAt = null;
    }

    const report = await db.scheduledReport.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        recipients: JSON.parse(report.recipients || '[]'),
        filters: JSON.parse(report.filters || '{}'),
      },
    });
  } catch (error) {
    console.error('[ScheduledReports] PUT [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update scheduled report' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/reports/scheduled/[id] – Soft-delete (set isActive = false)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.manage') && !hasPermission(context, 'reports.*')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.manage' },
        { status: 403 },
      );
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.scheduledReport.findFirst({
      where: { id, tenantId: context.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Soft delete – set isActive = false and clear nextRunAt
    await db.scheduledReport.update({
      where: { id },
      data: {
        isActive: false,
        nextRunAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deactivated',
    });
  } catch (error) {
    console.error('[ScheduledReports] DELETE [id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scheduled report' },
      { status: 500 },
    );
  }
}
