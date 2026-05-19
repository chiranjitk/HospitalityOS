import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Resolve upload dir relative to project root (works on any setup)
const UPLOAD_DIR = path.resolve(process.cwd(), 'upload');

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Reconstruct the relative file path from the catch-all segments
    const relativePath = pathSegments.join('/');

    // Resolve to an absolute path
    const resolvedPath = path.resolve(UPLOAD_DIR, relativePath);

    // Prevent directory traversal: ensure the resolved path is within UPLOAD_DIR
    if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep) && resolvedPath !== UPLOAD_DIR) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Check if the file exists
    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Verify it's a file, not a directory
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Determine Content-Type from file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext];

    if (!contentType) {
      return new NextResponse('Unsupported file type', { status: 415 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(resolvedPath);

    // Return the file with proper headers
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[File Serve] Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
