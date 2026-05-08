import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/revenue/pricing-rules/route';
import { GET as getDemandForecast } from '@/app/api/revenue/demand-forecast/route';
import { GET as getAISuggestions, POST as createAISuggestion } from '@/app/api/revenue/ai-suggestions/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdRuleIds: string[] = [];
const createdSuggestionIds: string[] = [];

describe('Revenue API', () => {
  // ─── Pricing Rules ───────────────────────────────────────────────

  describe('GET /api/revenue/pricing-rules', () => {
    it('should return list of pricing rules with stats', async () => {
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalRules).toBe('number');
      expect(typeof data.stats.activeRules).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/revenue/pricing-rules', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('POST /api/revenue/pricing-rules', () => {
    it('should create a new pricing rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Weekend Surge ${suffix}`,
          type: 'weekend',
          value: 15,
          valueType: 'percentage',
          priority: 10,
          isActive: true,
          conditions: { daysOfWeek: [0, 6] },
          roomTypes: [],
          description: 'Weekend rate increase test rule',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Weekend Surge');
      expect(data.data.type).toBe('weekend');
      expect(data.data.value).toBe(15);
      expect(data.data.isActive).toBe(true);
      expect(data.data.conditions).toEqual({ daysOfWeek: [0, 6] });
      createdRuleIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { type: 'markdown' }, // missing name and value
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject creation with invalid rule type', async () => {
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Rule',
          type: 'invalid_type',
          value: 10,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Invalid rule type');
    });

    it('should create a seasonal pricing rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `High Season ${suffix}`,
          type: 'seasonal',
          value: 25,
          valueType: 'percentage',
          priority: 8,
          isActive: true,
          effectiveFrom: '2025-12-01',
          effectiveTo: '2026-01-15',
          description: 'Holiday season pricing',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('seasonal');
      expect(data.data.value).toBe(25);
      createdRuleIds.push(data.data.id);
    });
  });

  describe('PUT /api/revenue/pricing-rules', () => {
    it('should update an existing pricing rule', async () => {
      // First create a rule
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/revenue/pricing-rules');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Rule to Update ${suffix}`,
          type: 'discount_percentage',
          value: 10,
          isActive: true,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const ruleId = createData.data.id;
      createdRuleIds.push(ruleId);

      // Now update it
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: ruleId, value: 20, description: 'Updated discount' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.value).toBe(20);
      expect(data.data.description).toBe('Updated discount');
    });

    it('should return 404 for non-existent rule', async () => {
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', value: 50 },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/revenue/pricing-rules', () => {
    it('should delete a pricing rule', async () => {
      // Create a rule first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/revenue/pricing-rules');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Rule to Delete ${suffix}`,
          type: 'markdown',
          value: 5,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const ruleId = createData.data.id;

      // Delete it
      const url = buildUrl('/api/revenue/pricing-rules', { id: ruleId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/revenue/pricing-rules');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── Demand Forecast ─────────────────────────────────────────────

  describe('GET /api/revenue/demand-forecast', () => {
    it('should return demand forecast with default horizon', async () => {
      const url = buildUrl('/api/revenue/demand-forecast');
      const req = await createAuthRequest(url);
      const res = await getDemandForecast(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.forecast).toBeDefined();
      expect(Array.isArray(data.data.forecast)).toBe(true);
      expect(data.data.forecast.length).toBeGreaterThanOrEqual(1);
      expect(data.data.insights).toBeDefined();
      expect(Array.isArray(data.data.insights)).toBe(true);
      expect(data.data.metrics).toBeDefined();
      expect(typeof data.data.metrics.accuracy).toBe('number');
      expect(typeof data.data.metrics.avgPredictedOccupancy).toBe('number');
    });

    it('should respect custom horizon parameter', async () => {
      const url = buildUrl('/api/revenue/demand-forecast', { horizon: '14' });
      const req = await createAuthRequest(url);
      const res = await getDemandForecast(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.forecast).toBeDefined();
      expect(data.data.forecast.length).toBe(15); // 14 days + 1 (today)
    });

    it('should cap horizon at 90 days', async () => {
      const url = buildUrl('/api/revenue/demand-forecast', { horizon: '200' });
      const req = await createAuthRequest(url);
      const res = await getDemandForecast(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.forecast.length).toBeLessThanOrEqual(91); // 90 + today
    });
  });

  // ─── AI Suggestions ──────────────────────────────────────────────

  describe('GET /api/revenue/ai-suggestions', () => {
    it('should return AI revenue suggestions with summary', async () => {
      const url = buildUrl('/api/revenue/ai-suggestions');
      const req = await createAuthRequest(url);
      const res = await getAISuggestions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.total).toBe('number');
      expect(typeof data.summary.pending).toBe('number');
      expect(typeof data.summary.totalPotentialRevenue).toBe('number');
    });
  });

  describe('POST /api/revenue/ai-suggestions', () => {
    it('should create a new AI suggestion', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue/ai-suggestions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'pricing',
          title: `Test Suggestion ${suffix}`,
          description: 'Increase weekday rates by 5% based on booking patterns',
          impact: 'medium',
          potentialRevenue: 15000,
          confidence: 82,
        },
      });
      const res = await createAISuggestion(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.type).toBe('pricing');
      expect(data.data.status).toBe('pending');
      expect(data.data.confidence).toBe(82);
      createdSuggestionIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/revenue/ai-suggestions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { type: 'pricing' }, // missing title and description
      });
      const res = await createAISuggestion(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create suggestion with defaults', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue/ai-suggestions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'marketing',
          title: `Default Impact ${suffix}`,
          description: 'Some marketing suggestion',
        },
      });
      const res = await createAISuggestion(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.impact).toBe('medium');
      expect(data.data.confidence).toBe(80);
      expect(data.data.potentialRevenue).toBe(0);
      createdSuggestionIds.push(data.data.id);
    });
  });

  // ─── Cleanup ─────────────────────────────────────────────────────

  afterAll(async () => {
    // Clean up pricing rules
    for (const id of createdRuleIds) {
      try {
        await db.pricingRule.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
    // Clean up AI suggestions
    for (const id of createdSuggestionIds) {
      try {
        await db.aISuggestion.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
