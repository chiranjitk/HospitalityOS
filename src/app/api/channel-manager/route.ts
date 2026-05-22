import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channel-manager - Channel Manager module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.view') && !hasPermission(user, 'channels.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'channel-manager',
        description: 'Channel Manager module for managing OTA channels, rate parity, messaging, content sync, and push updates',
        endpoints: {
          channels: '/api/channel-manager/channels',
          channelsStats: '/api/channel-manager/channels/stats',
          messages: '/api/channel-manager/messages',
          messageThreads: '/api/channel-manager/messages/threads',
          unreadCount: '/api/channel-manager/messages/unread-count',
          parity: '/api/channel-manager/parity',
          competitorParity: '/api/channel-manager/competitor-parity',
          content: '/api/channel-manager/content',
          push: '/api/channel-manager/push',
        },
      },
      message: 'Channel Manager module — use the endpoints above to manage channels, parity, messaging, and content',
    });
  } catch (error) {
    console.error('Channel Manager overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel manager overview' } },
      { status: 500 }
    );
  }
}
