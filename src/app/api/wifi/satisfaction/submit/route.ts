/**
 * Public Survey Submission API
 *
 * POST /api/wifi/satisfaction/submit
 *
 * Guest-facing endpoint (no requireAuth) for submitting WiFi satisfaction surveys.
 * Includes rate limiting: max 1 per sessionId per 24h, max 1 per IP per hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ---- helpers ----

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function checkSessionRateLimit(
  sessionId: string | null,
  tenantId: string
): Promise<boolean> {
  if (!sessionId) return false; // no sessionId = no session-based limit

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.wiFiSatisfactionSurvey.count({
    where: {
      tenantId,
      sessionId,
      createdAt: { gte: cutoff },
    },
  });
  return existing > 0;
}

async function checkIpRateLimit(
  ipAddress: string,
  tenantId: string
): Promise<boolean> {
  if (!ipAddress || ipAddress === 'unknown') return false;

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await db.wiFiSatisfactionSurvey.count({
    where: {
      tenantId,
      ipAddress,
      createdAt: { gte: cutoff },
    },
  });
  return existing > 0;
}

// ---- route ----

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      propertyId,
      sessionId,
      guestId,
      rating,
      comment,
      categories,
      deviceType,
      roomNumber,
      apName,
    } = body as Record<string, unknown>;

    // --- Validation ---

    // tenantId required — validated against known tenants since this is a public endpoint
    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // FIX: Validate that the tenantId corresponds to an actual tenant.
    // This is a public endpoint (no auth), so we cannot use an authenticated user's tenantId.
    // Validate against the database to prevent spoofing arbitrary tenant IDs.
    const tenantExists = await db.tenant.findUnique({
      where: { id: tenantId as string },
      select: { id: true, status: true },
    });
    if (!tenantExists || tenantExists.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive tenant' },
        { status: 400 }
      );
    }

    // rating required, 1-5 integer
    const ratingValue = typeof rating === 'number' ? rating : parseInt(String(rating ?? ''));
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5 || !Number.isInteger(ratingValue)) {
      return NextResponse.json(
        { success: false, error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // comment optional, max 1000 chars
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Comment must be a string' },
          { status: 400 }
        );
      }
      if (comment.length > 1000) {
        return NextResponse.json(
          { success: false, error: 'Comment must be at most 1000 characters' },
          { status: 400 }
        );
      }
    }

    // categories optional, must be object with speed/coverage/easeOfConnect (each 1-5)
    if (categories !== undefined && categories !== null) {
      if (typeof categories !== 'object' || Array.isArray(categories)) {
        return NextResponse.json(
          { success: false, error: 'Categories must be an object' },
          { status: 400 }
        );
      }
      const validKeys = ['speed', 'coverage', 'easeOfConnect'];
      const cats = categories as Record<string, unknown>;
      for (const key of Object.keys(cats)) {
        if (!validKeys.includes(key)) {
          return NextResponse.json(
            { success: false, error: `Invalid category: ${key}. Valid categories: speed, coverage, easeOfConnect` },
            { status: 400 }
          );
        }
        const val = cats[key];
        if (typeof val !== 'number' || val < 1 || val > 5 || !Number.isInteger(val)) {
          return NextResponse.json(
            { success: false, error: `Category ${key} must be an integer between 1 and 5` },
            { status: 400 }
          );
        }
      }
    }

    // --- Rate Limiting ---

    const clientIp = getClientIp(request);

    // Max 1 survey per sessionId per 24 hours
    if (sessionId && typeof sessionId === 'string') {
      const sessionLimited = await checkSessionRateLimit(sessionId, tenantId);
      if (sessionLimited) {
        return NextResponse.json(
          {
            success: false,
            error: 'You have already submitted a survey for this session. Please try again later.',
            code: 'RATE_LIMITED_SESSION',
          },
          { status: 429 }
        );
      }
    }

    // Max 1 survey per IP per hour
    const ipLimited = await checkIpRateLimit(clientIp, tenantId);
    if (ipLimited) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many survey submissions. Please try again later.',
          code: 'RATE_LIMITED_IP',
        },
        { status: 429 }
      );
    }

    // --- Resolve guestId from sessionId if not provided ---
    // When the portal doesn't pass guestId (e.g. manually created users),
    // try to resolve it from the radacct session → WiFiUser → guestId.
    let resolvedGuestId: string | null = typeof guestId === 'string' && guestId.length > 0 ? guestId : null;
    let resolvedUsername: string | null = null;
    if (!resolvedGuestId && sessionId && typeof sessionId === 'string') {
      try {
        // Look up the radacct row to find the username, then WiFiUser for guestId
        const radAcctRow = await db.$queryRawUnsafe<Array<{ username: string }>>(
          `SELECT username FROM radacct WHERE acctsessionid = $1 AND acctstoptime IS NULL LIMIT 1`,
          sessionId
        );
        if (radAcctRow.length > 0 && radAcctRow[0].username) {
          resolvedUsername = radAcctRow[0].username;
          const wifiUser = await db.wiFiUser.findUnique({
            where: { username: resolvedUsername },
            select: { guestId: true },
          });
          if (wifiUser?.guestId) {
            resolvedGuestId = wifiUser.guestId;
          }
        }
      } catch {
        // Non-critical — proceed without guestId
      }
    }

    // --- Create survey ---

    const survey = await db.wiFiSatisfactionSurvey.create({
      data: {
        tenantId,
        propertyId: typeof propertyId === 'string' ? propertyId : null,
        sessionId: typeof sessionId === 'string' ? sessionId : null,
        guestId: resolvedGuestId,
        rating: ratingValue,
        comment: typeof comment === 'string' && comment.length > 0 ? comment : null,
        categories: categories
          ? JSON.stringify(categories)
          : '{}',
        deviceType: typeof deviceType === 'string' ? deviceType : null,
        roomNumber: typeof roomNumber === 'string' ? roomNumber : null,
        apName: typeof apName === 'string' ? apName : null,
        ipAddress: clientIp !== 'unknown' ? clientIp : null,
      },
    });

    return NextResponse.json(
      { success: true, id: survey.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting public satisfaction survey:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit survey' },
      { status: 500 }
    );
  }
}
