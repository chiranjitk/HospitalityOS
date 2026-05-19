import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

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

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
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
    // URL format: /api/files/{folder}/{filename}
    const relativePath = fileUrl.replace('/api/files/', '');

    // Validate relative path: must be exactly folder/filename (no traversal)
    const parts = relativePath.split('/');
    if (parts.length !== 2 || parts.some(p => p.includes('..') || p.length === 0)) {
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
