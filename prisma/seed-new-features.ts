/**
 * Standalone seed script for 9 Critical Missing Features
 * Run: DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/staysuite" npx tsx prisma/seed-new-features.ts
 * This script uses createMany with skipDuplicates where possible,
 * and try/catch for each module so partial failures don't block others.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8), h.slice(8, 12), '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31)
  ].join('-');
};

const today = new Date();
const d = (daysAgo: number) => new Date(today.getTime() - daysAgo * 864e5);

async function main() {
  console.log('🌱 Seeding 9 Critical Missing Features...\n');

  // ── 1. Night Audit ──────────────────────────────────────────
  console.log('1/9 Night Audit...');
  try {
    await prisma.nightAudit.createMany({ data: [
      { id: uuid('na-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), auditDate: d(1), businessDayDate: d(1), status: 'completed', startedBy: uuid('user-2'), completedBy: uuid('user-1'), startedAt: new Date(d(1).getTime() + 22 * 36e5), completedAt: new Date(d(1).getTime() + 23.5 * 36e5), roomRevenue: 165000, fbRevenue: 45000, otherRevenue: 12000, totalRevenue: 222000, roomChargesPosted: 45, noShowsProcessed: 2, roomsReconciled: 98, discrepancies: 1, autoPostedAt: new Date(d(1).getTime() + 22 * 36e5), notes: '1 discrepancy in room 305 minibar count — resolved by Anita Roy.' },
      { id: uuid('na-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), auditDate: d(2), businessDayDate: d(2), status: 'completed', startedBy: uuid('user-1'), completedBy: uuid('user-1'), startedAt: new Date(d(2).getTime() + 22 * 36e5), completedAt: new Date(d(2).getTime() + 23 * 36e5), roomRevenue: 148000, fbRevenue: 38000, otherRevenue: 8500, totalRevenue: 194500, roomChargesPosted: 42, noShowsProcessed: 1, roomsReconciled: 97, discrepancies: 0 },
      { id: uuid('na-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), auditDate: today, businessDayDate: today, status: 'in_progress', startedBy: uuid('user-2'), startedAt: new Date(today.getTime() - 30 * 36e5), roomRevenue: 155000, fbRevenue: 42000, otherRevenue: 9000, totalRevenue: 206000, roomChargesPosted: 44, noShowsProcessed: 0, roomsReconciled: 96, discrepancies: 3, notes: 'In progress — 3 room discrepancies pending review.' },
    ]});
    await prisma.nightAuditStep.createMany({ data: [
      { id: uuid('nas-1-1'), nightAuditId: uuid('na-1'), stepName: 'Verify Room Status', stepOrder: 1, status: 'completed', performedBy: uuid('user-2'), result: 'All 98 rooms reconciled' },
      { id: uuid('nas-1-2'), nightAuditId: uuid('na-1'), stepName: 'Post Room Charges', stepOrder: 2, status: 'completed', performedBy: uuid('user-2'), result: '45 room charges posted' },
      { id: uuid('nas-1-3'), nightAuditId: uuid('na-1'), stepName: 'Process No-Shows', stepOrder: 3, status: 'completed', performedBy: uuid('user-2'), result: '2 no-shows processed' },
      { id: uuid('nas-1-4'), nightAuditId: uuid('na-1'), stepName: 'Verify Folio Balances', stepOrder: 4, status: 'completed', performedBy: uuid('user-1') },
      { id: uuid('nas-1-5'), nightAuditId: uuid('na-1'), stepName: 'Generate End-of-Day Report', stepOrder: 5, status: 'completed', performedBy: uuid('user-1') },
      { id: uuid('nas-3-1'), nightAuditId: uuid('na-3'), stepName: 'Verify Room Status', stepOrder: 1, status: 'completed', performedBy: uuid('user-2') },
      { id: uuid('nas-3-2'), nightAuditId: uuid('na-3'), stepName: 'Post Room Charges', stepOrder: 2, status: 'completed', performedBy: uuid('user-2') },
      { id: uuid('nas-3-3'), nightAuditId: uuid('na-3'), stepName: 'Process No-Shows', stepOrder: 3, status: 'in_progress' },
      { id: uuid('nas-3-4'), nightAuditId: uuid('na-3'), stepName: 'Verify Folio Balances', stepOrder: 4, status: 'pending' },
      { id: uuid('nas-3-5'), nightAuditId: uuid('na-3'), stepName: 'Generate End-of-Day Report', stepOrder: 5, status: 'pending' },
    ]});
    await prisma.nightAuditLog.createMany({ data: [
      { id: uuid('nal-1'), nightAuditId: uuid('na-1'), action: 'room_reconciled', entityType: 'Room', entityId: uuid('room-501'), oldValue: 'dirty', newValue: 'clean', performedBy: uuid('user-2') },
      { id: uuid('nal-2'), nightAuditId: uuid('na-1'), action: 'charge_posted', entityType: 'Folio', entityId: uuid('folio-1'), newValue: '5500', performedBy: uuid('user-2') },
      { id: uuid('nal-3'), nightAuditId: uuid('na-1'), action: 'noshows_processed', entityType: 'Booking', newValue: '2 bookings marked no-show', performedBy: uuid('user-2') },
      { id: uuid('nal-4'), nightAuditId: uuid('na-3'), action: 'discrepancy_found', entityType: 'Room', entityId: uuid('room-305'), newValue: 'Minibar count mismatch', performedBy: uuid('user-2') },
    ]});
    console.log('   ✅ 3 audits, 10 steps, 4 logs');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 2. Travel Agent / City Ledger AR ─────────────────────────
  console.log('2/9 Travel Agent / City Ledger...');
  try {
    await prisma.travelAgent.createMany({ data: [
      { id: uuid('ta-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), agencyName: 'Thomas Cook India', code: 'TCI-001', contactPerson: 'Sanjay Verma', email: 'sanjay.v@thomascook.in', phone: '+91-33-22891234', address: '14 Park Street', city: 'Kolkata', country: 'India', taxId: 'GST-19AABCT1234A1Z5', commissionRate: 12, commissionType: 'percentage', creditLimit: 500000, currentBalance: 125000, paymentTerms: 'net_30', status: 'active', isActive: true, notes: 'Premium travel partner since 2019.' },
      { id: uuid('ta-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), agencyName: 'MakeMyTrip Business', code: 'MMT-001', contactPerson: 'Priya Nair', email: 'hotels@makemytrip.com', phone: '+91-124-4567890', address: 'Tower B, Unitech Cyber Park', city: 'Gurgaon', country: 'India', taxId: 'GST-06AABCM5678B2Z3', commissionRate: 15, commissionType: 'percentage', creditLimit: 800000, currentBalance: 340000, paymentTerms: 'net_15', status: 'active', isActive: true, notes: 'High volume OTA partner. 15% commission.' },
      { id: uuid('ta-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), agencyName: 'SOTC Travel', code: 'SOTC-001', contactPerson: 'Rakesh Gupta', email: 'rakesh@sotc.in', phone: '+91-33-22451234', city: 'Kolkata', country: 'India', commissionRate: 10, commissionType: 'percentage', creditLimit: 300000, currentBalance: 0, paymentTerms: 'net_45', status: 'active', isActive: true },
      { id: uuid('ta-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), agencyName: 'Expedia Affiliate', code: 'EXP-001', contactPerson: 'Global Support', email: 'partner@expedia.com', phone: '+1-866-310-5768', city: 'Seattle', country: 'USA', commissionRate: 18, commissionType: 'percentage', creditLimit: 1000000, currentBalance: 520000, paymentTerms: 'net_30', status: 'active', isActive: true },
      { id: uuid('ta-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), agencyName: 'Goibibo Corporate', code: 'GIB-001', contactPerson: 'Anil Mehta', email: 'corporate@goibibo.com', phone: '+91-124-9876543', city: 'Gurgaon', country: 'India', commissionRate: 14, commissionType: 'percentage', creditLimit: 600000, currentBalance: 85000, paymentTerms: 'net_30', status: 'active', isActive: true },
    ]});
    await prisma.cityLedgerInvoice.createMany({ data: [
      { id: uuid('cli-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), travelAgentId: uuid('ta-1'), accountName: 'Thomas Cook India', accountType: 'travel_agent', invoiceNumber: 'CL-2024-001', invoiceDate: d(25), dueDate: d(5), subtotal: 85000, tax: 15300, total: 100300, currency: 'INR', status: 'paid', paidAmount: 100300 },
      { id: uuid('cli-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), travelAgentId: uuid('ta-2'), accountName: 'MakeMyTrip Business', accountType: 'travel_agent', invoiceNumber: 'CL-2024-002', invoiceDate: d(20), dueDate: d(5), subtotal: 240000, tax: 43200, total: 283200, currency: 'INR', status: 'overdue', paidAmount: 200000 },
      { id: uuid('cli-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), travelAgentId: uuid('ta-4'), accountName: 'Expedia Affiliate', accountType: 'travel_agent', invoiceNumber: 'CL-2024-003', invoiceDate: d(15), dueDate: new Date(today.getTime() + 15 * 864e5), subtotal: 320000, tax: 57600, total: 377600, currency: 'INR', status: 'sent' },
      { id: uuid('cli-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), travelAgentId: uuid('ta-2'), accountName: 'MakeMyTrip Business', accountType: 'travel_agent', invoiceNumber: 'CL-2024-004', invoiceDate: d(5), dueDate: new Date(today.getTime() + 10 * 864e5), subtotal: 175000, tax: 31500, total: 206500, currency: 'INR', status: 'draft' },
      { id: uuid('cli-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), travelAgentId: uuid('ta-5'), accountName: 'Goibibo Corporate', accountType: 'travel_agent', invoiceNumber: 'CL-2024-005', invoiceDate: d(30), dueDate: today, subtotal: 65000, tax: 11700, total: 76700, currency: 'INR', status: 'partial', paidAmount: 40000 },
    ]});
    await prisma.cityLedgerItem.createMany({ data: [
      { id: uuid('clitem-1'), invoiceId: uuid('cli-1'), description: '5 nights Deluxe Room', amount: 27500, quantity: 5, folioId: uuid('folio-2') },
      { id: uuid('clitem-2'), invoiceId: uuid('cli-1'), description: 'Room service & F&B', amount: 18500 },
      { id: uuid('clitem-3'), invoiceId: uuid('cli-1'), description: 'Spa treatments', amount: 12000 },
      { id: uuid('clitem-4'), invoiceId: uuid('cli-1'), description: 'Airport transfer', amount: 8500, quantity: 3 },
      { id: uuid('clitem-5'), invoiceId: uuid('cli-2'), description: '10 nights Standard Room', amount: 35000, quantity: 10 },
      { id: uuid('clitem-6'), invoiceId: uuid('cli-2'), description: 'Conference room - 2 days', amount: 24000, quantity: 2 },
      { id: uuid('clitem-7'), invoiceId: uuid('cli-2'), description: 'Banquet dinner - 40 pax', amount: 120000 },
      { id: uuid('clitem-8'), invoiceId: uuid('cli-2'), description: 'Additional F&B', amount: 61000 },
    ]});
    await prisma.cityLedgerPayment.createMany({ data: [
      { id: uuid('clpay-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), invoiceId: uuid('cli-1'), amount: 100300, paymentMethod: 'bank_transfer', reference: 'NEFT-TCI-78901', paidAt: d(8) },
      { id: uuid('clpay-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), invoiceId: uuid('cli-2'), amount: 200000, paymentMethod: 'bank_transfer', reference: 'NEFT-MMT-45678', paidAt: d(10) },
      { id: uuid('clpay-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), invoiceId: uuid('cli-5'), amount: 40000, paymentMethod: 'upi', reference: 'UPI-GIB-12345', paidAt: d(7) },
    ]});
    console.log('   ✅ 5 agents, 5 invoices, 8 items, 3 payments');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 3. Commission Management ─────────────────────────────────
  console.log('3/9 Commission Management...');
  try {
    await prisma.commissionRule.createMany({ data: [
      { id: uuid('crule-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Booking.com Standard', description: '15% commission for Booking.com', sourceType: 'ota', commissionType: 'percentage', rate: 15, isActive: true, validFrom: new Date('2024-01-01') },
      { id: uuid('crule-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Expedia Partner', description: '18% for Expedia', sourceType: 'ota', commissionType: 'percentage', rate: 18, isActive: true, validFrom: new Date('2024-01-01') },
      { id: uuid('crule-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Thomas Cook Travel Agent', description: '12% for Thomas Cook', sourceType: 'travel_agent', sourceId: uuid('ta-1'), commissionType: 'percentage', rate: 12, isActive: true, validFrom: new Date('2024-01-01') },
      { id: uuid('crule-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Corporate Referral Bonus', description: 'Flat INR 500 per corporate referral', sourceType: 'corporate', commissionType: 'flat', fixedAmount: 500, isActive: true, validFrom: new Date('2024-04-01') },
      { id: uuid('crule-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Loyalty Member Referral', description: '8% for loyalty referrals', sourceType: 'referral', commissionType: 'percentage', rate: 8, isActive: true, validFrom: new Date('2024-01-01') },
      { id: uuid('crule-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Goibibo Dynamic', description: 'Tiered: 12-16%', sourceType: 'ota', commissionType: 'tiered', rate: 12, maxAmount: 16, isActive: true, validFrom: new Date('2024-03-01') },
    ]});
    await prisma.commissionRecord.createMany({ data: [
      { id: uuid('crec-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('crule-1'), bookingId: uuid('booking-3'), sourceType: 'ota', sourceName: 'Booking.com', bookingAmount: 22000, commissionAmount: 3300, status: 'accrued' },
      { id: uuid('crec-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('crule-1'), bookingId: uuid('booking-5'), sourceType: 'ota', sourceName: 'Booking.com', bookingAmount: 10500, commissionAmount: 1575, status: 'accrued' },
      { id: uuid('crec-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('crule-3'), bookingId: uuid('booking-1'), sourceType: 'travel_agent', sourceName: 'Thomas Cook India', bookingAmount: 16500, commissionAmount: 1980, status: 'invoiced', invoicedAt: d(25) },
      { id: uuid('crec-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('crule-2'), bookingId: uuid('booking-2'), sourceType: 'ota', sourceName: 'Expedia', bookingAmount: 48000, commissionAmount: 8640, status: 'paid', invoicedAt: d(15), paidAt: d(10) },
      { id: uuid('crec-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('crule-4'), bookingId: uuid('booking-6'), sourceType: 'corporate', sourceName: 'TCS Corporate', bookingAmount: 10500, commissionAmount: 500, status: 'accrued' },
    ]});
    console.log('   ✅ 6 rules, 5 records');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 4. Minibar Management ────────────────────────────────────
  console.log('4/9 Minibar Management...');
  try {
    await prisma.minibarItem.createMany({ data: [
      { id: uuid('mbitem-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Coca-Cola Can', category: 'beverage', sku: 'MB-BEV-001', costPrice: 30, sellPrice: 80, currency: 'INR', isActive: true, sortOrder: 1 },
      { id: uuid('mbitem-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Sprite Can', category: 'beverage', sku: 'MB-BEV-002', costPrice: 30, sellPrice: 80, currency: 'INR', isActive: true, sortOrder: 2 },
      { id: uuid('mbitem-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Kingfisher Beer 330ml', category: 'beverage', sku: 'MB-BEV-003', costPrice: 60, sellPrice: 180, currency: 'INR', isActive: true, sortOrder: 3 },
      { id: uuid('mbitem-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Red Bull 250ml', category: 'beverage', sku: 'MB-BEV-004', costPrice: 90, sellPrice: 200, currency: 'INR', isActive: true, sortOrder: 4 },
      { id: uuid('mbitem-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Mineral Water 500ml', category: 'beverage', sku: 'MB-BEV-005', costPrice: 15, sellPrice: 50, currency: 'INR', isActive: true, sortOrder: 5 },
      { id: uuid('mbitem-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Potato Chips (Lays)', category: 'snack', sku: 'MB-SNK-001', costPrice: 20, sellPrice: 60, currency: 'INR', isActive: true, sortOrder: 6 },
      { id: uuid('mbitem-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Mixed Nuts Pack', category: 'snack', sku: 'MB-SNK-002', costPrice: 80, sellPrice: 200, currency: 'INR', isActive: true, sortOrder: 7 },
      { id: uuid('mbitem-8'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Chocolate Bar (Dairy Milk)', category: 'snack', sku: 'MB-SNK-003', costPrice: 40, sellPrice: 100, currency: 'INR', isActive: true, sortOrder: 8 },
      { id: uuid('mbitem-9'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Johnnie Walker Red Label 50ml', category: 'premium', sku: 'MB-PRM-001', costPrice: 150, sellPrice: 450, currency: 'INR', isActive: true, sortOrder: 9 },
      { id: uuid('mbitem-10'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Champagne Mini 187ml', category: 'premium', sku: 'MB-PRM-002', costPrice: 400, sellPrice: 1200, currency: 'INR', isActive: true, sortOrder: 10 },
    ]});
    await prisma.minibarSetup.createMany({ data: [
      { id: uuid('mbsetup-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-501'), itemJson: JSON.stringify([{ itemId: uuid('mbitem-1'), quantity: 2, threshold: 1 }, { itemId: uuid('mbitem-5'), quantity: 4, threshold: 2 }, { itemId: uuid('mbitem-6'), quantity: 2, threshold: 1 }, { itemId: uuid('mbitem-8'), quantity: 2, threshold: 1 }]), lastRestockedAt: d(1), restockedBy: 'user-3' },
      { id: uuid('mbsetup-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-801'), itemJson: JSON.stringify([{ itemId: uuid('mbitem-1'), quantity: 2, threshold: 1 }, { itemId: uuid('mbitem-3'), quantity: 3, threshold: 1 }, { itemId: uuid('mbitem-5'), quantity: 4, threshold: 2 }, { itemId: uuid('mbitem-7'), quantity: 2, threshold: 1 }, { itemId: uuid('mbitem-9'), quantity: 2, threshold: 1 }]), lastRestockedAt: d(2), restockedBy: 'user-3' },
      { id: uuid('mbsetup-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), roomId: uuid('room-305'), itemJson: JSON.stringify([{ itemId: uuid('mbitem-1'), quantity: 2, threshold: 1 }, { itemId: uuid('mbitem-5'), quantity: 4, threshold: 2 }]), lastRestockedAt: d(3), restockedBy: 'user-3' },
    ]});
    await prisma.minibarConsumption.createMany({ data: [
      { id: uuid('mbcons-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-1'), folioId: uuid('folio-1'), roomId: uuid('room-501'), itemId: uuid('mbitem-3'), itemName: 'Kingfisher Beer 330ml', quantity: 2, unitPrice: 180, totalPrice: 360, consumedAt: d(1), postedToFolio: true, postedAt: d(1), consumedBy: 'Guest Amit Mukherjee' },
      { id: uuid('mbcons-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-1'), folioId: uuid('folio-1'), roomId: uuid('room-501'), itemId: uuid('mbitem-7'), itemName: 'Mixed Nuts Pack', quantity: 1, unitPrice: 200, totalPrice: 200, consumedAt: new Date(today.getTime() - 12 * 36e5), postedToFolio: false, consumedBy: 'Guest Amit Mukherjee' },
      { id: uuid('mbcons-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-2'), folioId: uuid('folio-2'), roomId: uuid('room-801'), itemId: uuid('mbitem-9'), itemName: 'Johnnie Walker Red Label 50ml', quantity: 1, unitPrice: 450, totalPrice: 450, consumedAt: new Date(today.getTime() - 8 * 36e5), postedToFolio: true, postedAt: new Date(today.getTime() - 8 * 36e5), consumedBy: 'Guest Rahul Banerjee' },
      { id: uuid('mbcons-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-2'), folioId: uuid('folio-2'), roomId: uuid('room-801'), itemId: uuid('mbitem-10'), itemName: 'Champagne Mini 187ml', quantity: 1, unitPrice: 1200, totalPrice: 1200, consumedAt: new Date(today.getTime() - 10 * 36e5), postedToFolio: true, postedAt: new Date(today.getTime() - 10 * 36e5), consumedBy: 'Guest Rahul Banerjee' },
      { id: uuid('mbcons-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-6'), folioId: uuid('folio-6'), roomId: uuid('room-305'), itemId: uuid('mbitem-1'), itemName: 'Coca-Cola Can', quantity: 1, unitPrice: 80, totalPrice: 80, consumedAt: d(2), postedToFolio: true, postedAt: d(2), consumedBy: 'Guest Rina Chatterjee' },
    ]});
    console.log('   ✅ 10 items, 3 setups, 5 consumptions');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 5. Lost & Found ──────────────────────────────────────────
  console.log('5/9 Lost & Found...');
  try {
    await prisma.lostFoundItem.createMany({ data: [
      { id: uuid('lf-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'electronics', description: 'iPhone 15 Pro charger (white, USB-C)', locationFound: 'Room 501 - bedside table', roomId: uuid('room-501'), foundBy: 'Anita Roy (HK)', foundAt: d(1), status: 'reported', storageLocation: 'HK Office - Shelf A3', guestId: uuid('guest-1'), bookingId: uuid('booking-1'), notes: 'Left behind after checkout. Guest notified.' },
      { id: uuid('lf-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'accessories', description: 'Gold wrist watch with brown leather strap', locationFound: 'Hotel Restaurant - Table T2', foundBy: 'Suman (Restaurant)', finderContact: '+91-9876543210', foundAt: d(3), status: 'matched', matchedAt: d(2), storageLocation: 'Front Desk Safe - Locker 5', returnedTo: 'Vikram Singh', returnedAt: new Date(today.getTime() - 1.5 * 864e5), guestId: uuid('guest-5'), bookingId: uuid('booking-4') },
      { id: uuid('lf-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'lost', category: 'documents', description: 'Passport - Indian (Sneha Gupta)', guestId: uuid('guest-2'), bookingId: uuid('booking-3'), status: 'reported', notes: 'Guest reported missing passport. Checking CCTV.' },
      { id: uuid('lf-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'clothing', description: 'Black blazer - size M, Hugo Boss', locationFound: 'Conference Room B', foundBy: 'Priya Das (FD)', foundAt: d(7), status: 'reported', storageLocation: 'Lost & Found Storage - Rack B2' },
      { id: uuid('lf-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'electronics', description: 'Samsung Galaxy Buds 2 Pro (white)', locationFound: 'Gym - locker area', foundBy: 'Raj (Gym Staff)', foundAt: d(14), status: 'disposed', disposedAt: d(7), disposalReason: 'Unclaimed after 7 days.' },
      { id: uuid('lf-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'other', description: 'Children\'s storybook - "The Very Hungry Caterpillar"', locationFound: 'Lobby - sofa', foundBy: 'Anita Roy (HK)', foundAt: d(5), status: 'claimed', matchedAt: d(4), returnedTo: 'Guest family', returnedAt: d(4) },
      { id: uuid('lf-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), itemType: 'found', category: 'accessories', description: 'Ray-Ban sunglasses (black, aviator)', locationFound: 'Poolside deck chair #7', foundBy: 'Pool attendant', foundAt: d(2), status: 'reported', storageLocation: 'Front Desk Safe - Locker 2' },
    ]});
    console.log('   ✅ 7 items');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 6. Laundry Management ────────────────────────────────────
  console.log('6/9 Laundry Management...');
  try {
    await prisma.laundryItem.createMany({ data: [
      { id: uuid('li-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Shirt - Wash & Iron', category: 'guest', serviceType: 'wash', unitPrice: 80, currency: 'INR', turnaroundHours: 12, isActive: true, sortOrder: 1 },
      { id: uuid('li-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Trousers - Wash & Iron', category: 'guest', serviceType: 'wash', unitPrice: 100, currency: 'INR', turnaroundHours: 12, isActive: true, sortOrder: 2 },
      { id: uuid('li-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Suit - Dry Clean', category: 'guest', serviceType: 'dry_clean', unitPrice: 500, currency: 'INR', turnaroundHours: 48, isActive: true, sortOrder: 3 },
      { id: uuid('li-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Saree - Dry Clean', category: 'guest', serviceType: 'dry_clean', unitPrice: 350, currency: 'INR', turnaroundHours: 48, isActive: true, sortOrder: 4 },
      { id: uuid('li-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Bed Sheet - Commercial', category: 'linen', serviceType: 'wash', unitPrice: 40, currency: 'INR', turnaroundHours: 8, isActive: true, sortOrder: 5 },
      { id: uuid('li-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Bath Towel - Commercial', category: 'linen', serviceType: 'wash', unitPrice: 25, currency: 'INR', turnaroundHours: 8, isActive: true, sortOrder: 6 },
      { id: uuid('li-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Drape / Curtain - Dry Clean', category: 'drape', serviceType: 'dry_clean', unitPrice: 600, currency: 'INR', turnaroundHours: 72, isActive: true, sortOrder: 7 },
      { id: uuid('li-8'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Staff Uniform Shirt', category: 'staff_uniform', serviceType: 'wash', unitPrice: 30, currency: 'INR', turnaroundHours: 24, isActive: true, sortOrder: 8 },
    ]});
    await prisma.laundryOrder.createMany({ data: [
      { id: uuid('lord-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-1'), guestId: uuid('guest-1'), roomId: uuid('room-501'), orderType: 'guest', status: 'delivered', receivedAt: new Date(today.getTime() - 1.5 * 864e5), readyAt: new Date(today.getTime() - 1.2 * 864e5), deliveredAt: d(1), totalItems: 4, totalPrice: 760, currency: 'INR', folioId: uuid('folio-1'), postedToFolio: true, collectedBy: uuid('user-3'), deliveredBy: uuid('user-3') },
      { id: uuid('lord-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-2'), guestId: uuid('guest-3'), roomId: uuid('room-801'), orderType: 'guest', status: 'in_progress', receivedAt: new Date(today.getTime() - 8 * 36e5), totalItems: 3, totalPrice: 950, currency: 'INR', folioId: uuid('folio-2'), specialInstructions: 'VIP — priority. Stain removal on left lapel.' },
      { id: uuid('lord-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), orderType: 'housekeeping', roomId: uuid('room-510'), status: 'ready', receivedAt: d(2), readyAt: new Date(today.getTime() - 1.5 * 864e5), totalItems: 15, totalPrice: 750, currency: 'INR' },
      { id: uuid('lord-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), bookingId: uuid('booking-4'), guestId: uuid('guest-5'), roomId: uuid('room-1002'), orderType: 'guest', status: 'received', receivedAt: new Date(today.getTime() - 2 * 36e5), totalItems: 6, totalPrice: 2400, currency: 'INR' },
      { id: uuid('lord-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), orderType: 'housekeeping', roomId: uuid('room-101'), status: 'delivered', receivedAt: d(3), readyAt: new Date(today.getTime() - 2.5 * 864e5), deliveredAt: d(2), totalItems: 20, totalPrice: 1000, currency: 'INR' },
      { id: uuid('lord-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), orderType: 'housekeeping', status: 'in_progress', receivedAt: new Date(today.getTime() - 4 * 36e5), totalItems: 8, totalPrice: 4800, currency: 'INR', notes: 'Staff uniform batch.' },
    ]});
    await prisma.laundryOrderItem.createMany({ data: [
      { id: uuid('lori-1-1'), orderId: uuid('lord-1'), itemId: uuid('li-1'), itemName: 'Shirt - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 80, totalPrice: 160, status: 'delivered' },
      { id: uuid('lori-1-2'), orderId: uuid('lord-1'), itemId: uuid('li-2'), itemName: 'Trousers - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 100, totalPrice: 200, status: 'delivered' },
      { id: uuid('lori-1-3'), orderId: uuid('lord-1'), itemId: uuid('li-3'), itemName: 'Suit - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'delivered' },
      { id: uuid('lori-1-4'), orderId: uuid('lord-1'), itemId: uuid('li-4'), itemName: 'Saree - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 350, totalPrice: 350, status: 'delivered' },
      { id: uuid('lori-2-1'), orderId: uuid('lord-2'), itemId: uuid('li-3'), itemName: 'Suit - Dry Clean', serviceType: 'dry_clean', quantity: 1, unitPrice: 500, totalPrice: 500, status: 'in_progress' },
      { id: uuid('lori-2-2'), orderId: uuid('lord-2'), itemId: uuid('li-1'), itemName: 'Shirt - Wash & Iron', serviceType: 'wash', quantity: 2, unitPrice: 80, totalPrice: 160, status: 'in_progress' },
      { id: uuid('lori-2-3'), orderId: uuid('lord-2'), itemId: uuid('li-2'), itemName: 'Trousers - Wash & Iron', serviceType: 'wash', quantity: 1, unitPrice: 100, totalPrice: 100, status: 'in_progress' },
      { id: uuid('lori-4-1'), orderId: uuid('lord-4'), itemId: uuid('li-7'), itemName: 'Drape - Dry Clean', serviceType: 'dry_clean', quantity: 4, unitPrice: 600, totalPrice: 2400, status: 'received' },
    ]});
    console.log('   ✅ 8 items, 6 orders, 8 order items');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 7. Package Plans / Rate Bundling ──────────────────────────
  console.log('7/9 Package Plans...');
  try {
    await prisma.packagePlan.createMany({ data: [
      { id: uuid('pkg-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Honeymoon Bliss Package', description: 'Romantic getaway with breakfast, spa, late checkout', baseRoomTypeId: uuid('roomtype-3'), roomRateInclusive: true, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), minNights: 2, maxNights: 5, totalBasePrice: 25000, currency: 'INR', sortOrder: 1, status: 'active' },
      { id: uuid('pkg-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Business Executive Package', description: 'Corporate stay with breakfast, airport transfer, meeting room', baseRoomTypeId: uuid('roomtype-2'), roomRateInclusive: true, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), minNights: 1, maxNights: 7, totalBasePrice: 12000, currency: 'INR', sortOrder: 2, status: 'active' },
      { id: uuid('pkg-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Family Fun Weekend', description: 'Family package with meals, kids activities, pool', baseRoomTypeId: uuid('roomtype-2'), roomRateInclusive: false, startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31'), minNights: 2, maxNights: 3, totalBasePrice: 18000, currency: 'INR', sortOrder: 3, status: 'active' },
      { id: uuid('pkg-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Royal Experience (Presidential)', description: 'Ultimate luxury: butler, all meals, spa, limo', baseRoomTypeId: uuid('roomtype-4'), roomRateInclusive: true, startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), minNights: 2, totalBasePrice: 85000, currency: 'INR', sortOrder: 4, status: 'active' },
      { id: uuid('pkg-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Staycation Express', description: '1-night getaway with breakfast and late checkout', baseRoomTypeId: uuid('roomtype-1'), roomRateInclusive: true, startDate: new Date('2024-06-01'), endDate: new Date('2025-05-31'), minNights: 1, maxNights: 1, totalBasePrice: 5500, currency: 'INR', sortOrder: 5, status: 'active' },
    ]});
    await prisma.packageComponent.createMany({ data: [
      { id: uuid('pkgcomp-1-1'), packagePlanId: uuid('pkg-1'), componentType: 'meal', referenceName: 'Daily Breakfast for 2', includedQty: 2, unitCost: 1200, isIncluded: true, sortOrder: 1 },
      { id: uuid('pkgcomp-1-2'), packagePlanId: uuid('pkg-1'), componentType: 'spa', referenceName: 'Couples Spa Treatment (60 min)', includedQty: 1, unitCost: 4000, isIncluded: true, sortOrder: 2 },
      { id: uuid('pkgcomp-1-3'), packagePlanId: uuid('pkg-1'), componentType: 'late_checkout', referenceName: 'Late Checkout (2 PM)', includedQty: 1, unitCost: 0, isIncluded: true, sortOrder: 3 },
      { id: uuid('pkgcomp-1-4'), packagePlanId: uuid('pkg-1'), componentType: 'other', referenceName: 'Welcome amenities', includedQty: 1, unitCost: 500, isIncluded: true, sortOrder: 4 },
      { id: uuid('pkgcomp-2-1'), packagePlanId: uuid('pkg-2'), componentType: 'meal', referenceName: 'Daily Buffet Breakfast', includedQty: 1, unitCost: 800, isIncluded: true, sortOrder: 1 },
      { id: uuid('pkgcomp-2-2'), packagePlanId: uuid('pkg-2'), componentType: 'airport_transfer', referenceName: 'Airport Pickup & Drop', includedQty: 1, unitCost: 2000, isIncluded: true, sortOrder: 2 },
      { id: uuid('pkgcomp-2-3'), packagePlanId: uuid('pkg-2'), componentType: 'other', referenceName: 'Meeting Room (4 hrs/day)', includedQty: 1, unitCost: 3000, isIncluded: true, sortOrder: 3 },
      { id: uuid('pkgcomp-2-4'), packagePlanId: uuid('pkg-2'), componentType: 'laundry', referenceName: 'Daily Laundry (3 pcs)', includedQty: 3, unitCost: 200, isIncluded: true, sortOrder: 4 },
      { id: uuid('pkgcomp-3-1'), packagePlanId: uuid('pkg-3'), componentType: 'meal', referenceName: 'Breakfast + Dinner', includedQty: 2, unitCost: 2500, isIncluded: true, sortOrder: 1 },
      { id: uuid('pkgcomp-3-2'), packagePlanId: uuid('pkg-3'), componentType: 'experience', referenceName: 'Kids Activity Workshop', includedQty: 2, unitCost: 500, isIncluded: true, sortOrder: 2 },
      { id: uuid('pkgcomp-4-1'), packagePlanId: uuid('pkg-4'), componentType: 'meal', referenceName: 'All Meals', includedQty: 3, unitCost: 5000, isIncluded: true, sortOrder: 1 },
      { id: uuid('pkgcomp-4-2'), packagePlanId: uuid('pkg-4'), componentType: 'spa', referenceName: 'Daily Spa Treatment', includedQty: 2, unitCost: 5000, isIncluded: true, sortOrder: 2 },
      { id: uuid('pkgcomp-4-3'), packagePlanId: uuid('pkg-4'), componentType: 'airport_transfer', referenceName: 'Luxury Limousine', includedQty: 2, unitCost: 5000, isIncluded: true, sortOrder: 3 },
    ]});
    await prisma.packageRate.createMany({ data: [
      { id: uuid('pkgrate-1-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), packagePlanId: uuid('pkg-1'), roomTypeId: uuid('roomtype-3'), startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), price: 25000, currency: 'INR', minStay: 2, maxStay: 5, status: 'active' },
      { id: uuid('pkgrate-2-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), packagePlanId: uuid('pkg-2'), roomTypeId: uuid('roomtype-2'), startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), price: 12000, currency: 'INR', minStay: 1, maxStay: 7, status: 'active' },
      { id: uuid('pkgrate-2-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), packagePlanId: uuid('pkg-2'), roomTypeId: uuid('roomtype-3'), startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), price: 18000, currency: 'INR', minStay: 1, maxStay: 7, status: 'active' },
      { id: uuid('pkgrate-3-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), packagePlanId: uuid('pkg-3'), roomTypeId: uuid('roomtype-2'), startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31'), price: 18000, currency: 'INR', minStay: 2, maxStay: 3, status: 'active' },
      { id: uuid('pkgrate-5-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), packagePlanId: uuid('pkg-5'), roomTypeId: uuid('roomtype-1'), startDate: new Date('2024-06-01'), endDate: new Date('2025-05-31'), price: 5500, currency: 'INR', minStay: 1, maxStay: 1, status: 'active' },
    ]});
    console.log('   ✅ 5 plans, 13 components, 5 rates');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 8. Scheduled / Recurring Charges ─────────────────────────
  console.log('8/9 Scheduled Charges...');
  try {
    await prisma.scheduledCharge.createMany({ data: [
      { id: uuid('sc-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-1'), bookingId: uuid('booking-1'), chargeType: 'room_charge', description: 'Daily room charge - Deluxe 501', category: 'Room', amount: 5500, currency: 'INR', frequency: 'daily', startDate: d(2), endDate: new Date(today.getTime() + 864e5), nextExecutionAt: new Date(today.getTime() + 864e5), lastExecutedAt: today, isActive: true, executedCount: 2 },
      { id: uuid('sc-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-1'), bookingId: uuid('booking-1'), chargeType: 'resort_fee', description: 'Resort fee - pool, gym, WiFi', category: 'Service', amount: 500, currency: 'INR', frequency: 'daily', startDate: d(2), endDate: new Date(today.getTime() + 864e5), nextExecutionAt: new Date(today.getTime() + 864e5), lastExecutedAt: today, isActive: true, executedCount: 2 },
      { id: uuid('sc-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-3'), bookingId: uuid('booking-3'), chargeType: 'room_charge', description: 'Daily room charge - Deluxe 510', category: 'Room', amount: 5500, currency: 'INR', frequency: 'daily', startDate: today, endDate: new Date(today.getTime() + 4 * 864e5), nextExecutionAt: new Date(today.getTime() + 864e5), isActive: true },
      { id: uuid('sc-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-2'), bookingId: uuid('booking-2'), chargeType: 'minibar', description: 'Daily minibar restocking fee', category: 'F&B', amount: 200, currency: 'INR', frequency: 'daily', startDate: d(1), endDate: new Date(today.getTime() + 3 * 864e5), nextExecutionAt: new Date(today.getTime() + 864e5), lastExecutedAt: today, isActive: true, executedCount: 1 },
      { id: uuid('sc-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-1'), bookingId: uuid('booking-1'), chargeType: 'incidentals', description: 'Extra bed charge', category: 'Room', amount: 1500, currency: 'INR', frequency: 'once', startDate: d(2), nextExecutionAt: d(2), lastExecutedAt: d(2), isActive: false, executedCount: 1, maxAmount: 1500 },
      { id: uuid('sc-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), folioId: uuid('folio-4'), bookingId: uuid('booking-4'), chargeType: 'resort_fee', description: 'Presidential Suite amenity fee', category: 'Service', amount: 2000, currency: 'INR', frequency: 'daily', startDate: today, endDate: new Date(today.getTime() + 2 * 864e5), nextExecutionAt: new Date(today.getTime() + 864e5), isActive: true },
    ]});
    console.log('   ✅ 6 scheduled charges');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  // ── 9. Posting Rules / Auto-Charge Routing ───────────────────
  console.log('9/9 Posting Rules...');
  try {
    await prisma.revenueAccount.createMany({ data: [
      { id: uuid('ra-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'ROOM-REVENUE', name: 'Room Revenue', accountType: 'revenue', category: 'room', description: 'All room charges', isActive: true, sortOrder: 1 },
      { id: uuid('ra-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'FB-REVENUE', name: 'Food & Beverage Revenue', accountType: 'revenue', category: 'food_beverage', description: 'Restaurant, room service, minibar', isActive: true, sortOrder: 2 },
      { id: uuid('ra-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'MINIBAR-REVENUE', name: 'Minibar Revenue', accountType: 'revenue', category: 'minibar', isActive: true, sortOrder: 3 },
      { id: uuid('ra-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'LAUNDRY-REVENUE', name: 'Laundry Revenue', accountType: 'revenue', category: 'laundry', isActive: true, sortOrder: 4 },
      { id: uuid('ra-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'SPA-REVENUE', name: 'Spa Revenue', accountType: 'revenue', category: 'other', isActive: true, sortOrder: 5 },
      { id: uuid('ra-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'SERVICE-CHARGE', name: 'Service Charges', accountType: 'revenue', category: 'miscellaneous', description: 'Resort fees, surcharges', isActive: true, sortOrder: 6 },
      { id: uuid('ra-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'PARKING-REVENUE', name: 'Parking Revenue', accountType: 'revenue', category: 'other', isActive: true, sortOrder: 7 },
      { id: uuid('ra-8'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), code: 'TAX-COLLECTED', name: 'Tax Collected (GST)', accountType: 'liability', category: 'miscellaneous', isActive: true, sortOrder: 8 },
    ]});
    await prisma.postingRule.createMany({ data: [
      { id: uuid('prule-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Auto-Post Room Charges', description: 'Post daily room charges at midnight', chargeCategory: 'Room', chargeType: 'room_charge', revenueAccountId: uuid('ra-1'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 10, conditions: JSON.stringify({ trigger: 'night_audit', frequency: 'daily' }) },
      { id: uuid('prule-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Auto-Post Minibar Charges', description: 'Post minibar on checkout', chargeCategory: 'F&B', chargeType: 'minibar', revenueAccountId: uuid('ra-3'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 5, conditions: JSON.stringify({ trigger: 'checkout' }) },
      { id: uuid('prule-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Auto-Post Laundry Charges', description: 'Post completed laundry to folio', chargeCategory: 'Service', chargeType: 'laundry', revenueAccountId: uuid('ra-4'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 5, conditions: JSON.stringify({ trigger: 'laundry_delivered' }) },
      { id: uuid('prule-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Resort Fee Auto-Post', description: 'Daily resort fee for amenity access', chargeCategory: 'Service', chargeType: 'resort_fee', revenueAccountId: uuid('ra-6'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 8, conditions: JSON.stringify({ trigger: 'night_audit', frequency: 'daily' }) },
      { id: uuid('prule-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'No-Show Penalty', description: 'Charge no-show guests per policy', chargeCategory: 'Room', chargeType: 'penalty', revenueAccountId: uuid('ra-1'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 9, conditions: JSON.stringify({ trigger: 'no_show' }) },
      { id: uuid('prule-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), name: 'Extended Stay Surcharge', description: '10% surcharge beyond planned checkout', chargeCategory: 'Room', chargeType: 'extension', revenueAccountId: uuid('ra-1'), taxTreatment: 'taxable', autoPost: true, isActive: true, priority: 7, conditions: JSON.stringify({ trigger: 'extension', surchargePercent: 10 }) },
    ]});
    await prisma.postingLog.createMany({ data: [
      { id: uuid('plog-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('prule-1'), folioId: uuid('folio-1'), chargeAmount: 5500, revenueAccountCode: 'ROOM-REVENUE', autoPosted: true },
      { id: uuid('plog-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('prule-1'), folioId: uuid('folio-2'), chargeAmount: 12000, revenueAccountCode: 'ROOM-REVENUE', autoPosted: true },
      { id: uuid('plog-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('prule-2'), folioId: uuid('folio-1'), chargeAmount: 360, revenueAccountCode: 'MINIBAR-REVENUE', autoPosted: true },
      { id: uuid('plog-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('prule-4'), folioId: uuid('folio-1'), chargeAmount: 500, revenueAccountCode: 'SERVICE-CHARGE', autoPosted: true },
      { id: uuid('plog-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'), ruleId: uuid('prule-3'), folioId: uuid('folio-2'), chargeAmount: 760, revenueAccountCode: 'LAUNDRY-REVENUE', autoPosted: true },
    ]});
    console.log('   ✅ 8 revenue accounts, 6 posting rules, 5 logs');
  } catch (e: any) { console.log('   ⚠️', e.message?.substring(0, 80)); }

  console.log('\n✅ All 9 features seeded successfully!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
