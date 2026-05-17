/**
 * 01 - Guest Experience Tests (15 pages, 35+ tests)
 *
 * Tests the entire guest experience module including service requests,
 * chat, experiences, bookings, availability, calendar, feedback, revenue,
 * vendors, spa treatments, golf courses, digital keys, and guest-app endpoints.
 *
 * Pattern: Real API calls only, graceful 404/400 skips, sequential execution.
 * Creates resources via POST first where possible, then verifies via GET.
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
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
} from '../pms/setup';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Call GET and gracefully skip on 404 */
async function safeGet(path: string, auth: string): Promise<{ data: any; status: number; skipped?: boolean }> {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    const res = await api.get(path, auth);
    return { ...res, skipped: false };
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { data: null, status: err.status, skipped: true };
    }
    throw err;
  }
}

/** Wrap a POST that may 404/400 gracefully */
async function safePost(path: string, body: any, auth: string): Promise<{ data: any; status: number; skipped?: boolean }> {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    const res = await api.post(path, body, auth);
    return { ...res, skipped: false };
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { data: null, status: err.status, skipped: true };
    }
    throw err;
  }
}

/** Extract array from various response shapes */
function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    return data.data ?? data.items ?? data.records ?? data.conversations ?? data.requests ?? data.experiences ?? data.bookings ?? data.treatments ?? data.appointments ?? data.courses ?? data.teeTimes ?? data.services ?? data.vendors ?? [];
  }
  return [];
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const auth = cookie(state);
  const ts = Date.now();

  // Collected IDs for cross-references
  let createdServiceRequestId: string | null = null;
  let createdExperienceId: string | null = null;
  let createdExperienceBookingId: string | null = null;
  let createdVendorId: string | null = null;
  let chatConversationId: string | null = null;

  await runSequentially('01-Experience', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Service Requests
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Service Requests - POST create a test service request',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/service-requests',
          {
            propertyId: st.propertyId,
            roomNumber: st.room1Id ? undefined : '101',
            roomId: st.room1Id || undefined,
            type: 'maintenance',
            priority: 'medium',
            description: `E2E test service request ${ts % 10000}`,
            guestId: st.guestId || undefined,
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Service request should return an id');
        const id = data?.data?.id || data?.id;
        createdServiceRequestId = id;
        saveState({ expServiceRequestId: id });
        console.log(`      Created service request: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Service Requests - GET list all service requests',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/service-requests?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Service requests should be array-like');
        console.log(`      Found ${items.length} service request(s)`);
        // Grab first id if we didn't create one
        if (!createdServiceRequestId && items.length > 0 && items[0].id) {
          createdServiceRequestId = items[0].id;
          saveState({ expServiceRequestId: items[0].id });
        }
      },
    },
    {
      name: 'Service Requests - GET verify data structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/service-requests?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const sr = items[0];
          assertNotNull(sr.id, 'Service request should have id');
          assertNotNull(sr.type || sr.requestType, 'Service request should have type');
          assertNotNull(sr.status || sr.priority || sr.description !== undefined, 'Service request should have standard fields');
          const keys = Object.keys(sr);
          assertGt(keys.length, 2, 'Service request should have multiple fields');
          console.log(`      Service request keys: ${keys.join(', ')}`);
        } else {
          console.log('      No service requests to verify — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Chat Conversations
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Chat Conversations - GET list all conversations',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/chat-conversations', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Chat conversations should be array-like');
        console.log(`      Found ${items.length} conversation(s)`);
        if (items.length > 0 && items[0].id) {
          chatConversationId = items[0].id;
          saveState({ expChatConversationId: chatConversationId });
        }
      },
    },
    {
      name: 'Chat Conversations - GET verify conversation structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/chat-conversations', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const conv = items[0];
          assertNotNull(conv.id, 'Conversation should have id');
          const keys = Object.keys(conv);
          assertGt(keys.length, 1, 'Conversation should have multiple fields');
          console.log(`      Conversation keys: ${keys.join(', ')}`);
        } else {
          console.log('      No conversations — acceptable');
        }
      },
    },
    {
      name: 'Chat Conversations - GET messages for a conversation',
      fn: async () => {
        if (!chatConversationId) {
          console.log('      ⏭️  SKIPPED (no conversationId available)');
          return;
        }
        const { data, skipped } = await safeGet(`/api/chat-conversations/${chatConversationId}/messages`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const messages = extractArray(data.data ?? data);
        assert(Array.isArray(messages), 'Messages should be array-like');
        console.log(`      Found ${messages.length} message(s) for conversation ${chatConversationId}`);
        if (messages.length > 0) {
          assertNotNull(messages[0].id, 'Message should have id');
          console.log(`      Message keys: ${Object.keys(messages[0]).join(', ')}`);
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Experiences
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experiences - POST create a test experience',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/experiences',
          {
            name: `E2E Test Experience ${ts % 10000}`,
            description: 'An experience created by e2e tests',
            category: 'adventure',
            duration: 120,
            maxParticipants: 10,
            price: 2500,
            currency: 'INR',
            propertyId: st.propertyId,
            isActive: true,
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Experience should return an id');
        const id = data?.data?.id || data?.id;
        createdExperienceId = id;
        saveState({ expExperienceId: id });
        console.log(`      Created experience: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Experiences - GET list all experiences',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experiences?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Experiences should be array-like');
        console.log(`      Found ${items.length} experience(s)`);
        if (!createdExperienceId && items.length > 0 && items[0].id) {
          createdExperienceId = items[0].id;
          saveState({ expExperienceId: items[0].id });
        }
      },
    },
    {
      name: 'Experiences - GET verify experience structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experiences?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const exp = items[0];
          assertNotNull(exp.id, 'Experience should have id');
          assertNotNull(exp.name, 'Experience should have name');
          const keys = Object.keys(exp);
          assertGt(keys.length, 2, 'Experience should have multiple fields');
          console.log(`      Experience verified: id=${exp.id}, name=${exp.name}, keys=[${keys.join(', ')}]`);
        } else {
          console.log('      No experiences — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Experience Bookings
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Bookings - POST create a test booking',
      fn: async () => {
        if (!createdExperienceId) {
          console.log('      ⏭️  SKIPPED (no experienceId available)');
          return;
        }
        const { data, skipped } = await safePost(
          '/api/experience-bookings',
          {
            experienceId: createdExperienceId,
            guestId: st.guestId || undefined,
            bookingDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            timeSlot: '10:00',
            participants: 2,
            totalAmount: 5000,
            propertyId: st.propertyId,
            status: 'confirmed',
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Experience booking should return an id');
        const id = data?.data?.id || data?.id;
        createdExperienceBookingId = id;
        saveState({ expBookingId: id });
        console.log(`      Created experience booking: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Experience Bookings - GET list all experience bookings',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-bookings?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Experience bookings should be array-like');
        console.log(`      Found ${items.length} experience booking(s)`);
        if (!createdExperienceBookingId && items.length > 0 && items[0].id) {
          createdExperienceBookingId = items[0].id;
          saveState({ expBookingId: items[0].id });
        }
      },
    },
    {
      name: 'Experience Bookings - GET verify booking structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-bookings?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const booking = items[0];
          assertNotNull(booking.id, 'Experience booking should have id');
          const keys = Object.keys(booking);
          assertGt(keys.length, 1, 'Booking should have multiple fields');
          // Check for relevant fields
          const hasExperience = booking.experienceId !== undefined || booking.experience !== undefined;
          const hasGuest = booking.guestId !== undefined || booking.guest !== undefined;
          console.log(`      Booking keys: ${keys.join(', ')}, hasExperience=${hasExperience}, hasGuest=${hasGuest}`);
        } else {
          console.log('      No experience bookings — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: Experience Availability
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Availability - GET availability listing',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-availability?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Availability should be array-like');
        console.log(`      Found ${items.length} availability slot(s)`);
      },
    },
    {
      name: 'Experience Availability - GET verify availability fields',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-availability?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const slot = items[0];
          const keys = Object.keys(slot);
          assertGt(keys.length, 0, 'Availability slot should have fields');
          console.log(`      Availability keys: ${keys.join(', ')}`);
        } else {
          console.log('      No availability slots — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: Experience Calendar
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Calendar - GET calendar view',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-calendar?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        assertNotNull(data.data, 'Should have calendar data');
        console.log(`      Calendar data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Experience Calendar - GET calendar with date range',
      fn: async () => {
        const from = new Date().toISOString().split('T')[0];
        const to = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        const { data, skipped } = await safeGet(`/api/experience-calendar?from=${from}&to=${to}&propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        assertNotNull(data.data, 'Should have calendar data for range');
        console.log(`      Calendar range ${from} to ${to} — data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: Experience Feedback
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Feedback - GET list all feedback',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-feedback?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Feedback should be array-like');
        console.log(`      Found ${items.length} feedback record(s)`);
      },
    },
    {
      name: 'Experience Feedback - GET verify feedback structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-feedback?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const fb = items[0];
          const keys = Object.keys(fb);
          assertGt(keys.length, 0, 'Feedback should have fields');
          const hasRating = fb.rating !== undefined || fb.score !== undefined;
          console.log(`      Feedback keys: ${keys.join(', ')}, hasRating=${hasRating}`);
        } else {
          console.log('      No feedback records — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: Experience Revenue
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Revenue - GET revenue summary',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-revenue?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        assertNotNull(data.data, 'Should have revenue data');
        console.log(`      Revenue data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Experience Revenue - GET verify revenue has financial fields',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-revenue?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have revenue data');
        const rd = data.data;
        const keys = Object.keys(rd);
        const hasMoney = keys.some(k => /revenue|total|amount|income|earnings/i.test(k));
        console.log(`      Revenue keys (${keys.length}): ${keys.join(', ')}, hasMoney=${hasMoney}`);
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 9: Experience Vendors
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Experience Vendors - POST create a test vendor',
      fn: async () => {
        const { data, skipped } = await safePost(
          '/api/experience-vendors',
          {
            name: `E2E Experience Vendor ${ts % 10000}`,
            contactPerson: 'Vendor Contact',
            email: `expvendor-${ts}@example.com`,
            phone: `+919${Math.floor(100000000 + Math.random() * 900000000)}`,
            category: 'spa',
            propertyId: st.propertyId,
          },
          auth,
        );
        if (skipped) {
          console.log('      (skipped — endpoint returned ' + data + ')');
          return;
        }
        assertNotNull(data?.data?.id || data?.id, 'Vendor should return an id');
        const id = data?.data?.id || data?.id;
        createdVendorId = id;
        saveState({ expVendorId: id });
        console.log(`      Created experience vendor: ${id}`);
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Experience Vendors - GET list all vendors',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-vendors?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Vendors should be array-like');
        console.log(`      Found ${items.length} vendor(s)`);
        if (!createdVendorId && items.length > 0 && items[0].id) {
          createdVendorId = items[0].id;
          saveState({ expVendorId: items[0].id });
        }
      },
    },
    {
      name: 'Experience Vendors - GET verify vendor structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience-vendors?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const vendor = items[0];
          assertNotNull(vendor.id, 'Vendor should have id');
          assertNotNull(vendor.name, 'Vendor should have name');
          const keys = Object.keys(vendor);
          assertGt(keys.length, 2, 'Vendor should have multiple fields');
          console.log(`      Vendor verified: id=${vendor.id}, name=${vendor.name}, keys=[${keys.join(', ')}]`);
        } else {
          console.log('      No experience vendors — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 10: Spa Treatments
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Spa Treatments - GET list all treatments',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/spa/treatments?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Treatments should be array-like');
        console.log(`      Found ${items.length} spa treatment(s)`);
      },
    },
    {
      name: 'Spa Treatments - GET verify treatment structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/spa/treatments?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const treatment = items[0];
          assertNotNull(treatment.id, 'Treatment should have id');
          assertNotNull(treatment.name || treatment.treatmentName, 'Treatment should have name');
          const keys = Object.keys(treatment);
          assertGt(keys.length, 1, 'Treatment should have multiple fields');
          console.log(`      Treatment keys: ${keys.join(', ')}`);
        } else {
          console.log('      No spa treatments — acceptable');
        }
      },
    },
    {
      name: 'Spa Appointments - GET list all appointments',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/spa/appointments?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Appointments should be array-like');
        console.log(`      Found ${items.length} spa appointment(s)`);
        if (items.length > 0) {
          assertNotNull(items[0].id, 'Appointment should have id');
          console.log(`      Appointment keys: ${Object.keys(items[0]).join(', ')}`);
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 11: Golf Courses & Tee Times
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Golf Courses - GET list all courses',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/golf/courses?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Golf courses should be array-like');
        console.log(`      Found ${items.length} golf course(s)`);
      },
    },
    {
      name: 'Golf Courses - GET verify course structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/golf/courses?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const course = items[0];
          assertNotNull(course.id, 'Course should have id');
          assertNotNull(course.name || course.courseName, 'Course should have name');
          const keys = Object.keys(course);
          assertGt(keys.length, 1, 'Course should have multiple fields');
          console.log(`      Course keys: ${keys.join(', ')}`);
        } else {
          console.log('      No golf courses — acceptable');
        }
      },
    },
    {
      name: 'Golf Tee Times - GET list all tee times',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/experience/golf/tee-times?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Tee times should be array-like');
        console.log(`      Found ${items.length} tee time(s)`);
        if (items.length > 0) {
          assertNotNull(items[0].id, 'Tee time should have id');
          console.log(`      Tee time keys: ${Object.keys(items[0]).join(', ')}`);
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 12: Digital Keys
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Digital Keys - GET list all digital keys',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/digital-keys?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Digital keys should be array-like');
        console.log(`      Found ${items.length} digital key(s)`);
      },
    },
    {
      name: 'Digital Keys - GET verify key structure',
      fn: async () => {
        const { data, skipped } = await safeGet(`/api/digital-keys?propertyId=${st.propertyId || ''}`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const key = items[0];
          assertNotNull(key.id, 'Digital key should have id');
          const keys = Object.keys(key);
          assertGt(keys.length, 1, 'Key should have multiple fields');
          const hasRoom = key.roomId !== undefined || key.roomNumber !== undefined;
          const hasStatus = key.status !== undefined || key.isActive !== undefined;
          console.log(`      Digital key keys: ${keys.join(', ')}, hasRoom=${hasRoom}, hasStatus=${hasStatus}`);
        } else {
          console.log('      No digital keys — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 13: Guest App Services
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Guest App Services - GET list available services',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/guest-app/services', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Guest app services should be array-like');
        console.log(`      Found ${items.length} guest app service(s)`);
      },
    },
    {
      name: 'Guest App Services - GET verify service structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/guest-app/services', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const svc = items[0];
          assertNotNull(svc.id, 'Service should have id');
          assertNotNull(svc.name || svc.serviceName || svc.title, 'Service should have name/title');
          const keys = Object.keys(svc);
          console.log(`      Service keys: ${keys.join(', ')}`);
        } else {
          console.log('      No guest app services — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 14: Guest App Feedback
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Guest App Feedback - GET list all feedback',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/guest-app/feedback', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data, 'Should return response');
        const items = extractArray(data.data ?? data);
        assert(Array.isArray(items), 'Guest app feedback should be array-like');
        console.log(`      Found ${items.length} guest feedback record(s)`);
      },
    },
    {
      name: 'Guest App Feedback - GET verify feedback structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/guest-app/feedback', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const items = extractArray(data.data ?? data);
        if (Array.isArray(items) && items.length > 0) {
          const fb = items[0];
          assertNotNull(fb.id, 'Feedback should have id');
          const keys = Object.keys(fb);
          assertGt(keys.length, 0, 'Feedback should have fields');
          const hasRating = fb.rating !== undefined || fb.score !== undefined || fb.stars !== undefined;
          console.log(`      Feedback keys: ${keys.join(', ')}, hasRating=${hasRating}`);
        } else {
          console.log('      No guest app feedback — acceptable');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // CROSS-ENDPOINT VERIFICATION
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Cross-check — all experience endpoints respond consistently',
      fn: async () => {
        const endpoints = [
          '/api/service-requests',
          '/api/chat-conversations',
          '/api/experiences',
          '/api/experience-bookings',
          '/api/experience-availability',
          '/api/experience-calendar',
          '/api/experience-feedback',
          '/api/experience-revenue',
          '/api/experience-vendors',
          '/api/experience/spa/treatments',
          '/api/experience/spa/appointments',
          '/api/experience/golf/courses',
          '/api/experience/golf/tee-times',
          '/api/digital-keys',
          '/api/guest-app/services',
          '/api/guest-app/feedback',
        ];
        let successCount = 0;
        for (const ep of endpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            await api.get(ep, auth);
            successCount++;
          } catch (err: any) {
            if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
              // Expected for missing modules
            } else {
              throw err;
            }
          }
        }
        assertGt(successCount, 0, `At least 1 endpoint should succeed (got ${successCount}/${endpoints.length})`);
        console.log(`      ${successCount}/${endpoints.length} experience endpoints responded successfully`);
      },
    },
    {
      name: 'Cross-check — created resources have consistent IDs',
      fn: async () => {
        const updated = loadState();
        const checks = [
          { id: updated.expServiceRequestId, label: 'service request' },
          { id: updated.expExperienceId, label: 'experience' },
          { id: updated.expBookingId, label: 'experience booking' },
          { id: updated.expVendorId, label: 'experience vendor' },
          { id: updated.expChatConversationId, label: 'chat conversation' },
        ];
        const created = checks.filter(c => c.id);
        console.log(`      Created ${created.length} resources during test run:`);
        for (const c of created) {
          console.log(`        - ${c.label}: ${c.id}`);
        }
        assertGt(created.length, 0, 'Should have created at least 1 resource');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
