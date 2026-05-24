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
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/consent-logs — List consent logs
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage') && !hasPermission(auth, 'reports.view')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: requires wifi.manage or reports.view' },
      { status: 403 },
    );
  }

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

    const where: Record<string, unknown> = { tenantId: auth.tenantId };

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

    // If search includes a space, try to find matching guest IDs by name
    let matchingGuestIds: string[] = [];
    if (search) {
      const guestsByName = await db.guest.findMany({
        where: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 100,
      });
      matchingGuestIds = guestsByName.map((g) => g.id);

      const orConditions: Record<string, unknown>[] = [
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { sessionId: { contains: search, mode: 'insensitive' } },
      ];
      if (matchingGuestIds.length > 0) {
        orConditions.push({ guestId: { in: matchingGuestIds } });
      }
      where.OR = orConditions;
    }

    const [logs, total] = await Promise.all([
      db.wiFiConsentLog.findMany({
        where,
        include: {
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
      db.wiFiConsentLog.count({ where: { tenantId: auth.tenantId } }),
      db.wiFiConsentLog.count({ where: { tenantId: auth.tenantId, optInMarketing: true } }),
      db.wiFiConsentLog.count({
        where: {
          tenantId: auth.tenantId,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    // Enrich with guest data (no relation in schema, lookup separately)
    const guestIds = [...new Set(logs.map((l) => l.guestId).filter(Boolean))] as string[];
    let guestMap: Record<string, { id: string; firstName: string | null; lastName: string | null; email: string | null }> = {};
    if (guestIds.length > 0) {
      const guests = await db.guest.findMany({
        where: { id: { in: guestIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      guestMap = Object.fromEntries(guests.map((g) => [g.id, g]));
    }

    const enrichedLogs = logs.map((l) => ({
      ...l,
      guest: l.guestId ? (guestMap[l.guestId] ?? null) : null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedLogs,
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: requires wifi.manage' },
      { status: 403 },
    );
  }

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
        tenantId: auth.tenantId,
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
        property: { select: { id: true, name: true } },
      },
    });

    // Enrich with guest data (no relation in schema, lookup separately)
    const enrichedLog = { ...log, guest: null as unknown };
    if (log.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: log.guestId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      enrichedLog.guest = guest;
    } else {
      enrichedLog.guest = null;
    }

    return NextResponse.json({ success: true, data: enrichedLog, message: 'Consent recorded successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error recording consent:', error);
    return NextResponse.json({ success: false, error: 'Failed to record consent' }, { status: 500 });
  }
}
