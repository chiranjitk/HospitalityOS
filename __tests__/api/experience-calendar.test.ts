import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/experience-calendar/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Experience Calendar API', () => {
  describe('GET /api/experience-calendar', () => {
    it('should return calendar data for current month', async () => {
      const now = new Date();
      const month = String(now.getMonth() + 1);
      const year = String(now.getFullYear());
      const url = buildUrl('/api/experience-calendar', { month, year });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.month).toBeDefined();
      expect(data.data.year).toBeDefined();
      expect(data.data.bookingsByDate).toBeDefined();
      expect(data.data.dailySummary).toBeDefined();
      expect(data.data.experiences).toBeDefined();
      expect(Array.isArray(data.data.dailySummary)).toBe(true);
      expect(Array.isArray(data.data.experiences)).toBe(true);
    });

    it('should return calendar data with month filter', async () => {
      const url = buildUrl('/api/experience-calendar', { month: '1', year: '2025' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.month).toBe(1);
      expect(data.data.year).toBe(2025);
      // January has 31 days
      expect(data.data.dailySummary.length).toBe(31);
    });

    it('should include daily summary with correct structure', async () => {
      const url = buildUrl('/api/experience-calendar', { month: '1', year: '2025' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const day = data.data.dailySummary[0];
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('totalBookings');
      expect(day).toHaveProperty('totalGuests');
      expect(day).toHaveProperty('totalRevenue');
      expect(day).toHaveProperty('maxCapacity');
      expect(day).toHaveProperty('status');
      expect(['available', 'few_left', 'fully_booked', 'unavailable']).toContain(day.status);
    });

    it('should return bookings grouped by date', async () => {
      const url = buildUrl('/api/experience-calendar', { month: '1', year: '2025' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.data.bookingsByDate).toBe('object');
    });

    it('should return active experiences list', async () => {
      const url = buildUrl('/api/experience-calendar', { month: '1', year: '2025' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data.experiences)).toBe(true);
      if (data.data.experiences.length > 0) {
        expect(data.data.experiences[0]).toHaveProperty('id');
        expect(data.data.experiences[0]).toHaveProperty('name');
        expect(data.data.experiences[0]).toHaveProperty('category');
      }
    });
  });
});
