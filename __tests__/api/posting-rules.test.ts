import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/posting-rules/route';
import { GET as getRule, PUT as putRule, DELETE as deleteRule } from '@/app/api/posting-rules/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, REVENUE_ACCOUNT_ID } from './test-helpers';
import { db } from '@/lib/db';

let ruleId: string;

describe('Posting Rules API', () => {
  describe('GET /api/posting-rules', () => {
    it('should return list of posting rules', async () => {
      const url = buildUrl('/api/posting-rules', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('POST /api/posting-rules', () => {
    it('should create a posting rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/posting-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Room Charge ${suffix}`,
          description: 'Auto-post daily room charges',
          chargeCategory: 'room',
          chargeType: 'daily_rate',
          revenueAccountId: REVENUE_ACCOUNT_ID,
          taxTreatment: 'taxable',
          autoPost: true,
          isActive: true,
          priority: 1,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Room Charge');
      expect(data.data.isActive).toBe(true);
      ruleId = data.data.id;
    });
  });

  describe('GET /api/posting-rules/[id]', () => {
    it('should get a single posting rule', async () => {
      const url = buildUrl(`/api/posting-rules/${ruleId}`);
      const req = await createAuthRequest(url);
      const res = await getRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(ruleId);
      expect(data.data.revenueAccount).toBeDefined();
    });
  });

  describe('PUT /api/posting-rules/[id]', () => {
    it('should update a posting rule', async () => {
      const url = buildUrl(`/api/posting-rules/${ruleId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { autoPost: false, priority: 5 },
      });
      const res = await putRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.autoPost).toBe(false);
      expect(data.data.priority).toBe(5);
    });
  });

  describe('PUT /api/posting-rules/[id] with status', () => {
    it('should update via status field', async () => {
      const url = buildUrl(`/api/posting-rules/${ruleId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'inactive' },
      });
      const res = await putRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/posting-rules/[id]', () => {
    it('should delete a posting rule', async () => {
      const url = buildUrl(`/api/posting-rules/${ruleId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup audit logs from deleted rule
    if (ruleId) {
      try {
        await db.auditLog.deleteMany({ where: { entityId: ruleId } });
      } catch { /* already cleaned */ }
    }
  });
});
