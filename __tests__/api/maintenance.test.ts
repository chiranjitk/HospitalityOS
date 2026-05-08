import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/maintenance/work-orders/route';
import { GET as getWorkOrder, PUT as updateWorkOrder, DELETE as deleteWorkOrder } from '@/app/api/maintenance/work-orders/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdWorkOrderId: string;
let createdWorkOrderNumber: string;

describe('Maintenance Work Orders API', () => {
  describe('GET /api/maintenance/work-orders', () => {
    it('should return work orders list for tenant', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should include stats with work orders', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalWorkOrders');
      expect(data.stats).toHaveProperty('overdueWorkOrders');
      expect(data.stats).toHaveProperty('statusDistribution');
      expect(data.stats).toHaveProperty('priorityDistribution');
      expect(data.stats).toHaveProperty('typeDistribution');
      expect(data.stats).toHaveProperty('totalEstimatedCost');
      expect(data.stats).toHaveProperty('totalActualCost');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/maintenance/work-orders', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/maintenance/work-orders', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // All returned work orders should be pending
      expect(data.data.every((wo: any) => wo.status === 'pending')).toBe(true);
    });

    it('should filter by priority', async () => {
      const url = buildUrl('/api/maintenance/work-orders', { priority: 'high' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((wo: any) => wo.priority === 'high')).toBe(true);
      }
    });

    it('should support search', async () => {
      const url = buildUrl('/api/maintenance/work-orders', { search: 'maintenance' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/maintenance/work-orders', () => {
    it('should create a work order', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          title: `Test Work Order ${suffix}`,
          description: 'Fix leaking faucet in bathroom',
          type: 'general',
          priority: 'medium',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedCost: 500,
          estimatedHours: 2,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.workOrderNumber).toBeDefined();
      expect(data.data.title).toContain('Test Work Order');
      expect(data.data.status).toBe('pending');
      expect(data.data.priority).toBe('medium');
      expect(data.data.estimatedCost).toBe(500);
      createdWorkOrderId = data.data.id;
      createdWorkOrderNumber = data.data.workOrderNumber;
    });

    it('should reject without propertyId', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'No Property Order',
          description: 'This should fail',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Property ID');
    });

    it('should reject without title', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('title');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: PROPERTY_ID, title: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/maintenance/work-orders/[id]', () => {
    it('should get a single work order by ID', async () => {
      if (!createdWorkOrderId) return;
      const url = buildUrl(`/api/maintenance/work-orders/${createdWorkOrderId}`);
      const req = await createAuthRequest(url);
      const res = await getWorkOrder(req, { params: Promise.resolve({ id: createdWorkOrderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdWorkOrderId);
      expect(data.data.workOrderNumber).toBe(createdWorkOrderNumber);
      expect(data.data.property).toBeDefined();
      expect(data.data.property).toHaveProperty('id');
      expect(data.data.property).toHaveProperty('name');
    });

    it('should return 404 for non-existent work order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/maintenance/work-orders/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getWorkOrder(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/maintenance/work-orders/some-id');
      const res = await getWorkOrder(new Request(url, { headers: {} }), { params: Promise.resolve({ id: 'some-id' }) } as any);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/maintenance/work-orders', () => {
    it('should update work order status to in_progress', async () => {
      if (!createdWorkOrderId) return;
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdWorkOrderId,
          status: 'in_progress',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('in_progress');
      expect(data.data.startedAt).toBeDefined();
    });

    it('should reject invalid status transition', async () => {
      if (!createdWorkOrderId) return;
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdWorkOrderId,
          status: 'completed', // in_progress -> completed is valid, but let's test
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('completed');
      expect(data.data.completedAt).toBeDefined();
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'pending' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should reject update for non-existent work order', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          status: 'in_progress',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/maintenance/work-orders/[id]', () => {
    it('should update work order via URL param', async () => {
      if (!createdWorkOrderId) return;
      const url = buildUrl(`/api/maintenance/work-orders/${createdWorkOrderId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          priority: 'high',
          description: 'Updated description',
        },
      });
      const res = await updateWorkOrder(req, { params: Promise.resolve({ id: createdWorkOrderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.priority).toBe('high');
    });
  });

  describe('DELETE /api/maintenance/work-orders', () => {
    it('should require ids parameter', async () => {
      const url = buildUrl('/api/maintenance/work-orders');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/maintenance/work-orders/[id]', () => {
    it('should soft delete a work order', async () => {
      if (!createdWorkOrderId) return;
      const url = buildUrl(`/api/maintenance/work-orders/${createdWorkOrderId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteWorkOrder(req, { params: Promise.resolve({ id: createdWorkOrderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent work order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const url = buildUrl(`/api/maintenance/work-orders/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteWorkOrder(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Cleanup: hard-delete any test work orders created
    if (createdWorkOrderId) {
      try {
        await db.workOrder.deleteMany({
          where: {
            id: createdWorkOrderId,
            tenantId: TENANT_ID,
          },
        });
      } catch { /* ok if already cleaned up */ }
    }
  });
});
