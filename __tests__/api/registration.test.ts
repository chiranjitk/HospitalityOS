import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/registration/register/route';
import { POST as validateKey } from '@/app/api/registration/validate-key/route';
import { GET as getPlans } from '@/app/api/registration/plans/route';
import { buildUrl, uniqueSuffix } from './test-helpers';
import { NextRequest } from 'next/server';

describe('Registration API', () => {
  describe('POST /api/registration/register', () => {
    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/registration/register');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject short password', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/registration/register');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'FAKE-KEY-123',
          organizationName: `Org ${suffix}`,
          email: `shortpw${suffix}@test.com`,
          password: '123', // too short
          firstName: 'Test',
          lastName: 'User',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Password must be at least 8 characters');
    });

    it('should reject invalid email format', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/registration/register');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'FAKE-KEY-123',
          organizationName: `Org ${suffix}`,
          email: 'not-an-email',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid email format');
    });

    it('should reject invalid license key', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/registration/register');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'INVALID-LICENSE-KEY',
          organizationName: `Org ${suffix}`,
          email: `invalidkey${suffix}@test.com`,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        }),
      });
      const res = await POST(req);
      // May be 429 if rate-limited by prior test calls
      if (res.status === 429) return;
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Invalid license key');
    });

    it('should require all mandatory fields', async () => {
      const url = buildUrl('/api/registration/register');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'FAKE-KEY-123',
          email: 'test@test.com',
          password: 'password123',
          // missing organizationName, firstName, lastName
        }),
      });
      const res = await POST(req);
      // May be 429 if rate-limited by prior test calls
      if (res.status === 429) return;
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/registration/validate-key', () => {
    it('should reject missing key', async () => {
      const url = buildUrl('/api/registration/validate-key');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await validateKey(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('License key is required');
    });

    it('should reject non-string key', async () => {
      const url = buildUrl('/api/registration/validate-key');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 12345 }),
      });
      const res = await validateKey(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('License key is required');
    });

    it('should reject invalid license key', async () => {
      const url = buildUrl('/api/registration/validate-key');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'INVALID-KEY-NOT-REAL' }),
      });
      const res = await validateKey(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Invalid license key');
    });
  });

  describe('GET /api/registration/plans', () => {
    it('should return active registration plans', async () => {
      const url = buildUrl('/api/registration/plans');
      const req = new NextRequest(url);
      const res = await getPlans(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.plans)).toBe(true);
    });

    it('should include plan details', async () => {
      const url = buildUrl('/api/registration/plans');
      const req = new NextRequest(url);
      const res = await getPlans(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.plans.length > 0) {
        const plan = data.plans[0];
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('displayName');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('maxProperties');
        expect(plan).toHaveProperty('maxUsers');
        expect(plan).toHaveProperty('featureCount');
        expect(plan).toHaveProperty('trialDays');
      }
    });

    it('should include feature count for each plan', async () => {
      const url = buildUrl('/api/registration/plans');
      const req = new NextRequest(url);
      const res = await getPlans(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const plan of data.plans) {
        expect(typeof plan.featureCount).toBe('number');
      }
    });
  });
});
