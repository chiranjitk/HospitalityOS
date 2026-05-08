import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/security/incidents/route';
import { createAuthRequest, buildUrl, TENANT_ID, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdIncidentId: string;

describe('Security Incidents API', () => {
  describe('GET /api/security/incidents', () => {
    it('should return list of incidents with stats', async () => {
      const url = buildUrl('/api/security/incidents', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.incidents).toBeDefined();
      expect(Array.isArray(data.data.incidents)).toBe(true);
      expect(data.data.total).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats.total).toBeDefined();
      expect(data.data.stats.open).toBeDefined();
      expect(data.data.stats.byStatus).toBeDefined();
      expect(data.data.stats.bySeverity).toBeDefined();
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/security/incidents', { status: 'open', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by severity', async () => {
      const url = buildUrl('/api/security/incidents', { severity: 'high', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by type', async () => {
      const url = buildUrl('/api/security/incidents', { type: 'theft', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject invalid status filter', async () => {
      const url = buildUrl('/api/security/incidents', { status: 'invalid' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid severity filter', async () => {
      const url = buildUrl('/api/security/incidents', { severity: 'extreme' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid type filter', async () => {
      const url = buildUrl('/api/security/incidents', { type: 'alien_invasion' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/security/incidents', () => {
    it('should create a new incident', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'disturbance',
          severity: 'medium',
          title: `Noise Complaint ${suffix.slice(-4)}`,
          description: 'Guest reported loud noise from adjacent room',
          location: 'Floor 3, Room 305',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('open');
      expect(data.data.severity).toBe('medium');
      createdIncidentId = data.data.id;
    });

    it('should create incident with high severity', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'theft',
          severity: 'high',
          title: `Theft Report ${suffix.slice(-4)}`,
          location: 'Parking Lot B',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Cleanup
      await db.securityIncident.delete({ where: { id: data.data.id } });
    });

    it('should reject missing title', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          location: 'Lobby',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject missing location', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'Test Incident',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid incident type', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'Test',
          location: 'Lobby',
          type: 'invalid_type',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid severity', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'Test',
          location: 'Lobby',
          severity: 'extreme',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 for non-existent property', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          title: 'Test',
          location: 'Nowhere',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/security/incidents', () => {
    it('should update incident status to investigating', async () => {
      if (!createdIncidentId) return;
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdIncidentId,
          status: 'investigating',
          severity: 'low',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('investigating');
    });

    it('should resolve incident', async () => {
      if (!createdIncidentId) return;
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdIncidentId,
          status: 'resolved',
          resolution: 'Issue resolved after speaking with guests',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('resolved');
      expect(data.data.resolvedAt).toBeDefined();
    });

    it('should reject invalid status transition', async () => {
      if (!createdIncidentId) return;
      // resolved -> open is not allowed (open not in resolved transitions)
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdIncidentId,
          status: 'open',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'investigating' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent incident', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'investigating' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/security/incidents', () => {
    it('should close incident first then delete', async () => {
      if (!createdIncidentId) return;
      // Close the incident first (resolved -> closed)
      const closeUrl = buildUrl('/api/security/incidents');
      const closeReq = await createAuthRequest(closeUrl, {
        method: 'PUT',
        body: { id: createdIncidentId, status: 'closed' },
      });
      const closeRes = await PUT(closeReq);
      expect(closeRes.status).toBe(200);

      // Delete
      const url = buildUrl('/api/security/incidents', { id: createdIncidentId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/security/incidents');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent incident', async () => {
      const url = buildUrl('/api/security/incidents', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
