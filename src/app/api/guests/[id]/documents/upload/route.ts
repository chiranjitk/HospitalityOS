import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { logGuest } from '@/lib/audit/middleware';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ── Constants ──
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const ALLOWED_DOC_TYPES = [
  'passport',
  'national_id',
  'drivers_license',
  'visa',
  'residence_permit',
  'signature',
  'other',
];

// MIME type → file extension mapping
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// POST /api/guests/[id]/documents/upload — Upload a KYC document via multipart/form-data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Authentication & Authorization ──
    const user = await requirePermission(request, 'guests.edit');
    if (user instanceof NextResponse) return user;

    const { id: guestId } = await params;
    const tenantId = user.tenantId;

    // ── Verify guest exists and belongs to tenant ──
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 },
      );
    }

    // ── Parse multipart form data ──
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docType = formData.get('type') as string | null;
    const docStatus = (formData.get('status') as string | null) || 'pending';

    // ── Validate required fields ──
    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File is required' } },
        { status: 400 },
      );
    }

    if (!docType) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document type is required' } },
        { status: 400 },
      );
    }

    // ── Validate document type ──
    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid document type. Must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // ── Validate document status ──
    const allowedStatuses = ['pending', 'verified', 'rejected'];
    if (!allowedStatuses.includes(docStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // ── Validate file type ──
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // ── Validate file size ──
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 10MB`,
          },
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty' } },
        { status: 400 },
      );
    }

    // ── Generate unique filename ──
    const ext = MIME_TO_EXT[file.type] || path.extname(file.name) || '.bin';
    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 50); // Limit name length
    const uniqueFileName = `${tenantId}/${guestId}/${docType}_${timestamp}${ext}`;

    // ── Ensure upload directory exists ──
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents', tenantId, guestId);
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (dirError) {
      console.error('[Document Upload] Failed to create upload directory:', dirError);
      return NextResponse.json(
        { success: false, error: { code: 'STORAGE_ERROR', message: 'Failed to prepare storage directory' } },
        { status: 500 },
      );
    }

    // ── Save file to disk ──
    const filePath = path.join(uploadDir, `${docType}_${timestamp}${ext}`);
    let fileUrl: string;

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, fileBuffer);
      fileUrl = `/uploads/documents/${uniqueFileName}`;
    } catch (writeError) {
      console.error('[Document Upload] Failed to write file:', writeError);
      return NextResponse.json(
        { success: false, error: { code: 'STORAGE_ERROR', message: 'Failed to save uploaded file' } },
        { status: 500 },
      );
    }

    // ── Create GuestDocument record ──
    const documentName = file.name || `${docType} document`;

    const createData: Record<string, unknown> = {
      guestId,
      type: docType,
      name: documentName,
      fileUrl,
      status: docStatus,
    };

    if (docStatus === 'verified') {
      createData.verifiedAt = new Date();
      createData.verifiedBy = user.userId;
    }

    const document = await db.guestDocument.create({
      data: createData as {
        guestId: string;
        type: string;
        name: string;
        fileUrl: string;
        status: string;
        verifiedAt?: Date;
        verifiedBy?: string;
      },
    });

    // ── Auto-update guest KYC status if all documents are verified ──
    if (docStatus === 'verified') {
      try {
        await checkAndUpdateGuestKycStatus(guestId);
      } catch (kycError) {
        console.error('[Document Upload] KYC status auto-update failed (non-blocking):', kycError);
      }
    }

    // ── Audit log (non-blocking) ──
    try {
      await logGuest(request, 'create', guestId, undefined, {
        documentId: document.id,
        documentType: docType,
        fileName: documentName,
        fileSize: file.size,
        mimeType: file.type,
      }, { tenantId, userId: user.userId });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json(
      {
        success: true,
        data: document,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error uploading document:', error);

    // Handle FormData parsing errors
    if (error instanceof TypeError && error.message.includes('FormData')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Request must be multipart/form-data' } },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload document' } },
      { status: 500 },
    );
  }
}

// ────────────────────────────────────────────
// Helper: Check all documents and update guest KYC status
// ────────────────────────────────────────────
async function checkAndUpdateGuestKycStatus(guestId: string): Promise<void> {
  const allDocs = await db.guestDocument.findMany({
    where: { guestId },
  });

  // Only update if there's at least one document
  if (allDocs.length === 0) return;

  const allVerified = allDocs.every((doc) => doc.status === 'verified');
  const anyRejected = allDocs.some((doc) => doc.status === 'rejected');

  let newKycStatus: string;
  if (allVerified) {
    newKycStatus = 'verified';
  } else if (anyRejected) {
    // Keep as pending if some are still pending; only set rejected if ALL are rejected
    const allRejected = allDocs.every((doc) => doc.status === 'rejected');
    newKycStatus = allRejected ? 'rejected' : 'pending';
  } else {
    newKycStatus = 'pending';
  }

  const updateData: Record<string, unknown> = { kycStatus: newKycStatus };
  if (newKycStatus === 'verified') {
    updateData.kycVerifiedAt = new Date();
    updateData.kycCompleted = true;
  }

  await db.guest.update({
    where: { id: guestId },
    data: updateData,
  });
}
