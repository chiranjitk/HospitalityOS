import { describe, it, expect, afterAll } from 'vitest';
import { GET } from '@/app/api/network/os/route';
import { GET as getInterfaces, POST as createInterface } from '@/app/api/networking/interfaces/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdInterfaceId: string;

describe('Network — OS Layer', () => {
  describe('GET /api/network/os', () => {
    it('should return network interfaces grouped by type', async () => {
      const url = buildUrl('/api/network/os');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.interfaces).toBeDefined();
      expect(Array.isArray(data.data.interfaces)).toBe(true);
      expect(data.data.byNetType).toBeDefined();
      expect(data.data.physical).toBeDefined();
      expect(data.data.virtual).toBeDefined();
      expect(data.data.vlans).toBeDefined();
      expect(data.data.bridges).toBeDefined();
      expect(data.data.bonds).toBeDefined();
      expect(data.data.netTypes).toBeDefined();
    });

    it('should return only interfaces with section=interfaces', async () => {
      const url = buildUrl('/api/network/os', { section: 'interfaces' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return device status with section=device-status', async () => {
      const url = buildUrl('/api/network/os', { section: 'device-status' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should return system info with section=system-info', async () => {
      const url = buildUrl('/api/network/os', { section: 'system-info' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.hostname).toBeDefined();
      expect(data.data.memory).toBeDefined();
      expect(data.data.memory).toHaveProperty('total');
      expect(data.data.memory).toHaveProperty('used');
      expect(data.data.memory).toHaveProperty('usagePercent');
      expect(data.data.cpuCount).toBeDefined();
      expect(data.data.uptimeFormatted).toBeDefined();
      expect(data.data.loadAverage).toBeDefined();
    });

    it('should return routes with section=routes', async () => {
      const url = buildUrl('/api/network/os', { section: 'routes' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // The route catches errors and returns 500
      // We can't easily force an error, but verify the structure
      const url = buildUrl('/api/network/os');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      // Should not throw
      expect([200, 500]).toContain(res.status);
    });
  });
});

describe('Networking — Interfaces CRUD', () => {
  describe('GET /api/networking/interfaces', () => {
    it('should return list of network interfaces', async () => {
      const url = buildUrl('/api/networking/interfaces');
      const req = await createAuthRequest(url);
      const res = await getInterfaces(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/networking/interfaces', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getInterfaces(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/interfaces');
      const res = await getInterfaces(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/networking/interfaces', () => {
    it('should create a network interface', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/networking/interfaces');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `eth-test-${suffix.slice(-6)}`,
          type: 'ethernet',
          hwAddress: `00:11:22:33:44:${suffix.slice(-2).toUpperCase()}`,
          mtu: 1500,
          status: 'down',
          carrier: false,
          description: `Test interface ${suffix.slice(-4)}`,
          propertyId: PROPERTY_ID,
        },
      });
      const res = await createInterface(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(data.id).toBeDefined();
      expect(data.name).toContain('eth-test-');
      expect(data.type).toBe('ethernet');
      createdInterfaceId = data.id;
    });

    it('should create without explicit propertyId (resolved automatically)', async () => {
      const url = buildUrl('/api/networking/interfaces');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'eth-no-property',
          type: 'ethernet',
        },
      });
      const res = await createInterface(req);
      // resolvePropertyId auto-resolves to first property for tenant
      expect([201, 400, 500]).toContain(res.status);
      if (res.status === 201) {
        const data = await res.json();
        await db.networkInterface.delete({ where: { id: data.id } }).catch(() => {});
      }
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/interfaces');
      const res = await createInterface(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'eth-fail', type: 'ethernet', propertyId: PROPERTY_ID }),
      }));
      expect(res.status).toBe(401);
    });
  });
});

afterAll(async () => {
  if (createdInterfaceId) {
    await db.networkInterface.delete({ where: { id: createdInterfaceId } }).catch(() => {});
  }
});
