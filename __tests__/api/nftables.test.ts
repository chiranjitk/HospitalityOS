import { describe, it, expect } from 'vitest';
import { GET, POST, PUT, DELETE, PATCH } from '@/app/api/nftables/[...path]/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('NFTables — Firewall Proxy', () => {
  describe('GET /api/nftables/gui-rules', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/gui-rules');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      // nftables-service runs on port 3013, not available in sandbox
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(data.error.message).toMatch(/nftables|firewall|running/i);
    });
  });

  describe('GET /api/nftables/chain-architecture', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/chain-architecture');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/nftables/port-forwards', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/port-forwards');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/nftables/rate-limits', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/rate-limits');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/nftables/flush-gui', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/flush-gui');
      const req = await createAuthRequest(url, { method: 'POST' });
      const res = await POST(req);
      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/nftables/gui-rules', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/gui-rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          chain: 'forward',
          rule: 'accept',
          comment: 'test rule',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(503);
    });
  });

  describe('PATCH /api/nftables/gui-rules/:id/toggle', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/gui-rules/some-id/toggle');
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { enabled: false },
      });
      const res = await PATCH(req);
      expect(res.status).toBe(503);
    });
  });

  describe('PUT /api/nftables/gui-rules/:id', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/gui-rules/some-id');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { enabled: false },
      });
      const res = await PUT(req);
      expect(res.status).toBe(503);
    });
  });

  describe('DELETE /api/nftables/gui-rules/:id', () => {
    it('should return 503 when nftables service is offline', async () => {
      const url = buildUrl('/api/nftables/gui-rules/some-id');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/nftables (root)', () => {
    it('should return 503 for root path', async () => {
      const url = buildUrl('/api/nftables');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(503);
    });
  });

  describe('Content-Type verification', () => {
    it('should return JSON content type', async () => {
      const url = buildUrl('/api/nftables/gui-rules');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });
});
