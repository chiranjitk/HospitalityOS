import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/compliance - Compliance module overview with actual compliance data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'compliance.view') && !hasPermission(user, 'settings.view') && !hasPermission(user, 'gdpr.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Query compliance data from the database
    const [gdprConsentRecords, recentAuditLogs, totalAuditLogs, dataExports] = await Promise.all([
      // Count GDPR consent records
      db.gdprConsent.count({
        where: { tenantId },
      }),
      // Recent audit logs (last 10)
      db.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, module: true, action: true, entityType: true, createdAt: true, userId: true },
      }),
      // Total audit log count
      db.auditLog.count({
        where: { tenantId },
      }),
      // Data export requests
      db.gdprDataRequest.count({
        where: { tenantId, type: 'export', status: { in: ['pending', 'processing'] } },
      }),
    ]);

    // Check if IP whitelist is configured
    const ipWhitelistCount = await db.securitySetting.count({
      where: { tenantId, type: 'ip_whitelist' },
    });

    return NextResponse.json({
      success: true,
      data: {
        module: 'compliance',
        summary: {
          gdprConsentRecords,
          totalAuditLogs,
          pendingDataExports: dataExports,
          ipWhitelistConfigured: ipWhitelistCount > 0,
        },
        recentAuditLogs,
        endpoints: {
          gdprStatus: '/api/gdpr/status',
          gdprConsent: '/api/gdpr/consent',
          gdprExport: '/api/gdpr/export',
          gdprDelete: '/api/gdpr/delete',
          gdprAnonymize: '/api/gdpr/anonymize',
          auditLogs: '/api/audit-logs',
          auditLogStats: '/api/audit-logs/stats',
          auditLogExport: '/api/audit-logs/export',
          taxSettings: '/api/tax/settings',
          taxReturns: '/api/tax/returns',
          taxTds: '/api/tax/tds',
          staffPayrollCompliance: '/api/staff/payroll/compliance',
          settingsSecurity: '/api/settings/security',
          settingsIpWhitelist: '/api/settings/ip-whitelist',
          licenseCheck: '/api/license/check',
          licenseOverview: '/api/license/overview',
          licenseEntitlements: '/api/license/entitlements',
        },
      },
    });
  } catch (error) {
    console.error('Compliance overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch compliance overview' } },
      { status: 500 }
    );
  }
}
