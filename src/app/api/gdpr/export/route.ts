import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';

// POST /api/gdpr/export - Request data export for a guest
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request);
    if (ctx instanceof NextResponse) return ctx;

    // Check permission
    if (!hasPermission(ctx, 'gdpr.export') && !hasPermission(ctx, 'gdpr.*') && !hasPermission(ctx, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Lookup user profile for email/name (TenantContext does not include these)
    const userProfile = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const body = await request.json();
    const { guestId, format = 'json', requesterEmail, requesterName } = body;

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists and belongs to user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
        { status: 404 }
      );
    }

    // Create export request
    const gdprRequest = await gdprService.createRequest({
      tenantId: ctx.tenantId,
      guestId,
      requestType: 'export',
      requesterEmail: requesterEmail || userProfile?.email ?? 'system',
      requesterName: requesterName || (userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'System Admin'),
    });

    // NOTE: This export runs synchronously within the request. In production,
    // consider queuing this work (e.g., via BullMQ, SQS, etc.) for large exports
    // to avoid HTTP timeout. A reasonable data limit is enforced below.
    const MAX_EXPORT_RECORDS = 10000;

    // Immediately process the export (in production, this might be queued)
    try {
      const exportData = await gdprService.exportGuestData(guestId, ctx.tenantId, {
        format: format === 'csv' ? 'csv' : 'json',
        includeBookings: true,
        includePayments: true,
        includePreferences: true,
        includeDocuments: true,
        includeCommunications: true,
        maxRecords: MAX_EXPORT_RECORDS,
      });

      // Update request as completed
      await gdprService.updateRequestStatus(gdprRequest.id, ctx.tenantId, 'completed', {
        completedBy: ctx.userId,
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          module: 'gdpr',
          action: 'gdpr.export.completed',
          entityType: 'Guest',
          entityId: guestId,
          newValue: JSON.stringify({
            requestId: gdprRequest.id,
            format,
            guestEmail: guest.email,
          }),
        },
      });

      // Return appropriate format
      if (format === 'csv') {
        // For CSV, return all sections as separate files info
        const csvSections = {
          profile: gdprService.exportToCSV(exportData, 'profile'),
          bookings: gdprService.exportToCSV(exportData, 'bookings'),
          payments: gdprService.exportToCSV(exportData, 'payments'),
        };

        return NextResponse.json({
          success: true,
          data: {
            requestId: gdprRequest.id,
            format: 'csv',
            sections: csvSections,
            exportMetadata: exportData.exportMetadata,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          requestId: gdprRequest.id,
          exportData,
        },
      });
    } catch (exportError) {
      // Update request as failed
      await gdprService.updateRequestStatus(gdprRequest.id, ctx.tenantId, 'failed', {
        notes: exportError instanceof Error ? exportError.message : 'Export failed',
      });
      throw exportError;
    }
  } catch (error) {
    console.error('Error processing GDPR export request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process export request' } },
      { status: 500 }
    );
  }
}

// GET /api/gdpr/export - Get export data for a guest
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(request);
    if (ctx instanceof NextResponse) return ctx;

    // Check permission
    if (!hasPermission(ctx, 'gdpr.export') && !hasPermission(ctx, 'gdpr.*') && !hasPermission(ctx, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const format = searchParams.get('format') || 'json';

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists and belongs to user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
        { status: 404 }
      );
    }

    // NOTE: This export runs synchronously. A data limit is enforced to prevent timeout.
    const MAX_EXPORT_RECORDS = 10000;

    // Export data
    const exportData = await gdprService.exportGuestData(guestId, ctx.tenantId, {
      format: format === 'csv' ? 'csv' : 'json',
      includeBookings: true,
      includePayments: true,
      includePreferences: true,
      includeDocuments: true,
      includeCommunications: true,
      maxRecords: MAX_EXPORT_RECORDS,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        module: 'gdpr',
        action: 'gdpr.export.viewed',
        entityType: 'Guest',
        entityId: guestId,
        newValue: JSON.stringify({
          format,
          guestEmail: guest.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Error exporting guest data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export guest data' } },
      { status: 500 }
    );
  }
}
