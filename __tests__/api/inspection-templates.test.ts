import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/inspection-templates/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdTemplateIds: string[] = [];

describe('Inspection Templates API', () => {
  describe('GET /api/inspection-templates', () => {
    it('should return inspection templates', async () => {
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('totalPages');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/inspection-templates', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/inspection-templates', { category: 'room' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by isActive', async () => {
      const url = buildUrl('/api/inspection-templates', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((t: any) => t.isActive === true)).toBe(true);
      }
    });

    it('should support search', async () => {
      const url = buildUrl('/api/inspection-templates', { search: 'room' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/inspection-templates', { page: '1', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(5);
      expect(data.pagination.limit).toBe(5);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inspection-templates');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/inspection-templates', () => {
    it('should create an inspection template', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Room Inspection ${suffix}`,
          description: 'Standard room cleanliness inspection',
          roomType: 'deluxe',
          category: 'room',
          items: [
            { id: 'item-1', name: 'Bed linens changed', required: true, sortOrder: 1 },
            { id: 'item-2', name: 'Bathroom cleaned', required: true, sortOrder: 2 },
            { id: 'item-3', name: 'Towels replaced', required: true, sortOrder: 3 },
            { id: 'item-4', name: 'Mini bar restocked', required: false, sortOrder: 4 },
          ],
          isActive: true,
          sortOrder: 1,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Room Inspection');
      expect(data.data.category).toBe('room');
      expect(data.data.isActive).toBe(true);
      createdTemplateIds.push(data.data.id);
    });

    it('should create template with minimal fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Minimal Template ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.category).toBe('room');
      createdTemplateIds.push(data.data.id);
    });

    it('should reject without name', async () => {
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('name');
    });

    it('should reject non-array items', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Items ${suffix}`,
          items: 'not-an-array',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('items must be an array');
    });

    it('should validate items have required fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Item Fields ${suffix}`,
          items: [{ name: 'incomplete item' }],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('missing required fields');
    });

    it('should reject invalid propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inspection-templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Property ${suffix}`,
          propertyId: '00000000-0000-0000-0000-000000000000',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inspection-templates');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  afterAll(async () => {
    if (createdTemplateIds.length > 0) {
      try {
        await db.inspectionTemplate.deleteMany({
          where: { id: { in: createdTemplateIds }, tenantId: TENANT_ID },
        });
      } catch { /* ok */ }
    }
  });
});
