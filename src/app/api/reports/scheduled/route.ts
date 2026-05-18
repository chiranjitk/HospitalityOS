import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, requireAuth } from '@/lib/auth/tenant-context';
import { calculateNextRun } from '@/lib/jobs/scheduler';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helper: compute nextRunAt from report params
// ---------------------------------------------------------------------------
function computeNextRun(params: {
  frequency: string;
  time: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  timezone?: string;
}): Date {
  // Delegate to the scheduler's existing calculateNextRun which handles
  // daily / weekly / monthly / quarterly / yearly logic correctly.
  return calculateNextRun({
    frequency: params.frequency,
    time: params.time,
    dayOfWeek: params.dayOfWeek ?? null,
    dayOfMonth: params.dayOfMonth ?? null,
  });
}

// ---------------------------------------------------------------------------
// GET /api/reports/scheduled – List all scheduled reports for the tenant
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.view' },
        { status: 403 },
      );
    }

    const { tenantId } = context;

    // Optional query filters
    const sp = request.nextUrl.searchParams;
    const isActiveFilter = sp.get('isActive');
    const reportTypeFilter = sp.get('reportType');

    const where: Record<string, unknown> = { tenantId };
    if (isActiveFilter !== null) where.isActive = isActiveFilter === 'true';
    if (reportTypeFilter) where.reportType = reportTypeFilter;

    const scheduledReports = await db.scheduledReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get recent report history for context
    const reportHistory = await db.reportHistory.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 20,
    });

    const stats = {
      totalReports: scheduledReports.length,
      activeReports: scheduledReports.filter((r) => r.isActive).length,
      inactiveReports: scheduledReports.filter((r) => !r.isActive).length,
      lastExecution: reportHistory[0]?.generatedAt || null,
    };

    return NextResponse.json({
      success: true,
      data: scheduledReports.map((r) => ({
        ...r,
        recipients: JSON.parse(r.recipients || '[]'),
        filters: JSON.parse(r.filters || '{}'),
      })),
      history: reportHistory,
      stats,
    });
  } catch (error) {
    console.error('[ScheduledReports] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled reports' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/reports/scheduled – Create a new scheduled report
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.manage') && !hasPermission(context, 'reports.*')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.manage' },
        { status: 403 },
      );
    }

    const body = await request.json();

    const {
      name,
      description,
      reportType,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      timezone,
      filters,
      format,
      recipients,
      isActive = true,
      deliveryMethod,
    } = body;

    // Validation
    if (!name || !reportType || !frequency) {
      return NextResponse.json(
        { success: false, error: 'name, reportType, and frequency are required' },
        { status: 400 },
      );
    }

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { success: false, error: `frequency must be one of: ${validFrequencies.join(', ')}` },
        { status: 400 },
      );
    }

    if (frequency === 'weekly' && (dayOfWeek === undefined || dayOfWeek === null)) {
      return NextResponse.json(
        { success: false, error: 'dayOfWeek is required for weekly frequency (0=Sunday)' },
        { status: 400 },
      );
    }

    if (frequency === 'monthly' && (dayOfMonth === undefined || dayOfMonth === null)) {
      return NextResponse.json(
        { success: false, error: 'dayOfMonth is required for monthly frequency' },
        { status: 400 },
      );
    }

    const reportTime = time || '09:00';
    const reportTimezone = timezone || 'UTC';

    // Compute nextRunAt
    const nextRunAt = computeNextRun({
      frequency,
      time: reportTime,
      dayOfWeek,
      dayOfMonth,
      timezone: reportTimezone,
    });

    const report = await db.scheduledReport.create({
      data: {
        tenantId: context.tenantId,
        name,
        description: description || null,
        reportType,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        time: reportTime,
        timezone: reportTimezone,
        filters: JSON.stringify(filters || {}),
        format: format || 'xlsx',
        recipients: JSON.stringify(recipients || []),
        deliveryMethod: deliveryMethod || 'email',
        isActive,
        nextRunAt,
        createdBy: context.userId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...report,
          recipients: JSON.parse(report.recipients || '[]'),
          filters: JSON.parse(report.filters || '{}'),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[ScheduledReports] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create scheduled report' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/reports/scheduled – Update a scheduled report (bulk, by id in body)
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.manage') && !hasPermission(context, 'reports.*')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.manage' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 },
      );
    }

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

    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.reportType !== undefined) data.reportType = updateData.reportType;
    if (updateData.frequency !== undefined) data.frequency = updateData.frequency;
    if (updateData.dayOfWeek !== undefined) data.dayOfWeek = updateData.dayOfWeek;
    if (updateData.dayOfMonth !== undefined) data.dayOfMonth = updateData.dayOfMonth;
    if (updateData.time !== undefined) data.time = updateData.time;
    if (updateData.timezone !== undefined) data.timezone = updateData.timezone;
    if (updateData.format !== undefined) data.format = updateData.format;
    if (updateData.deliveryMethod !== undefined) data.deliveryMethod = updateData.deliveryMethod;
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.recipients !== undefined) data.recipients = JSON.stringify(updateData.recipients);
    if (updateData.filters !== undefined) data.filters = JSON.stringify(updateData.filters);

    // Recompute nextRunAt if schedule-related fields changed
    const scheduleFieldsChanged =
      updateData.frequency !== undefined ||
      updateData.time !== undefined ||
      updateData.dayOfWeek !== undefined ||
      updateData.dayOfMonth !== undefined ||
      updateData.timezone !== undefined;

    if (scheduleFieldsChanged || updateData.isActive === true) {
      const merged = {
        frequency: (data.frequency as string) || existing.frequency,
        time: (data.time as string) || existing.time,
        dayOfWeek: (data.dayOfWeek as number | null) ?? existing.dayOfWeek,
        dayOfMonth: (data.dayOfMonth as number | null) ?? existing.dayOfMonth,
        timezone: (data.timezone as string) || existing.timezone,
      };
      data.nextRunAt = computeNextRun(merged);
    }

    // If deactivated, clear nextRunAt
    if (updateData.isActive === false) {
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
    console.error('[ScheduledReports] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update scheduled report' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/reports/scheduled – Soft-delete (set isActive = false)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    if (!hasPermission(context, 'reports.manage') && !hasPermission(context, 'reports.*')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: reports.manage' },
        { status: 403 },
      );
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 },
      );
    }

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
    console.error('[ScheduledReports] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scheduled report' },
      { status: 500 },
    );
  }
}
