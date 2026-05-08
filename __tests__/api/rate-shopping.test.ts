import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/revenue/rate-shopping/route';
import { GET as getResults } from '@/app/api/revenue/rate-shopping/results/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let competitorId: string;

describe('Rate Shopping API', () => {
  describe('GET /api/revenue/rate-shopping', () => {
    it('should return list of competitors and stats', async () => {
      const url = buildUrl('/api/revenue/rate-shopping', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.competitors).toBeDefined();
      expect(Array.isArray(data.data.competitors)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.active).toBe('number');
    });
  });

  describe('POST /api/revenue/rate-shopping', () => {
    it('should create a competitor', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue/rate-shopping');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Competitor ${suffix}`,
          channel: 'booking.com',
          propertyId: PROPERTY_ID,
          url: 'https://booking.com/test',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Competitor');
      expect(data.data.channel).toBe('booking.com');
      expect(data.data.isActive).toBe(true);
      competitorId = data.data.id;
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/revenue/rate-shopping');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { channel: 'direct' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/revenue/rate-shopping', () => {
    it('should update a competitor', async () => {
      const url = buildUrl('/api/revenue/rate-shopping');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: competitorId,
          name: 'Updated Competitor',
          channel: 'expedia',
          isActive: false,
        },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Competitor');
      expect(data.data.channel).toBe('expedia');
      expect(data.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent competitor', async () => {
      const url = buildUrl('/api/revenue/rate-shopping');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/revenue/rate-shopping', () => {
    it('should delete a competitor', async () => {
      // Create a throwaway competitor first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/revenue/rate-shopping');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Delete Me ${suffix}`,
          channel: 'direct',
          propertyId: PROPERTY_ID,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const deleteId = createData.data.id;

      // Now delete it
      const url = buildUrl('/api/revenue/rate-shopping', { id: deleteId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('deleted');
    });

    it('should return 404 when deleting non-existent competitor', async () => {
      const url = buildUrl('/api/revenue/rate-shopping', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/revenue/rate-shopping/results', () => {
    it('should return rate shopping results and stats', async () => {
      const url = buildUrl('/api/revenue/rate-shopping/results');
      const req = await createAuthRequest(url);
      const res = await getResults(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.results).toBeDefined();
      expect(Array.isArray(data.data.results)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.parity).toBe('number');
      expect(typeof data.data.stats.below).toBe('number');
      expect(typeof data.data.stats.above).toBe('number');
      expect(typeof data.data.stats.avgRateDifference).toBe('number');
    });

    it('should filter results by competitorId', async () => {
      const url = buildUrl('/api/revenue/rate-shopping/results', { competitorId });
      const req = await createAuthRequest(url);
      const res = await getResults(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.results)).toBe(true);
    });
  });

  afterAll(async () => {
    if (competitorId) {
      try {
        await db.rateShoppingResult.deleteMany({ where: { competitorId } });
        await db.rateShoppingCompetitor.delete({ where: { id: competitorId } });
      } catch { /* ok */ }
    }
  });
});
