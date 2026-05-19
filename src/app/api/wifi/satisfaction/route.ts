/**
 * WiFi Satisfaction Survey API
 *
 * GET  — List satisfaction surveys with filters and pagination
 * POST — Submit a new satisfaction survey
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/satisfaction — List surveys
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const ratingMin = searchParams.get('ratingMin');
    const ratingMax = searchParams.get('ratingMax');
    const propertyId = searchParams.get('propertyId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const apName = searchParams.get('apName');
    const roomNumber = searchParams.get('roomNumber');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };

    if (ratingMin) where.rating = { ...((where.rating as Record<string, unknown>) || {}), gte: parseInt(ratingMin) };
    if (ratingMax) where.rating = { ...((where.rating as Record<string, unknown>) || {}), lte: parseInt(ratingMax) };
    if (propertyId) where.propertyId = propertyId;
    if (apName) where.apName = { contains: apName, mode: 'insensitive' };
    if (roomNumber) where.roomNumber = { contains: roomNumber, mode: 'insensitive' };

    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, unknown> = {};
      if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
      if (dateTo) createdAtFilter.lte = new Date(dateTo);
      where.createdAt = createdAtFilter;
    }

    const [surveys, total] = await Promise.all([
      db.wiFiSatisfactionSurvey.findMany({
        where,
        include: {
          guest: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          property: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiSatisfactionSurvey.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: surveys,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching satisfaction surveys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch satisfaction surveys' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/satisfaction — Submit new survey
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const { rating, sessionId, comment, categories, deviceType, roomNumber, apName, guestId, propertyId } = data;

    // Validate rating
    const ratingValue = parseInt(String(rating));
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate categories if provided
    if (categories) {
      const cats = typeof categories === 'string' ? JSON.parse(categories) : categories;
      const validKeys = ['speed', 'coverage', 'easeOfConnect'];
      for (const key of Object.keys(cats)) {
        if (!validKeys.includes(key)) {
          return NextResponse.json(
            { success: false, error: `Invalid category: ${key}. Valid categories: speed, coverage, easeOfConnect` },
            { status: 400 }
          );
        }
        const val = cats[key];
        if (typeof val !== 'number' || val < 1 || val > 5) {
          return NextResponse.json(
            { success: false, error: `Category ${key} must be a number between 1 and 5` },
            { status: 400 }
          );
        }
      }
    }

    const survey = await db.wiFiSatisfactionSurvey.create({
      data: {
        tenantId: auth.tenantId,
        guestId: (guestId as string) || null,
        propertyId: (propertyId as string) || null,
        sessionId: (sessionId as string) || null,
        rating: ratingValue,
        comment: (comment as string) || null,
        categories: categories ? (typeof categories === 'string' ? categories : JSON.stringify(categories)) : '{}',
        deviceType: (deviceType as string) || null,
        roomNumber: (roomNumber as string) || null,
        apName: (apName as string) || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: survey, message: 'Survey submitted successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting satisfaction survey:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit satisfaction survey' },
      { status: 500 }
    );
  }
}
