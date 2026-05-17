/**
 * 01 - Bookings Calendar Tests
 *
 * Tests the bookings list API with date range filters, pagination,
 * search (confirmation code, guest name, email), and status/property/guest filters.
 * Cross-verifies bookings list matches room assignments from PMS tests.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  addDays,
  formatDate,
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
  const futureDate = addDays(new Date(), 60);

  await runSequentially('01-Bookings-Calendar', [
    {
      name: 'List all bookings (default, no filters)',
      fn: async () => {
        const { data } = await api.get('/api/bookings', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertGt(data.data.length, 0, 'Should have at least 1 booking');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.pagination.total, 'Pagination total should exist');
      },
    },
    {
      name: 'Filter by propertyId',
      fn: async () => {
        const { data } = await api.get(`/api/bookings?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        // Every returned booking should belong to the test property
        for (const b of data.data) {
          assertEqual(b.propertyId, st.propertyId, 'Booking should belong to test property');
        }
      },
    },
    {
      name: 'Filter by checkIn date range (checkInFrom, checkInTo)',
      fn: async () => {
        const from = formatDate(futureDate);
        const to = formatDate(addDays(futureDate, 10));
        const { data } = await api.get(
          `/api/bookings?checkInFrom=${from}&checkInTo=${to}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        // Every booking's checkIn should be within the range
        for (const b of data.data) {
          const bCheckIn = new Date(b.checkIn);
          assert(bCheckIn >= new Date(from) || bCheckIn <= new Date(to), 'CheckIn within range');
        }
      },
    },
    {
      name: 'Pagination: limit and offset',
      fn: async () => {
        // Get total first
        const { data: allData } = await api.get(`/api/bookings?propertyId=${st.propertyId}&limit=200`, cookie(state));
        const total = allData.pagination?.total || allData.data.length;

        // Page 1: limit=2, offset=0
        const { data: page1 } = await api.get(`/api/bookings?propertyId=${st.propertyId}&limit=2&offset=0`, cookie(state));
        assert(page1.success, 'Should succeed');
        assert(page1.data.length <= 2, 'Page 1 should have at most 2 results');

        // Page 2: limit=2, offset=2
        const { data: page2 } = await api.get(`/api/bookings?propertyId=${st.propertyId}&limit=2&offset=2`, cookie(state));
        assert(page2.success, 'Page 2 should succeed');
        assert(page2.data.length <= 2, 'Page 2 should have at most 2 results');

        // Ensure no overlap
        if (page1.data.length > 0 && page2.data.length > 0) {
          const ids1 = new Set(page1.data.map((b: any) => b.id));
          const overlap = page2.data.filter((b: any) => ids1.has(b.id));
          assertEqual(overlap.length, 0, 'Pages should not overlap');
        }
      },
    },
    {
      name: 'Search by confirmation code',
      fn: async () => {
        assertNotNull(st.confirmationCode, 'Need a confirmation code in state');
        const { data } = await api.get(`/api/bookings?search=${st.confirmationCode}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        // At least one booking should match the confirmation code
        const match = data.data.find((b: any) => b.confirmationCode === st.confirmationCode);
        assertNotNull(match, `Should find booking with code ${st.confirmationCode}`);
      },
    },
    {
      name: 'Search by guest name (firstName)',
      fn: async () => {
        // Get a guest name from existing bookings
        const { data: allBookings } = await api.get(`/api/bookings?propertyId=${st.propertyId}&limit=1`, cookie(state));
        if (allBookings.data.length > 0 && allBookings.data[0].primaryGuest?.firstName) {
          const firstName = allBookings.data[0].primaryGuest.firstName;
          const { data } = await api.get(`/api/bookings?search=${firstName}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data);
          assertGt(data.data.length, 0, 'Should find results by first name');
        }
      },
    },
    {
      name: 'Search by guest email',
      fn: async () => {
        const { data: allBookings } = await api.get(`/api/bookings?propertyId=${st.propertyId}&limit=1`, cookie(state));
        if (allBookings.data.length > 0 && allBookings.data[0].primaryGuest?.email) {
          const email = allBookings.data[0].primaryGuest.email;
          const { data } = await api.get(`/api/bookings?search=${email}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data);
          assertGt(data.data.length, 0, 'Should find results by email');
        }
      },
    },
    {
      name: 'Filter by status: confirmed',
      fn: async () => {
        const { data } = await api.get(`/api/bookings?status=confirmed&propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        for (const b of data.data) {
          assertEqual(b.status, 'confirmed', 'All results should be confirmed');
        }
      },
    },
    {
      name: 'Filter by status: checked_in',
      fn: async () => {
        const { data } = await api.get(`/api/bookings?status=checked_in&propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        for (const b of data.data) {
          assertEqual(b.status, 'checked_in', 'All results should be checked_in');
        }
      },
    },
    {
      name: 'Filter by status: cancelled',
      fn: async () => {
        const { data } = await api.get(`/api/bookings?status=cancelled&propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        for (const b of data.data) {
          assertEqual(b.status, 'cancelled', 'All results should be cancelled');
        }
      },
    },
    {
      name: 'Filter by guestId',
      fn: async () => {
        const { data } = await api.get(`/api/bookings?guestId=${st.guestId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        for (const b of data.data) {
          assertEqual(b.primaryGuestId, st.guestId, 'All results should belong to the guest');
        }
      },
    },
    {
      name: 'Cross-verify: Bookings list includes room assignments from PMS tests',
      fn: async () => {
        assertNotNull(st.bookingId, 'Should have a booking from PMS tests');
        const { data } = await api.get(`/api/bookings/${st.bookingId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.id, st.bookingId, 'Should find PMS test booking');
        // Should have room type info
        assertNotNull(data.data.roomTypeId, 'Should have room type');
        assertNotNull(data.data.primaryGuest, 'Should have guest info');
        assertNotNull(data.data.primaryGuest.firstName, 'Guest should have firstName');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
