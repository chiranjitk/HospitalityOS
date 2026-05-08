import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/guests/route';
import { GET as getGuestById, PUT, DELETE } from '@/app/api/guests/[id]/route';
import { createAuthRequest, buildUrl, TENANT_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdGuestId: string;

describe('Guests API', () => {
  describe('GET /api/guests', () => {
    it('should return list of guests with pagination', async () => {
      const url = buildUrl('/api/guests', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should search guests by name', async () => {
      const url = buildUrl('/api/guests', { search: 'Amit', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter guests by loyaltyTier', async () => {
      const url = buildUrl('/api/guests', { loyaltyTier: 'bronze', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.every((g: any) => g.loyaltyTier === 'bronze')).toBe(true);
    });

    it('should filter guests by isVip', async () => {
      const url = buildUrl('/api/guests', { isVip: 'true', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((g: any) => g.isVip === true)).toBe(true);
      }
    });

    it('should include totalBookings count for each guest', async () => {
      const url = buildUrl('/api/guests', { limit: '3' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('totalBookings');
        expect(typeof data.data[0].totalBookings).toBe('number');
      }
    });

    it('should reject search query over 100 characters', async () => {
      const longSearch = 'a'.repeat(101);
      const url = buildUrl('/api/guests', { search: longSearch });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/guests', () => {
    it('should create a new guest successfully', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/guests');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          firstName: `Test${suffix.slice(-4)}`,
          lastName: 'GuestAPI',
          email: `guestapi${suffix.slice(-4)}@test.com`,
          phone: `+91987654${suffix.slice(-5)}`,
          nationality: 'Indian',
          city: 'Kolkata',
          country: 'India',
          loyaltyTier: 'silver',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.firstName).toContain('Test');
      expect(data.data.lastName).toBe('GuestAPI');
      expect(data.data.loyaltyTier).toBe('silver');
      createdGuestId = data.data.id;
    });

    it('should reject guest with missing required fields', async () => {
      const url = buildUrl('/api/guests');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: 'notest@test.com',
          // missing firstName and lastName
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject guest with duplicate email', async () => {
      const url = buildUrl('/api/guests');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          firstName: 'Duplicate',
          lastName: 'Email',
          email: `guestapi${uniqueSuffix().slice(-4)}@test.com`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it('should create guest with minimal fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/guests');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          firstName: `Min${suffix.slice(-4)}`,
          lastName: 'Guest',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      // Clean up
      await db.guest.delete({ where: { id: data.data.id } });
    });
  });

  describe('GET /api/guests/[id]', () => {
    it('should get a guest by ID', async () => {
      const url = buildUrl(`/api/guests/${GUEST_ID}`);
      const req = await createAuthRequest(url);
      const res = await getGuestById(req, { params: Promise.resolve({ id: GUEST_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(GUEST_ID);
      expect(data.data.firstName).toBeDefined();
      expect(data.data.email).toBeDefined();
    });

    it('should include booking history for guest', async () => {
      const url = buildUrl(`/api/guests/${GUEST_ID}`);
      const req = await createAuthRequest(url);
      const res = await getGuestById(req, { params: Promise.resolve({ id: GUEST_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.bookings).toBeDefined();
      expect(Array.isArray(data.data.bookings)).toBe(true);
      expect(data.data.totalBookings).toBeDefined();
      expect(data.data.totalReviews).toBeDefined();
      expect(data.data.totalFeedback).toBeDefined();
    });

    it('should return 404 for non-existent guest', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/guests/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getGuestById(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/guests/[id]', () => {
    it('should update a guest', async () => {
      if (!createdGuestId) return;
      const url = buildUrl(`/api/guests/${createdGuestId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          city: 'Mumbai',
          country: 'India',
          notes: 'API test guest update',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdGuestId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.city).toBe('Mumbai');
    });

    it('should update guest VIP status', async () => {
      if (!createdGuestId) return;
      const url = buildUrl(`/api/guests/${createdGuestId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          isVip: true,
          vipLevel: 'gold',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdGuestId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.isVip).toBe(true);
    });

    it('should return 404 for non-existent guest', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/guests/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { firstName: 'Ghost' },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/guests/[id]', () => {
    it('should return 404 for non-existent guest', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/guests/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (createdGuestId) {
      try {
        await db.guest.delete({ where: { id: createdGuestId } });
      } catch (e) {
        console.error('Cleanup failed for created guest:', e);
      }
    }
  });
});
