import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';

// POST /api/gdpr/anonymize - Request data anonymization for a guest
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request);
    if (ctx instanceof NextResponse) return ctx;

    // Check permission - anonymization requires elevated permissions
    if (!hasPermission(ctx, 'gdpr.anonymize') && !hasPermission(ctx, 'gdpr.*') && ctx.role !== 'admin' && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Only admins can anonymize guest data.' } },
        { status: 403 }
      );
    }

    // Lookup user profile for email/name (TenantContext does not include these)
    const userProfile = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const body = await request.json();
    const { guestId, requesterEmail, requesterName, preserveAnalytics, preserveFinancialRecords } = body;

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

    // Create anonymization request
    const gdprRequest = await gdprService.createRequest({
      tenantId: ctx.tenantId,
      guestId,
      requestType: 'anonymize',
      requesterEmail: requesterEmail || userProfile?.email ?? 'system',
      requesterName: requesterName || (userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'System Admin'),
    });

    // Update request status to processing
    await gdprService.updateRequestStatus(gdprRequest.id, ctx.tenantId, 'processing');

    try {
      // Perform anonymization
      const result = await gdprService.anonymizeGuestData(guestId, ctx.tenantId, {
        preserveAnalytics: preserveAnalytics !== false, // Default to true
        preserveFinancialRecords: preserveFinancialRecords !== false, // Default to true
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
          action: 'gdpr.anonymize.completed',
          entityType: 'Guest',
          entityId: guestId,
          newValue: JSON.stringify({
            requestId: gdprRequest.id,
            anonymizedFields: result.anonymizedFields,
            preserveAnalytics,
            preserveFinancialRecords,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          requestId: gdprRequest.id,
          anonymizedFields: result.anonymizedFields,
          message: 'Guest data has been anonymized while preserving analytics',
        },
      });
    } catch (anonymizeError) {
      // Update request as failed
      await gdprService.updateRequestStatus(gdprRequest.id, ctx.tenantId, 'failed', {
        notes: anonymizeError instanceof Error ? anonymizeError.message : 'Anonymization failed',
      });
      throw anonymizeError;
    }
  } catch (error) {
    console.error('Error processing GDPR anonymization request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process anonymization request' } },
      { status: 500 }
    );
  }
}
