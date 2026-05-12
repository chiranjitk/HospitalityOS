import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { uploadFile } from '@/lib/storage';
import { unlink } from 'fs/promises';
import { join } from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

// GET /api/chat-conversations/[id]/attachments - List attachments
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

    const attachments = await db.chatAttachment.findMany({
      where: { conversationId: id, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch attachments' } },
      { status: 500 }
    );
  }
}

// POST /api/chat-conversations/[id]/attachments - Upload attachment
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File size exceeds 10MB limit' } },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File type not allowed' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload via storage utility (S3 with local fallback)
    const result = await uploadFile(user.tenantId, {
      file: buffer,
      filename: file.name,
      folder: 'chat',
      contentType: file.type,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_FAILED', message: result.error || 'Failed to upload attachment' } },
        { status: 500 }
      );
    }

    const fileUrl = result.url;

    // Create database record
    const attachment = await db.chatAttachment.create({
      data: {
        tenantId: user.tenantId,
        conversationId: id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl,
        uploadedBy: user.id,
      },
    });

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload attachment' } },
      { status: 500 }
    );
  }
}

// DELETE /api/chat-conversations/[id]/attachments - Delete attachment
export async function DELETE(
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

    const attachmentId = request.nextUrl.searchParams.get('id');
    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Attachment ID required' } },
        { status: 400 }
      );
    }

    const attachment = await db.chatAttachment.findFirst({
      where: { id: attachmentId, tenantId: user.tenantId, conversationId: id },
    });

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
        { status: 404 }
      );
    }

    // Delete file from disk (only for locally stored files)
    if (attachment.storageProvider === 'local' || attachment.fileUrl.startsWith('/uploads/')) {
      try {
        const filePath = join(process.cwd(), 'public', attachment.fileUrl);
        await unlink(filePath);
      } catch {
        // File might not exist, continue with DB deletion
      }
    }

    // Delete database record
    await db.chatAttachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete attachment' } },
      { status: 500 }
    );
  }
}
