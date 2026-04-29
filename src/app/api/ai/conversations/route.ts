import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

/**
 * GET /api/ai/conversations - List past conversations with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ai.copilot') && !hasPermission(user, 'ai.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const where = {
      tenantId: user.tenantId,
      userId: user.id,
    };

    const [conversations, total] = await Promise.all([
      db.aiConversation.findMany({
        where,
        include: {
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.aiConversation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        messageCount: c._count.messages,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/conversations - Save a new conversation message
 * Creates a new conversation if conversationId is not provided,
 * or appends a message to an existing conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ai.copilot') && !hasPermission(user, 'ai.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { conversationId, role, content, title } = body;

    if (!role || !content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'role and content are required' } },
        { status: 400 }
      );
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'role must be user or assistant' } },
        { status: 400 }
      );
    }

    // Create new conversation or find existing
    let conversation;

    if (conversationId) {
      conversation = await db.aiConversation.findUnique({
        where: { id: conversationId, tenantId: user.tenantId, userId: user.id },
      });

      if (!conversation) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          { status: 404 }
        );
      }
    } else {
      // Create a new conversation
      const convTitle = title || generateTitle(content);
      conversation = await db.aiConversation.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          title: convTitle,
        },
      });
    }

    // Add message
    const message = await db.aiConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role,
        content,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
    }, conversationId ? undefined : { status: 201 });
  } catch (error) {
    console.error('Error saving conversation message:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save message' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/conversations - Delete a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('id');

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conversation ID is required' } },
        { status: 400 }
      );
    }

    const conversation = await db.aiConversation.findUnique({
      where: { id: conversationId, tenantId: user.tenantId, userId: user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    await db.aiConversation.delete({
      where: { id: conversationId },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation' } },
      { status: 500 }
    );
  }
}

/**
 * Generate a title from the first user message
 */
function generateTitle(content: string): string {
  const maxLen = 50;
  const cleaned = content.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen).trim() + '...';
}
