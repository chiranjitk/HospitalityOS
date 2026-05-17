import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import {
  listMessages,
  replyToMessage,
  markMessagesRead,
  getMessageThreads,
  getUnreadMessageCount,
  fetchAllMessages,
} from '@/lib/ota/message-manager';

// ============================================
// GET - List messages or threads or unread count
// ============================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Route to different endpoints based on path
    const pathname = request.nextUrl.pathname;

    // GET /api/channel-manager/messages/threads
    if (pathname.endsWith('/threads')) {
      return handleGetThreads(user.tenantId, propertyId, searchParams);
    }

    // GET /api/channel-manager/messages/unread-count
    if (pathname.endsWith('/unread-count')) {
      return handleGetUnreadCount(user.tenantId, propertyId);
    }

    // GET /api/channel-manager/messages (list messages)
    return handleListMessages(user.tenantId, propertyId, searchParams);
  } catch (error) {
    console.error('[Messages API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Send a reply or fetch new messages
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // If action is 'fetch', pull new messages from channels
    if (action === 'fetch') {
      const { propertyId, channelName } = body as { propertyId: string; channelName?: string };
      if (!propertyId) {
        return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
      }
      const newMessages = await fetchAllMessages(user.tenantId, propertyId);
      return NextResponse.json({
        success: true,
        newMessagesCount: newMessages.length,
        messages: newMessages,
      });
    }

    // Default: Send a reply
    const { messageId, replyBody } = body as { messageId: string; replyBody: string };

    if (!messageId || !replyBody) {
      return NextResponse.json(
        { error: 'messageId and replyBody are required' },
        { status: 400 }
      );
    }

    if (replyBody.trim().length === 0) {
      return NextResponse.json(
        { error: 'replyBody cannot be empty' },
        { status: 400 }
      );
    }

    if (replyBody.length > 5000) {
      return NextResponse.json(
        { error: 'replyBody exceeds maximum length of 5000 characters' },
        { status: 400 }
      );
    }

    const result = await replyToMessage(user.tenantId, messageId, replyBody);

    if (result.success) {
      return NextResponse.json({
        success: true,
        channelMessageId: result.channelMessageId,
      });
    }

    return NextResponse.json(
      { error: result.error || 'Failed to send reply' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[Messages API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Mark messages as read
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messageIds } = body as { messageIds: string[] };

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'messageIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (messageIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot mark more than 100 messages at once' },
        { status: 400 }
      );
    }

    const markedCount = await markMessagesRead(user.tenantId, messageIds);

    return NextResponse.json({
      success: true,
      markedCount,
    });
  } catch (error) {
    console.error('[Messages API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLER HELPERS
// ============================================

async function handleListMessages(tenantId: string, propertyId: string, searchParams: URLSearchParams) {
  const channelName = searchParams.get('channelName') || undefined;
  const status = searchParams.get('status') || undefined;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const search = searchParams.get('search') || undefined;
  const priority = searchParams.get('priority') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const result = await listMessages(tenantId, propertyId, {
    channelName,
    status,
    unreadOnly,
    startDate,
    endDate,
    search,
    priority,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    messages: result.messages,
    total: result.total,
    limit,
    offset,
  });
}

async function handleGetThreads(tenantId: string, propertyId: string, searchParams: URLSearchParams) {
  const channelName = searchParams.get('channelName') || undefined;
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const result = await getMessageThreads(tenantId, propertyId, {
    channelName,
    unreadOnly,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    threads: result.threads,
    total: result.total,
  });
}

async function handleGetUnreadCount(tenantId: string, propertyId: string) {
  const count = await getUnreadMessageCount(tenantId, propertyId);

  return NextResponse.json({
    success: true,
    count,
  });
}
