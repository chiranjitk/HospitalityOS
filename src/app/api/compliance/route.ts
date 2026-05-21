import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/compliance - Compliance module overview
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

    return NextResponse.json({
      success: true,
      data: {
        module: 'compliance',
        description: 'Compliance module for GDPR, data privacy, tax compliance, and regulatory requirements',
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
      message: 'Compliance module — use /api/gdpr/status for GDPR compliance status, or explore the endpoints above for tax, audit, and security compliance',
    });
  } catch (error) {
    console.error('Compliance overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch compliance overview' } },
      { status: 500 }
    );
  }
}
