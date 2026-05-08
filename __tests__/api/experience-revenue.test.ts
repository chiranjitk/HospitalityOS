import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/experience-revenue/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Experience Revenue API', () => {
  describe('GET /api/experience-revenue', () => {
    it('should return revenue analytics with default date range', async () => {
      const url = buildUrl('/api/experience-revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.totalRevenue).toBeDefined();
      expect(data.data.summary.totalBookings).toBeDefined();
      expect(data.data.summary.avgBookingValue).toBeDefined();
      expect(data.data.summary.cancellationRate).toBeDefined();
    });

    it('should return revenue by experience breakdown', async () => {
      const url = buildUrl('/api/experience-revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.revenueByExperience).toBeDefined();
      expect(Array.isArray(data.data.revenueByExperience)).toBe(true);
      if (data.data.revenueByExperience.length > 0) {
        const item = data.data.revenueByExperience[0];
        expect(item).toHaveProperty('experienceId');
        expect(item).toHaveProperty('experienceName');
        expect(item).toHaveProperty('revenue');
        expect(item).toHaveProperty('bookings');
        expect(item).toHaveProperty('avgBookingValue');
      }
    });

    it('should return status distribution', async () => {
      const url = buildUrl('/api/experience-revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.statusDistribution).toBeDefined();
      expect(Array.isArray(data.data.statusDistribution)).toBe(true);
    });

    it('should return trend data', async () => {
      const url = buildUrl('/api/experience-revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.trendData).toBeDefined();
      expect(Array.isArray(data.data.trendData)).toBe(true);
    });

    it('should return top experiences', async () => {
      const url = buildUrl('/api/experience-revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.topExperiences).toBeDefined();
      expect(Array.isArray(data.data.topExperiences)).toBe(true);
    });

    it('should accept custom date range', async () => {
      const url = buildUrl('/api/experience-revenue', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.dateRange).toBeDefined();
    });

    it('should support groupBy=week', async () => {
      const url = buildUrl('/api/experience-revenue', { groupBy: 'week' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.trendData).toBeDefined();
    });

    it('should filter by experienceId', async () => {
      const url = buildUrl('/api/experience-revenue', {
        experienceId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.revenueByExperience).toEqual([]);
    });
  });
});
