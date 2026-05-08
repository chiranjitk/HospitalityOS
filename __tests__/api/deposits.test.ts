import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/billing/deposits/route';
import { GET as getDepositById, PUT, DELETE } from '@/app/api/billing/deposits/[id]/route';
import { createAuthRequest, buildUrl, BOOKING_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdDepositId: string;

describe('Deposits API', () => {
  describe('GET /api/billing/deposits', () => {
    it('should return list of deposit schedules', async () => {
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      expect(data.pagination.limit).toBeGreaterThan(0);
      expect(data.aggregates).toBeDefined();
      expect(typeof data.aggregates.totalDue).toBe('number');
      expect(typeof data.aggregates.totalPaid).toBe('number');
      expect(typeof data.aggregates.outstanding).toBe('number');
      expect(typeof data.aggregates.overdueCount).toBe('number');
    });

    it('should filter by bookingId', async () => {
      const url = buildUrl('/api/billing/deposits', { bookingId: BOOKING_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/billing/deposits', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      for (const d of data.data) {
        expect(d.status).toBe('pending');
      }
    });

    it('should respect limit and offset pagination', async () => {
      const url = buildUrl('/api/billing/deposits', { limit: '5', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
    });

    it('should compute outstanding as totalDue minus totalPaid', async () => {
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.aggregates.outstanding).toBe(
        data.aggregates.totalDue - data.aggregates.totalPaid,
      );
    });
  });

  describe('POST /api/billing/deposits', () => {
    it('should create a deposit schedule linked to a booking', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          bookingId: BOOKING_ID,
          name: `Booking Deposit ${suffix}`,
          milestoneType: 'at_booking',
          percentOfTotal: 30,
          notes: `Deposit for test ${suffix}`,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Booking Deposit');
      expect(data.data.bookingId).toBe(BOOKING_ID);
      expect(data.data.milestoneType).toBe('at_booking');
      expect(data.data.percentOfTotal).toBe(30);
      expect(data.data.status).toBe('pending');
      expect(data.data.paidAmount).toBe(0);
      expect(data.data.dueAmount).toBeGreaterThan(0);
      expect(data.data.booking).toBeDefined();
      expect(data.data.booking.confirmationCode).toBeDefined();
      createdDepositId = data.data.id;
    });

    it('should create a deposit with fixed amount', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          bookingId: BOOKING_ID,
          name: `Fixed Deposit ${suffix}`,
          milestoneType: 'pre_arrival',
          fixedAmount: 5000,
          milestoneDays: 7,
          notes: `Fixed amount deposit ${suffix}`,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.fixedAmount).toBe(5000);
      expect(data.data.dueAmount).toBe(5000);
      expect(data.data.milestoneDays).toBe(7);

      // Cleanup
      await db.depositSchedule.delete({ where: { id: data.data.id } }).catch(() => {});
    });

    it('should create a standalone deposit without booking', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Standalone Deposit ${suffix}`,
          milestoneType: 'custom',
          milestoneDate: '2025-06-15',
          dueAmount: 2500,
          notes: `Standalone test deposit ${suffix}`,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.bookingId).toBeNull();
      expect(data.data.dueAmount).toBe(2500);
      expect(data.data.milestoneDate).toBeDefined();

      // Cleanup
      await db.depositSchedule.delete({ where: { id: data.data.id } }).catch(() => {});
    });

    it('should reject deposit without name', async () => {
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          milestoneType: 'at_booking',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject deposit with non-existent booking', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/billing/deposits');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          bookingId: '00000000-0000-0000-0000-000000000000',
          name: `Bad Booking ${suffix}`,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/billing/deposits/[id]', () => {
    it('should get a deposit schedule by id', async () => {
      const url = buildUrl(`/api/billing/deposits/${createdDepositId}`);
      const req = await createAuthRequest(url);
      const res = await getDepositById(req as any, { params: Promise.resolve({ id: createdDepositId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdDepositId);
      expect(data.data.name).toBeDefined();
    });

    it('should return 404 for non-existent deposit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/billing/deposits/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getDepositById(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/billing/deposits/[id]', () => {
    it('should update deposit name and milestone type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl(`/api/billing/deposits/${createdDepositId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          name: `Updated Deposit ${suffix}`,
          milestoneType: 'at_checkin',
        },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: createdDepositId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toContain('Updated Deposit');
      expect(data.data.milestoneType).toBe('at_checkin');
    });

    it('should update deposit status to partially_paid with payment info', async () => {
      const url = buildUrl(`/api/billing/deposits/${createdDepositId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'partially_paid',
          paidAmount: 500,
          paymentMethod: 'credit_card',
          reference: 'REF-12345',
        },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: createdDepositId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('partially_paid');
      expect(data.data.paidAmount).toBe(500);
      expect(data.data.paymentMethod).toBe('credit_card');
      expect(data.data.reference).toBe('REF-12345');
    });

    it('should set paidAt when status is paid', async () => {
      const url = buildUrl(`/api/billing/deposits/${createdDepositId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'pending',
          paidAmount: 0,
        },
      });
      // First reset to pending
      await PUT(req as any, { params: Promise.resolve({ id: createdDepositId }) } as any);

      // Now set to paid
      const payReq = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'paid', paidAmount: 2000, paymentMethod: 'bank_transfer' },
      });
      const payRes = await PUT(payReq as any, { params: Promise.resolve({ id: createdDepositId }) } as any);
      expect(payRes.status).toBe(200);
      const payData = await payRes.json();
      expect(payData.data.status).toBe('paid');
      expect(payData.data.paidAt).toBeDefined();
    });

    it('should update dueAmount', async () => {
      const url = buildUrl(`/api/billing/deposits/${createdDepositId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { dueAmount: 3000 },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: createdDepositId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.dueAmount).toBe(3000);
    });

    it('should return 404 for non-existent deposit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/billing/deposits/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Should Fail' },
      });
      const res = await PUT(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/billing/deposits/[id]', () => {
    it('should delete a pending deposit', async () => {
      // Create a new deposit to delete
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/billing/deposits');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Delete Me ${suffix}`,
          milestoneType: 'custom',
          dueAmount: 1000,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const depositToDelete = createData.data.id;

      const url = buildUrl(`/api/billing/deposits/${depositToDelete}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any, { params: Promise.resolve({ id: depositToDelete }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');

      // Verify it is gone
      const getReq = await createAuthRequest(buildUrl(`/api/billing/deposits/${depositToDelete}`));
      const getRes = await getDepositById(getReq as any, { params: Promise.resolve({ id: depositToDelete }) } as any);
      expect(getRes.status).toBe(404);
    });

    it('should not delete a paid deposit', async () => {
      // Create and pay a deposit
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/billing/deposits');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Paid Deposit ${suffix}`,
          milestoneType: 'custom',
          dueAmount: 500,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const paidDepositId = createData.data.id;

      // Mark as paid
      const putReq = await createAuthRequest(buildUrl(`/api/billing/deposits/${paidDepositId}`), {
        method: 'PUT',
        body: { status: 'paid', paidAmount: 500 },
      });
      await PUT(putReq as any, { params: Promise.resolve({ id: paidDepositId }) } as any);

      // Try to delete
      const delReq = await createAuthRequest(buildUrl(`/api/billing/deposits/${paidDepositId}`), {
        method: 'DELETE',
      });
      const delRes = await DELETE(delReq as any, { params: Promise.resolve({ id: paidDepositId }) } as any);
      expect(delRes.status).toBe(400);
      const delData = await delRes.json();
      expect(delData.success).toBe(false);
      expect(delData.error).toContain('Cannot delete');

      // Cleanup - force delete since we can't through the API
      await db.depositSchedule.delete({ where: { id: paidDepositId } }).catch(() => {});
    });

    it('should return 404 for non-existent deposit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/billing/deposits/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (createdDepositId) {
      try {
        await db.depositSchedule.delete({ where: { id: createdDepositId } });
      } catch {}
    }
  });
});
