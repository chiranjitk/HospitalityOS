import { describe, it, expect } from 'vitest';
import {
  GET as GETReports,
} from '@/app/api/restaurant-reports/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
} from './test-helpers';

describe('Restaurant Reports API', () => {
  describe('GET /api/restaurant-reports', () => {
    it('should return overview report by default', async () => {
      const url = buildUrl('/api/restaurant-reports', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalRevenue).toBeDefined();
      expect(data.data.totalOrders).toBeDefined();
      expect(data.data.avgOrderValue).toBeDefined();
      expect(data.data.tableOccupancyRate).toBeDefined();
      expect(data.data.dailyRevenue).toBeDefined();
      expect(data.data.topItems).toBeDefined();
    });

    it('should return sales report', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'sales',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.byPaymentMethod).toBeDefined();
      expect(data.data.byOrderType).toBeDefined();
      expect(data.data.taxSummary).toBeDefined();
    });

    it('should return menu report', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'menu',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.itemPopularity).toBeDefined();
      expect(data.data.categoryPerformance).toBeDefined();
      expect(data.data.ghostItems).toBeDefined();
    });

    it('should return tables report', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'tables',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.tableTurnover).toBeDefined();
      expect(data.data.mostUsed).toBeDefined();
      expect(data.data.leastUsed).toBeDefined();
      expect(data.data.avgDiningDuration).toBeDefined();
    });

    it('should return staff report', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'staff',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.ordersPerStaff).toBeDefined();
      expect(data.data.revenuePerStaff).toBeDefined();
      expect(data.data.avgCompletionTime).toBeDefined();
    });

    it('should reject invalid report type', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'invalid_type',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject invalid propertyId', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: '00000000-0000-0000-0000-000000000000',
        type: 'overview',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(400);
    });

    it('should support date range filtering', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'overview',
        startDate: '2024-01-01',
        endDate: '2025-12-31',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalRevenue).toBeDefined();
    });

    it('should support startDate only', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        propertyId: PROPERTY_ID,
        type: 'overview',
        startDate: '2024-06-01',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should work without propertyId for overview', async () => {
      const url = buildUrl('/api/restaurant-reports', {
        type: 'overview',
      });
      const req = await createAuthRequest(url);
      const res = await GETReports(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalOrders).toBeDefined();
    });
  });
});
