import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/tasks/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdTaskId: string;

describe('Tasks API', () => {
  describe('GET /api/tasks', () => {
    it('should return tasks list', async () => {
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
    });

    it('should include summary statistics', async () => {
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveProperty('byStatus');
      expect(data.summary).toHaveProperty('byPriority');
    });

    it('should include room and assignee relations', async () => {
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const task = data.data[0];
        // Room relation should be included (may be null)
        expect(task).toHaveProperty('room');
        // Assignee relation should be included (may be null)
        expect(task).toHaveProperty('assignee');
      }
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/tasks', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/tasks', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((t: any) => t.status === 'pending')).toBe(true);
      }
    });

    it('should filter by type', async () => {
      const url = buildUrl('/api/tasks', { type: 'cleaning' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by priority', async () => {
      const url = buildUrl('/api/tasks', { priority: 'high' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support search', async () => {
      const url = buildUrl('/api/tasks', { search: 'clean' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support pagination with limit and offset', async () => {
      const url = buildUrl('/api/tasks', { limit: '5', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/tasks');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a cleaning task', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'cleaning',
          category: 'checkout',
          title: `Checkout clean Room ${suffix.slice(-5)}`,
          description: 'Full checkout cleaning for departing guest',
          priority: 'high',
          status: 'pending',
          scheduledAt: new Date().toISOString(),
          estimatedDuration: 45,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.title).toContain('Checkout clean');
      expect(data.data.type).toBe('cleaning');
      expect(data.data.category).toBe('checkout');
      expect(data.data.priority).toBe('high');
      expect(data.data.status).toBe('pending');
      createdTaskId = data.data.id;
    });

    it('should create a maintenance task', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'maintenance',
          category: 'repair',
          title: `Fix AC in room ${suffix.slice(-5)}`,
          priority: 'medium',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.type).toBe('maintenance');
      expect(data.data.category).toBe('repair');
      // Cleanup
      await db.task.delete({ where: { id: data.data.id } });
    });

    it('should create task with default priority', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'cleaning',
          category: 'stayover',
          title: `Default priority ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.priority).toBe('medium');
      // Cleanup
      await db.task.delete({ where: { id: data.data.id } });
    });

    it('should reject without required fields', async () => {
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Missing required fields');
    });

    it('should reject without propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'cleaning',
          category: 'checkout',
          title: `No property ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          type: 'cleaning',
          category: 'checkout',
          title: `Bad property ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });

    it('should reject invalid roomId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tasks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: '00000000-0000-0000-0000-000000000000',
          type: 'cleaning',
          category: 'checkout',
          title: `Bad room ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_ROOM');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/tasks');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: PROPERTY_ID, type: 'cleaning', category: 'checkout', title: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  afterAll(async () => {
    if (createdTaskId) {
      try { await db.task.delete({ where: { id: createdTaskId } }); } catch { /* ok */ }
    }
  });
});
