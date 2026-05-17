import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMessageThreads } from '@/lib/ota/message-manager';

/**
 * GET /api/channel-manager/messages/threads
 * Get message threads grouped by reservation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'propertyId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const channelName = searchParams.get('channelName') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getMessageThreads(user.tenantId, propertyId, {
      channelName,
      unreadOnly,
      limit,
      offset,
    });

    return new Response(JSON.stringify({
      success: true,
      threads: result.threads,
      total: result.total,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[Messages Threads API] GET error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch message threads',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
