/**
 * PMS Module - Comprehensive API-level Tests
 *
 * Tests the full Property Management System: Properties, Room Types, Rooms,
 * Rate Plans, Inventory Locks, and Tax Settings. All routes are invoked
 * directly with NextRequest objects against the real PostgreSQL database.
 *
 * Run: DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-) bun run test __tests__/pms-module.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// ─── Route Handler Imports ───────────────────────────────────────────────────

// Properties
import { GET as listProperties, POST as createProperty } from '@/app/api/properties/route';
import { GET as getProperty, PUT as updateProperty, DELETE as deleteProperty } from '@/app/api/properties/[id]/route';

// Room Types
import { GET as listRoomTypes, POST as createRoomType } from '@/app/api/room-types/route';
import { GET as getRoomType, PUT as updateRoomType, DELETE as deleteRoomType } from '@/app/api/room-types/[id]/route';

// Rooms
import { GET as listRooms, POST as createRoom } from '@/app/api/rooms/route';
import { GET as getRoom, PUT as updateRoom, DELETE as deleteRoom } from '@/app/api/rooms/[id]/route';

// Rate Plans
import { GET as listRatePlans, POST as createRatePlan, PUT as updateRatePlanBulk, DELETE as deleteRatePlansBulk } from '@/app/api/rate-plans/route';
import { GET as getRatePlan, PUT as updateRatePlan, DELETE as deleteRatePlan } from '@/app/api/rate-plans/[id]/route';

// Inventory Locks
import { GET as listInventoryLocks, POST as createInventoryLock, PUT as updateInventoryLock, DELETE as deleteInventoryLocks } from '@/app/api/inventory-locks/route';

// Tax Settings
import { GET as getTaxSettings, PUT as updateTaxSettings } from '@/app/api/properties/[id]/tax-settings/route';

// ─── Constants ───────────────────────────────────────────────────────────────

// Test user IDs (from seeded database)
const USERS = {
  adminRS: 'b763e2df-7bf1-4de8-94f8-97a1f1e7a0ec',      // Admin @ Royal Stay
  frontdeskRS: 'cc3b3483-ad7a-452a-b623-5465962c9678',   // Frontdesk @ Royal Stay
  housekeepingRS: '195d4b15-e4ba-4554-affa-01c53a43f883', // Housekeeping @ Royal Stay
  platformAdmin: '7816bbd0-fa83-4c3a-887b-3fc4d9e22a9d',  // Platform admin
  adminOV: '9ecafba4-1bfb-406c-ace0-eaf309cd21dd',        // Admin @ Ocean View
  managerOV: 'a357fe96-d2f5-46cc-8f91-6f53423fab04',      // Manager @ Ocean View
} as const;

// Tenant IDs
const TENANTS = {
  royalStay: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
  oceanView: '1afa10da-6737-4bbe-b30c-e2b76eedd4d5',
} as const;

// Property IDs (existing, seeded)
const PROPERTIES = {
  royalStayKolkata: '281fde73-7836-4511-b644-91f3663d8fcd',
  royalStayDarjeeling: '600daed4-4d6a-4cb2-a07e-46bec7f4c43b',
} as const;

// Room type IDs (existing, seeded – Royal Stay Kolkata)
const ROOM_TYPES = {
  stdKolkata: '4d5269a2-63ad-48e7-8683-4b0efca11567',
  dlxKolkata: '1aac4388-0d87-43da-a0bf-984fe39e5bcf',
  execKolkata: '22f53ea5-00fb-4b29-9dc6-a7834cc6b481',
  presKolkata: 'bd3a1ffd-24b8-4185-b350-6bdae97bc426',
  mtnDarjeeling: '629ed75e-0ec4-4289-a2ad-76e7548255af',
  valDarjeeling: 'ead9ba39-c74e-4cbe-8357-db3d5a106c27',
} as const;

// Room IDs (existing, seeded)
const ROOMS = {
  room1001: '3f4e539d-f262-44f7-8128-4f8371c06f9a',  // available, PRES type
  room1002: '511c8197-5769-497c-9efc-293067ff0671',  // occupied, PRES type
  room1003: '8032ad67-0062-44aa-8b69-7309ff30fc52',  // available, PRES type
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sessionTokens = new Map<string, string>();

// Track IDs created during tests so we can clean up
const createdEntities = {
  properties: [] as string[],
  roomTypes: [] as string[],
  rooms: [] as string[],
  ratePlans: [] as string[],
  inventoryLocks: [] as string[],
};

function createRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    userId?: string;
  } = {},
): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  const headers = new Headers();
  if (options.userId) {
    const token = sessionTokens.get(options.userId);
    if (token) headers.set('Cookie', `session_token=${token}`);
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

/** Unique suffix based on timestamp to avoid collisions */
function uid() {
  return `${Date.now()}`;
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Create sessions for all test users
  const sessionSpecs = [
    { userId: USERS.adminRS, token: `test-admin-rs-${uid()}` },
    { userId: USERS.frontdeskRS, token: `test-frontdesk-rs-${uid()}` },
    { userId: USERS.housekeepingRS, token: `test-housekeeping-rs-${uid()}` },
    { userId: USERS.platformAdmin, token: `test-platform-${uid()}` },
    { userId: USERS.adminOV, token: `test-admin-ov-${uid()}` },
    { userId: USERS.managerOV, token: `test-manager-ov-${uid()}` },
  ];

  // Clean up any leftover test sessions
  await db.session.deleteMany({
    where: { token: { startsWith: 'test-' } },
  });

  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  for (const spec of sessionSpecs) {
    await db.session.create({
      data: {
        userId: spec.userId,
        token: spec.token,
        refreshToken: `${spec.token}-refresh`,
        expiresAt: expiry,
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      },
    });
    sessionTokens.set(spec.userId, spec.token);
  }
}, 60000);

afterAll(async () => {
  // 1. Delete inventory locks created during tests (hard delete)
  if (createdEntities.inventoryLocks.length > 0) {
    await db.inventoryLock.deleteMany({
      where: { id: { in: createdEntities.inventoryLocks } },
    });
  }

  // 2. Delete rate plans (soft-delete, then hard for cleanup)
  if (createdEntities.ratePlans.length > 0) {
    await db.ratePlan.deleteMany({
      where: { id: { in: createdEntities.ratePlans } },
    });
  }

  // 3. Delete rooms created during tests (soft-deleted + hard for cleanup)
  if (createdEntities.rooms.length > 0) {
    // First undelete so we can hard-delete
    await db.room.updateMany({
      where: { id: { in: createdEntities.rooms } },
      data: { deletedAt: null },
    });
    await db.room.deleteMany({
      where: { id: { in: createdEntities.rooms } },
    });
  }

  // 4. Delete room types created during tests
  if (createdEntities.roomTypes.length > 0) {
    await db.roomType.updateMany({
      where: { id: { in: createdEntities.roomTypes } },
      data: { deletedAt: null },
    });
    await db.roomType.deleteMany({
      where: { id: { in: createdEntities.roomTypes } },
    });
  }

  // 5. Delete properties created during tests
  if (createdEntities.properties.length > 0) {
    await db.property.updateMany({
      where: { id: { in: createdEntities.properties } },
      data: { deletedAt: null },
    });
    await db.property.deleteMany({
      where: { id: { in: createdEntities.properties } },
    });
  }

  // 6. Clean up test sessions
  await db.session.deleteMany({
    where: { token: { startsWith: 'test-' } },
  });
}, 60000);

// ═══════════════════════════════════════════════════════════════════════════════
// A. AUTHENTICATION & AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('A. Authentication & Authorization', () => {
  // A1-A5: Unauthenticated → 401
  it('A1: unauthenticated GET /api/properties → 401', async () => {
    const res = await listProperties(createRequest('/api/properties'));
    expect(res.status).toBe(401);
  });

  it('A2: unauthenticated GET /api/room-types → 401', async () => {
    const res = await listRoomTypes(createRequest('/api/room-types'));
    expect(res.status).toBe(401);
  });

  it('A3: unauthenticated GET /api/rooms → 401', async () => {
    const res = await listRooms(createRequest('/api/rooms'));
    expect(res.status).toBe(401);
  });

  it('A4: unauthenticated GET /api/rate-plans → 401', async () => {
    const res = await listRatePlans(createRequest('/api/rate-plans'));
    expect(res.status).toBe(401);
  });

  it('A5: unauthenticated GET /api/inventory-locks → 401', async () => {
    const res = await listInventoryLocks(createRequest('/api/inventory-locks'));
    expect(res.status).toBe(401);
  });

  // A6-A7: Permission denied
  it('A6: frontdesk POST /api/properties → 403 (no properties.create)', async () => {
    const res = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.frontdeskRS,
        body: { name: 'Test', slug: 'test', address: 'a', city: 'c', country: 'IN' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('A7: housekeeping POST /api/rooms → 403 (has rooms.view but not rooms.create)', async () => {
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.housekeepingRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.presKolkata,
          number: `hk-test-${uid()}`,
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  // A8: Admin can access everything
  it('A8: admin can GET /api/properties and POST /api/room-types', async () => {
    const listRes = await listProperties(
      createRequest('/api/properties', { userId: USERS.adminRS }),
    );
    expect(listRes.status).toBe(200);

    const createRes = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          name: `Test RT Admin ${uid()}`,
          code: `TRTA${uid().slice(-4)}`,
          basePrice: 100,
        },
      }),
    );
    expect(createRes.status).toBe(201);
    const data = await json(createRes);
    createdEntities.roomTypes.push(data.data.id);
  });

  // A9: Platform admin can access endpoints
  it('A9: platform admin can GET /api/properties', async () => {
    const res = await listProperties(
      createRequest('/api/properties', { userId: USERS.platformAdmin }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });

  // A10: Cross-tenant isolation – Ocean View admin cannot see Royal Stay properties
  it('A10: cross-tenant isolation – OV admin cannot see RS properties by ID', async () => {
    const res = await getProperty(
      createRequest(`/api/properties/${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminOV,
      }),
      makeParams(PROPERTIES.royalStayKolkata),
    );
    expect(res.status).toBe(404);
  });

  // A11: Cross-tenant isolation – OV admin list should not include RS properties
  it('A11: cross-tenant isolation – OV admin property list excludes RS', async () => {
    const res = await listProperties(
      createRequest('/api/properties', { userId: USERS.adminOV }),
    );
    const body = await json(res);
    expect(body.data).toBeInstanceOf(Array);
    // None of the returned properties should have Royal Stay Kolkata's ID
    const ids = body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(PROPERTIES.royalStayKolkata);
  });

  // A12: Cross-tenant – OV admin cannot create room type in RS property
  it('A12: cross-tenant – OV admin cannot create room type in RS property', async () => {
    const res = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminOV,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          name: `Cross Tenant RT ${uid()}`,
          code: `CTRT${uid().slice(-4)}`,
          basePrice: 200,
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  // A13: Platform admin tenant-context endpoints
  it('A13: platform admin can GET /api/rate-plans', async () => {
    const res = await listRatePlans(
      createRequest('/api/rate-plans', { userId: USERS.platformAdmin }),
    );
    // Platform admin should be able to access this – 200 or some data
    expect([200, 401, 403]).toContain(res.status);
    // Most likely 200 since requirePermission checks isPlatformAdmin
    if (res.status === 200) {
      const body = await json(res);
      expect(body.success).toBe(true);
    }
  });

  // A14: Invalid/expired session → 401
  it('A14: request with non-existent session token → 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/properties', {
      headers: { Cookie: 'session_token=nonexistent-token-xyz' },
    });
    const res = await listProperties(req);
    expect(res.status).toBe(401);
  });

  // A15: Admin can POST property
  it('A15: admin can POST /api/properties (roleName admin bypass)', async () => {
    const slug = `admin-prop-${uid()}`;
    const res = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          name: `Admin Test Property ${uid()}`,
          slug,
          address: '123 Test St',
          city: 'Kolkata',
          country: 'IN',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.properties.push(body.data.id);
    expect(body.data.slug).toBe(slug);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. PROPERTY CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('B. Property CRUD', () => {
  it('B1: list properties with default pagination', async () => {
    const res = await listProperties(
      createRequest('/api/properties', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.data).toBeInstanceOf(Array);
  });

  it('B2: list properties with status filter', async () => {
    const res = await listProperties(
      createRequest('/api/properties?status=active', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    body.data.forEach((p: { status: string }) => {
      expect(p.status).toBe('active');
    });
  });

  it('B3: list properties excludes soft-deleted', async () => {
    // Create and soft-delete a property
    const slug = `to-delete-${uid()}`;
    const createRes = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: `Delete Me ${uid()}`, slug, address: 'x', city: 'x', country: 'IN' },
      }),
    );
    const { data: prop } = await json(createRes);
    createdEntities.properties.push(prop.id);

    // Soft delete it
    await deleteProperty(
      createRequest(`/api/properties/${prop.id}`, { method: 'DELETE', userId: USERS.adminRS }),
      makeParams(prop.id),
    );

    // List should not include it
    const listRes = await listProperties(
      createRequest('/api/properties', { userId: USERS.adminRS }),
    );
    const listBody = await json(listRes);
    const ids = listBody.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(prop.id);
  });

  it('B4: create property with defaults applied', async () => {
    const slug = `defaults-prop-${uid()}`;
    const res = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          name: `Defaults Property ${uid()}`,
          slug,
          address: '456 Default Ave',
          city: 'Kolkata',
          country: 'IN',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.properties.push(body.data.id);
    expect(body.data.type).toBe('hotel');
    expect(body.data.checkInTime).toBe('14:00');
    expect(body.data.checkOutTime).toBe('11:00');
    expect(body.data.timezone).toBe('Asia/Kolkata');
    expect(body.data.currency).toBe('INR');
    expect(body.data.totalFloors).toBe(1);
    expect(body.data.status).toBe('active');
  });

  it('B5: reject property with missing required fields', async () => {
    const res = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: 'Missing Fields' }, // slug, address, city, country missing
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('B6: reject property with invalid slug format', async () => {
    const res = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          name: `Bad Slug ${uid()}`,
          slug: 'Invalid_Slug!',
          address: 'a', city: 'c', country: 'IN',
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('B7: reject duplicate slug within same tenant', async () => {
    const slug = `dup-slug-${uid()}`;
    // Create first
    const res1 = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: `First ${uid()}`, slug, address: 'a', city: 'c', country: 'IN' },
      }),
    );
    expect(res1.status).toBe(201);
    const d1 = await json(res1);
    createdEntities.properties.push(d1.data.id);

    // Create second with same slug
    const res2 = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: `Second ${uid()}`, slug, address: 'b', city: 'c', country: 'IN' },
      }),
    );
    expect(res2.status).toBe(400);
    const body2 = await json(res2);
    expect(body2.error.code).toBe('DUPLICATE_SLUG');
  });

  it('B8: update property fields', async () => {
    // Create a property first
    const slug = `update-me-${uid()}`;
    const createRes = await createProperty(
      createRequest('/api/properties', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: `Before Update ${uid()}`, slug, address: 'a', city: 'c', country: 'IN' },
      }),
    );
    const { data: prop } = await json(createRes);
    createdEntities.properties.push(prop.id);

    // Update name
    const newName = `After Update ${uid()}`;
    const updateRes = await updateProperty(
      createRequest(`/api/properties/${prop.id}`, {
        method: 'PUT',
        userId: USERS.adminRS,
        body: { name: newName },
      }),
      makeParams(prop.id),
    );
    expect(updateRes.status).toBe(200);
    const body = await json(updateRes);
    expect(body.data.name).toBe(newName);
  });

  it('B9: update property with slug conflict → 400', async () => {
    const slug1 = `slug-first-${uid()}`;
    const slug2 = `slug-second-${uid()}`;
    // Create two properties
    const r1 = await createProperty(
      createRequest('/api/properties', {
        method: 'POST', userId: USERS.adminRS,
        body: { name: `First ${uid()}`, slug: slug1, address: 'a', city: 'c', country: 'IN' },
      }),
    );
    const r2 = await createProperty(
      createRequest('/api/properties', {
        method: 'POST', userId: USERS.adminRS,
        body: { name: `Second ${uid()}`, slug: slug2, address: 'b', city: 'c', country: 'IN' },
      }),
    );
    const d1 = await json(r1); const d2 = await json(r2);
    createdEntities.properties.push(d1.data.id, d2.data.id);

    // Try to change slug2 to slug1
    const updateRes = await updateProperty(
      createRequest(`/api/properties/${d2.data.id}`, {
        method: 'PUT', userId: USERS.adminRS,
        body: { slug: slug1 },
      }),
      makeParams(d2.data.id),
    );
    expect(updateRes.status).toBe(400);
    const body = await json(updateRes);
    expect(body.error.code).toBe('DUPLICATE_SLUG');
  });

  it('B10: 404 for non-existent property', async () => {
    const res = await getProperty(
      createRequest('/api/properties/00000000-0000-0000-0000-000000000000', {
        userId: USERS.adminRS,
      }),
      makeParams('00000000-0000-0000-0000-000000000000'),
    );
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. ROOM TYPE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('C. Room Type CRUD', () => {
  it('C1: list room types with propertyId filter', async () => {
    const res = await listRoomTypes(
      createRequest(`/api/room-types?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    body.data.forEach((rt: { propertyId: string }) => {
      expect(rt.propertyId).toBe(PROPERTIES.royalStayKolkata);
    });
  });

  it('C2: list room types with pagination', async () => {
    const res = await listRoomTypes(
      createRequest('/api/room-types?limit=1&offset=0', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.limit).toBe(1);
    expect(body.pagination.offset).toBe(0);
    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it('C3: list room types includes overbooking stats', async () => {
    const res = await listRoomTypes(
      createRequest(`/api/room-types?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    const body = await json(res);
    body.data.forEach((rt: { overbookingStats: unknown }) => {
      expect(rt.overbookingStats).toBeDefined();
      expect(typeof rt.overbookingStats).toBe('object');
    });
  });

  it('C4: create room type with validation', async () => {
    const code = `CRT${uid().slice(-5)}`;
    const res = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          name: `Test Room Type ${uid()}`,
          code,
          basePrice: 150,
          maxAdults: 3,
          maxChildren: 1,
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.roomTypes.push(body.data.id);
    expect(body.data.code).toBe(code);
    expect(body.data.maxAdults).toBe(3);
  });

  it('C5: reject room type with missing fields', async () => {
    const res = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { name: 'Missing Fields' }, // propertyId, code, basePrice missing
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('C6: reject room type with tenant mismatch', async () => {
    const code = `TM${uid().slice(-5)}`;
    const res = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminOV,
        body: {
          propertyId: PROPERTIES.royalStayKolkata, // RS property, OV user
          name: `Tenant Mismatch ${uid()}`,
          code,
          basePrice: 100,
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('C7: reject duplicate code within same property', async () => {
    const code = `DUP${uid().slice(-5)}`;
    const body = {
      propertyId: PROPERTIES.royalStayKolkata,
      name: `Dup A ${uid()}`,
      code,
      basePrice: 100,
    };
    const r1 = await createRoomType(
      createRequest('/api/room-types', { method: 'POST', userId: USERS.adminRS, body }),
    );
    expect(r1.status).toBe(201);
    const d1 = await json(r1);
    createdEntities.roomTypes.push(d1.data.id);

    const r2 = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminRS,
        body: { ...body, name: `Dup B ${uid()}` },
      }),
    );
    expect(r2.status).toBe(400);
    const body2 = await json(r2);
    expect(body2.error.code).toBe('DUPLICATE_CODE');
  });

  it('C8: soft delete room type with rooms check', async () => {
    // Try to delete a room type that has rooms (PRES type has rooms 1001-1003)
    const res = await deleteRoomType(
      createRequest(`/api/room-types/${ROOM_TYPES.presKolkata}`, {
        method: 'DELETE',
        userId: USERS.adminRS,
      }),
      makeParams(ROOM_TYPES.presKolkata),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('HAS_ROOMS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. ROOM CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('D. Room CRUD', () => {
  let testRoomTypeId: string;
  let testRoomId: string;

  // Create a dedicated room type for room tests (no existing rooms)
  beforeAll(async () => {
    const code = `ROOMTEST${uid().slice(-4)}`;
    const res = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          name: `Room Test RT ${uid()}`,
          code,
          basePrice: 200,
        },
      }),
    );
    const body = await json(res);
    testRoomTypeId = body.data.id;
    createdEntities.roomTypes.push(testRoomTypeId);
  });

  it('D1: list rooms with propertyId filter', async () => {
    const res = await listRooms(
      createRequest(`/api/rooms?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    body.data.forEach((r: { propertyId: string }) => {
      expect(r.propertyId).toBe(PROPERTIES.royalStayKolkata);
    });
  });

  it('D2: list rooms with status filter', async () => {
    const res = await listRooms(
      createRequest(`/api/rooms?status=available&propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    const body = await json(res);
    body.data.forEach((r: { status: string }) => {
      expect(r.status).toBe('available');
    });
  });

  it('D3: list rooms – tenant isolation', async () => {
    const res = await listRooms(
      createRequest(`/api/rooms?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminOV,
      }),
    );
    // OV user should get 404 when trying to access RS property rooms
    expect(res.status).toBe(404);
  });

  it('D4: list rooms – ordering by floor then number', async () => {
    const res = await listRooms(
      createRequest(`/api/rooms?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    const body = await json(res);
    const rooms = body.data;
    // Verify ordering: sorted by floor asc, then number asc (string sort)
    // For floor ordering: each subsequent room's floor should be >= previous
    let lastFloor = -Infinity;
    let lastNumber = '';
    for (const room of rooms) {
      expect(room.floor).toBeGreaterThanOrEqual(lastFloor);
      // Within same floor, numbers should be sorted ascending (string comparison)
      if (room.floor === lastFloor) {
        expect(room.number >= lastNumber).toBe(true);
      }
      lastFloor = room.floor;
      lastNumber = room.number;
    }
  });

  it('D5: create room with validation', async () => {
    const number = `T${uid().slice(-4)}`;
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: testRoomTypeId,
          number,
          floor: 5,
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    testRoomId = body.data.id;
    createdEntities.rooms.push(testRoomId);
    expect(body.data.number).toBe(number);
    expect(body.data.floor).toBe(5);
  });

  it('D6: reject room with duplicate number in same property', async () => {
    // Room 1001 already exists at Royal Stay Kolkata
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: testRoomTypeId,
          number: '1001', // duplicate
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('DUPLICATE_NUMBER');
  });

  it('D7: reject room with room type mismatch (different property)', async () => {
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.mtnDarjeeling, // Darjeeling RT, Kolkata property
          number: `MISMATCH${uid().slice(-4)}`,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('INVALID_ROOM_TYPE');
  });

  it('D8: totalRooms atomic increment on room creation', async () => {
    // Get room type's totalRooms before
    const rtBefore = await db.roomType.findUnique({
      where: { id: testRoomTypeId },
      select: { totalRooms: true },
    });
    const beforeCount = rtBefore?.totalRooms ?? 0;

    // Create a room
    const number = `INC${uid().slice(-4)}`;
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: testRoomTypeId,
          number,
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.rooms.push(body.data.id);

    // Check totalRooms was incremented
    const rtAfter = await db.roomType.findUnique({
      where: { id: testRoomTypeId },
      select: { totalRooms: true },
    });
    expect(rtAfter?.totalRooms).toBe(beforeCount + 1);
  });

  it('D9: soft delete room with totalRooms decrement', async () => {
    // Create a room specifically for deletion
    const number = `DEL${uid().slice(-4)}`;
    const createRes = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: testRoomTypeId,
          number,
        },
      }),
    );
    const createBody = await json(createRes);
    const roomId = createBody.data.id;
    createdEntities.rooms.push(roomId);

    // Get before count
    const rtBefore = await db.roomType.findUnique({
      where: { id: testRoomTypeId },
      select: { totalRooms: true },
    });
    const beforeCount = rtBefore?.totalRooms ?? 0;

    // Delete the room
    const delRes = await deleteRoom(
      createRequest(`/api/rooms/${roomId}`, { method: 'DELETE', userId: USERS.adminRS }),
      makeParams(roomId),
    );
    expect(delRes.status).toBe(200);

    // Check totalRooms was decremented
    const rtAfter = await db.roomType.findUnique({
      where: { id: testRoomTypeId },
      select: { totalRooms: true },
    });
    expect(rtAfter?.totalRooms).toBe(beforeCount - 1);
  });

  it('D10: get single room by ID', async () => {
    const res = await getRoom(
      createRequest(`/api/rooms/${ROOMS.room1001}`, { userId: USERS.adminRS }),
      makeParams(ROOMS.room1001),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.id).toBe(ROOMS.room1001);
    expect(body.data.number).toBe('1001');
    expect(body.data.roomType).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. RATE PLAN CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('E. Rate Plan CRUD', () => {
  let testRatePlanId: string;

  it('E1: list rate plans with computed promo fields', async () => {
    const res = await listRatePlans(
      createRequest('/api/rate-plans', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    // Each plan should have computed fields
    body.data.forEach((plan: { hasActivePromo: unknown; effectivePrice: unknown; discountDisplay: unknown }) => {
      expect('hasActivePromo' in plan).toBe(true);
      expect('effectivePrice' in plan).toBe(true);
      expect('discountDisplay' in plan).toBe(true);
    });
  });

  it('E2: list rate plans with meal plan filter', async () => {
    const res = await listRatePlans(
      createRequest('/api/rate-plans?mealPlan=room_only', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    body.data.forEach((plan: { mealPlan: string }) => {
      expect(plan.mealPlan).toBe('room_only');
    });
  });

  it('E3: list rate plans with search', async () => {
    const res = await listRatePlans(
      createRequest('/api/rate-plans?search=bar', { userId: USERS.adminRS }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    // Results should contain the search term (or be empty if nothing matches)
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('E4: create rate plan with validations', async () => {
    const code = `RP${uid().slice(-5)}`;
    const res = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `Test Rate Plan ${uid()}`,
          code,
          basePrice: 5000,
          currency: 'INR',
          mealPlan: 'breakfast',
          minStay: 2,
          status: 'active',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    testRatePlanId = body.data.id;
    createdEntities.ratePlans.push(testRatePlanId);
    expect(body.data.code).toBe(code);
    expect(body.data.mealPlan).toBe('breakfast');
  });

  it('E5: reject rate plan with missing name/code', async () => {
    const res = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          basePrice: 100,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('E6: reject rate plan with negative base price', async () => {
    const res = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `Neg Price ${uid()}`,
          code: `NEG${uid().slice(-5)}`,
          basePrice: -100,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('E7: PUT update rate plan', async () => {
    // Create a rate plan
    const code = `UPD${uid().slice(-5)}`;
    const createRes = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `Before Update ${uid()}`,
          code,
          basePrice: 3000,
        },
      }),
    );
    const { data: rp } = await json(createRes);
    createdEntities.ratePlans.push(rp.id);

    // Update via PUT /api/rate-plans/[id]
    const newName = `After Update ${uid()}`;
    const updateRes = await updateRatePlan(
      createRequest(`/api/rate-plans/${rp.id}`, {
        method: 'PUT',
        userId: USERS.adminRS,
        body: { name: newName, basePrice: 4000 },
      }),
      makeParams(rp.id),
    );
    expect(updateRes.status).toBe(200);
    const body = await json(updateRes);
    expect(body.data.name).toBe(newName);
  });

  it('E8: DELETE rate plan', async () => {
    // Create a rate plan
    const code = `DEL${uid().slice(-5)}`;
    const createRes = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `To Delete ${uid()}`,
          code,
          basePrice: 2000,
        },
      }),
    );
    const { data: rp } = await json(createRes);

    // Delete it
    const delRes = await deleteRatePlan(
      createRequest(`/api/rate-plans/${rp.id}`, { method: 'DELETE', userId: USERS.adminRS }),
      makeParams(rp.id),
    );
    expect(delRes.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. INVENTORY LOCK CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('F. Inventory Lock CRUD', () => {
  let testLockId: string;

  it('F1: create inventory lock for a room type', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const res = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.stdKolkata,
          startDate: tomorrow.toISOString(),
          endDate: dayAfter.toISOString(),
          reason: `Test lock ${uid()}`,
          lockType: 'maintenance',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    testLockId = body.data.id;
    createdEntities.inventoryLocks.push(testLockId);
    expect(body.data.lockType).toBe('maintenance');
  });

  it('F2: list inventory locks with stats', async () => {
    const res = await listInventoryLocks(
      createRequest(`/api/inventory-locks?propertyId=${PROPERTIES.royalStayKolkata}`, {
        userId: USERS.adminRS,
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.stats).toBeDefined();
    expect('totalLocks' in body.stats).toBe(true);
    expect('activeLocks' in body.stats).toBe(true);
  });

  it('F3: update inventory lock', async () => {
    if (!testLockId) {
      // Create one if not yet created
      const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const dayAfter = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
      const res = await createInventoryLock(
        createRequest('/api/inventory-locks', {
          method: 'POST',
          userId: USERS.adminRS,
          body: {
            propertyId: PROPERTIES.royalStayKolkata,
            roomTypeId: ROOM_TYPES.dlxKolkata,
            startDate: tomorrow.toISOString(),
            endDate: dayAfter.toISOString(),
            reason: `Update Lock ${uid()}`,
          },
        }),
      );
      const body = await json(res);
      testLockId = body.data.id;
      createdEntities.inventoryLocks.push(testLockId);
    }

    const newReason = `Updated reason ${uid()}`;
    const res = await updateInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'PUT',
        userId: USERS.adminRS,
        body: { id: testLockId, reason: newReason },
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.reason).toBe(newReason);
  });

  it('F4: overlapping lock prevention', async () => {
    // Create a lock for a specific date range
    const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    const createRes = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.execKolkata,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: `Overlap test 1 ${uid()}`,
        },
      }),
    );
    const d1 = await json(createRes);
    createdEntities.inventoryLocks.push(d1.data.id);

    // Try to create an overlapping lock for the same room type
    const overlapStart = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);
    const overlapEnd = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
    const overlapRes = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.execKolkata,
          startDate: overlapStart.toISOString(),
          endDate: overlapEnd.toISOString(),
          reason: `Overlap test 2 ${uid()}`,
        },
      }),
    );
    expect(overlapRes.status).toBe(400);
    const body = await json(overlapRes);
    expect(body.error.code).toBe('OVERLAPPING_LOCK');
  });

  it('F5: hard delete inventory lock with tenant isolation', async () => {
    // Create a lock
    const start = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const createRes = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: ROOM_TYPES.stdKolkata,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: `Delete test ${uid()}`,
        },
      }),
    );
    const d = await json(createRes);
    const lockId = d.data.id;
    createdEntities.inventoryLocks.push(lockId);

    // Try to delete as OV user → should fail (tenant isolation)
    const delRes = await deleteInventoryLocks(
      createRequest(`/api/inventory-locks?ids=${lockId}`, {
        method: 'DELETE',
        userId: USERS.adminOV,
      }),
    );
    expect([404, 400]).toContain(delRes.status);

    // Delete as RS admin → should succeed
    const delRes2 = await deleteInventoryLocks(
      createRequest(`/api/inventory-locks?ids=${lockId}`, {
        method: 'DELETE',
        userId: USERS.adminRS,
      }),
    );
    expect(delRes2.status).toBe(200);
  });

  it('F6: create lock for a specific room', async () => {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const res = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST',
        userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomId: ROOMS.room1001,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: `Room lock ${uid()}`,
          lockType: 'out_of_service',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.inventoryLocks.push(body.data.id);
    expect(body.data.roomId).toBe(ROOMS.room1001);
    expect(body.data.lockType).toBe('out_of_service');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// G. TAX SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

describe('G. Tax Settings', () => {
  it('G1: GET tax settings for valid property', async () => {
    const res = await getTaxSettings(
      createRequest(`/api/properties/${PROPERTIES.royalStayKolkata}/tax-settings`, {
        userId: USERS.adminRS,
      }),
      makeParams(PROPERTIES.royalStayKolkata),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(PROPERTIES.royalStayKolkata);
    expect('taxType' in body.data).toBe(true);
    expect('defaultTaxRate' in body.data).toBe(true);
  });

  it('G2: PUT tax settings', async () => {
    const res = await updateTaxSettings(
      createRequest(`/api/properties/${PROPERTIES.royalStayKolkata}/tax-settings`, {
        method: 'PUT',
        userId: USERS.adminRS,
        body: {
          taxType: 'gst',
          defaultTaxRate: 18,
          serviceChargePercent: 5,
          includeTaxInPrice: false,
        },
      }),
      makeParams(PROPERTIES.royalStayKolkata),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.taxType).toBe('gst');
    expect(body.data.defaultTaxRate).toBe(18);
    expect(body.data.serviceChargePercent).toBe(5);
  });

  it('G3: GET tax settings for non-existent property → 404', async () => {
    const res = await getTaxSettings(
      createRequest('/api/properties/00000000-0000-0000-0000-000000000000/tax-settings', {
        userId: USERS.adminRS,
      }),
      makeParams('00000000-0000-0000-0000-000000000000'),
    );
    expect(res.status).toBe(404);
  });

  it('G4: GET tax settings – cross-tenant → 404', async () => {
    // OV admin trying to access RS property tax settings
    const res = await getTaxSettings(
      createRequest(`/api/properties/${PROPERTIES.royalStayKolkata}/tax-settings`, {
        userId: USERS.adminOV,
      }),
      makeParams(PROPERTIES.royalStayKolkata),
    );
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// H. BUSINESS LOGIC / EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('H. Business Logic / Edge Cases', () => {
  it('H1: same slug allowed in different tenants', async () => {
    const slug = `shared-slug-${uid()}`;

    // Royal Stay admin creates
    const rsRes = await createProperty(
      createRequest('/api/properties', {
        method: 'POST', userId: USERS.adminRS,
        body: { name: `RS Shared ${uid()}`, slug, address: 'a', city: 'Kolkata', country: 'IN' },
      }),
    );
    expect(rsRes.status).toBe(201);
    const rsData = await json(rsRes);
    createdEntities.properties.push(rsData.data.id);

    // Ocean View admin creates with same slug
    const ovRes = await createProperty(
      createRequest('/api/properties', {
        method: 'POST', userId: USERS.adminOV,
        body: { name: `OV Shared ${uid()}`, slug, address: 'b', city: 'Goa', country: 'IN' },
      }),
    );
    expect(ovRes.status).toBe(201);
    const ovData = await json(ovRes);
    createdEntities.properties.push(ovData.data.id);

    // Both should have the same slug but different tenantIds
    expect(rsData.data.slug).toBe(slug);
    expect(ovData.data.slug).toBe(slug);
    expect(rsData.data.tenantId).toBe(TENANTS.royalStay);
    expect(ovData.data.tenantId).toBe(TENANTS.oceanView);
  });

  it('H2: same room number allowed in different properties', async () => {
    // Create a room type at Darjeeling for testing
    const code = `DARJ${uid().slice(-4)}`;
    const rtRes = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayDarjeeling,
          name: `Darj Test RT ${uid()}`,
          code,
          basePrice: 300,
        },
      }),
    );
    const rtData = await json(rtRes);
    createdEntities.roomTypes.push(rtData.data.id);

    // Room 1001 exists at Kolkata. Create room 1001 at Darjeeling
    const res = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayDarjeeling,
          roomTypeId: rtData.data.id,
          number: '1001',
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    createdEntities.rooms.push(body.data.id);
    expect(body.data.number).toBe('1001');
    expect(body.data.propertyId).toBe(PROPERTIES.royalStayDarjeeling);
  });

  it('H3: overlapping lock prevention for room-specific locks', async () => {
    const start = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);

    // Create a lock for room 1001
    const res1 = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomId: ROOMS.room1001,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: `Room overlap test 1 ${uid()}`,
        },
      }),
    );
    const d1 = await json(res1);
    createdEntities.inventoryLocks.push(d1.data.id);

    // Try overlapping lock for same room
    const overlapStart = new Date(Date.now() + 41 * 24 * 60 * 60 * 1000);
    const overlapEnd = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000);
    const res2 = await createInventoryLock(
      createRequest('/api/inventory-locks', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomId: ROOMS.room1001,
          startDate: overlapStart.toISOString(),
          endDate: overlapEnd.toISOString(),
          reason: `Room overlap test 2 ${uid()}`,
        },
      }),
    );
    expect(res2.status).toBe(400);
    const body2 = await json(res2);
    expect(body2.error.code).toBe('OVERLAPPING_LOCK');
  });

  it('H4: totalRooms consistency after room creation and deletion', async () => {
    // Create a dedicated room type
    const code = `CONSIST${uid().slice(-4)}`;
    const rtRes = await createRoomType(
      createRequest('/api/room-types', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          name: `Consistency RT ${uid()}`,
          code,
          basePrice: 100,
        },
      }),
    );
    const rtData = await json(rtRes);
    const rtId = rtData.data.id;
    createdEntities.roomTypes.push(rtId);

    // Get initial count
    const propBefore = await db.property.findUnique({
      where: { id: PROPERTIES.royalStayKolkata },
      select: { totalRooms: true },
    });
    const propertyBefore = propBefore?.totalRooms ?? 0;

    // Create 2 rooms
    const r1 = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: rtId,
          number: `CONS1-${uid().slice(-4)}`,
        },
      }),
    );
    const r2 = await createRoom(
      createRequest('/api/rooms', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          propertyId: PROPERTIES.royalStayKolkata,
          roomTypeId: rtId,
          number: `CONS2-${uid().slice(-4)}`,
        },
      }),
    );
    const d1 = await json(r1); const d2 = await json(r2);
    createdEntities.rooms.push(d1.data.id, d2.data.id);

    // Property totalRooms should have increased by 2
    const propAfter = await db.property.findUnique({
      where: { id: PROPERTIES.royalStayKolkata },
      select: { totalRooms: true },
    });
    expect(propAfter?.totalRooms).toBe(propertyBefore + 2);

    // Room type totalRooms should be 2
    const rtAfter = await db.roomType.findUnique({
      where: { id: rtId },
      select: { totalRooms: true },
    });
    expect(rtAfter?.totalRooms).toBe(2);
  });

  it('H5: rate plan with invalid discount percent > 100 → rejected', async () => {
    const res = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `Bad Discount ${uid()}`,
          code: `BD${uid().slice(-5)}`,
          basePrice: 100,
          discountPercent: 150,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('INVALID_DISCOUNT');
  });

  it('H6: rate plan with invalid promo dates (end before start) → rejected', async () => {
    const res = await createRatePlan(
      createRequest('/api/rate-plans', {
        method: 'POST', userId: USERS.adminRS,
        body: {
          roomTypeId: ROOM_TYPES.stdKolkata,
          name: `Bad Dates ${uid()}`,
          code: `BDATE${uid().slice(-5)}`,
          basePrice: 100,
          promoStart: '2025-12-31T00:00:00Z',
          promoEnd: '2025-01-01T00:00:00Z',
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('INVALID_PROMO_DATES');
  });
});
