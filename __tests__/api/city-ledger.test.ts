import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/city-ledger/route';
import { GET as getInvoice, PATCH as patchInvoice, POST as postPayment } from '@/app/api/city-ledger/[id]/route';
import { GET as getItems, POST as postItem } from '@/app/api/city-ledger/[id]/items/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let invoiceId: string;

describe('City Ledger API', () => {
  describe('GET /api/city-ledger', () => {
    it('should return list of city ledger invoices', async () => {
      const url = buildUrl('/api/city-ledger', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.aggregates).toBeDefined();
    });
  });

  describe('POST /api/city-ledger', () => {
    it('should create a city ledger invoice with items', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/city-ledger');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          accountName: `Test Corp ${suffix}`,
          accountType: 'corporate',
          invoiceNumber: `INV-${suffix.slice(-8)}`,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          items: [
            { description: 'Room charges', amount: 5000, quantity: 2 },
            { description: 'F&B', amount: 1500, quantity: 1 },
          ],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('draft');
      expect(data.data.total).toBe(11500);
      expect(data.data.items).toHaveLength(2);
      invoiceId = data.data.id;
    });
  });

  describe('GET /api/city-ledger/[id]', () => {
    it('should get a single invoice', async () => {
      const url = buildUrl(`/api/city-ledger/${invoiceId}`);
      const req = await createAuthRequest(url);
      const res = await getInvoice(req as any, { params: Promise.resolve({ id: invoiceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(invoiceId);
      expect(data.data.items).toBeDefined();
    });
  });

  describe('PATCH /api/city-ledger/[id]', () => {
    it('should update invoice status', async () => {
      const url = buildUrl(`/api/city-ledger/${invoiceId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { status: 'sent' },
      });
      const res = await patchInvoice(req as any, { params: Promise.resolve({ id: invoiceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('sent');
    });
  });

  describe('GET /api/city-ledger/[id]/items', () => {
    it('should list invoice items', async () => {
      const url = buildUrl(`/api/city-ledger/${invoiceId}/items`);
      const req = await createAuthRequest(url);
      const res = await getItems(req as any, { params: Promise.resolve({ id: invoiceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/city-ledger/[id]/items', () => {
    it('should add an item to invoice', async () => {
      const url = buildUrl(`/api/city-ledger/${invoiceId}/items`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { description: 'Extra service', amount: 500, quantity: 1 },
      });
      const res = await postItem(req as any, { params: Promise.resolve({ id: invoiceId }) } as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.item).toBeDefined();
      expect(data.data.invoice.total).toBe(12000);
    });
  });

  afterAll(async () => {
    if (invoiceId) {
      await db.cityLedgerItem.deleteMany({ where: { invoiceId } });
      await db.cityLedgerPayment.deleteMany({ where: { invoiceId } });
      await db.cityLedgerInvoice.delete({ where: { id: invoiceId } });
    }
  });
});
