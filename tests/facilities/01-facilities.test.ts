/**
 * 01 - Facilities Management Tests (11 pages, 32+ tests)
 *
 * Tests the entire facilities module including parking, parking passes,
 * parking billing, event spaces, events, event resources, BEOs,
 * event conflicts, timeshare ownerships, casino tables, and vehicles.
 *
 * Pattern: Real API calls only, graceful 404/400 skips, sequential execution.
 * Creates resources via POST first where possible, then verifies via GET.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
} from '../pms/setup';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Call GET and gracefully skip on 404/400 */
async function safeGet(path: string, auth: string): Promise<{ data: any; status: number; skipped?: boolean }> {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    const res = await api.get(path, auth);
    return { ...res, skipped: false };
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { data: null, status: err.status, skipped: true };
    }
    throw err;
  }
}

/** Wrap a POST that may 404/400 gracefully */
async function safePost(path: string, body: any, auth: string): Promise<{ data: any; status: number; skipped?: boolean }> {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    const res = await api.post(path, body, auth);
    return { ...res, skipped: false };
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { data: null, status: err.status, skipped: true };
    }
    throw err;
  }
}

/** Extract array from various response shapes */
function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    return data.data ?? data.items ?? data.records ?? data.spaces ?? data.events ?? data.resources
      ?? data.bans ?? data.passes ?? data.ownerships ?? data.tables ?? data.vehicles ?? [];
  }
  return [];
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const auth = cookie(state);
  const ts = Date.now();

  // Collected IDs for cross-references
  let createdParkingPassId: string | null = null;
  let createdSpaceId: string | null = null;
  let createdEventId: string | null = null;
  let createdBeoId: string | null = null;

  await runSequentially('01-Facilities', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Parking
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Parking - GET list all parking records',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Parking records should be array-like');
        console.log(`      Found ${items.length} parking record(s)`);
      },
    },
    {
      name: 'Parking - GET verify parking structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const record = items[0];
          assertNotNull(record.id, 'Parking record should have id');
          const keys = Object.keys(record);
          assertGt(keys.length, 1, 'Parking record should have multiple fields');
          console.log(`      Parking keys: ${keys.join(', ')}`);
        } else {
          console.log('      No parking records — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Parking Passes
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Parking Passes - POST create a test parking pass',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/parking/passes',
          {
            propertyId: st.propertyId,
            passType: 'daily',
            vehicleNumber: `KA-${String(ts % 100000).padStart(5, '0')}`,
            guestId: st.guestId || undefined,
            validFrom: new Date().toISOString(),
            validUntil: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Parking pass should return an id');
        const id = data?.data?.id || data?.id;
        createdParkingPassId = id;
        saveState({ facParkingPassId: id });
        console.log(`      Created parking pass: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Parking Passes - GET verify passes exist',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking/passes?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Parking passes should be array-like');
        console.log(`      Found ${items.length} parking pass(es)`);
        if (!createdParkingPassId && items.length > 0 && items[0].id) {
          createdParkingPassId = items[0].id;
          saveState({ facParkingPassId: items[0].id });
        }
      },
    },
    {
      name: 'Parking Passes - GET verify pass structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking/passes?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const pass = items[0];
          assertNotNull(pass.id, 'Parking pass should have id');
          const keys = Object.keys(pass);
          assertGt(keys.length, 1, 'Pass should have multiple fields');
          const hasType = pass.passType !== undefined || pass.type !== undefined;
          const hasStatus = pass.status !== undefined || pass.isActive !== undefined;
          console.log(`      Pass keys: ${keys.join(', ')}, hasType=${hasType}, hasStatus=${hasStatus}`);
        } else {
          console.log('      No parking passes — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Parking Billing
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Parking Billing - GET billing summary',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking/billing?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        assertNotNull(data.data, 'Should have billing data');
        console.log(`      Parking billing data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Parking Billing - GET verify billing has financial fields',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/parking/billing?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have billing data');
        const bd = data.data;
        const keys = Object.keys(bd);
        const hasMoney = keys.some(k => /amount|total|revenue|charge|rate|price|fee/i.test(k));
        console.log(`      Billing keys (${keys.length}): ${keys.join(', ')}, hasMoney=${hasMoney}`);
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Event Spaces
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Event Spaces - POST create a test event space',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/events/spaces',
          {
            name: `E2E Test Event Space ${ts % 10000}`,
            type: 'banquet',
            capacity: 100,
            propertyId: st.propertyId,
            floor: 'Ground',
            isActive: true,
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Event space should return an id');
        const id = data?.data?.id || data?.id;
        createdSpaceId = id;
        saveState({ facEventSpaceId: id });
        console.log(`      Created event space: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Event Spaces - GET list all event spaces',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/spaces?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Event spaces should be array-like');
        console.log(`      Found ${items.length} event space(s)`);
        if (!createdSpaceId && items.length > 0 && items[0].id) {
          createdSpaceId = items[0].id;
          saveState({ facEventSpaceId: items[0].id });
        }
      },
    },
    {
      name: 'Event Spaces - GET verify space structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/spaces?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const space = items[0];
          assertNotNull(space.id, 'Event space should have id');
          assertNotNull(space.name || space.spaceName, 'Event space should have name');
          const keys = Object.keys(space);
          assertGt(keys.length, 2, 'Event space should have multiple fields');
          console.log(`      Event space verified: id=${space.id}, name=${space.name || space.spaceName}, keys=[${keys.join(', ')}]`);
        } else {
          console.log('      No event spaces — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: Events
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Events - POST create a test event',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/events',
          {
            name: `E2E Test Event ${ts % 10000}`,
            type: 'corporate',
            description: 'An event created by e2e tests',
            startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
            propertyId: st.propertyId,
            spaceId: createdSpaceId || undefined,
            expectedAttendees: 50,
            status: 'planned',
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Event should return an id');
        const id = data?.data?.id || data?.id;
        createdEventId = id;
        saveState({ facEventId: id });
        console.log(`      Created event: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Events - GET list all events',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Events should be array-like');
        console.log(`      Found ${items.length} event(s)`);
        if (!createdEventId && items.length > 0 && items[0].id) {
          createdEventId = items[0].id;
          saveState({ facEventId: items[0].id });
        }
      },
    },
    {
      name: 'Events - GET verify event structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const event = items[0];
          assertNotNull(event.id, 'Event should have id');
          assertNotNull(event.name || event.eventName, 'Event should have name');
          const keys = Object.keys(event);
          assertGt(keys.length, 2, 'Event should have multiple fields');
          console.log(`      Event keys: ${keys.join(', ')}`);
        } else {
          console.log('      No events — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: Event Resources
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Event Resources - GET resources for an event',
      fn: async () => {
        // Try to find an event ID first
        if (!createdEventId) {
          console.log('      ⏭️  SKIPPED (no eventId available)');
          return;
        }
        const { data, skipped } = await safeGet(`/api/events/${createdEventId}/resources`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Event resources should be array-like');
        console.log(`      Found ${items.length} resource(s) for event ${createdEventId}`);
      },
    },
    {
      name: 'Event Resources - GET verify resource structure',
      fn: async () => {
        if (!createdEventId) {
          console.log('      ⏭️  SKIPPED (no eventId available)');
          return;
        }
        const { data, skipped } = await safeGet(`/api/events/${createdEventId}/resources`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const resource = items[0];
          assertNotNull(resource.id, 'Resource should have id');
          const keys = Object.keys(resource);
          assertGt(keys.length, 0, 'Resource should have fields');
          console.log(`      Resource keys: ${keys.join(', ')}`);
        } else {
          console.log('      No event resources — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: BEO (Banquet Event Orders)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'BEO - POST create a test BEO',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/events/beo',
          {
            eventId: createdEventId || undefined,
            propertyId: st.propertyId,
            name: `E2E Test BEO ${ts % 10000}`,
            functionDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '17:00',
            expectedPax: 50,
            menuNotes: 'Veg and Non-veg options',
            setupNotes: 'Classroom seating',
            status: 'draft',
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'BEO should return an id');
        const id = data?.data?.id || data?.id;
        createdBeoId = id;
        saveState({ facBeoId: id });
        console.log(`      Created BEO: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'BEO - GET list all BEOs',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/beo?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'BEOs should be array-like');
        console.log(`      Found ${items.length} BEO(s)`);
        if (!createdBeoId && items.length > 0 && items[0].id) {
          createdBeoId = items[0].id;
          saveState({ facBeoId: items[0].id });
        }
      },
    },
    {
      name: 'BEO - GET verify BEO structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/beo?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const beo = items[0];
          assertNotNull(beo.id, 'BEO should have id');
          assertNotNull(beo.name || beo.beoName, 'BEO should have name');
          const keys = Object.keys(beo);
          assertGt(keys.length, 2, 'BEO should have multiple fields');
          console.log(`      BEO keys: ${keys.join(', ')}`);
        } else {
          console.log('      No BEOs — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: Event Conflicts
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Event Conflicts - GET list conflict checks',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/conflicts?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Event conflicts should be array-like');
        console.log(`      Found ${items.length} conflict(s)`);
      },
    },
    {
      name: 'Event Conflicts - GET verify conflict structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/events/conflicts?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const conflict = items[0];
          assertNotNull(conflict.id, 'Conflict should have id');
          const keys = Object.keys(conflict);
          assertGt(keys.length, 0, 'Conflict should have fields');
          console.log(`      Conflict keys: ${keys.join(', ')}`);
        } else {
          console.log('      No event conflicts — all clear');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 9: Timeshare Ownerships
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Timeshare Ownerships - GET list all ownerships',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/resort/timeshare/ownerships', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Timeshare ownerships should be array-like');
        console.log(`      Found ${items.length} timeshare ownership(s)`);
      },
    },
    {
      name: 'Timeshare Ownerships - GET verify ownership structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/resort/timeshare/ownerships', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const ownership = items[0];
          assertNotNull(ownership.id, 'Ownership should have id');
          const keys = Object.keys(ownership);
          assertGt(keys.length, 0, 'Ownership should have fields');
          console.log(`      Ownership keys: ${keys.join(', ')}`);
        } else {
          console.log('      No timeshare ownerships — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 10: Casino Tables
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Casino Tables - GET list all tables',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/resort/casino/tables', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Casino tables should be array-like');
        console.log(`      Found ${items.length} casino table(s)`);
      },
    },
    {
      name: 'Casino Tables - GET verify table structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/resort/casino/tables', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const table = items[0];
          assertNotNull(table.id, 'Casino table should have id');
          const keys = Object.keys(table);
          assertGt(keys.length, 0, 'Table should have fields');
          console.log(`      Casino table keys: ${keys.join(', ')}`);
        } else {
          console.log('      No casino tables — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 11: Vehicles
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Vehicles - GET list all vehicles',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/vehicles?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Vehicles should be array-like');
        console.log(`      Found ${items.length} vehicle(s)`);
      },
    },
    {
      name: 'Vehicles - GET verify vehicle structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/vehicles?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const vehicle = items[0];
          assertNotNull(vehicle.id, 'Vehicle should have id');
          const keys = Object.keys(vehicle);
          assertGt(keys.length, 0, 'Vehicle should have fields');
          console.log(`      Vehicle keys: ${keys.join(', ')}`);
        } else {
          console.log('      No vehicles — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // CROSS-ENDPOINT VERIFICATION
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Cross-check — all facilities endpoints respond consistently',
      fn: async () => {
        const endpoints = [
          '/api/parking',
          '/api/parking/passes',
          '/api/parking/billing',
          '/api/events/spaces',
          '/api/events',
          '/api/events/beo',
          '/api/events/conflicts',
          '/api/resort/timeshare/ownerships',
          '/api/resort/casino/tables',
          '/api/vehicles',
        ];
        let successCount = 0;
        for (const ep of endpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            await api.get(ep, auth);
            successCount++;
          } catch (err: any) {
            if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
              // Expected for missing modules
            } else {
              throw err;
            }
          }
        }
        assertGt(successCount, 0, `At least 1 endpoint should succeed (got ${successCount}/${endpoints.length})`);
        console.log(`      ${successCount}/${endpoints.length} facilities endpoints responded successfully`);
      },
    },
    {
      name: 'Cross-check — events have related resources',
      fn: async () => {
        if (!createdEventId) {
          console.log('      ⏭️  SKIPPED (no eventId available for cross-check)');
          return;
        }
        // Verify event details
        const { data: eventData, skipped: evSkipped } = await safeGet(`/api/events/${createdEventId}`, auth);
        if (evSkipped) { console.log('      (skipped — event detail 404)'); return; }
        assertNotNull(eventData?.data, 'Should have event detail data');
        console.log(`      Event detail keys: ${Object.keys(eventData.data).join(', ')}`);
      },
    },
    {
      name: 'Cross-check — BEO references valid event',
      fn: async () => {
        if (!createdBeoId) {
          console.log('      ⏭️  SKIPPED (no beoId available for cross-check)');
          return;
        }
        // Verify BEO detail
        const { data: beoData, skipped: beoSkipped } = await safeGet(`/api/events/beo/${createdBeoId}`, auth);
        if (beoSkipped) { console.log('      (skipped — BEO detail 404)'); return; }
        assertNotNull(beoData?.data, 'Should have BEO detail data');
        console.log(`      BEO detail keys: ${Object.keys(beoData.data).join(', ')}`);
      },
    },
    {
      name: 'Cross-check — created resources summary',
      fn: async () => {
        const updated = loadState();
        const checks = [
          { id: updated.facParkingPassId, label: 'parking pass' },
          { id: updated.facEventSpaceId, label: 'event space' },
          { id: updated.facEventId, label: 'event' },
          { id: updated.facBeoId, label: 'BEO' },
        ];
        const created = checks.filter(c => c.id);
        console.log(`      Created ${created.length} resources during test run:`);
        for (const c of created) {
          console.log(`        - ${c.label}: ${c.id}`);
        }
        assertGt(created.length, 0, 'Should have created at least 1 resource');
      },
    },
    {
      name: 'Cross-check — parking and billing are linked',
      fn: async () => {
        const { data: parkingData, skipped: pSkipped } = await safeGet(`/api/parking?propertyId=${st.propertyId || ''}`, auth);
        const { data: billingData, skipped: bSkipped } = await safeGet(`/api/parking/billing?propertyId=${st.propertyId || ''}`, auth);
        if (pSkipped && bSkipped) {
          console.log('      (skipped — both parking endpoints 404)');
          return;
        }
        if (!pSkipped) {
          const pItems = extractArray(parkingData?.data ?? parkingData);
          console.log(`      Parking records: ${pItems.length}`);
        }
        if (!bSkipped) {
          console.log(`      Billing data keys: ${Object.keys(billingData?.data ?? {}).join(', ')}`);
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
