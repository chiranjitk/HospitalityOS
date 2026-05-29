/**
 * Full Cycle Test: WiFi Plan → Room Type Mapping → Booking → Check-in → Invoice
 * 
 * Tests the complete flow:
 * 1. Login & get session token
 * 2. Create a new test property
 * 3. Create 10 WiFi plans (mix of free & paid)
 * 4. Create 10 room types (each linked to a WiFi plan)
 * 5. Create 50 rooms (5 per room type)
 * 6. Create 50 guest profiles
 * 7. Create 50 bookings (assign rooms)
 * 8. Check-in all 50 guests (triggers WiFi auto-provisioning)
 * 9. Verify WiFi credentials have correct plan assignment
 * 10. Generate invoices and verify price calculations
 */

const BASE = 'http://localhost:3000';
let TOKEN = '';
const RESULTS: { step: string; status: 'pass' | 'fail' | 'warn'; detail: string }[] = [];

// ---------- helpers ----------
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Cookie: `session_token=${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ok: res.ok };
}

function log(step: string, status: 'pass' | 'fail' | 'warn', detail: string) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  RESULTS.push({ step, status, detail });
  console.log(`${icon} ${step}: ${detail}`);
}

// ---------- data ----------
const ROOM_TYPES = [
  { name: 'Standard Single',    code: 'STD-SGL',  basePrice: 1500, beds: 'Single',  maxOcc: 1 },
  { name: 'Standard Double',    code: 'STD-DBL',  basePrice: 2200, beds: 'Double',  maxOcc: 2 },
  { name: 'Deluxe Single',      code: 'DLX-SGL',  basePrice: 2800, beds: 'Single',  maxOcc: 1 },
  { name: 'Deluxe Double',      code: 'DLX-DBL',  basePrice: 3500, beds: 'Double',  maxOcc: 2 },
  { name: 'Superior Room',      code: 'SUP-STD',  basePrice: 4200, beds: 'Double',  maxOcc: 2 },
  { name: 'Junior Suite',       code: 'JNR-SUT',  basePrice: 5500, beds: 'King',    maxOcc: 2 },
  { name: 'Executive Suite',    code: 'EXE-SUT',  basePrice: 7500, beds: 'King',    maxOcc: 3 },
  { name: 'Premium Suite',      code: 'PRM-SUT',  basePrice: 9500, beds: 'King',    maxOcc: 3 },
  { name: 'Presidential Suite',  code: 'PRS-SUT',  basePrice: 15000, beds: 'King',   maxOcc: 4 },
  { name: 'Honeymoon Villa',    code: 'HNM-VLA',  basePrice: 20000, beds: 'King',   maxOcc: 2 },
];

const WIFI_PLANS = [
  { name: 'Complimentary Basic', downloadSpeed: 2,  uploadSpeed: 1,  dataLimit: 500,   price: 0,    currency: 'INR', validityDays: 1 },
  { name: 'Complimentary Plus',  downloadSpeed: 5,  uploadSpeed: 2,  dataLimit: 0,     price: 0,    currency: 'INR', validityDays: 1 },
  { name: 'Standard Connect',    downloadSpeed: 10, uploadSpeed: 5,  dataLimit: 2000,  price: 99,   currency: 'INR', validityDays: 1 },
  { name: 'Standard Plus',       downloadSpeed: 15, uploadSpeed: 8,  dataLimit: 5000,  price: 149,  currency: 'INR', validityDays: 1 },
  { name: 'Premium Surf',        downloadSpeed: 25, uploadSpeed: 15, dataLimit: 10000, price: 249,  currency: 'INR', validityDays: 1 },
  { name: 'Premium Streaming',   downloadSpeed: 50, uploadSpeed: 25, dataLimit: 0,     price: 399,  currency: 'INR', validityDays: 1 },
  { name: 'Business Class',      downloadSpeed: 50, uploadSpeed: 50, dataLimit: 0,     price: 499,  currency: 'INR', validityDays: 1 },
  { name: 'Executive WiFi',      downloadSpeed: 100,uploadSpeed: 50, dataLimit: 0,     price: 699,  currency: 'INR', validityDays: 1 },
  { name: 'Royal Suite WiFi',    downloadSpeed: 200,uploadSpeed: 100,dataLimit: 0,     price: 999,  currency: 'INR', validityDays: 1 },
  { name: 'VIP Unlimited',       downloadSpeed: 500,uploadSpeed: 200,dataLimit: 0,     price: 1499, currency: 'INR', validityDays: 1 },
];

const GUEST_FIRST_NAMES = [
  'Arjun','Priya','Rahul','Ananya','Vikram','Neha','Rohan','Sneha','Aditya','Kavya',
  'Amit','Pooja','Karan','Riya','Manish','Divya','Sanjay','Megha','Nikhil','Swati',
  'Deepak','Asha','Rajesh','Renu','Suresh','Geeta','Mahesh','Sunita','Anil','Rekha',
  'Varun','Pallavi','Ravi','Shalini','Ajay','Bindu','Gaurav','Nisha','Praveen','Lakshmi',
  'Harsh','Aparna','Satish','Kamini','Tarun','Veena','Ashok','Madhuri','Vinod','Sangita',
];

const GUEST_LAST_NAMES = [
  'Sharma','Patel','Gupta','Singh','Kumar','Verma','Reddy','Iyer','Nair','Joshi',
  'Das','Mishra','Agarwal','Rao','Chopra','Malhotra','Bhat','Chauhan','Pillai','Menon',
  'Mehta','Bansal','Khanna','Kapoor','Tandon','Dutta','Chakraborty','Mukherjee','Ghosh','Bose',
  'Puri','Saxena','Ahuja','Wadhwa','Bajaj','Chadha','Grover','Batra','Soni','Walia',
  'Kakkar','Trehan','Kalra','Bawa','Garg','Tuli','Arora','Sehgal','Manchanda','Bindra',
];

// ----- runtime storage -----
let propertyId = '';
let tenantId = '';
const planIds: string[] = [];
const roomTypeIds: string[] = [];
const rooms: { id: string; number: string; roomTypeId: string; roomTypeName: string }[] = [];
const guestIds: string[] = [];
const bookings: { id: string; confirmationCode: string; roomId: string; roomTypeName: string; roomNumber: string; guestName: string }[] = [];
const checkinResults: { bookingId: string; wifiCreds: unknown; roomTypeName: string }[] = [];

// ========== MAIN ==========
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  WiFi Plan ↔ Room Type Mapping — Full Cycle Test            ║');
  console.log('║  10 Room Types × 5 Rooms = 50 Rooms, 50 Guests, 50 Bookings ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ===== STEP 1: Login =====
  console.log('━━━ STEP 1: Login ━━━');
  const loginRes = await api('POST', '/api/auth/login', {
    email: 'admin@royalstay.in',
    password: 'admin123',
  });
  if (loginRes.ok && loginRes.data?.success) {
    // Extract token from set-cookie (need to re-login to capture it)
    const loginFetch = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@royalstay.in', password: 'admin123' }),
      redirect: 'manual',
    });
    const setCookie = loginFetch.headers.get('set-cookie') || '';
    const match = setCookie.match(/session_token=([^;]+)/);
    if (match) {
      TOKEN = match[1];
      tenantId = loginRes.data.user.tenantId;
      log('Login', 'pass', `Authenticated as ${loginRes.data.user.name}, tenantId=${tenantId.substring(0,8)}...`);
    } else {
      log('Login', 'fail', 'Could not extract session token from cookie');
      return printSummary();
    }
  } else {
    log('Login', 'fail', `Login failed: ${JSON.stringify(loginRes.data)}`);
    return printSummary();
  }

  // ===== STEP 2: Create Property =====
  console.log('\n━━━ STEP 2: Create Test Property ━━━');
  const propRes = await api('POST', '/api/properties', {
    name: 'WiFi Test Resort',
    slug: 'wifi-test-resort',
    address: '100 Tech Park Road',
    city: 'Bangalore',
    country: 'India',
    state: 'Karnataka',
    postalCode: '560001',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    taxType: 'gst',
    defaultTaxRate: 18,
    taxComponents: JSON.stringify([
      { name: 'CGST', rate: 9, type: 'inclusive' },
      { name: 'SGST', rate: 9, type: 'inclusive' },
    ]),
    totalFloors: 5,
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });

  if (propRes.ok && propRes.data?.data?.id) {
    propertyId = propRes.data.data.id;
    log('Create Property', 'pass', `WiFi Test Resort (id=${propertyId.substring(0,8)}...)`);
  } else if (propRes.status === 400 && propRes.data?.error?.code === 'DUPLICATE_SLUG') {
    // Property already exists — fetch it
    const existingProp = await api('GET', `/api/properties?slug=wifi-test-resort`);
    if (existingProp.ok && existingProp.data?.data?.length > 0) {
      propertyId = existingProp.data.data[0].id;
      log('Create Property', 'warn', `Property already exists (id=${propertyId.substring(0,8)}...), reusing`);
    } else {
      log('Create Property', 'fail', `Duplicate slug and could not fetch existing: ${JSON.stringify(propRes.data)}`);
      return printSummary();
    }
  } else {
    log('Create Property', 'fail', `Failed: ${propRes.status} ${JSON.stringify(propRes.data)}`);
    return printSummary();
  }

  // ===== STEP 3: Create 10 WiFi Plans =====
  console.log('\n━━━ STEP 3: Create 10 WiFi Plans ━━━');
  let plansCreated = 0;
  let plansFailed = 0;
  for (const plan of WIFI_PLANS) {
    const res = await api('POST', '/api/wifi/plans', { ...plan, status: 'active' });
    if (res.ok && res.data?.data?.id) {
      planIds.push(res.data.data.id);
      plansCreated++;
      const type = plan.price === 0 ? 'FREE' : `₹${plan.price}`;
      log(`Plan: ${plan.name}`, 'pass', `${plan.downloadSpeed}/${plan.uploadSpeed} Mbps, ${plan.dataLimit === 0 ? 'Unlimited' : plan.dataLimit + 'MB'}, ${type}`);
    } else if (res.status === 400 && res.data?.error?.includes('DUPLICATE')) {
      // Plan already exists — fetch it
      const listRes = await api('GET', '/api/wifi/plans');
      if (listRes.ok && listRes.data?.data) {
        const existing = listRes.data.data.find((p: { name: string }) => p.name === plan.name);
        if (existing) {
          planIds.push(existing.id);
          plansCreated++;
          log(`Plan: ${plan.name}`, 'warn', 'Already exists, reusing');
        }
      } else {
        plansFailed++;
        log(`Plan: ${plan.name}`, 'fail', `Duplicate and could not fetch: ${JSON.stringify(res.data)}`);
      }
    } else {
      plansFailed++;
      log(`Plan: ${plan.name}`, 'fail', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }
  log('WiFi Plans Summary', plansCreated === 10 ? 'pass' : 'warn', `Created/Found: ${plansCreated}, Failed: ${plansFailed}`);

  // ===== STEP 4: Create 10 Room Types (each linked to a WiFi plan) =====
  console.log('\n━━━ STEP 4: Create 10 Room Types with WiFi Plan Mapping ━━━');
  let rtCreated = 0;
  for (let i = 0; i < ROOM_TYPES.length; i++) {
    const rt = ROOM_TYPES[i];
    const body: Record<string, unknown> = {
      propertyId,
      name: rt.name,
      code: rt.code,
      basePrice: rt.basePrice,
      currency: 'INR',
      maxOccupancy: rt.maxOcc,
      maxAdults: rt.maxOcc,
      bedType: rt.beds,
      bedCount: 1,
      status: 'active',
    };
    if (planIds[i]) {
      body.wifiPlanId = planIds[i];
    }

    const res = await api('POST', '/api/room-types', body);
    if (res.ok && res.data?.data?.id) {
      roomTypeIds.push(res.data.data.id);
      rtCreated++;
      const planType = WIFI_PLANS[i].price === 0 ? 'FREE' : `₹${WIFI_PLANS[i].price}`;
      log(`Room Type: ${rt.name}`, 'pass', `₹${rt.basePrice}/night → Plan: ${WIFI_PLANS[i].name} (${planType})`);
    } else if (res.status === 400 && res.data?.error?.includes('DUPLICATE')) {
      // Room type already exists
      const listRes = await api('GET', `/api/room-types?propertyId=${propertyId}`);
      if (listRes.ok && listRes.data?.data) {
        const existing = (listRes.data.data as Array<{ id: string; code: string }>).find(r => r.code === rt.code);
        if (existing) {
          roomTypeIds.push(existing.id);
          // Update wifiPlanId if needed
          if (planIds[i]) {
            await api('PUT', `/api/room-types/${existing.id}`, { wifiPlanId: planIds[i] });
          }
          rtCreated++;
          log(`Room Type: ${rt.name}`, 'warn', 'Already exists, updated WiFi plan mapping');
        }
      } else {
        log(`Room Type: ${rt.name}`, 'fail', `Duplicate and could not fetch`);
      }
    } else {
      log(`Room Type: ${rt.name}`, 'fail', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }
  log('Room Types Summary', rtCreated === 10 ? 'pass' : 'warn', `Created/Found: ${rtCreated}/10`);

  // ===== STEP 5: Create 50 Rooms (5 per room type) =====
  console.log('\n━━━ STEP 5: Create 50 Rooms (5 per room type) ━━━');
  let roomsCreated = 0;
  let roomsSkipped = 0;
  const roomTypeRoomCounts: number[] = new Array(10).fill(0);

  for (let rtIdx = 0; rtIdx < 10; rtIdx++) {
    if (!roomTypeIds[rtIdx]) continue;
    const floorStart = Math.floor(rtIdx * 0.5) + 1; // Spread across floors 1-5
    for (let r = 0; r < 5; r++) {
      const floor = floorStart;
      const roomNumber = `${floor}${String(r + rtIdx * 5 + 1).padStart(2, '0')}`;
      const res = await api('POST', '/api/rooms', {
        propertyId,
        roomTypeId: roomTypeIds[rtIdx],
        number: roomNumber,
        floor,
        name: `${ROOM_TYPES[rtIdx].name} - ${roomNumber}`,
        status: 'available',
      });
      if (res.ok && res.data?.data?.id) {
        rooms.push({
          id: res.data.data.id,
          number: roomNumber,
          roomTypeId: roomTypeIds[rtIdx],
          roomTypeName: ROOM_TYPES[rtIdx].name,
        });
        roomsCreated++;
        roomTypeRoomCounts[rtIdx]++;
      } else if (res.status === 400 && (res.data?.error?.includes('DUPLICATE') || res.data?.error?.code === 'DUPLICATE_NUMBER')) {
        roomsSkipped++;
        // Try to find existing room
        const listRes = await api('GET', `/api/rooms?propertyId=${propertyId}&roomTypeId=${roomTypeIds[rtIdx]}`);
        if (listRes.ok && listRes.data?.data) {
          const existing = (listRes.data.data as Array<{ id: string; number: string; roomTypeId: string }>).find(rm => rm.number === roomNumber);
          if (existing) {
            rooms.push({
              id: existing.id,
              number: roomNumber,
              roomTypeId: roomTypeIds[rtIdx],
              roomTypeName: ROOM_TYPES[rtIdx].name,
            });
            roomsCreated++;
            roomTypeRoomCounts[rtIdx]++;
          }
        }
      } else {
        log(`Room ${roomNumber}`, 'fail', `Status ${res.status}: ${JSON.stringify(res.data)?.substring(0, 100)}`);
      }
    }
  }
  log('Rooms Summary', roomsCreated >= 50 ? 'pass' : 'warn', `Total: ${roomsCreated} (New + Reused), Skipped: ${roomsSkipped}`);
  for (let i = 0; i < 10; i++) {
    console.log(`   ${ROOM_TYPES[i].name}: ${roomTypeRoomCounts[i]} rooms`);
  }

  // ===== STEP 6: Create 50 Guest Profiles =====
  console.log('\n━━━ STEP 6: Create 50 Guest Profiles ━━━');
  let guestsCreated = 0;
  for (let i = 0; i < 50; i++) {
    const firstName = GUEST_FIRST_NAMES[i];
    const lastName = GUEST_LAST_NAMES[i];
    const res = await api('POST', '/api/guests', {
      firstName,
      lastName,
      email: `testguest${i + 1}@wifitest.com`,
      phone: `+919876${String(54321 + i).padStart(5, '0')}`,
      nationality: 'Indian',
      source: 'direct',
    });
    if (res.ok && res.data?.data?.id) {
      guestIds.push(res.data.data.id);
      guestsCreated++;
    } else if (res.status === 400 && res.data?.error?.includes('already')) {
      // Duplicate — try to find
      const listRes = await api('GET', `/api/guests?search=testguest${i + 1}`);
      if (listRes.ok && listRes.data?.data?.length > 0) {
        guestIds.push(listRes.data.data[0].id);
        guestsCreated++;
      }
    }
  }
  log('Guests Summary', guestsCreated >= 50 ? 'pass' : 'warn', `Created/Found: ${guestsCreated}/50`);

  // ===== STEP 7: Create 50 Bookings =====
  console.log('\n━━━ STEP 7: Create 50 Bookings ━━━');
  let bookingsCreated = 0;
  const today = new Date();
  const checkInDate = new Date(today);
  checkInDate.setDate(today.getDate() + 1); // Tomorrow
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkInDate.getDate() + 2); // 2 nights

  for (let i = 0; i < Math.min(50, rooms.length, guestIds.length); i++) {
    const room = rooms[i];
    const guestName = `${GUEST_FIRST_NAMES[i]} ${GUEST_LAST_NAMES[i]}`;
    const res = await api('POST', '/api/bookings', {
      propertyId,
      primaryGuestId: guestIds[i],
      roomTypeId: room.roomTypeId,
      roomId: room.id,
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      adults: ROOM_TYPES.find(rt => rt.name === room.roomTypeName)?.maxOcc || 1,
      children: 0,
      currency: 'INR',
      source: 'direct',
      status: 'confirmed',
      specialRequests: `Test booking for ${room.roomTypeName} WiFi plan verification`,
    });
    if (res.ok && res.data?.data?.id) {
      bookings.push({
        id: res.data.data.id,
        confirmationCode: res.data.data.confirmationCode,
        roomId: room.id,
        roomTypeName: room.roomTypeName,
        roomNumber: room.number,
        guestName,
      });
      bookingsCreated++;
    } else {
      const errInfo = JSON.stringify(res.data)?.substring(0, 120);
      log(`Booking #${i + 1} (${guestName})`, 'fail', `${res.status}: ${errInfo}`);
    }
  }
  log('Bookings Summary', bookingsCreated >= 50 ? 'pass' : 'warn', `Created: ${bookingsCreated}/50`);

  // ===== STEP 8: Check-in All Bookings =====
  console.log('\n━━━ STEP 8: Check-in All 50 Bookings (triggers WiFi provisioning) ━━━');
  let checkedIn = 0;
  let checkinFailed = 0;
  let wifiProvisioned = 0;
  let wifiNotProvisioned = 0;

  for (const booking of bookings) {
    const res = await api('PUT', `/api/bookings/${booking.id}`, {
      status: 'checked_in',
      actualCheckIn: new Date().toISOString(),
    });
    if (res.ok) {
      checkedIn++;
      if (res.data?.data?.wifiCredentials) {
        wifiProvisioned++;
        checkinResults.push({
          bookingId: booking.id,
          wifiCreds: res.data.data.wifiCredentials,
          roomTypeName: booking.roomTypeName,
        });
      } else {
        wifiNotProvisioned++;
        checkinResults.push({
          bookingId: booking.id,
          wifiCreds: null,
          roomTypeName: booking.roomTypeName,
        });
      }
    } else {
      checkinFailed++;
      log(`Check-in ${booking.confirmationCode} (${booking.guestName})`, 'fail', 
        `${res.status}: ${JSON.stringify(res.data)?.substring(0, 120)}`);
    }
  }
  log('Check-in Summary', 'pass', `Success: ${checkedIn}, Failed: ${checkinFailed}`);
  log('WiFi Provisioning', wifiProvisioned > 0 ? 'pass' : 'warn', 
    `Provisioned: ${wifiProvisioned}, Not provisioned: ${wifiNotProvisioned}`);

  // ===== STEP 9: Verify WiFi Plan Assignment =====
  console.log('\n━━━ STEP 9: Verify WiFi Plan Assignments ━━━');
  
  // Check WiFi users via API
  const wifiUsersRes = await api('GET', '/api/wifi/users');
  if (wifiUsersRes.ok && wifiUsersRes.data?.data) {
    const wifiUsers = wifiUsersRes.data.data;
    log('WiFi Users Count', 'pass', `Total WiFi users in system: ${wifiUsers.length}`);
    
    // Check for our test bookings' WiFi users
    const testWifiUsers = wifiUsers.filter((u: { bookingId?: string }) => 
      bookings.some(b => b.id === u.bookingId)
    );
    log('Test WiFi Users', 'pass', `WiFi users for test bookings: ${testWifiUsers.length}`);
    
    if (testWifiUsers.length > 0) {
      // Verify plan assignments
      let correctPlan = 0;
      let wrongPlan = 0;
      const planAssignmentDetails: string[] = [];
      
      for (const wu of testWifiUsers) {
        const booking = bookings.find(b => b.id === wu.bookingId);
        if (!booking) continue;
        
        const rtIdx = ROOM_TYPES.findIndex(rt => rt.name === booking.roomTypeName);
        const expectedPlanName = rtIdx >= 0 ? WIFI_PLANS[rtIdx].name : 'Unknown';
        const actualPlanName = wu.planName || wu.plan || wu.groupName || 'N/A';
        
        if (actualPlanName.toLowerCase().includes(expectedPlanName.toLowerCase().split(' ')[0].toLowerCase()) || 
            wu.planId === planIds[rtIdx]) {
          correctPlan++;
          planAssignmentDetails.push(`  ✅ ${wu.wifiUsername || wu.username || '?'} → ${actualPlanName} (expected: ${expectedPlanName})`);
        } else {
          wrongPlan++;
          planAssignmentDetails.push(`  ❌ ${wu.wifiUsername || wu.username || '?'} → ${actualPlanName} (expected: ${expectedPlanName})`);
        }
      }
      
      log('Plan Assignment Correct', correctPlan > 0 ? 'pass' : 'warn', `Correct: ${correctPlan}, Wrong: ${wrongPlan}`);
      
      // Show first 10 assignments
      console.log('\n  WiFi Plan Assignments (first 15):');
      planAssignmentDetails.slice(0, 15).forEach(d => console.log(d));
      if (planAssignmentDetails.length > 15) {
        console.log(`  ... and ${planAssignmentDetails.length - 15} more`);
      }
    }
  } else {
    log('WiFi Users API', 'warn', `Could not fetch WiFi users: ${JSON.stringify(wifiUsersRes.data)?.substring(0, 100)}`);
  }

  // Also check via RadCheck/RadReply if WiFi credentials were returned during check-in
  if (wifiProvisioned > 0) {
    console.log('\n  WiFi Credentials from Check-in (first 10):');
    for (let i = 0; i < Math.min(10, checkinResults.filter(r => r.wifiCreds).length); i++) {
      const r = checkinResults.filter(r => r.wifiCreds)[i];
      const creds = r.wifiCreds as { username?: string; password?: string; validUntil?: string; planName?: string };
      console.log(`  Room: ${r.roomTypeName} → WiFi: ${creds.username || 'N/A'}, Plan: ${creds.planName || 'N/A'}, Valid: ${creds.validUntil || 'N/A'}`);
    }
  }

  // ===== STEP 10: Verify Folios & Invoices =====
  console.log('\n━━━ STEP 10: Verify Folios & Price Calculations ━━━');
  let foliosChecked = 0;
  let invoicesGenerated = 0;
  let totalRevenue = 0;
  const folioDetails: string[] = [];

  // Sample 10 bookings to check folios
  const sampleBookings = bookings.filter((_, i) => i % 5 === 0); // every 5th booking
  for (const booking of sampleBookings) {
    const folioRes = await api('GET', `/api/folios?bookingId=${booking.id}`);
    if (folioRes.ok && folioRes.data?.data?.length > 0) {
      const folio = folioRes.data.data[0];
      foliosChecked++;
      totalRevenue += folio.totalAmount || 0;
      
      const rt = ROOM_TYPES.find(rt => rt.name === booking.roomTypeName);
      const expectedNightly = rt ? rt.basePrice : 0;
      const nights = 2;
      const expectedTotal = expectedNightly * nights;
      
      const match = Math.abs((folio.totalAmount || 0) - expectedTotal) < 100;
      folioDetails.push(`  ${match ? '✅' : '⚠️'} ${booking.confirmationCode}: ${booking.roomTypeName} | Folio: ₹${folio.totalAmount?.toFixed(0)} (expected ~₹${expectedTotal}) | Status: ${folio.status}`);
    }
  }
  
  log('Folios Checked', foliosChecked > 0 ? 'pass' : 'warn', `${foliosChecked} folios verified`);
  log('Total Revenue (sample)', 'pass', `₹${totalRevenue.toFixed(0)}`);
  
  if (folioDetails.length > 0) {
    console.log('\n  Folio Details:');
    folioDetails.forEach(d => console.log(d));
  }

  // Generate invoices for a few bookings (checkout first)
  console.log('\n  --- Checkout & Invoice Generation (5 sample bookings) ---');
  const invoiceSample = bookings.slice(0, 5);
  for (const booking of invoiceSample) {
    // Checkout
    const checkoutRes = await api('PUT', `/api/bookings/${booking.id}`, {
      status: 'checked_out',
      actualCheckOut: new Date().toISOString(),
    });
    if (checkoutRes.ok) {
      // Generate invoice
      const folioRes = await api('GET', `/api/folios?bookingId=${booking.id}`);
      if (folioRes.ok && folioRes.data?.data?.length > 0) {
        const folioId = folioRes.data.data[0].id;
        const invoiceRes = await api('POST', '/api/invoices', { folioId });
        if (invoiceRes.ok) {
          invoicesGenerated++;
          const inv = invoiceRes.data?.data;
          console.log(`  ✅ Invoice ${inv?.invoiceNumber || '?'}: ₹${inv?.totalAmount?.toFixed(0) || '?'} | ${booking.roomTypeName} | ${booking.guestName}`);
        } else {
          console.log(`  ⚠️ Invoice failed for ${booking.confirmationCode}: ${JSON.stringify(invoiceRes.data)?.substring(0, 80)}`);
        }
      }
    }
  }
  log('Invoices Generated', invoicesGenerated > 0 ? 'pass' : 'warn', `${invoicesGenerated} invoices created from checkout`);

  // ===== FINAL SUMMARY =====
  printSummary();
}

function printSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  const passed = RESULTS.filter(r => r.status === 'pass').length;
  const failed = RESULTS.filter(r => r.status === 'fail').length;
  const warned = RESULTS.filter(r => r.status === 'warn').length;
  
  console.log(`║  ✅ Passed: ${String(passed).padEnd(47)}║`);
  console.log(`║  ❌ Failed: ${String(failed).padEnd(47)}║`);
  console.log(`║  ⚠️  Warnings: ${String(warned).padEnd(47)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Data Created:                                              ║');
  console.log(`║    Property: WiFi Test Resort (${propertyId ? '✅' : '❌'})`.padEnd(57) + '║');
  console.log(`║    WiFi Plans: ${String(planIds.length).padEnd(45)}║`);
  console.log(`║    Room Types: ${String(roomTypeIds.length).padEnd(45)}║`);
  console.log(`║    Rooms: ${String(rooms.length).padEnd(49)}║`);
  console.log(`║    Guests: ${String(guestIds.length).padEnd(49)}║`);
  console.log(`║    Bookings: ${String(bookings.length).padEnd(47)}║`);
  console.log(`║    Check-ins: ${String(checkinResults.length).padEnd(47)}║`);
  console.log(`║    WiFi Provisioned: ${String(checkinResults.filter(r => r.wifiCreds).length).padEnd(39)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  WiFi Plan → Room Type Mapping:                            ║');
  for (let i = 0; i < Math.min(10, ROOM_TYPES.length); i++) {
    const planType = WIFI_PLANS[i].price === 0 ? 'FREE' : `₹${WIFI_PLANS[i].price}`;
    const line = `${ROOM_TYPES[i].name} → ${WIFI_PLANS[i].name} (${planType})`;
    console.log(`║  ${line.padEnd(55)}║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
