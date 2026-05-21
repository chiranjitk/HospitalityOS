/**
 * Integration API Keys API
 * 
 * GET /api/settings/integrations/keys - Return integration API keys (masked)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

function maskValue(value: string): string {
  if (!value || value.length <= 8) {
    return '****';
  }
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Fetch hardware adapters which may contain API credentials
    const adapters = await db.hardwareAdapter.findMany({
      where: { tenantId: auth.tenantId },
      select: {
        id: true,
        providerId: true,
        category: true,
        displayName: true,
        credentials: true,
        enabled: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build masked key list from adapters
    const keys = adapters.map(adapter => {
      let maskedCredential = '****';
      let keyType = 'encrypted';

      if (adapter.credentials && adapter.credentials !== '{}' && adapter.credentials !== '***ENCRYPTED***') {
        // Credentials are encrypted, just show masked
        maskedCredential = '****';
        keyType = 'encrypted';
      }

      return {
        id: adapter.id,
        name: adapter.displayName,
        provider: adapter.providerId,
        category: adapter.category,
        keyType,
        maskedValue: maskedCredential,
        enabled: adapter.enabled,
        lastUpdated: adapter.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('[INTEGRATION_KEYS] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integration keys' },
      { status: 500 }
    );
  }
}
