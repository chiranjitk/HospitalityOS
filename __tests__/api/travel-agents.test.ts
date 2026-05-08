import { describe, it, expect, afterAll } from 'vitest';
import { GET as listTravelAgents, POST as createTravelAgent } from '@/app/api/travel-agents/route';
import { GET as getTravelAgent, PUT as updateTravelAgent, DELETE as deleteTravelAgent } from '@/app/api/travel-agents/[id]/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdAgentIds: string[] = [];

describe('Travel Agents API', () => {
  // ─── GET /api/travel-agents ────────────────────────────────────

  describe('GET /api/travel-agents', () => {
    it('should return list of travel agents', async () => {
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
      expect(typeof data.pagination.limit).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/travel-agents', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/travel-agents', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.forEach((a: any) => {
        expect(a.status).toBe('active');
      });
    });

    it('should filter by isActive', async () => {
      const url = buildUrl('/api/travel-agents', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.forEach((a: any) => {
        expect(a.isActive).toBe(true);
      });
    });

    it('should search by agency name or code', async () => {
      const url = buildUrl('/api/travel-agents', { search: 'travel' });
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should respect pagination', async () => {
      const url = buildUrl('/api/travel-agents', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await listTravelAgents(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── POST /api/travel-agents ───────────────────────────────────

  describe('POST /api/travel-agents', () => {
    it('should create a new travel agent', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: `Test Agency ${suffix}`,
          code: `TA${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
          contactPerson: 'John Doe',
          email: `agency${suffix.slice(-4)}@test.com`,
          phone: '+919999999999',
          city: 'Kolkata',
          country: 'India',
          commissionRate: 10,
          commissionType: 'percentage',
          creditLimit: 50000,
          paymentTerms: 'net_30',
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.agencyName).toContain('Test Agency');
      expect(data.data.code).toContain('TA');
      expect(data.data.status).toBe('active');
      expect(data.data.isActive).toBe(true);
      expect(data.data.commissionRate).toBe(10);
      expect(data.data.currentBalance).toBe(0);
      createdAgentIds.push(data.data.id);
    });

    it('should create agent with flat commission type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: `Flat Commission ${suffix}`,
          code: `FC${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
          commissionType: 'flat',
          commissionRate: 50,
          paymentTerms: 'cod',
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.commissionType).toBe('flat');
      expect(data.data.commissionRate).toBe(50);
      expect(data.data.paymentTerms).toBe('cod');
      createdAgentIds.push(data.data.id);
    });

    it('should reject creation without agency name', async () => {
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          code: 'NONAME',
          propertyId: PROPERTY_ID,
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without code', async () => {
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: 'No Code Agency',
          propertyId: PROPERTY_ID,
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: `No Property ${suffix}`,
          code: `NP${suffix.slice(-6).toUpperCase()}`,
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation with non-existent property', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: `Bad Property ${suffix}`,
          code: `BP${suffix.slice(-6).toUpperCase()}`,
          propertyId: '00000000-0000-0000-0000-000000000000',
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject creation with duplicate code', async () => {
      const suffix = uniqueSuffix();
      const code = `DUP${suffix.slice(-6).toUpperCase()}`;

      // Create first
      const createUrl = buildUrl('/api/travel-agents');
      const firstReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          agencyName: `First ${suffix}`,
          code,
          propertyId: PROPERTY_ID,
        },
      });
      const firstRes = await createTravelAgent(firstReq as any);
      const firstData = await firstRes.json();
      if (firstRes.status === 201) createdAgentIds.push(firstData.data.id);

      // Try duplicate
      const secondReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          agencyName: `Second ${suffix}`,
          code,
          propertyId: PROPERTY_ID,
        },
      });
      const secondRes = await createTravelAgent(secondReq as any);
      expect(secondRes.status).toBe(409);
    });

    it('should reject invalid email format', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/travel-agents');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          agencyName: `Bad Email ${suffix}`,
          code: `BE${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
          email: 'not-an-email',
        },
      });
      const res = await createTravelAgent(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/travel-agents/[id] ───────────────────────────────

  describe('GET /api/travel-agents/[id]', () => {
    it('should return a specific travel agent', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/travel-agents');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          agencyName: `Get Test ${suffix}`,
          code: `GT${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
        },
      });
      const createRes = await createTravelAgent(createReq as any);
      const createData = await createRes.json();
      const agentId = createData.data.id;
      createdAgentIds.push(agentId);

      // Get by ID
      const getUrl = buildUrl(`/api/travel-agents/${agentId}`);
      const req = await createAuthRequest(getUrl);
      const res = await getTravelAgent(req as any, { params: Promise.resolve({ id: agentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(agentId);
      expect(data.data.agencyName).toContain('Get Test');
    });

    it('should return 404 for non-existent agent', async () => {
      const getUrl = buildUrl('/api/travel-agents/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(getUrl);
      const res = await getTravelAgent(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/travel-agents/[id] ───────────────────────────────

  describe('PUT /api/travel-agents/[id]', () => {
    it('should update a travel agent', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/travel-agents');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          agencyName: `To Update ${suffix}`,
          code: `TU${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
        },
      });
      const createRes = await createTravelAgent(createReq as any);
      const createData = await createRes.json();
      const agentId = createData.data.id;
      createdAgentIds.push(agentId);

      // Update
      const url = buildUrl(`/api/travel-agents/${agentId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          agencyName: `Updated ${suffix}`,
          commissionRate: 15,
          notes: 'Updated notes',
        },
      });
      const res = await updateTravelAgent(req as any, { params: Promise.resolve({ id: agentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.agencyName).toContain('Updated');
      expect(data.data.commissionRate).toBe(15);
    });

    it('should return 404 for non-existent agent', async () => {
      const url = buildUrl('/api/travel-agents/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { agencyName: 'Ghost' },
      });
      const res = await updateTravelAgent(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/travel-agents/[id] ────────────────────────────

  describe('DELETE /api/travel-agents/[id]', () => {
    it('should delete a travel agent', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/travel-agents');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          agencyName: `To Delete ${suffix}`,
          code: `TD${suffix.slice(-6).toUpperCase()}`,
          propertyId: PROPERTY_ID,
        },
      });
      const createRes = await createTravelAgent(createReq as any);
      const createData = await createRes.json();
      const agentId = createData.data.id;

      // Delete
      const url = buildUrl(`/api/travel-agents/${agentId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteTravelAgent(req as any, { params: Promise.resolve({ id: agentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent agent', async () => {
      const url = buildUrl('/api/travel-agents/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteTravelAgent(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });
      expect(res.status).toBe(404);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdAgentIds) {
      try {
        await db.travelAgent.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
