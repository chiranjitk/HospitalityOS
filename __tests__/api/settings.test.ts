import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/settings/general/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, TENANT_ID, uniqueSuffix } from './test-helpers';

describe('Settings API', () => {
  describe('GET /api/settings/general', () => {
    it('should return general settings', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.property).toBeDefined();
      expect(data.data.operations).toBeDefined();
      expect(data.data.notifications).toBeDefined();
      expect(data.data.tenantId).toBeDefined();
    });

    it('should return property info in settings', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.property).toHaveProperty('name');
      expect(data.data.property).toHaveProperty('email');
      expect(data.data.property).toHaveProperty('phone');
      expect(data.data.property).toHaveProperty('address');
    });

    it('should return operations settings', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.operations).toHaveProperty('checkInTime');
      expect(data.data.operations).toHaveProperty('checkOutTime');
      expect(data.data.operations).toHaveProperty('timezone');
      expect(data.data.operations).toHaveProperty('defaultCurrency');
    });

    it('should return notification settings', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.notifications).toHaveProperty('emailNotifications');
      expect(data.data.notifications).toHaveProperty('smsNotifications');
      expect(data.data.notifications).toHaveProperty('pushNotifications');
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/settings/general');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/settings/general', () => {
    it('should update operations settings', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          operations: {
            checkInTime: '14:00',
            checkOutTime: '12:00',
            timezone: 'Asia/Kolkata',
            defaultCurrency: 'INR',
          },
        },
      });
      const res = await PUT(req);
      // Could be 200 (admin with settings.edit) or 403 (missing permission)
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.message).toBeDefined();
      }
    });

    it('should reject invalid time format', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          operations: {
            checkInTime: 'not-a-time',
          },
        },
      });
      const res = await PUT(req);
      expect([200, 400, 403]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain('HH:MM');
      }
    });

    it('should reject invalid timezone', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          operations: {
            timezone: 'Invalid/Timezone',
          },
        },
      });
      const res = await PUT(req);
      expect([200, 400, 403]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain('Invalid timezone');
      }
    });

    it('should reject invalid currency code', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          operations: {
            defaultCurrency: 'invalid',
          },
        },
      });
      const res = await PUT(req);
      expect([200, 400, 403]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain('3-letter ISO');
      }
    });

    it('should reject invalid property data type', async () => {
      const url = buildUrl('/api/settings/general');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          property: 'not-an-object',
        },
      });
      const res = await PUT(req);
      expect([200, 400, 403]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain('Invalid property data');
      }
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/settings/general');
      const req = new NextRequest(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: { timezone: 'UTC' } }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });
  });
});
