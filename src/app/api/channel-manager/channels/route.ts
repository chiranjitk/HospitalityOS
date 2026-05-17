import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_EXTENDED_CHANNELS,
  CHANNEL_CATEGORIES,
  CHANNEL_REGIONS,
  filterChannels,
} from '@/lib/ota/extended-channels';

/**
 * GET /api/channel-manager/channels
 * List all available channels with filters and pagination
 *
 * Query params:
 *   category - Filter by channel category
 *   region   - Filter by region
 *   status   - Filter by status (active, coming_soon, beta)
 *   search   - Search by name or ID
 *   page     - Page number (default: 1)
 *   limit    - Items per page (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') || '';
    const region = searchParams.get('region') || '';
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Apply filters
    const filtered = filterChannels({
      category: category || undefined,
      region: region || undefined,
      status: status || undefined,
      search: search || undefined,
    });

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedChannels = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      channels: paginatedChannels,
      total,
      page,
      limit,
      totalPages,
      categories: [...CHANNEL_CATEGORIES],
      regions: [...CHANNEL_REGIONS],
    });
  } catch (error) {
    console.error('Error listing channels:', error);
    return NextResponse.json(
      { error: 'Failed to list channels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
