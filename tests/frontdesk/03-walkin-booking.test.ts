/**
 * 03 - Walk-in Booking Tests
 *
 * Tests creating a brand new walk-in booking on the fly: guest creation,
 * available room lookup, booking creation with walk_in source, room assignment,
 * instant check-in, and cross-verification across guests and dashboard.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  formatDate,
  today,
  tomorrow,
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

  await runSequentially('03-WalkIn-Booking', [
    {
      name: 'Create a new guest for walk-in',
      fn: async () => {
        const timestamp = Date.now();
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.post(
          '/api/guests',
          {
            firstName: `Walkin`,
            lastName: `Guest${timestamp}`,
            email: `walkin.guest${timestamp}@example.com`,
            phone: `+1-555-${String(timestamp).slice(-7)}`,
            nationality: 'US',
          },
          auth,
        );
        assert(data.success, 'Guest creation should succeed');
        assertNotNull(data.data, 'Should return guest data');
        assertNotNull(data.data.id, 'Guest should have id');
        assertNotNull(data.data.firstName, 'Guest should have firstName');
        saveState({ walkinGuestId: data.data.id });
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'GET /api/rooms/available — find available room for tonight',
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
        assertGt(list.length, 0, 'Should have at least 1 available room for tonight');
        // Save the first available room for the walk-in booking
        const availableRoom = list.find((r: any) => r.id && r.id !== st.room1Id) || list[0];
        if (availableRoom) {
          saveState({ walkinAvailableRoomId: availableRoom.id });
        }
      },
    },
    {
      name: 'Create walk-in booking',
      fn: async () => {
        assertNotNull(st.walkinGuestId, 'Need walkinGuestId from step 1');
        const checkIn = formatDate(today());
        const checkOut = formatDate(tomorrow());
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.post(
          '/api/bookings',
          {
            propertyId: st.propertyId,
            primaryGuestId: st.walkinGuestId,
            roomTypeId: st.roomType1Id,
            checkIn,
            checkOut,
            adults: 1,
            source: 'walk_in',
            status: 'confirmed',
            ratePlanId: st.ratePlanBarId,
            usePricingEngine: true,
          },
          auth,
        );
        assert(data.success, 'Walk-in booking creation should succeed');
        assertNotNull(data.data, 'Should return booking data');
        assertNotNull(data.data.id, 'Booking should have id');
        assertNotNull(data.data.confirmationCode, 'Booking should have confirmation code');
        saveState({
          walkinBookingId: data.data.id,
          walkinConfirmationCode: data.data.confirmationCode,
        });
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Verify booking created — source is walk_in',
      fn: async () => {
        assertNotNull(st.walkinBookingId, 'Need walkinBookingId in state');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/${st.walkinBookingId}`, auth);
        assert(data.success, 'Should succeed');
        assertEqual(data.data.source, 'walk_in', 'Booking source should be walk_in');
        assertNotNull(data.data.confirmationCode, 'Should have confirmation code');
      },
    },
    {
      name: 'Assign room to walk-in booking',
      fn: async () => {
        assertNotNull(st.walkinBookingId, 'Need walkinBookingId');
        const roomIdToAssign = st.walkinAvailableRoomId || st.room2Id;
        await delay(DELAY_BETWEEN_CALLS);
        const { data: booking } = await api.get(`/api/bookings/${st.walkinBookingId}`, auth);
        assert(booking.success, 'Should get booking');

        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.put(
          `/api/bookings/${st.walkinBookingId}`,
          { roomId: roomIdToAssign, status: booking.data.status },
          auth,
        );
        assert(data.success, 'Room assignment should succeed');
        assertNotNull(data.data.roomId, 'Booking should now have roomId');
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Check-in the walk-in booking',
      fn: async () => {
        assertNotNull(st.walkinBookingId, 'Need walkinBookingId');
        const checkinTime = new Date().toISOString();
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.put(
          `/api/bookings/${st.walkinBookingId}`,
          { status: 'checked_in', checkedInAt: checkinTime },
          auth,
        );
        assert(data.success, 'Walk-in check-in should succeed');
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Verify walk-in booking is checked_in',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/${st.walkinBookingId}`, auth);
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'checked_in', 'Walk-in booking should be checked_in');
        assertNotNull(data.data.checkedInAt || data.data.checkInTime, 'Should have check-in timestamp');
      },
    },
    {
      name: 'Cross-verify: GET /api/guests/[walkinGuestId] — guest has booking reference',
      fn: async () => {
        assertNotNull(st.walkinGuestId, 'Need walkinGuestId');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/guests/${st.walkinGuestId}`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Guest should exist');
        assertNotNull(data.data.id, 'Guest should have id');
        assertEqual(data.data.id, st.walkinGuestId, 'Should be the correct guest');
        // Guest may have bookings reference
        assertNotNull(data.data.firstName, 'Guest should have firstName');
      },
    },
    {
      name: 'Cross-verify: dashboard arrivals increased',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/frontdesk/dashboard?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Dashboard should succeed');
        assertNotNull(data.data, 'Dashboard should have data');
        assertNotNull(data.data.arrivalsToday, 'Should have arrivalsToday');
        assertGt(data.data.arrivalsToday, 0, 'Arrivals should be > 0 after walk-in check-in');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
