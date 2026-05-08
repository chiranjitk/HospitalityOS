import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/inspections/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdTemplateId: string;
let createdRoomId: string;
let createdInspectionId: string;

describe('Inspections API', () => {
  beforeAll(async () => {
    // Create a template for testing inspections
    const suffix = uniqueSuffix();
    const template = await db.inspectionTemplate.create({
      data: {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: `Inspection Test Template ${suffix}`,
        category: 'room',
        items: JSON.stringify([
          { id: 'ti-1', name: 'Bedsheets clean', required: true, sortOrder: 1 },
          { id: 'ti-2', name: 'Bathroom sanitized', required: true, sortOrder: 2 },
          { id: 'ti-3', name: 'Towels fresh', required: true, sortOrder: 3 },
        ]),
        isActive: true,
      },
    });
    createdTemplateId = template.id;

    // Create a room for testing
    const room = await db.room.create({
      data: {
        propertyId: PROPERTY_ID,
        roomTypeId: ROOM_TYPE_ID,
        number: `RM-INSP-${suffix.slice(-5)}`,
        floor: 1,
        status: 'available',
      },
    });
    createdRoomId = room.id;
  });

  describe('GET /api/inspections', () => {
    it('should return inspection results', async () => {
      const url = buildUrl('/api/inspections');
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
    });

    it('should include stats', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('passed');
      expect(data.stats).toHaveProperty('failed');
      expect(data.stats).toHaveProperty('avgScore');
      expect(typeof data.stats.total).toBe('number');
      expect(typeof data.stats.avgScore).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/inspections', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by templateId', async () => {
      const url = buildUrl('/api/inspections', { templateId: createdTemplateId });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by passed status', async () => {
      const url = buildUrl('/api/inspections', { passed: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/inspections', { page: '1', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inspections');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/inspections', () => {
    it('should create an inspection result', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          templateId: createdTemplateId,
          items: [
            { templateItemId: 'ti-1', name: 'Bedsheets clean', passed: true },
            { templateItemId: 'ti-2', name: 'Bathroom sanitized', passed: true },
            { templateItemId: 'ti-3', name: 'Towels fresh', passed: true, notes: 'Extra fluffy' },
          ],
          notes: 'All items passed inspection',
        },
      });
      const res = await POST(req);
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data?.id) {
        createdInspectionId = data.data.id;
      }
    });

    it('should create inspection with failures', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          templateId: createdTemplateId,
          items: [
            { templateItemId: 'ti-1', name: 'Bedsheets clean', passed: true },
            { templateItemId: 'ti-2', name: 'Bathroom sanitized', passed: false, notes: 'Stain on sink' },
            { templateItemId: 'ti-3', name: 'Towels fresh', passed: true },
          ],
        },
      });
      const res = await POST(req);
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.success).toBe(true);
      // If data.data has passed, it should be false since one item failed
      if (data.data?.passed !== undefined) {
        expect(data.data.passed).toBe(false);
      }
    });

    it('should reject without required fields', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomId: createdRoomId,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Missing required fields');
    });

    it('should reject without items', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          templateId: createdTemplateId,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject items missing required fields', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          templateId: createdTemplateId,
          items: [{ name: 'incomplete' }],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid templateId', async () => {
      const url = buildUrl('/api/inspections');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          templateId: '00000000-0000-0000-0000-000000000000',
          items: [
            { templateItemId: 'ti-1', name: 'Test', passed: true },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inspections');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: PROPERTY_ID, roomId: 'abc', templateId: 'def', items: [] }),
      }));
      expect(res.status).toBe(401);
    });
  });

  afterAll(async () => {
    // Cleanup inspection results
    if (createdInspectionId) {
      try { await db.inspectionResult.delete({ where: { id: createdInspectionId } }); } catch { /* ok */ }
    }
    // Cleanup any inspection results for this room/template
    try {
      await db.inspectionResult.deleteMany({
        where: { roomId: createdRoomId, tenantId: TENANT_ID },
      });
    } catch { /* ok */ }
    // Cleanup room
    if (createdRoomId) {
      try { await db.room.delete({ where: { id: createdRoomId } }); } catch { /* ok */ }
    }
    // Cleanup template
    if (createdTemplateId) {
      try { await db.inspectionTemplate.delete({ where: { id: createdTemplateId } }); } catch { /* ok */ }
    }
  });
});
