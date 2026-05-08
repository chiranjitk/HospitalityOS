import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/experience-vendors/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdVendorId: string;

describe('Experience Vendors API', () => {
  describe('GET /api/experience-vendors', () => {
    it('should return list of vendors with pagination', async () => {
      const url = buildUrl('/api/experience-vendors', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/experience-vendors', { category: 'adventure', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/experience-vendors', { status: 'active', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support offset pagination', async () => {
      const url = buildUrl('/api/experience-vendors', { limit: '5', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
    });
  });

  describe('POST /api/experience-vendors', () => {
    it('should create a new vendor', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          companyName: `Test Vendor ${suffix.slice(-4)}`,
          contactPerson: 'John Doe',
          email: `vendor${suffix.slice(-4)}@test.com`,
          phone: '+919876543210',
          category: 'adventure',
          commissionRate: 15,
          status: 'active',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.companyName).toContain('Test Vendor');
      expect(data.data.commissionRate).toBe(15);
      createdVendorId = data.data.id;
    });

    it('should reject vendor with missing required fields', async () => {
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          companyName: 'Missing Fields Co',
          // missing contactPerson and email
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/experience-vendors', () => {
    it('should update a vendor', async () => {
      if (!createdVendorId) return;
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdVendorId,
          phone: '+911234567890',
          commissionRate: 20,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.commissionRate).toBe(20);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { phone: '000' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent vendor', async () => {
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', phone: '000' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/experience-vendors', () => {
    it('should soft-delete a vendor', async () => {
      if (!createdVendorId) return;
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdVendorId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-vendors');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
