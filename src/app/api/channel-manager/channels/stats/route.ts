import { NextResponse } from 'next/server';
import { getChannelStats } from '@/lib/ota/extended-channels';

/**
 * GET /api/channel-manager/channels/stats
 * Get channel statistics: totals by category, region, and status
 */
export async function GET() {
  try {
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
