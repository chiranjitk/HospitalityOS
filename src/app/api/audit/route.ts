import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/audit - Audit module overview
// Provides an overview of the audit-logs sub-system for compliance and traceability
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'audit.view') && !hasPermission(user, 'audit.*') && !hasPermission(user, 'audit-logs.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'audit',
        description: 'Audit module for tracking system activity, compliance logging, and audit trail management',
        endpoints: {
          auditLogs: '/api/audit-logs',
          auditLogStats: '/api/audit-logs/stats',
          auditLogExport: '/api/audit-logs/export',
          bookingsAuditLogs: '/api/bookings/audit-logs',
          nightAudit: '/api/night-audit',
          nightAuditById: '/api/night-audit/[id]',
          nightAuditExecuteStep: '/api/night-audit/[id]/execute-step',
          gdprStatus: '/api/gdpr/status',
          gdprConsent: '/api/gdpr/consent',
          gdprExport: '/api/gdpr/export',
          gdprDelete: '/api/gdpr/delete',
          gdprAnonymize: '/api/gdpr/anonymize',
        },
      },
      message: 'Audit module — use /api/audit-logs for audit trail records, or explore the endpoints above for night audit and GDPR compliance',
    });
  } catch (error) {
    console.error('Audit overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit overview' } },
      { status: 500 }
    );
  }
}
