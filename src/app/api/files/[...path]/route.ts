import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Resolve upload dir — try multiple strategies to find the project root
// 1. UPLOAD_DIR env var (explicit override)
// 2. Find package.json walking up from this file
// 3. Fallback to process.cwd()
function resolveUploadDir(): string {
  // Strategy 1: Explicit env var
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;

  // Strategy 2: Walk up from this file to find package.json (project root)
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'upload'))) {
      return path.resolve(dir, 'upload');
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }

  // Strategy 3: Fallback to cwd
  return path.resolve(process.cwd(), 'upload');
}

const UPLOAD_DIR = resolveUploadDir();

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
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
