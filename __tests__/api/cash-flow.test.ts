import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/financials/cash-flow/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

const createdForecastIds: string[] = [];

describe('Cash Flow API', () => {
  describe('GET /api/financials/cash-flow', () => {
    it('should return cash flow forecasts for current year', async () => {
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.aggregates).toBeDefined();
      expect(typeof data.aggregates.totalInflow).toBe('number');
      expect(typeof data.aggregates.totalOutflow).toBe('number');
      expect(typeof data.aggregates.netCashFlow).toBe('number');
      expect(data.aggregates.year).toBe(new Date().getFullYear());
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/financials/cash-flow', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.aggregates).toBeDefined();
    });

    it('should filter by year', async () => {
      const url = buildUrl('/api/financials/cash-flow', { year: '2024' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.aggregates.year).toBe(2024);
    });

    it('should filter by forecastType', async () => {
      const url = buildUrl('/api/financials/cash-flow', { forecastType: 'projected' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // All returned forecasts should have the requested type
      for (const f of data.data) {
        expect(f.forecastType).toBe('projected');
      }
    });

    it('should compute netCashFlow as totalInflow minus totalOutflow', async () => {
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.aggregates.netCashFlow).toBe(
        data.aggregates.totalInflow - data.aggregates.totalOutflow,
      );
    });

    it('should return forecasts ordered by period ascending', async () => {
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      if (data.data.length >= 2) {
        const periods = data.data.map((f: any) => new Date(f.period).getTime());
        for (let i = 1; i < periods.length; i++) {
          expect(periods[i]).toBeGreaterThanOrEqual(periods[i - 1]);
        }
      }
    });
  });

  describe('POST /api/financials/cash-flow', () => {
    it('should create a cash flow forecast', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          period: `2024-${suffix.slice(-2)}-01T00:00:00Z`,
          openingBalance: 50000,
          totalInflow: 120000,
          totalOutflow: 80000,
          roomRevenue: 80000,
          fbRevenue: 25000,
          otherRevenue: 15000,
          payrollExpense: 40000,
          opexExpense: 30000,
          capexExpense: 10000,
          forecastType: 'projected',
          notes: `Test forecast ${suffix}`,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.openingBalance).toBe(50000);
      expect(data.data.totalInflow).toBe(120000);
      expect(data.data.totalOutflow).toBe(80000);
      expect(data.data.netCashFlow).toBe(40000);
      expect(data.data.closingBalance).toBe(90000);
      expect(data.data.roomRevenue).toBe(80000);
      expect(data.data.fbRevenue).toBe(25000);
      expect(data.data.forecastType).toBe('projected');
      createdForecastIds.push(data.data.id);
    });

    it('should create forecast with actual type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          period: `2024-${suffix.slice(-2)}-01T00:00:00Z`,
          openingBalance: 10000,
          totalInflow: 50000,
          totalOutflow: 35000,
          forecastType: 'actual',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.forecastType).toBe('actual');
      expect(data.data.netCashFlow).toBe(15000);
      expect(data.data.closingBalance).toBe(25000);
      createdForecastIds.push(data.data.id);
    });

    it('should upsert forecast on duplicate tenant+property+period+type', async () => {
      const periodStr = '2025-03-01T00:00:00Z';
      // First create
      const url = buildUrl('/api/financials/cash-flow');
      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: {
          period: periodStr,
          openingBalance: 20000,
          totalInflow: 60000,
          totalOutflow: 40000,
          forecastType: 'adjusted',
        },
      });
      const res1 = await POST(req1 as any);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      createdForecastIds.push(data1.data.id);
      const originalId = data1.data.id;

      // Upsert with same composite key
      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: {
          period: periodStr,
          openingBalance: 25000,
          totalInflow: 70000,
          totalOutflow: 40000,
          forecastType: 'adjusted',
        },
      });
      const res2 = await POST(req2 as any);
      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      expect(data2.data.id).toBe(originalId);
      expect(data2.data.openingBalance).toBe(25000);
      expect(data2.data.totalInflow).toBe(70000);
    });

    it('should reject forecast without period', async () => {
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          openingBalance: 10000,
          totalInflow: 50000,
          totalOutflow: 35000,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject negative values', async () => {
      const url = buildUrl('/api/financials/cash-flow');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          period: '2024-07-01T00:00:00Z',
          openingBalance: -100,
          totalInflow: 50000,
          totalOutflow: 35000,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  afterAll(async () => {
    for (const id of createdForecastIds) {
      await db.cashFlowForecast.delete({ where: { id } }).catch(() => {});
    }
  });
});
