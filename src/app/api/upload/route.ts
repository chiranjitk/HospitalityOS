/**
 * File Upload API
 * 
 * POST /api/upload - Upload a file and return its URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { requireAuth } from '@/lib/auth/tenant-context';
import { randomUUID } from 'crypto';

// Allowed file types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/json',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided. Use form field name "file".' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|csv|json|txt)$/i)) {
      return NextResponse.json(
        { success: false, error: `File type "${file.type}" is not allowed. Allowed: images, PDF, Office docs, CSV, JSON, text.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.` },
        { status: 400 }
      );
    }

    // Save file to /public/uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename to avoid collisions
    const ext = file.name.split('.').pop() || 'bin';
    const uniqueName = `${randomUUID()}.${ext}`;
    const filePath = join(uploadsDir, uniqueName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Return public URL
    const fileUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });
  } catch (error) {
    console.error('[UPLOAD_API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
