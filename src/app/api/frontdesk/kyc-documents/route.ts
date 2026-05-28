import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// H-14 FIX: API endpoint for persisting KYC documents to the GuestDocument table.
// Previously KYC documents were only stored in local React state and never sent
// to the server, meaning they were lost on page reload / navigation.

const createDocumentSchema = z.object({
  guestId: z.string().uuid('Invalid guest ID'),
  type: z.string().min(1, 'Document type is required'),
  name: z.string().min(1, 'File name is required'),
  fileData: z.string().min(1, 'File data (base64) is required'),
  fileName: z.string().min(1, 'Original file name is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
});

// POST /api/frontdesk/kyc-documents — Upload and persist a KYC document
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (
      !hasPermission(user, 'guests.manage') &&
      !hasPermission(user, 'frontdesk.*') &&
      !hasPermission(user, 'admin.*') &&
      user.roleName !== 'admin'
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const { guestId, type, name, fileData, fileName, fileSize, mimeType } = parsed.data;

    // Verify the guest belongs to the authenticated user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 },
      );
    }

    // Create a data URI for the fileUrl (stores base64 inline).
    // For production, this should be replaced with object storage (S3, GCS, etc.)
    // and only the URL should be stored in the database.
    const fileUrl = `data:${mimeType};base64,${fileData.replace(/^data:[^;]+;base64,/, '')}`;

    const document = await db.guestDocument.create({
      data: {
        guestId,
        type,
        name,
        fileUrl,
        status: 'pending',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: document.id,
          guestId: document.guestId,
          type: document.type,
          name: document.name,
          status: document.status,
          createdAt: document.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[KYC Documents POST] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save KYC document' } },
      { status: 500 },
    );
  }
}

// GET /api/frontdesk/kyc-documents?guestId=xxx — List documents for a guest
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const guestId = request.nextUrl.searchParams.get('guestId');
    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId query parameter is required' } },
        { status: 400 },
      );
    }

    // Tenant isolation: verify guest belongs to this tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 },
      );
    }

    const documents = await db.guestDocument.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        createdAt: true,
        // Exclude fileUrl from list response for performance;
        // include it via a separate detail endpoint if needed.
      },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error('[KYC Documents GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch KYC documents' } },
      { status: 500 },
    );
  }
}
