import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/identity-logs/[id] — Get a single log entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const log = await db.wiFiIdentityLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Identity verification log not found' } },
        { status: 404 },
      );
    }

    if (log.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Identity verification log not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error('[F14] Error fetching identity log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch identity verification log' } },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/identity-logs/[id] — Update verification status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const { verificationStatus, verifiedAt, failureReason } = data;

    if (!verificationStatus) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: verificationStatus' } },
        { status: 400 },
      );
    }

    const validStatuses = ['pending', 'verified', 'failed', 'skipped'];
    if (!validStatuses.includes(verificationStatus)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid verificationStatus. Must be one of: ${validStatuses.join(', ')}` } },
        { status: 400 },
      );
    }

    const existing = await db.wiFiIdentityLog.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Identity verification log not found' } },
        { status: 404 },
      );
    }

    if (existing.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Identity verification log not found' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {
      verificationStatus,
    };

    if (verificationStatus === 'verified') {
      updateData.verifiedAt = verifiedAt ? new Date(verifiedAt) : new Date();
      updateData.failureReason = null;
    } else if (verificationStatus === 'failed') {
      updateData.failureReason = failureReason || null;
    }

    const log = await db.wiFiIdentityLog.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error('[F14] Error updating identity log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update identity verification log' } },
      { status: 500 },
    );
  }
}
