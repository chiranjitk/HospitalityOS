import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Deterministic UUID helper (same as seed.ts)
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

// ═══════════════════════════════════════════════════════════════════
// Reusable constants — matching existing seed IDs
// ═══════════════════════════════════════════════════════════════════
const T1  = uuid('tenant-1');
const T2  = uuid('tenant-2');
const P1  = uuid('property-1');
const P2  = uuid('property-2');

const U1  = uuid('user-1');   // admin
const U2  = uuid('user-2');   // frontdesk
const U3  = uuid('user-3');   // housekeeping

const G1  = uuid('guest-1');
const G2  = uuid('guest-2');
const G3  = uuid('guest-3');
const G4  = uuid('guest-4');
const G5  = uuid('guest-5');
const G6  = uuid('guest-6');

const B1  = uuid('booking-1');
const B2  = uuid('booking-2');
const B3  = uuid('booking-3');
const B4  = uuid('booking-4');
const B5  = uuid('booking-5');
const B6  = uuid('booking-6');

const R_101  = uuid('room-101');
const R_305  = uuid('room-305');
const R_501  = uuid('room-501');
const R_510  = uuid('room-510');
const R_801  = uuid('room-801');
const R_1002 = uuid('room-1002');

const RT1 = uuid('roomtype-1'); // Standard Room
const RT2 = uuid('roomtype-2'); // Deluxe Room
const RT3 = uuid('roomtype-3'); // Executive Suite
const RT4 = uuid('roomtype-4'); // Premium Suite
const RT5 = uuid('roomtype-5'); // Family Room
const RT6 = uuid('roomtype-6'); // Presidential Suite

const F1  = uuid('folio-1');
const F2  = uuid('folio-2');
const F3  = uuid('folio-3');
const F4  = uuid('folio-4');
const F5  = uuid('folio-5');
const F6  = uuid('folio-6');

const O1  = uuid('order-1');
const O2  = uuid('order-2');
const O3  = uuid('order-3');
const O4  = uuid('order-4');

const TB1 = uuid('table-1');
const TB2 = uuid('table-2');
const TB3 = uuid('table-3');

const CP1 = uuid('cp-1'); // Standard Flexible
const CP2 = uuid('cp-2'); // Non-Refundable
const CP3 = uuid('cp-3'); // Corporate Rate
const CP4 = uuid('cp-4'); // Long Stay
const CP5 = uuid('cp-5'); // Standard - Ocean View (tenant-2)

const POS1 = uuid('pos-1'); // Ahaar Restaurant POS
const POS2 = uuid('pos-2'); // Tiki Bar POS
const POS3 = uuid('pos-3'); // Room Service POS

const BW_FREE = uuid('bwpolicy-free');
const BW_STD  = uuid('bwpolicy-standard');
const BW_PREM = uuid('bwpolicy-premium');

const ETH1  = uuid('netif-eth1');
const BOND0 = uuid('netif-bond0');

const WIFIP1 = uuid('wifiplan-1'); // free plan

const LI1 = uuid('li-1'); // Shirt - Wash & Iron
const LI2 = uuid('li-2'); // Trousers - Wash & Iron
const LI3 = uuid('li-3'); // Suit - Dry Clean
const LI4 = uuid('li-4'); // Saree - Dry Clean
const LI5 = uuid('li-5'); // Bed Sheet - Commercial Wash
const LI6 = uuid('li-6'); // Bath Towel - Commercial Wash
const LI7 = uuid('li-7'); // Drape / Curtain - Dry Clean
const LI8 = uuid('li-8'); // Staff Uniform Shirt

// Date helpers
const today      = new Date();
const daysAgo    = (n: number) => new Date(today.getTime() - n * 86400000);
const hoursAgo   = (n: number) => new Date(today.getTime() - n * 3600000);
const daysLater  = (n: number) => new Date(today.getTime() + n * 86400000);

// ═══════════════════════════════════════════════════════════════════
// 12-table seed function
// ═══════════════════════════════════════════════════════════════════
export async function seed12Tables(prisma: PrismaClient) {
  console.log('\n📦 Seeding 12 empty tables: CancellationPenalty, LaundryOrder/Item, OfflineOrder, OrderDiscount, QuickBlock, RoomMoveLog, RoomTypeChange, ScheduleAccess, VirtualRoomType/Mapping, RoomVlan');

  // ────────────────────────────────────────────────────────────────
  // 1. CancellationPenalty
  //    FK → CancellationPolicy(policyId), Booking(bookingId), Folio?(folioId), Tenant
  // ────────────────────────────────────────────────────────────────
  console.log('  [1/12] CancellationPenalty …');
  try {
    await prisma.cancellationPenalty.createMany({
      data: [
        {
          id: uuid('canpen-1'), tenantId: T1, bookingId: B5, folioId: F5,
          policyId: CP1, policyName: 'Standard Flexible',
          penaltyType: 'percentage', penaltyAmount: 3322.5,
          originalAmount: 13290, penaltyPercent: 25,
          refundAmount: 9967.5,
          reason: 'Guest changed travel plans due to flight cancellation',
          status: 'applied',
        },
        {
          id: uuid('canpen-2'), tenantId: T1, bookingId: B6,
          policyId: CP2, policyName: 'Non-Refundable',
          penaltyType: 'percentage', penaltyAmount: 13290,
          originalAmount: 13290, penaltyPercent: 100,
          refundAmount: 0,
          reason: 'Cancelled within non-refundable window — no exceptions',
          status: 'applied',
        },
        {
          id: uuid('canpen-3'), tenantId: T1, bookingId: B3, folioId: F3,
          policyId: CP3, policyName: 'Corporate Rate',
          penaltyType: 'first_night', penaltyAmount: 5500,
          originalAmount: 22000, penaltyNights: 1,
          refundAmount: 16500,
          reason: 'Corporate meeting rescheduled to next quarter',
          exemptionType: 'segment',
          exemptionDetails: 'Corporate segment — penalty waived per GM approval',
          status: 'waived',
        },
        {
          id: uuid('canpen-4'), tenantId: T1, bookingId: B2, folioId: F2,
          policyId: CP1, policyName: 'Standard Flexible',
          penaltyType: 'percentage', penaltyAmount: 24000,
          originalAmount: 48000, penaltyPercent: 50,
          refundAmount: 24000,
          reason: 'Last-minute cancellation within 48-hour window',
          exemptionType: 'loyalty_tier',
          exemptionDetails: 'Platinum tier — penalty reduced to 25% as loyalty benefit',
          status: 'appealed',
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 4 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 2. LaundryOrder
  //    FK → Tenant, Property, Booking?, Guest?, Room, Folio?,
  //         collectedBy → User, deliveredBy → User
  // ────────────────────────────────────────────────────────────────
  console.log('  [2/12] LaundryOrder …');
  try {
    await prisma.laundryOrder.createMany({
      data: [
        {
          id: uuid('lord-s2-1'), tenantId: T1, propertyId: P1,
          bookingId: B1, guestId: G1, roomId: R_501,
          orderType: 'guest', status: 'delivered',
          receivedAt: daysAgo(1.5), readyAt: daysAgo(1.2), deliveredAt: daysAgo(1),
          totalItems: 4, totalPrice: 760, currency: 'INR',
          paymentMethod: 'room_charge', folioId: F1, postedToFolio: true,
          specialInstructions: 'Express service. Gentle cycle for silk items.',
          collectedBy: U3, deliveredBy: U3,
        },
        {
          id: uuid('lord-s2-2'), tenantId: T1, propertyId: P1,
          bookingId: B2, guestId: G3, roomId: R_801,
          orderType: 'guest', status: 'in_progress',
          receivedAt: hoursAgo(8),
          totalItems: 3, totalPrice: 950, currency: 'INR',
          folioId: F2,
          specialInstructions: 'VIP — priority. Stain removal on left lapel.',
          collectedBy: U3,
          notes: 'Platinum guest. Coordinated with butler service.',
        },
        {
          id: uuid('lord-s2-3'), tenantId: T1, propertyId: P1,
          bookingId: B4, guestId: G5, roomId: R_1002,
          orderType: 'guest', status: 'received',
          receivedAt: hoursAgo(2),
          totalItems: 6, totalPrice: 2400, currency: 'INR',
          specialInstructions: 'Dry clean only. Presidential Suite guest.',
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 3 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 3. LaundryOrderItem
  //    FK → LaundryOrder(orderId), LaundryItem(itemId)
  // ────────────────────────────────────────────────────────────────
  console.log('  [3/12] LaundryOrderItem …');
  try {
    await prisma.laundryOrderItem.createMany({
      data: [
        // lord-s2-1 items (delivered)
        { id: uuid('lori-s2-1-1'), orderId: uuid('lord-s2-1'), itemId: LI1, itemName: 'Shirt - Wash & Iron',     serviceType: 'wash',      quantity: 2, unitPrice: 80,  totalPrice: 160, status: 'delivered' },
        { id: uuid('lori-s2-1-2'), orderId: uuid('lord-s2-1'), itemId: LI2, itemName: 'Trousers - Wash & Iron',  serviceType: 'wash',      quantity: 2, unitPrice: 100, totalPrice: 200, status: 'delivered' },
        { id: uuid('lori-s2-1-3'), orderId: uuid('lord-s2-1'), itemId: LI3, itemName: 'Suit - Dry Clean',        serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'delivered' },
        { id: uuid('lori-s2-1-4'), orderId: uuid('lord-s2-1'), itemId: LI4, itemName: 'Saree - Dry Clean',       serviceType: 'dry_clean', quantity: 1, unitPrice: 350, totalPrice: 350, status: 'delivered', notes: 'Silk — handled with extra care' },
        // lord-s2-2 items (in_progress)
        { id: uuid('lori-s2-2-1'), orderId: uuid('lord-s2-2'), itemId: LI3, itemName: 'Suit - Dry Clean',        serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'in_progress', notes: 'Stain removal on left lapel' },
        { id: uuid('lori-s2-2-2'), orderId: uuid('lord-s2-2'), itemId: LI1, itemName: 'Shirt - Wash & Iron',     serviceType: 'wash',      quantity: 2, unitPrice: 80,  totalPrice: 160, status: 'in_progress' },
        { id: uuid('lori-s2-2-3'), orderId: uuid('lord-s2-2'), itemId: LI2, itemName: 'Trousers - Wash & Iron',  serviceType: 'wash',      quantity: 1, unitPrice: 100, totalPrice: 100, status: 'in_progress' },
        // lord-s2-3 items (received)
        { id: uuid('lori-s2-3-1'), orderId: uuid('lord-s2-3'), itemId: LI3, itemName: 'Suit - Dry Clean',        serviceType: 'dry_clean', quantity: 2, unitPrice: 500, totalPrice: 1000, status: 'received' },
        { id: uuid('lori-s2-3-2'), orderId: uuid('lord-s2-3'), itemId: LI1, itemName: 'Shirt - Wash & Iron',     serviceType: 'wash',      quantity: 3, unitPrice: 80,  totalPrice: 240, status: 'received' },
        { id: uuid('lori-s2-3-3'), orderId: uuid('lord-s2-3'), itemId: LI7, itemName: 'Drape - Dry Clean',       serviceType: 'dry_clean', quantity: 2, unitPrice: 600, totalPrice: 1200, status: 'received' },
        { id: uuid('lori-s2-3-4'), orderId: uuid('lord-s2-3'), itemId: LI4, itemName: 'Saree - Dry Clean',       serviceType: 'dry_clean', quantity: 1, unitPrice: 350, totalPrice: 350, status: 'received' },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 11 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 4. OfflineOrder
  //    FK → Tenant, POSTerminal(terminalId), tableId?(raw UUID)
  // ────────────────────────────────────────────────────────────────
  console.log('  [4/12] OfflineOrder …');
  try {
    await prisma.offlineOrder.createMany({
      data: [
        {
          id: uuid('offord-1'), tenantId: T1, terminalId: POS1,
          orderNumber: 'OFF-ORD-001', tableId: TB3,
          items: JSON.stringify([
            { name: 'Butter Chicken',  qty: 1, price: 420 },
            { name: 'Garlic Naan',     qty: 3, price: 60  },
            { name: 'Masala Chai',     qty: 2, price: 60  },
          ]),
          totalAmount: 600, taxAmount: 108, discount: 0, netAmount: 708,
          currency: 'INR', orderType: 'dine_in',
          status: 'synced', syncedAt: hoursAgo(1),
        },
        {
          id: uuid('offord-2'), tenantId: T1, terminalId: POS2,
          orderNumber: 'OFF-ORD-002',
          items: JSON.stringify([
            { name: 'Mojito',           qty: 2, price: 350 },
            { name: 'French Fries',     qty: 1, price: 220 },
            { name: 'Fresh Lime Soda',  qty: 1, price: 80  },
          ]),
          totalAmount: 1000, taxAmount: 180, discount: 50, netAmount: 1130,
          currency: 'INR', orderType: 'dine_in',
          status: 'synced', syncedAt: hoursAgo(2),
        },
        {
          id: uuid('offord-3'), tenantId: T1, terminalId: POS3,
          orderNumber: 'OFF-ORD-003',
          guestId: G3, roomId: R_801, bookingId: B2,
          items: JSON.stringify([
            { name: 'Club Sandwich',        qty: 1, price: 380 },
            { name: 'Fresh Orange Juice',   qty: 2, price: 180 },
          ]),
          totalAmount: 740, taxAmount: 133, discount: 0, netAmount: 873,
          currency: 'INR', orderType: 'room_service',
          status: 'synced', syncedAt: hoursAgo(20),
        },
        {
          id: uuid('offord-4'), tenantId: T1, terminalId: POS1,
          orderNumber: 'OFF-ORD-004', tableId: TB2,
          guestId: G1, bookingId: B1,
          items: JSON.stringify([
            { name: 'Fish Curry',   qty: 1, price: 480 },
            { name: 'Steamed Rice', qty: 2, price: 120 },
            { name: 'Rasgulla',     qty: 2, price: 120 },
          ]),
          totalAmount: 840, taxAmount: 151, discount: 0, netAmount: 991,
          currency: 'INR', orderType: 'dine_in',
          status: 'offline_pending',
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 4 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 5. OrderDiscount
  //    FK → Tenant, Order(orderId)
  // ────────────────────────────────────────────────────────────────
  console.log('  [5/12] OrderDiscount …');
  try {
    await prisma.orderDiscount.createMany({
      data: [
        { id: uuid('odisc-1'), tenantId: T1, orderId: O1, type: 'percentage', value: 10, reason: 'Loyalty discount — Gold member benefit',            couponCode: 'GOLD10',  authorizedBy: U2 },
        { id: uuid('odisc-2'), tenantId: T1, orderId: O2, type: 'fixed',      value: 200, reason: 'Manager complimentary — compensation for long wait', couponCode: null,      authorizedBy: U1 },
        { id: uuid('odisc-3'), tenantId: T1, orderId: O3, type: 'percentage', value: 15, reason: 'Happy hour special — Sunday brunch promotion',       couponCode: 'BRUNCH15', authorizedBy: null },
        { id: uuid('odisc-4'), tenantId: T1, orderId: O4, type: 'fixed',      value: 100, reason: 'First visit welcome discount — walk-in guest',       couponCode: null,      authorizedBy: U2 },
        { id: uuid('odisc-5'), tenantId: T1, orderId: O1, type: 'percentage', value: 5,  reason: 'Corporate account discount applied automatically',   couponCode: 'CORP5',   authorizedBy: null },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 5 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 6. QuickBlock
  //    FK → Tenant, Property
  //    @@unique([propertyId, type, value])
  // ────────────────────────────────────────────────────────────────
  console.log('  [6/12] QuickBlock …');
  try {
    await prisma.quickBlock.createMany({
      data: [
        { id: uuid('qblk-1'), tenantId: T1, propertyId: P1, type: 'mac',    value: 'AA:BB:CC:DD:EE:01', reason: 'P2P torrent detected on guest network',              enabled: true, expiresAt: daysLater(30) },
        { id: uuid('qblk-2'), tenantId: T1, propertyId: P1, type: 'ip',     value: '10.1.5.142',         reason: 'Port scanning activity from this address',             enabled: true, expiresAt: null },
        { id: uuid('qblk-3'), tenantId: T1, propertyId: P1, type: 'subnet', value: '10.1.99.0/24',      reason: 'Unauthorized IoT device cluster detected',              enabled: true, expiresAt: null },
        { id: uuid('qblk-4'), tenantId: T1, propertyId: P1, type: 'mac',    value: 'AA:BB:CC:DD:EE:02', reason: 'Stolen device reported by guest — security request',  enabled: true, expiresAt: daysLater(90) },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 4 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 7. RoomMoveLog
  //    FK → Tenant, Property, Booking, Guest, fromRoomId, toRoomId
  // ────────────────────────────────────────────────────────────────
  console.log('  [7/12] RoomMoveLog …');
  try {
    await prisma.roomMoveLog.createMany({
      data: [
        {
          id: uuid('rmove-1'), tenantId: T1, propertyId: P1,
          bookingId: B1, guestId: G1,
          fromRoomId: R_305, fromRoomNumber: '305',
          toRoomId: R_501, toRoomNumber: '501',
          reason: 'upgrade', movedBy: U2,
          previousRate: 3500, newRate: 5500, rateDifference: 2000,
          notes: 'Complimentary upgrade for Gold loyalty guest',
          createdAt: daysAgo(2),
        },
        {
          id: uuid('rmove-2'), tenantId: T1, propertyId: P1,
          bookingId: B2, guestId: G3,
          fromRoomId: R_510, fromRoomNumber: '510',
          toRoomId: R_801, toRoomNumber: '801',
          reason: 'upgrade', movedBy: U1,
          previousRate: 5500, newRate: 12000, rateDifference: 6500,
          notes: 'VIP Platinum upgrade to Executive Suite — birthday surprise',
          createdAt: daysAgo(1),
        },
        {
          id: uuid('rmove-3'), tenantId: T1, propertyId: P1,
          bookingId: B5, guestId: G4,
          fromRoomId: R_501, fromRoomNumber: '501',
          toRoomId: R_510, toRoomNumber: '510',
          reason: 'maintenance', movedBy: U2,
          previousRate: 5500, newRate: 5500, rateDifference: 0,
          notes: 'AC malfunction in 501 — moved to equivalent room on same floor',
          createdAt: daysAgo(0.5),
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 3 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 8. RoomTypeChange
  //    FK → Tenant, Property, Booking, Room, oldRoomTypeId, newRoomTypeId, Folio?
  // ────────────────────────────────────────────────────────────────
  console.log('  [8/12] RoomTypeChange …');
  try {
    await prisma.roomTypeChange.createMany({
      data: [
        {
          id: uuid('rtchg-1'), tenantId: T1, propertyId: P1,
          bookingId: B1, roomId: R_501,
          oldRoomTypeId: RT1, newRoomTypeId: RT2,
          reason: 'Guest requested Standard → Deluxe upgrade on arrival',
          rateDifference: 2000, chargeApplied: false, chargeAmount: 0,
          folioId: null,
          status: 'completed',
          requestedBy: G1, approvedBy: U1,
          approvedAt: daysAgo(2), completedAt: daysAgo(2),
        },
        {
          id: uuid('rtchg-2'), tenantId: T1, propertyId: P1,
          bookingId: B3, roomId: R_510,
          oldRoomTypeId: RT2, newRoomTypeId: RT3,
          reason: 'Upgrade for anniversary celebration — guest paying difference',
          rateDifference: 6500, chargeApplied: true, chargeAmount: 6500,
          folioId: F3,
          status: 'approved',
          requestedBy: G2, approvedBy: U1,
          approvedAt: daysAgo(1), completedAt: null,
        },
        {
          id: uuid('rtchg-3'), tenantId: T1, propertyId: P1,
          bookingId: B4, roomId: R_1002,
          oldRoomTypeId: RT4, newRoomTypeId: RT6,
          reason: 'Complimentary upgrade for high-value VIP guest',
          rateDifference: 15000, chargeApplied: false, chargeAmount: 0,
          folioId: F4,
          status: 'completed',
          requestedBy: U1, approvedBy: U1,
          approvedAt: daysAgo(0), completedAt: daysAgo(0),
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 3 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 9. ScheduleAccess
  //    FK → Tenant, Property, applyToPlanId?(WiFiPlan), bandwidthPolicyId?
  // ────────────────────────────────────────────────────────────────
  console.log('  [9/12] ScheduleAccess …');
  try {
    await prisma.scheduleAccess.createMany({
      data: [
        {
          id: uuid('schacc-1'), tenantId: T1, propertyId: P1,
          name: 'Business Hours Full Speed',
          daysOfWeek: '1,2,3,4,5', startTime: '08:00', endTime: '20:00',
          downloadMbps: 0, uploadMbps: 0,
          applyTo: 'all',
          action: 'limit',
          description: 'Full bandwidth during business hours for all connections',
          enabled: true,
        },
        {
          id: uuid('schacc-2'), tenantId: T1, propertyId: P1,
          name: 'Night Throttle — Staff Devices',
          daysOfWeek: '1,2,3,4,5', startTime: '22:00', endTime: '07:00',
          downloadMbps: 5, uploadMbps: 2,
          applyTo: 'staff',
          bandwidthPolicyId: BW_STD,
          action: 'limit',
          description: 'Reduce staff personal-device bandwidth at night',
          enabled: true,
        },
        {
          id: uuid('schacc-3'), tenantId: T1, propertyId: P1,
          name: 'Weekend Free Plan Throttle',
          daysOfWeek: '6,7', startTime: '00:00', endTime: '23:59',
          downloadMbps: 2, uploadMbps: 1,
          applyTo: 'specific_plan',
          applyToPlanId: WIFIP1,
          bandwidthPolicyId: BW_FREE,
          action: 'limit',
          description: 'Throttle free WiFi on weekends to prioritize paid guests',
          enabled: true,
        },
        {
          id: uuid('schacc-4'), tenantId: T1, propertyId: P1,
          name: 'IoT Maintenance Window',
          daysOfWeek: '2,4', startTime: '02:00', endTime: '04:00',
          downloadMbps: 0, uploadMbps: 0,
          applyTo: 'all',
          action: 'deny',
          description: 'Block IoT traffic during firmware maintenance window',
          enabled: true,
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 4 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 10. VirtualRoomType
  //     FK → Tenant, Property?
  // ────────────────────────────────────────────────────────────────
  console.log('  [10/12] VirtualRoomType …');
  try {
    await prisma.virtualRoomType.createMany({
      data: [
        { id: uuid('vrt-1'), tenantId: T1, propertyId: P1, name: 'Flexible King',        description: 'Any room with a king bed — for flexible inventory allocation', aggregationType: 'single',  isActive: true },
        { id: uuid('vrt-2'), tenantId: T1, propertyId: P1, name: 'Heritage Collection',   description: 'Heritage wing rooms with period furnishings',                 aggregationType: 'grouped', isActive: true },
        { id: uuid('vrt-3'), tenantId: T1, propertyId: P1, name: 'Executive Floor Bundle', description: 'Executive floor with lounge access and express check-in',     aggregationType: 'derived', isActive: true },
        { id: uuid('vrt-4'), tenantId: T1, propertyId: P1, name: 'OTA Standard Mix',      description: 'Standard + Deluxe combined for channel manager flexibility',   aggregationType: 'flexible', isActive: true },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 4 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 11. VirtualRoomMapping
  //     FK → Tenant, VirtualRoomType, RoomType(physicalRoomTypeId), connectionId?
  //     @@unique([virtualRoomTypeId, physicalRoomTypeId, connectionId])
  // ────────────────────────────────────────────────────────────────
  console.log('  [11/12] VirtualRoomMapping …');
  try {
    await prisma.virtualRoomMapping.createMany({
      data: [
        // Flexible King → Deluxe (Booking.com)
        { id: uuid('vrm-1'), tenantId: T1, virtualRoomTypeId: uuid('vrt-1'), physicalRoomTypeId: RT2, channelCode: 'booking_com', externalRoomId: uuid('vrm-ext-1'), externalRoomName: 'Deluxe King Room',      rateMultiplier: 1.0,  priority: 1, isActive: true },
        // Flexible King → Executive Suite (Booking.com)
        { id: uuid('vrm-2'), tenantId: T1, virtualRoomTypeId: uuid('vrt-1'), physicalRoomTypeId: RT3, channelCode: 'booking_com', externalRoomId: uuid('vrm-ext-2'), externalRoomName: 'Executive Suite King', rateMultiplier: 1.0,  priority: 2, isActive: true },
        // Heritage → Premium Suite (Airbnb)
        { id: uuid('vrm-3'), tenantId: T1, virtualRoomTypeId: uuid('vrt-2'), physicalRoomTypeId: RT4, channelCode: 'airbnb',       externalRoomId: uuid('vrm-ext-3'), externalRoomName: 'Heritage Premium Suite', rateMultiplier: 1.15, priority: 1, isActive: true },
        // Heritage → Family Room (Airbnb)
        { id: uuid('vrm-4'), tenantId: T1, virtualRoomTypeId: uuid('vrt-2'), physicalRoomTypeId: RT5, channelCode: 'airbnb',       externalRoomId: uuid('vrm-ext-4'), externalRoomName: 'Heritage Family Room',   rateMultiplier: 1.1,  priority: 2, isActive: true },
        // Executive Bundle → Executive Suite (direct)
        { id: uuid('vrm-5'), tenantId: T1, virtualRoomTypeId: uuid('vrt-3'), physicalRoomTypeId: RT3, channelCode: 'direct',       rateMultiplier: 1.0,  priority: 1, isActive: true },
        // OTA Mix → Standard (Booking.com)
        { id: uuid('vrm-6'), tenantId: T1, virtualRoomTypeId: uuid('vrt-4'), physicalRoomTypeId: RT1, channelCode: 'booking_com', externalRoomId: uuid('vrm-ext-5'), externalRoomName: 'Standard Room (OTA)',   rateMultiplier: 1.0,  priority: 1, isActive: true },
        // OTA Mix → Deluxe (Booking.com)
        { id: uuid('vrm-7'), tenantId: T1, virtualRoomTypeId: uuid('vrt-4'), physicalRoomTypeId: RT2, channelCode: 'booking_com', externalRoomId: uuid('vrm-ext-6'), externalRoomName: 'Deluxe Room (OTA)',     rateMultiplier: 1.0,  priority: 2, isActive: true },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 7 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 12. RoomVlan
  //     FK → Tenant, Property, parentInterfaceId?(NetworkInterface),
  //          bandwidthPlanId?(BandwidthPolicy)
  //     @@unique([propertyId, roomNumber])
  //     @@unique([propertyId, vlanId])
  // ────────────────────────────────────────────────────────────────
  console.log('  [12/12] RoomVlan …');
  try {
    await prisma.roomVlan.createMany({
      data: [
        {
          id: uuid('rvlan-1'), tenantId: T1, propertyId: P1,
          roomNumber: '101', vlanId: 1101,
          subnet: '10.1.1.0/28', gateway: '10.1.1.1',
          parentInterfaceId: ETH1,
          role: 'guest', mtu: 1500, floor: 1, roomType: 'standard',
          bandwidthPlanId: BW_STD,
          status: 'active',
          description: 'Room 101 — Standard floor',
          firewallRulesGenerated: true, lastProvisionedAt: daysAgo(30),
        },
        {
          id: uuid('rvlan-2'), tenantId: T1, propertyId: P1,
          roomNumber: '305', vlanId: 1305,
          subnet: '10.1.3.0/28', gateway: '10.1.3.1',
          parentInterfaceId: ETH1,
          role: 'guest', mtu: 1500, floor: 3, roomType: 'standard',
          bandwidthPlanId: BW_STD,
          status: 'active',
          description: 'Room 305 — Standard floor',
          firewallRulesGenerated: true, lastProvisionedAt: daysAgo(30),
        },
        {
          id: uuid('rvlan-3'), tenantId: T1, propertyId: P1,
          roomNumber: '501', vlanId: 1501,
          subnet: '10.1.5.0/28', gateway: '10.1.5.1',
          parentInterfaceId: ETH1,
          role: 'guest', mtu: 1500, floor: 5, roomType: 'suite',
          bandwidthPlanId: BW_PREM,
          status: 'active',
          description: 'Room 501 — Deluxe floor, premium bandwidth',
          firewallRulesGenerated: true, lastProvisionedAt: daysAgo(30),
        },
        {
          id: uuid('rvlan-4'), tenantId: T1, propertyId: P1,
          roomNumber: '801', vlanId: 1801,
          subnet: '10.1.8.0/28', gateway: '10.1.8.1',
          parentInterfaceId: ETH1,
          role: 'guest', mtu: 1500, floor: 8, roomType: 'vip',
          bandwidthPlanId: BW_PREM,
          status: 'active',
          description: 'Room 801 — Executive Suite, premium bandwidth',
          firewallRulesGenerated: true, lastProvisionedAt: daysAgo(30),
        },
        {
          id: uuid('rvlan-5'), tenantId: T1, propertyId: P1,
          roomNumber: '1002', vlanId: 1102,
          subnet: '10.1.10.0/28', gateway: '10.1.10.1',
          parentInterfaceId: BOND0,
          role: 'guest', mtu: 1500, floor: 10, roomType: 'vip',
          bandwidthPlanId: BW_PREM,
          status: 'active',
          description: 'Room 1002 — Presidential Suite, bonded interface',
          firewallRulesGenerated: true, lastProvisionedAt: daysAgo(30),
        },
      ],
      skipDuplicates: true,
    });
    console.log('      ✓ 5 rows');
  } catch (e: any) { console.error('      ✗ Failed:', e.message); }

  console.log('\n✅ All 12 empty tables seeded successfully!');
}

// ── Run standalone ────────────────────────────────────────────────
if (require.main === module) {
  const prisma = new PrismaClient();
  seed12Tables(prisma)
    .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
