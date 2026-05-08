import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/preventive-maintenance/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdItemId: string;

describe('Preventive Maintenance API', () => {
  describe('GET /api/preventive-maintenance', () => {
    it('should return preventive maintenance items', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should include summary statistics', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveProperty('byStatus');
      expect(data.summary).toHaveProperty('byFrequency');
      expect(data.summary).toHaveProperty('dueSoon');
      expect(data.summary).toHaveProperty('overdue');
      expect(typeof data.summary.dueSoon).toBe('number');
      expect(typeof data.summary.overdue).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/preventive-maintenance', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/preventive-maintenance', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((item: any) => item.status === 'active')).toBe(true);
      }
    });

    it('should filter by frequency', async () => {
      const url = buildUrl('/api/preventive-maintenance', { frequency: 'monthly' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/preventive-maintenance', () => {
    it('should create a preventive maintenance item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          title: `Monthly HVAC Filter Change ${suffix}`,
          description: 'Replace HVAC filters in all guest rooms',
          frequency: 'monthly',
          frequencyValue: '1',
          status: 'active',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.title).toContain('Monthly HVAC');
      expect(data.data.frequency).toBe('monthly');
      expect(data.data.status).toBe('active');
      createdItemId = data.data.id;
    });

    it('should reject without title', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          frequency: 'weekly',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Title and frequency');
    });

    it('should reject without frequency', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'No frequency item',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid frequency', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          title: 'Bad Frequency',
          frequency: 'hourly',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid frequency');
    });

    it('should create with all valid frequencies', async () => {
      const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
      for (const freq of validFrequencies) {
        const suffix = uniqueSuffix();
        const url = buildUrl('/api/preventive-maintenance');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            propertyId: PROPERTY_ID,
            title: `Freq Test ${freq} ${suffix}`,
            frequency: freq,
          },
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.frequency).toBe(freq);
        // Clean up
        await db.preventiveMaintenance.delete({ where: { id: data.data.id } });
      }
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test', frequency: 'monthly' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/preventive-maintenance', () => {
    it('should update a preventive maintenance item', async () => {
      if (!createdItemId) return;
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdItemId,
          title: 'Updated HVAC Maintenance',
          description: 'Updated description for HVAC',
          frequency: 'quarterly',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated HVAC Maintenance');
      expect(data.data.frequency).toBe('quarterly');
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { title: 'No ID Update' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should reject update for non-existent item', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          title: 'Non-existent',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject invalid frequency in update', async () => {
      if (!createdItemId) return;
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdItemId,
          frequency: 'invalid',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/preventive-maintenance', () => {
    it('should soft delete a preventive maintenance item', async () => {
      if (!createdItemId) return;
      const url = buildUrl('/api/preventive-maintenance', { id: createdItemId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject delete without id', async () => {
      const url = buildUrl('/api/preventive-maintenance');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const url = buildUrl('/api/preventive-maintenance', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Hard cleanup any test items still lingering
    if (createdItemId) {
      try {
        await db.preventiveMaintenance.deleteMany({
          where: { id: createdItemId, tenantId: TENANT_ID },
        });
      } catch { /* ok */ }
    }
  });
});
