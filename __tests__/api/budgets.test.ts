import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/financials/budgets/route';
import { GET as getBudgetById, PUT, DELETE } from '@/app/api/financials/budgets/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, REVENUE_ACCOUNT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdBudgetId: string;

describe('Budgets API', () => {
  describe('GET /api/financials/budgets', () => {
    it('should return list of budgets for current year', async () => {
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.aggregates).toBeDefined();
      expect(typeof data.aggregates.totalBudget).toBe('number');
      expect(typeof data.aggregates.totalActual).toBe('number');
      expect(typeof data.aggregates.totalVariance).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/financials/budgets', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by fiscalYear', async () => {
      const url = buildUrl('/api/financials/budgets', { fiscalYear: '2024' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const b of data.data) {
        expect(b.fiscalYear).toBe(2024);
      }
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/financials/budgets', { status: 'draft' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const b of data.data) {
        expect(b.status).toBe('draft');
      }
    });

    it('should compute totalVariance as totalBudget minus totalActual', async () => {
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.aggregates.totalVariance).toBe(
        data.aggregates.totalBudget - data.aggregates.totalActual,
      );
    });

    it('should return budgets ordered by createdAt desc', async () => {
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      if (data.data.length >= 2) {
        const dates = data.data.map((b: any) => new Date(b.createdAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      }
    });
  });

  describe('POST /api/financials/budgets', () => {
    it('should create a budget without lines', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Budget ${suffix}`,
          fiscalYear: 2024,
          periodType: 'monthly',
          status: 'draft',
          notes: 'Test budget notes',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Budget');
      expect(data.data.fiscalYear).toBe(2024);
      expect(data.data.periodType).toBe('monthly');
      expect(data.data.status).toBe('draft');
      expect(data.data.totalBudget).toBe(0);
      expect(data.data.lines).toBeInstanceOf(Array);
      createdBudgetId = data.data.id;
    });

    it('should create a budget with budget lines', async () => {
      const suffix = uniqueSuffix();
      // Create a financial account first (table may be empty)
      const account = await db.financialAccount.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          code: `FA-${suffix.slice(-6)}`,
          name: `Test Revenue Account ${suffix}`,
          accountType: 'revenue',
          category: 'room',
        },
      });
      try {
        const url = buildUrl('/api/financials/budgets');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            propertyId: PROPERTY_ID,
            name: `Budget with Lines ${suffix}`,
            fiscalYear: 2024,
            periodType: 'monthly',
            status: 'draft',
            lines: [
              { accountId: account.id, period: 1, budgetedAmt: 100000 },
              { accountId: account.id, period: 2, budgetedAmt: 110000 },
              { accountId: account.id, period: 3, budgetedAmt: 120000 },
            ],
          },
        });
        const res = await POST(req as any);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.id).toBeDefined();
        expect(data.data.totalBudget).toBe(330000);
        expect(data.data.lines).toHaveLength(3);
        expect(data.data.lines[0].financialAccount).toBeDefined();
        expect(data.data.lines[0].budgetedAmt).toBe(100000);
        expect(data.data.lines[0].actualAmt).toBe(0);
      } finally {
        // Clean up the account we created
        await db.budgetLine.deleteMany({ where: { accountId: account.id } }).catch(() => {});
        await db.financialAccount.delete({ where: { id: account.id } }).catch(() => {});
      }
    });

    it('should reject budget without name', async () => {
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          fiscalYear: 2024,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject budget with invalid fiscalYear', async () => {
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Year',
          fiscalYear: 1999,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject budget with invalid financial account', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/financials/budgets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Account Budget ${suffix}`,
          fiscalYear: 2024,
          lines: [
            { accountId: '00000000-0000-0000-0000-000000000000', period: 1, budgetedAmt: 5000 },
          ],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/financials/budgets/[id]', () => {
    it('should get a budget by id', async () => {
      const url = buildUrl(`/api/financials/budgets/${createdBudgetId}`);
      const req = await createAuthRequest(url);
      const res = await getBudgetById(req as any, { params: Promise.resolve({ id: createdBudgetId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdBudgetId);
      expect(data.data.lines).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent budget', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/financials/budgets/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getBudgetById(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/financials/budgets/[id]', () => {
    it('should update budget name and notes', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl(`/api/financials/budgets/${createdBudgetId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          name: `Updated Budget ${suffix}`,
          notes: 'Updated notes',
        },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: createdBudgetId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toContain('Updated Budget');
      expect(data.data.notes).toBe('Updated notes');
    });

    it('should update budget status to approved', async () => {
      const url = buildUrl(`/api/financials/budgets/${createdBudgetId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'draft' },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: createdBudgetId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('draft');
    });

    it('should return 404 for non-existent budget', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/financials/budgets/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Should Fail' },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/financials/budgets/[id]', () => {
    it('should delete a draft budget', async () => {
      // Create a new budget to delete
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/financials/budgets');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Delete Me ${suffix}`,
          fiscalYear: 2025,
          status: 'draft',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const budgetToDelete = createData.data.id;

      const url = buildUrl(`/api/financials/budgets/${budgetToDelete}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any, { params: Promise.resolve({ id: budgetToDelete }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');

      // Verify it is gone
      const getReq = await createAuthRequest(buildUrl(`/api/financials/budgets/${budgetToDelete}`));
      const getRes = await getBudgetById(getReq as any, { params: Promise.resolve({ id: budgetToDelete }) } as any);
      expect(getRes.status).toBe(404);
    });

    it('should not delete an approved budget', async () => {
      // Create and approve a budget
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/financials/budgets');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Approved Budget ${suffix}`,
          fiscalYear: 2025,
          status: 'draft',
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const approvedBudgetId = createData.data.id;

      // Approve it
      const putReq = await createAuthRequest(buildUrl(`/api/financials/budgets/${approvedBudgetId}`), {
        method: 'PUT',
        body: { status: 'approved' },
      });
      await PUT(putReq as any, { params: Promise.resolve({ id: approvedBudgetId }) } as any);

      // Try to delete
      const delReq = await createAuthRequest(buildUrl(`/api/financials/budgets/${approvedBudgetId}`), {
        method: 'DELETE',
      });
      const delRes = await DELETE(delReq as any, { params: Promise.resolve({ id: approvedBudgetId }) } as any);
      expect(delRes.status).toBe(400);
      const delData = await delRes.json();
      expect(delData.success).toBe(false);
      expect(delData.error).toContain('Cannot delete');

      // Cleanup
      await db.budgetLine.deleteMany({ where: { budgetId: approvedBudgetId } }).catch(() => {});
      await db.budget.delete({ where: { id: approvedBudgetId } }).catch(() => {});
    });

    it('should return 404 for non-existent budget', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/financials/budgets/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (createdBudgetId) {
      try {
        await db.budgetLine.deleteMany({ where: { budgetId: createdBudgetId } });
        await db.budget.delete({ where: { id: createdBudgetId } });
      } catch {}
    }
  });
});
