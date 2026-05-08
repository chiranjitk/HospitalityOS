import { describe, it, expect } from 'vitest';
import { GET as getProfitLoss } from '@/app/api/financials/profit-loss/route';
import { GET as getProfitLossExport } from '@/app/api/financials/profit-loss/export/route';
import { createAuthRequest, buildUrl, PROPERTY_ID } from './test-helpers';

describe('Profit & Loss API', () => {
  describe('GET /api/financials/profit-loss', () => {
    it('should return P&L statement without filters', async () => {
      const url = buildUrl('/api/financials/profit-loss');
      const req = await createAuthRequest(url);
      const res = await getProfitLoss(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.revenue).toBeDefined();
      expect(data.data.expenses).toBeDefined();
      expect(typeof data.data.revenue.total).toBe('number');
      expect(typeof data.data.expenses.total).toBe('number');
      expect(typeof data.data.netProfit).toBe('number');
      expect(typeof data.data.profitMargin).toBe('number');
      expect(data.data.period).toBeDefined();
    });

    it('should return P&L filtered by property', async () => {
      const url = buildUrl('/api/financials/profit-loss', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getProfitLoss(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.revenue).toBeDefined();
      expect(data.data.expenses).toBeDefined();
    });

    it('should return P&L filtered by date range', async () => {
      const url = buildUrl('/api/financials/profit-loss', {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });
      const req = await createAuthRequest(url);
      const res = await getProfitLoss(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.period.dateFrom).toBeDefined();
      expect(data.data.period.dateTo).toBeDefined();
    });

    it('should return P&L with property and date range filters', async () => {
      const url = buildUrl('/api/financials/profit-loss', {
        propertyId: PROPERTY_ID,
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
      });
      const req = await createAuthRequest(url);
      const res = await getProfitLoss(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.revenue.byCategory).toBeInstanceOf(Array);
      expect(data.data.expenses.byCategory).toBeInstanceOf(Array);
      expect(data.data.revenue.accounts).toBeInstanceOf(Array);
      expect(data.data.expenses.accounts).toBeInstanceOf(Array);
    });

    it('should compute netProfit as revenue minus expenses', async () => {
      const url = buildUrl('/api/financials/profit-loss');
      const req = await createAuthRequest(url);
      const res = await getProfitLoss(req as any);
      const data = await res.json();
      expect(data.data.netProfit).toBe(
        data.data.revenue.total - data.data.expenses.total,
      );
    });
  });

  describe('GET /api/financials/profit-loss/export', () => {
    it('should export P&L as CSV', async () => {
      const url = buildUrl('/api/financials/profit-loss/export', { format: 'csv' });
      const req = await createAuthRequest(url);
      const res = await getProfitLossExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('profit-loss');
      expect(res.headers.get('Content-Disposition')).toContain('.csv');

      const csv = await res.text();
      expect(csv).toContain('Type,Category,Amount');
      expect(csv).toContain('Revenue,Total,');
      expect(csv).toContain('Expenses,Total,');
      expect(csv).toContain('Net Profit,');
      expect(csv).toContain('Profit Margin,');
    });

    it('should export P&L as CSV with property filter', async () => {
      const url = buildUrl('/api/financials/profit-loss/export', {
        format: 'csv',
        propertyId: PROPERTY_ID,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });
      const req = await createAuthRequest(url);
      const res = await getProfitLossExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv');
      const csv = await res.text();
      expect(csv).toContain('Type,Category,Amount');
    });

    it('should export P&L as JSON when format is not csv', async () => {
      const url = buildUrl('/api/financials/profit-loss/export', { format: 'json' });
      const req = await createAuthRequest(url);
      const res = await getProfitLossExport(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.revenue).toBeDefined();
      expect(data.data.expenses).toBeDefined();
      expect(typeof data.data.netProfit).toBe('number');
      expect(typeof data.data.profitMargin).toBe('number');
      expect(data.data.revenue.byCategory).toBeDefined();
      expect(data.data.expenses.byCategory).toBeDefined();
    });

    it('should default to CSV format when no format param', async () => {
      const url = buildUrl('/api/financials/profit-loss/export');
      const req = await createAuthRequest(url);
      const res = await getProfitLossExport(req as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv');
    });
  });
});
