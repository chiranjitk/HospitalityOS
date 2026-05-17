/**
 * 06 - Registration Card Tests
 *
 * Tests the Registration Card feature for Front Desk:
 *   - GET registration card for existing booking (may not exist yet)
 *   - POST to generate registration card PDF (binary response)
 *   - GET registration card after generation
 *   - Cross-verify booking accessibility
 *   - Test different purpose values: leisure, business
 *   - Test registration card with companions array
 *   - Verify PDF generation for walk-in booking (if available)
 *   - Test registration card with empty companions
 *   - Cross-verify guest details match booking
 *   - Verify booking has all required fields for reg card
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
  BASE_URL,
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

  await runSequentially('06-Registration-Card', [
    // 1. GET registration card for existing booking (may not exist yet)
    {
      name: 'GET registration card for existing booking (may not exist)',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        try {
          const { data, status } = await api.get(
            `/api/folio/registration-card?bookingId=${st.bookingId}`,
            cookie(state)
          );
          assert(data.success !== undefined, 'Should return a response');
          // Card may or may not exist — just verify the endpoint works
          console.log(`      Response: ${JSON.stringify(data).slice(0, 200)}`);
        } catch (err: any) {
          // May return 404 if no card exists yet — that's acceptable
          console.log(`      (no existing card — expected: ${err.message})`);
        }
      },
    },

    // 2. POST to generate registration card PDF (binary response)
    {
      name: 'POST generate registration card PDF with companions',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const res = await fetch(`${BASE_URL}/api/folio/registration-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: st.sessionCookie,
          },
          body: JSON.stringify({
            bookingId: st.bookingId,
            purpose: 'leisure',
            companions: [
              { name: 'Jane Doe', nationality: 'US', idNumber: 'P12345' },
            ],
            vehiclePlate: 'ABC-1234',
          }),
        });
        assert(res.ok, 'Registration card PDF should be generated');
        assert(
          res.headers.get('content-type')?.includes('pdf'),
          'Response should be PDF'
        );
        const pdfBuffer = await res.arrayBuffer();
        assertGt(pdfBuffer.byteLength, 1000, 'PDF should have content');
        console.log(`      PDF size: ${pdfBuffer.byteLength} bytes`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // 3. GET registration card after generation — now should exist
    {
      name: 'GET registration card after generation',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const { data } = await api.get(
          `/api/folio/registration-card?bookingId=${st.bookingId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should return card data');
      },
    },

    // 4. Cross-verify: booking still exists and accessible
    {
      name: 'Cross-verify: booking still exists and accessible',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const { data } = await api.get(
          `/api/bookings/${st.bookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should be accessible');
        assertNotNull(data.data, 'Should return booking data');
        assertEqual(data.data.id, st.bookingId, 'Booking ID should match');
      },
    },

    // 5. Test with different purpose value: "business"
    {
      name: 'POST generate registration card with business purpose',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const res = await fetch(`${BASE_URL}/api/folio/registration-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: st.sessionCookie,
          },
          body: JSON.stringify({
            bookingId: st.bookingId,
            purpose: 'business',
            vehiclePlate: 'XYZ-5678',
          }),
        });
        assert(res.ok, 'Business registration card PDF should be generated');
        assert(
          res.headers.get('content-type')?.includes('pdf'),
          'Response should be PDF'
        );
        const pdfBuffer = await res.arrayBuffer();
        assertGt(pdfBuffer.byteLength, 1000, 'PDF should have content');
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // 6. Test registration card with companions array
    {
      name: 'POST generate registration card with multiple companions',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const res = await fetch(`${BASE_URL}/api/folio/registration-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: st.sessionCookie,
          },
          body: JSON.stringify({
            bookingId: st.bookingId,
            purpose: 'leisure',
            companions: [
              { name: 'John Smith', nationality: 'UK', idNumber: 'PP987654' },
              { name: 'Maria Garcia', nationality: 'ES', idNumber: 'ES112233' },
              { name: 'Li Wei', nationality: 'CN', idNumber: 'CN445566' },
            ],
            vehiclePlate: 'MULTI-001',
          }),
        });
        assert(res.ok, 'Registration card with companions should be generated');
        assert(
          res.headers.get('content-type')?.includes('pdf'),
          'Response should be PDF'
        );
        const pdfBuffer = await res.arrayBuffer();
        assertGt(pdfBuffer.byteLength, 1000, 'PDF should have content');
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // 7. Verify PDF generation for walk-in booking (if walkinBookingId exists)
    {
      name: 'POST generate registration card for walk-in booking (if exists)',
      fn: async () => {
        const updated = loadState();
        if (!updated.walkinBookingId) {
          console.log('      (skipped — no walk-in booking ID in state)');
          return;
        }
        await delay(DELAY_BETWEEN_CALLS);
        const res = await fetch(`${BASE_URL}/api/folio/registration-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: st.sessionCookie,
          },
          body: JSON.stringify({
            bookingId: updated.walkinBookingId,
            purpose: 'leisure',
            vehiclePlate: 'WALKIN-001',
          }),
        });
        assert(res.ok, 'Walk-in registration card PDF should be generated');
        assert(
          res.headers.get('content-type')?.includes('pdf'),
          'Response should be PDF'
        );
        const pdfBuffer = await res.arrayBuffer();
        assertGt(pdfBuffer.byteLength, 1000, 'PDF should have content');
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // 8. Test registration card with empty companions
    {
      name: 'POST generate registration card with empty companions',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const res = await fetch(`${BASE_URL}/api/folio/registration-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: st.sessionCookie,
          },
          body: JSON.stringify({
            bookingId: st.bookingId,
            purpose: 'business',
            companions: [],
            vehiclePlate: 'SOLO-001',
          }),
        });
        assert(res.ok, 'Registration card with empty companions should be generated');
        assert(
          res.headers.get('content-type')?.includes('pdf'),
          'Response should be PDF'
        );
        const pdfBuffer = await res.arrayBuffer();
        assertGt(pdfBuffer.byteLength, 1000, 'PDF should have content');
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // 9. Cross-verify: guest details match what was used in booking
    {
      name: 'Cross-verify: guest details match booking',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        assertNotNull(st.guestId, 'Need guest ID');
        const { data: bookingData } = await api.get(
          `/api/bookings/${st.bookingId}`,
          cookie(state)
        );
        assert(bookingData.success, 'Booking should load');
        assertEqual(
          bookingData.data.guestId,
          st.guestId,
          'Booking guest should match state guest'
        );
        assertNotNull(bookingData.data.guestName, 'Booking should have guest name');
        assertNotNull(bookingData.data.roomNumber, 'Booking should have room number');
        assertNotNull(bookingData.data.checkIn, 'Booking should have checkIn date');
        assertNotNull(bookingData.data.checkOut, 'Booking should have checkOut date');

        await delay(DELAY_BETWEEN_CALLS);
        const { data: guestData } = await api.get(
          `/api/guests/${st.guestId}`,
          cookie(state)
        );
        if (guestData.success) {
          assertNotNull(guestData.data, 'Guest should load');
          assertNotNull(guestData.data.name || guestData.data.firstName, 'Guest should have name');
        }
      },
    },

    // 10. Verify booking has all required fields for reg card
    {
      name: 'Verify booking has all required fields for reg card',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(st.bookingId, 'Need booking ID');
        const { data } = await api.get(
          `/api/bookings/${st.bookingId}`,
          cookie(state)
        );
        assert(data.success, 'Booking should load');
        const booking = data.data;

        // Required fields for registration card
        assertNotNull(booking.guestName, 'Booking should have guestName');
        assertNotNull(booking.roomNumber, 'Booking should have roomNumber');
        assertNotNull(booking.checkIn, 'Booking should have checkIn');
        assertNotNull(booking.checkOut, 'Booking should have checkOut');
        assertNotNull(booking.id, 'Booking should have id');
        assertNotNull(booking.confirmationCode, 'Booking should have confirmationCode');

        // Verify roomNumber is a string (or parseable)
        assert(typeof booking.roomNumber === 'string' || typeof booking.roomNumber === 'number',
          'Room number should be a string or number');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
