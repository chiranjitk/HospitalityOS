import { describe, it, expect, afterAll } from 'vitest';
import { GET as getReviews, POST as createReview, PUT as updateReview, DELETE as deleteReview } from '@/app/api/crm/reviews/route';
import { GET as getFeedback, POST as createFeedback, PUT as updateFeedback, DELETE as deleteFeedback } from '@/app/api/crm/feedback/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  GUEST_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track IDs for cleanup
const createdReviewIds: string[] = [];
const createdFeedbackIds: string[] = [];

describe('CRM API', () => {
  // ─── Reviews ─────────────────────────────────────────────────────

  describe('GET /api/crm/reviews', () => {
    it('should return list of reviews with stats', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url);
      const res = await getReviews(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.reviews).toBeDefined();
      expect(Array.isArray(data.data.reviews)).toBe(true);
      expect(typeof data.data.total).toBe('number');
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.totalReviews).toBe('number');
      expect(typeof data.data.stats.averageRating).toBe('number');
      expect(data.data.stats.ratingDistribution).toBeDefined();
      expect(data.data.stats.sentimentBreakdown).toBeDefined();
      expect(data.data.stats.bySource).toBeDefined();
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/crm/reviews', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getReviews(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.reviews)).toBe(true);
    });

    it('should filter by source', async () => {
      const url = buildUrl('/api/crm/reviews', { source: 'internal' });
      const req = await createAuthRequest(url);
      const res = await getReviews(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // All returned reviews should be from internal source
      data.data.reviews.forEach((r: any) => {
        expect(r.source).toBe('internal');
      });
    });

    it('should filter by minRating', async () => {
      const url = buildUrl('/api/crm/reviews', { minRating: '4' });
      const req = await createAuthRequest(url);
      const res = await getReviews(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.reviews.forEach((r: any) => {
        expect(r.overallRating).toBeGreaterThanOrEqual(4);
      });
    });

    it('should respect limit and offset', async () => {
      const url = buildUrl('/api/crm/reviews', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await getReviews(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.reviews.length).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/crm/reviews', () => {
    it('should create a new review', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 5,
          cleanlinessRating: 5,
          serviceRating: 4,
          locationRating: 5,
          valueRating: 4,
          title: `Excellent stay review ${suffix}`,
          comment: 'The room was fantastic and staff were very helpful.',
          source: 'internal',
        },
      });
      const res = await createReview(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.overallRating).toBe(5);
      expect(data.data.source).toBe('internal');
      expect(data.data.sentimentScore).toBeDefined();
      expect(data.data.sentimentLabel).toBe('positive');
      expect(data.data.guest).toBeDefined();
      expect(data.data.guest.id).toBe(GUEST_ID);
      createdReviewIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { overallRating: 4 }, // missing guestId and propertyId
      });
      const res = await createReview(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject creation with non-existent guest', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: '00000000-0000-0000-0000-000000000000',
          propertyId: PROPERTY_ID,
          overallRating: 3,
        },
      });
      const res = await createReview(req as any);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should calculate correct sentiment for low rating', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 2,
          title: `Poor experience ${suffix}`,
          comment: 'Room was not clean.',
        },
      });
      const res = await createReview(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.sentimentLabel).toBe('negative');
      createdReviewIds.push(data.data.id);
    });

    it('should calculate correct sentiment for medium rating', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 3,
          title: `Average stay ${suffix}`,
          comment: 'Okay experience, nothing special.',
        },
      });
      const res = await createReview(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.sentimentLabel).toBe('neutral');
      createdReviewIds.push(data.data.id);
    });
  });

  describe('PUT /api/crm/reviews', () => {
    it('should update a review with a response', async () => {
      // First create a review
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/crm/reviews');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 4,
          title: `Review to respond ${suffix}`,
        },
      });
      const createRes = await createReview(createReq as any);
      const createData = await createRes.json();
      const reviewId = createData.data.id;
      createdReviewIds.push(reviewId);

      // Add a response
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: reviewId,
          responseText: 'Thank you for your feedback! We are glad you enjoyed your stay.',
        },
      });
      const res = await updateReview(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.responseText).toContain('Thank you');
      expect(data.data.respondedAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { responseText: 'Some response' }, // missing id
      });
      const res = await updateReview(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent review', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          responseText: 'Response',
        },
      });
      const res = await updateReview(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/crm/reviews', () => {
    it('should delete a review', async () => {
      // Create first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/crm/reviews');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 3,
          title: `To delete ${suffix}`,
        },
      });
      const createRes = await createReview(createReq as any);
      const createData = await createRes.json();
      const reviewId = createData.data.id;

      // Delete
      const url = buildUrl('/api/crm/reviews', { id: reviewId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteReview(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/crm/reviews');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteReview(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── Feedback ────────────────────────────────────────────────────

  describe('GET /api/crm/feedback', () => {
    it('should return list of feedback with stats', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url);
      const res = await getFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toBeDefined();
      expect(Array.isArray(data.data.feedbacks)).toBe(true);
      expect(typeof data.data.total).toBe('number');
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.open).toBe('number');
      expect(typeof data.data.stats.resolved).toBe('number');
      expect(data.data.stats.byType).toBeDefined();
      expect(data.data.stats.byStatus).toBeDefined();
      expect(data.data.stats.byPriority).toBeDefined();
    });

    it('should filter by type', async () => {
      const url = buildUrl('/api/crm/feedback', { type: 'complaint' });
      const req = await createAuthRequest(url);
      const res = await getFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.feedbacks.forEach((f: any) => {
        expect(f.type).toBe('complaint');
      });
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/crm/feedback', { status: 'open' });
      const req = await createAuthRequest(url);
      const res = await getFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.feedbacks.forEach((f: any) => {
        expect(f.status).toBe('open');
      });
    });

    it('should filter by priority', async () => {
      const url = buildUrl('/api/crm/feedback', { priority: 'high' });
      const req = await createAuthRequest(url);
      const res = await getFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.feedbacks.forEach((f: any) => {
        expect(f.priority).toBe('high');
      });
    });

    it('should respect pagination', async () => {
      const url = buildUrl('/api/crm/feedback', { limit: '3', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await getFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.feedbacks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /api/crm/feedback', () => {
    it('should create a new feedback entry', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          type: 'complaint',
          category: 'room cleanliness',
          subject: `Dirty bathroom ${suffix}`,
          description: 'The bathroom was not properly cleaned during our stay.',
          priority: 'high',
        },
      });
      const res = await createFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.type).toBe('complaint');
      expect(data.data.category).toBe('room cleanliness');
      expect(data.data.status).toBe('open');
      expect(data.data.priority).toBe('high');
      expect(data.data.guest).toBeDefined();
      expect(data.data.guest.id).toBe(GUEST_ID);
      createdFeedbackIds.push(data.data.id);
    });

    it('should create feedback with default priority', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          type: 'suggestion',
          category: 'amenities',
          subject: `Add more towels ${suffix}`,
          description: 'Would be nice to have extra towels in the room.',
        },
      });
      const res = await createFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.priority).toBe('medium');
      createdFeedbackIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { type: 'complaint' }, // missing guestId, subject, description, category
      });
      const res = await createFeedback(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject creation with non-existent guest', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: '00000000-0000-0000-0000-000000000000',
          propertyId: PROPERTY_ID,
          type: 'suggestion',
          category: 'general',
          subject: 'Test',
          description: 'Test feedback',
        },
      });
      const res = await createFeedback(req as any);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should create compliment type feedback', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          type: 'compliment',
          category: 'service',
          subject: `Great staff ${suffix}`,
          description: 'The front desk staff were exceptionally friendly.',
          priority: 'low',
        },
      });
      const res = await createFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.type).toBe('compliment');
      expect(data.data.priority).toBe('low');
      createdFeedbackIds.push(data.data.id);
    });
  });

  describe('PUT /api/crm/feedback', () => {
    it('should resolve a feedback entry', async () => {
      // Create first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/crm/feedback');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          type: 'complaint',
          category: 'maintenance',
          subject: `AC issue ${suffix}`,
          description: 'The air conditioning was not working.',
        },
      });
      const createRes = await createFeedback(createReq as any);
      const createData = await createRes.json();
      const feedbackId = createData.data.id;
      createdFeedbackIds.push(feedbackId);

      // Resolve it
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: feedbackId,
          status: 'resolved',
          resolution: 'AC unit has been repaired and tested.',
        },
      });
      const res = await updateFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('resolved');
      expect(data.data.resolution).toBe('AC unit has been repaired and tested.');
      expect(data.data.resolvedAt).toBeDefined();
    });

    it('should return 400 for missing id', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'resolved' },
      });
      const res = await updateFeedback(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent feedback', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          status: 'resolved',
        },
      });
      const res = await updateFeedback(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/crm/feedback', () => {
    it('should delete a feedback entry', async () => {
      // Create first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/crm/feedback');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          type: 'suggestion',
          category: 'food',
          subject: `To delete ${suffix}`,
          description: 'Feedback to be deleted.',
        },
      });
      const createRes = await createFeedback(createReq as any);
      const createData = await createRes.json();
      const feedbackId = createData.data.id;

      // Delete
      const url = buildUrl('/api/crm/feedback', { id: feedbackId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteFeedback(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/crm/feedback');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteFeedback(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── Cleanup ─────────────────────────────────────────────────────

  afterAll(async () => {
    // Clean up reviews
    for (const id of createdReviewIds) {
      try {
        await db.guestReview.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
    // Clean up feedback
    for (const id of createdFeedbackIds) {
      try {
        await db.guestFeedback.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
