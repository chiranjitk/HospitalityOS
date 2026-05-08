import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/housekeeping/dashboard/route';
import { createAuthRequest, buildUrl, PROPERTY_ID } from './test-helpers';

describe('Housekeeping Dashboard API', () => {
  describe('GET /api/housekeeping/dashboard', () => {
    it('should return dashboard data for tenant', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should include room status counts', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveProperty('roomsToClean');
      expect(data.data).toHaveProperty('roomsInProgress');
      expect(data.data).toHaveProperty('roomsInspected');
      expect(data.data).toHaveProperty('maintenanceRequests');
      expect(typeof data.data.roomsToClean).toBe('number');
      expect(typeof data.data.roomsInProgress).toBe('number');
    });

    it('should include task breakdown by cleaning type', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.taskBreakdown).toBeDefined();
      expect(data.data.taskBreakdown).toHaveProperty('checkout');
      expect(data.data.taskBreakdown).toHaveProperty('stayover');
      expect(data.data.taskBreakdown).toHaveProperty('touchup');
      expect(typeof data.data.taskBreakdown.checkout).toBe('number');
      expect(typeof data.data.taskBreakdown.stayover).toBe('number');
      expect(typeof data.data.taskBreakdown.touchup).toBe('number');
    });

    it('should include recent tasks', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.recentTasks).toBeDefined();
      expect(Array.isArray(data.data.recentTasks)).toBe(true);
      expect(data.data.recentTasks.length).toBeLessThanOrEqual(10);
    });

    it('should include task details in recent tasks', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.recentTasks.length > 0) {
        const task = data.data.recentTasks[0];
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('roomNumber');
        expect(task).toHaveProperty('type');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('assignedTo');
      }
    });

    it('should filter by propertyId when provided', async () => {
      const url = buildUrl('/api/housekeeping/dashboard', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      // The counts should be scoped to the property
      expect(typeof data.data.roomsToClean).toBe('number');
    });

    it('should return zero counts for non-existent property', async () => {
      const url = buildUrl('/api/housekeeping/dashboard', { propertyId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.roomsToClean).toBe(0);
      expect(data.data.roomsInProgress).toBe(0);
      expect(data.data.roomsInspected).toBe(0);
      expect(data.data.recentTasks).toEqual([]);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/housekeeping/dashboard');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});
