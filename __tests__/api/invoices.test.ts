import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/invoices/route';
import { createAuthRequest, buildUrl, FOLIO_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let fixture: Awaited<ReturnType<typeof createTestFixture>>;
let createdInvoiceId: string;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Invoices API', () => {
  describe('GET /api/invoices', () => {
    it('should return list of invoices', async () => {
      const url = buildUrl('/api/invoices', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
    });

    it('should include invoice stats', async () => {
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('draft');
      expect(data.stats).toHaveProperty('issued');
      expect(data.stats).toHaveProperty('paid');
      expect(data.stats).toHaveProperty('overdue');
      expect(data.stats).toHaveProperty('cancelled');
      expect(data.stats).toHaveProperty('totalAmount');
      expect(data.stats).toHaveProperty('paidAmount');
      expect(data.stats).toHaveProperty('outstandingAmount');
      expect(data.stats).toHaveProperty('totalTax');
    });

    it('should filter invoices by status', async () => {
      const url = buildUrl('/api/invoices', { status: 'paid', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((inv: any) => inv.status === 'paid')).toBe(true);
      }
    });

    it('should return all invoices when status is "all"', async () => {
      const url = buildUrl('/api/invoices', { status: 'all', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should filter invoices by folioId', async () => {
      const url = buildUrl('/api/invoices', { folioId: FOLIO_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should search invoices by invoice number', async () => {
      const url = buildUrl('/api/invoices', { search: 'INV', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support offset parameter', async () => {
      const url = buildUrl('/api/invoices', { limit: '2', offset: '1' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.offset).toBe(1);
    });

    it('should parse line items from JSON', async () => {
      const url = buildUrl('/api/invoices', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const invoice = data.data[0];
        expect(invoice).toHaveProperty('lineItems');
        expect(invoice.lineItems).toBeInstanceOf(Array);
      }
    });
  });

  describe('POST /api/invoices', () => {
    it('should create a standalone invoice', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: `Test Customer ${suffix.slice(-4)}`,
          customerEmail: `test${suffix.slice(-4)}@example.com`,
          customerAddress: '123 Test St, Kolkata, India',
          currency: 'INR',
          status: 'draft',
          lineItems: [
            {
              description: 'Room charge',
              quantity: 3,
              unitPrice: 5000,
              totalAmount: 15000,
              taxRate: 18,
              taxAmount: 2700,
            },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.invoiceNumber).toBeDefined();
      expect(data.data.invoiceNumber).toMatch(/^INV-/);
      expect(data.data.customerName).toContain('Test Customer');
      expect(data.data.status).toBe('draft');
      expect(data.data.lineItems).toBeInstanceOf(Array);
      expect(data.data.lineItems.length).toBe(1);
      createdInvoiceId = data.data.id;
    });

    it('should create invoice with issued status', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: `Issued Customer ${suffix.slice(-4)}`,
          lineItems: [
            { description: 'Service', totalAmount: 2000, taxAmount: 360 },
          ],
          status: 'issued',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('issued');
      expect(data.data.issuedAt).toBeDefined();
      // Clean up
      await db.invoice.delete({ where: { id: data.data.id } });
    });

    it('should calculate subtotal from line items', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: `Calc Test ${suffix.slice(-4)}`,
          lineItems: [
            { description: 'Item 1', totalAmount: 1000, taxAmount: 180 },
            { description: 'Item 2', totalAmount: 2000, taxAmount: 360 },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.subtotal).toBe(3000);
      expect(data.data.taxes).toBe(540);
      // Clean up
      await db.invoice.delete({ where: { id: data.data.id } });
    });

    it('should set default currency to USD', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: `USD Default ${suffix.slice(-4)}`,
          lineItems: [
            { description: 'Test', totalAmount: 100, taxAmount: 0 },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.currency).toBe('USD');
      // Clean up
      await db.invoice.delete({ where: { id: data.data.id } });
    });

    it('should reject standalone invoice without customer name', async () => {
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          lineItems: [
            { description: 'Test', totalAmount: 100, taxAmount: 0 },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject standalone invoice without line items', async () => {
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: 'No Items Customer',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject standalone invoice with empty line items', async () => {
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          customerName: 'Empty Items Customer',
          lineItems: [],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create invoice from folio', async () => {
      // Add a line item to the fixture folio first
      const suffix = uniqueSuffix();
      const lineItemUrl = buildUrl(`/api/folios/${fixture.folio.id}/line-items`);
      const lineItemReq = await createAuthRequest(lineItemUrl, {
        method: 'POST',
        body: {
          description: `Test charge for invoice ${suffix}`,
          category: 'room_service',
          quantity: 1,
          unitPrice: 3000,
          taxRate: 18,
          source: 'test',
        },
      });
      const lineItemRes = await (await import('@/app/api/folios/[id]/line-items/route')).POST(
        lineItemReq,
        { params: Promise.resolve({ id: fixture.folio.id }) } as any,
      );

      // Now create invoice from folio
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.folioId).toBe(fixture.folio.id);
      expect(data.data.invoiceNumber).toBeDefined();
      expect(data.message).toBe('Invoice created from folio');
    });

    it('should reject duplicate invoice for same folio', async () => {
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVOICE_EXISTS');
    });

    it('should return 404 for non-existent folio', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/invoices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fakeId,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  afterAll(async () => {
    // Clean up created invoices
    if (createdInvoiceId) {
      try {
        await db.invoice.delete({ where: { id: createdInvoiceId } });
      } catch (e) {
        console.error('Cleanup failed for invoice:', e);
      }
    }
    // Clean up invoices created from fixture folio
    if (fixture) {
      try {
        await db.invoice.deleteMany({ where: { folioId: fixture.folio.id } });
      } catch (e) {
        console.error('Cleanup failed for folio invoices:', e);
      }
      // Reset folio
      try {
        await db.folio.update({
          where: { id: fixture.folio.id },
          data: { invoiceNumber: null, invoiceIssuedAt: null },
        });
      } catch (e) {
        console.error('Cleanup failed for folio reset:', e);
      }
      await fixture.cleanup();
    }
  });
});
