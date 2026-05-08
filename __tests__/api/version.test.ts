import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/version/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Version API', () => {
  describe('GET /api/version', () => {
    it('should return version information', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should include version number', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.currentVersion).toBeDefined();
      expect(typeof data.data.currentVersion).toBe('string');
    });

    it('should include deprecation status', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.deprecationStatus).toBeDefined();
      expect(typeof data.data.deprecationStatus).toBe('object');
    });

    it('should include current version details', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.currentVersionDetails).toBeDefined();
    });

    it('should include server time', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.serverTime).toBeDefined();
      const serverDate = new Date(data.data.serverTime);
      expect(serverDate.getTime()).not.toBeNaN();
    });

    it('should include versioning styles', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.versioningStyles).toBeDefined();
      expect(data.data.versioningStyles.urlBased).toBeDefined();
      expect(data.data.versioningStyles.headerBased).toBeDefined();
      expect(data.data.versioningStyles.urlBased.supported).toBe(true);
      expect(data.data.versioningStyles.headerBased.supported).toBe(true);
    });

    it('should include links', async () => {
      const url = buildUrl('/api/version');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.links).toBeDefined();
      expect(data.data.links.self).toBeDefined();
      expect(data.data.links.health).toBeDefined();
    });

    it('should work without authentication', async () => {
      const url = buildUrl('/api/version');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('OPTIONS /api/version', () => {
    it('should return CORS headers', async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(204);
    });
  });
});
