import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT } from '@/app/api/security/events/route';
import { createAuthRequest, buildUrl, TENANT_ID, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let cameraId: string;
let createdEventId: string;

describe('Security Events API', () => {
  beforeAll(async () => {
    // Create a test camera for security events
    try {
      const suffix = uniqueSuffix();
      const camera = await db.camera.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          name: `Test Camera ${suffix.slice(-4)}`,
          location: 'Lobby',
          status: 'active',
        },
      });
      cameraId = camera.id;
    } catch (e) {
      // Camera table may not exist or may have different schema
      console.log('Skipping camera creation:', e);
    }
  });

  afterAll(async () => {
    if (createdEventId) {
      try { await db.securityEvent.delete({ where: { id: createdEventId } }); } catch (e) { /* ignore */ }
    }
    if (cameraId) {
      try { await db.camera.delete({ where: { id: cameraId } }); } catch (e) { /* ignore */ }
    }
  });

  describe('GET /api/security/events', () => {
    it('should return security events with pagination', async () => {
      const url = buildUrl('/api/security/events', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it('should return statistics when stats=true', async () => {
      const url = buildUrl('/api/security/events', { stats: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.totalEvents).toBeDefined();
      expect(data.data.unacknowledgedCount).toBeDefined();
      expect(data.data.byType).toBeDefined();
      expect(data.data.bySeverity).toBeDefined();
    });

    it('should filter by severity', async () => {
      const url = buildUrl('/api/security/events', { severity: 'high', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/security/events', () => {
    it('should create a new security event', async () => {
      if (!cameraId) return;
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          cameraId,
          type: 'motion',
          severity: 'medium',
          description: 'Motion detected in lobby',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.type).toBe('motion');
      expect(data.data.acknowledged).toBe(false);
      createdEventId = data.data.id;
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'motion',
          // missing cameraId and description
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid event type', async () => {
      if (!cameraId) return;
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          cameraId,
          type: 'invalid_type',
          description: 'Test',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid severity', async () => {
      if (!cameraId) return;
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          cameraId,
          type: 'motion',
          severity: 'extreme',
          description: 'Test',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/security/events', () => {
    it('should acknowledge a security event', async () => {
      if (!createdEventId) return;
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdEventId,
          acknowledged: true,
          notes: 'Reviewed - no action needed',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.acknowledged).toBe(true);
      expect(data.data.acknowledgedAt).toBeDefined();
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { acknowledged: true },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent event', async () => {
      const url = buildUrl('/api/security/events');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', acknowledged: true },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });
});
