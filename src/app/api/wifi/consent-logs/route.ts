/**
 * WiFi Consent Logs API
 *
 * GET  — List consent logs with filters and pagination
 * POST — Record a new consent (called from captive portal)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { createHash } from 'crypto';

const TENANT_ID = 'tenant_01';

// GET /api/wifi/consent-logs — List consent logs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const consentType = searchParams.get('consentType');
    const propertyId = searchParams.get('propertyId');
    const optInStatus = searchParams.get('optInStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId: TENANT_ID };

    if (consentType) where.consentType = consentType;
    if (propertyId) where.propertyId = propertyId;
    if (optInStatus !== null && optInStatus !== undefined && optInStatus !== '') {
      where.optInMarketing = optInStatus === 'true';
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    if (search) {
      where.OR = [
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { sessionId: { contains: search, mode: 'insensitive' } },
        { guest: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ] } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.wiFiConsentLog.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true } },
          property: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiConsentLog.count({ where }),
    ]);

    // Count stats
    const [totalConsents, marketingOptIn, activeConsents] = await Promise.all([
      db.wiFiConsentLog.count({ where: { tenantId: TENANT_ID } }),
      db.wiFiConsentLog.count({ where: { tenantId: TENANT_ID, optInMarketing: true } }),
      db.wiFiConsentLog.count({
        where: {
          tenantId: TENANT_ID,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalConsents,
        marketingOptInRate: totalConsents > 0 ? Math.round((marketingOptIn / totalConsents) * 100) : 0,
        activeConsents,
      },
    });
  } catch (error) {
    console.error('Error fetching consent logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch consent logs' }, { status: 500 });
  }
}

// POST /api/wifi/consent-logs — Record a new consent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      guestId, sessionId, consentType, consentText,
      ipAddress, macAddress, userAgent, optInMarketing, dataRetentionDays,
    } = data;

    if (!sessionId || !consentType || !consentText || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'sessionId, consentType, consentText, and ipAddress are required' },
        { status: 400 },
      );
    }

    // Hash the consent text with SHA-256
    const consentTextHash = createHash('sha256').update(consentText as string).digest('hex');

    // Calculate expiry based on data retention days
    const retentionDays = (dataRetentionDays as number) || 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    const log = await db.wiFiConsentLog.create({
      data: {
        tenantId: TENANT_ID,
        guestId: (guestId as string) || null,
        propertyId: (data.propertyId as string) || null,
        sessionId: sessionId as string,
        consentType: consentType as string,
        consentTextHash,
        ipAddress: ipAddress as string,
        macAddress: (macAddress as string) || null,
        userAgent: (userAgent as string) || null,
        optInMarketing: (optInMarketing as boolean) || false,
        dataRetentionDays: retentionDays,
        expiresAt,
      },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true, email: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: log, message: 'Consent recorded successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error recording consent:', error);
    return NextResponse.json({ success: false, error: 'Failed to record consent' }, { status: 500 });
  }
}
