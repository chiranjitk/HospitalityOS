/**
 * Comprehensive seed script: Creates bookings, folios, and all dependent records.
 * Fixes seed-fix.ts bugs (guestId doesn't exist on Booking, roomId required on LaundryOrder).
 *
 * Run:
 *   cd /home/z/my-project && DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/staysuite" npx tsx prisma/seed-final.ts
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Deterministic UUID generation — MUST match existing seed scripts exactly
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31),
  ].join('-');
};

const today = new Date();
const d = (daysAgo: number) => new Date(today.getTime() - daysAgo * 864e5);

async function main() {
  console.log('======================================================');
  console.log('  StaySuite Comprehensive Seed — Final');
  console.log('======================================================\n');

  // ── 0. Query actual IDs from database ───────────────────────
  console.log('0. Querying existing data from database...');

  const tenant = await prisma.tenant.findFirst({ where: { name: { contains: 'Royal' } } });
  if (!tenant) { console.error('  FATAL: No Royal tenant found'); process.exit(1); }
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  const properties = await prisma.property.findMany({ where: { tenantId: tenant.id } });
  let prop = properties[0];
  for (const p of properties) {
    const rc = await prisma.room.count({ where: { propertyId: p.id } });
    if (rc > 0) { prop = p; break; }
  }
  if (!prop) { console.error('  FATAL: No property with rooms found'); process.exit(1); }
  console.log(`  Property: ${prop.name} (${prop.id})`);

  const guests = await prisma.guest.findMany({ where: { tenantId: tenant.id }, take: 6, orderBy: { firstName: 'asc' } });
  console.log(`  Guests: ${guests.length} found`);
  for (let i = 0; i < guests.length; i++) {
    console.log(`    guest-${i + 1}: ${guests[i].firstName} ${guests[i].lastName} (${guests[i].id})`);
  }

  const rooms = await prisma.room.findMany({ where: { propertyId: prop.id }, take: 10, orderBy: { number: 'asc' } });
  console.log(`  Rooms: ${rooms.length} found (first 10)`);
  for (let i = 0; i < Math.min(rooms.length, 10); i++) {
    console.log(`    room-${i + 1}: ${rooms[i].number} (${rooms[i].id}) type=${rooms[i].roomTypeId}`);
  }

  const roomTypes = await prisma.roomType.findMany({ where: { propertyId: prop.id }, take: 4, orderBy: { name: 'asc' } });
  console.log(`  Room Types: ${roomTypes.length} found`);

  const users = await prisma.user.findMany({ where: { tenantId: tenant.id }, take: 3 });
  console.log(`  Users: ${users.length} found\n`);

  // Helper: find room by roomNumber or return first room
  const findRoom = (num: string) => rooms.find(r => r.number === num) || rooms[0];

  // ── 1. Create Bookings ──────────────────────────────────────
  console.log('1. Creating/upserting bookings (6)...');

  const bookingData = [
    {
      id: uuid('booking-1'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-001',
      primaryGuestId: guests[0]?.id, roomId: findRoom('501')?.id || rooms[0]?.id,
      roomTypeId: findRoom('501')?.roomTypeId || roomTypes[0]?.id,
      checkIn: d(3), checkOut: new Date(today.getTime() + 864e5),
      adults: 2, children: 0, roomRate: 5500, taxes: 990, fees: 500,
      totalAmount: 17990, currency: 'INR', source: 'direct', status: 'checked_in',
      actualCheckIn: d(3),
    },
    {
      id: uuid('booking-2'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-002',
      primaryGuestId: guests[1]?.id, roomId: findRoom('801')?.id || rooms[1]?.id,
      roomTypeId: findRoom('801')?.roomTypeId || roomTypes[1]?.id,
      checkIn: d(2), checkOut: new Date(today.getTime() + 3 * 864e5),
      adults: 2, children: 1, roomRate: 12000, taxes: 2160, fees: 1000,
      totalAmount: 53160, currency: 'INR', source: 'direct', status: 'checked_in',
      actualCheckIn: d(2),
    },
    {
      id: uuid('booking-3'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-003',
      primaryGuestId: guests[2]?.id, roomId: findRoom('510')?.id || rooms[2]?.id,
      roomTypeId: findRoom('510')?.roomTypeId || roomTypes[0]?.id,
      checkIn: d(1), checkOut: new Date(today.getTime() + 4 * 864e5),
      adults: 2, children: 1, roomRate: 5500, taxes: 990, fees: 500,
      totalAmount: 23490, currency: 'INR', source: 'booking_com', status: 'checked_in',
      actualCheckIn: d(1),
    },
    {
      id: uuid('booking-4'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-004',
      primaryGuestId: guests[3]?.id, roomId: findRoom('1002')?.id || rooms[3]?.id,
      roomTypeId: findRoom('1002')?.roomTypeId || roomTypes[3]?.id,
      checkIn: d(1), checkOut: new Date(today.getTime() + 4 * 864e5),
      adults: 2, children: 0, roomRate: 35000, taxes: 6300, fees: 2500,
      totalAmount: 113800, currency: 'INR', source: 'direct', status: 'checked_in',
      actualCheckIn: d(1),
    },
    {
      id: uuid('booking-5'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-005',
      primaryGuestId: guests[4]?.id, roomId: findRoom('101')?.id || rooms[4]?.id,
      roomTypeId: findRoom('101')?.roomTypeId || roomTypes[0]?.id,
      checkIn: d(5), checkOut: d(0),
      adults: 1, children: 0, roomRate: 3500, taxes: 630, fees: 300,
      totalAmount: 11430, currency: 'INR', source: 'airbnb', status: 'checked_out',
      actualCheckIn: d(5), actualCheckOut: d(0), checkedOutBy: users[0]?.id,
    },
    {
      id: uuid('booking-6'), tenantId: tenant.id, propertyId: prop.id,
      confirmationCode: 'RS-2024-006',
      primaryGuestId: guests[5]?.id, roomId: findRoom('305')?.id || rooms[5]?.id,
      roomTypeId: findRoom('305')?.roomTypeId || roomTypes[0]?.id,
      checkIn: d(4), checkOut: new Date(today.getTime() + 2 * 864e5),
      adults: 2, children: 0, roomRate: 3500, taxes: 630, fees: 300,
      totalAmount: 16500, currency: 'INR', source: 'referral', status: 'checked_in',
      actualCheckIn: d(4),
    },
  ];

  let bookingsCreated = 0;
  for (const bd of bookingData) {
    try {
      await prisma.booking.upsert({
        where: { confirmationCode: bd.confirmationCode },
        update: {}, // don't overwrite existing data
        create: bd,
      });
      bookingsCreated++;
      console.log(`  [OK] ${bd.confirmationCode} (${bd.status}, guest=${bd.primaryGuestId?.slice(0, 8)})`);
    } catch (e: any) {
      console.log(`  [FAIL] ${bd.confirmationCode}: ${e.message}`);
      // Log full error for debugging
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Bookings created/upserted: ${bookingsCreated}/6\n`);

  // ── 2. Create Folios ────────────────────────────────────────
  console.log('2. Creating/upserting folios (6)...');

  const folioData = [
    {
      id: uuid('folio-1'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-1'), folioNumber: 'FOL-KOL-0001',
      guestId: guests[0]?.id,
      subtotal: 16500, taxes: 2970, discount: 0,
      totalAmount: 20970, paidAmount: 10000, balance: 10970,
      currency: 'INR', status: 'open',
      openedAt: d(3),
    },
    {
      id: uuid('folio-2'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-2'), folioNumber: 'FOL-KOL-0002',
      guestId: guests[1]?.id,
      subtotal: 48000, taxes: 8640, discount: 2000,
      totalAmount: 58640, paidAmount: 58640, balance: 0,
      currency: 'INR', status: 'open',
      openedAt: d(2),
    },
    {
      id: uuid('folio-3'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-3'), folioNumber: 'FOL-KOL-0003',
      guestId: guests[2]?.id,
      subtotal: 5500, taxes: 990, discount: 0,
      totalAmount: 6490, paidAmount: 0, balance: 6490,
      currency: 'INR', status: 'open',
      openedAt: d(1),
    },
    {
      id: uuid('folio-4'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-4'), folioNumber: 'FOL-KOL-0004',
      guestId: guests[3]?.id,
      subtotal: 45000, taxes: 8100, discount: 2000,
      totalAmount: 51100, paidAmount: 20000, balance: 31100,
      currency: 'INR', status: 'open',
      openedAt: d(1),
    },
    {
      id: uuid('folio-5'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-5'), folioNumber: 'FOL-KOL-0005',
      guestId: guests[4]?.id,
      subtotal: 10500, taxes: 1890, discount: 0,
      totalAmount: 12390, paidAmount: 12390, balance: 0,
      currency: 'INR', status: 'closed',
      openedAt: d(5), closedAt: d(0),
    },
    {
      id: uuid('folio-6'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-6'), folioNumber: 'FOL-KOL-0006',
      guestId: guests[5]?.id,
      subtotal: 5500, taxes: 990, discount: 0,
      totalAmount: 6490, paidAmount: 2000, balance: 4490,
      currency: 'INR', status: 'open',
      openedAt: d(4),
    },
  ];

  let foliosCreated = 0;
  for (const fd of folioData) {
    try {
      await prisma.folio.upsert({
        where: { folioNumber: fd.folioNumber },
        update: {},
        create: fd,
      });
      foliosCreated++;
      console.log(`  [OK] ${fd.folioNumber} (${fd.status}, balance=${fd.balance})`);
    } catch (e: any) {
      console.log(`  [FAIL] ${fd.folioNumber}: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Folios created/upserted: ${foliosCreated}/6\n`);

  // ── 3. Create Scheduled Charges ─────────────────────────────
  console.log('3. Creating/upserting scheduled charges (6)...');

  const scData = [
    {
      id: uuid('sc-1'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-1'), bookingId: uuid('booking-1'),
      chargeType: 'room_charge', description: 'Daily room charge - Deluxe 501',
      category: 'Room', amount: 5500, currency: 'INR', frequency: 'daily',
      startDate: d(3), endDate: new Date(today.getTime() + 864e5),
      nextExecutionAt: new Date(today.getTime() + 864e5),
      lastExecutedAt: today, isActive: true, executedCount: 2,
    },
    {
      id: uuid('sc-2'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-1'), bookingId: uuid('booking-1'),
      chargeType: 'resort_fee', description: 'Resort fee - pool, gym, WiFi',
      category: 'Service', amount: 500, currency: 'INR', frequency: 'daily',
      startDate: d(3), endDate: new Date(today.getTime() + 864e5),
      nextExecutionAt: new Date(today.getTime() + 864e5),
      lastExecutedAt: today, isActive: true, executedCount: 2,
    },
    {
      id: uuid('sc-3'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-3'), bookingId: uuid('booking-3'),
      chargeType: 'room_charge', description: 'Daily room charge - Deluxe 510',
      category: 'Room', amount: 5500, currency: 'INR', frequency: 'daily',
      startDate: today, endDate: new Date(today.getTime() + 4 * 864e5),
      nextExecutionAt: new Date(today.getTime() + 864e5), isActive: true,
    },
    {
      id: uuid('sc-4'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-2'), bookingId: uuid('booking-2'),
      chargeType: 'minibar', description: 'Daily minibar restocking fee',
      category: 'F&B', amount: 200, currency: 'INR', frequency: 'daily',
      startDate: d(2), endDate: new Date(today.getTime() + 3 * 864e5),
      nextExecutionAt: new Date(today.getTime() + 864e5),
      lastExecutedAt: today, isActive: true, executedCount: 1,
    },
    {
      id: uuid('sc-5'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-1'), bookingId: uuid('booking-1'),
      chargeType: 'incidentals', description: 'Extra bed charge',
      category: 'Room', amount: 1500, currency: 'INR', frequency: 'once',
      startDate: d(3), nextExecutionAt: d(3), lastExecutedAt: d(3),
      isActive: false, executedCount: 1, maxAmount: 1500,
    },
    {
      id: uuid('sc-6'), tenantId: tenant.id, propertyId: prop.id,
      folioId: uuid('folio-4'), bookingId: uuid('booking-4'),
      chargeType: 'resort_fee', description: 'Presidential Suite amenity fee',
      category: 'Service', amount: 2000, currency: 'INR', frequency: 'daily',
      startDate: today, endDate: new Date(today.getTime() + 2 * 864e5),
      nextExecutionAt: new Date(today.getTime() + 864e5), isActive: true,
    },
  ];

  let scCreated = 0;
  for (const sc of scData) {
    try {
      await prisma.scheduledCharge.upsert({
        where: { id: sc.id },
        update: {},
        create: sc,
      });
      scCreated++;
      console.log(`  [OK] ${sc.description} (${sc.frequency}, ${sc.amount} INR)`);
    } catch (e: any) {
      console.log(`  [FAIL] ${sc.description}: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Scheduled charges created/upserted: ${scCreated}/6\n`);

  // ── 4. Create Minibar Consumptions ──────────────────────────
  console.log('4. Creating/upserting minibar consumptions (5)...');

  const mcData = [
    {
      id: uuid('mbcons-1'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-1'), folioId: uuid('folio-1'),
      roomId: findRoom('501')?.id || rooms[0]?.id,
      itemId: uuid('mbitem-3'), itemName: 'Kingfisher Beer 330ml',
      quantity: 2, unitPrice: 180, totalPrice: 360,
      consumedAt: d(1), postedToFolio: true, postedAt: d(1),
      consumedBy: 'Guest',
    },
    {
      id: uuid('mbcons-2'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-1'), folioId: uuid('folio-1'),
      roomId: findRoom('501')?.id || rooms[0]?.id,
      itemId: uuid('mbitem-7'), itemName: 'Mixed Nuts Pack',
      quantity: 1, unitPrice: 200, totalPrice: 200,
      consumedAt: new Date(today.getTime() - 12 * 36e5), postedToFolio: false,
      consumedBy: 'Guest',
    },
    {
      id: uuid('mbcons-3'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-2'), folioId: uuid('folio-2'),
      roomId: findRoom('801')?.id || rooms[1]?.id,
      itemId: uuid('mbitem-9'), itemName: 'Johnnie Walker Red Label 50ml',
      quantity: 1, unitPrice: 450, totalPrice: 450,
      consumedAt: new Date(today.getTime() - 8 * 36e5),
      postedToFolio: true, postedAt: new Date(today.getTime() - 8 * 36e5),
      consumedBy: 'Guest',
    },
    {
      id: uuid('mbcons-4'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-2'), folioId: uuid('folio-2'),
      roomId: findRoom('801')?.id || rooms[1]?.id,
      itemId: uuid('mbitem-10'), itemName: 'Champagne Mini 187ml',
      quantity: 1, unitPrice: 1200, totalPrice: 1200,
      consumedAt: new Date(today.getTime() - 10 * 36e5),
      postedToFolio: true, postedAt: new Date(today.getTime() - 10 * 36e5),
      consumedBy: 'Guest',
    },
    {
      id: uuid('mbcons-5'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-6'), folioId: uuid('folio-6'),
      roomId: findRoom('305')?.id || rooms[5]?.id,
      itemId: uuid('mbitem-1'), itemName: 'Coca-Cola Can',
      quantity: 1, unitPrice: 80, totalPrice: 80,
      consumedAt: d(2), postedToFolio: true, postedAt: d(2),
      consumedBy: 'Guest',
    },
  ];

  let mcCreated = 0;
  for (const mc of mcData) {
    try {
      await prisma.minibarConsumption.upsert({
        where: { id: mc.id },
        update: {},
        create: mc,
      });
      mcCreated++;
      console.log(`  [OK] ${mc.itemName} x${mc.quantity} (${mc.totalPrice} INR)`);
    } catch (e: any) {
      console.log(`  [FAIL] ${mc.itemName}: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Minibar consumptions created/upserted: ${mcCreated}/5\n`);

  // ── 5. Create Laundry Orders ────────────────────────────────
  // NOTE: roomId is REQUIRED on LaundryOrder (not optional)
  console.log('5. Creating/upserting laundry orders (6)...');

  const loData = [
    {
      id: uuid('lord-1'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-1'), guestId: guests[0]?.id,
      roomId: findRoom('501')?.id || rooms[0]?.id, // REQUIRED
      folioId: uuid('folio-1'),
      orderType: 'guest', status: 'delivered',
      receivedAt: new Date(today.getTime() - 1.5 * 864e5),
      readyAt: new Date(today.getTime() - 1.2 * 864e5),
      deliveredAt: d(1),
      totalItems: 4, totalPrice: 760, currency: 'INR',
      postedToFolio: true,
      collectedBy: users[2]?.id, deliveredBy: users[2]?.id,
    },
    {
      id: uuid('lord-2'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-2'), guestId: guests[1]?.id,
      roomId: findRoom('801')?.id || rooms[1]?.id, // REQUIRED
      folioId: uuid('folio-2'),
      orderType: 'guest', status: 'in_progress',
      receivedAt: new Date(today.getTime() - 8 * 36e5),
      totalItems: 3, totalPrice: 950, currency: 'INR',
      specialInstructions: 'VIP - priority. Stain removal on left lapel.',
    },
    {
      id: uuid('lord-3'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: null, guestId: null,
      roomId: rooms[0]?.id, // REQUIRED - use a room for housekeeping
      folioId: null,
      orderType: 'housekeeping', status: 'ready',
      receivedAt: d(2),
      readyAt: new Date(today.getTime() - 1.5 * 864e5),
      totalItems: 15, totalPrice: 750, currency: 'INR',
    },
    {
      id: uuid('lord-4'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: uuid('booking-4'), guestId: guests[3]?.id,
      roomId: findRoom('1002')?.id || rooms[3]?.id, // REQUIRED
      folioId: null,
      orderType: 'guest', status: 'received',
      receivedAt: new Date(today.getTime() - 2 * 36e5),
      totalItems: 6, totalPrice: 2400, currency: 'INR',
    },
    {
      id: uuid('lord-5'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: null, guestId: null,
      roomId: rooms[0]?.id, // REQUIRED - use a room for housekeeping
      folioId: null,
      orderType: 'housekeeping', status: 'delivered',
      receivedAt: d(3),
      readyAt: new Date(today.getTime() - 2.5 * 864e5),
      deliveredAt: d(2),
      totalItems: 20, totalPrice: 1000, currency: 'INR',
    },
    {
      id: uuid('lord-6'), tenantId: tenant.id, propertyId: prop.id,
      bookingId: null, guestId: null,
      roomId: rooms[0]?.id, // REQUIRED - was null in seed-fix.ts, caused error
      folioId: null,
      orderType: 'housekeeping', status: 'in_progress',
      receivedAt: new Date(today.getTime() - 4 * 36e5),
      totalItems: 8, totalPrice: 4800, currency: 'INR',
      notes: 'Staff uniform batch.',
    },
  ];

  let loCreated = 0;
  for (const lo of loData) {
    try {
      await prisma.laundryOrder.upsert({
        where: { id: lo.id },
        update: {},
        create: lo as any,
      });
      loCreated++;
      console.log(`  [OK] ${lo.id.slice(0, 8)}... (${lo.orderType}, ${lo.status}, ${lo.totalItems} items)`);
    } catch (e: any) {
      console.log(`  [FAIL] ${lo.id.slice(0, 8)}...: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Laundry orders created/upserted: ${loCreated}/6\n`);

  // ── 6. Create Laundry Order Items ───────────────────────────
  console.log('6. Creating/upserting laundry order items (8)...');

  const loiData = [
    { id: uuid('lori-1-1'), orderId: uuid('lord-1'), itemId: uuid('li-1'), itemName: 'Shirt - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 80, totalPrice: 160, status: 'delivered' },
    { id: uuid('lori-1-2'), orderId: uuid('lord-1'), itemId: uuid('li-2'), itemName: 'Trousers - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 100, totalPrice: 200, status: 'delivered' },
    { id: uuid('lori-1-3'), orderId: uuid('lord-1'), itemId: uuid('li-3'), itemName: 'Suit - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'delivered' },
    { id: uuid('lori-1-4'), orderId: uuid('lord-1'), itemId: uuid('li-4'), itemName: 'Saree - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 350, totalPrice: 350, status: 'delivered' },
    { id: uuid('lori-2-1'), orderId: uuid('lord-2'), itemId: uuid('li-3'), itemName: 'Suit - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'in_progress' },
    { id: uuid('lori-2-2'), orderId: uuid('lord-2'), itemId: uuid('li-1'), itemName: 'Shirt - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 80, totalPrice: 160, status: 'in_progress' },
    { id: uuid('lori-2-3'), orderId: uuid('lord-2'), itemId: uuid('li-2'), itemName: 'Trousers - Wash & Iron', serviceType: 'wash', quantity: 1, unitPrice: 100, totalPrice: 100, status: 'in_progress' },
    { id: uuid('lori-4-1'), orderId: uuid('lord-4'), itemId: uuid('li-7'), itemName: 'Drape - Dry Clean', serviceType: 'dry_clean', quantity: 4, unitPrice: 600, totalPrice: 2400, status: 'received' },
  ];

  let loiCreated = 0;
  for (const loi of loiData) {
    try {
      await prisma.laundryOrderItem.upsert({
        where: { id: loi.id },
        update: {},
        create: loi,
      });
      loiCreated++;
      console.log(`  [OK] ${loi.itemName} x${loi.quantity} (${loi.status})`);
    } catch (e: any) {
      console.log(`  [FAIL] ${loi.itemName}: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Laundry order items created/upserted: ${loiCreated}/8\n`);

  // ── 7. Create Commission Records ────────────────────────────
  console.log('7. Creating/upserting commission records (5)...');

  const crData = [
    {
      id: uuid('crec-1'), tenantId: tenant.id, propertyId: prop.id,
      ruleId: uuid('crule-1'), bookingId: uuid('booking-3'),
      sourceType: 'ota', sourceName: 'Booking.com',
      bookingAmount: 22000, commissionAmount: 3300, status: 'accrued',
    },
    {
      id: uuid('crec-2'), tenantId: tenant.id, propertyId: prop.id,
      ruleId: uuid('crule-1'), bookingId: uuid('booking-5'),
      sourceType: 'ota', sourceName: 'Booking.com',
      bookingAmount: 10500, commissionAmount: 1575, status: 'accrued',
    },
    {
      id: uuid('crec-3'), tenantId: tenant.id, propertyId: prop.id,
      ruleId: uuid('crule-3'), bookingId: uuid('booking-1'),
      sourceType: 'travel_agent', sourceName: 'Thomas Cook India',
      bookingAmount: 16500, commissionAmount: 1980, status: 'invoiced',
      invoicedAt: d(25),
    },
    {
      id: uuid('crec-4'), tenantId: tenant.id, propertyId: prop.id,
      ruleId: uuid('crule-2'), bookingId: uuid('booking-2'),
      sourceType: 'ota', sourceName: 'Expedia',
      bookingAmount: 48000, commissionAmount: 8640, status: 'paid',
      invoicedAt: d(15), paidAt: d(10),
    },
    {
      id: uuid('crec-5'), tenantId: tenant.id, propertyId: prop.id,
      ruleId: uuid('crule-4'), bookingId: uuid('booking-6'),
      sourceType: 'corporate', sourceName: 'TCS Corporate',
      bookingAmount: 10500, commissionAmount: 500, status: 'accrued',
    },
  ];

  let crCreated = 0;
  for (const cr of crData) {
    try {
      await prisma.commissionRecord.upsert({
        where: { id: cr.id },
        update: {},
        create: cr,
      });
      crCreated++;
      console.log(`  [OK] ${cr.sourceName} -> ${cr.status} (${cr.commissionAmount} INR)`);
    } catch (e: any) {
      console.log(`  [FAIL] ${cr.sourceName}: ${e.message}`);
      if (e.code) console.log(`         Prisma code: ${e.code}, meta: ${JSON.stringify(e.meta || {})}`);
    }
  }
  console.log(`  -> Commission records created/upserted: ${crCreated}/5\n`);

  // ── 8. Final Verification Counts ────────────────────────────
  console.log('======================================================');
  console.log('  FINAL VERIFICATION COUNTS');
  console.log('======================================================');

  const tables = [
    ['bookings', () => prisma.booking.count()],
    ['folios', () => prisma.folio.count()],
    ['scheduledCharges', () => prisma.scheduledCharge.count()],
    ['minibarConsumptions', () => prisma.minibarConsumption.count()],
    ['laundryOrders', () => prisma.laundryOrder.count()],
    ['laundryOrderItems', () => prisma.laundryOrderItem.count()],
    ['commissionRecords', () => prisma.commissionRecord.count()],
    ['commissionRules', () => prisma.commissionRule.count()],
    ['nightAudits', () => prisma.nightAudit.count()],
    ['travelAgents', () => prisma.travelAgent.count()],
    ['cityLedgerInvoices', () => prisma.cityLedgerInvoice.count()],
    ['postingRules', () => prisma.postingRule.count()],
    ['revenueAccounts', () => prisma.revenueAccount.count()],
    ['lostFoundItems', () => prisma.lostFoundItem.count()],
    ['minibarItems', () => prisma.minibarItem.count()],
    ['minibarSetups', () => prisma.minibarSetup.count()],
    ['laundryItems', () => prisma.laundryItem.count()],
    ['packagePlans', () => prisma.packagePlan.count()],
    ['guests', () => prisma.guest.count()],
    ['rooms', () => prisma.room.count()],
    ['roomTypes', () => prisma.roomType.count()],
    ['tenants', () => prisma.tenant.count()],
    ['properties', () => prisma.property.count()],
    ['users', () => prisma.user.count()],
  ];

  for (const [name, fn] of tables) {
    try {
      const count = await fn();
      const icon = count > 0 ? 'OK' : '!!';
      console.log(`  [${icon}] ${name}: ${count}`);
    } catch (e: any) {
      console.log(`  [ER] ${name}: ERROR - ${e.message?.substring(0, 80)}`);
    }
  }

  console.log('\n======================================================');
  console.log('  Seed script complete!');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error('FATAL ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
