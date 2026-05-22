import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/pre-arrival/adapter-status
// Returns the configuration status of email and SMS communication adapters
// for the current tenant, without exposing secrets.
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'wifi.manage');
    if (ctx instanceof NextResponse) return ctx;

    const integrations = await db.integration.findMany({
      where: {
        tenantId: ctx.tenantId,
        type: { in: ['email_provider', 'sms_provider'] },
      },
      select: {
        type: true,
        provider: true,
        name: true,
        status: true,
      },
    });

    // Pick the first enabled/active integration per type
    const emailIntegration = integrations
      .filter((i) => i.type === 'email_provider' && i.status === 'active')
      .sort((a, b) => (a.provider > b.provider ? 1 : -1))[0] ?? null;

    const smsIntegration = integrations
      .filter((i) => i.type === 'sms_provider' && i.status === 'active')
      .sort((a, b) => (a.provider > b.provider ? 1 : -1))[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        email: {
          configured: !!emailIntegration,
          provider: emailIntegration?.provider ?? null,
          name: emailIntegration?.name ?? null,
        },
        sms: {
          configured: !!smsIntegration,
          provider: smsIntegration?.provider ?? null,
          name: smsIntegration?.name ?? null,
        },
      },
    });
  } catch (error) {
    console.error('[pre-arrival/adapter-status] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch adapter status' } },
      { status: 500 },
    );
  }
}
