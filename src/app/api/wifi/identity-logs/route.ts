import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/identity-logs — List identity verification logs with filters and pagination
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const verificationMethod = searchParams.get('verificationMethod');
    const verificationStatus = searchParams.get('verificationStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const propertyId = searchParams.get('propertyId');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };

    if (verificationMethod && verificationMethod !== 'all') {
      where.verificationMethod = verificationMethod;
    }

    if (verificationStatus && verificationStatus !== 'all') {
      where.verificationStatus = verificationStatus;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = end;
      }
    }

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { ipAddress: { contains: search } },
        { sessionId: { contains: search } },
        { macAddress: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.wiFiIdentityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.wiFiIdentityLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('[F14] Error fetching identity logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch identity verification logs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/identity-logs — Create a new identity verification log entry
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      sessionId,
      username,
      verificationMethod = 'none',
      verifiedIdentity,
      verificationStatus = 'pending',
      ipAddress,
      macAddress,
      countryCode,
      idType,
      failureReason,
      propertyId,
    } = data;

    if (!username) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: username' } },
        { status: 400 },
      );
    }

    if (!ipAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: ipAddress' } },
        { status: 400 },
      );
    }

    const validMethods = ['none', 'room_number', 'otp_sms', 'otp_email', 'government_id', 'selfie_verify'];
    if (!validMethods.includes(verificationMethod)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid verificationMethod. Must be one of: ${validMethods.join(', ')}` } },
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

    const log = await db.wiFiIdentityLog.create({
      data: {
        tenantId: auth.tenantId,
        propertyId: propertyId || null,
        sessionId: sessionId || null,
        username,
        verificationMethod,
        verifiedIdentity: verifiedIdentity || null,
        verificationStatus,
        ipAddress,
        macAddress: macAddress || null,
        countryCode: countryCode || null,
        idType: idType || null,
        failureReason: failureReason || null,
        verifiedAt: verificationStatus === 'verified' ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('[F14] Error creating identity log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create identity verification log' } },
      { status: 500 },
    );
  }
}
