import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/campaigns/route';
import {
  createAuthRequest,
  buildUrl,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdCampaignIds: string[] = [];

describe('Campaigns API', () => {
  // ─── GET /api/campaigns ────────────────────────────────────────

  describe('GET /api/campaigns', () => {
    it('should return list of campaigns with stats', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.campaigns).toBeDefined();
      expect(Array.isArray(data.data.campaigns)).toBe(true);
      expect(data.data.total).toBeDefined();
      expect(typeof data.data.total).toBe('number');
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.draft).toBe('number');
      expect(typeof data.data.stats.scheduled).toBe('number');
      expect(typeof data.data.stats.sent).toBe('number');
      expect(typeof data.data.stats.avgOpenRate).toBe('number');
      expect(typeof data.data.stats.avgClickRate).toBe('number');
    });

    it('should filter campaigns by status', async () => {
      const url = buildUrl('/api/campaigns', { status: 'draft' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.campaigns.forEach((c: any) => {
        expect(c.status).toBe('draft');
      });
    });

    it('should filter campaigns by type', async () => {
      const url = buildUrl('/api/campaigns', { type: 'email' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.campaigns.forEach((c: any) => {
        expect(c.type).toBe('email');
      });
    });

    it('should search campaigns by name', async () => {
      const url = buildUrl('/api/campaigns', { search: 'test' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.campaigns)).toBe(true);
    });

    it('should respect pagination', async () => {
      const url = buildUrl('/api/campaigns', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.campaigns.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── POST /api/campaigns ───────────────────────────────────────

  describe('POST /api/campaigns', () => {
    it('should create an email campaign as draft', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Email Campaign ${suffix}`,
          type: 'email',
          subject: `Test Subject ${suffix}`,
          content: '<h1>Hello!</h1><p>Test email content.</p>',
          description: 'A test email campaign',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Email Campaign');
      expect(data.data.type).toBe('email');
      expect(data.data.status).toBe('draft');
      expect(data.data.subject).toContain('Test Subject');
      createdCampaignIds.push(data.data.id);
    });

    it('should create an SMS campaign', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `SMS Campaign ${suffix}`,
          type: 'sms',
          content: 'Hello! This is a test SMS message.',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('sms');
      expect(data.data.status).toBe('draft');
      createdCampaignIds.push(data.data.id);
    });

    it('should create a both (email+sms) campaign', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Both Campaign ${suffix}`,
          type: 'both',
          subject: `Both ${suffix}`,
          content: 'Multi-channel content',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('both');
      createdCampaignIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Incomplete' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject invalid campaign type', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Type',
          type: 'fax',
          content: 'content',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid campaign type');
    });

    it('should reject email campaign without subject', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'No Subject',
          type: 'email',
          content: 'content',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Subject is required');
    });

    it('should set status to scheduled when scheduledAt is future', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Scheduled ${suffix}`,
          type: 'sms',
          content: 'Future SMS',
          scheduledAt: futureDate,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('scheduled');
      createdCampaignIds.push(data.data.id);
    });

    it('should reject past scheduledAt date', async () => {
      const url = buildUrl('/api/campaigns');
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Past Scheduled',
          type: 'sms',
          content: 'Past SMS',
          scheduledAt: pastDate,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/campaigns ────────────────────────────────────────

  describe('PUT /api/campaigns', () => {
    it('should update a draft campaign name', async () => {
      // Create first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Update Me ${suffix}`,
          type: 'sms',
          content: 'Initial content',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;
      createdCampaignIds.push(campaignId);

      // Update
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: campaignId, name: `Updated ${suffix}`, content: 'New content' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toContain('Updated');
    });

    it('should cancel a draft campaign', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `To Cancel ${suffix}`,
          type: 'sms',
          content: 'content',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;
      createdCampaignIds.push(campaignId);

      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: campaignId, status: 'cancelled' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('cancelled');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No id' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent campaign', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/campaigns ─────────────────────────────────────

  describe('DELETE /api/campaigns', () => {
    it('should delete a draft campaign', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `To Delete ${suffix}`,
          type: 'sms',
          content: 'delete me',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;

      // Delete
      const url = buildUrl('/api/campaigns', { id: campaignId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/campaigns');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent campaign', async () => {
      const url = buildUrl('/api/campaigns', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdCampaignIds) {
      try {
        await db.campaignSegment.deleteMany({ where: { campaignId: id } });
        await db.campaign.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
