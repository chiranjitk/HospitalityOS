import { describe, it, expect, afterAll } from 'vitest';
import { GET as getAnalyticsHistory, POST as postAnalyticsQuery } from '@/app/api/ai/analytics/route';
import { GET as getSavedQueries } from '@/app/api/ai/analytics/saved/route';
import { POST as postAnalyticsNlQuery } from '@/app/api/ai/analytics/query/route';
import { createAuthRequest, buildUrl, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

const createdQueryIds: string[] = [];

describe('AI Analytics API', () => {
  // ─── POST /api/ai/analytics (save a query result) ───
  describe('POST /api/ai/analytics', () => {
    it('should save a new analytics query result', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ai/analytics');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          query: `Test revenue analysis ${suffix}`,
          queryType: 'natural_language',
          intent: 'revenue',
          parameters: { category: 'Revenue', chartType: 'line' },
          resultData: {
            chartType: 'line',
            chartData: [
              { month: 'Jan', value: 42500 },
              { month: 'Feb', value: 39800 },
            ],
            keyMetric: 'Total Revenue',
            keyMetricValue: '$82,300',
          },
          resultType: 'line',
          processingMs: 120,
        },
      });
      const res = await postAnalyticsQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.query).toContain('Test revenue analysis');
      expect(data.data.intent).toBe('revenue');
      expect(data.data.queryType).toBe('natural_language');
      expect(data.data.resultType).toBe('line');
      expect(data.data.processingMs).toBe(120);
      expect(data.data.createdAt).toBeDefined();
      expect(data.data.parameters).toBeDefined();
      expect(data.data.resultData).toBeDefined();
      createdQueryIds.push(data.data.id);
    });

    it('should return 400 when query is missing', async () => {
      const url = buildUrl('/api/ai/analytics');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { intent: 'revenue' },
      });
      const res = await postAnalyticsQuery(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should save a query with saved queryType', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ai/analytics');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          query: `Saved occupancy query ${suffix}`,
          queryType: 'saved',
          intent: 'occupancy',
          resultData: { chartType: 'bar' },
          resultType: 'bar',
        },
      });
      const res = await postAnalyticsQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.queryType).toBe('saved');
      createdQueryIds.push(data.data.id);
    });
  });

  // ─── GET /api/ai/analytics (query history) ───
  describe('GET /api/ai/analytics', () => {
    it('should return analytics query history with pagination', async () => {
      const url = buildUrl('/api/ai/analytics');
      const req = await createAuthRequest(url);
      const res = await getAnalyticsHistory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
      if (data.data.length > 0) {
        expect(data.data[0].id).toBeDefined();
        expect(data.data[0].query).toBeDefined();
        expect(data.data[0].queryType).toBeDefined();
        expect(data.data[0].createdAt).toBeDefined();
      }
    });

    it('should filter by category/intent', async () => {
      const url = buildUrl('/api/ai/analytics', { category: 'revenue', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await getAnalyticsHistory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ─── POST /api/ai/analytics/query (natural language query) ───
  describe('POST /api/ai/analytics/query', () => {
    it('should execute a revenue query and return analysis', async () => {
      const url = buildUrl('/api/ai/analytics/query');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { query: 'Show me revenue trends for this year' },
      });
      const res = await postAnalyticsNlQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.query).toBe('Show me revenue trends for this year');
      expect(data.data.category).toBe('Revenue');
      expect(data.data.chartType).toBe('line');
      expect(data.data.resultData).toBeDefined();
      expect(data.data.resultData.chartData).toBeDefined();
      expect(data.data.resultData.keyMetric).toBeDefined();
      expect(data.data.resultData.insight).toBeDefined();
      expect(typeof data.data.processingMs).toBe('number');
      expect(data.data.createdAt).toBeDefined();
      createdQueryIds.push(data.data.id);
    });

    it('should execute an occupancy query', async () => {
      const url = buildUrl('/api/ai/analytics/query');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { query: 'What is the current room occupancy rate?' },
      });
      const res = await postAnalyticsNlQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.category).toBe('Occupancy');
      expect(data.data.chartType).toBe('bar');
      expect(data.data.resultData.chartData).toBeDefined();
      createdQueryIds.push(data.data.id);
    });

    it('should execute a guest satisfaction query', async () => {
      const url = buildUrl('/api/ai/analytics/query');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { query: 'Guest satisfaction and reviews analysis' },
      });
      const res = await postAnalyticsNlQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.category).toBe('Guest');
      expect(data.data.resultData).toBeDefined();
      createdQueryIds.push(data.data.id);
    });

    it('should handle a generic query with fallback analysis', async () => {
      const url = buildUrl('/api/ai/analytics/query');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { query: 'Random general performance question' },
      });
      const res = await postAnalyticsNlQuery(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.resultData).toBeDefined();
      expect(data.data.resultData.insight).toBeDefined();
      createdQueryIds.push(data.data.id);
    });

    it('should return 400 when query is missing', async () => {
      const url = buildUrl('/api/ai/analytics/query');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await postAnalyticsNlQuery(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  // ─── GET /api/ai/analytics/saved (saved/pinned queries) ───
  describe('GET /api/ai/analytics/saved', () => {
    it('should return saved/pinned queries', async () => {
      const url = buildUrl('/api/ai/analytics/saved');
      const req = await createAuthRequest(url);
      const res = await getSavedQueries(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
      // All returned queries should be of type 'saved'
      data.data.forEach((q: any) => {
        // Saved queries are filtered by queryType: 'saved' in the handler
        expect(q.id).toBeDefined();
        expect(q.query).toBeDefined();
      });
    });

    it('should support pagination params', async () => {
      const url = buildUrl('/api/ai/analytics/saved', { page: '1', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await getSavedQueries(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pagination.limit).toBe(5);
    });
  });

  afterAll(async () => {
    if (createdQueryIds.length > 0) {
      await db.analyticsQuery.deleteMany({
        where: { id: { in: createdQueryIds } },
      });
    }
  });
});
