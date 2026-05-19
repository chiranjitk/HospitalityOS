import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { processImage } from '@/lib/image-processing';
import { db } from '@/lib/db';

const UPLOAD_DIR = '/home/z/my-project/upload';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function sanitizeFolder(folder: string): string {
  // Remove any path traversal characters and keep only safe folder names
  const sanitized = folder.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized || sanitized !== folder) {
    return '';
  }
  return sanitized;
}

function isPathSafe(resolvedPath: string): boolean {
  // Ensure the resolved path is within the upload directory
  const normalizedUploadDir = path.resolve(UPLOAD_DIR);
  const normalizedTargetPath = path.resolve(resolvedPath);
  return normalizedTargetPath.startsWith(normalizedUploadDir + path.sep) || normalizedTargetPath === normalizedUploadDir;
}

/**
 * Sync the Room.images JSON field with all RoomImage URLs for a given room,
 * ordered by isPrimary desc then sortOrder asc.
 */
async function syncRoomImages(roomId: string): Promise<void> {
  const images = await db.roomImage.findMany({
    where: { roomId },
    orderBy: [
      { isPrimary: 'desc' },
      { sortOrder: 'asc' },
    ],
    select: { url: true },
  });
  const urls = images.map((img) => img.url);
  await db.room.update({
    where: { id: roomId },
    data: { images: JSON.stringify(urls) },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;
    const roomId = formData.get('roomId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'No folder specified' },
        { status: 400 }
      );
    }

    // Validate folder name to prevent directory traversal
    const safeFolder = sanitizeFolder(folder);
    if (!safeFolder) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder name. Only alphanumeric characters, hyphens, and underscores are allowed.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Create the target directory
    const targetDir = path.join(UPLOAD_DIR, safeFolder);
    const resolvedTargetDir = path.resolve(targetDir);

    if (!isPathSafe(resolvedTargetDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder path' },
        { status: 400 }
      );
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(resolvedTargetDir)) {
      fs.mkdirSync(resolvedTargetDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = randomBytes(6).toString('hex');
    const originalExt = path.extname(file.name) || '.jpg';
    const uniqueFilename = `${timestamp}-${randomSuffix}${originalExt}`;

    const filePath = path.join(resolvedTargetDir, uniqueFilename);
    const resolvedFilePath = path.resolve(filePath);

    // Double-check the resolved file path is still safe
    if (!isPathSafe(resolvedFilePath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Write the file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(resolvedFilePath, buffer);

    const fileUrl = `/api/files/${safeFolder}/${uniqueFilename}`;

    // Process image: generate thumbnail and extract metadata
    let thumbnailUrl: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    try {
      const processed = await processImage(resolvedFilePath, safeFolder, uniqueFilename);
      thumbnailUrl = processed.thumbnailUrl;
      width = processed.width;
      height = processed.height;
      fileSize = processed.fileSize;
      mimeType = processed.mimeType;
    } catch (err) {
      console.error('Image processing failed, continuing without thumbnail/metadata:', err);
      // Graceful degradation: still return the original URL
    }

    // If roomId is provided and folder is 'rooms', create a RoomImage record
    if (roomId && safeFolder === 'rooms') {
      try {
        const imageCount = await db.roomImage.count({ where: { roomId } });
        const maxSort = await db.roomImage.aggregate({
          where: { roomId },
          _max: { sortOrder: true },
        });
        const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

        await db.roomImage.create({
          data: {
            roomId,
            url: fileUrl,
            thumbnailUrl: thumbnailUrl ?? undefined,
            isPrimary: imageCount === 0,
            sortOrder: nextSortOrder,
            width: width ?? undefined,
            height: height ?? undefined,
            fileSize: fileSize ?? undefined,
            mimeType: mimeType ?? undefined,
          },
        });

        // Sync the Room.images JSON field
        await syncRoomImages(roomId);
      } catch (err) {
        console.error('Failed to create RoomImage record:', err);
        // Don't fail the upload if the DB operation fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(width != null ? { width } : {}),
        ...(height != null ? { height } : {}),
        ...(fileSize != null ? { fileSize } : {}),
        ...(mimeType ? { mimeType } : {}),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: 'No file URL provided' },
        { status: 400 }
      );
    }

    // Validate the URL starts with /api/files/
    if (!fileUrl.startsWith('/api/files/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file URL format' },
        { status: 400 }
      );
    }

    // Extract the relative path from the URL
    // URL format: /api/files/{folder}/{filename} or /api/files/{folder}/thumbs/{filename}
    const relativePath = fileUrl.replace('/api/files/', '');

    // Validate relative path: must be folder/filename or folder/thumbs/filename (no traversal)
    const parts = relativePath.split('/');
    const isValidPath = (parts.length === 2 || (parts.length === 3 && parts[1] === 'thumbs')) 
      && parts.every(p => p.length > 0 && !p.includes('..'));
    if (!isValidPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid file URL' },
        { status: 400 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, relativePath);
    const resolvedFilePath = path.resolve(filePath);

    // Security: ensure the resolved path is within the upload directory
    if (!isPathSafe(resolvedFilePath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(resolvedFilePath)) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Verify it's a file, not a directory
    const stat = fs.statSync(resolvedFilePath);
    if (!stat.isFile()) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Delete the file
    fs.unlinkSync(resolvedFilePath);

    // Also try to delete the thumbnail file from disk if it exists
    const folder = parts[0];
    const filename = parts.length === 3 ? parts[2] : parts[1];
    const thumbPath = path.join(UPLOAD_DIR, folder, 'thumbs', filename);
    const resolvedThumbPath = path.resolve(thumbPath);
    if (isPathSafe(resolvedThumbPath)) {
      try {
        if (fs.existsSync(resolvedThumbPath)) {
          const thumbStat = fs.statSync(resolvedThumbPath);
          if (thumbStat.isFile()) {
            fs.unlinkSync(resolvedThumbPath);
          }
        }
      } catch (err) {
        console.error('Failed to delete thumbnail file:', err);
        // Non-critical: continue even if thumbnail deletion fails
      }
    }

    // If a RoomImage record exists for this URL, delete it and sync Room.images
    try {
      const roomImage = await db.roomImage.findFirst({
        where: { url: fileUrl },
      });
      if (roomImage) {
        const roomId = roomImage.roomId;
        await db.roomImage.delete({ where: { id: roomImage.id } });
        // Sync the Room.images JSON field after deletion
        await syncRoomImages(roomId);
      }
    } catch (err) {
      console.error('Failed to delete RoomImage record:', err);
      // Don't fail the delete request if the DB operation fails
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
