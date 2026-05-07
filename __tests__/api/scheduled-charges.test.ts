import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/scheduled-charges/route';
import { GET as getCharge, PATCH as patchCharge } from '@/app/api/scheduled-charges/[id]/route';
import { POST as executeCharge } from '@/app/api/scheduled-charges/[id]/execute/route';
import { POST as pauseCharge } from '@/app/api/scheduled-charges/[id]/pause/route';
import { POST as resumeCharge } from '@/app/api/scheduled-charges/[id]/resume/route';
import { GET as getHistory } from '@/app/api/scheduled-charges/[id]/history/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let chargeId: string;
let fixture: Awaited<ReturnType<typeof createTestFixture>>;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Scheduled Charges API', () => {
  describe('GET /api/scheduled-charges', () => {
    it('should return list of scheduled charges', async () => {
      const url = buildUrl('/api/scheduled-charges', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('POST /api/scheduled-charges', () => {
    it('should create a scheduled charge', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/scheduled-charges');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          bookingId: fixture.booking.id,
          propertyId: fixture.booking.propertyId,
          chargeType: 'resort_fee',
          description: `Resort Fee ${suffix}`,
          category: 'resort',
          amount: 500,
          currency: 'INR',
          frequency: 'daily',
          startDate: new Date().toISOString(),
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.isActive).toBe(true);
      expect(data.data.amount).toBe(500);
      chargeId = data.data.id;
    });
  });

  describe('GET /api/scheduled-charges/[id]', () => {
    it('should get a single scheduled charge', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}`);
      const req = await createAuthRequest(url);
      const res = await getCharge(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(chargeId);
      expect(data.data.folio).toBeDefined();
      expect(data.data.booking).toBeDefined();
    });
  });

  describe('POST /api/scheduled-charges/[id]/pause', () => {
    it('should pause a scheduled charge', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}/pause`);
      const req = await createAuthRequest(url, { method: 'POST', body: {} });
      const res = await pauseCharge(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(false);
    });
  });

  describe('POST /api/scheduled-charges/[id]/resume', () => {
    it('should resume a paused scheduled charge', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}/resume`);
      const req = await createAuthRequest(url, { method: 'POST', body: {} });
      const res = await resumeCharge(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(true);
    });
  });

  describe('POST /api/scheduled-charges/[id]/execute', () => {
    it('should execute a scheduled charge', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}/execute`);
      const req = await createAuthRequest(url, { method: 'POST', body: {} });
      const res = await executeCharge(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.amount).toBe(500);
      expect(data.data.totalExecutions).toBe(1);
    });
  });

  describe('GET /api/scheduled-charges/[id]/history', () => {
    it('should return execution history', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}/history`);
      const req = await createAuthRequest(url);
      const res = await getHistory(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/scheduled-charges/[id]', () => {
    it('should update amount', async () => {
      const url = buildUrl(`/api/scheduled-charges/${chargeId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { amount: 750 },
      });
      const res = await patchCharge(req as any, { params: Promise.resolve({ id: chargeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.amount).toBe(750);
    });
  });

  afterAll(async () => {
    if (chargeId) {
      await db.scheduledChargeExecution.deleteMany({ where: { scheduledChargeId: chargeId } });
      await db.scheduledCharge.delete({ where: { id: chargeId } });
    }
    if (fixture) await fixture.cleanup();
  });
});
