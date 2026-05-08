import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/brands/route';
import {
  createAuthRequest,
  buildUrl,
  TENANT_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdBrandIds: string[] = [];

describe('Brands API', () => {
  // ─── GET /api/brands ───────────────────────────────────────────

  describe('GET /api/brands', () => {
    it('should return list of brands', async () => {
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // Each brand should have propertyCount
      data.data.forEach((b: any) => {
        expect(b.id).toBeDefined();
        expect(b.name).toBeDefined();
        expect(b.code).toBeDefined();
        expect(typeof b.propertyCount).toBe('number');
      });
    });

    it('should filter brands by status', async () => {
      const url = buildUrl('/api/brands', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.forEach((b: any) => {
        expect(b.status).toBe('active');
      });
    });
  });

  // ─── POST /api/brands ──────────────────────────────────────────

  describe('POST /api/brands', () => {
    it('should create a new brand', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Brand ${suffix}`,
          code: `BR${suffix.slice(-6).toUpperCase()}`,
          description: 'Test brand description',
          primaryColor: '#FF5733',
          secondaryColor: '#33FF57',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Brand');
      expect(data.data.code).toContain('BR');
      expect(data.data.status).toBe('active');
      createdBrandIds.push(data.data.id);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { code: 'NONAME' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Name and code');
    });

    it('should reject creation without code', async () => {
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'No Code Brand' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation with invalid code format', async () => {
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Code',
          code: 'invalid-code-with-dashes!',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('alphanumeric');
    });

    it('should reject creation with code > 10 chars', async () => {
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Long Code',
          code: 'ABCDEFGHIJKL',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation with duplicate code', async () => {
      const suffix = uniqueSuffix();
      const code = `DUP${suffix.slice(-6).toUpperCase()}`;

      // Create first
      const createUrl = buildUrl('/api/brands');
      const firstReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `First Brand ${suffix}`, code },
      });
      const firstRes = await POST(firstReq as any);
      const firstData = await firstRes.json();
      if (firstRes.status === 201) createdBrandIds.push(firstData.data.id);

      // Try duplicate
      const secondReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `Second Brand ${suffix}`, code },
      });
      const secondRes = await POST(secondReq as any);
      expect(secondRes.status).toBe(400);
      const secondData = await secondRes.json();
      expect(secondData.error.code).toBe('DUPLICATE_CODE');
    });

    it('should reject creation with invalid status', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Status ${suffix}`,
          code: `BS${suffix.slice(-6).toUpperCase()}`,
          status: 'pending',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should create brand with inactive status', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/brands');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Inactive Brand ${suffix}`,
          code: `IB${suffix.slice(-6).toUpperCase()}`,
          status: 'inactive',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.status).toBe('inactive');
      createdBrandIds.push(data.data.id);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdBrandIds) {
      try {
        await db.brand.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
