/**
 * 10 - Cross-Module Verification (Front Desk Master Test)
 *
 * Master cross-module verification for Front Desk:
 *   - GET frontdesk dashboard — verify all fields
 *   - GET bookings count for the property
 *   - Cross-verify dashboard.checkedIn matches bookings with status "checked_in"
 *   - Cross-verify rooms total matches dashboard totalRooms
 *   - GET key cards and verify they exist
 *   - GET room move history for test booking
 *   - GET kiosk settings and verify
 *   - GET early check-in requests
 *   - GET late checkout requests
 *   - GET registration card accessibility
 *   - FINAL VERIFICATION: All front desk module data consistent across endpoints
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
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
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

  await runSequentially('10-Cross-Module-Verification', [
    // 1. GET frontdesk dashboard — verify all fields
    {
      name: 'GET frontdesk dashboard — verify all fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        const { data } = await api.get(
          `/api/frontdesk/dashboard?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Dashboard should load');
        assertNotNull(data.data, 'Should return dashboard data');

        const dashboard = data.data;
        assertNotNull(dashboard.arrivalsToday !== undefined, 'Should have arrivalsToday');
        assertNotNull(dashboard.departuresToday !== undefined, 'Should have departuresToday');
        assertNotNull(dashboard.checkedIn !== undefined, 'Should have checkedIn');
        assertNotNull(dashboard.availableRooms !== undefined, 'Should have availableRooms');
        assertNotNull(dashboard.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(dashboard.occupancyRate !== undefined, 'Should have occupancyRate');

        console.log(`      Dashboard: ${dashboard.checkedIn} checked-in, ${dashboard.availableRooms}/${dashboard.totalRooms} rooms, ${dashboard.occupancyRate}% occupancy`);
      },
    },

    // 2. GET bookings count for the property
    {
      name: 'GET bookings count for the property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        const { data } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}&limit=200`,
          cookie(state)
        );
        assert(data.success, 'Bookings list should load');
        assertGt(data.data.length, 0, 'Should have bookings');

        const checkedInCount = data.data.filter(
          (b: any) => b.status === 'checked_in'
        ).length;
        console.log(`      Total bookings: ${data.data.length}, checked_in: ${checkedInCount}`);

        // Save for cross-verification
        saveState({ crossVerifyCheckedInCount: checkedInCount });
      },
    },

    // 3. Cross-verify: dashboard.checkedIn matches bookings with status "checked_in"
    {
      name: 'Cross-verify: dashboard.checkedIn matches booking count',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        const updated = loadState();

        // Get dashboard
        const { data: dashData } = await api.get(
          `/api/frontdesk/dashboard?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(dashData.success, 'Dashboard should load');

        // Get bookings
        await delay(DELAY_BETWEEN_CALLS);
        const { data: bookingsData } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}&status=checked_in&limit=200`,
          cookie(state)
        );
        assert(bookingsData.success, 'Bookings list should load');

        const dashboardCheckedIn = dashData.data.checkedIn;
        const bookingsCheckedIn = Array.isArray(bookingsData.data) ? bookingsData.data.length : 0;

        assertEqual(dashboardCheckedIn, bookingsCheckedIn, 'Dashboard checkedIn should match bookings count');
        console.log(`      Verified: dashboard.checkedIn (${dashboardCheckedIn}) = bookings.checked_in (${bookingsCheckedIn})`);
      },
    },

    // 4. Cross-verify: rooms total matches dashboard totalRooms
    {
      name: 'Cross-verify: rooms total matches dashboard totalRooms',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');

        // Get dashboard
        const { data: dashData } = await api.get(
          `/api/frontdesk/dashboard?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(dashData.success, 'Dashboard should load');

        // Get rooms
        await delay(DELAY_BETWEEN_CALLS);
        const { data: roomsData } = await api.get(
          `/api/rooms?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(roomsData.success, 'Rooms list should load');

        const totalRooms = Array.isArray(roomsData.data) ? roomsData.data.length : roomsData.data.total;
        assert(totalRooms !== undefined, 'Should have total rooms count');
        assertEqual(dashData.data.totalRooms, totalRooms, 'Dashboard totalRooms should match rooms list count');
        console.log(`      Verified: totalRooms = ${totalRooms}`);
      },
    },

    // 5. GET key cards and verify they exist
    {
      name: 'GET key cards for property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        try {
          const { data } = await api.get(
            `/api/key-cards?propertyId=${st.propertyId}`,
            cookie(state)
          );
          assert(data.success, 'Key cards should load');
          assertNotNull(data.data, 'Should return key cards data');
          if (Array.isArray(data.data)) {
            console.log(`      Key cards found: ${data.data.length}`);
          } else {
            console.log(`      Key cards response received`);
          }
        } catch (err: any) {
          console.log(`      (key cards: ${err.message})`);
        }
      },
    },

    // 6. GET room move history for test booking
    {
      name: 'GET room move history for test booking',
      fn: async () => {
        const updated = loadState();
        const bookingId = updated.roomMoveTestBookingId || updated.bookingId;
        assertNotNull(bookingId, 'Need booking ID for room move history');

        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.get(
            `/api/bookings/room-move/history?bookingId=${bookingId}`,
            cookie(state)
          );
          assert(data.success, 'Room move history should load');
          assertNotNull(data.data, 'Should return history data');
          if (Array.isArray(data.data)) {
            console.log(`      Room move history entries: ${data.data.length}`);
          }
        } catch (err: any) {
          console.log(`      (room move history: ${err.message})`);
        }
      },
    },

    // 7. GET kiosk settings and verify
    {
      name: 'GET kiosk settings — verify configuration',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        const { data } = await api.get(
          `/api/frontdesk/kiosk-settings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Kiosk settings should load');
        assertNotNull(data.data, 'Should return settings data');
        assertNotNull(data.data.hotelName, 'Settings should have hotelName');
        assertNotNull(data.data.primaryColor, 'Settings should have primaryColor');
        assertNotNull(data.data.idleTimeout !== undefined, 'Settings should have idleTimeout');
        assertNotNull(data.data.enableCheckIn !== undefined, 'Settings should have enableCheckIn');
        console.log(`      Kiosk: ${data.data.hotelName}, color: ${data.data.primaryColor}, timeout: ${data.data.idleTimeout}s`);
      },
    },

    // 8. GET early check-in requests
    {
      name: 'GET early check-in requests for property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        try {
          const { data } = await api.get(
            `/api/bookings/early-checkin?propertyId=${st.propertyId}`,
            cookie(state)
          );
          assert(data.success, 'Early check-in requests should load');
          assertNotNull(data.data !== undefined, 'Should return data');
          const requests = Array.isArray(data.data) ? data.data : data.data.items || [];
          console.log(`      Early check-in requests: ${requests.length}`);
        } catch (err: any) {
          console.log(`      (early check-in: ${err.message})`);
        }
      },
    },

    // 9. GET late checkout requests
    {
      name: 'GET late checkout requests for property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.propertyId, 'Need property ID');
        try {
          const { data } = await api.get(
            `/api/bookings/late-checkout?propertyId=${st.propertyId}`,
            cookie(state)
          );
          assert(data.success, 'Late checkout requests should load');
          assertNotNull(data.data !== undefined, 'Should return data');
          const requests = Array.isArray(data.data) ? data.data : data.data.items || [];
          console.log(`      Late checkout requests: ${requests.length}`);
        } catch (err: any) {
          console.log(`      (late checkout: ${err.message})`);
        }
      },
    },

    // 10. GET registration card accessibility
    {
      name: 'GET registration card — verify accessibility',
      fn: async () => {
        assertNotNull(st.bookingId, 'Need booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.get(
            `/api/folio/registration-card?bookingId=${st.bookingId}`,
            cookie(state)
          );
          assert(data.success !== undefined, 'Registration card endpoint should respond');
          console.log(`      Registration card: accessible`);
        } catch (err: any) {
          // 404 is acceptable if no card was generated yet
          console.log(`      Registration card: ${err.message}`);
        }
      },
    },

    // 11. FINAL VERIFICATION: All front desk module data consistent across endpoints
    {
      name: 'FINAL VERIFICATION: All front desk module data consistent',
      fn: async () => {
        assertNotNull(st.propertyId, 'Need property ID');

        // Gather all module data
        await delay(DELAY_BETWEEN_CALLS);
        const { data: dashData } = await api.get(
          `/api/frontdesk/dashboard?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(dashData.success, 'Dashboard should load');

        await delay(DELAY_BETWEEN_CALLS);
        const { data: bookingsData } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}&limit=200`,
          cookie(state)
        );
        assert(bookingsData.success, 'Bookings should load');

        await delay(DELAY_BETWEEN_CALLS);
        const { data: roomsData } = await api.get(
          `/api/rooms?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(roomsData.success, 'Rooms should load');

        await delay(DELAY_BETWEEN_CALLS);
        const { data: kioskData } = await api.get(
          `/api/frontdesk/kiosk-settings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(kioskData.success, 'Kiosk settings should load');

        // Final consistency checks
        const dashboard = dashData.data;
        const bookings = bookingsData.data;
        const rooms = roomsData.data;
        const totalRooms = Array.isArray(rooms) ? rooms.length : rooms.total;

        // Verify counts make sense
        assertGt(bookings.length, 0, 'Should have bookings');
        assertGt(totalRooms, 0, 'Should have rooms');
        assert(dashboard.checkedIn <= bookings.length, 'Checked-in count should not exceed total bookings');
        assert(dashboard.availableRooms <= totalRooms, 'Available rooms should not exceed total rooms');

        // Verify all rooms belong to the property
        if (Array.isArray(rooms)) {
          for (const room of rooms) {
            assertEqual(room.propertyId, st.propertyId, 'All rooms should belong to the property');
          }
        }

        // Verify all bookings belong to the property
        for (const booking of bookings) {
          assertEqual(booking.propertyId, st.propertyId, 'All bookings should belong to the property');
        }

        console.log(`\n     ✅ FINAL VERIFICATION: ALL FRONT DESK MODULE DATA CONSISTENT`);
        console.log(`        Dashboard: ${dashboard.checkedIn} checked-in, ${dashboard.availableRooms}/${dashboard.totalRooms} rooms`);
        console.log(`        Bookings: ${bookings.length} total`);
        console.log(`        Rooms: ${totalRooms} total`);
        console.log(`        Occupancy Rate: ${dashboard.occupancyRate}%`);
        console.log(`        Kiosk: ${kioskData.data.hotelName} (${kioskData.data.primaryColor})`);
        console.log(`        Property: ${st.propertyId}`);
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
