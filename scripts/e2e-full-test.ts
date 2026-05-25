/**
 * StaySuite HospitalityOS — Full E2E Test Suite
 *
 * 100 guest WiFi check-ins + full lifecycle test
 * NO direct DB inserts — ONLY real API calls
 *
 * Run: bun run scripts/e2e-full-test.ts
 */

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'platform@staysuite.com';
const ADMIN_PASS = 'admin123';
const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const PROPERTY_ID = '281fde73-7836-4511-b644-91f3663d8fcd';
const IP_POOL_ID = 'ab4ff167-dc45-45d1-b9fb-cea83e090f96';

const PLAN_IDS = {
  free: 'c80731b1-952f-45c0-b6e5-9cb77deb2590',
  basic: 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15',
  standard: '40486b74-cf4c-4f9e-82c8-d7621f36116c',
  premium: '418b8a64-88c1-4529-a68f-e153bb92f224',
  vip: 'ee35e1ab-ebdd-4e9e-ac2b-8f786d501976',
  conference: '92fcd891-9963-4bd5-891b-28d202512db8',
};

// Track results
const results = {
  guests: { ok: 0, fail: 0, errors: [] as string[] },
  bookings: { ok: 0, fail: 0, errors: [] as string[] },
  vouchers: { ok: 0, fail: 0, errors: [] as string[] },
  wifiAuth: { ok: 0, fail: 0, errors: [] as string[] },
  folios: { ok: 0, fail: 0, errors: [] as string[] },
  services: { ok: 0, fail: 0, errors: [] as string[] },
  verification: { ok: 0, fail: 0, errors: [] as string[] },
};

let cookie = '';
const createdGuests: string[] = [];
const createdBookings: string[] = [];
const createdVouchers: { code: string; planId: string }[] = [];
const createdSessions: string[] = [];
const createdFolios: string[] = [];

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...extraHeaders,
  };

  let res: Response | null = null;
  let retries = 3;
  while (retries > 0) {
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      break;
    } catch (err: any) {
      retries--;
      if (retries === 0) {
        // Return a synthetic error response instead of throwing
        return { status: 0, data: { success: false, error: { code: 'CONNECTION_ERROR', message: err?.message || 'Connection failed' } } };
      }
      await delay(2000);
    }
  }
  if (!res) {
    return { status: 0, data: { success: false, error: { code: 'NO_RESPONSE', message: 'No response received' } } };
  }

  // Capture cookie from login
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/session_token=[^;]+/);
    if (match) cookie = match[0];
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text().catch(() => '') };
  }

  return { status: res.status, data };
}

function ipForGuest(index: number): string {
  // 10.10.10.50 through 10.10.10.200 (151 IPs in pool)
  return `10.10.10.${50 + (index % 151)}`;
}

function macForGuest(index: number): string {
  const hex = (index + 1).toString(16).padStart(2, '0').toUpperCase();
  return `AA:BB:CC:DD:EE:${hex}`;
}

function randomName(): string {
  const firsts = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Priya', 'Riya', 'Kavya', 'Nisha', 'Pooja'];
  const lasts = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Reddy', 'Nair', 'Mehta', 'Shah', 'Desai', 'Rao', 'Iyer', 'Chopra'];
  return { first: firsts[Math.floor(Math.random() * firsts.length)], last: lasts[Math.floor(Math.random() * lasts.length)] };
}

function log(category: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${category}] ${msg}`);
}

function recordResult(bucket: keyof typeof results, success: boolean, error?: string) {
  if (success) {
    results[bucket].ok++;
  } else {
    results[bucket].fail++;
    if (error) results[bucket].errors.push(error);
  }
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ════════════════════════════════════════════════════════════════
// Phase 0: Login
// ════════════════════════════════════════════════════════════════

async function login() {
  log('AUTH', 'Logging in as platform admin...');
  const { status, data } = await api('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (status !== 200 || !data.success) {
    throw new Error(`Login failed: ${status} ${JSON.stringify(data)}`);
  }
  log('AUTH', `✓ Logged in as ${data.user?.name || 'admin'}`);
}

// ════════════════════════════════════════════════════════════════
// Phase 1: Create 100 Guests + Bookings
// ════════════════════════════════════════════════════════════════

async function createGuests() {
  log('GUESTS', 'Creating 100 guests...');
  const ts = Date.now();
  for (let i = 0; i < 100; i++) {
    const { first, last } = randomName();
    const email = `guest.${ts}.${i + 1}@e2etest.staysuite.io`;
    const phone = `+91${9000000000 + i}`;

    const { status, data } = await api('POST', '/api/guests', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      firstName: first,
      lastName: last,
      email,
      phone,
      nationality: 'IN',
      guestType: i < 10 ? 'vip' : i < 30 ? 'corporate' : 'transient',
      source: i < 50 ? 'direct' : 'ota',
    });

    if (status === 200 || status === 201) {
      const guestId = data?.data?.id || data?.id;
      if (guestId) createdGuests.push(guestId);
      recordResult('guests', true);
    } else {
      recordResult('guests', false, `Guest ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }

    if ((i + 1) % 10 === 0) log('GUESTS', `  ${i + 1}/100 created`);
    if (i % 5 === 0) await delay(50); // Throttle slightly
  }
  log('GUESTS', `✓ ${results.guests.ok} guests created, ${results.guests.fail} failed`);
}

async function createBookings() {
  log('BOOKINGS', 'Creating bookings for guests...');

  // First get available rooms
  const { data: roomsData } = await api('GET', '/api/v1/rooms?propertyId=' + PROPERTY_ID);
  const rooms = roomsData?.data || roomsData?.rooms || [];
  if (rooms.length === 0) {
    log('BOOKINGS', '⚠ No rooms found, trying to fetch from main API...');
    const { data: r2 } = await api('GET', '/api/rooms?propertyId=' + PROPERTY_ID);
    const roomList = r2?.data || r2?.rooms || [];
    if (roomList.length === 0) {
      log('BOOKINGS', '⚠ No rooms available, skipping bookings');
      return;
    }
  }

  // Get room types
  const { data: rtData } = await api('GET', '/api/v1/room-types?propertyId=' + PROPERTY_ID);
  const roomTypes = rtData?.data || [];
  const roomTypeIds = roomTypes.map((rt: any) => rt.id).filter(Boolean);

  const guestsPerBatch = Math.min(createdGuests.length, 100);
  for (let i = 0; i < guestsPerBatch; i++) {
    const guestId = createdGuests[i];
    // Use varying future dates to avoid SOLD_OUT errors
    const dayOffset = 1 + (i % 14); // Spread across 14 days
    const checkIn = new Date(Date.now() + dayOffset * 86400000);
    checkIn.setHours(14, 0, 0, 0);
    const checkOut = new Date(checkIn.getTime() + (2 + (i % 4)) * 86400000);

    const { status, data } = await api('POST', '/api/bookings', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      primaryGuestId: guestId,
      roomTypeId: roomTypeIds[i % roomTypeIds.length] || undefined,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      adults: 1,  // Always 1 adult to avoid occupancy limits
      source: ['direct', 'ota', 'walk_in', 'corporate'][i % 4],
      status: 'confirmed',
    });

    if (status === 200 || status === 201) {
      const bookingId = data?.data?.id || data?.id;
      if (bookingId) createdBookings.push(bookingId);
      recordResult('bookings', true);
    } else {
      recordResult('bookings', false, `Booking ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }

    if ((i + 1) % 10 === 0) log('BOOKINGS', `  ${i + 1}/${guestsPerBatch} created`);
    if (i % 5 === 0) await delay(50);
  }
  log('BOOKINGS', `✓ ${results.bookings.ok} bookings created, ${results.bookings.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Phase 2: Create Vouchers
// ════════════════════════════════════════════════════════════════

async function createVouchers() {
  log('VOUCHERS', 'Creating WiFi vouchers for different plans...');

  const planList = Object.entries(PLAN_IDS);

  for (const [planName, planId] of planList) {
    // The API generates codes automatically — use quantity param
    const { status, data } = await api('POST', '/api/wifi/vouchers', {
      planId,
      quantity: 5,
      guestId: createdGuests[createdVouchers.length % Math.max(createdGuests.length, 1)] || undefined,
      bookingId: createdBookings[createdVouchers.length % Math.max(createdBookings.length, 1)] || undefined,
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    if (status === 200 || status === 201) {
      const vouchers = data?.data || data?.vouchers || [];
      if (Array.isArray(vouchers)) {
        for (const v of vouchers) {
          const code = v.code;
          if (code) createdVouchers.push({ code, planId });
        }
      }
      recordResult('vouchers', true);
      log('VOUCHERS', `  Created ${vouchers.length || '?'} ${planName} vouchers`);
    } else {
      recordResult('vouchers', false, `Voucher batch ${planName}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  }
  log('VOUCHERS', `✓ ${createdVouchers.length} vouchers created, ${results.vouchers.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Phase 3: WiFi Authentication (100 guests)
// ════════════════════════════════════════════════════════════════

async function testWifiAuth() {
  log('WIFI', 'Starting WiFi authentication for 100 guests...');

  // Get portal slug
  const { data: portalData } = await api('GET', '/api/wifi/portal/instances');
  const portals = portalData?.data || [];
  const portal = portals.find((p: any) => p.isDefault || p.slug) || portals[0];
  const portalSlug = portal?.slug || 'default-zone';
  log('WIFI', `Using portal: ${portalSlug}`);

  let guestIdx = 0;

  // A) Voucher Login (30 guests)
  log('WIFI', '── A) Voucher Login (30 guests) ──');
  for (let i = 0; i < 30 && i < createdVouchers.length; i++) {
    const voucher = createdVouchers[i];
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    const guest = createdGuests[guestIdx];
    guestIdx++;

    const { status, data } = await api('POST', '/api/v1/wifi/auth', {
      method: 'voucher',
      portalSlug,
      voucherCode: voucher.code,
      macAddress: mac,
      fingerprintHash: `e2e-fp-${guestIdx}`,
      guestInfo: JSON.stringify({ firstName: `Guest${guestIdx}`, lastName: 'Test' }),
    }, { 'x-forwarded-for': ip });

    if (status === 200 && (data?.authenticated || data?.data?.authenticated)) {
      recordResult('wifiAuth', true);
      const sid = data?.sessionId || data?.data?.sessionId;
      if (sid) createdSessions.push(sid);
    } else {
      const errMsg = data?.error?.message || data?.data?.error?.message || JSON.stringify(data).slice(0, 200);
      recordResult('wifiAuth', false, `Voucher ${voucher.code} (IP:${ip}): ${errMsg}`);
    }

    if ((i + 1) % 10 === 0) log('WIFI', `  ${i + 1}/30 voucher logins done`);
    await delay(100);
  }

  // B) Room Number Login (25 guests)
  log('WIFI', '── B) Room Number Login (25 guests) ──');
  for (let i = 0; i < 25 && guestIdx < 100; i++) {
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    const guest = createdGuests[guestIdx];
    guestIdx++;

    // Try room number + last name auth
    const { status, data } = await api('POST', '/api/v1/wifi/auth', {
      method: 'room_number',
      portalSlug,
      roomNumber: String(101 + i),
      lastName: 'Test',
      macAddress: mac,
      fingerprintHash: `e2e-fp-${guestIdx}`,
    }, { 'x-forwarded-for': ip });

    if (status === 200 && (data?.authenticated || data?.data?.authenticated)) {
      recordResult('wifiAuth', true);
      const sid = data?.sessionId || data?.data?.sessionId;
      if (sid) createdSessions.push(sid);
    } else {
      // Room login requires a matching booking — may fail if booking not linked to room
      const errMsg = data?.error?.message || data?.data?.error?.message || data?.error?.code || JSON.stringify(data).slice(0, 200);
      recordResult('wifiAuth', false, `Room ${101 + i} (IP:${ip}): ${errMsg}`);
    }

    if ((i + 1) % 10 === 0) log('WIFI', `  ${i + 1}/25 room logins done`);
    await delay(100);
  }

  // C) PMS Credentials Login (15 guests)
  log('WIFI', '── C) PMS Credentials Login (15 guests) ──');
  for (let i = 0; i < 15 && guestIdx < 100; i++) {
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    guestIdx++;

    // PMS credentials requires radcheck entries — may need setup
    const { status, data } = await api('POST', '/api/v1/wifi/auth', {
      method: 'pms_credentials',
      portalSlug,
      username: `room${101 + i}`,
      password: `guest${i}`,
      macAddress: mac,
      fingerprintHash: `e2e-fp-${guestIdx}`,
    }, { 'x-forwarded-for': ip });

    if (status === 200 && (data?.authenticated || data?.data?.authenticated)) {
      recordResult('wifiAuth', true);
      const sid = data?.sessionId || data?.data?.sessionId;
      if (sid) createdSessions.push(sid);
    } else {
      const errMsg = data?.error?.message || data?.data?.error?.message || data?.error?.code || JSON.stringify(data).slice(0, 200);
      recordResult('wifiAuth', false, `PMS room${101 + i} (IP:${ip}): ${errMsg}`);
    }

    if ((i + 1) % 10 === 0) log('WIFI', `  ${i + 1}/15 PMS logins done`);
    await delay(100);
  }

  // D) SMS OTP Login (10 guests)
  log('WIFI', '── D) SMS OTP Login (10 guests) ──');
  for (let i = 0; i < 10 && guestIdx < 100; i++) {
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    guestIdx++;
    const phone = `+91999990${String(100 + i).padStart(4, '0')}`;

    // Step 1: Send OTP and capture debug code
    const { status: sendStatus, data: sendData } = await api('POST', '/api/v1/wifi/auth', {
      method: 'sms_otp',
      portalSlug,
      phoneNumber: phone,
      macAddress: mac,
      fingerprintHash: `e2e-fp-${guestIdx}`,
    }, { 'x-forwarded-for': ip });

    const debugOtp = sendData?.data?._debugOtp || sendData?.data?.debugOtp || sendData?._debugOtp;
    if ((sendStatus === 200 || sendStatus === 201) && debugOtp) {
      // Step 2: Verify OTP
      await delay(500);
      const { status: verifyStatus, data: verifyData } = await api('POST', '/api/v1/wifi/auth', {
        method: 'sms_otp',
        portalSlug,
        phoneNumber: phone,
        otpCode: debugOtp,
        macAddress: mac,
        fingerprintHash: `e2e-fp-${guestIdx}`,
      }, { 'x-forwarded-for': ip });

      if (verifyStatus === 200 && verifyData?.data?.authenticated) {
        recordResult('wifiAuth', true);
        if (verifyData?.data?.sessionId) createdSessions.push(verifyData.data.sessionId);
      } else {
        const errMsg = verifyData?.error?.message || verifyData?.data?.error?.message || JSON.stringify(verifyData).slice(0, 200);
        recordResult('wifiAuth', false, `SMS OTP verify ${phone}: ${errMsg}`);
      }
    } else {
      const errMsg = sendData?.error?.message || sendData?.data?.error?.message || JSON.stringify(sendData).slice(0, 200);
      recordResult('wifiAuth', false, `SMS OTP send ${phone}: ${errMsg}`);
    }

    if ((i + 1) % 5 === 0) log('WIFI', `  ${i + 1}/10 SMS OTP logins done`);
    await delay(200);
  }

  // E) Open Access Login (10 guests)
  log('WIFI', '── E) Open Access Login (10 guests) ──');
  for (let i = 0; i < 10 && guestIdx < 100; i++) {
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    guestIdx++;

    const { status, data } = await api('POST', '/api/v1/wifi/auth', {
      method: 'open_access',
      portalSlug,
      macAddress: mac,
      fingerprintHash: `e2e-fp-${guestIdx}`,
      guestInfo: JSON.stringify({ firstName: `Open${i}`, lastName: 'Access' }),
    }, { 'x-forwarded-for': ip });

    if (status === 200 && (data?.authenticated || data?.data?.authenticated)) {
      recordResult('wifiAuth', true);
      const sid = data?.sessionId || data?.data?.sessionId;
      if (sid) createdSessions.push(sid);
    } else {
      const errMsg = data?.error?.message || data?.data?.error?.message || data?.error?.code || JSON.stringify(data).slice(0, 200);
      recordResult('wifiAuth', false, `Open Access ${i} (IP:${ip}): ${errMsg}`);
    }

    await delay(100);
  }

  // F) MAC Auth Login (10 guests)
  log('WIFI', '── F) MAC Auth Login (10 guests) ──');
  for (let i = 0; i < 10 && guestIdx < 100; i++) {
    const ip = ipForGuest(guestIdx);
    const mac = macForGuest(guestIdx);
    guestIdx++;

    const { status, data } = await api('POST', '/api/wifi/mac-auth', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      macAddress: mac,
      clientIp: ip,
      nasIdentifier: 'e2e-test-nas',
    }, { 'x-forwarded-for': ip });

    if (status === 200 && data?.authenticated) {
      recordResult('wifiAuth', true);
    } else {
      const errMsg = data?.error?.message || data?.error?.code || JSON.stringify(data).slice(0, 200);
      recordResult('wifiAuth', false, `MAC Auth ${mac} (IP:${ip}): ${errMsg}`);
    }

    await delay(100);
  }

  log('WIFI', `✓ ${results.wifiAuth.ok} WiFi auths succeeded, ${results.wifiAuth.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Phase 4: Full Guest Lifecycle (Services)
// ════════════════════════════════════════════════════════════════

async function testGuestServices() {
  log('SERVICES', 'Testing guest service modules...');

  const testGuests = createdGuests.slice(0, 30); // Test with first 30 guests

  // 1. Restaurant/POS Orders
  log('SERVICES', '── Restaurant/POS Orders ──');
  // Get menu items for the property
  const { data: menuData } = await api('GET', '/api/menu-items?propertyId=' + PROPERTY_ID + '&limit=20');
  const menuItems = menuData?.data || [];
  if (menuItems.length === 0) {
    log('SERVICES', '⚠ No menu items found, skipping restaurant orders');
  } else {
    for (let i = 0; i < 15 && i < testGuests.length; i++) {
      const item1 = menuItems[i % menuItems.length];
      const item2 = menuItems[(i + 1) % menuItems.length];
      const { status, data } = await api('POST', '/api/orders', {
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        orderType: i < 8 ? 'dine_in' : 'room_service',
        items: [
          { menuItemId: item1.id, quantity: 1 },
          { menuItemId: item2.id, quantity: 1 },
        ],
        notes: `E2E test order #${i + 1}`,
      });

      recordResult('services', status === 200 || status === 201,
        `Restaurant order ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);

      if (i % 5 === 0) await delay(100);
    }
  }

  // 2. Spa Appointments
  log('SERVICES', '── Spa Appointments ──');
  // First check if spa treatments exist
  const { data: spaData } = await api('GET', '/api/experience/spa/treatments?propertyId=' + PROPERTY_ID);
  const spaTreatments = spaData?.data || [];
  if (spaTreatments.length > 0) {
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const treatment = spaTreatments[i % spaTreatments.length];
      const { status, data } = await api('POST', '/api/experience/spa/appointments', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        treatmentId: treatment.id,
        appointmentDate: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
        duration: 60,
        status: 'confirmed',
        notes: `E2E spa booking #${i + 1}`,
      });

      recordResult('services', status === 200 || status === 201,
        `Spa appointment ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);

      if (i % 5 === 0) await delay(50);
    }
  } else {
    log('SERVICES', '⚠ No spa treatments found, creating test treatment...');
    const { status, data } = await api('POST', '/api/experience/spa/treatments', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'Swedish Massage',
      description: 'Relaxing full body massage',
      duration: 60,
      price: 2500,
      category: 'massage',
      isActive: true,
    });
    if (status === 200 || status === 201) {
      log('SERVICES', '  Created Swedish Massage treatment');
      // Now create appointments
      const treatmentId = data?.data?.id || data?.id;
      for (let i = 0; i < 10 && i < testGuests.length; i++) {
        const { status, data } = await api('POST', '/api/experience/spa/appointments', {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          guestId: testGuests[i],
          treatmentId,
          appointmentDate: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
          duration: 60,
          status: 'confirmed',
          notes: `E2E spa booking #${i + 1}`,
        });
        recordResult('services', status === 200 || status === 201,
          `Spa appointment ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
      }
    }
  }

  // 3. Golf Tee Times
  log('SERVICES', '── Golf Tee Times ──');
  const { data: golfData } = await api('GET', '/api/experience/golf/courses?propertyId=' + PROPERTY_ID);
  const golfCourses = golfData?.data || [];
  if (golfCourses.length > 0) {
    for (let i = 0; i < 8 && i < testGuests.length; i++) {
      const course = golfCourses[i % golfCourses.length];
      const { status, data } = await api('POST', '/api/experience/golf/tee-times', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        courseId: course.id,
        teeTime: new Date(Date.now() + (i + 1) * 7200000).toISOString(),
        players: 1 + Math.floor(Math.random() * 4),
        status: 'confirmed',
      });

      recordResult('services', status === 200 || status === 201,
        `Golf tee time ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  } else {
    log('SERVICES', '⚠ No golf courses found, creating test course...');
    const { status, data } = await api('POST', '/api/experience/golf/courses', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'Royal Links Golf Course',
      holes: 18,
      par: 72,
      description: 'Championship 18-hole course',
      greenFee: 5000,
      isActive: true,
    });
    if (status === 200 || status === 201) {
      const courseId = data?.data?.id || data?.id;
      for (let i = 0; i < 8 && i < testGuests.length; i++) {
        const { status, data } = await api('POST', '/api/experience/golf/tee-times', {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          guestId: testGuests[i],
          courseId,
          teeTime: new Date(Date.now() + (i + 1) * 7200000).toISOString(),
          players: 1 + Math.floor(Math.random() * 4),
          status: 'confirmed',
        });
        recordResult('services', status === 200 || status === 201,
          `Golf tee time ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
      }
    }
  }

  // 4. Laundry Orders
  log('SERVICES', '── Laundry Orders ──');
  const { data: laundryData } = await api('GET', '/api/laundry/items?propertyId=' + PROPERTY_ID);
  const laundryItems = laundryData?.data || [];
  if (laundryItems.length > 0) {
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const { status, data } = await api('POST', '/api/laundry/orders', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        items: [{ itemId: laundryItems[i % laundryItems.length].id, quantity: 2 + Math.floor(Math.random() * 3) }],
        status: 'pending',
        notes: `E2E laundry order #${i + 1}`,
      });

      recordResult('services', status === 200 || status === 201,
        `Laundry order ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  } else {
    log('SERVICES', '⚠ No laundry items, creating test items...');
    // Create laundry items first
    for (const item of [
      { name: 'Shirt', price: 150, category: 'wash' },
      { name: 'Trousers', price: 200, category: 'wash' },
      { name: 'Suit', price: 800, category: 'dry_clean' },
    ]) {
      await api('POST', '/api/laundry/items', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        ...item,
        isActive: true,
      });
    }
    // Retry laundry orders
    const { data: retryItems } = await api('GET', '/api/laundry/items?propertyId=' + PROPERTY_ID);
    const retryLaundry = retryItems?.data || [];
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const { status, data } = await api('POST', '/api/laundry/orders', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        items: [{ itemId: retryLaundry[i % retryLaundry.length]?.id, quantity: 2 }],
        status: 'pending',
      });
      recordResult('services', status === 200 || status === 201,
        `Laundry order ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  }

  // 5. Minibar Consumption
  log('SERVICES', '── Minibar Consumption ──');
  const { data: minibarData } = await api('GET', '/api/minibar/items?propertyId=' + PROPERTY_ID);
  const minibarItems = minibarData?.data || [];
  if (minibarItems.length > 0) {
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const { status, data } = await api('POST', '/api/minibar/consumption', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        itemId: minibarItems[i % minibarItems.length].id,
        quantity: 1 + Math.floor(Math.random() * 3),
        consumedAt: new Date().toISOString(),
      });

      recordResult('services', status === 200 || status === 201,
        `Minibar consumption ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  } else {
    log('SERVICES', '⚠ No minibar items found, creating test items...');
    for (const item of [
      { name: 'Coca Cola', price: 150, category: 'beverage' },
      { name: 'Chips Pack', price: 100, category: 'snack' },
      { name: 'Mineral Water', price: 80, category: 'beverage' },
    ]) {
      await api('POST', '/api/minibar/items', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        ...item,
        isActive: true,
      });
    }
    const { data: retryMb } = await api('GET', '/api/minibar/items?propertyId=' + PROPERTY_ID);
    const retryItems = retryMb?.data || [];
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const { status, data } = await api('POST', '/api/minibar/consumption', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        itemId: retryItems[i % retryItems.length]?.id,
        quantity: 1,
        consumedAt: new Date().toISOString(),
      });
      recordResult('services', status === 200 || status === 201,
        `Minibar ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  }

  // 6. Parking Passes
  log('SERVICES', '── Parking Passes ──');
  for (let i = 0; i < 10 && i < testGuests.length; i++) {
    const { status, data } = await api('POST', '/api/parking/passes', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      guestId: testGuests[i],
      bookingId: createdBookings[i] || undefined,
      vehicleNumber: `MH${String(i + 1).padStart(2, '0')}AB1234`,
      vehicleType: ['sedan', 'suv', 'hatchback'][i % 3],
      status: 'active',
    });

    recordResult('services', status === 200 || status === 201,
      `Parking pass ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }

  // 7. Casino Transactions
  log('SERVICES', '── Casino Transactions ──');
  const { data: casinoData } = await api('GET', '/api/casino/tables?propertyId=' + PROPERTY_ID);
  const casinoTables = casinoData?.data || [];
  if (casinoTables.length === 0) {
    log('SERVICES', 'Creating casino table...');
    const { status, data } = await api('POST', '/api/casino/tables', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'Blackjack Table 1',
      gameType: 'blackjack',
      minBet: 500,
      maxBet: 50000,
      status: 'active',
    });
    if (status === 200 || status === 201) {
      casinoTables.push(data?.data || data);
    }
  }
  for (let i = 0; i < 5 && i < testGuests.length; i++) {
    const table = casinoTables[0];
    const { status, data } = await api('POST', '/api/casino/transactions', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      guestId: testGuests[i],
      tableId: table?.id,
      type: i % 2 === 0 ? 'buy_in' : 'cash_out',
      amount: 1000 + Math.floor(Math.random() * 9000),
      currency: 'INR',
    });

    recordResult('services', status === 200 || status === 201,
      `Casino transaction ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }

  // 8. Room Service Orders (reuse menu items)
  log('SERVICES', '── Room Service Orders ──');
  if (menuItems.length > 0) {
    for (let i = 0; i < 10 && i < testGuests.length; i++) {
      const item = menuItems[i % menuItems.length];
      const { status, data } = await api('POST', '/api/orders', {
        propertyId: PROPERTY_ID,
        guestId: testGuests[i],
        bookingId: createdBookings[i] || undefined,
        orderType: 'room_service',
        items: [
          { menuItemId: item.id, quantity: 1 },
        ],
        notes: `E2E room service #${i + 1}`,
      });

      recordResult('services', status === 200 || status === 201,
        `Room service ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  }

  log('SERVICES', `✓ ${results.services.ok} services created, ${results.services.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Phase 5: Billing / Folios / Invoices / Payments
// ════════════════════════════════════════════════════════════════

async function testBilling() {
  log('BILLING', 'Testing billing module...');

  // Get existing folios for bookings instead of creating duplicates
  const { data: existingFolios } = await api('GET', '/api/folios?tenantId=' + TENANT_ID + '&limit=50');
  const folioList = existingFolios?.data || [];
  for (const f of folioList) {
    if (f.id) createdFolios.push(f.id);
  }
  log('BILLING', `  Found ${createdFolios.length} existing folios`);

  // If no existing folios, try to create some for new bookings
  if (createdFolios.length === 0) {
    for (let i = 0; i < Math.min(30, createdBookings.length); i++) {
      const { status, data } = await api('POST', '/api/folios', {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        bookingId: createdBookings[i],
        guestId: createdGuests[i],
        type: 'guest',
        status: 'open',
      });

      if (status === 200 || status === 201) {
        const folioId = data?.data?.id || data?.id;
        if (folioId) createdFolios.push(folioId);
        recordResult('folios', true);
      } else {
        recordResult('folios', false, `Folio ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
      }

      if (i % 5 === 0) await delay(50);
    }
  }

  // Add line items to folios
  log('BILLING', 'Adding line items to folios...');
  const lineItemTypes = [
    { type: 'room_charge', description: 'Room Charge - Deluxe Suite', amount: 8000 },
    { type: 'food_beverage', description: 'Restaurant - Dinner', amount: 2500 },
    { type: 'spa', description: 'Spa - Swedish Massage', amount: 2500 },
    { type: 'laundry', description: 'Laundry Service', amount: 800 },
    { type: 'minibar', description: 'Minibar - Beverages', amount: 450 },
    { type: 'wifi', description: 'WiFi Premium Plan', amount: 399 },
    { type: 'parking', description: 'Valet Parking', amount: 500 },
    { type: 'golf', description: 'Golf - Green Fee', amount: 5000 },
    { type: 'room_service', description: 'Room Service - Breakfast', amount: 1200 },
    { type: 'casino', description: 'Casino Buy-in', amount: 5000 },
  ];

  for (let i = 0; i < createdFolios.length; i++) {
    const folioId = createdFolios[i];
    // Add 3-5 line items per folio
    const itemCount = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < itemCount; j++) {
      const item = lineItemTypes[(i * itemCount + j) % lineItemTypes.length];
      const { status, data } = await api('POST', `/api/folios/${folioId}/line-items`, {
        tenantId: TENANT_ID,
        type: item.type,
        description: item.description,
        amount: item.amount,
        quantity: 1,
      });

      recordResult('folios', status === 200 || status === 201,
        `Line item ${j + 1} for folio ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
    }
  }

  // Test payments for some folios
  log('BILLING', 'Creating payments...');
  for (let i = 0; i < Math.min(10, createdFolios.length); i++) {
    const paymentMethods = ['credit_card', 'upi', 'cash', 'bank_transfer', 'wallet'];
    const { status, data } = await api('POST', '/api/v1/payments', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      folioId: createdFolios[i],
      amount: 5000 + Math.floor(Math.random() * 10000),
      currency: 'INR',
      method: paymentMethods[i % paymentMethods.length],
      status: 'completed',
    });

    recordResult('folios', status === 200 || status === 201,
      `Payment ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }

  // Test credit notes
  log('BILLING', 'Creating credit notes...');
  for (let i = 0; i < Math.min(3, createdFolios.length); i++) {
    const { status, data } = await api('POST', '/api/folio/credit-notes', {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      folioId: createdFolios[i],
      amount: 1000,
      reason: 'Service adjustment - E2E test',
    });

    recordResult('folios', status === 200 || status === 201,
      `Credit note ${i + 1}: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }

  // Test folio transfer
  log('BILLING', 'Testing folio transfer...');
  if (createdFolios.length >= 2) {
    const { status, data } = await api('POST', `/api/folios/${createdFolios[0]}/transfer`, {
      tenantId: TENANT_ID,
      targetFolioId: createdFolios[1],
      amount: 500,
      reason: 'Charge transfer - E2E test',
    });

    recordResult('folios', status === 200 || status === 201,
      `Folio transfer: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }

  log('BILLING', `✓ ${results.folios.ok} billing ops succeeded, ${results.folios.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Phase 6: Verification — Check all data displays correctly
// ════════════════════════════════════════════════════════════════

async function verifyData() {
  log('VERIFY', 'Verifying all pages return proper data...');

  const checks = [
    { name: 'Dashboard', path: '/api/dashboard' },
    { name: 'Guests List', path: '/api/guests?tenantId=' + TENANT_ID },
    { name: 'Bookings List', path: '/api/bookings?tenantId=' + TENANT_ID },
    { name: 'WiFi Sessions', path: '/api/wifi/sessions?tenantId=' + TENANT_ID },
    { name: 'WiFi Users', path: '/api/wifi/users?tenantId=' + TENANT_ID },
    { name: 'WiFi Plans', path: '/api/wifi/plans' },
    { name: 'WiFi Vouchers', path: '/api/wifi/vouchers' },
    { name: 'IP Pools', path: '/api/wifi/ip-pools' },
    { name: 'Folios', path: '/api/folios?tenantId=' + TENANT_ID },
    { name: 'Laundry Orders', path: '/api/laundry/orders?propertyId=' + PROPERTY_ID },
    { name: 'Laundry Items', path: '/api/laundry/items?propertyId=' + PROPERTY_ID },
    { name: 'Minibar Consumption', path: '/api/minibar/consumption?propertyId=' + PROPERTY_ID },
    { name: 'Minibar Items', path: '/api/minibar/items?propertyId=' + PROPERTY_ID },
    { name: 'Parking Passes', path: '/api/parking/passes?propertyId=' + PROPERTY_ID },
    { name: 'Spa Treatments', path: '/api/experience/spa/treatments?propertyId=' + PROPERTY_ID },
    { name: 'Spa Appointments', path: '/api/experience/spa/appointments?propertyId=' + PROPERTY_ID },
    { name: 'Golf Courses', path: '/api/experience/golf/courses?propertyId=' + PROPERTY_ID },
    { name: 'Golf Tee Times', path: '/api/experience/golf/tee-times?propertyId=' + PROPERTY_ID },
    { name: 'Audit Logs', path: '/api/audit-logs?tenantId=' + TENANT_ID },
    { name: 'Rooms', path: '/api/rooms?propertyId=' + PROPERTY_ID },
    { name: 'Bandwidth Report', path: '/api/wifi/reports/bandwidth?propertyId=' + PROPERTY_ID },
    { name: 'WiFi Identity Logs', path: '/api/wifi/identity-logs?tenantId=' + TENANT_ID },
    { name: 'Portal Instances', path: '/api/wifi/portal/instances' },
    { name: 'Network Interfaces', path: '/api/wifi/network/interfaces?propertyId=' + PROPERTY_ID },
    { name: 'Casino Tables', path: '/api/casino/tables?propertyId=' + PROPERTY_ID },
    { name: 'Bank Accounts', path: '/api/accounting/bank-accounts?tenantId=' + TENANT_ID },
    { name: 'Assets', path: '/api/assets?tenantId=' + TENANT_ID },
    { name: 'Amenities', path: '/api/amenities?tenantId=' + TENANT_ID },
    { name: 'Credit Notes', path: '/api/folio/credit-notes?tenantId=' + TENANT_ID },
    { name: 'WiFi Quotas', path: '/api/wifi/quotas?tenantId=' + TENANT_ID },
  ];

  for (const check of checks) {
    const { status, data } = await api('GET', check.path);

    if (status === 200 && (data?.success !== false)) {
      const count = Array.isArray(data?.data) ? data.data.length :
                    data?.data?._count || data?.count || data?.total || '✓';
      recordResult('verification', true);
      log('VERIFY', `  ✓ ${check.name}: ${count} items`);
    } else {
      const errMsg = data?.error?.message || data?.error?.code || JSON.stringify(data).slice(0, 150);
      recordResult('verification', false, `${check.name}: ${status} ${errMsg}`);
      log('VERIFY', `  ✗ ${check.name}: ${status} ${errMsg}`);
    }
  }

  log('VERIFY', `✓ ${results.verification.ok} pages verified, ${results.verification.fail} failed`);
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  StaySuite HospitalityOS — Full E2E Test');
  console.log('  100 Guests WiFi Login + Full Lifecycle');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Phase 0
    await login();

    // Phase 1
    await createGuests();
    await createBookings();

    // Phase 2
    await createVouchers();

    // Phase 3
    await testWifiAuth();

    // Phase 4
    await testGuestServices();

    // Phase 5
    await testBilling();

    // Phase 6
    await verifyData();
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err);
  }

  // ════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  E2E TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalOk = 0;
  let totalFail = 0;

  for (const [category, result] of Object.entries(results)) {
    const icon = result.fail === 0 ? '✓' : '⚠';
    console.log(`  ${icon} ${category.padEnd(15)} ${String(result.ok).padStart(4)} ok  ${String(result.fail).padStart(3)} fail`);
    totalOk += result.ok;
    totalFail += result.fail;

    if (result.errors.length > 0) {
      const uniqueErrors = [...new Set(result.errors)].slice(0, 5);
      for (const err of uniqueErrors) {
        console.log(`      → ${err.slice(0, 120)}`);
      }
      if (result.errors.length > 5) {
        console.log(`      ... and ${result.errors.length - 5} more errors`);
      }
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(`  TOTAL: ${totalOk} passed, ${totalFail} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(totalFail > 0 ? 1 : 0);
}

main();
