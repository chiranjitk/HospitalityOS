import { describe, it, expect } from 'vitest';
import { GET, PUT } from '@/app/api/no-show/settings/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';

describe('No-Show Settings API', () => {
  describe('GET /api/no-show/settings', () => {
    it('should return no-show settings for a property', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('propertyId');
      expect(data.data).toHaveProperty('propertyName');
    });

    it('should require propertyId query parameter', async () => {
      const url = buildUrl('/api/no-show/settings');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent property', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should include default settings fields', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // The getNoShowSettings helper returns settings; check for expected fields
      expect(data.data).toBeDefined();
      // Settings may have noShowBufferHours, autoProcessNoShows, noShowNotificationEnabled
      expect(data.data.propertyId).toBe(PROPERTY_ID);
    });
  });

  describe('PUT /api/no-show/settings', () => {
    it('should update no-show settings', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          noShowBufferHours: 4,
          autoProcessNoShows: true,
          noShowNotificationEnabled: true,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('No-show settings updated');
      expect(data.data.propertyId).toBe(PROPERTY_ID);
    });

    it('should require propertyId query parameter', async () => {
      const url = buildUrl('/api/no-show/settings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowBufferHours: 2 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent property', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowBufferHours: 2 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject invalid noShowBufferHours (negative)', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowBufferHours: -1 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details).toBeDefined();
    });

    it('should reject invalid noShowBufferHours (over 24)', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowBufferHours: 25 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid autoProcessNoShows (string)', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { autoProcessNoShows: 'yes' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid noShowNotificationEnabled (number)', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowNotificationEnabled: 1 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-object body', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: 'not an object',
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should partially update settings', async () => {
      const url = buildUrl('/api/no-show/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { noShowBufferHours: 6 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.noShowBufferHours).toBe(6);
    });
  });
});
