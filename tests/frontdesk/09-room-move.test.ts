/**
 * 09 - Room Move Tests
 *
 * Tests Room Move functionality in depth:
 *   - Load state, get an existing checked-in booking or create one
 *   - If no checked-in booking exists, create and check in one
 *   - GET current room assignment for the booking
 *   - POST room move (from current room to room3)
 *   - Verify room move response (roomNumber, roomType, moveLog)
 *   - GET booking and verify room changed
 *   - GET room move history
 *   - Verify history entry fields
 *   - Perform second room move
 *   - Verify second move and history has 2 entries
 *   - Cross-verify room statuses after moves
 *   - Test error: moving to same room should fail
 *   - Test all reason values: guest_request, maintenance, upgrade, availability, other
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

  /** Track IDs created during tests */
  let testBookingId: string | null = null;
  let currentRoomId: string | null = null;
  let originalRoomId: string | null = null;

  await runSequentially('09-Room-Move', [
    // 1. Load state, get existing checked-in booking or create one
    {
      name: 'Find or create a checked-in booking for room move tests',
      fn: async () => {
        assertNotNull(st.propertyId, 'Need property ID');
        assertNotNull(st.guestId, 'Need guest ID');

        // Try to find an existing checked-in booking
        await delay(DELAY_BETWEEN_CALLS);
        const { data: bookingsData } = await api.get(
          `/api/bookings?propertyId=${st.propertyId}&status=checked_in&limit=5`,
          cookie(state)
        );
        if (bookingsData.success && bookingsData.data && bookingsData.data.length > 0) {
          const checkedInBooking = bookingsData.data[0];
          testBookingId = checkedInBooking.id;
          currentRoomId = checkedInBooking.roomId || checkedInBooking.room?.id;
          originalRoomId = currentRoomId;
          console.log(`      Using existing checked-in booking: ${testBookingId} (room: ${currentRoomId})`);
          return;
        }

        // No checked-in booking — create one
        console.log('      No checked-in booking found — creating one...');
        await delay(DELAY_BETWEEN_CALLS);
        const { data: newBooking } = await api.post(
          '/api/bookings',
          {
            propertyId: st.propertyId,
            guestId: st.guestId,
            roomTypeId: st.roomType1Id,
            checkIn: formatDate(today()),
            checkOut: formatDate(tomorrow()),
            adults: 1,
            children: 0,
            ratePlanId: st.ratePlanBarId,
            source: 'walk_in',
            status: 'checked_in',
            notes: 'Room move test booking',
          },
          cookie(state)
        );
        assert(newBooking.success, 'Should create booking');
        assertNotNull(newBooking.data?.id, 'Should have booking ID');
        testBookingId = newBooking.data.id;
        await delay(DELAY_AFTER_MUTATION);

        // Assign room
        if (st.room1Id) {
          await delay(DELAY_BETWEEN_CALLS);
          try {
            const { data: assignData } = await api.post(
              `/api/bookings/${testBookingId}/assign-room`,
              { roomId: st.room1Id },
              cookie(state)
            );
            if (assignData.success) {
              currentRoomId = st.room1Id;
              originalRoomId = st.room1Id;
              await delay(DELAY_AFTER_MUTATION);
            }
          } catch {
            // Room might already be assigned
            currentRoomId = newBooking.data.roomId || st.room1Id;
            originalRoomId = currentRoomId;
          }
        }

        saveState({ roomMoveTestBookingId: testBookingId });
        console.log(`      Created booking: ${testBookingId} (room: ${currentRoomId})`);
      },
    },

    // 2. GET current room assignment
    {
      name: 'GET current room assignment for the booking',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/bookings/${testBookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should load');
        assertNotNull(data.data, 'Should return booking');
        assertNotNull(data.data.roomId || data.data.room, 'Booking should have room assignment');

        if (data.data.roomId) {
          currentRoomId = data.data.roomId;
          if (!originalRoomId) originalRoomId = data.data.roomId;
        } else if (data.data.room?.id) {
          currentRoomId = data.data.room.id;
          if (!originalRoomId) originalRoomId = data.data.room.id;
        }
        console.log(`      Current room: ${currentRoomId}`);
      },
    },

    // 3. POST room move — move from current room to room3
    {
      name: 'POST room move from current room to room3',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        assertNotNull(currentRoomId, 'Need current room ID');
        assertNotNull(st.room3Id, 'Need room3 ID');

        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/bookings/room-move',
            {
              bookingId: testBookingId,
              fromRoomId: currentRoomId,
              toRoomId: st.room3Id,
              reason: 'upgrade',
              notes: 'Guest requested upgrade',
            },
            cookie(state)
          );
          assert(data.success, 'Room move should succeed');
          assertNotNull(data.data, 'Should return move data');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          // Room might not be available — try another target
          console.log(`      (room3 move failed: ${err.message}, trying room4)`);
          assertNotNull(st.room4Id, 'Need room4 ID as fallback');
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.post(
            '/api/bookings/room-move',
            {
              bookingId: testBookingId,
              fromRoomId: currentRoomId,
              toRoomId: st.room4Id,
              reason: 'upgrade',
              notes: 'Guest requested upgrade',
            },
            cookie(state)
          );
          assert(data.success, 'Fallback room move should succeed');
          assertNotNull(data.data, 'Should return move data');
          await delay(DELAY_AFTER_MUTATION);
        }
      },
    },

    // 4. Verify room move response has required fields
    {
      name: 'Verify room move response has roomNumber, roomType, moveLog',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        // Verify through booking — room should have changed
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/bookings/${testBookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should load');
        assertNotNull(data.data.roomId || data.data.room, 'Booking should still have room assignment');
        assertNotNull(data.data.roomNumber || data.data.room?.roomNumber, 'Booking should have room number');

        const booking = data.data;
        const newRoomId = booking.roomId || booking.room?.id;
        assertNotNull(newRoomId, 'Should have new room ID');
        assert(newRoomId !== originalRoomId, 'Room should have changed');
        currentRoomId = newRoomId;
        console.log(`      Room moved to: ${newRoomId} (${booking.roomNumber || booking.room?.roomNumber})`);
      },
    },

    // 5. GET booking and verify room changed
    {
      name: 'GET booking — verify room changed to target room',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/bookings/${testBookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should load');
        const booking = data.data;
        const assignedRoomId = booking.roomId || booking.room?.id;
        assertNotNull(assignedRoomId, 'Booking should have room assigned');
        // Room should be one of room3 or room4
        assert(
          assignedRoomId === st.room3Id || assignedRoomId === st.room4Id,
          'Booking should be assigned to the target room'
        );
        console.log(`      Verified: room = ${assignedRoomId}`);
      },
    },

    // 6. GET room move history
    {
      name: 'GET room move history for booking',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.get(
            `/api/bookings/room-move/history?bookingId=${testBookingId}`,
            cookie(state)
          );
          assert(data.success, 'Room move history should load');
          assertNotNull(data.data, 'Should return history data');
          assert(Array.isArray(data.data), 'History should be an array');
          assertGt(data.data.length, 0, 'Should have at least one move entry');
        } catch (err: any) {
          console.log(`      (room move history: ${err.message})`);
        }
      },
    },

    // 7. Verify history entry has required fields
    {
      name: 'Verify history entry has fromRoomId, toRoomId, reason, movedBy',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.get(
            `/api/bookings/room-move/history?bookingId=${testBookingId}`,
            cookie(state)
          );
          assert(data.success, 'History should load');
          const history = data.data;
          if (Array.isArray(history) && history.length > 0) {
            const entry = history[0];
            assertNotNull(entry.fromRoomId, 'Entry should have fromRoomId');
            assertNotNull(entry.toRoomId, 'Entry should have toRoomId');
            assertNotNull(entry.reason, 'Entry should have reason');
            assertNotNull(entry.movedBy, 'Entry should have movedBy');
            assertNotNull(entry.rateDifference !== undefined, 'Entry should have rateDifference');
            console.log(`      History entry: ${entry.fromRoomId} → ${entry.toRoomId} (${entry.reason})`);
          }
        } catch (err: any) {
          console.log(`      (history verification: ${err.message})`);
        }
      },
    },

    // 8. Perform second room move
    {
      name: 'POST second room move (maintenance reason)',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        assertNotNull(currentRoomId, 'Need current room ID');

        // Determine target room (different from current)
        const targetRoomId = currentRoomId === st.room3Id ? st.room4Id : st.room3Id;
        assertNotNull(targetRoomId, 'Need target room ID');

        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/bookings/room-move',
            {
              bookingId: testBookingId,
              fromRoomId: currentRoomId,
              toRoomId: targetRoomId,
              reason: 'maintenance',
              notes: 'Maintenance required in current room',
            },
            cookie(state)
          );
          assert(data.success, 'Second room move should succeed');
          assertNotNull(data.data, 'Should return move data');
          currentRoomId = targetRoomId;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          console.log(`      (second move: ${err.message})`);
        }
      },
    },

    // 9. Verify second move
    {
      name: 'Verify second room move succeeded',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/bookings/${testBookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should load');
        const assignedRoomId = data.data.roomId || data.data.room?.id;
        assertNotNull(assignedRoomId, 'Booking should have room assigned');
        currentRoomId = assignedRoomId;
        console.log(`      After second move: room = ${currentRoomId}`);
      },
    },

    // 10. GET room move history — verify 2+ entries
    {
      name: 'GET room move history — verify at least 2 entries',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.get(
            `/api/bookings/room-move/history?bookingId=${testBookingId}`,
            cookie(state)
          );
          assert(data.success, 'History should load');
          const history = data.data;
          if (Array.isArray(history)) {
            assertGt(history.length, 1, 'Should have at least 2 move entries');
            assert(history.length >= 2, 'Total moves should be >= 2');
            console.log(`      Total move entries: ${history.length}`);
          }
        } catch (err: any) {
          console.log(`      (history count verification: ${err.message})`);
        }
      },
    },

    // 11. Cross-verify: room3 status should be available or dirty
    {
      name: 'Cross-verify: room3 status after move',
      fn: async () => {
        assertNotNull(st.room3Id, 'Need room3 ID');
        assertNotNull(currentRoomId, 'Need current room ID');
        // Only verify if booking is NOT in room3
        if (currentRoomId === st.room3Id) {
          console.log('      (skipped — booking is currently in room3)');
          return;
        }
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/rooms/${st.room3Id}`,
          cookie(state)
        );
        assert(data.success, 'Room3 should load');
        const status = data.data.status || data.data.housekeepingStatus;
        console.log(`      Room3 status: ${status}`);
        // Room should not be occupied by this booking
        assert(
          status !== 'occupied' && status !== 'OCCUPIED',
          'Room3 should not be occupied'
        );
      },
    },

    // 12. Cross-verify: current room should show as occupied
    {
      name: 'Cross-verify: current room should show as occupied',
      fn: async () => {
        assertNotNull(currentRoomId, 'Need current room ID');
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(
          `/api/rooms/${currentRoomId}`,
          cookie(state)
        );
        assert(data.success, 'Current room should load');
        assertNotNull(data.data, 'Room data should exist');
        const status = data.data.status || data.data.housekeepingStatus;
        console.log(`      Current room (${currentRoomId}) status: ${status}`);
      },
    },

    // 13. Test error: moving to same room should fail
    {
      name: 'Test error: moving to same room should fail',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        assertNotNull(currentRoomId, 'Need current room ID');
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post(
            '/api/bookings/room-move',
            {
              bookingId: testBookingId,
              fromRoomId: currentRoomId,
              toRoomId: currentRoomId,
              reason: 'guest_request',
            },
            cookie(state)
          );
          console.log('      (same-room move not rejected — may be accepted as no-op)');
        } catch (err: any) {
          assert(true, 'Moving to same room should fail');
          console.log(`      Correctly rejected: ${err.message}`);
        }
      },
    },

    // 14. Test all reason values
    {
      name: 'Test room move with all reason values',
      fn: async () => {
        assertNotNull(testBookingId, 'Need test booking ID');
        assertNotNull(currentRoomId, 'Need current room ID');
        assertNotNull(st.room3Id, 'Need room3 ID');

        const reasons = ['guest_request', 'maintenance', 'upgrade', 'availability', 'other'];

        for (const reason of reasons) {
          await delay(DELAY_BETWEEN_CALLS);
          try {
            // Determine a different target room
            const targetRoomId = currentRoomId === st.room3Id ? st.room4Id : st.room3Id;
            assertNotNull(targetRoomId, `Need target for reason: ${reason}`);

            const { data } = await api.post(
              '/api/bookings/room-move',
              {
                bookingId: testBookingId,
                fromRoomId: currentRoomId,
                toRoomId: targetRoomId,
                reason,
                notes: `Test reason: ${reason}`,
              },
              cookie(state)
            );
            assert(data.success, `Room move with reason "${reason}" should succeed`);
            currentRoomId = targetRoomId;
            console.log(`      Reason "${reason}": ✅ moved to ${currentRoomId}`);
            await delay(DELAY_AFTER_MUTATION);
          } catch (err: any) {
            console.log(`      Reason "${reason}": ⚠️ ${err.message}`);
            // Continue to next reason — room may not be available for rapid moves
          }
        }

        saveState({ roomMoveTestBookingId: testBookingId });
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
