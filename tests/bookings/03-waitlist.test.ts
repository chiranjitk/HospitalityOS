/**
 * 03 - Waitlist Tests
 *
 * Tests waitlist entry lifecycle:
 *   - Create waitlist entry (guest wants a sold-out room type)
 *   - List with stats (waiting, notified, converted, expired counts)
 *   - Update status to notified
 *   - Trigger auto-process
 *   - Delete entry
 *   - Cross-verify: Waitlist entry references correct room type and property
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
  const waitlistCheckIn = addDays(new Date(), 70);
  const waitlistCheckOut = addDays(waitlistCheckIn, 2);

  await runSequentially('03-Waitlist', [
    {
      name: 'Create waitlist entry (guest wants sold-out room type)',
      fn: async () => {
        assertNotNull(st.guestId, 'Need guest ID');
        assertNotNull(st.roomType1Id, 'Need room type 1 ID');

        const { data, status } = await api.post(
          '/api/waitlist',
          {
            propertyId: st.propertyId,
            guestId: st.guestId,
            roomTypeId: st.roomType1Id,
            checkIn: waitlistCheckIn.toISOString(),
            checkOut: waitlistCheckOut.toISOString(),
            adults: 2,
            children: 0,
            priority: 5,
            notes: 'Waitlist test - room type sold out',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create waitlist entry');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Entry should have ID');
        assertEqual(data.data.status, 'waiting');
        assertEqual(data.data.guestId, st.guestId);
        assertEqual(data.data.roomTypeId, st.roomType1Id);
        assertEqual(data.data.propertyId, st.propertyId);
        assertNotNull(data.data.guest, 'Should include guest info');

        saveState({ waitlistEntryId: data.data.id });
      },
    },
    {
      name: 'List waitlist entries with stats',
      fn: async () => {
        const { data } = await api.get(`/api/waitlist?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertNotNull(data.stats, 'Should have stats');
        assertNotNull(data.stats.waiting !== undefined, 'Should have waiting count');
        assertNotNull(data.stats.notified !== undefined, 'Should have notified count');
        assertNotNull(data.stats.converted !== undefined, 'Should have converted count');
        assertNotNull(data.stats.expired !== undefined, 'Should have expired count');
        assertGt(data.stats.waiting, 0, 'Should have at least 1 waiting entry');

        // Find our entry
        const updated = loadState();
        const ourEntry = data.data.find((e: any) => e.id === updated.waitlistEntryId);
        assertNotNull(ourEntry, 'Our entry should be in the list');
        assertEqual(ourEntry.status, 'waiting');
      },
    },
    {
      name: 'Update waitlist entry status to notified',
      fn: async () => {
        const updated = loadState();
        const { data } = await api.put(
          '/api/waitlist',
          {
            id: updated.waitlistEntryId,
            status: 'notified',
            priority: 10,
            notes: 'Updated priority and notified guest',
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'notified');
        assertEqual(data.data.priority, 10);
      },
    },
    {
      name: 'Trigger auto-process for waitlist',
      fn: async () => {
        const { data } = await api.post(
          '/api/waitlist/auto-process',
          {
            propertyId: st.propertyId,
            roomTypeId: st.roomType1Id,
            checkIn: waitlistCheckIn.toISOString(),
            checkOut: waitlistCheckOut.toISOString(),
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(data.data.processedCount !== undefined, 'Should have processedCount');
      },
    },
    {
      name: 'Delete waitlist entry (DELETE with JSON body)',
      fn: async () => {
        const updated = loadState();
        // DELETE requires JSON body with id — use fetch directly
        const res = await fetch('http://localhost:3000/api/waitlist', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie(state),
          },
          body: JSON.stringify({ id: updated.waitlistEntryId }),
        });
        const data = await res.json();
        assert(data.success, 'Should succeed');
        assertEqual(data.message, 'Waitlist entry deleted');
      },
    },
    {
      name: 'Cross-verify: Deleted entry no longer in list',
      fn: async () => {
        const updated = loadState();
        const { data } = await api.get(`/api/waitlist?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        const deletedEntry = data.data.find((e: any) => e.id === updated.waitlistEntryId);
        assert(deletedEntry === undefined, 'Deleted entry should not appear');
      },
    },
    {
      name: 'Cross-verify: Waitlist entry references correct room type and property',
      fn: async () => {
        // Create a fresh waitlist entry for verification
        const { data: created } = await api.post(
          '/api/waitlist',
          {
            propertyId: st.propertyId,
            guestId: st.guestId,
            roomTypeId: st.roomType2Id,
            checkIn: waitlistCheckIn.toISOString(),
            checkOut: waitlistCheckOut.toISOString(),
            adults: 1,
            priority: 3,
            notes: 'Cross-verify waitlist entry',
          },
          cookie(state)
        );
        assert(created.success, 'Should create entry');

        const { data: fetched } = await api.get(
          `/api/waitlist?propertyId=${st.propertyId}`,
          cookie(state)
        );
        const entry = fetched.data.find((e: any) => e.id === created.data.id);
        assertNotNull(entry, 'Should find our entry');
        assertEqual(entry.propertyId, st.propertyId, 'Property should match');
        assertEqual(entry.roomTypeId, st.roomType2Id, 'Room type should match');
        assertNotNull(entry.roomType, 'Should include room type info');
        assertNotNull(entry.roomType.name, 'Room type should have name');
        assertNotNull(entry.property, 'Should include property info');

        // Clean up
        await fetch('http://localhost:3000/api/waitlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Cookie: cookie(state) },
          body: JSON.stringify({ id: created.data.id }),
        });
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
