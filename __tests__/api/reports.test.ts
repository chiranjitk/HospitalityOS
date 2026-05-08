import { describe, it, expect, afterAll } from 'vitest';
import { GET } from '@/app/api/reports/revenue/route';
import { GET as GETOccupancy } from '@/app/api/reports/occupancy/route';
import { GET as GETScheduled, POST as POSTScheduled } from '@/app/api/reports/scheduled/route';
import { GET as GETExport } from '@/app/api/reports/export/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

const createdReportIds: string[] = [];

describe('Reports API', () => {
  // ─── Revenue Report ───────────────────────────────────────────
  describe('GET /api/reports/revenue', () => {
    it('should return revenue report with default date range (last 30 days)', async () => {
      const url = buildUrl('/api/reports/revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.revenueData)).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(typeof data.data.summary.totalRevenue).toBe('number');
      expect(typeof data.data.summary.totalBookings).toBe('number');
      expect(typeof data.data.summary.totalPayments).toBe('number');
      expect(typeof data.data.summary.avgDailyRevenue).toBe('number');
      expect(typeof data.data.summary.goppar).toBe('number');
      expect(typeof data.data.summary.trevpar).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/reports/revenue', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.revenueData)).toBe(true);
    });

    it('should filter by custom date range', async () => {
      const url = buildUrl('/api/reports/revenue', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.revenueData)).toBe(true);
    });

    it('should support monthly granularity', async () => {
      const url = buildUrl('/api/reports/revenue', { granularity: 'monthly' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.revenueData)).toBe(true);
    });

    it('should return revenueBySource breakdown', async () => {
      const url = buildUrl('/api/reports/revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.data.revenueBySource).toBeDefined();
      expect(Array.isArray(data.data.revenueBySource)).toBe(true);
    });

    it('should return revenueByRoomType breakdown', async () => {
      const url = buildUrl('/api/reports/revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.data.revenueByRoomType).toBeDefined();
      expect(Array.isArray(data.data.revenueByRoomType)).toBe(true);
    });

    it('should calculate revenueChange vs previous period', async () => {
      const url = buildUrl('/api/reports/revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(typeof data.data.summary.revenueChange).toBe('number');
    });

    it('should apply operatingExpenses parameter', async () => {
      const url = buildUrl('/api/reports/revenue', { operatingExpenses: '25000' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.data.summary.operatingExpenses).toBe(25000);
      expect(data.data.summary.grossOperatingProfit).toBeDefined();
    });

    it('should return revenueData sorted by date ascending', async () => {
      const url = buildUrl('/api/reports/revenue');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      if (data.data.revenueData.length >= 2) {
        for (let i = 1; i < data.data.revenueData.length; i++) {
          expect(data.data.revenueData[i].date >= data.data.revenueData[i - 1].date).toBe(true);
        }
      }
    });
  });

  // ─── Occupancy Report ─────────────────────────────────────────
  describe('GET /api/reports/occupancy', () => {
    it('should return occupancy report with default date range', async () => {
      const url = buildUrl('/api/reports/occupancy');
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.occupancyData)).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(typeof data.data.summary.avgOccupancy).toBe('number');
      expect(typeof data.data.summary.totalRooms).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/reports/occupancy', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by custom date range', async () => {
      const url = buildUrl('/api/reports/occupancy', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support monthly granularity', async () => {
      const url = buildUrl('/api/reports/occupancy', { granularity: 'monthly' });
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.occupancyData)).toBe(true);
    });

    it('should return occupancyByRoomType breakdown', async () => {
      const url = buildUrl('/api/reports/occupancy');
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      const data = await res.json();
      expect(data.data.occupancyByRoomType).toBeDefined();
      expect(Array.isArray(data.data.occupancyByRoomType)).toBe(true);
      // Each entry should have roomTypeId, total, occupied, occupancy
      for (const rt of data.data.occupancyByRoomType) {
        expect(rt).toHaveProperty('roomTypeId');
        expect(rt).toHaveProperty('total');
        expect(rt).toHaveProperty('occupied');
        expect(typeof rt.occupancy).toBe('number');
      }
    });

    it('should return statusDistribution', async () => {
      const url = buildUrl('/api/reports/occupancy');
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      const data = await res.json();
      expect(data.data.statusDistribution).toBeDefined();
      expect(Array.isArray(data.data.statusDistribution)).toBe(true);
    });

    it('should return peakDays and lowOccupancyDays', async () => {
      const url = buildUrl('/api/reports/occupancy');
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      const data = await res.json();
      expect(Array.isArray(data.data.peakDays)).toBe(true);
      expect(Array.isArray(data.data.lowOccupancyDays)).toBe(true);
    });

    it('should calculate occupancyChange vs previous period', async () => {
      const url = buildUrl('/api/reports/occupancy');
      const req = await createAuthRequest(url);
      const res = await GETOccupancy(req as any);
      const data = await res.json();
      expect(typeof data.data.summary.occupancyChange).toBe('number');
    });
  });

  // ─── Scheduled Reports ────────────────────────────────────────
  describe('GET /api/reports/scheduled', () => {
    it('should list scheduled reports with stats', async () => {
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url);
      const res = await GETScheduled(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.history).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalReports).toBe('number');
      expect(typeof data.stats.activeReports).toBe('number');
    });
  });

  describe('POST /api/reports/scheduled', () => {
    it('should create a daily scheduled report', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Daily Revenue Report ${suffix}`,
          type: 'revenue',
          frequency: 'daily',
          time: '08:00',
          recipients: ['manager@hotel.com'],
          format: 'pdf',
          deliveryMethod: 'email',
          isActive: true,
          filters: { propertyId: PROPERTY_ID },
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Daily Revenue Report');
      expect(data.data.frequency).toBe('daily');
      expect(data.data.nextRunAt).toBeDefined();
      expect(Array.isArray(data.data.recipients)).toBe(true);
      createdReportIds.push(data.data.id);
    });

    it('should create a weekly scheduled report', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Weekly Occupancy ${suffix}`,
          type: 'occupancy',
          frequency: 'weekly',
          time: '09:30',
          recipients: ['ops@hotel.com'],
          format: 'csv',
          deliveryMethod: 'email',
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.frequency).toBe('weekly');
      createdReportIds.push(data.data.id);
    });

    it('should create a monthly scheduled report', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Monthly Financial ${suffix}`,
          type: 'financial',
          frequency: 'monthly',
          recipients: [],
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.frequency).toBe('monthly');
      createdReportIds.push(data.data.id);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'revenue',
          frequency: 'daily',
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without type', async () => {
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Missing Type Report',
          frequency: 'daily',
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without frequency', async () => {
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Missing Frequency Report',
          type: 'revenue',
        },
      });
      const res = await POSTScheduled(req as any);
      expect(res.status).toBe(400);
    });

    it('should set nextRunAt in the future', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/reports/scheduled');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Future Run Report ${suffix}`,
          type: 'revenue',
          frequency: 'daily',
          time: '23:59',
        },
      });
      const res = await POSTScheduled(req as any);
      const data = await res.json();
      expect(new Date(data.data.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      createdReportIds.push(data.data.id);
    });
  });

  // ─── Report Export ────────────────────────────────────────────
  describe('GET /api/reports/export', () => {
    const sampleColumns = JSON.stringify([
      { key: 'date', label: 'Date' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'occupancy', label: 'Occupancy %' },
    ]);
    const sampleData = JSON.stringify([
      { date: '2024-01-01', revenue: 50000, occupancy: 85 },
      { date: '2024-01-02', revenue: 62000, occupancy: 92 },
    ]);

    it('should export CSV format', async () => {
      const url = buildUrl('/api/reports/export', {
        format: 'csv',
        reportType: 'revenue',
        title: 'Revenue Report',
        columns: sampleColumns,
        data: sampleData,
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain('Date');
      expect(text).toContain('Revenue');
      expect(text).toContain('50000');
      expect(text).toContain('62000');
    });

    it('should export XLSX format (CSV with xlsx headers)', async () => {
      const url = buildUrl('/api/reports/export', {
        format: 'xlsx',
        reportType: 'occupancy',
        title: 'Occupancy Report',
        columns: sampleColumns,
        data: sampleData,
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheetml');
    });

    it('should export PDF format (HTML)', async () => {
      const url = buildUrl('/api/reports/export', {
        format: 'pdf',
        reportType: 'general',
        title: 'Monthly Summary',
        columns: sampleColumns,
        data: sampleData,
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('Monthly Summary');
      expect(html).toContain('50000');
      expect(html).toContain('StaySuite');
    });

    it('should reject unsupported format', async () => {
      const url = buildUrl('/api/reports/export', {
        format: 'xml',
        title: 'Test',
        data: sampleData,
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject empty data', async () => {
      const url = buildUrl('/api/reports/export', {
        format: 'csv',
        data: JSON.stringify([]),
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject missing data parameter', async () => {
      const url = buildUrl('/api/reports/export', { format: 'csv' });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(400);
    });

    it('should handle CSV without custom columns (auto-detect)', async () => {
      const autoData = JSON.stringify([
        { name: 'Room Service', amount: 1500 },
        { name: 'Laundry', amount: 300 },
      ]);
      const url = buildUrl('/api/reports/export', {
        format: 'csv',
        data: autoData,
      });
      const req = await createAuthRequest(url);
      const res = await GETExport(req as any);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('name');
      expect(text).toContain('amount');
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────
  afterAll(async () => {
    for (const id of createdReportIds) {
      await db.scheduledReport.delete({ where: { id } }).catch(() => {});
    }
  });
});
