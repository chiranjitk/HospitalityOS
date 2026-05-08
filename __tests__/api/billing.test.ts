import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/billing/ap-workflow/route';
import { createAuthRequest, buildUrl, PROPERTY_ID } from './test-helpers';

describe('Billing AP Workflow API', () => {
  describe('GET /api/billing/ap-workflow', () => {
    it('should return AP workflow dashboard data', async () => {
      const url = buildUrl('/api/billing/ap-workflow');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.invoices).toBeInstanceOf(Array);
      expect(data.data.workflowStages).toBeInstanceOf(Array);
      expect(data.data.paymentSchedule).toBeInstanceOf(Array);
      expect(data.data.documents).toBeInstanceOf(Array);
      expect(data.stats).toBeDefined();
    });

    it('should include workflow stages with expected structure', async () => {
      const url = buildUrl('/api/billing/ap-workflow');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const stages = data.data.workflowStages;
      expect(stages.length).toBeGreaterThan(0);
      for (const stage of stages) {
        expect(stage).toHaveProperty('id');
        expect(stage).toHaveProperty('name');
        expect(stage).toHaveProperty('order');
        expect(stage).toHaveProperty('description');
        expect(stage).toHaveProperty('approverRole');
        expect(stage).toHaveProperty('currentInQueue');
      }
    });

    it('should include stats with expected keys', async () => {
      const url = buildUrl('/api/billing/ap-workflow');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toHaveProperty('totalInvoices');
      expect(data.stats).toHaveProperty('pendingApproval');
      expect(data.stats).toHaveProperty('approved');
      expect(data.stats).toHaveProperty('paid');
      expect(data.stats).toHaveProperty('overdue');
      expect(data.stats).toHaveProperty('totalPayable');
      expect(data.stats).toHaveProperty('approvalRate');
      expect(typeof data.stats.totalPayable).toBe('number');
    });

    it('should filter invoices by status', async () => {
      const url = buildUrl('/api/billing/ap-workflow', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.invoices).toBeInstanceOf(Array);
      // All returned invoices should match the status
      if (data.data.invoices.length > 0) {
        expect(data.data.invoices.every((inv: any) => inv.status === 'pending')).toBe(true);
      }
    });

    it('should return payment schedule with expected fields', async () => {
      const url = buildUrl('/api/billing/ap-workflow');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const schedule = data.data.paymentSchedule;
      expect(schedule).toBeInstanceOf(Array);
      if (schedule.length > 0) {
        const payment = schedule[0];
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('scheduledDate');
        expect(payment).toHaveProperty('status');
      }
    });
  });
});
