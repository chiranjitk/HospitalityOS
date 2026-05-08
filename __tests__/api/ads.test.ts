import { describe, it, expect, afterAll } from 'vitest';
import { GET as getAdCampaigns, POST as createAdCampaign, PUT as updateAdCampaign, DELETE as deleteAdCampaign } from '@/app/api/ads/campaigns/route';
import { GET as getAdPerformance } from '@/app/api/ads/performance/route';
import {
  createAuthRequest,
  buildUrl,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdCampaignIds: string[] = [];

describe('Ads API', () => {
  // ─── Ad Campaigns ─────────────────────────────────────────────

  describe('GET /api/ads/campaigns', () => {
    it('should return ad campaigns with stats', async () => {
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url);
      const res = await getAdCampaigns(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.campaigns).toBeDefined();
      expect(Array.isArray(data.data.campaigns)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(typeof data.data.stats.active).toBe('number');
      expect(typeof data.data.stats.totalBudget).toBe('number');
      expect(typeof data.data.stats.totalSpent).toBe('number');
      expect(typeof data.data.stats.totalRevenue).toBe('number');
      expect(typeof data.data.stats.avgRoas).toBe('number');
    });

    it('should return overview when overview=true', async () => {
      const url = buildUrl('/api/ads/campaigns', { overview: 'true' });
      const req = await createAuthRequest(url);
      const res = await getAdCampaigns(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.overview).toBeDefined();
      expect(typeof data.data.overview.total).toBe('number');
      expect(typeof data.data.overview.totalBudget).toBe('number');
      expect(typeof data.data.overview.totalRevenue).toBe('number');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/ads/campaigns', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await getAdCampaigns(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.campaigns.forEach((c: any) => {
        expect(c.status).toBe('active');
      });
    });

    it('should filter by platform', async () => {
      const url = buildUrl('/api/ads/campaigns', { platform: 'google' });
      const req = await createAuthRequest(url);
      const res = await getAdCampaigns(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.campaigns.forEach((c: any) => {
        expect(c.platform).toBe('google');
      });
    });

    it('should search campaigns by name or description', async () => {
      const url = buildUrl('/api/ads/campaigns', { search: 'hotel' });
      const req = await createAuthRequest(url);
      const res = await getAdCampaigns(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.campaigns)).toBe(true);
    });
  });

  describe('POST /api/ads/campaigns', () => {
    it('should create a new ad campaign', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Google Ads ${suffix}`,
          type: 'search',
          platform: 'google',
          description: 'Search campaign for hotel',
          budget: 5000,
          budgetType: 'daily',
          bidStrategy: 'auto',
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Google Ads');
      expect(data.data.status).toBe('draft');
      expect(data.data.platform).toBe('google');
      expect(data.data.budget).toBe(5000);
      createdCampaignIds.push(data.data.id);
    });

    it('should create campaign with different platforms', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Meta Ads ${suffix}`,
          platform: 'meta',
          budget: 3000,
          bidAmount: 1.5,
          targetCpa: 50,
          targetRoas: 3.0,
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.platform).toBe('meta');
      expect(data.data.bidAmount).toBe(1.5);
      expect(data.data.targetCpa).toBe(50);
      expect(data.data.targetRoas).toBe(3.0);
      createdCampaignIds.push(data.data.id);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { platform: 'google' },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid platform', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Platform ${suffix}`,
          platform: 'snapchat',
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject negative budget', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Neg Budget ${suffix}`,
          budget: -100,
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject negative bid amount', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Neg Bid ${suffix}`,
          bidAmount: -5,
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject start date after end date', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Dates ${suffix}`,
          startDate: '2026-02-01',
          endDate: '2026-01-01',
        },
      });
      const res = await createAdCampaign(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/ads/campaigns', () => {
    it('should update campaign budget and status', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/ads/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `To Update ${suffix}`, budget: 1000 },
      });
      const createRes = await createAdCampaign(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;
      createdCampaignIds.push(campaignId);

      // Update
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: campaignId, budget: 2500, status: 'active' },
      });
      const res = await updateAdCampaign(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.budget).toBe(2500);
      expect(data.data.status).toBe('active');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { budget: 500 },
      });
      const res = await updateAdCampaign(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent campaign', async () => {
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', budget: 500 },
      });
      const res = await updateAdCampaign(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject invalid status', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/ads/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `Bad Status ${suffix}` },
      });
      const createRes = await createAdCampaign(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;
      createdCampaignIds.push(campaignId);

      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: campaignId, status: 'invalid_status' },
      });
      const res = await updateAdCampaign(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/ads/campaigns', () => {
    it('should delete a draft campaign', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/ads/campaigns');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `To Delete ${suffix}` },
      });
      const createRes = await createAdCampaign(createReq as any);
      const createData = await createRes.json();
      const campaignId = createData.data.id;

      const url = buildUrl('/api/ads/campaigns', { id: campaignId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteAdCampaign(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/ads/campaigns');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteAdCampaign(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent campaign', async () => {
      const url = buildUrl('/api/ads/campaigns', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteAdCampaign(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── Ad Performance ────────────────────────────────────────────

  describe('GET /api/ads/performance', () => {
    it('should return performance data with summary', async () => {
      const url = buildUrl('/api/ads/performance');
      const req = await createAuthRequest(url);
      const res = await getAdPerformance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.performance).toBeDefined();
      expect(Array.isArray(data.data.performance)).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(typeof data.data.summary.totalImpressions).toBe('number');
      expect(typeof data.data.summary.totalClicks).toBe('number');
      expect(typeof data.data.summary.totalConversions).toBe('number');
      expect(typeof data.data.summary.totalCost).toBe('number');
      expect(typeof data.data.summary.totalRevenue).toBe('number');
      expect(typeof data.data.summary.avgCtr).toBe('number');
      expect(typeof data.data.summary.avgCpc).toBe('number');
      expect(typeof data.data.summary.avgCpa).toBe('number');
      expect(typeof data.data.summary.avgRoas).toBe('number');
    });

    it('should respect custom days parameter', async () => {
      const url = buildUrl('/api/ads/performance', { days: '7' });
      const req = await createAuthRequest(url);
      const res = await getAdPerformance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.performance.length).toBe(8); // 7 days + today
    });

    it('should cap days at 365', async () => {
      const url = buildUrl('/api/ads/performance', { days: '500' });
      const req = await createAuthRequest(url);
      const res = await getAdPerformance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.performance.length).toBeLessThanOrEqual(366);
    });

    it('should return ROI data when roi=true', async () => {
      const url = buildUrl('/api/ads/performance', { roi: 'true' });
      const req = await createAuthRequest(url);
      const res = await getAdPerformance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.roi).toBeDefined();
      expect(Array.isArray(data.data.roi)).toBe(true);
      expect(data.data.roiSummary).toBeDefined();
      expect(typeof data.data.roiSummary.totalSpend).toBe('number');
      expect(typeof data.data.roiSummary.totalRevenue).toBe('number');
      expect(typeof data.data.roiSummary.totalProfit).toBe('number');
      expect(data.data.channels).toBeDefined();
      expect(Array.isArray(data.data.channels)).toBe(true);
      expect(data.data.insights).toBeDefined();
      expect(Array.isArray(data.data.insights)).toBe(true);
    });

    it('should filter performance by campaign ID', async () => {
      const url = buildUrl('/api/ads/performance', { campaign: 'google', days: '7' });
      const req = await createAuthRequest(url);
      const res = await getAdPerformance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdCampaignIds) {
      try {
        await db.adPerformance.deleteMany({ where: { campaignId: id } });
        await db.adCampaign.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
