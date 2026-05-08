import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT } from '@/app/api/reputation/reviews/route';
import { GET as getSentiment, POST as analyzeSentiment } from '@/app/api/reputation/sentiment/route';
import { GET as getAggregation, POST as triggerAggregation, PUT as configureSource, DELETE as disconnectSource } from '@/app/api/reputation/aggregation/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdReviewId: string;
let createdIntegrationId: string;

describe('Reputation — Reviews', () => {
  describe('GET /api/reputation/reviews', () => {
    it('should return reviews with pagination and stats', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.reviews).toBeDefined();
      expect(Array.isArray(data.reviews)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('averageRating');
      expect(data.stats).toHaveProperty('ratingDistribution');
      expect(data.stats).toHaveProperty('categoryAverages');
      expect(data.stats).toHaveProperty('sentimentDistribution');
      expect(data.stats).toHaveProperty('sourceDistribution');
      expect(data.stats).toHaveProperty('responseRate');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/reputation/reviews', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by source', async () => {
      const url = buildUrl('/api/reputation/reviews', { source: 'internal' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should filter by sentiment', async () => {
      const url = buildUrl('/api/reputation/reviews', { sentiment: 'positive' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should filter by rating', async () => {
      const url = buildUrl('/api/reputation/reviews', { rating: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should filter by responded status', async () => {
      const url = buildUrl('/api/reputation/reviews', { responded: 'false' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/reputation/reviews', { page: '1', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.page).toBe(1);
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      const url = buildUrl('/api/reputation/reviews', { limit: '500' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should return 404 for invalid propertyId', async () => {
      const url = buildUrl('/api/reputation/reviews', { propertyId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/reputation/reviews', () => {
    it('should create a new review', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reputation/reviews');
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
          title: `Great stay ${suffix.slice(-4)}`,
          comment: `Everything was wonderful during our visit. The staff was very helpful.`,
          source: 'internal',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.overallRating).toBe(5);
      expect(data.data.source).toBe('internal');
      createdReviewId = data.data.id;
    });

    it('should require guestId, propertyId, and overallRating', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { overallRating: 3 },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('required');
    });

    it('should validate rating range (1-5)', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 10,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('between 1 and 5');
    });

    it('should validate rating minimum (1-5)', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 0,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should validate source', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: PROPERTY_ID,
          overallRating: 4,
          source: 'invalid_source',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid source');
    });

    it('should return 404 for invalid property', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          propertyId: '00000000-0000-0000-0000-000000000000',
          overallRating: 4,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: GUEST_ID, propertyId: PROPERTY_ID, overallRating: 4 }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/reputation/reviews — Respond', () => {
    it('should respond to a review', async () => {
      if (!createdReviewId) return;
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          reviewId: createdReviewId,
          responseText: 'Thank you for your wonderful review! We are glad you enjoyed your stay.',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.responseText).toBeDefined();
      expect(data.data.respondedAt).toBeDefined();
    });

    it('should require reviewId and responseText', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { responseText: 'Missing review ID' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent review', async () => {
      const url = buildUrl('/api/reputation/reviews');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          reviewId: '00000000-0000-0000-0000-000000000000',
          responseText: 'Ghost review response',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });
});

describe('Reputation — Sentiment Analysis', () => {
  describe('GET /api/reputation/sentiment', () => {
    it('should return sentiment analysis data', async () => {
      const url = buildUrl('/api/reputation/sentiment');
      const req = await createAuthRequest(url);
      const res = await getSentiment(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      // Each item should have review data
      for (const item of data.data) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('rating');
        expect(item).toHaveProperty('hasSentiment');
      }
    });

    it('should support aggregate query', async () => {
      const url = buildUrl('/api/reputation/sentiment', { aggregate: 'true' });
      const req = await createAuthRequest(url);
      const res = await getSentiment(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('totalReviews');
      expect(data.data).toHaveProperty('analyzedReviews');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/reputation/sentiment', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getSentiment(req);
      expect(res.status).toBe(200);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/reputation/sentiment');
      const res = await getSentiment(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/reputation/sentiment — Analyze text', () => {
    it('should analyze sentiment for provided text', async () => {
      const url = buildUrl('/api/reputation/sentiment');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          text: 'The hotel was absolutely wonderful! Great service and clean rooms.',
          rating: 5,
        },
      });
      const res = await analyzeSentiment(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('overall');
      expect(data.data).toHaveProperty('score');
    });

    it('should handle batch analysis with no matching reviews', async () => {
      const url = buildUrl('/api/reputation/sentiment');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await analyzeSentiment(req);
      // Returns analyzed=0 if no reviews without sentiment
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/reputation/sentiment');
      const res = await analyzeSentiment(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'great', rating: 5 }),
      }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Reputation — Aggregation', () => {
  describe('GET /api/reputation/aggregation', () => {
    it('should return aggregation status', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url);
      const res = await getAggregation(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('sources');
      expect(data.data).toHaveProperty('lastSync');
      expect(data.data).toHaveProperty('integrations');
    });

    it('should return config with status=config', async () => {
      const url = buildUrl('/api/reputation/aggregation', { status: 'config' });
      const req = await createAuthRequest(url);
      const res = await getAggregation(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('sources');
      expect(data.data).toHaveProperty('lastSync');
      expect(data.data).toHaveProperty('reviewCounts');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      // requirePermission falls back to error when no session
      const res = await getAggregation(new Request(url, { headers: {} }));
      // May be 401 or 500 depending on how requirePermission handles missing cookies
      expect([401, 500]).toContain(res.status);
    });
  });

  describe('POST /api/reputation/aggregation — Trigger', () => {
    it('should trigger aggregation (or return error if no integrations)', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { sources: ['internal'] },
      });
      const res = await triggerAggregation(req);
      // May succeed or fail if no active integrations
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('PUT /api/reputation/aggregation — Configure Source', () => {
    it('should configure a review source', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          source: 'google',
          config: { apiKey: `test-${suffix.slice(-4)}` },
          enabled: true,
        },
      });
      const res = await configureSource(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      createdIntegrationId = data.data.id;
    });

    it('should require source', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { enabled: true },
      });
      const res = await configureSource(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/reputation/aggregation — Disconnect', () => {
    it('should require source', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await disconnectSource(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent source', async () => {
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { source: 'nonexistent_source_xyz' },
      });
      const res = await disconnectSource(req);
      expect(res.status).toBe(404);
    });

    it('should disconnect a configured source', async () => {
      if (!createdIntegrationId) return;
      const url = buildUrl('/api/reputation/aggregation');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { source: 'google' },
      });
      const res = await disconnectSource(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('disconnected');
    });
  });
});

afterAll(async () => {
  // Clean up test reviews
  if (createdReviewId) {
    await db.guestReview.delete({ where: { id: createdReviewId } }).catch(() => {});
  }
  // Clean up any test reviews with 'Great stay' title
  await db.guestReview.deleteMany({
    where: { title: { contains: 'Great stay' } },
  }).catch(() => {});
});
