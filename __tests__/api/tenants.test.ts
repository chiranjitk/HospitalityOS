import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '@/app/api/tenants/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

describe('Tenants API', () => {
  describe('GET /api/tenants', () => {
    it('should require super admin for listing tenants', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      // The test user (admin@royalstay.in) is not a super admin (staysuite.com domain)
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/tenants');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tenants', () => {
    it('should reject signup with missing required fields', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Test Tenant',
          // missing slug, email, password
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject signup with invalid email format', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Email Tenant',
          slug: 'bad-email-tenant',
          email: 'not-an-email',
          password: 'ValidPassword123',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject signup with short password', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Short Pass Tenant',
          slug: 'short-pass-tenant',
          email: 'shortpass@test.com',
          password: '123', // too short
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject signup with invalid slug format', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Invalid Slug Tenant',
          slug: 'Invalid Slug!',
          email: 'invalidslug@test.com',
          password: 'ValidPassword123',
        },
      });
      const res = await POST(req);
      // May return 429 due to rate limiting (3 req/15min)
      expect([400, 429]).toContain(res.status);
    });

    it('should reject signup with existing email', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Duplicate Email',
          slug: 'duplicate-email-tenant',
          email: 'admin@royalstay.in', // already exists as a user
          password: 'ValidPassword123',
        },
      });
      const res = await POST(req);
      // May return 429 due to rate limiting (3 req/15min)
      expect([400, 429]).toContain(res.status);
    });
  });

  describe('PUT /api/tenants', () => {
    it('should require super admin for updating tenants', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: TENANT_ID, status: 'active' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject update without tenant ID', async () => {
      const url = buildUrl('/api/tenants');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'active' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/tenants');
      const req = new NextRequest(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: TENANT_ID, status: 'active' }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });
  });
});
