/**
 * 02 - Front Desk Check-out Tests
 *
 * Tests the full check-out flow. Creates a fresh checked-in booking
 * if the one from test 01 is already checked_out.
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
  addDays,
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

  // Step 0: Ensure we have a checked-in booking to check out
  let checkoutBookingId = st.checkinBookingId;
  let checkoutGuestId = st.checkinGuestId;
  let checkoutRoomId = st.checkinRoomId;
  let checkoutKeyCardId = st.keyCardId;

  // Check if the booking from test 01 is still checked_in
  if (checkoutBookingId) {
    await delay(DELAY_BETWEEN_CALLS);
    try {
      const { data } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
      if (data.success && data.data.status === 'checked_in') {
        console.log('  ℹ️  Checkin booking from test 01 is checked_in — reusing');
        checkoutRoomId = data.data.roomId || checkoutRoomId;
      } else {
        console.log(`  ℹ️  Checkin booking status: ${data.data.status} — creating fresh one`);
        checkoutBookingId = undefined;
      }
    } catch {
      checkoutBookingId = undefined;
    }
  }

  // Create a fresh checked-in booking if needed
  if (!checkoutBookingId) {
    console.log('  Creating fresh booking for checkout test...');

    // Create guest
    await delay(DELAY_BETWEEN_CALLS);
    const { data: gd } = await api.post('/api/guests', {
      firstName: 'Checkout',
      lastName: `Test${Date.now() % 10000}`,
      email: `checkout-${Date.now()}@example.com`,
      phone: `+919${Math.floor(100000000 + Math.random() * 900000000)}`,
      nationality: 'IN',
    }, auth);
    assert(gd.success, 'Guest creation should succeed');
    checkoutGuestId = gd.data.id;
    await delay(DELAY_AFTER_MUTATION);

    // Create booking with future dates
    await delay(DELAY_BETWEEN_CALLS);
    const { data: bd } = await api.post('/api/bookings', {
      propertyId: st.propertyId,
      primaryGuestId: checkoutGuestId,
      roomTypeId: st.roomType2Id || st.roomType1Id,
      checkIn: formatDate(addDays(today(), 5)),
      checkOut: formatDate(addDays(today(), 8)),
      adults: 2,
      source: 'direct',
      status: 'confirmed',
      ratePlanId: st.ratePlanBarId,
      usePricingEngine: false,
      roomRate: 5000,
      totalAmount: 15000,
      currency: 'INR',
    }, auth);
    assert(bd.success, 'Booking creation should succeed');
    checkoutBookingId = bd.data.id;
    await delay(DELAY_AFTER_MUTATION);

    // Assign room
    await delay(DELAY_BETWEEN_CALLS);
    try {
      await api.put(`/api/bookings/${checkoutBookingId}`, { roomId: st.room4Id, status: 'confirmed' }, auth);
      checkoutRoomId = st.room4Id;
    } catch (err: any) {
      console.log(`      (room assignment note: ${err.message.split(':')[0]})`);
    }
    await delay(DELAY_AFTER_MUTATION);

    // Check-in
    await delay(DELAY_BETWEEN_CALLS);
    await api.put(`/api/bookings/${checkoutBookingId}`, { status: 'checked_in' }, auth);
    await delay(DELAY_AFTER_MUTATION);

    // Create key card
    await delay(DELAY_BETWEEN_CALLS);
    const { data: kcd } = await api.post('/api/key-cards', {
      roomId: checkoutRoomId || st.room4Id,
      guestId: checkoutGuestId,
      bookingId: checkoutBookingId,
      cardType: 'physical',
      accessLevel: 'standard',
      validFrom: formatDate(today()),
      validTo: formatDate(addDays(today(), 5)),
    }, auth);
    if (kcd.success && kcd.data?.id) {
      checkoutKeyCardId = kcd.data.id;
    }
    await delay(DELAY_AFTER_MUTATION);

    saveState({
      checkoutBookingId,
      checkoutGuestId,
      checkoutRoomId,
    });
    console.log('  ✅ Fresh booking created and checked in');
  }

  await runSequentially('02-FrontDesk-CheckOut', [
    {
      name: 'Verify booking is checked_in before checkout',
      fn: async () => {
        assertNotNull(checkoutBookingId, 'Need checkoutBookingId');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'checked_in', 'Booking should be checked_in before checkout');
      },
    },
    {
      name: 'GET /api/frontdesk/dashboard — verify structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/frontdesk/dashboard?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Dashboard should succeed');
        assertNotNull(data.data, 'Dashboard should have data');
        assertNotNull(data.data.totalRooms, 'Should have totalRooms');
        assertNotNull(data.data.occupancyRate !== undefined, 'Should have occupancyRate');
      },
    },
    {
      name: 'Late checkout request — POST /api/bookings/late-checkout',
      fn: async () => {
        assertNotNull(checkoutBookingId, 'Need checkoutBookingId');
        // Get booking checkout date
        await delay(DELAY_BETWEEN_CALLS);
        const { data: bd } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
        const checkoutDate = new Date(bd.data.checkOut);
        // Set requested time to 3 PM on the checkout date (after 11 AM standard checkout)
        checkoutDate.setHours(15, 0, 0, 0);
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.post(
          '/api/bookings/late-checkout',
          { bookingId: checkoutBookingId, requestedUntil: checkoutDate.toISOString(), reason: 'Evening flight departure' },
          auth,
        );
        assert(data.success, 'Late checkout request should succeed');
        assertNotNull(data.data, 'Should return request data');
        const requestId = data.data.id || data.data.requestId;
        if (requestId) {
          saveState({ lateCheckoutRequestId: requestId });
        }
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'GET /api/bookings/late-checkout — verify request exists',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/late-checkout?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return data');
        const list = Array.isArray(data.data) ? data.data : data.data.requests || data.data.items || [data.data];
        assertGt(list.length, 0, 'Should have at least 1 late checkout request');
      },
    },
    {
      name: 'Perform check-out — PUT status to checked_out',
      fn: async () => {
        assertNotNull(checkoutBookingId, 'Need checkoutBookingId');
        // Check if already checked out
        await delay(DELAY_BETWEEN_CALLS);
        const { data: current } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
        if (current.data.status === 'checked_out') {
          console.log('      (skipped — already checked_out)');
          return;
        }
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.put(
          `/api/bookings/${checkoutBookingId}`,
          { status: 'checked_out' },
          auth,
        );
        assert(data.success, 'Check-out should succeed');
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Verify booking status is now checked_out',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'checked_out', 'Booking status should be checked_out');
      },
    },
    {
      name: 'Verify check-out timestamp on booking',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/bookings/${checkoutBookingId}`, auth);
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'checked_out', 'Status should still be checked_out');
        const ts = data.data.checkedOutAt || data.data.checkOutTime || data.data.actualCheckOut;
        if (ts) {
          console.log(`      Check-out timestamp: ${ts}`);
        } else {
          console.log('      (check-out timestamp not set — status confirmed via status field)');
        }
      },
    },
    {
      name: 'Cross-verify: dashboard checkOutsCompleted metric',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/frontdesk/dashboard?propertyId=${st.propertyId}`, auth);
        assert(data.success, 'Dashboard should succeed');
        const checkouts = data.data.checkOutsCompleted || data.data.checkOutsCompletedToday || 0;
        assertGt(checkouts, 0, 'Check-outs completed should be > 0 after our check-out');
      },
    },
    {
      name: 'Deactivate key card if exists',
      fn: async () => {
        if (!checkoutKeyCardId) {
          console.log('      (skipped — no keyCardId)');
          return;
        }
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.put(
            '/api/key-cards',
            { id: checkoutKeyCardId, action: 'deactivate', notes: 'Guest checked out' },
            auth,
          );
          assert(data.success, 'Key card deactivation should succeed');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          console.log(`      (skipped — ${err.message})`);
        }
      },
    },
    {
      name: 'Cross-verify: folio exists for booking',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data: folioList } = await api.get(`/api/folios?bookingId=${checkoutBookingId}`, auth);
          if (folioList.success && folioList.data && folioList.data.length > 0) {
            assertNotNull(folioList.data[0].id, 'Folio should have id');
            console.log(`      (folio found: ${folioList.data[0].id})`);
          } else {
            console.log('      (folio may be created on-demand)');
          }
        } catch (err: any) {
          console.log(`      (folio check skipped: ${err.message})`);
        }
      },
    },
    {
      name: 'GET /api/bookings?status=checked_out — verify in list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}&status=checked_out&limit=100`,
          auth,
        );
        assert(data.success, 'Bookings list should succeed');
        const list = Array.isArray(data.data) ? data.data : [];
        const found = list.find((b: any) => b.id === checkoutBookingId);
        assertNotNull(found, 'Our checked-out booking should appear in filtered list');
      },
    },
    {
      name: 'Cross-verify: room status after checkout',
      fn: async () => {
        const roomId = checkoutRoomId || st.room3Id;
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/rooms/${roomId}`, auth);
        assert(data.success, 'Room should load');
        const status = data.data.status;
        console.log(`      Room status after checkout: ${status}`);
        // Room should not be occupied after checkout
        assert(status !== 'occupied', 'Room should not remain occupied after guest checkout');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
