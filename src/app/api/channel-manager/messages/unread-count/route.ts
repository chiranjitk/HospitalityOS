import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getUnreadMessageCount } from '@/lib/ota/message-manager';

/**
 * GET /api/channel-manager/messages/unread-count
 * Get count of unread messages
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

    const count = await getUnreadMessageCount(user.tenantId, propertyId);

    return new Response(JSON.stringify({
      success: true,
      count,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[Messages Unread Count API] GET error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch unread count',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
