import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  syncE2guardianConfig,
  getSyncStatus,
  getListFilesSummary,
} from '@/lib/wifi/e2guardian-sync';

export const runtime = 'nodejs';

// POST /api/wifi/firewall/content-filter/sync — Trigger e2guardian config sync
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const propertyId = body.propertyId || undefined;

    const result = await syncE2guardianConfig(user.tenantId, propertyId);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      syncedAt: result.syncedAt,
      duration: result.duration,
      summary: {
        totalDomains: result.totalDomainsWritten,
        categoriesCount: result.categoriesGenerated.length,
        categories: result.categoriesGenerated,
        filesWritten: result.filesWritten,
        configFiles: result.configFilesGenerated,
      },
    });
  } catch (error) {
    console.error('Error syncing content filter config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync config to e2guardian' } },
      { status: 500 },
    );
  }
}

// GET /api/wifi/firewall/content-filter/sync — Get sync status and generated files
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const status = await getSyncStatus();
    const files = await getListFilesSummary();

    return NextResponse.json({
      success: true,
      data: {
        status,
        listFiles: files.banned,
        configFiles: files.configs,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync status' } },
      { status: 500 },
    );
  }
}
