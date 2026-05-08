import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/folio/credit-notes/route';
import { createAuthRequest, buildUrl, FOLIO_ID, GUEST_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let fixture: Awaited<ReturnType<typeof createTestFixture>>;
let createdCreditNoteId: string;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Folio Credit Notes API', () => {
  describe('GET /api/folio/credit-notes', () => {
    it('should require folioId query parameter', async () => {
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return credit notes for a valid folio', async () => {
      const url = buildUrl('/api/folio/credit-notes', { folioId: FOLIO_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent folio', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/folio/credit-notes', { folioId: fakeId });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/folio/credit-notes', () => {
    it('should create a credit note with valid data', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          guestId: fixture.guest.id,
          bookingId: fixture.booking.id,
          reason: 'discount',
          description: `Test credit note ${suffix}`,
          items: [
            { description: 'Room discount', amount: 500 },
          ],
          currency: 'INR',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.creditNoteNumber).toBeDefined();
      expect(data.data.creditNoteNumber).toMatch(/^CN-\d{8}-\d{4}$/);
      expect(data.data.status).toBe('issued');
      expect(data.data.reason).toBe('discount');
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.totalAmount).toBe(500);
      expect(data.data.remainingAmount).toBe(500);
      createdCreditNoteId = data.data.id;
    });

    it('should create a credit note with service_recovery reason', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          guestId: fixture.guest.id,
          reason: 'service_recovery',
          description: `Service recovery ${suffix}`,
          items: [
            { description: 'Service recovery credit', amount: 1000 },
            { description: 'Additional goodwill', amount: 200 },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalAmount).toBe(1200);
      expect(data.data.items.length).toBe(2);
    });

    it('should reject credit note with missing required fields', async () => {
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          // missing guestId, reason, items
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject credit note with invalid reason', async () => {
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          guestId: fixture.guest.id,
          reason: 'invalid_reason',
          items: [{ description: 'Test', amount: 100 }],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Invalid reason');
    });

    it('should reject credit note with empty items array', async () => {
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          guestId: fixture.guest.id,
          reason: 'refund',
          items: [],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject credit note with zero or negative item amount', async () => {
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fixture.folio.id,
          guestId: fixture.guest.id,
          reason: 'correction',
          items: [{ description: 'Bad amount', amount: -50 }],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('positive');
    });

    it('should return 404 for non-existent folio', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/folio/credit-notes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          folioId: fakeId,
          guestId: fixture.guest.id,
          reason: 'refund',
          items: [{ description: 'Test', amount: 100 }],
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
    // Clean up created credit notes
    if (createdCreditNoteId) {
      try {
        await db.creditNote.delete({ where: { id: createdCreditNoteId } });
      } catch (e) {
        console.error('Cleanup failed for credit note:', e);
      }
    }
    // Clean up any additional credit notes for the fixture folio
    if (fixture) {
      try {
        await db.creditNote.deleteMany({ where: { folioId: fixture.folio.id } });
      } catch (e) {
        console.error('Cleanup failed for folio credit notes:', e);
      }
      await fixture.cleanup();
    }
  });
});
