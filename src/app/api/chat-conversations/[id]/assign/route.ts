import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// PUT /api/chat-conversations/[id]/assign - Assign conversation to a staff member
export async function PUT(
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

    if (!hasPermission(user, 'chat.assign') && !hasPermission(user, 'communication.chat')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { assignedTo } = body;

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
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Target user not found' } },
        { status: 404 }
      );
    }

    // Update conversation
    const updated = await db.chatConversation.update({
      where: { id },
      data: { assignedTo },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error assigning conversation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to assign conversation' } },
      { status: 500 }
    );
  }
}
