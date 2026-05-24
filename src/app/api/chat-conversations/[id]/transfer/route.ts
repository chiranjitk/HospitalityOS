import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/chat-conversations/[id]/transfer - Transfer conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'chat.transfer') && !hasPermission(user, 'communication.chat')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { assignedTo, reason, notes } = body;

    if (!assignedTo) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'assignedTo is required' } },
        { status: 400 }
      );
    }

    // Verify conversation belongs to tenant
    const conversation = await db.chatConversation.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Verify target user exists and belongs to tenant
    const targetUser = await db.user.findFirst({
      where: { id: assignedTo, tenantId: user.tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Target user not found' } },
        { status: 404 }
      );
    }

    // Create transfer record
    const transfer = await db.chatTransfer.create({
      data: {
        tenantId: user.tenantId,
        conversationId: id,
        fromUserId: user.id,
        toUserId: assignedTo,
        reason,
        notes,
      },
    });

    // Update conversation assignment
    await db.chatConversation.update({
      where: { id },
      data: { assignedTo },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...transfer,
        fromUser: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        toUser: targetUser,
      },
    });
  } catch (error) {
    console.error('Error transferring conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to transfer conversation' } },
      { status: 500 }
    );
  }
}

// GET /api/chat-conversations/[id]/transfer - Get transfer history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'chat.view') && !hasPermission(user, 'communication.chat')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Verify conversation belongs to tenant
    const conversation = await db.chatConversation.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    const transfers = await db.chatTransfer.findMany({
      where: { conversationId: id, tenantId: user.tenantId },
      include: {
        fromUser: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true, avatar: true },
        },
        toUser: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transfer history' } },
      { status: 500 }
    );
  }
}
