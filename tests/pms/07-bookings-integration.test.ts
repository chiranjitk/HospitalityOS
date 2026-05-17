/**
 * 07 - Bookings Integration Test
 *
 * Tests the full booking flow: guest creation → booking → folio → room assignment.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  addDays,
  formatDate,
  formatISO,
  assert,
  assertEqual,
  assertGt,
  assertIncludes,
  assertMatch,
  assertNotNull,
  assertStatus,
  ApiError,
  clearState,
} from './setup';

async function main() {
  const state = await authenticate();

  const checkIn = addDays(new Date(), 45);
  const checkOut = addDays(checkIn, 2);

  await runSequentially('07-Bookings-Integration', [
    {
      name: 'Create guest profile',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/guests',
          {
            firstName: 'John',
            lastName: 'Doe',
            email: `john.doe.${Date.now()}@example.com`,
            phone: '+919876543210',
            nationality: 'IN',
            city: 'Mumbai',
            country: 'India',
            preferences: { preferredFloor: 2, pillowType: 'firm' },
            loyaltyTier: 'silver',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create guest');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.firstName, 'John');
        assertEqual(data.data.lastName, 'Doe');

        saveState({ guestId: data.data.id });
      },
    },
    {
      name: 'Create booking referencing property, roomType, ratePlan, guest',
      fn: async () => {
        const st = loadState();
        const { data, status } = await api.post(
          '/api/bookings',
          {
            propertyId: st.propertyId,
            primaryGuestId: st.guestId,
            roomTypeId: st.roomType1Id,
            roomId: st.room1Id,
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            adults: 2,
            children: 0,
            roomRate: 5000,
            totalAmount: 10000,
            currency: 'INR',
            ratePlanId: st.ratePlanBarId,
            source: 'direct',
            status: 'confirmed',
            specialRequests: 'Extra pillows please',
            usePricingEngine: false,
            skipLockCheck: true,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create booking');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Booking should have ID');
        assertNotNull(data.data.confirmationCode, 'Should have confirmation code');
        assertMatch(data.data.confirmationCode, /^SS-/, 'Confirmation code should be SS-XXXXXX format');
        assertEqual(data.data.status, 'confirmed');
        assertEqual(data.data.adults, 2);

        saveState({
          bookingId: data.data.id,
          confirmationCode: data.data.confirmationCode,
        });
      },
    },
    {
      name: 'Verify booking created with confirmation code (SS-XXXXXX format)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/bookings/${st.bookingId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.id, st.bookingId);
        assertMatch(data.data.confirmationCode, /^SS-[A-Z0-9]{6}$/, 'Format check');
        assertEqual(data.data.status, 'confirmed');
        assertNotNull(data.data.primaryGuest);
        assertEqual(data.data.primaryGuest.firstName, 'John');
      },
    },
    {
      name: 'Verify folio auto-created',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/bookings/${st.bookingId}`, cookie(state));
        assert(data.success);
        assertNotNull(data.data.folios, 'Should have folios');
        assertGt(data.data.folios.length, 0, 'Should have at least 1 folio');
        const folio = data.data.folios[0];
        assertNotNull(folio.id);
        assertEqual(folio.currency, 'INR');
        assertGt(folio.totalAmount, 0, 'Folio total should be > 0');
        assertGt(folio.subtotal, 0, 'Folio subtotal should be > 0');

        saveState({ folioId: folio.id });
      },
    },
    {
      name: 'Verify folio line item (room charge) created',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/folios/${st.folioId}/line-items`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertGt(data.data.length, 0, 'Should have line items');
        const roomCharge = data.data.find((li: any) => li.category === 'room_charge');
        assertNotNull(roomCharge, 'Should have a room charge line item');
        assertGt(roomCharge.totalAmount, 0, 'Room charge should have amount');
        assertNotNull(roomCharge.description);
        assertIncludes(roomCharge.description, 'night', 'Description should mention nights');
      },
    },
    {
      name: 'Verify room status → occupied on check-in',
      fn: async () => {
        const st = loadState();
        // Check-in: assign room and update status
        const { data } = await api.put(
          `/api/bookings/${st.bookingId}`,
          {
            roomId: st.room1Id,
            status: 'checked_in',
            actualCheckIn: new Date().toISOString(),
            checkedInBy: st.userId,
          },
          cookie(state)
        );
        assert(data.success, 'Check-in should succeed');
        assertEqual(data.data.status, 'checked_in');

        // Verify room status changed to occupied
        const { data: roomData } = await api.get(`/api/rooms/${st.room1Id}`, cookie(state));
        assert(roomData.success);
        assertEqual(roomData.data.status, 'occupied', 'Room should be occupied after check-in');
      },
    },
    {
      name: 'Verify available rooms count decreased',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/rooms/available?propertyId=${st.propertyId}&checkIn=${formatDate(checkIn)}&checkOut=${formatDate(checkOut)}`,
          cookie(state)
        );
        assert(data.success);
        // Room 101 is occupied by our booking
        const occupiedRoom = data.data.find((r: any) => r.id === st.room1Id);
        assert(occupiedRoom === undefined, 'Occupied room should not be available');
      },
    },
    {
      name: 'Verify availability API shows reduced available count',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/availability?propertyId=${st.propertyId}&startDate=${formatDate(checkIn)}&endDate=${formatDate(checkOut)}`,
          cookie(state)
        );
        assert(data.success);
        // Since room 101 is occupied, available count should be reduced
        const deluxe = data.data.availabilityByRoomType.find(
          (rt: any) => rt.roomTypeId === st.roomType1Id
        );
        if (deluxe) {
          const dayEntry = deluxe.dailyAvailability.find(
            (d: any) => d.date === formatDate(checkIn)
          );
          if (dayEntry) {
            assertGt(dayEntry.booked, 0, 'Should show 1 booked room');
          }
        }
      },
    },
    {
      name: 'Test check-out flow (status → checked_out)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/bookings/${st.bookingId}`,
          {
            status: 'checked_out',
            actualCheckOut: new Date().toISOString(),
            checkedOutBy: st.userId,
          },
          cookie(state)
        );
        assert(data.success, 'Check-out should succeed');
        assertEqual(data.data.status, 'checked_out');

        saveState({});
      },
    },
    {
      name: 'Verify room status → dirty after check-out',
      fn: async () => {
        const st = loadState();
        const { data: roomData } = await api.get(`/api/rooms/${st.room1Id}`, cookie(state));
        assert(roomData.success);
        assertEqual(roomData.data.status, 'dirty', 'Room should be dirty after check-out');
      },
    },
    {
      name: 'Cross-verify: All related data consistent',
      fn: async () => {
        const st = loadState();
        // Verify booking is checked out
        const { data: booking } = await api.get(`/api/bookings/${st.bookingId}`, cookie(state));
        assert(booking.success);
        assertEqual(booking.data.status, 'checked_out');

        // Verify folio has line items
        const { data: folio } = await api.get(
          `/api/folios/${st.folioId}/line-items`,
          cookie(state)
        );
        assert(folio.success);
        assertGt(folio.data.length, 0, 'Folio should have line items');

        // Verify room is dirty
        const { data: room } = await api.get(`/api/rooms/${st.room1Id}`, cookie(state));
        assert(room.success);
        assertEqual(room.data.status, 'dirty');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
