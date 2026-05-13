import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/identity-logs/export — Export verification logs as CSV
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { success: false, error: { code: 'UNSUPPORTED_FORMAT', message: 'Only CSV export is supported' } },
        { status: 400 },
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate query params are required' } },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      tenantId: TENANT_ID,
      createdAt: { gte: start, lte: end },
    };

    const logs = await db.wiFiIdentityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV content
    const headers = [
      'ID',
      'Username',
      'Session ID',
      'Verification Method',
      'Verified Identity',
      'Verification Status',
      'IP Address',
      'MAC Address',
      'Country Code',
      'ID Type',
      'Failure Reason',
      'Verified At',
      'Created At',
      'Property ID',
    ];

    const rows = logs.map(log => [
      log.id,
      log.username,
      log.sessionId || '',
      log.verificationMethod,
      log.verifiedIdentity || '',
      log.verificationStatus,
      log.ipAddress,
      log.macAddress || '',
      log.countryCode || '',
      log.idType || '',
      log.failureReason || '',
      log.verifiedAt ? log.verifiedAt.toISOString() : '',
      log.createdAt.toISOString(),
      log.propertyId || '',
    ]);

    // Escape CSV fields (handle commas, quotes, newlines)
    const escape = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(',')),
    ].join('\n');

    const filename = `identity-verification-logs-${startDate}-to-${endDate}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[F14] Error exporting identity logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export identity verification logs' } },
      { status: 500 },
    );
  }
}
