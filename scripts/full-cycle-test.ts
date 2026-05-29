/**
 * Full Cycle Integration Test Script
 * Creates: 1 property, 10 room types, 50 rooms, 10 WiFi plans, 50 guests, 50 bookings
 * Tests: Booking → Check-in → Folio → Invoice → Price Calculation
 * 
 * Usage: bun run scripts/full-cycle-test.ts
 */

const BASE = 'http://localhost:3000';

// ============================================
// Helper: Authenticated Fetch
// ============================================
let sessionToken = '';

async function login() {
  console.log('🔐 Logging in...');
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@royalstay.in', password: 'admin123', rememberMe: true }),
    redirect: 'manual',
  });
  
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/session_token=([^;]+)/);
  if (!match) {
    // Try reading from response
    const body = await res.json();
    console.error('Login failed:', body);
    throw new Error('Login failed - no session token');
  }
  sessionToken = match[1];
  console.log('✅ Logged in successfully');
  return sessionToken;
}

async function api(path: string, opts: RequestInit = {}, retries = 2): Promise<{ status: number; data: unknown; ok: boolean }> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cookie': `session_token=${sessionToken}`,
        ...(opts.headers as Record<string, string> || {}),
      };
      const res = await fetch(url, { ...opts, headers });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }
      return { status: res.status, data: json, ok: res.ok };
    } catch (err: any) {
      if (attempt < retries && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
        console.log(`  ⚠️ Connection lost, retrying (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 3000)); // Wait for server restart
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

async function apiPost(path: string, body: unknown, retries?: number) {
  return api(path, { method: 'POST', body: JSON.stringify(body) }, retries);
}

async function apiPut(path: string, body: unknown) {
  return api(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function apiGet(path: string) {
  return api(path, { method: 'GET' });
}

// ============================================
// 1. CREATE PROPERTY
// ============================================
interface Property { id: string; name: string; }

async function createProperty(): Promise<Property> {
  console.log('\n🏨 Creating property: Skyline Grand Hotel Mumbai...');
  
  // Check if property already exists
  const existing = await apiGet('/api/properties?slug=skyline-grand-mumbai');
  const existingList = (existing.data as any)?.data || (existing.data as any)?.properties || [];
  if (Array.isArray(existingList) && existingList.length > 0) {
    console.log(`  ⚡ Property already exists, reusing: ${existingList[0].name}`);
    return existingList[0] as Property;
  }
  
  const { status, data, ok } = await apiPost('/api/properties', {
    name: 'Skyline Grand Hotel',
    slug: 'skyline-grand-mumbai',
    address: '123 Marine Drive',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '400001',
    type: 'hotel',
    description: 'Luxury business hotel in the heart of Mumbai with stunning sea views',
    phone: '+91-22-45678900',
    email: 'info@skylinegrand.com',
    website: 'https://skylinegrand.com',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    totalFloors: 10,
    defaultTaxRate: 18,
    serviceChargePercent: 5,
    taxType: 'gst',
    taxComponents: [
      { name: 'CGST', rate: 9, type: 'percentage' },
      { name: 'SGST', rate: 9, type: 'percentage' },
    ],
    primaryColor: '#1e3a5f',
    secondaryColor: '#c9a227',
    status: 'active',
  });

  if (!ok) {
    console.error(`❌ Property creation failed (${status}):`, data);
    throw new Error('Property creation failed');
  }
  
  const prop = data.data || data;
  console.log(`✅ Property created: ${prop.name} (${prop.id})`);
  return prop as Property;
}

// ============================================
// 2. CREATE 10 WIFI PLANS
// ============================================
interface WifiPlan { id: string; name: string; price: number; }

const WIFI_PLANS = [
  { name: 'Complimentary WiFi', downloadSpeed: 2, uploadSpeed: 1, price: 0, maxDevices: 1, validityDays: 1, description: 'Free basic WiFi for all guests' },
  { name: 'Basic Surf', downloadSpeed: 5, uploadSpeed: 2, price: 49, maxDevices: 1, validityDays: 1, description: 'Basic internet browsing' },
  { name: 'Standard Connect', downloadSpeed: 10, uploadSpeed: 5, price: 99, maxDevices: 2, validityDays: 1, description: 'Standard connectivity for casual use' },
  { name: 'Premium Speed', downloadSpeed: 25, uploadSpeed: 10, price: 199, maxDevices: 2, validityDays: 1, description: 'Fast internet for work and streaming' },
  { name: 'Business Express', downloadSpeed: 50, uploadSpeed: 25, price: 299, maxDevices: 3, validityDays: 1, description: 'Business-grade connectivity' },
  { name: 'VIP Suite WiFi', downloadSpeed: 100, uploadSpeed: 50, price: 499, maxDevices: 5, validityDays: 1, description: 'Ultra-fast WiFi for VIP suites' },
  { name: 'Conference Pro', downloadSpeed: 50, uploadSpeed: 25, price: 399, maxDevices: 10, validityDays: 1, description: 'Conference and meeting room WiFi' },
  { name: 'Family Pack', downloadSpeed: 20, uploadSpeed: 10, price: 149, maxDevices: 5, validityDays: 1, description: 'Shareable WiFi for families' },
  { name: 'Streaming Plus', downloadSpeed: 100, uploadSpeed: 50, price: 249, maxDevices: 2, validityDays: 1, description: '4K streaming optimized' },
  { name: 'Gamer Pro', downloadSpeed: 200, uploadSpeed: 100, price: 349, maxDevices: 3, validityDays: 1, description: 'Low-latency gaming WiFi' },
];

async function createWifiPlans(): Promise<WifiPlan[]> {
  console.log('\n📡 Creating 10 WiFi plans...');
  const plans: WifiPlan[] = [];
  
  // Check existing plans
  const existingRes = await apiGet('/api/wifi/plans?limit=100');
  const existingPlans = (existingRes.data as any)?.data || (existingRes.data as any)?.plans || [];
  const existingPlanNames = new Set(Array.isArray(existingPlans) ? existingPlans.map((p: any) => p.name) : []);
  
  for (const plan of WIFI_PLANS) {
    // Skip if plan already exists
    if (existingPlanNames.has(plan.name)) {
      const existing = Array.isArray(existingPlans) ? existingPlans.find((p: any) => p.name === plan.name) : null;
      if (existing) {
        plans.push({ id: existing.id, name: existing.name, price: existing.price });
        console.log(`  ⚡ ${existing.name} — already exists`);
        continue;
      }
    }
    
    const { status, data, ok } = await apiPost('/api/wifi/plans', {
      ...plan,
      currency: 'INR',
      status: 'active',
      validityMinutes: 1440,
      priority: plans.length,
    });
    
    if (!ok) {
      console.error(`❌ WiFi plan "${plan.name}" failed (${status}):`, data);
      continue;
    }
    
    const created = data.data || data;
    plans.push({ id: created.id, name: created.name, price: created.price });
    console.log(`  ✅ ${created.name} — ${created.price === 0 ? 'FREE' : `₹${created.price}`}`);
  }
  
  return plans;
}

// ============================================
// 3. CREATE 10 ROOM TYPES
// ============================================
interface RoomType { id: string; name: string; code: string; basePrice: number; wifiPlanId: string; }

const ROOM_TYPES = [
  { name: 'Standard Single', code: 'STD-S', basePrice: 1500, maxAdults: 1, maxChildren: 0, bedType: 'single', bedCount: 1, wifiPlanIdx: 0 },
  { name: 'Standard Double', code: 'STD-D', basePrice: 2500, maxAdults: 2, maxChildren: 1, bedType: 'double', bedCount: 1, wifiPlanIdx: 0 },
  { name: 'Deluxe Room', code: 'DLX', basePrice: 3500, maxAdults: 2, maxChildren: 1, bedType: 'queen', bedCount: 1, wifiPlanIdx: 1 },
  { name: 'Superior Room', code: 'SPR', basePrice: 4500, maxAdults: 2, maxChildren: 2, bedType: 'queen', bedCount: 1, wifiPlanIdx: 2 },
  { name: 'Premium Room', code: 'PRM', basePrice: 6000, maxAdults: 2, maxChildren: 2, bedType: 'king', bedCount: 1, wifiPlanIdx: 3 },
  { name: 'Junior Suite', code: 'JRS', basePrice: 8000, maxAdults: 2, maxChildren: 2, bedType: 'king', bedCount: 1, wifiPlanIdx: 4 },
  { name: 'Executive Suite', code: 'EXS', basePrice: 12000, maxAdults: 3, maxChildren: 2, bedType: 'king', bedCount: 2, wifiPlanIdx: 4 },
  { name: 'Honeymoon Suite', code: 'HNY', basePrice: 15000, maxAdults: 2, maxChildren: 0, bedType: 'king', bedCount: 1, wifiPlanIdx: 5 },
  { name: 'Presidential Suite', code: 'PST', basePrice: 25000, maxAdults: 4, maxChildren: 2, bedType: 'king', bedCount: 2, wifiPlanIdx: 5 },
  { name: 'Penthouse', code: 'PNT', basePrice: 50000, maxAdults: 4, maxChildren: 3, bedType: 'king', bedCount: 2, wifiPlanIdx: 9 },
];

async function createRoomTypes(propertyId: string, wifiPlans: WifiPlan[]): Promise<RoomType[]> {
  console.log('\n🛏️ Creating 10 room types...');
  const roomTypes: RoomType[] = [];
  
  // Check existing room types
  const existingRes = await apiGet(`/api/room-types?propertyId=${propertyId}&limit=100`);
  const existingRTs = (existingRes.data as any)?.data || (existingRes.data as any)?.roomTypes || [];
  const existingRTCodes = new Set(Array.isArray(existingRTs) ? existingRTs.map((rt: any) => rt.code) : []);
  
  for (const rt of ROOM_TYPES) {
    // Skip if room type already exists
    if (existingRTCodes.has(rt.code)) {
      const existing = Array.isArray(existingRTs) ? existingRTs.find((ert: any) => ert.code === rt.code) : null;
      if (existing) {
        roomTypes.push({ id: existing.id, name: existing.name, code: existing.code, basePrice: existing.basePrice, wifiPlanId: existing.wifiPlanId });
        const wifiName = wifiPlans.find(wp => wp.id === existing.wifiPlanId)?.name || 'None';
        console.log(`  ⚡ ${existing.name} (${existing.code}) — ₹${existing.basePrice.toLocaleString()}/night — WiFi: ${wifiName} (existing)`);
        continue;
      }
    }
    
    const wifiPlan = wifiPlans[rt.wifiPlanIdx];
    const { status, data, ok } = await apiPost('/api/room-types', {
      propertyId,
      name: rt.name,
      code: rt.code,
      basePrice: rt.basePrice,
      currency: 'INR',
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      maxOccupancy: rt.maxAdults + rt.maxChildren,
      bedType: rt.bedType,
      bedCount: rt.bedCount,
      wifiPlanId: wifiPlan?.id || null,
      description: `${rt.name} at Skyline Grand Hotel`,
      status: 'active',
      amenities: rt.basePrice >= 12000 
        ? ['minibar', 'safe', 'bathtub', 'balcony', 'city-view', 'work-desk', 'coffee-machine', 'robes']
        : rt.basePrice >= 6000
          ? ['minibar', 'safe', 'bathtub', 'work-desk', 'coffee-machine']
          : ['safe', 'work-desk', 'coffee-machine'],
    });
    
    if (!ok) {
      console.error(`❌ Room type "${rt.name}" failed (${status}):`, data);
      continue;
    }
    
    const created = data.data || data;
    roomTypes.push({ id: created.id, name: created.name, code: created.code, basePrice: created.basePrice, wifiPlanId: created.wifiPlanId });
    const wifiName = wifiPlan ? wifiPlan.name : 'None';
    console.log(`  ✅ ${created.name} (${created.code}) — ₹${created.basePrice.toLocaleString()}/night — WiFi: ${wifiName}`);
  }
  
  return roomTypes;
}

// ============================================
// 4. CREATE 50 ROOMS (5 per room type)
// ============================================
interface Room { id: string; number: string; roomTypeId: string; floor: number; }

async function createRooms(propertyId: string, roomTypes: RoomType[]): Promise<Room[]> {
  console.log('\n🚪 Creating 50 rooms (5 per room type)...');
  const rooms: Room[] = [];
  
  // Check existing rooms for this property (only available ones)
  const existingRes = await apiGet(`/api/rooms?propertyId=${propertyId}&status=available&limit=200`);
  const existingRooms = (existingRes.data as any)?.data || (existingRes.data as any)?.rooms || [];
  const existingRoomNumbers = new Set(Array.isArray(existingRooms) ? existingRooms.map((r: any) => r.number) : []);
  
  for (let i = 0; i < roomTypes.length; i++) {
    const rt = roomTypes[i];
    const floor = i + 1;
    
    for (let j = 1; j <= 5; j++) {
      const number = `${floor}${String(j).padStart(2, '0')}`;
      
      // Skip if room already exists
      if (existingRoomNumbers.has(number)) {
        const existing = Array.isArray(existingRooms) ? existingRooms.find((er: any) => er.number === number) : null;
        if (existing) {
          rooms.push({ id: existing.id, number: existing.number, roomTypeId: existing.roomTypeId, floor: existing.floor || floor });
          continue;
        }
      }
      
      const { status, data, ok } = await apiPost('/api/rooms', {
        propertyId,
        roomTypeId: rt.id,
        number,
        floor,
        name: `${rt.name} ${number}`,
        status: 'available',
      });
      
      if (!ok) {
        console.error(`❌ Room ${number} failed (${status}):`, data);
        continue;
      }
      
      const created = data.data || data;
      rooms.push({ id: created.id, number: created.number, roomTypeId: created.roomTypeId, floor: created.floor || floor });
    }
    
    console.log(`  ✅ Floor ${floor}: ${rt.name} — 5 rooms (${floor}01-${floor}05)`);
  }
  
  console.log(`\n📊 Total rooms created: ${rooms.length}`);
  return rooms;
}

// ============================================
// 5. CREATE 50 GUESTS
// ============================================
interface Guest { id: string; firstName: string; lastName: string; email: string; phone: string; }

const GUEST_DATA = [
  { firstName: 'Aarav', lastName: 'Sharma', email: 'aarav.sharma@email.com' },
  { firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@email.com' },
  { firstName: 'Rohit', lastName: 'Kumar', email: 'rohit.kumar@email.com' },
  { firstName: 'Ananya', lastName: 'Reddy', email: 'ananya.reddy@email.com' },
  { firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@email.com' },
  { firstName: 'Sneha', lastName: 'Gupta', email: 'sneha.gupta@email.com' },
  { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@email.com' },
  { firstName: 'Diya', lastName: 'Nair', email: 'diya.nair@email.com' },
  { firstName: 'Kabir', lastName: 'Joshi', email: 'kabir.joshi@email.com' },
  { firstName: 'Ishita', lastName: 'Das', email: 'ishita.das@email.com' },
  { firstName: 'Dev', lastName: 'Chopra', email: 'dev.chopra@email.com' },
  { firstName: 'Nisha', lastName: 'Verma', email: 'nisha.verma@email.com' },
  { firstName: 'Aditya', lastName: 'Bhat', email: 'aditya.bhat@email.com' },
  { firstName: 'Kavya', lastName: 'Iyer', email: 'kavya.iyer@email.com' },
  { firstName: 'Rahul', lastName: 'Malhotra', email: 'rahul.malhotra@email.com' },
  { firstName: 'Meera', lastName: 'Pillai', email: 'meera.pillai@email.com' },
  { firstName: 'Siddharth', lastName: 'Rao', email: 'siddharth.rao@email.com' },
  { firstName: 'Tanya', lastName: 'Chauhan', email: 'tanya.chauhan@email.com' },
  { firstName: 'Varun', lastName: 'Bansal', email: 'varun.bansal@email.com' },
  { firstName: 'Pooja', lastName: 'Mukherjee', email: 'pooja.mukherjee@email.com' },
  { firstName: 'Karan', lastName: 'Thakur', email: 'karan.thakur@email.com' },
  { firstName: 'Rhea', lastName: 'Deshmukh', email: 'rhea.deshmukh@email.com' },
  { firstName: 'Nikhil', lastName: 'Kulkarni', email: 'nikhil.kulkarni@email.com' },
  { firstName: 'Avani', lastName: 'Shah', email: 'avani.shah@email.com' },
  { firstName: 'Harsh', lastName: 'Pandey', email: 'harsh.pandey@email.com' },
  { firstName: 'Sanya', lastName: 'Rastogi', email: 'sanya.rastogi@email.com' },
  { firstName: 'Akash', lastName: 'Menon', email: 'akash.menon@email.com' },
  { firstName: 'Tara', lastName: 'Agarwal', email: 'tara.agarwal@email.com' },
  { firstName: 'Yash', lastName: 'Trivedi', email: 'yash.trivedi@email.com' },
  { firstName: 'Neha', lastName: 'Choudhary', email: 'neha.choudhary@email.com' },
  { firstName: 'Pranav', lastName: ' Saxena', email: 'pranav.saxena@email.com' },
  { firstName: 'Aisha', lastName: 'Khanna', email: 'aisha.khanna@email.com' },
  { firstName: 'Vivaan', lastName: 'Kapoor', email: 'vivaan.kapoor@email.com' },
  { firstName: 'Riya', lastName: 'Mishra', email: 'riya.mishra@email.com' },
  { firstName: 'Dhruv', lastName: 'Tandon', email: 'dhruv.tandon@email.com' },
  { firstName: 'Sara', lastName: 'Wadhwa', email: 'sara.wadhwa@email.com' },
  { firstName: 'Manav', lastName: 'Bhatt', email: 'manav.bhatt@email.com' },
  { firstName: 'Aanya', lastName: 'Bajaj', email: 'aanya.bajaj@email.com' },
  { firstName: 'Reyansh', lastName: 'Chaturvedi', email: 'reyansh.chaturvedi@email.com' },
  { firstName: 'Mahi', lastName: 'Dutta', email: 'mahi.dutta@email.com' },
  { firstName: 'Vihaan', lastName: 'Goyal', email: 'vihaan.goyal@email.com' },
  { firstName: 'Kriti', lastName: 'Hegde', email: 'kriti.hegde@email.com' },
  { firstName: 'Ayaan', lastName: 'Nayak', email: 'ayaan.nayak@email.com' },
  { firstName: 'Shruti', lastName: 'Puri', email: 'shruti.puri@email.com' },
  { firstName: 'Krishna', lastName: 'Lal', email: 'krishna.lal@email.com' },
  { firstName: 'Anvi', lastName: 'Kaur', email: 'anvi.kaur@email.com' },
  { firstName: 'Shreyas', lastName: 'Chawla', email: 'shreyas.chawla@email.com' },
  { firstName: 'Prisha', lastName: 'Bora', email: 'prisha.bora@email.com' },
  { firstName: 'Atharv', lastName: 'Madhavan', email: 'atharv.madhavan@email.com' },
  { firstName: 'Inaya', lastName: 'Saxena', email: 'inaya.saxena@email.com' },
];

async function createGuests(): Promise<Guest[]> {
  console.log('\n👥 Creating 50 guests...');
  const guests: Guest[] = [];
  
  // Check existing guests
  const existingRes = await apiGet('/api/guests?limit=200');
  const existingGuests = (existingRes.data as any)?.data || (existingRes.data as any)?.guests || [];
  const existingGuestEmails = new Set(Array.isArray(existingGuests) ? existingGuests.map((g: any) => g.email) : []);
  
  for (let i = 0; i < GUEST_DATA.length; i++) {
    const g = GUEST_DATA[i];
    const phone = `+91-${9000000000 + i * 137}`;
    // Skip if guest already exists
    if (existingGuestEmails.has(g.email)) {
      const existing = Array.isArray(existingGuests) ? existingGuests.find((eg: any) => eg.email === g.email) : null;
      if (existing) {
        guests.push({ id: existing.id, firstName: existing.firstName, lastName: existing.lastName, email: existing.email, phone: existing.phone || phone });
        continue;
      }
    }
    
    const { status, data, ok } = await apiPost('/api/guests', {
      ...g,
      phone,
      nationality: 'Indian',
      country: 'India',
      city: 'Mumbai',
      gender: i % 2 === 0 ? 'male' : 'female',
      source: 'direct',
      emailOptIn: true,
      smsOptIn: true,
    });
    
    if (!ok) {
      console.error(`❌ Guest ${g.firstName} ${g.lastName} failed (${status}):`, data);
      continue;
    }
    
    const created = data.data || data;
    guests.push({ id: created.id, firstName: created.firstName, lastName: created.lastName, email: created.email || g.email, phone });
  }
  
  console.log(`📊 Total guests created: ${guests.length}`);
  return guests;
}

// ============================================
// 6. CREATE 50 BOOKINGS + CHECK-IN
// ============================================
interface Booking { id: string; confirmationCode: string; guestName: string; roomTypeName: string; roomNumber: string; nights: number; roomRate: number; totalAmount: number; folioId: string; }

async function createBookingsAndCheckIn(
  propertyId: string,
  guests: Guest[],
  roomTypes: RoomType[],
  rooms: Room[],
): Promise<Booking[]> {
  console.log('\n📋 Creating 50 bookings with varied room types and stay lengths...');
  
  // Warmup: trigger Turbopack to compile the bookings POST route
  console.log('  🔥 Warming up booking route (POST)...');
  const warmupRoom = rooms[0];
  const warmupGuest = guests[0];
  await apiPost('/api/bookings', {
    propertyId,
    primaryGuestId: warmupGuest.id,
    roomTypeId: warmupRoom.roomTypeId,
    roomId: warmupRoom.id,
    checkIn: new Date(Date.now() + 86400000 * 3).toISOString(),
    checkOut: new Date(Date.now() + 86400000 * 4).toISOString(),
    adults: 1, children: 0,
    roomRate: 1000, totalAmount: 1000,
    currency: 'INR',
  }, 0); // 0 retries for warmup, don't care if it fails
  console.log('  ✅ Booking route warmed up');
  await new Promise(r => setTimeout(r, 3000)); // Wait for compilation to fully settle
  
  const bookings: Booking[] = [];
  
  // Available rooms tracker
  const availableRooms = [...rooms];
  
  // Group rooms by room type for efficient lookup
  const roomsByType = new Map<string, Room[]>();
  for (const r of availableRooms) {
    const list = roomsByType.get(r.roomTypeId) || [];
    list.push(r);
    roomsByType.set(r.roomTypeId, list);
  }
  
  const today = new Date();
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const istToday = new Date(today.getTime() + IST_OFFSET);
  
  for (let i = 0; i < Math.min(guests.length, 50); i++) {
    const guest = guests[i];
    const roomTypeIdx = i % roomTypes.length;
    const rt = roomTypes[roomTypeIdx];
    const nights = 1 + (i % 5); // 1-5 nights
    const adults = Math.min(rt.maxAdults, Math.max(1, 1 + (i % 3)));
    const children = rt.maxChildren > 0 ? Math.min(rt.maxChildren, (i % 2)) : 0;
    
    // Find an available room for this room type
    const typeRooms = roomsByType.get(rt.id);
    if (!typeRooms || typeRooms.length === 0) {
      console.log(`  ⚠️ No available rooms for ${rt.name}, skipping guest ${i + 1}`);
      continue;
    }
    const room = typeRooms.shift()!;
    
    // Check-in dates spread across today and tomorrow
    const checkInOffset = i < 25 ? 0 : 1;
    const checkInDate = new Date(istToday);
    checkInDate.setDate(checkInDate.getDate() + checkInOffset);
    checkInDate.setHours(14, 0, 0, 0);
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + nights);
    checkOutDate.setHours(11, 0, 0, 0);
    
    // Calculate expected totals
    const roomRatePerNight = rt.basePrice;
    const subtotal = roomRatePerNight * nights;
    const gstRate = 18;
    const serviceChargeRate = 5;
    const gstAmount = Math.round(subtotal * gstRate) / 100;
    const serviceCharge = Math.round(subtotal * serviceChargeRate) / 100;
    const totalAmount = subtotal + gstAmount + serviceCharge;
    
    // Create booking
    const bookingPayload = {
      propertyId,
      primaryGuestId: guest.id,
      roomTypeId: rt.id,
      roomId: room.id,
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      adults,
      children,
      roomRate: roomRatePerNight,
      totalAmount,
      currency: 'INR',
      source: 'direct',
      status: 'confirmed',
      specialRequests: `Guest ${i + 1} - ${nights} night${nights > 1 ? 's' : ''} stay`,
    };
    
    // Add delay between bookings to avoid overwhelming Turbopack
    await new Promise(r => setTimeout(r, 300));
    
    const { status, data, ok } = await apiPost('/api/bookings', bookingPayload, 1); // 1 retry
    
    if (!ok) {
      const errMsg = (data as any)?.error?.message || (data as any)?.error?.code || JSON.stringify(data);
      console.error(`❌ Booking ${i + 1} failed (${status}): ${errMsg}`);
      // Put room back
      typeRooms.unshift(room);
      if (status >= 500) {
        await new Promise(r => setTimeout(r, 2000)); // Wait for Turbopack/server recovery
      }
      continue;
    }
    
    // Add delay between bookings to avoid overwhelming Turbopack
    await new Promise(r => setTimeout(r, 500));
    
    const booking = data.data || data.booking || data;
    bookings.push({
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      guestName: `${guest.firstName} ${guest.lastName}`,
      roomTypeName: rt.name,
      roomNumber: room.number,
      nights,
      roomRate: roomRatePerNight,
      totalAmount,
      folioId: booking.folioId || '',
    });
    
    if ((i + 1) % 10 === 0 || i === guests.length - 1) {
      console.log(`  ✅ ${i + 1} bookings created...`);
    }
  }
  
  console.log(`\n📊 Total bookings created: ${bookings.length}`);
  return bookings;
}

// ============================================
// 7. CHECK-IN ALL BOOKINGS
// ============================================
async function checkInBookings(bookings: Booking[]): Promise<void> {
  console.log('\n🔑 Checking in all bookings...');
  let checkedIn = 0;
  let failed = 0;
  
  for (const b of bookings) {
    const { status, data, ok } = await apiPut(`/api/bookings/${b.id}`, { status: 'checked_in' });
    
    if (!ok) {
      console.error(`❌ Check-in failed for ${b.confirmationCode} (${b.guestName}, Room ${b.roomNumber}): ${status}`, data);
      failed++;
      // Small delay to avoid overwhelming the server
      await new Promise(r => setTimeout(r, 100));
      continue;
    }
    
    checkedIn++;
    // Update folioId from response if available
    const updated = data.data || data;
    if (updated.folio?.id) b.folioId = updated.folio.id;
    
    if (checkedIn % 10 === 0) {
      console.log(`  ✅ ${checkedIn} checked in...`);
    }
    
    // Small delay between check-ins
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`\n📊 Check-in results: ✅ ${checkedIn} success, ❌ ${failed} failed`);
}

// ============================================
// 8. COLLECT PAYMENTS (CASH) FOR ALL BOOKINGS
// ============================================
async function collectPayments(bookings: Booking[]): Promise<void> {
  console.log('\n💰 Collecting payments (cash) for all bookings...');
  let paid = 0;
  let failed = 0;
  
  for (const b of bookings) {
    if (!b.folioId) {
      // Try to find folio from booking
      const { data } = await apiGet(`/api/bookings/${b.id}`);
      const booking = data.data || data;
      const folio = booking.folio || booking.folios?.[0];
      if (folio?.id) {
        b.folioId = folio.id;
      } else {
        console.error(`❌ No folio for booking ${b.confirmationCode}`);
        failed++;
        continue;
      }
    }
    
    const { status, data, ok } = await apiPost('/api/payments', {
      folioId: b.folioId,
      amount: b.totalAmount,
      method: 'cash',
      currency: 'INR',
      description: `Cash payment at check-in - Room ${b.roomNumber}`,
      status: 'completed',
    });
    
    if (!ok) {
      console.error(`❌ Payment failed for ${b.confirmationCode} (${status}):`, data);
      failed++;
    } else {
      paid++;
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`\n📊 Payment results: ✅ ${paid} paid, ❌ ${failed} failed`);
}

// ============================================
// 9. VERIFY FOLIOS AND INVOICES
// ============================================
async function verifyBilling(bookings: Booking[], propertyId: string): Promise<void> {
  console.log('\n🧾 Verifying folios and billing data...\n');
  
  // Get all folios for this property
  const { data: foliosData } = await apiGet(`/api/folios?propertyId=${propertyId}&limit=100`);
  const folios = foliosData.data || foliosData.folios || foliosData;
  const foliosList = Array.isArray(folios) ? folios : [];
  
  console.log(`📊 Total folios for property: ${foliosList.length}`);
  
  // Sample check: first 5 folios
  for (let i = 0; i < Math.min(5, foliosList.length); i++) {
    const f = foliosList[i];
    console.log(`\n  📋 Folio ${f.folioNumber || f.id}:`);
    console.log(`     Status: ${f.status}`);
    console.log(`     Subtotal: ₹${f.subtotal?.toLocaleString?.() || f.subtotal}`);
    console.log(`     Taxes: ₹${f.taxes?.toLocaleString?.() || f.taxes}`);
    console.log(`     Total: ₹${f.totalAmount?.toLocaleString?.() || f.totalAmount}`);
    console.log(`     Paid: ₹${f.paidAmount?.toLocaleString?.() || f.paidAmount}`);
    console.log(`     Balance: ₹${f.balance?.toLocaleString?.() || f.balance}`);
    console.log(`     Currency: ${f.currency}`);
    
    // Verify math: balance should equal totalAmount - paidAmount
    const expectedBalance = (f.totalAmount || 0) - (f.paidAmount || 0);
    const actualBalance = Math.round((f.balance || 0) * 100) / 100;
    const expectedRounded = Math.round(expectedBalance * 100) / 100;
    if (Math.abs(actualBalance - expectedRounded) > 0.02) {
      console.log(`     ⚠️ BALANCE MISMATCH: expected ₹${expectedRounded}, got ₹${actualBalance}`);
    } else {
      console.log(`     ✅ Balance verified`);
    }
  }
  
  // Check invoices
  const { data: invoicesData } = await apiGet(`/api/invoices?limit=20`);
  const invoices = invoicesData.data || invoicesData.invoices || [];
  const invoicesList = Array.isArray(invoices) ? invoices : [];
  
  console.log(`\n📊 Total invoices: ${invoicesList.length}`);
  
  // Property-level stats
  const { data: statsData } = await apiGet(`/api/dashboard`);
  const stats = statsData.data || statsData;
  console.log(`\n📊 Dashboard stats:`);
  console.log(`     Today's check-ins: ${stats.todaysCheckIns ?? stats.todaysCheckins ?? 'N/A'}`);
  console.log(`     Total rooms: ${stats.totalRooms ?? 'N/A'}`);
  console.log(`     Occupied: ${stats.occupiedRooms ?? stats.occupied ?? 'N/A'}`);
  console.log(`     Available: ${stats.availableRooms ?? stats.available ?? 'N/A'}`);
  
  // Room status
  const { data: roomStatusData } = await apiGet(`/api/dashboard/room-status`);
  const roomStatus = roomStatusData.data || roomStatusData;
  console.log(`\n📊 Room status breakdown:`);
  if (Array.isArray(roomStatus)) {
    for (const rs of roomStatus) {
      console.log(`     ${rs.status || rs.name}: ${rs.count}`);
    }
  } else if (roomStatus.statusCounts) {
    for (const [status, count] of Object.entries(roomStatus.statusCounts)) {
      console.log(`     ${status}: ${count}`);
    }
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     STAYSUITE FULL CYCLE INTEGRATION TEST           ║');
  console.log('║     Property → Rooms → WiFi → Guests → Bookings    ║');
  console.log('║     → Check-in → Folio → Payments → Invoices         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  try {
    // Step 1: Login
    await login();
    
    // Step 2: Create property
    const property = await createProperty();
    
    // Step 3: Create WiFi plans
    const wifiPlans = await createWifiPlans();
    if (wifiPlans.length < 10) {
      console.error(`⚠️ Only ${wifiPlans.length}/10 WiFi plans created, some may have failed`);
    }
    
    // Step 4: Create room types with WiFi mapping
    const roomTypes = await createRoomTypes(property.id, wifiPlans);
    if (roomTypes.length < 10) {
      console.error(`⚠️ Only ${roomTypes.length}/10 room types created`);
    }
    
    // Step 5: Create rooms
    const rooms = await createRooms(property.id, roomTypes);
    if (rooms.length < 50) {
      console.error(`⚠️ Only ${rooms.length}/50 rooms created`);
    }
    
    // Step 6: Create guests
    const guests = await createGuests();
    if (guests.length < 50) {
      console.error(`⚠️ Only ${guests.length}/50 guests created`);
    }
    
    // Step 7: Create bookings
    const bookings = await createBookingsAndCheckIn(property.id, guests, roomTypes, rooms);
    
    // Step 8: Check-in all bookings
    await checkInBookings(bookings);
    
    // Step 9: Collect payments
    await collectPayments(bookings);
    
    // Step 10: Verify billing
    await verifyBilling(bookings, property.id);
    
    console.log('\n\n✅ ═════════════════════════════════════════════════════════');
    console.log('✅  FULL CYCLE TEST COMPLETE');
    console.log('✅ ═════════════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`  Property: ${property.name}`);
    console.log(`  Room Types: ${roomTypes.length}`);
    console.log(`  Rooms: ${rooms.length}`);
    console.log(`  WiFi Plans: ${wifiPlans.length}`);
    console.log(`  Guests: ${guests.length}`);
    console.log(`  Bookings: ${bookings.length}`);
    console.log('');
    
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
  }
}

main();
