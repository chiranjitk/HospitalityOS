import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/billing/financing/route';
import { GET as getInstallments, POST as createInstallment } from '@/app/api/billing/financing/installments/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, FOLIO_ID, BOOKING_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdPlanId: string;
const createdInstallmentIds: string[] = [];

describe('Financing API', () => {
  describe('GET /api/billing/financing', () => {
    it('should return list of financing plans', async () => {
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // Each plan should have installment stats
      for (const plan of data.data) {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan._installments).toBeDefined();
        expect(typeof plan._installments.count).toBe('number');
        expect(typeof plan._installments.totalAmount).toBe('number');
        expect(typeof plan._installments.paidAmount).toBe('number');
      }
    });

    it('should filter by isActive=true', async () => {
      const url = buildUrl('/api/billing/financing', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const plan of data.data) {
        expect(plan.isActive).toBe(true);
      }
    });

    it('should filter by provider', async () => {
      const url = buildUrl('/api/billing/financing', { provider: 'internal' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const plan of data.data) {
        expect(plan.provider).toBe('internal');
      }
    });

    it('should return plans ordered by createdAt desc', async () => {
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      if (data.data.length >= 2) {
        const dates = data.data.map((p: any) => new Date(p.createdAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      }
    });
  });

  describe('POST /api/billing/financing', () => {
    it('should create a financing plan', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Plan ${suffix}`,
          provider: 'internal',
          minAmount: 1000,
          maxAmount: 100000,
          interestRate: 5.5,
          durationMonths: 12,
          minInstallment: 500,
          maxInstallments: 12,
          isActive: true,
          terms: 'No interest for 3 months',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Plan');
      expect(data.data.provider).toBe('internal');
      expect(data.data.minAmount).toBe(1000);
      expect(data.data.maxAmount).toBe(100000);
      expect(data.data.interestRate).toBe(5.5);
      expect(data.data.durationMonths).toBe(12);
      expect(data.data.isActive).toBe(true);
      expect(data.data.terms).toBe('No interest for 3 months');
      createdPlanId = data.data.id;
    });

    it('should create a plan with default values', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Default Plan ${suffix}`,
          maxAmount: 50000,
          durationMonths: 6,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.provider).toBe('internal');
      expect(data.data.minAmount).toBe(0);
      expect(data.data.interestRate).toBe(0);
      expect(data.data.maxInstallments).toBe(12);
      expect(data.data.isActive).toBe(true);

      // Cleanup
      await db.financingPlan.delete({ where: { id: data.data.id } }).catch(() => {});
    });

    it('should create plan with different providers', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing');
      for (const provider of ['klarna', 'affirm', 'afterpay'] as const) {
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            name: `${provider} Plan ${suffix}`,
            maxAmount: 200000,
            durationMonths: 24,
            provider,
          },
        });
        const res = await POST(req as any);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.provider).toBe(provider);
        await db.financingPlan.delete({ where: { id: data.data.id } }).catch(() => {});
      }
    });

    it('should reject plan without name', async () => {
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          maxAmount: 50000,
          durationMonths: 12,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject plan without required maxAmount', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `No Max ${suffix}`,
          durationMonths: 12,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject plan with invalid duration', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Duration ${suffix}`,
          maxAmount: 10000,
          durationMonths: 0,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/billing/financing/installments', () => {
    it('should return list of installments', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      expect(data.aggregates).toBeDefined();
      expect(typeof data.aggregates.totalAmount).toBe('number');
      expect(typeof data.aggregates.totalPaid).toBe('number');
      expect(typeof data.aggregates.outstanding).toBe('number');
    });

    it('should filter by financingPlanId', async () => {
      if (!createdPlanId) return;
      const url = buildUrl('/api/billing/financing/installments', {
        financingPlanId: createdPlanId,
      });
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by bookingId', async () => {
      const url = buildUrl('/api/billing/financing/installments', {
        bookingId: BOOKING_ID,
      });
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by guestId', async () => {
      const url = buildUrl('/api/billing/financing/installments', {
        guestId: GUEST_ID,
      });
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/billing/financing/installments', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const inst of data.data) {
        expect(inst.status).toBe('pending');
      }
    });

    it('should respect pagination params', async () => {
      const url = buildUrl('/api/billing/financing/installments', { limit: '5', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(5);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
    });

    it('should compute outstanding as totalAmount minus totalPaid', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url);
      const res = await getInstallments(req as any);
      const data = await res.json();
      expect(data.aggregates.outstanding).toBe(
        data.aggregates.totalAmount - data.aggregates.totalPaid,
      );
    });
  });

  describe('POST /api/billing/financing/installments', () => {
    it('should create an installment linked to a plan', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: createdPlanId,
          folioId: FOLIO_ID,
          bookingId: BOOKING_ID,
          guestId: GUEST_ID,
          totalAmount: 12000,
          installmentAmount: 1000,
          installmentNumber: 1,
          dueDate: '2025-02-15',
          paidAmount: 0,
          status: 'pending',
          paymentRef: `REF-${suffix.slice(-6)}`,
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.financingPlanId).toBe(createdPlanId);
      expect(data.data.totalAmount).toBe(12000);
      expect(data.data.installmentAmount).toBe(1000);
      expect(data.data.installmentNumber).toBe(1);
      expect(data.data.status).toBe('pending');
      expect(data.data.paidAmount).toBe(0);
      expect(data.data.financingPlan).toBeDefined();
      expect(data.data.financingPlan.name).toBeDefined();
      createdInstallmentIds.push(data.data.id);
    });

    it('should create an installment with paid status', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: createdPlanId,
          totalAmount: 12000,
          installmentAmount: 1000,
          installmentNumber: 2,
          dueDate: '2025-03-15',
          paidAmount: 1000,
          status: 'paid',
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('paid');
      expect(data.data.paidAmount).toBe(1000);
      createdInstallmentIds.push(data.data.id);
    });

    it('should create an installment with minimal fields', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: createdPlanId,
          totalAmount: 6000,
          installmentAmount: 500,
          installmentNumber: 3,
          dueDate: '2025-04-15',
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.paidAmount).toBe(0);
      expect(data.data.status).toBe('pending');
      createdInstallmentIds.push(data.data.id);
    });

    it('should reject installment without financingPlanId', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          totalAmount: 5000,
          installmentAmount: 500,
          installmentNumber: 1,
          dueDate: '2025-05-15',
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject installment without dueDate', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: createdPlanId,
          totalAmount: 5000,
          installmentAmount: 500,
          installmentNumber: 1,
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject installment with non-existent plan', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: '00000000-0000-0000-0000-000000000000',
          totalAmount: 5000,
          installmentAmount: 500,
          installmentNumber: 1,
          dueDate: '2025-05-15',
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('should reject installment with negative totalAmount', async () => {
      const url = buildUrl('/api/billing/financing/installments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          financingPlanId: createdPlanId,
          totalAmount: -100,
          installmentAmount: 500,
          installmentNumber: 1,
          dueDate: '2025-05-15',
        },
      });
      const res = await createInstallment(req as any);
      expect(res.status).toBe(400);
    });
  });

  afterAll(async () => {
    for (const id of createdInstallmentIds) {
      await db.financingInstallment.delete({ where: { id } }).catch(() => {});
    }
    if (createdPlanId) {
      await db.financingPlan.delete({ where: { id: createdPlanId } }).catch(() => {});
    }
  });
});
