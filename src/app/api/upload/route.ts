import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, stat, access } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { processImage } from '@/lib/image-processing';

// Allow up to 10 MB
export const maxDuration = 30;

const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'upload');

// Allowed MIME types for image uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

/** Generate a unique filename to avoid collisions */
function uniqueFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const base = originalName.replace(ext, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${timestamp}-${rand}${ext}`;
}

/** Sanitize folder name to prevent path traversal */
function sanitizeFolder(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// ═══════════════════════════════════════════════════
// POST — Upload a file
// ═══════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawFolder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: 'No file provided' } },
        { status: 400 },
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: { message: `Unsupported file type: ${file.type}. Allowed: image/jpeg, image/png, image/webp, image/gif` } },
        { status: 400 },
      );
    }

    // Validate file size (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: { message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` } },
        { status: 400 },
      );
    }

    const folder = sanitizeFolder(rawFolder);
    const folderPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, folder);

    // Ensure directory exists
    if (!existsSync(/*turbopackIgnore: true*/ folderPath)) {
      await mkdir(folderPath, { recursive: true });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine filename
    const filename = uniqueFilename(file.name);
    const filePath = path.join(/*turbopackIgnore: true*/ folderPath, filename);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Process image (generate thumbnail + medium variant) using existing infrastructure
    let processed = null;
    try {
      processed = await processImage(filePath, folder, filename);
    } catch (err) {
      console.error('[Upload] Image processing failed (file still saved):', err);
    }

    const url = processed?.url || `/api/files/${folder}/${filename}`;
    const thumbnailUrl = processed?.thumbnailUrl || url;

    return NextResponse.json({
      success: true,
      data: {
        url,
        thumbnailUrl,
        filename,
        folder,
        size: file.size,
        mimeType: file.type,
        ...(processed ? { width: processed.width, height: processed.height } : {}),
      },
    });
  } catch (err) {
    console.error('[Upload] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Upload failed. Please try again.' } },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════
// DELETE — Remove a file by URL
// ═══════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: { message: 'No file URL provided' } },
        { status: 400 },
      );
    }

    // Extract path from URL like /api/files/rooms/image.jpg
    const urlPath = fileUrl.replace(/^\/api\/files\//, '');
    if (!urlPath || urlPath.includes('..')) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid file path' } },
        { status: 400 },
      );
    }

    const filePath = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, urlPath);

    // Prevent directory traversal
    if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden path' } },
        { status: 403 },
      );
    }

    // Check file exists
    try {
      await access(filePath);
    } catch {
      return NextResponse.json(
        { success: true, message: 'File not found (already deleted)' },
      );
    }

    // Delete the file
    await unlink(filePath);

    // Also try to delete thumbnail and medium variants
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    for (const suffix of ['-medium.jpg']) {
      try {
        await unlink(path.join(dir, base + suffix));
      } catch { /* ignore */ }
    }
    // Try thumbs directory
    const thumbsDir = path.join(dir, 'thumbs');
    try {
      await unlink(path.join(thumbsDir, base + ext));
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('[Upload Delete] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Delete failed' } },
      { status: 500 },
    );
  }
}
