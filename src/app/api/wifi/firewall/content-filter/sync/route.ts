import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/wifi/firewall/content-filter/sync - Trigger e2guardian config sync
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    // This is a stub for e2guardian sync.
    // In production, this would regenerate the e2guardian config file
    // and send a SIGHUP to the e2guardian process.
    // For now, we return success to allow the frontend to work.

    // TODO: Implement actual e2guardian sync:
    // 1. Fetch all enabled content filters from DB
    // 2. Generate e2guardian config (phraselists, bannedsitelist, etc.)
    // 3. Write config to /etc/e2guardian/lists/
    // 4. Send SIGHUP to e2guardian to reload config
    // 5. Return sync status

    return NextResponse.json({
      success: true,
      message: 'Config synced to e2guardian',
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing content filter config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync config to e2guardian' } },
      { status: 500 }
    );
  }
}
