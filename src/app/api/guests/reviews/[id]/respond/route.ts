import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { analyzeReviewSentiment } from '@/lib/ai/review-analyzer';

// POST /api/guests/reviews/[id]/respond - Submit response to a review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for responding to reviews
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { responseText } = body;

    if (!responseText || !responseText.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'responseText is required' } },
        { status: 400 }
      );
    }

    // Verify review belongs to tenant
    const review = await db.onlineReview.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!review) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } }, { status: 404 });
    }

    // Get AI-suggested tone for the response
    const toneSuggestion = await analyzeReviewSentiment(review.content || review.title || '');

    const updated = await db.onlineReview.update({
      where: { id },
      data: {
        responseText,
        respondedAt: new Date(),
        respondedBy: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      toneSuggestion: {
        reviewSentiment: toneSuggestion.label,
        suggestedTone: toneSuggestion.label === 'positive' ? 'appreciative and warm' :
          toneSuggestion.label === 'negative' ? 'empathetic and solution-oriented' :
          toneSuggestion.label === 'mixed' ? 'balanced and constructive' :
          'professional and courteous',
        categories: toneSuggestion.categories,
      },
    });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to review' } }, { status: 500 });
  }
}
