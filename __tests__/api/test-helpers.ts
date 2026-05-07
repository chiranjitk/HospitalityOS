/**
 * Shared test helpers for API route tests.
 *
 * Creates authenticated Request objects using a real session token
 * from the seed database so that getUserFromRequest() succeeds.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// ─── Seed data IDs (from database) ───
export const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
export const USER_ID = 'b763e2df-7bf1-4de8-94f8-97a1f1e7a0ec';
export const PROPERTY_ID = '281fde73-7836-4511-b644-91f3663d8fcd'; // Royal Stay Kolkata
export const PROPERTY_2_ID = '600daed4-4d6a-4cb2-a07e-46bec7f4c43b'; // Royal Stay Darjeeling
export const ROOM_TYPE_ID = '4d5269a2-63ad-48e7-8683-4b0efca11567'; // Standard Room (Kolkata)
export const GUEST_ID = 'cb127462-1b96-4e37-8f78-65bbd0493ee1'; // Amit Mukherjee
export const BOOKING_ID = 'b544cc77-46a6-4e53-921e-50db663eb482'; // RS-2024-001 (checked_in)
export const FOLIO_ID = '6562be0c-1585-4355-8c48-96dc8368240e'; // FOL-KOL-0001 (open)
export const REVENUE_ACCOUNT_ID = '07079ad4-4902-4a2c-ba5c-6e84693139bf';

// Session token for the admin user (will be resolved at runtime)
let _sessionToken: string | null = null;

export async function getSessionToken(): Promise<string> {
  if (_sessionToken) return _sessionToken;
  const session = await db.session.findFirst({
    where: { userId: USER_ID },
    select: { token: true },
  });
  if (!session) throw new Error('No session found for test user. Run seed first.');
  _sessionToken = session.token;
  return _sessionToken!;
}

/**
 * Create an authenticated NextRequest with session cookie.
 * Uses NextRequest so that request.cookies.get() works in route handlers.
 */
export async function createAuthRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<NextRequest> {
  const token = await getSessionToken();
  const { method = 'GET', body, headers = {} } = options;

  const reqHeaders: Record<string, string> = {
    ...headers,
    Cookie: `session_token=${token}`,
  };

  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  return new NextRequest(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper to create a NextRequest-like URL for dynamic route params.
 * Some route handlers use request.nextUrl.searchParams, so we create
 * a proper URL-based request.
 */
export function buildUrl(path: string, params?: Record<string, string>): string {
  const base = 'http://localhost:3000';
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/**
 * Unique suffix generator for test data isolation.
 */
let counter = 0;
export function uniqueSuffix(): string {
  counter++;
  return `t${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Create a property + room + booking + folio test fixture for features that need them.
 * Returns IDs that can be used in test requests.
 */
export async function createTestFixture() {
  const suffix = uniqueSuffix();

  // Create a room for the property (connect to existing room type)
  const room = await db.room.create({
    data: {
      propertyId: PROPERTY_ID,
      roomTypeId: ROOM_TYPE_ID,
      number: `RM-${suffix.slice(-6)}`,
      floor: 1,
      status: 'available',
    },
  });

  // Create a guest
  const guest = await db.guest.create({
    data: {
      tenantId: TENANT_ID,
      firstName: `Test${suffix.slice(-4)}`,
      lastName: 'Guest',
      email: `test${suffix.slice(-4)}@test.com`,
      phone: '+919999999999',
    },
  });

  // Create a booking
  const booking = await db.booking.create({
    data: {
      tenantId: TENANT_ID,
      property: { connect: { id: PROPERTY_ID } },
      room: { connect: { id: room.id } },
      roomType: { connect: { id: ROOM_TYPE_ID } },
      primaryGuest: { connect: { id: guest.id } },
      status: 'confirmed',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      roomRate: 5000,
      totalAmount: 15000,
      confirmationCode: `TC-${suffix.slice(-8)}`,
    },
  });

  // Create an open folio for the booking
  const folio = await db.folio.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      booking: { connect: { id: booking.id } },
      guestId: guest.id,
      folioNumber: `FOL-TEST-${suffix.slice(-6)}`,
      status: 'open',
      subtotal: 0,
      totalAmount: 0,
      balance: 0,
    },
  });

  return {
    room,
    guest,
    booking,
    folio,
    cleanup: async () => {
      await db.folioLineItem.deleteMany({ where: { folioId: folio.id } });
      await db.folio.delete({ where: { id: folio.id } });
      await db.booking.delete({ where: { id: booking.id } });
      await db.guest.delete({ where: { id: guest.id } });
      await db.room.delete({ where: { id: room.id } });
    },
  };
}
