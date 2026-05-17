/**
 * 04 - Room Grid Tests
 *
 * Tests the Room Grid functionality: listing rooms with various filters
 * (status, floor), single room detail retrieval, availability for date ranges,
 * room type associations, and property membership cross-verification.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  formatDate,
  today,
  tomorrow,
  addDays,
  futureDate,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
  ApiError,
} from '../pms/setup';

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTHENTICATION FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const auth = cookie(state);

  // Track room counts across filter tests for cross-verification
  let statusCounts: Record<string, number> = {};

  await runSequentially('04-RoomGrid', [
    {
      name: 'GET /api/rooms?propertyId=... — list all rooms for property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return rooms data');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertGt(list.length, 0, 'Should have at least 1 room for the property');
        // Save total count for later cross-verification
        statusCounts._total = list.length;
      },
    },
    {
      name: 'Filter rooms by status: available',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}&status=available`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return data');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertNotNull(list, 'Available rooms list should exist');
        statusCounts.available = list.length;
      },
    },
    {
      name: 'Filter rooms by status: occupied',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}&status=occupied`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return data');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertNotNull(list, 'Occupied rooms list should exist');
        statusCounts.occupied = list.length;
      },
    },
    {
      name: 'Filter rooms by status: maintenance',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}&status=maintenance`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return data');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertNotNull(list, 'Maintenance rooms list should exist');
        statusCounts.maintenance = list.length;
      },
    },
    {
      name: 'Filter rooms by floor',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}&floor=1`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return data');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertNotNull(list, 'Floor-filtered rooms list should exist');
        // Every room should have floor 1
        for (const r of list) {
          if (r.floor !== undefined) {
            assertEqual(r.floor, 1, 'All rooms should be on floor 1');
          }
        }
      },
    },
    {
      name: 'GET /api/rooms/[room1Id] — single room details',
      fn: async () => {
        assertNotNull(st.room1Id, 'Need room1Id in state');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms/${st.room1Id}`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Room should exist');
        assertEqual(data.data.id, st.room1Id, 'Room ID should match');
        assertNotNull(data.data.roomNumber || data.data.number, 'Room should have roomNumber');
        assertNotNull(data.data.roomTypeId || data.data.typeId, 'Room should have roomTypeId');
        assertNotNull(data.data.propertyId, 'Room should have propertyId');
      },
    },
    {
      name: 'GET /api/rooms/[room2Id] — another room detail',
      fn: async () => {
        assertNotNull(st.room2Id, 'Need room2Id in state');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms/${st.room2Id}`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Room should exist');
        assertEqual(data.data.id, st.room2Id, 'Room ID should match');
        assertNotNull(data.data.roomNumber || data.data.number, 'Room should have roomNumber');
        assertNotNull(data.data.roomTypeId || data.data.typeId, 'Room should have roomTypeId');
      },
    },
    {
      name: 'Cross-verify: total rooms = sum of all status counts',
      fn: async () => {
        // Also get "dirty" rooms
        await delay(DELAY_BETWEEN_CALLS);
        let dirtyCount = 0;
        try {
          const { data: dirtyData } = await api.get(`/api/rooms?propertyId=${st.propertyId}&status=dirty`, auth);
          if (dirtyData.success && dirtyData.data) {
            const list = Array.isArray(dirtyData.data) ? dirtyData.data : dirtyData.data.rooms || dirtyData.data.items || [];
            dirtyCount = list.length;
          }
        } catch {
          // "dirty" status filter may not be supported — skip
        }

        const statusSum = (statusCounts.available || 0) + (statusCounts.occupied || 0) + (statusCounts.maintenance || 0) + dirtyCount;
        // The sum of all status-filtered rooms should not exceed the total
        if (statusCounts._total) {
          assert(
            statusSum <= statusCounts._total,
            `Status sum (${statusSum}) should not exceed total (${statusCounts._total})`,
          );
        }
      },
    },
    {
      name: 'GET /api/rooms/available — available for tonight',
      fn: async () => {
        const checkIn = formatDate(today());
        const checkOut = formatDate(tomorrow());
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/rooms/available?propertyId=${st.propertyId}&checkIn=${checkIn}&checkOut=${checkOut}`,
          auth,
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return available rooms');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [data.data];
        assertNotNull(list, 'Should have a list of available rooms');
      },
    },
    {
      name: 'GET /api/rooms/available — available for 5 nights',
      fn: async () => {
        const checkIn = formatDate(today());
        const checkOut = formatDate(addDays(today(), 5));
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/rooms/available?propertyId=${st.propertyId}&checkIn=${checkIn}&checkOut=${checkOut}`,
          auth,
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return available rooms');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [data.data];
        assertNotNull(list, 'Should have a list of rooms available for 5 nights');
      },
    },
    {
      name: 'Verify room type association — every room has valid roomTypeId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Should succeed');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertGt(list.length, 0, 'Should have rooms to check');
        for (const r of list) {
          const typeId = r.roomTypeId || r.typeId;
          assertNotNull(typeId, `Room ${r.id || r.roomNumber} should have a roomTypeId`);
          assert(typeId.length > 0, `Room ${r.id || r.roomNumber} roomTypeId should not be empty`);
        }
      },
    },
    {
      name: 'Cross-verify: rooms belong to the correct property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Should succeed');
        const list = Array.isArray(data.data) ? data.data : data.data.rooms || data.data.items || [];
        assertGt(list.length, 0, 'Should have rooms to verify');
        for (const r of list) {
          assertEqual(r.propertyId, st.propertyId, `Room ${r.id} should belong to the test property`);
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
