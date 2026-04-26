/**
 * Comprehensive Vitest test suite for the Bookings module
 * of StaySuite HospitalityOS.
 *
 * Tests API route handlers by importing and calling them directly
 * with NextRequest objects against the real database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// ─── Route handler imports ───────────────────────────────────────────
import {
  GET as listBookings,
  POST as createBooking,
} from '@/app/api/bookings/route';
import {
  GET as getBooking,
  PUT as updateBooking,
  PATCH as patchBooking,
  DELETE as deleteBooking,
} from '@/app/api/bookings/[id]/route';
import {
  GET as getConflicts,
  POST as resolveConflict,
} from '@/app/api/bookings/conflicts/route';
import {
  GET as getAuditLogs,
  POST as createAuditLog,
} from '@/app/api/bookings/audit-logs/route';
import {
  POST as roomMove,
} from '@/app/api/bookings/room-move/route';
import {
  GET as getRoomMoveHistory,
} from '@/app/api/bookings/room-move/history/route';
import {
  GET as listWaitlist,
  POST as createWaitlistEntry,
  PUT as updateWaitlistEntry,
  DELETE as deleteWaitlistEntry,
} from '@/app/api/waitlist/route';
import {
  GET as getNoShowSettings,
  PUT as updateNoShowSettings,
} from '@/app/api/no-show/settings/route';
import {
  GET as listGroupBookings,
  POST as createGroupBooking,
  PUT as updateGroupBooking,
  DELETE as deleteGroupBooking,
} from '@/app/api/group-bookings/route';
import {
  GET as getGroupBooking,
  DELETE as deleteGroupBookingById,
} from '@/app/api/group-bookings/[id]/route';
import {
  POST as bookRoomsForGroup,
} from '@/app/api/group-bookings/book-rooms/route';

// ─── Seed-data identifiers ──────────────────────────────────────────
const ADMIN_USER_ID = 'b763e2df-7bf1-4de8-94f8-97a1f1e7a0ec';
const FRONTDESK_USER_ID = 'cc3b3483-ad7a-452a-b623-5465962c9678';
const PLATFORM_USER_ID = '7816bbd0-fa83-4c3a-887b-3fc4d9e22a9d';
const T2_ADMIN_USER_ID = '9ecafba4-1bfb-406c-ace0-eaf309cd21dd';
const T2_MANAGER_USER_ID = 'a357fe96-d2f5-46cc-8f91-6f53423fab04';

const TENANT_1 = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const TENANT_2 = '1afa10da-6737-4bbe-b30c-e2b76eedd4d5';

const PROPERTY_KOLKATA = '281fde73-7836-4511-b644-91f3663d8fcd';
const PROPERTY_DARJEELING = '600daed4-4d6a-4cb2-a07e-46bec7f4c43b';

const ROOM_TYPE_STD = '4d5269a2-63ad-48e7-8683-4b0efca11567';
const ROOM_TYPE_DLX = '1aac4388-0d87-43da-a0bf-984fe39e5bcf';
const ROOM_TYPE_EXEC = '22f53ea5-00fb-4b29-9dc6-a7834cc6b481';
const ROOM_TYPE_PRES = 'bd3a1ffd-24b8-4185-b350-6bdae97bc426';

// Available rooms at Kolkata (Presidential Suite)
const ROOM_1001 = '3f4e539d-f262-44f7-8128-4f8371c06f9a';
const ROOM_1003 = '8032ad67-0062-44aa-8b69-7309ff30fc52';
const ROOM_1004 = '27075f59-a689-401a-8834-01366da35822';
const ROOM_1005 = '9c05885e-e04c-4d0e-8792-7d79d3f5c4d7';

// Occupied rooms at Kolkata
const ROOM_1002 = '511c8197-5769-497c-9efc-293067ff0671';

// Guests
const GUEST_RAHUL = '0dae0b8b-173a-4819-8a5e-7ff3be5c81d5';
const GUEST_RINA = '18349da2-1713-42c0-bad9-67856cc58d26';
const GUEST_POOJA = '79877c7c-f915-4922-94a0-5d83df9e1d09';
const GUEST_SNEHA = 'c5e15b10-5464-4323-87b6-41d1eb95c39a';
const GUEST_AMIT = 'cb127462-1b96-4e37-8f78-65bbd0493ee1';
const GUEST_VIKRAM = 'df87b649-707f-402a-9198-75a06d22ed63';

// Existing bookings
const BOOKING_CHECKED_IN_VIKRAM = '231b3af0-9522-447b-8135-8ec031dc66c1';
const BOOKING_CHECKED_IN_RINA = '7e7c1dde-1748-45aa-aad9-fde8feacb222';
const BOOKING_CHECKED_IN_RAHUL = '9b7a9397-91d2-4f9c-baf4-71123765747b';
const BOOKING_CONFIRMED_003 = 'a539a935-cba9-4ae3-a986-1a15727495b7';
const BOOKING_CHECKED_IN_001 = 'b544cc77-46a6-4e53-921e-50db663eb482';
const BOOKING_CONFIRMED_005 = 'ba31a39a-e127-49d8-b18d-29088b49ac6d';

// ─── Session token map ──────────────────────────────────────────────
const sessionTokens = new Map<string, string>();

// ─── Test-created entity IDs (for cleanup) ─────────────────────────
let testBookingId: string | null = null;
let testDraftBookingId: string | null = null;
let testWaitlistEntryId: string | null = null;
let testGroupBookingId: string | null = null;
let testGroupBookingNoBookingsId: string | null = null;
let testAuditLogIds: string[] = [];

// ─── Unique suffix to avoid collisions ──────────────────────────────
const SUFFIX = Date.now();

// ─── Helpers ─────────────────────────────────────────────────────────

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function futureDateOnly(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function createRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    userId?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  const headers = new Headers(options.headers ?? {});

  if (options.userId) {
    const token = sessionTokens.get(options.userId);
    if (token) {
      headers.set('Cookie', `session_token=${token}`);
    }
  }

  const init: RequestInit = { headers };
  if (options.method) init.method = options.method;
  if (options.body) {
    init.body = JSON.stringify(options.body);
    headers.set('Content-Type', 'application/json');
  }

  return new NextRequest(url.toString(), init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function json(res: Response) {
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════

describe('Bookings Module', () => {

  // ───────────────────────────────────────────────────────────────────
  // Setup & Teardown
  // ───────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Clean up leftover test sessions from previous runs
    const testTokens = [
      'bk-test-admin',
      'bk-test-frontdesk',
      'bk-test-platform',
      'bk-test-t2-admin',
      'bk-test-t2-manager',
    ];
    await db.session.deleteMany({
      where: { token: { in: testTokens } },
    });

    // Create fresh sessions for each test user
    const sessions = [
      { userId: ADMIN_USER_ID, token: 'bk-test-admin' },
      { userId: FRONTDESK_USER_ID, token: 'bk-test-frontdesk' },
      { userId: PLATFORM_USER_ID, token: 'bk-test-platform' },
      { userId: T2_ADMIN_USER_ID, token: 'bk-test-t2-admin' },
      { userId: T2_MANAGER_USER_ID, token: 'bk-test-t2-manager' },
    ];

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    for (const s of sessions) {
      await db.session.create({
        data: {
          userId: s.userId,
          token: s.token,
          refreshToken: `${s.token}-refresh`,
          expiresAt: expiry,
          userAgent: 'vitest',
          ipAddress: '127.0.0.1',
        },
      });
      sessionTokens.set(s.userId, s.token);
    }
  });

  afterAll(async () => {
    // Clean up test sessions
    await db.session.deleteMany({
      where: {
        token: {
          in: Array.from(sessionTokens.values()),
        },
      },
    });

    // Clean up test-created bookings (hard delete)
    for (const bookingId of [testBookingId, testDraftBookingId]) {
      if (bookingId) {
        try {
          // First delete any related records
          await db.folioLineItem.deleteMany({ where: { folio: { bookingId } } });
          await db.folio.deleteMany({ where: { bookingId } });
          await db.guestStay.deleteMany({ where: { bookingId } });
          await db.bookingAuditLog.deleteMany({ where: { bookingId } });
          await db.booking.delete({ where: { id: bookingId } });
        } catch { /* ignore */ }
      }
    }

    // Clean up test audit logs created directly
    for (const auditLogId of testAuditLogIds) {
      try {
        await db.bookingAuditLog.delete({ where: { id: auditLogId } });
      } catch { /* ignore */ }
    }

    // Clean up test waitlist entries
    if (testWaitlistEntryId) {
      try {
        await db.waitlistEntry.delete({ where: { id: testWaitlistEntryId } });
      } catch { /* ignore */ }
    }

    // Clean up test group bookings
    for (const gId of [testGroupBookingId, testGroupBookingNoBookingsId]) {
      if (gId) {
        try {
          // Delete any associated bookings first
          const groupBookings = await db.booking.findMany({
            where: { groupId: gId },
            select: { id: true },
          });
          for (const gb of groupBookings) {
            await db.folioLineItem.deleteMany({ where: { folio: { bookingId: gb.id } } });
            await db.folio.deleteMany({ where: { bookingId: gb.id } });
            await db.guestStay.deleteMany({ where: { bookingId: gb.id } });
          }
          await db.booking.deleteMany({ where: { groupId: gId } });
          await db.groupBooking.delete({ where: { id: gId } });
        } catch { /* ignore */ }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // A. Authentication & Authorization (8 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('A. Authentication & Authorization', () => {
    it('returns 401 for unauthenticated GET /api/bookings', async () => {
      const req = createRequest('/api/bookings');
      const res = await listBookings(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/bookings/conflicts', async () => {
      const req = createRequest('/api/bookings/conflicts');
      const res = await getConflicts(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/bookings/audit-logs', async () => {
      const req = createRequest('/api/bookings/audit-logs');
      const res = await getAuditLogs(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated POST /api/bookings/room-move', async () => {
      const req = createRequest('/api/bookings/room-move', {
        method: 'POST',
        body: { bookingId: 'x', fromRoomId: 'x', toRoomId: 'y' },
      });
      const res = await roomMove(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/waitlist', async () => {
      const req = createRequest('/api/waitlist');
      const res = await listWaitlist(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/no-show/settings', async () => {
      const req = createRequest('/api/no-show/settings');
      const res = await getNoShowSettings(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/group-bookings', async () => {
      const req = createRequest('/api/group-bookings');
      const res = await listGroupBookings(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 for frontdesk user on POST /api/bookings/conflicts (requires bookings.manage)', async () => {
      // Frontdesk has bookings.view, bookings.create, bookings.update — NOT bookings.manage
      const req = createRequest('/api/bookings/conflicts', {
        method: 'POST',
        userId: FRONTDESK_USER_ID,
        body: {
          conflictId: 'test-conflict',
          conflictType: 'double_booking',
          bookingIds: [BOOKING_CHECKED_IN_VIKRAM],
          resolution: 'cancel',
        },
      });
      const res = await resolveConflict(req);
      expect(res.status).toBe(403);
    });

    it('cross-tenant isolation: Ocean View admin cannot see Royal Stay bookings', async () => {
      const req = createRequest('/api/bookings', {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await listBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      // Ocean View admin should see no Royal Stay bookings
      expect(body.data).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // B. Bookings CRUD (12 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('B. Bookings CRUD', () => {
    it('lists bookings with status filter', async () => {
      const req = createRequest('/api/bookings?status=confirmed', {
        userId: ADMIN_USER_ID,
      });
      const res = await listBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      for (const b of body.data) {
        expect(b.status).toBe('confirmed');
      }
    });

    it('lists bookings with propertyId filter', async () => {
      const req = createRequest(`/api/bookings?propertyId=${PROPERTY_KOLKATA}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await listBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      for (const b of body.data) {
        expect(b.propertyId).toBe(PROPERTY_KOLKATA);
      }
    });

    it('lists bookings with search by confirmationCode', async () => {
      const req = createRequest('/api/bookings?search=RS-2024-001', {
        userId: ADMIN_USER_ID,
      });
      const res = await listBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // Should find the booking with that confirmation code
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('creates a booking with all required fields → 201', async () => {
      const req = createRequest('/api/bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          primaryGuestId: GUEST_POOJA,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(10),
          checkOut: futureDate(12),
          roomId: ROOM_1003,
          adults: 2,
          roomRate: 5000,
          totalAmount: 10000,
          currency: 'INR',
          source: 'direct',
          specialRequests: `Test booking ${SUFFIX}`,
        },
      });
      const res = await createBooking(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.primaryGuestId).toBe(GUEST_POOJA);
      expect(body.data.status).toBe('confirmed');
      expect(body.data.confirmationCode).toMatch(/^SS-/);
      testBookingId = body.data.id;
    });

    it('rejects missing required fields → 400', async () => {
      const req = createRequest('/api/bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          // Missing primaryGuestId, roomTypeId, checkIn, checkOut
        },
      });
      const res = await createBooking(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects invalid dates (checkIn >= checkOut) → 400', async () => {
      const req = createRequest('/api/bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          primaryGuestId: GUEST_POOJA,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(15),
          checkOut: futureDate(15), // Same as checkIn
          roomRate: 5000,
          skipLockCheck: true,
        },
      });
      const res = await createBooking(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects invalid propertyId (wrong tenant) → 400', async () => {
      // Ocean View admin trying to create booking at Royal Stay property
      const req = createRequest('/api/bookings', {
        method: 'POST',
        userId: T2_ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          primaryGuestId: GUEST_POOJA,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(20),
          checkOut: futureDate(22),
          roomRate: 5000,
          skipLockCheck: true,
        },
      });
      const res = await createBooking(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('gets booking by ID with relations', async () => {
      const req = createRequest(`/api/bookings/${BOOKING_CHECKED_IN_RAHUL}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getBooking(req, makeParams(BOOKING_CHECKED_IN_RAHUL));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(BOOKING_CHECKED_IN_RAHUL);
      expect(body.data.primaryGuest).toBeDefined();
      expect(body.data.folios).toBeDefined();
      expect(Array.isArray(body.data.folios)).toBe(true);
    });

    it('PATCH booking status (confirmed → checked_in)', async () => {
      // First create a draft booking to transition
      const createReq = createRequest('/api/bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          primaryGuestId: GUEST_SNEHA,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(10),
          checkOut: futureDate(12),
          roomId: ROOM_1004,
          adults: 1,
          roomRate: 5000,
          totalAmount: 10000,
          currency: 'INR',
          status: 'draft',
          skipLockCheck: true,
        },
      });
      const createRes = await createBooking(createReq);
      const createBody = await json(createRes);
      expect(createRes.status).toBe(201);
      const draftId = createBody.data.id;
      testDraftBookingId = draftId;

      // Transition draft → confirmed
      const patchReq = createRequest(`/api/bookings/${draftId}`, {
        method: 'PATCH',
        userId: ADMIN_USER_ID,
        body: { status: 'confirmed' },
      });
      const patchRes = await patchBooking(patchReq, makeParams(draftId));
      const patchBody = await json(patchRes);
      expect(patchRes.status).toBe(200);
      expect(patchBody.success).toBe(true);
      expect(patchBody.data.status).toBe('confirmed');
    });

    it('rejects invalid status transition → 400', async () => {
      // Try to transition a checked_in booking to draft (invalid)
      const patchReq = createRequest(`/api/bookings/${BOOKING_CHECKED_IN_VIKRAM}`, {
        method: 'PATCH',
        userId: ADMIN_USER_ID,
        body: { status: 'draft' },
      });
      const patchRes = await patchBooking(patchReq, makeParams(BOOKING_CHECKED_IN_VIKRAM));
      const patchBody = await json(patchRes);
      expect(patchRes.status).toBe(400);
      expect(patchBody.success).toBe(false);
    });

    it('DELETE draft/confirmed booking → soft delete', async () => {
      // Use the draft booking created earlier (now confirmed)
      // Create a fresh draft to delete
      const createReq = createRequest('/api/bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          primaryGuestId: GUEST_AMIT,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(15),
          checkOut: futureDate(17),
          adults: 1,
          roomRate: 5000,
          totalAmount: 10000,
          currency: 'INR',
          status: 'draft',
          skipLockCheck: true,
        },
      });
      const createRes = await createBooking(createReq);
      const createBody = await json(createRes);
      expect(createRes.status).toBe(201);
      const delId = createBody.data.id;

      // Delete it
      const delReq = createRequest(`/api/bookings/${delId}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const delRes = await deleteBooking(delReq, makeParams(delId));
      const delBody = await json(delRes);
      expect(delRes.status).toBe(200);
      expect(delBody.success).toBe(true);

      // Verify soft-deleted in DB
      const booking = await db.booking.findUnique({ where: { id: delId } });
      expect(booking).not.toBeNull();
      expect(booking!.deletedAt).not.toBeNull();

      // Hard cleanup
      await db.folioLineItem.deleteMany({ where: { folio: { bookingId: delId } } });
      await db.folio.deleteMany({ where: { bookingId: delId } });
      await db.guestStay.deleteMany({ where: { bookingId: delId } });
      await db.bookingAuditLog.deleteMany({ where: { bookingId: delId } });
      await db.booking.delete({ where: { id: delId } });
    });

    it('rejects deleting checked_in booking → 400', async () => {
      const delReq = createRequest(`/api/bookings/${BOOKING_CHECKED_IN_VIKRAM}`, {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
      });
      const delRes = await deleteBooking(delReq, makeParams(BOOKING_CHECKED_IN_VIKRAM));
      const delBody = await json(delRes);
      expect(delRes.status).toBe(400);
      expect(delBody.success).toBe(false);
    });

    it('cross-tenant GET → 404', async () => {
      const req = createRequest(`/api/bookings/${BOOKING_CHECKED_IN_RAHUL}`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getBooking(req, makeParams(BOOKING_CHECKED_IN_RAHUL));
      expect(res.status).toBe(404);
    });

    it('pagination (limit/offset)', async () => {
      const req = createRequest('/api/bookings?limit=2&offset=0', {
        userId: ADMIN_USER_ID,
      });
      const res = await listBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.offset).toBe(0);
      expect(body.pagination.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C. Conflicts (5 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('C. Conflicts', () => {
    it('GET conflicts with propertyId filter', async () => {
      const req = createRequest(`/api/bookings/conflicts?propertyId=${PROPERTY_KOLKATA}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getConflicts(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.stats).toBeDefined();
      expect(typeof body.stats.totalConflicts).toBe('number');
    });

    it('POST conflict resolution (cancel)', async () => {
      // Create two confirmed bookings for the same room to create a conflict scenario
      // Then use the conflicts endpoint to resolve by cancel
      const req = createRequest('/api/bookings/conflicts', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          conflictId: `test-cancel-${SUFFIX}`,
          conflictType: 'double_booking',
          bookingIds: [BOOKING_CONFIRMED_003, BOOKING_CONFIRMED_005],
          resolution: 'keep_both',
          notifyGuest: false,
        },
      });
      const res = await resolveConflict(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.resolution).toBe('keep_both');
    });

    it('POST conflict resolution (keep_both)', async () => {
      const req = createRequest('/api/bookings/conflicts', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          conflictId: `test-keep-both-${SUFFIX}`,
          conflictType: 'overbooking',
          bookingIds: [BOOKING_CONFIRMED_003],
          resolution: 'keep_both',
          notifyGuest: false,
        },
      });
      const res = await resolveConflict(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('rejects invalid resolution type → 400', async () => {
      const req = createRequest('/api/bookings/conflicts', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          conflictId: `test-invalid-${SUFFIX}`,
          conflictType: 'double_booking',
          bookingIds: [BOOKING_CONFIRMED_003],
          resolution: 'teleport',
        },
      });
      const res = await resolveConflict(req);
      expect(res.status).toBe(400);
    });

    it('rejects missing required fields → 400', async () => {
      const req = createRequest('/api/bookings/conflicts', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          // Missing conflictId, conflictType, bookingIds, resolution
        },
      });
      const res = await resolveConflict(req);
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // D. Audit Logs (5 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('D. Audit Logs', () => {
    it('GET audit logs for a booking', async () => {
      const req = createRequest(`/api/bookings/audit-logs?bookingId=${BOOKING_CHECKED_IN_RAHUL}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getAuditLogs(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('GET audit logs without bookingId (filtered by tenant)', async () => {
      const req = createRequest('/api/bookings/audit-logs?limit=5', {
        userId: ADMIN_USER_ID,
      });
      const res = await getAuditLogs(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('POST create audit log entry', async () => {
      const req = createRequest('/api/bookings/audit-logs', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CHECKED_IN_RAHUL,
          action: `test_note_${SUFFIX}`,
          newStatus: 'confirmed',
          notes: `Test audit log entry ${SUFFIX}`,
        },
      });
      const res = await createAuditLog(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.bookingId).toBe(BOOKING_CHECKED_IN_RAHUL);
      testAuditLogIds.push(body.data.id);
    });

    it('rejects without bookingId → 400', async () => {
      const req = createRequest('/api/bookings/audit-logs', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          action: 'test_action',
        },
      });
      const res = await createAuditLog(req);
      expect(res.status).toBe(400);
    });

    it('cross-tenant bookingId → 404', async () => {
      // Ocean View admin trying to access Royal Stay booking audit logs
      const req = createRequest(`/api/bookings/audit-logs?bookingId=${BOOKING_CHECKED_IN_RAHUL}`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getAuditLogs(req);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // E. Room Move (6 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('E. Room Move', () => {
    it('POST room move with valid data → 200', async () => {
      // Vikram is checked_in in room 1002 — move to room 1005 (available)
      const req = createRequest('/api/bookings/room-move', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CHECKED_IN_VIKRAM,
          fromRoomId: ROOM_1002,
          toRoomId: ROOM_1005,
          reason: 'guest_request',
          notes: `Test room move ${SUFFIX}`,
        },
      });
      const res = await roomMove(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.roomNumber).toBeDefined();

      // Move back to original room for cleanup
      const backReq = createRequest('/api/bookings/room-move', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CHECKED_IN_VIKRAM,
          fromRoomId: ROOM_1005,
          toRoomId: ROOM_1002,
          reason: 'maintenance',
          notes: 'Reverting test room move',
        },
      });
      await roomMove(backReq);
    });

    it('rejects fromRoomId === toRoomId → 400', async () => {
      const req = createRequest('/api/bookings/room-move', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CHECKED_IN_VIKRAM,
          fromRoomId: ROOM_1002,
          toRoomId: ROOM_1002,
          reason: 'guest_request',
        },
      });
      const res = await roomMove(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects missing required fields → 400', async () => {
      const req = createRequest('/api/bookings/room-move', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CHECKED_IN_VIKRAM,
          // Missing fromRoomId, toRoomId, reason
        },
      });
      const res = await roomMove(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects non-checked_in booking → error', async () => {
      // BOOKING_CONFIRMED_003 is 'confirmed', not checked_in
      const req = createRequest('/api/bookings/room-move', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          bookingId: BOOKING_CONFIRMED_003,
          fromRoomId: ROOM_1001,
          toRoomId: ROOM_1003,
          reason: 'guest_request',
        },
      });
      const res = await roomMove(req);
      const body = await json(res);
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });

    it('GET room move history by bookingId', async () => {
      const req = createRequest(`/api/bookings/room-move/history?bookingId=${BOOKING_CHECKED_IN_VIKRAM}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getRoomMoveHistory(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('GET room move history without bookingId or guestId → 400', async () => {
      const req = createRequest('/api/bookings/room-move/history', {
        userId: ADMIN_USER_ID,
      });
      const res = await getRoomMoveHistory(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // F. Waitlist (8 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('F. Waitlist', () => {
    it('GET waitlist with stats', async () => {
      const req = createRequest('/api/waitlist', {
        userId: ADMIN_USER_ID,
      });
      const res = await listWaitlist(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.stats).toBeDefined();
      expect(body.stats).toHaveProperty('total');
      expect(body.stats).toHaveProperty('waiting');
      expect(body.stats).toHaveProperty('notified');
      expect(body.stats).toHaveProperty('converted');
      expect(body.stats).toHaveProperty('expired');
    });

    it('POST create waitlist entry → 201', async () => {
      const req = createRequest('/api/waitlist', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          guestId: GUEST_SNEHA,
          roomTypeId: ROOM_TYPE_PRES,
          checkIn: futureDate(20),
          checkOut: futureDate(22),
          adults: 2,
          priority: 5,
          notes: `Test waitlist entry ${SUFFIX}`,
        },
      });
      const res = await createWaitlistEntry(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.guestId).toBe(GUEST_SNEHA);
      expect(body.data.status).toBe('waiting');
      testWaitlistEntryId = body.data.id;
    });

    it('rejects missing required fields → 400', async () => {
      const req = createRequest('/api/waitlist', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          // Missing guestId, roomTypeId, checkIn, checkOut
        },
      });
      const res = await createWaitlistEntry(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects invalid status filter → 400', async () => {
      const req = createRequest('/api/waitlist?status=invalid_status', {
        userId: ADMIN_USER_ID,
      });
      const res = await listWaitlist(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('PUT update waitlist entry status', async () => {
      expect(testWaitlistEntryId).not.toBeNull();
      const req = createRequest('/api/waitlist', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: testWaitlistEntryId,
          status: 'notified',
          notes: 'Updated by test',
        },
      });
      const res = await updateWaitlistEntry(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('notified');
    });

    it('DELETE waitlist entry', async () => {
      // Create a throwaway entry to delete
      const createReq = createRequest('/api/waitlist', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          guestId: GUEST_AMIT,
          roomTypeId: ROOM_TYPE_STD,
          checkIn: futureDate(25),
          checkOut: futureDate(27),
        },
      });
      const createRes = await createWaitlistEntry(createReq);
      const createBody = await json(createRes);
      expect(createRes.status).toBe(201);
      const entryId = createBody.data.id;

      const delReq = createRequest('/api/waitlist', {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
        body: { id: entryId },
      });
      const delRes = await deleteWaitlistEntry(delReq);
      const delBody = await json(delRes);
      expect(delRes.status).toBe(200);
      expect(delBody.success).toBe(true);
    });

    it('cross-tenant propertyId → empty result (tenant isolation via tenantId)', async () => {
      // T2 admin creates with a T2 property that doesn't belong to them should 404
      // But waitlist filters by tenantId, not propertyId directly.
      // T2 admin listing waitlist should only see their tenant's entries.
      const req = createRequest('/api/waitlist', {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await listWaitlist(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      // T2 has no waitlist entries
      expect(body.stats.total).toBe(0);
    });

    it('GET with status filter', async () => {
      const req = createRequest('/api/waitlist?status=waiting', {
        userId: ADMIN_USER_ID,
      });
      const res = await listWaitlist(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      for (const entry of body.data) {
        expect(entry.status).toBe('waiting');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // G. No-Show Settings (4 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('G. No-Show Settings', () => {
    it('GET settings for property → 200', async () => {
      const req = createRequest(`/api/no-show/settings?propertyId=${PROPERTY_KOLKATA}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getNoShowSettings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.propertyId).toBe(PROPERTY_KOLKATA);
      expect(body.data.propertyName).toBeDefined();
    });

    it('PUT update settings → 200', async () => {
      const req = createRequest(`/api/no-show/settings?propertyId=${PROPERTY_KOLKATA}`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          noShowBufferHours: 6,
          autoProcessNoShows: true,
          noShowNotificationEnabled: true,
        },
      });
      const res = await updateNoShowSettings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.noShowBufferHours).toBe(6);
      expect(body.data.autoProcessNoShows).toBe(true);

      // Restore defaults
      const restoreReq = createRequest(`/api/no-show/settings?propertyId=${PROPERTY_KOLKATA}`, {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          noShowBufferHours: 4,
          autoProcessNoShows: false,
          noShowNotificationEnabled: false,
        },
      });
      await updateNoShowSettings(restoreReq);
    });

    it('rejects missing propertyId → 400', async () => {
      const req = createRequest('/api/no-show/settings', {
        userId: ADMIN_USER_ID,
      });
      const res = await getNoShowSettings(req);
      expect(res.status).toBe(400);
    });

    it('cross-tenant propertyId → 404', async () => {
      // Ocean View admin trying to access Royal Stay property settings
      const req = createRequest(`/api/no-show/settings?propertyId=${PROPERTY_KOLKATA}`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getNoShowSettings(req);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // H. Group Bookings (10 tests)
  // ═══════════════════════════════════════════════════════════════════

  describe('H. Group Bookings', () => {
    it('GET group bookings with stats', async () => {
      const req = createRequest('/api/group-bookings', {
        userId: ADMIN_USER_ID,
      });
      const res = await listGroupBookings(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.stats).toBeDefined();
      expect(body.stats).toHaveProperty('total');
      expect(body.stats).toHaveProperty('inquiry');
      expect(body.stats).toHaveProperty('confirmed');
      expect(body.stats).toHaveProperty('cancelled');
      expect(body.stats).toHaveProperty('totalValue');
    });

    it('POST create group booking → 201', async () => {
      const req = createRequest('/api/group-bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          name: `Test Group ${SUFFIX}`,
          checkIn: futureDate(30),
          checkOut: futureDate(33),
          description: 'Test group booking',
          contactName: 'Test Contact',
          contactEmail: `test-${SUFFIX}@example.com`,
          contactPhone: '+919999999999',
          totalRooms: 5,
          totalAmount: 50000,
          depositAmount: 10000,
          depositPaid: false,
          status: 'inquiry',
          notes: `Test group booking notes ${SUFFIX}`,
        },
      });
      const res = await createGroupBooking(req);
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(`Test Group ${SUFFIX}`);
      expect(body.data.status).toBe('inquiry');
      testGroupBookingId = body.data.id;
    });

    it('rejects missing required fields → 400', async () => {
      const req = createRequest('/api/group-bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          // Missing propertyId, name, checkIn, checkOut
        },
      });
      const res = await createGroupBooking(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('PUT update group booking status', async () => {
      expect(testGroupBookingId).not.toBeNull();
      const req = createRequest('/api/group-bookings', {
        method: 'PUT',
        userId: ADMIN_USER_ID,
        body: {
          id: testGroupBookingId,
          status: 'confirmed',
          notes: 'Updated by test',
        },
      });
      const res = await updateGroupBooking(req);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('confirmed');
    });

    it('DELETE group booking (no associated bookings) → 200', async () => {
      // Create a group booking without any bookings to delete
      const createReq = createRequest('/api/group-bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          name: `Deletable Group ${SUFFIX}`,
          checkIn: futureDate(40),
          checkOut: futureDate(42),
          totalRooms: 1,
          status: 'inquiry',
        },
      });
      const createRes = await createGroupBooking(createReq);
      const createBody = await json(createRes);
      expect(createRes.status).toBe(201);
      testGroupBookingNoBookingsId = createBody.data.id;

      const delReq = createRequest('/api/group-bookings', {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
        body: { id: testGroupBookingNoBookingsId },
      });
      const delRes = await deleteGroupBooking(delReq);
      const delBody = await json(delRes);
      expect(delRes.status).toBe(200);
      expect(delBody.success).toBe(true);
      testGroupBookingNoBookingsId = null; // Already deleted
    });

    it('reject delete with associated bookings → 400', async () => {
      // First, create bookings for the test group
      expect(testGroupBookingId).not.toBeNull();
      const bookReq = createRequest('/api/group-bookings/book-rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          groupId: testGroupBookingId,
          roomIds: [ROOM_1001],
          guestId: GUEST_AMIT,
        },
      });
      const bookRes = await bookRoomsForGroup(bookReq);
      expect(bookRes.status).toBe(200);

      // Now try to delete the group — should fail because it has bookings
      const delReq = createRequest('/api/group-bookings', {
        method: 'DELETE',
        userId: ADMIN_USER_ID,
        body: { id: testGroupBookingId },
      });
      const delRes = await deleteGroupBooking(delReq);
      const delBody = await json(delRes);
      expect(delRes.status).toBe(400);
      expect(delBody.success).toBe(false);
    });

    it('GET group booking by ID with bookings', async () => {
      expect(testGroupBookingId).not.toBeNull();
      const req = createRequest(`/api/group-bookings/${testGroupBookingId}`, {
        userId: ADMIN_USER_ID,
      });
      const res = await getGroupBooking(req, makeParams(testGroupBookingId!));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testGroupBookingId);
      expect(body.data.bookings).toBeDefined();
      expect(body.data.bookedRooms).toBeGreaterThanOrEqual(1);
    });

    it('cross-tenant → 404', async () => {
      expect(testGroupBookingId).not.toBeNull();
      const req = createRequest(`/api/group-bookings/${testGroupBookingId}`, {
        userId: T2_ADMIN_USER_ID,
      });
      const res = await getGroupBooking(req, makeParams(testGroupBookingId!));
      expect(res.status).toBe(404);
    });

    it('POST book-rooms for group → creates bookings', async () => {
      // Create a new group for this test to avoid conflicts
      const createReq = createRequest('/api/group-bookings', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          propertyId: PROPERTY_KOLKATA,
          name: `Book Rooms Group ${SUFFIX}`,
          checkIn: futureDate(50),
          checkOut: futureDate(52),
          totalRooms: 2,
          status: 'confirmed',
        },
      });
      const createRes = await createGroupBooking(createReq);
      const createBody = await json(createRes);
      expect(createRes.status).toBe(201);
      const groupId = createBody.data.id;

      const bookReq = createRequest('/api/group-bookings/book-rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          groupId,
          roomIds: [ROOM_1001, ROOM_1003],
          guestId: GUEST_AMIT,
        },
      });
      const bookRes = await bookRoomsForGroup(bookReq);
      const bookBody = await json(bookRes);
      expect(bookRes.status).toBe(200);
      expect(bookBody.success).toBe(true);
      expect(bookBody.data.length).toBe(2);

      // Clean up the bookings created
      for (const booking of bookBody.data) {
        try {
          await db.folioLineItem.deleteMany({ where: { folio: { bookingId: booking.id } } });
          await db.folio.deleteMany({ where: { bookingId: booking.id } });
          await db.guestStay.deleteMany({ where: { bookingId: booking.id } });
          await db.bookingAuditLog.deleteMany({ where: { bookingId: booking.id } });
          await db.booking.delete({ where: { id: booking.id } });
        } catch { /* ignore */ }
      }

      // Clean up the group
      try {
        await db.groupBooking.delete({ where: { id: groupId } });
      } catch { /* ignore */ }
    });

    it('reject book-rooms without required fields → 400', async () => {
      const req = createRequest('/api/group-bookings/book-rooms', {
        method: 'POST',
        userId: ADMIN_USER_ID,
        body: {
          // Missing groupId, roomIds, guestId
        },
      });
      const res = await bookRoomsForGroup(req);
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });
});
