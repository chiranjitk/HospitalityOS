import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/marketing/journeys/route';
import { GET as getJourney, PUT as putJourney, DELETE as deleteJourney } from '@/app/api/marketing/journeys/[id]/route';
import { POST as executeJourney } from '@/app/api/marketing/journeys/[id]/execute/route';
import { createAuthRequest, buildUrl, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let journeyId: string;

describe('Journey Campaigns API', () => {
  describe('GET /api/marketing/journeys', () => {
    it('should return list of journey campaigns with stats', async () => {
      const url = buildUrl('/api/marketing/journeys');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.journeys).toBeDefined();
      expect(Array.isArray(data.data.journeys)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.active).toBe('number');
      expect(typeof data.data.stats.draft).toBe('number');
    });

    it('should filter journeys by status', async () => {
      const url = buildUrl('/api/marketing/journeys', { status: 'draft' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.journeys)).toBe(true);
      // All returned journeys should be drafts
      for (const j of data.data.journeys) {
        expect(j.status).toBe('draft');
      }
    });
  });

  describe('POST /api/marketing/journeys', () => {
    it('should create a journey campaign', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/marketing/journeys');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Journey ${suffix}`,
          description: 'Test journey campaign for API tests',
          journeyType: 'pre_arrival',
          triggerEvent: 'booking_confirmed',
          targetSegments: ['all_guests'],
          actions: [
            {
              actionType: 'email',
              subject: 'Welcome to our hotel',
              content: 'Dear guest, we look forward to your stay!',
              sortOrder: 0,
            },
            {
              actionType: 'sms',
              subject: null,
              content: 'Your booking is confirmed!',
              sortOrder: 1,
            },
          ],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Journey');
      expect(data.data.journeyType).toBe('pre_arrival');
      expect(data.data.triggerEvent).toBe('booking_confirmed');
      expect(data.data.status).toBe('draft');
      expect(data.data.actions).toBeDefined();
      expect(data.data.actions.length).toBe(2);
      expect(data.data.actions[0].actionType).toBe('email');
      expect(data.data.actions[1].actionType).toBe('sms');
      journeyId = data.data.id;
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/marketing/journeys');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Fields' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should create a journey without actions', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/marketing/journeys');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `No Actions Journey ${suffix}`,
          journeyType: 'post_stay',
          triggerEvent: 'checkout_completed',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.actions).toBeDefined();
      // Clean up this journey too
      await db.journeyCampaign.delete({ where: { id: data.data.id } });
    });
  });

  describe('GET /api/marketing/journeys/[id]', () => {
    it('should get a single journey with metrics', async () => {
      const url = buildUrl(`/api/marketing/journeys/${journeyId}`);
      const req = await createAuthRequest(url);
      const res = await getJourney(req as any, { params: Promise.resolve({ id: journeyId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(journeyId);
      expect(data.data.name).toContain('Test Journey');
      expect(data.data.actions).toBeDefined();
      expect(data.data.metrics).toBeDefined();
      expect(typeof data.data.metrics.totalSent).toBe('number');
      expect(typeof data.data.metrics.openRate).toBe('number');
    });

    it('should return 404 for non-existent journey', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/marketing/journeys/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getJourney(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/marketing/journeys/[id]', () => {
    it('should update a journey campaign', async () => {
      const url = buildUrl(`/api/marketing/journeys/${journeyId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          name: 'Updated Journey Name',
          status: 'active',
          description: 'Updated description',
        },
      });
      const res = await putJourney(req as any, { params: Promise.resolve({ id: journeyId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Journey Name');
      expect(data.data.status).toBe('active');
      expect(data.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent journey update', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/marketing/journeys/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Ghost' },
      });
      const res = await putJourney(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/marketing/journeys/[id]/execute', () => {
    it('should trigger journey execution', async () => {
      const url = buildUrl(`/api/marketing/journeys/${journeyId}/execute`);
      const req = await createAuthRequest(url, { method: 'POST' });
      const res = await executeJourney(req as any, { params: Promise.resolve({ id: journeyId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('execution triggered');
      expect(data.data.journeyId).toBe(journeyId);
    });

    it('should return 404 for non-existent journey execution', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/marketing/journeys/${fakeId}/execute`);
      const req = await createAuthRequest(url, { method: 'POST' });
      const res = await executeJourney(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/marketing/journeys/[id]', () => {
    it('should delete a journey campaign', async () => {
      // Create a throwaway journey to delete
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/marketing/journeys');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Delete Me ${suffix}`,
          journeyType: 'onboarding',
          triggerEvent: 'guest_registered',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const deleteId = createData.data.id;

      // Delete it
      const url = buildUrl(`/api/marketing/journeys/${deleteId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteJourney(req as any, { params: Promise.resolve({ id: deleteId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('deleted');
    });

    it('should return 404 for non-existent journey deletion', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/marketing/journeys/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteJourney(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (journeyId) {
      try {
        await db.journeyAction.deleteMany({ where: { journeyId } });
        await db.journeyCampaign.delete({ where: { id: journeyId } });
      } catch { /* ok */ }
    }
  });
});
