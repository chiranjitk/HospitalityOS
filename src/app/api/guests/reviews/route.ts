import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { analyzeReviewSentiment } from '@/lib/ai/review-analyzer';

// GET /api/guests/reviews - List reviews with filters and aggregates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const platform = searchParams.get('platform');
    const rating = searchParams.get('rating');
    const sentiment = searchParams.get('sentiment');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const responded = searchParams.get('responded');
    const propertyId = searchParams.get('propertyId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (platform) where.platform = platform;
    if (rating) where.rating = parseFloat(rating);
    if (sentiment) where.sentimentLabel = sentiment;
    if (responded === 'true') where.respondedAt = { not: null };
    if (responded === 'false') where.respondedAt = null;
    if (propertyId) where.propertyId = propertyId;
    if (startDate || endDate) {
      where.reviewDate = {};
      if (startDate) (where.reviewDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.reviewDate as Record<string, unknown>).lte = new Date(endDate);
    }

    const [reviews, total] = await Promise.all([
      db.onlineReview.findMany({
        where,
        orderBy: { reviewDate: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.onlineReview.count({ where }),
    ]);

    // Aggregates
    const allReviews = await db.onlineReview.findMany({
      where: { tenantId: user.tenantId },
      select: { platform: true, rating: true, sentimentLabel: true, respondedAt: true },
    });

    // Average rating per platform
    const platformRatings: Record<string, { count: number; avg: number }> = {};
    for (const review of allReviews) {
      if (!platformRatings[review.platform]) {
        platformRatings[review.platform] = { count: 0, avg: 0 };
      }
      platformRatings[review.platform].count++;
      platformRatings[review.platform].avg += review.rating;
    }
    for (const key of Object.keys(platformRatings)) {
      const p = platformRatings[key];
      p.avg = Math.round((p.avg / p.count) * 10) / 10;
    }

    // Sentiment distribution
    const sentimentDist: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    for (const review of allReviews) {
      const label = review.sentimentLabel || 'neutral';
      if (sentimentDist[label] !== undefined) sentimentDist[label]++;
    }

    // Response rate
    const respondedCount = allReviews.filter(r => r.respondedAt !== null).length;
    const responseRate = allReviews.length > 0 ? Math.round((respondedCount / allReviews.length) * 100) : 0;

    // Overall avg
    const overallAvg = allReviews.length > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      data: reviews.map(r => ({
        ...r,
        categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories,
      })),
      pagination: { total, limit, offset },
      aggregates: {
        totalReviews: allReviews.length,
        overallAvgRating: overallAvg,
        responseRate,
        platformRatings,
        sentimentDistribution: sentimentDist,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } }, { status: 500 });
  }
}

// POST /api/guests/reviews - Add new review (manual or imported)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for creating reviews
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, platform, externalId, authorName, rating, title, content, reviewDate, guestId } = body;

    if (!propertyId || !platform || !authorName || rating === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId, platform, authorName, and rating are required' } },
        { status: 400 }
      );
    }

    if (rating < 0 || rating > 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 0 and 5' } },
        { status: 400 }
      );
    }

    // Validate property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Run sentiment analysis
    const analysis = await analyzeReviewSentiment(content || title || '');

    const review = await db.onlineReview.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        platform,
        externalId: externalId || undefined,
        authorName,
        rating,
        title: title || undefined,
        content: content || undefined,
        reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
        guestId: guestId || undefined,
        sentimentScore: analysis.score,
        sentimentLabel: analysis.label,
        categories: JSON.stringify(analysis.categories),
      },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create review' } }, { status: 500 });
  }
}
