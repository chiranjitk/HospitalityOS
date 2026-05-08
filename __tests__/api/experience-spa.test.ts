import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/experience/spa/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Experience Spa API', () => {
  describe('GET /api/experience/spa', () => {
    it('should return spa & wellness data', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include appointments array', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.data.appointments).toBeDefined();
      expect(Array.isArray(data.data.appointments)).toBe(true);
      expect(data.data.appointments.length).toBeGreaterThan(0);
    });

    it('should include treatments catalog', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.data.treatments).toBeDefined();
      expect(Array.isArray(data.data.treatments)).toBe(true);
      expect(data.data.treatments.length).toBeGreaterThan(0);
      // Check treatment structure
      const t = data.data.treatments[0];
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('category');
      expect(t).toHaveProperty('duration');
      expect(t).toHaveProperty('price');
    });

    it('should include therapists list', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.data.therapists).toBeDefined();
      expect(Array.isArray(data.data.therapists)).toBe(true);
      expect(data.data.therapists.length).toBeGreaterThan(0);
    });

    it('should include revenue stats', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.data.revenueStats).toBeDefined();
      expect(data.data.revenueStats.today).toBeDefined();
      expect(data.data.revenueStats.thisWeek).toBeDefined();
      expect(data.data.revenueStats.thisMonth).toBeDefined();
      expect(data.data.revenueStats.byCategory).toBeDefined();
    });

    it('should include top-level stats', async () => {
      const url = buildUrl('/api/experience/spa');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats.todayBookings).toBeDefined();
      expect(data.stats.todayRevenue).toBeDefined();
      expect(data.stats.totalTreatments).toBeDefined();
      expect(data.stats.totalTherapists).toBeDefined();
      expect(data.stats.onDutyTherapists).toBeDefined();
    });

    it('should filter appointments by status', async () => {
      const url = buildUrl('/api/experience/spa', { status: 'confirmed' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.data.appointments.forEach((a: any) => {
        expect(a.status).toBe('confirmed');
      });
    });

    it('should filter appointments by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const url = buildUrl('/api/experience/spa', { date: today });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
