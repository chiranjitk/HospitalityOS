import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// GET /api/gdpr/status - Check GDPR request status
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(request);
    if (ctx instanceof NextResponse) return ctx;

    // Check permission
    if (!hasPermission(ctx, 'gdpr.view') && !hasPermission(ctx, 'gdpr.*') && !hasPermission(ctx, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const requestType = searchParams.get('requestType');

    // If specific request ID is provided, return that request
    if (requestId) {
      const gdprRequest = await gdprService.getRequest(requestId, ctx.tenantId);
      
      if (!gdprRequest) {
        return NextResponse.json(
          { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'GDPR request not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: gdprRequest,
      });
    }

    // Otherwise, return all requests with optional filters
    const filters: {
      status?: 'pending' | 'processing' | 'completed' | 'rejected' | 'failed';
      requestType?: 'export' | 'delete' | 'anonymize' | 'rectify' | 'restrict';
      guestId?: string;
    } = {};

    if (status && ['pending', 'processing', 'completed', 'rejected', 'failed'].includes(status)) {
      filters.status = status as 'pending' | 'processing' | 'completed' | 'rejected' | 'failed';
    }

    if (requestType && ['export', 'delete', 'anonymize', 'rectify', 'restrict'].includes(requestType)) {
      filters.requestType = requestType as 'export' | 'delete' | 'anonymize' | 'rectify' | 'restrict';
    }

    if (guestId) {
      // Verify guestId belongs to current tenant
      const guest = await db.guest.findFirst({
        where: { id: guestId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
          { status: 404 }
        );
      }
      filters.guestId = guestId;
    }

    const requests = await gdprService.getRequests(ctx.tenantId, filters);

    // Calculate statistics
    const stats = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      processing: requests.filter(r => r.status === 'processing').length,
      completed: requests.filter(r => r.status === 'completed').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      failed: requests.filter(r => r.status === 'failed').length,
      byType: {
        export: requests.filter(r => r.requestType === 'export').length,
        delete: requests.filter(r => r.requestType === 'delete').length,
        anonymize: requests.filter(r => r.requestType === 'anonymize').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        requests,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching GDPR request status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch GDPR request status' } },
      { status: 500 }
    );
  }
}
