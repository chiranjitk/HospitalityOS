/**
 * Prisma-based booking creation + API-based check-in and payments
 * Uses Prisma directly for booking creation to bypass Turbopack compilation issues
 * Uses API for check-in, payments, and verification
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = 'http://localhost:3000';
let sessionToken = '';

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@royalstay.in', password: 'admin123', rememberMe: true }),
    redirect: 'manual',
  });
  const match = (res.headers.get('set-cookie') || '').match(/session_token=([^;]+)/);
  sessionToken = match![1];
  console.log('🔐 Logged in');
  return sessionToken;
}

async function api(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', 'Cookie': `session_token=${sessionToken}`, ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json, ok: res.ok };
}

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';
const PROPERTY_ID = '9f77b950-74b6-48d9-a83e-ad1da41d9720';

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     BOOKING CREATION + CHECK-IN + BILLING TEST           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await login();

  // Get all room types for this property
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: PROPERTY_ID, status: 'active' },
    orderBy: { basePrice: 'asc' },
  });
  console.log(`\n🛏️ Found ${roomTypes.length} room types`);

  // Get all available rooms
  let rooms = await prisma.room.findMany({
    where: { propertyId: PROPERTY_ID, status: 'available' },
    orderBy: { number: 'asc' },
  });
  
  // If no available rooms (from previous test runs), reset occupied rooms
  if (rooms.length === 0) {
    console.log('  ⚠️ No available rooms. Resetting occupied rooms from previous runs...');
    const result = await prisma.room.updateMany({
      where: { 
        propertyId: PROPERTY_ID, 
        status: { in: ['reserved', 'occupied'] }
      },
      data: { status: 'available', housekeepingStatus: 'clean' },
    });
    console.log(`  ✅ Reset ${result.count} rooms to available`);
    rooms = await prisma.room.findMany({
      where: { propertyId: PROPERTY_ID, status: 'available' },
      orderBy: { number: 'asc' },
    });
  }
  
  console.log(`🚪 Found ${rooms.length} available rooms`);

  // Get all guests (created by previous script)
  const guests = await prisma.guest.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`👥 Found ${guests.length} guests`);

  // Group rooms by room type
  const roomsByType = new Map();
  for (const r of rooms) {
    const list = roomsByType.get(r.roomTypeId) || [];
    list.push(r);
    roomsByType.set(r.roomTypeId, list);
  }

  // Get property for tax/service charge calculation
  const property = await prisma.property.findUnique({ where: { id: PROPERTY_ID } });
  const taxRate = property?.defaultTaxRate || 18;
  const serviceChargeRate = property?.serviceChargePercent || 5;

  const today = new Date();
  today.setHours(14, 0, 0, 0);

  // Create 50 bookings
  const bookings = [];
  console.log('\n📋 Creating 50 bookings...');
  
  for (let i = 0; i < Math.min(guests.length, 50); i++) {
    const guest = guests[i];
    const rtIdx = i % roomTypes.length;
    const rt = roomTypes[rtIdx];
    const nights = 1 + (i % 5);
    const adults = Math.min(rt.maxAdults, Math.max(1, 1 + (i % 3)));
    const children = rt.maxChildren > 0 ? Math.min(rt.maxChildren, i % 2) : 0;

    // Find available room
    const typeRooms = roomsByType.get(rt.id);
    if (!typeRooms || typeRooms.length === 0) continue;
    const room = typeRooms.shift()!;

    const checkIn = new Date(today);
    checkIn.setDate(checkIn.getDate() + (i < 25 ? 0 : 1));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    checkOut.setHours(11, 0, 0, 0);

    // Price calculation
    const subtotal = rt.basePrice * nights;
    const gst = Math.round(subtotal * taxRate) / 100;
    const svc = Math.round(subtotal * serviceChargeRate) / 100;
    const totalAmount = subtotal + gst + svc;

    try {
      // Generate confirmation code
      const codes = await prisma.booking.findMany({
        where: { confirmationCode: { startsWith: 'SGH' } },
        select: { confirmationCode: true },
        orderBy: { confirmationCode: 'desc' },
        take: 1,
      });
      const lastNum = codes[0] ? parseInt(codes[0].confirmationCode.replace('SGH-', '')) : 0;
      const confirmationCode = `SGH-${String(lastNum + 1).padStart(6, '0')}`;

      const booking = await prisma.booking.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          confirmationCode,
          primaryGuestId: guest.id,
          roomId: room.id,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          adults,
          children,
          infants: 0,
          roomRate: rt.basePrice,
          taxes: gst,
          fees: svc,
          discount: 0,
          totalAmount,
          currency: 'INR',
          source: 'direct',
          status: 'confirmed',
          specialRequests: `${nights} night stay - ${rt.name}`,
        },
      });

      // Update room status
      await prisma.room.update({
        where: { id: room.id },
        data: { status: 'reserved' },
      });

      bookings.push({
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        guestName: `${guest.firstName} ${guest.lastName}`,
        roomNumber: room.number,
        roomTypeName: rt.name,
        nights,
        totalAmount,
        roomRate: rt.basePrice,
      });

      if ((i + 1) % 10 === 0) console.log(`  ✅ ${i + 1}/50 bookings created`);
    } catch (err: any) {
      console.error(`  ❌ Booking ${i + 1} failed: ${err.message?.substring(0, 80)}`);
      typeRooms.unshift(room); // Put room back
    }
  }

  console.log(`\n📊 Bookings created: ${bookings.length}/${Math.min(guests.length, 50)}`);

  // Check-in all bookings via API
  console.log('\n🔑 Checking in all bookings via API...');
  let checkedIn = 0;
  for (const b of bookings) {
    const { status, data, ok } = await api(`/api/bookings/${b.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'checked_in' }),
    });
    if (ok) {
      checkedIn++;
      const updated = data.data || data;
      if (updated.folio?.id) b.folioId = updated.folio.id;
      // Also update room info
      if (updated.room?.number) b.roomNumber = updated.room.number;
    } else {
      console.error(`  ❌ Check-in failed for ${b.confirmationCode}: ${status}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`  ✅ ${checkedIn} checked in`);

  // Collect payments via API
  console.log('\n💰 Collecting payments...');
  console.log('  🔥 Warming up payments route...');
  // Warmup: trigger compilation of payments route
  if (bookings.length > 0 && bookings[0].folioId) {
    await api(`/api/payments?folioId=${bookings[0].folioId}&limit=1`);
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log('  ✅ Payments route warmed up');
  
  let paid = 0;
  for (const b of bookings) {
    if (!b.folioId) {
      // Get folio from booking
      const { data } = await api(`/api/bookings/${b.id}`);
      const booking = data.data || data;
      b.folioId = booking.folio?.id || booking.folios?.[0]?.id;
    }
    if (!b.folioId) {
      // Debug: check what's in the booking
      const { data: bData } = await api(`/api/bookings/${b.id}`);
      const bk = bData.data || bData;
      console.log(`  ⚠️ No folioId for ${b.confirmationCode}. Booking data:`, JSON.stringify({
        hasFolio: !!bk.folio, foliosCount: bk.folios?.length, folioId: bk.folio?.id,
        paymentsCount: bk.payments?.length, bookingStatus: bk.status,
      }));
      continue;
    }

    console.log(`  💰 Paying ₹${b.totalAmount} for ${b.confirmationCode} (Folio: ${b.folioId?.substring(0,12)}...)`);

    const { status, ok, data: payData } = await api(`/api/payments`, {
      method: 'POST',
      body: JSON.stringify({
        folioId: b.folioId,
        amount: b.totalAmount,
        method: 'cash',
        currency: 'INR',
        description: `Cash payment at check-in - ${b.roomNumber}`,
        status: 'completed',
      }),
    });
    if (ok) {
      paid++;
    } else {
      console.error(`  ❌ Payment failed for ${b.confirmationCode}: ${status}`, (payData as any)?.error?.message || '');
    }
    await new Promise(r => setTimeout(r, 500)); // Longer delay for Turbopack stability
  }
  console.log(`  ✅ ${paid} payments collected`);

  // Verify folios
  console.log('\n🧾 Verifying billing...');
  const folios = await prisma.folio.findMany({
    where: { propertyId: PROPERTY_ID },
    include: { lineItems: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });

  let totalRevenue = 0;
  for (const f of folios.slice(0, 10)) {
    const bal = Math.round((f.totalAmount - f.paidAmount) * 100) / 100;
    totalRevenue += f.paidAmount || 0;
    console.log(`  📋 ${f.folioNumber}: Total ₹${f.totalAmount?.toLocaleString?.() || 0}, Paid ₹${f.paidAmount?.toLocaleString?.() || 0}, Balance ₹${bal?.toLocaleString?.() || 0}, Items: ${f.lineItems?.length || 0}`);
  }
  console.log(`\n💰 Total Revenue Collected: ₹${totalRevenue.toLocaleString()}`);

  // Summary
  console.log('\n✅ ═════════════════════════════════════════════════════════');
  console.log(`  Bookings: ${bookings.length}`);
  console.log(`  Checked-in: ${checkedIn}`);
  console.log(`  Payments: ${paid}`);
  console.log(`  Total Revenue: ₹${totalRevenue.toLocaleString()}`);
  console.log('✅ ═════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
