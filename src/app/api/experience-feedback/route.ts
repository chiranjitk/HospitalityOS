import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { notifyGuestReview } from '@/lib/notify';

// GET /api/experience-feedback - List feedback
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_feedback.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const experienceId = searchParams.get('experienceId');
    const rating = searchParams.get('rating');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (experienceId) where.experienceId = experienceId;
    if (rating) where.rating = parseInt(rating);
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { guestName: { contains: search } },
        { reviewText: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const feedback = await db.experienceFeedback.findMany({
      where,
      include: {
        experience: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Rating distribution
    const ratingDist = await db.experienceFeedback.groupBy({
      by: ['rating'],
      where: { tenantId: user.tenantId },
      _count: { id: true },
    });

    // Average rating per experience
    const avgByExperience = await db.experienceFeedback.groupBy({
      by: ['experienceId'],
      where: { tenantId: user.tenantId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const experienceIds = avgByExperience.map(e => e.experienceId);
    const experiences = experienceIds.length > 0
      ? await db.experience.findMany({
          where: { id: { in: experienceIds } },
          select: { id: true, name: true },
        })
      : [];

    const expMap = new Map(experiences.map(e => [e.id, e]));

    return NextResponse.json({
      success: true,
      data: feedback,
      stats: {
        ratingDistribution: ratingDist.map(r => ({
          rating: r.rating,
          count: r._count.id,
        })),
        averageByExperience: avgByExperience.map(a => ({
          experienceId: a.experienceId,
          experienceName: expMap.get(a.experienceId)?.name || 'Unknown',
          avgRating: Math.round((a._avg.rating || 0) * 10) / 10,
          totalReviews: a._count.id,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch feedback' } },
      { status: 500 }
    );
  }
}

// POST /api/experience-feedback - Create feedback
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_feedback.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { experienceBookingId, experienceId, guestId, guestName, rating, reviewText, category, staffResponse } = body;

    if (!experienceId || !guestName || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: experienceId, guestName, rating (1-5)' } },
        { status: 400 }
      );
    }

    // Verify experience belongs to tenant
    const experience = await db.experience.findFirst({
      where: { id: experienceId, tenantId: user.tenantId },
    });

    if (!experience) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 }
      );
    }

    // Sanitize reviewText and staffResponse (strip HTML tags)
    const sanitizedReviewText = reviewText ? String(reviewText).replace(/<[^>]*>/g, '').trim() : reviewText;
    const sanitizedStaffResponse = staffResponse ? String(staffResponse).replace(/<[^>]*>/g, '').trim() : staffResponse;

    const feedback = await db.experienceFeedback.create({
      data: {
        tenantId: user.tenantId,
        experienceBookingId,
        experienceId,
        guestId,
        guestName,
        rating,
        reviewText: sanitizedReviewText,
        category,
        staffResponse: sanitizedStaffResponse,
        status: 'published',
      },
    });

    // Update experience average rating in transaction
    await db.$transaction(async (tx) => {
      const allFeedback = await tx.experienceFeedback.findMany({
        where: { experienceId, tenantId: user.tenantId },
        select: { rating: true },
      });
      const avgRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
      await tx.experience.update({
        where: { id: experienceId },
        data: {
          rating: Math.round(avgRating * 10) / 10,
          totalReviews: allFeedback.length,
        },
      });
    });

    notifyGuestReview({
      tenantId: user.tenantId,
      userId: user.id,
      guestName: feedback.guestName || 'Guest',
      rating: feedback.rating || 0,
      reviewText: feedback.reviewText || undefined,
    });

    return NextResponse.json({ success: true, data: feedback }, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create feedback' } },
      { status: 500 }
    );
  }
}

// PUT /api/experience-feedback - Update feedback (reply, toggle status)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_feedback.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, staffResponse, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Feedback ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experienceFeedback.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } },
        { status: 404 }
      );
    }

    // Sanitize staffResponse (strip HTML tags)
    const sanitizedStaffResponse = staffResponse !== undefined
      ? (staffResponse === null ? null : String(staffResponse).replace(/<[^>]*>/g, '').trim())
      : undefined;

    const updateData: Record<string, unknown> = {};
    if (sanitizedStaffResponse !== undefined) updateData.staffResponse = sanitizedStaffResponse;
    if (status !== undefined) updateData.status = status;

    const updated = await db.experienceFeedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update feedback' } },
      { status: 500 }
    );
  }
}

// DELETE /api/experience-feedback - Remove feedback
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_feedback.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Feedback ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experienceFeedback.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } },
        { status: 404 }
      );
    }

    // Soft delete instead of hard delete
    await db.experienceFeedback.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete feedback' } },
      { status: 500 }
    );
  }
}
