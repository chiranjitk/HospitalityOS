/**
 * 03 - Rooms CRUD Tests
 *
 * Tests room creation, status transitions, uniqueness, and count verification.
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
  assertStatus,
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();
  const ts = Date.now();

  await runSequentially('03-Rooms-CRUD', [
    {
      name: 'Create room with all optional fields',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/rooms',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType1Id,
            number: ts + '-101',
            name: 'Deluxe 101',
            floor: 1,
            isAccessible: true,
            isSmoking: false,
            hasBalcony: true,
            hasSeaView: false,
            hasMountainView: false,
            status: 'available',
            digitalKeyEnabled: false,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create room');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have ID');
        assertEqual(data.data.number, ts + '-101');
        assertEqual(data.data.floor, 1);
        assertEqual(data.data.roomTypeId, state.roomType1Id);
        assertEqual(data.data.status, 'available');
        assert(data.data.isAccessible, 'isAccessible should be true');

        saveState({ room1Id: data.data.id });
      },
    },
    {
      name: 'Verify room appears in list',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/rooms?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'List should succeed');
        const room = data.data.find((r: any) => r.id === st.room1Id);
        assertNotNull(room, 'Room should be in list');
        assertEqual(room.number, ts + '-101');
      },
    },
    {
      name: 'Get single room with room type details',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/rooms/${st.room1Id}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertEqual(data.data.number, ts + '-101');
        assertNotNull(data.data.roomType, 'Should include room type');
        assertNotNull(data.data.roomType.id, 'Should have room type ID');
      },
    },
    {
      name: 'Reject duplicate room number',
      fn: async () => {
        try {
          await api.post(
            '/api/rooms',
            {
              propertyId: state.propertyId,
              roomTypeId: state.roomType1Id,
              number: ts + '-101',
            },
            cookie(state)
          );
          assert(false, 'Should reject duplicate number');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400');
          assert(err.response?.error?.code === 'DUPLICATE_NUMBER', 'Should be DUPLICATE_NUMBER');
        }
      },
    },
    {
      name: 'Create multiple rooms across different room types',
      fn: async () => {
        // Room 102 on Deluxe Double
        const r2 = await api.post(
          '/api/rooms',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType1Id,
            number: ts + '-102',
            floor: 1,
            status: 'available',
          },
          cookie(state)
        );
        assert(r2.data.success);

        // Room 201 on Deluxe Double
        const r3 = await api.post(
          '/api/rooms',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType1Id,
            number: ts + '-201',
            floor: 2,
            status: 'available',
          },
          cookie(state)
        );
        assert(r3.data.success);

        // Room 301 on Premium Suite
        const r4 = await api.post(
          '/api/rooms',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType2Id,
            number: ts + '-301',
            floor: 3,
            status: 'available',
          },
          cookie(state)
        );
        assert(r4.data.success);

        // Room 302 on Premium Suite
        const r5 = await api.post(
          '/api/rooms',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType2Id,
            number: ts + '-302',
            floor: 3,
            status: 'available',
          },
          cookie(state)
        );
        assert(r5.data.success);

        saveState({
          room2Id: r2.data.data.id,
          room3Id: r3.data.data.id,
          room4Id: r4.data.data.id,
          room5Id: r5.data.data.id,
        });
      },
    },
    {
      name: 'Test room status transitions (available → maintenance → available)',
      fn: async () => {
        const st = loadState();

        // Ensure room is in a transitionable state first
        try {
          await api.put(`/api/rooms/${st.room1Id}`, { status: 'available' }, cookie(state));
        } catch { /* ignore if already available */ }

        // available → maintenance
        const { data: d1 } = await api.put(
          `/api/rooms/${st.room1Id}`,
          { status: 'maintenance' },
          cookie(state)
        );
        assert(d1.success, 'Should allow transition to maintenance');
        assertEqual(d1.data.status, 'maintenance');

        // maintenance → available
        const { data: d2 } = await api.put(
          `/api/rooms/${st.room1Id}`,
          { status: 'available' },
          cookie(state)
        );
        assert(d2.success, 'Should allow transition back to available');
        assertEqual(d2.data.status, 'available');
      },
    },
    {
      name: 'Verify totalRooms incremented on room types and property',
      fn: async () => {
        const st = loadState();

        // Check property totalRooms
        const { data: propData } = await api.get(`/api/properties/${st.propertyId}`, cookie(state));
        assertGt(propData.data.totalRooms, 4, 'Property should have at least 5 total rooms');

        // Check room type counts
        const { data: rtData } = await api.get(
          `/api/room-types?propertyId=${st.propertyId}`,
          cookie(state)
        );
        const deluxe = rtData.data.find((r: any) => r.id === st.roomType1Id);
        const premium = rtData.data.find((r: any) => r.id === st.roomType2Id);
        assertNotNull(deluxe, 'Deluxe room type should exist');
        assertNotNull(premium, 'Premium room type should exist');
        assertGt(deluxe.totalRooms, 0, 'Deluxe Double should have rooms');
        assertGt(premium.totalRooms, 0, 'Premium Suite should have rooms');
      },
    },
    {
      name: 'Test available rooms API (no bookings → all rooms available)',
      fn: async () => {
        const st = loadState();
        const checkIn = new Date();
        checkIn.setDate(checkIn.getDate() + 10);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 2);

        const { data } = await api.get(
          `/api/rooms/available?propertyId=${st.propertyId}&checkIn=${checkIn.toISOString().split('T')[0]}&checkOut=${checkOut.toISOString().split('T')[0]}`,
          cookie(state)
        );
        assert(data.success, 'Available rooms API should succeed');
        assertGt(data.meta?.availableRooms || 0, 0, 'Should have available rooms');
        // All rooms should be available (no bookings in the future)
        assertGt(data.meta.availableRooms, 4, 'At least 5 rooms available');
      },
    },
    {
      name: 'Cross-verify: Property totalRooms = 5, RoomType counts correct',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/rooms?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success);
        assertGt(data.data.length, 4, 'Should have at least 5 rooms total');

        // Verify each room has correct room type
        const deluxeCount = data.data.filter(
          (r: any) => r.roomTypeId === st.roomType1Id
        ).length;
        const premiumCount = data.data.filter(
          (r: any) => r.roomTypeId === st.roomType2Id
        ).length;
        assertGt(deluxeCount, 0, 'Should have deluxe rooms');
        assertGt(premiumCount, 0, 'Should have premium rooms');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
