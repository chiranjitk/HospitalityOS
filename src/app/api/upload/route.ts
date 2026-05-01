import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { uploadFile } from '@/lib/storage';
import { unlink } from 'fs/promises';
import { join } from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/**
 * Generic file upload endpoint.
 * Used by RoomImageGallery, MenuImageUpload, and other components.
 *
 * POST /api/upload  — Upload a file (multipart FormData)
 *   Body: FormData { file: File, folder?: string }
 *   Returns: { success: true, data: { url: string } }
 *
 * DELETE /api/upload?url=<encoded-url>  — Remove an uploaded file
 *   Returns: { success: true }
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` } },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `File type "${file.type}" not allowed. Allowed: JPEG, PNG, GIF, WebP, SVG` } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload via storage utility (S3 with local fallback)
    const result = await uploadFile(user.tenantId, {
      file: buffer,
      filename: file.name,
      folder,
      contentType: file.type,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_FAILED', message: result.error || 'Failed to upload file' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        key: result.key,
        provider: result.provider,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const fileUrl = request.nextUrl.searchParams.get('url');
    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File URL is required' } },
        { status: 400 }
      );
    }

    // Only allow deleting local files for security
    // S3 files should be managed through the S3 console/API
    if (fileUrl.startsWith('/uploads/')) {
      try {
        const filePath = join(process.cwd(), 'public', fileUrl);
        await unlink(filePath);
      } catch {
        // File might not exist, continue successfully
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete file' } },
      { status: 500 }
    );
  }
}
