import { NextRequest, NextResponse } from 'next/server';
import { getChannelStats } from '@/lib/ota/extended-channels';
import { requirePermission } from '@/lib/auth/tenant-context';

/**
 * GET /api/channel-manager/channels/stats
 * Get channel statistics: totals by category, region, and status
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const stats = getChannelStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
