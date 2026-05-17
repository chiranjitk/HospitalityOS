/**
 * 02 - Group Bookings Tests
 *
 * Tests group booking lifecycle:
 *   - Create group booking (inquiry status)
 *   - List group bookings with stats
 *   - Update group status to confirmed
 *   - Get single group with details
 *   - Book rooms into the group (use existing rooms from PMS tests)
 *   - Cross-verify booked rooms appear in bookings list with groupId
 *   - Delete with bookings should fail (HAS_BOOKINGS)
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  addDays,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  assertStatus,
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
  const ts = Date.now();
  const groupCheckIn = addDays(new Date(), 130);
  const groupCheckOut = addDays(groupCheckIn, 3);
  const groupName = `Test Group ${ts}`;

  await runSequentially('02-Group-Bookings', [
    {
      name: 'Create group booking (inquiry status)',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/group-bookings',
          {
            propertyId: st.propertyId,
            name: groupName,
            description: 'Integration test group booking',
            contactName: 'Test Contact',
            contactEmail: `group-${ts}@example.com`,
            contactPhone: '+911234567890',
            checkIn: groupCheckIn.toISOString(),
            checkOut: groupCheckOut.toISOString(),
            totalRooms: 2,
            totalAmount: 30000,
            depositAmount: 5000,
            depositPaid: false,
            status: 'inquiry',
            notes: 'Group booking for testing',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create group booking');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Group should have ID');
        assertEqual(data.data.status, 'inquiry');
        assertEqual(data.data.name, groupName);
        assertEqual(data.data.propertyId, st.propertyId);

        saveState({ groupBookingId: data.data.id });
      },
    },
    {
      name: 'List group bookings with stats',
      fn: async () => {
        const { data } = await api.get(`/api/group-bookings?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertNotNull(data.stats, 'Should have stats');
        assertGt(data.stats.total, 0, 'Should have at least 1 group');

        // Verify our group is in the list
        const updated = loadState();
        const ourGroup = data.data.find((g: any) => g.id === updated.groupBookingId);
        assertNotNull(ourGroup, 'Our group should be in the list');
        assertEqual(ourGroup.name, groupName);

        // Stats should have inquiry count > 0
        assertGt(data.stats.inquiry, 0, 'Should have inquiry groups');
      },
    },
    {
      name: 'Update group status to confirmed',
      fn: async () => {
        const updated = loadState();
        const { data } = await api.put(
          '/api/group-bookings',
          {
            id: updated.groupBookingId,
            status: 'confirmed',
            depositPaid: true,
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'confirmed');
        assertEqual(data.data.depositPaid, true);
      },
    },
    {
      name: 'Get single group with details',
      fn: async () => {
        const updated = loadState();
        const { data } = await api.get(
          `/api/group-bookings/${updated.groupBookingId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertEqual(data.data.id, updated.groupBookingId);
        assertEqual(data.data.status, 'confirmed');
        assertNotNull(data.data.property, 'Should include property');
        assertNotNull(data.data.bookings, 'Should include bookings array');
      },
    },
    {
      name: 'Create fresh rooms for group booking',
      fn: async () => {
        const updated = loadState();
        assertNotNull(updated.roomType1Id, 'Need room type ID');

        // Room GA
        const { data: r1, status: s1 } = await api.post(
          '/api/rooms',
          {
            propertyId: st.propertyId,
            roomTypeId: updated.roomType1Id,
            number: `GRP-A-${ts}`,
            floor: 98,
            status: 'available',
          },
          cookie(state)
        );
        assertStatus({ data: r1, status: s1 }, 201, 'Create group room A');
        saveState({ groupRoomAId: r1.data.id });

        // Room GB
        const { data: r2, status: s2 } = await api.post(
          '/api/rooms',
          {
            propertyId: st.propertyId,
            roomTypeId: updated.roomType1Id,
            number: `GRP-B-${ts}`,
            floor: 98,
            status: 'available',
          },
          cookie(state)
        );
        assertStatus({ data: r2, status: s2 }, 201, 'Create group room B');
        saveState({ groupRoomBId: r2.data.id });
      },
    },
    {
      name: 'Book rooms into the group',
      fn: async () => {
        const updated = loadState();
        assertNotNull(updated.guestId, 'Need guest ID');
        assertNotNull(updated.groupRoomAId, 'Need group room A ID');
        assertNotNull(updated.groupRoomBId, 'Need group room B ID');

        const { data, status } = await api.post(
          '/api/group-bookings/book-rooms',
          {
            groupId: updated.groupBookingId,
            roomIds: [updated.groupRoomAId, updated.groupRoomBId],
            guestId: updated.guestId,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'Book rooms into group');
        assert(data.success, 'Should succeed');
        assertGt(data.data.length, 0, 'Should create bookings');
        assertEqual(data.data.length, 2, 'Should create 2 bookings for 2 rooms');

        // Save booking IDs for cross-verification
        saveState({
          groupBookingIds: data.data.map((b: any) => b.id),
        });
      },
    },
    {
      name: 'Cross-verify: Booked rooms appear in bookings list with groupId',
      fn: async () => {
        const updated = loadState();
        assertNotNull(updated.groupBookingId, 'Need group booking ID');

        const { data } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');

        // Find bookings with our groupId
        const groupBookings = data.data.filter(
          (b: any) => b.groupId === updated.groupBookingId
        );
        assertGt(groupBookings.length, 0, 'Should find bookings with our groupId');

        // Verify group info
        for (const gb of groupBookings) {
          assertEqual(gb.source, 'group', 'Source should be group');
          assertNotNull(gb.roomTypeId, 'Should have room type');
        }

        // Verify group shows booked rooms count
        const { data: groupData } = await api.get(
          `/api/group-bookings/${updated.groupBookingId}`,
          cookie(state)
        );
        assertGt(groupData.data.bookedRooms, 0, 'Group should show booked rooms');
        assertEqual(groupData.data.bookedRooms, groupBookings.length);
      },
    },
    {
      name: 'DELETE group with bookings should fail (HAS_BOOKINGS)',
      fn: async () => {
        const updated = loadState();
        try {
          await api.del(`/api/group-bookings/${updated.groupBookingId}`, cookie(state));
          assert(false, 'Should have thrown HAS_BOOKINGS error');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400 for HAS_BOOKINGS');
          assertNotNull(err.response?.error?.code);
          assertEqual(err.response.error.code, 'HAS_BOOKINGS', 'Should be HAS_BOOKINGS');
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
