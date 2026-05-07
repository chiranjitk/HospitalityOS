import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/commissions/rules/route';
import { GET as getRule, PUT as putRule, DELETE as deleteRule } from '@/app/api/commissions/rules/[id]/route';
import { GET as getRecords, POST as postRecord } from '@/app/api/commissions/records/route';
import { GET as getRecord } from '@/app/api/commissions/records/[id]/route';
import { GET as getPayments, POST as postPayment } from '@/app/api/commissions/payments/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, BOOKING_ID, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let ruleId: string;
let recordId: string;

describe('Commissions API', () => {
  describe('GET /api/commissions/rules', () => {
    it('should return list of commission rules', async () => {
      const url = buildUrl('/api/commissions/rules', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('POST /api/commissions/rules', () => {
    it('should create a commission rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/commissions/rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `OTA Commission ${suffix}`,
          description: 'Test OTA commission rule',
          sourceType: 'ota',
          commissionType: 'percentage',
          rate: 15,
          isActive: true,
          validFrom: '2025-01-01',
          validUntil: '2025-12-31',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('OTA Commission');
      ruleId = data.data.id;
    });
  });

  describe('GET /api/commissions/rules/[id]', () => {
    it('should get a single commission rule', async () => {
      const url = buildUrl(`/api/commissions/rules/${ruleId}`);
      const req = await createAuthRequest(url);
      const res = await getRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(ruleId);
    });
  });

  describe('PUT /api/commissions/rules/[id]', () => {
    it('should update a commission rule', async () => {
      const url = buildUrl(`/api/commissions/rules/${ruleId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { rate: 20 },
      });
      const res = await putRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.rate).toBe(20);
    });
  });

  describe('POST /api/commissions/records', () => {
    it('should create a commission record', async () => {
      const url = buildUrl('/api/commissions/records');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          ruleId,
          bookingId: BOOKING_ID,
          sourceType: 'ota',
          sourceName: 'Booking.com',
          bookingAmount: 15000,
          commissionAmount: 3000,
        },
      });
      const res = await postRecord(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('accrued');
      recordId = data.data.id;
    });
  });

  describe('GET /api/commissions/records', () => {
    it('should return list of commission records', async () => {
      const url = buildUrl('/api/commissions/records', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getRecords(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/commissions/records/[id]', () => {
    it('should get a single commission record', async () => {
      const url = buildUrl(`/api/commissions/records/${recordId}`);
      const req = await createAuthRequest(url);
      const res = await getRecord(req as any, { params: Promise.resolve({ id: recordId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(recordId);
      expect(data.data.commissionAmount).toBe(3000);
    });
  });

  describe('DELETE /api/commissions/rules/[id]', () => {
    it('should not delete a rule with records', async () => {
      const url = buildUrl(`/api/commissions/rules/${ruleId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRule(req as any, { params: Promise.resolve({ id: ruleId }) } as any);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/commissions/payments', () => {
    it('should return list of commission payments', async () => {
      const url = buildUrl('/api/commissions/payments');
      const req = await createAuthRequest(url);
      const res = await getPayments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.aggregates).toBeDefined();
    });
  });

  describe('POST /api/commissions/payments', () => {
    it('should reject payment with non-invoiced records', async () => {
      const url = buildUrl('/api/commissions/payments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          commissionRecordIds: [recordId], // record is 'accrued', not 'invoiced'
          payeeName: 'Test OTA',
          payeeType: 'ota',
          paymentMethod: 'bank_transfer',
        },
      });
      const res = await postPayment(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  afterAll(async () => {
    if (recordId) await db.commissionRecord.delete({ where: { id: recordId } });
    if (ruleId) await db.commissionRule.delete({ where: { id: ruleId } });
  });
});
