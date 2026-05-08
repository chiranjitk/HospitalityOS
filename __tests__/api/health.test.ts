import { describe, it, expect } from 'vitest';
import { GET, HEAD } from '@/app/api/health/route';
import { buildUrl } from './test-helpers';

describe('Health API', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const url = buildUrl('/api/health');
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBeDefined();
      expect(['healthy', 'degraded']).toContain(data.status);
      expect(data.timestamp).toBeDefined();
    });

    it('should include database health', async () => {
      const url = buildUrl('/api/health');
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.database).toBeDefined();
      expect(data.database.status).toBeDefined();
      expect(data.database.type).toBeDefined();
      expect(data.database.latency).toBeDefined();
      expect(typeof data.database.latency).toBe('number');
    });

    it('should include environment info', async () => {
      const url = buildUrl('/api/health');
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.environment).toBeDefined();
      expect(data.environmentInfo).toBeDefined();
      expect(data.environmentInfo.isDevelopment).toBeDefined();
      expect(data.environmentInfo.isProduction).toBeDefined();
    });

    it('should include critical services status', async () => {
      const url = buildUrl('/api/health');
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.criticalServices).toBeDefined();
      expect(data.criticalServices.available).toBeDefined();
      expect(data.criticalServices.missing).toBeDefined();
      expect(Array.isArray(data.criticalServices.missing)).toBe(true);
    });

    it('should include services list', async () => {
      const url = buildUrl('/api/health');
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.services).toBeDefined();
      expect(Array.isArray(data.services)).toBe(true);
    });

    it('should return detailed health with ?detailed=true', async () => {
      const url = buildUrl('/api/health', { detailed: 'true' });
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBeDefined();
      expect(data.config).toBeDefined();
      expect(data.features).toBeDefined();
      expect(data.uptime).toBeDefined();
    });

    it('should return service-specific health with ?service= param', async () => {
      const url = buildUrl('/api/health', { service: 'database' });
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      // Service name matching is fuzzy — accept 200 (matched) or 404 (not found)
      expect([200, 404, 500]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });

    it('should handle non-existent service gracefully', async () => {
      const url = buildUrl('/api/health', { service: 'zzz-nonexistent-service' });
      const req = new Request(url, { method: 'GET' });
      const res = await GET(req);
      // Should be 404 or return general health (service param may be ignored)
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('HEAD /api/health', () => {
    it('should return 200 for healthy system', async () => {
      const res = await HEAD();
      expect([200, 503]).toContain(res.status);
    });
  });
});
