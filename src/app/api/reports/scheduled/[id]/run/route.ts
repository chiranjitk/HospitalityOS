import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, requireAuth } from '@/lib/auth/tenant-context';
import { executeReport, sendReportEmail } from '@/lib/jobs/report-executor';
import { calculateNextRun } from '@/lib/jobs/scheduler';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// POST /api/reports/scheduled/[id]/run – Trigger immediate report execution
// ---------------------------------------------------------------------------
export async function POST(
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

    // Find the scheduled report
    const report = await db.scheduledReport.findFirst({
      where: { id, tenantId: context.tenantId },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Execute the report
    try {
      const executionResult = await executeReport({
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        type: report.reportType,
        format: report.format,
        filters: report.filters,
        deliveryMethod: report.deliveryMethod,
      });

      if (!executionResult.success) {
        // Update lastRunAt and lastRunStatus to error
        await db.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastRunAt: new Date(),
            lastRunStatus: 'error',
            lastError: executionResult.error || 'Report execution failed',
          },
        });

        // Create failed history record
        await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.reportType,
            format: report.format,
            generatedAt: new Date(),
            status: 'failed',
            errorMessage: executionResult.error || 'Report execution failed',
            recipientCount: 0,
          },
        });

        return NextResponse.json(
          { success: false, error: executionResult.error || 'Report execution failed' },
          { status: 500 },
        );
      }

      // Create successful history record
      const historyRecord = await db.reportHistory.create({
        data: {
          tenantId: report.tenantId,
          scheduledReportId: report.id,
          name: report.name,
          type: report.reportType,
          format: report.format,
          generatedAt: new Date(),
          periodStart: executionResult.periodStart,
          periodEnd: executionResult.periodEnd,
          fileUrl: executionResult.fileUrl,
          fileSize: executionResult.fileSize,
          status: 'completed',
          recipientCount: JSON.parse(report.recipients || '[]').length,
          sentAt: new Date(),
        },
      });

      // Send email if delivery method is email
      if (report.deliveryMethod === 'email') {
        const recipients = JSON.parse(report.recipients || '[]');
        if (recipients.length > 0) {
          await sendReportEmail({
            to: recipients,
            reportName: report.name,
            reportType: report.reportType,
            fileUrl: executionResult.fileUrl,
            fileContent: executionResult.fileContent,
            format: report.format,
          });
        }
      }

      // Calculate next run time for future scheduled execution
      const nextRunAt = calculateNextRun({
        frequency: report.frequency,
        time: report.time,
        dayOfWeek: report.dayOfWeek,
        dayOfMonth: report.dayOfMonth,
      });

      // Update the scheduled report with last run info
      await db.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'success',
          lastError: null,
          nextRunAt,
        },
      });

      // Check if the client wants a file download or JSON response
      const acceptHeader = request.headers.get('accept') || '';
      const wantsDownload = request.nextUrl.searchParams.get('download') === 'true';

      if (wantsDownload && executionResult.fileContent) {
        // Return the file as a download
        const contentTypes: Record<string, string> = {
          csv: 'text/csv',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          pdf: 'text/html',
        };

        const ext = report.format.toLowerCase() === 'excel' ? 'xlsx' : report.format.toLowerCase();
        const contentType = contentTypes[ext] || 'application/octet-stream';

        return new NextResponse(executionResult.fileContent, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${report.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.${ext}"`,
            'Content-Length': String(executionResult.fileContent.length),
          },
        });
      }

      // Return JSON response with execution details
      return NextResponse.json({
        success: true,
        data: {
          historyId: historyRecord.id,
          reportName: report.name,
          reportType: report.reportType,
          format: report.format,
          generatedAt: historyRecord.generatedAt,
          periodStart: executionResult.periodStart,
          periodEnd: executionResult.periodEnd,
          fileUrl: executionResult.fileUrl,
          fileSize: executionResult.fileSize,
          recipientCount: JSON.parse(report.recipients || '[]').length,
          nextRunAt,
        },
      });
    } catch (execError) {
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown execution error';

      // Update lastRunAt and lastRunStatus to error
      await db.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'error',
          lastError: errorMessage,
        },
      });

      // Create failed history record
      await db.reportHistory.create({
        data: {
          tenantId: report.tenantId,
          scheduledReportId: report.id,
          name: report.name,
          type: report.reportType,
          format: report.format,
          generatedAt: new Date(),
          status: 'failed',
          errorMessage,
          recipientCount: 0,
        },
      });

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[ScheduledReports] POST [id]/run error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute scheduled report' },
      { status: 500 },
    );
  }
}
