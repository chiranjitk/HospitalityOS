import { createHash } from 'crypto';

// Deterministic UUID generator — same input always produces same UUID v4.
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

// ── Existing seed IDs ──
const T1 = uuid('tenant-1');
const T2 = uuid('tenant-2');
const P1 = uuid('property-1');
const P2 = uuid('property-2');
const G1 = uuid('guest-1');
const G2 = uuid('guest-2');
const G3 = uuid('guest-3');
const G4 = uuid('guest-4');
const G5 = uuid('guest-5');
const G6 = uuid('guest-6');
const B1 = uuid('booking-1');
const B2 = uuid('booking-2');
const B3 = uuid('booking-3');
const B4 = uuid('booking-4');
const B5 = uuid('booking-5');
const B6 = uuid('booking-6');
const F1 = uuid('folio-1');
const F2 = uuid('folio-2');
const F3 = uuid('folio-3');
const F4 = uuid('folio-4');
const F5 = uuid('folio-5');
const F6 = uuid('folio-6');
const RP1 = uuid('rateplan-1');
const RP2 = uuid('rateplan-2');
const RP3 = uuid('rateplan-3');
const RP4 = uuid('rateplan-4');
const RP5 = uuid('rateplan-5');
const RP6 = uuid('rateplan-6');
const RP7 = uuid('rateplan-7');
const SEG1 = uuid('segment-1');
const SEG2 = uuid('segment-2');
const SEG3 = uuid('segment-3');
const CAMP1 = uuid('campaign-1');
const CAMP2 = uuid('campaign-2');
const V1 = uuid('vendor-1');
const V2 = uuid('vendor-2');
const V3 = uuid('vendor-3');
const CRULE1 = uuid('crule-1');
const CRULE2 = uuid('crule-2');
const CRULE3 = uuid('crule-3');
const GST1 = uuid('gst-settings-1');
const LTIER1 = uuid('ltier-1');
const LTIER2 = uuid('ltier-2');
const LTIER3 = uuid('ltier-3');
const LREWARD1 = uuid('lreward-1');
const LREWARD2 = uuid('lreward-2');
const LREWARD3 = uuid('lreward-3');
const FA_ROOM = uuid('fa-room-rev');
const FA_FB = uuid('fa-fb-rev');

// ── Helper ──
const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt;
};
const daysFromNow = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt;
};

export async function seedGroupBData(prisma: any) {
  console.log('=== Seeding Group B tables (28 models) ===\n');

  // ─────────────────────────────────────────────────────────────
  // 1. SegmentMembership
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.segmentMembership.createMany({
      data: [
        { id: uuid('segmem-1'), segmentId: SEG1, guestId: G1, addedAt: daysAgo(60) },
        { id: uuid('segmem-2'), segmentId: SEG1, guestId: G3, addedAt: daysAgo(45) },
        { id: uuid('segmem-3'), segmentId: SEG2, guestId: G2, addedAt: daysAgo(30) },
        { id: uuid('segmem-4'), segmentId: SEG2, guestId: G4, addedAt: daysAgo(20) },
        { id: uuid('segmem-5'), segmentId: SEG3, guestId: G5, addedAt: daysAgo(15) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ SegmentMembership (5 rows)');
  } catch (e: any) {
    console.log('✗ SegmentMembership:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. GuestBehavior
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.guestBehavior.createMany({
      data: [
        {
          id: uuid('behav-1'), tenantId: T1, guestId: G1,
          visitCount: 12, firstVisitAt: daysAgo(365), lastVisitAt: daysAgo(2),
          totalBookings: 15, cancelledBookings: 1, noShowCount: 0,
          totalSpent: 285000, avgBookingValue: 19000, lifetimeValue: 285000,
          totalNights: 38, avgStayLength: 2.53,
          preferredRoomTypes: JSON.stringify(['Deluxe Room', 'Executive Suite']),
          bookingSources: JSON.stringify({ direct: 10, booking_com: 5 }),
          serviceRequests: 8, foodOrders: 22, spaBookings: 4,
          learnedPreferences: JSON.stringify({ high_floor: true, extra_pillows: true }),
          emailOpens: 45, emailClicks: 12, smsResponses: 6,
          engagementScore: 85.5, vipScore: 92.0, vipDetectedAt: daysAgo(200),
          isRepeatGuest: true, repeatGuestSince: daysAgo(340),
        },
        {
          id: uuid('behav-2'), tenantId: T1, guestId: G2,
          visitCount: 5, firstVisitAt: daysAgo(180), lastVisitAt: daysAgo(1),
          totalBookings: 5, cancelledBookings: 0, noShowCount: 1,
          totalSpent: 96000, avgBookingValue: 19200, lifetimeValue: 96000,
          totalNights: 14, avgStayLength: 2.8,
          preferredRoomTypes: JSON.stringify(['Standard Room', 'Deluxe Room']),
          bookingSources: JSON.stringify({ booking_com: 3, direct: 2 }),
          serviceRequests: 3, foodOrders: 10, spaBookings: 1,
          learnedPreferences: JSON.stringify({ early_checkin: true }),
          emailOpens: 28, emailClicks: 7, smsResponses: 3,
          engagementScore: 62.3, vipScore: 45.0, isRepeatGuest: true, repeatGuestSince: daysAgo(120),
        },
        {
          id: uuid('behav-3'), tenantId: T1, guestId: G3,
          visitCount: 25, firstVisitAt: daysAgo(730), lastVisitAt: daysAgo(1),
          totalBookings: 30, cancelledBookings: 2, noShowCount: 0,
          totalSpent: 750000, avgBookingValue: 25000, lifetimeValue: 750000,
          totalNights: 72, avgStayLength: 2.4,
          preferredRoomTypes: JSON.stringify(['Executive Suite', 'Presidential Suite']),
          bookingSources: JSON.stringify({ direct: 25, expedia: 5 }),
          serviceRequests: 20, foodOrders: 55, spaBookings: 15,
          learnedPreferences: JSON.stringify({ suite_only: true, welcome_champagne: true, newspaper: true }),
          emailOpens: 80, emailClicks: 30, smsResponses: 15,
          engagementScore: 95.0, vipScore: 98.5, vipDetectedAt: daysAgo(600),
          isRepeatGuest: true, repeatGuestSince: daysAgo(700),
        },
        {
          id: uuid('behav-4'), tenantId: T1, guestId: G4,
          visitCount: 2, firstVisitAt: daysAgo(60), lastVisitAt: daysAgo(7),
          totalBookings: 2, cancelledBookings: 0, noShowCount: 0,
          totalSpent: 18000, avgBookingValue: 9000, lifetimeValue: 18000,
          totalNights: 5, avgStayLength: 2.5,
          preferredRoomTypes: JSON.stringify(['Standard Room']),
          bookingSources: JSON.stringify({ airbnb: 2 }),
          serviceRequests: 1, foodOrders: 3, spaBookings: 0,
          learnedPreferences: JSON.stringify({ quiet_room: true }),
          emailOpens: 5, emailClicks: 1, smsResponses: 1,
          engagementScore: 22.0, vipScore: 10.0, isRepeatGuest: false,
        },
        {
          id: uuid('behav-5'), tenantId: T1, guestId: G5,
          visitCount: 15, firstVisitAt: daysAgo(300), lastVisitAt: daysAgo(0),
          totalBookings: 18, cancelledBookings: 3, noShowCount: 1,
          totalSpent: 276000, avgBookingValue: 15333, lifetimeValue: 276000,
          totalNights: 42, avgStayLength: 2.33,
          preferredRoomTypes: JSON.stringify(['Deluxe Room', 'Executive Suite']),
          bookingSources: JSON.stringify({ expedia: 12, direct: 6 }),
          serviceRequests: 10, foodOrders: 28, spaBookings: 6,
          learnedPreferences: JSON.stringify({ late_checkout: true, gym_access: true }),
          emailOpens: 60, emailClicks: 18, smsResponses: 8,
          engagementScore: 78.0, vipScore: 88.0, vipDetectedAt: daysAgo(150),
          isRepeatGuest: true, repeatGuestSince: daysAgo(270),
        },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GuestBehavior (5 rows)');
  } catch (e: any) {
    console.log('✗ GuestBehavior:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. GuestCommunicationTimeline
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.guestCommunicationTimeline.createMany({
      data: [
        { id: uuid('comm-1'), tenantId: T1, guestId: G1, bookingId: B1, channel: 'email', direction: 'outbound', subject: 'Booking Confirmation', content: 'Your booking at Royal Stay Kolkata is confirmed.', status: 'read', sentBy: uuid('user-2'), sentAt: daysAgo(5), readAt: daysAgo(5), metadata: JSON.stringify({ templateId: 'booking-confirmation' }) },
        { id: uuid('comm-2'), tenantId: T1, guestId: G1, bookingId: B1, channel: 'email', direction: 'outbound', subject: 'Pre-Arrival Information', content: 'We look forward to welcoming you! Here are some details for your stay.', status: 'delivered', sentBy: uuid('user-2'), sentAt: daysAgo(2), metadata: JSON.stringify({ templateId: 'pre-arrival' }) },
        { id: uuid('comm-3'), tenantId: T1, guestId: G2, bookingId: B3, channel: 'sms', direction: 'outbound', subject: null, content: 'Hi Sneha! Your check-in at Royal Stay Kolkata is tomorrow at 2 PM. Reply HELP for assistance.', status: 'delivered', sentBy: uuid('user-2'), sentAt: daysAgo(1) },
        { id: uuid('comm-4'), tenantId: T1, guestId: G3, bookingId: B2, channel: 'whatsapp', direction: 'outbound', subject: null, content: 'Welcome back, Rahul! Your Executive Suite 801 is ready. We have a special welcome for you.', status: 'read', sentBy: uuid('user-2'), sentAt: daysAgo(1), readAt: daysAgo(1) },
        { id: uuid('comm-5'), tenantId: T1, guestId: G5, bookingId: B4, channel: 'email', direction: 'inbound', subject: 'Special Request for Anniversary', content: 'Hi, it is our anniversary during our stay. Can you arrange something special?', status: 'read', sentAt: daysAgo(3), readAt: daysAgo(3), metadata: JSON.stringify({ source: 'guest_portal' }) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GuestCommunicationTimeline (5 rows)');
  } catch (e: any) {
    console.log('✗ GuestCommunicationTimeline:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. GuestRecommendation
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.guestRecommendation.createMany({
      data: [
        { id: uuid('recom-1'), tenantId: T1, guestId: G1, type: 'upsell', category: 'room', title: 'Upgrade to Executive Suite', description: 'Based on your preference for premium rooms, upgrade to Suite 802 for just INR 3000/night more.', reason: 'Guest prefers high-floor deluxe rooms', estimatedValue: 6000, relevanceScore: 0.92, status: 'active', shownAt: daysAgo(2), isAiGenerated: true, aiConfidence: 0.88, expiresAt: daysFromNow(5) },
        { id: uuid('recom-2'), tenantId: T1, guestId: G3, type: 'cross_sell', category: 'dining', title: 'Chef\'s Table Experience', description: 'Exclusive 7-course dinner at our rooftop restaurant with wine pairing.', reason: 'High-value guest, previous spa and dining engagement', estimatedValue: 8500, relevanceScore: 0.95, status: 'active', isAiGenerated: true, aiConfidence: 0.91, expiresAt: daysFromNow(7) },
        { id: uuid('recom-3'), tenantId: T1, guestId: G2, type: 'service', category: 'wellness', title: 'Spa Package – Ayurvedic Rejuvenation', description: '90-minute Ayurvedic massage + steam bath combo at 20% off for Silver members.', reason: 'Silver loyalty member, shown interest in wellness', estimatedValue: 2800, relevanceScore: 0.75, status: 'active', shownAt: daysAgo(1), isAiGenerated: true, aiConfidence: 0.82, expiresAt: daysFromNow(3) },
        { id: uuid('recom-4'), tenantId: T1, guestId: G5, type: 'cross_sell', category: 'experience', title: 'Kolkata Heritage Walking Tour', description: 'Guided morning walk through colonial Kolkata with breakfast.', reason: 'Repeat guest, may enjoy local experiences', estimatedValue: 2500, relevanceScore: 0.68, status: 'active', isAiGenerated: true, aiConfidence: 0.72, expiresAt: daysFromNow(4) },
        { id: uuid('recom-5'), tenantId: T1, guestId: G4, type: 'loyalty', category: 'offer', title: 'Join Gold Tier – Stay 2 More Nights', description: 'You are only 1200 points away from Gold membership benefits.', reason: 'Silver member approaching Gold threshold', estimatedValue: 0, relevanceScore: 0.85, status: 'active', isAiGenerated: true, aiConfidence: 0.9, expiresAt: daysFromNow(30) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GuestRecommendation (5 rows)');
  } catch (e: any) {
    console.log('✗ GuestRecommendation:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ReferralTracking
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.referralTracking.createMany({
      data: [
        { id: uuid('ref-1'), tenantId: T1, referrerId: G1, refereeId: G4, referralCode: 'AMIT2024', referralSource: 'link', rewardType: 'points', rewardAmount: 500, status: 'converted', convertedAt: daysAgo(60), rewardedAt: daysAgo(58), expiresAt: daysFromNow(180) },
        { id: uuid('ref-2'), tenantId: T1, referrerId: G3, refereeId: G6, referralCode: 'RAHULVIP', referralSource: 'email', rewardType: 'credit', rewardAmount: 1000, status: 'rewarded', convertedAt: daysAgo(90), rewardedAt: daysAgo(88), expiresAt: daysFromNow(275) },
        { id: uuid('ref-3'), tenantId: T1, referrerId: G5, referralCode: 'VIKKY25', referralSource: 'link', rewardType: 'discount', rewardAmount: 0, status: 'pending', expiresAt: daysFromNow(60) },
        { id: uuid('ref-4'), tenantId: T1, referrerId: G1, referralCode: 'AMIT-QR-01', referralSource: 'qr', rewardType: 'points', rewardAmount: 0, status: 'pending', expiresAt: daysFromNow(90) },
        { id: uuid('ref-5'), tenantId: T1, referrerId: G2, refereeId: G5, referralCode: 'SNEHA2024', referralSource: 'social', rewardType: 'free_night', rewardAmount: 0, status: 'converted', convertedAt: daysAgo(200), expiresAt: daysFromNow(165) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ ReferralTracking (5 rows)');
  } catch (e: any) {
    console.log('✗ ReferralTracking:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. CommissionPayment
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.commissionPayment.createMany({
      data: [
        { id: uuid('cpay-1'), tenantId: T1, propertyId: P1, commissionRecordIds: JSON.stringify([uuid('crec-4')]), payeeName: 'Expedia Partner Network', payeeType: 'ota', totalAmount: 8640, paymentMethod: 'bank_transfer', reference: 'WIRE-EXP-2024-001', paidAt: daysAgo(10), notes: 'Monthly OTA settlement for Expedia bookings' },
        { id: uuid('cpay-2'), tenantId: T1, propertyId: P1, commissionRecordIds: JSON.stringify([uuid('crec-3')]), payeeName: 'Thomas Cook India', payeeType: 'travel_agent', totalAmount: 1980, paymentMethod: 'bank_transfer', reference: 'NEFT-TC-2024-088', paidAt: daysAgo(8), notes: 'Travel agent commission settlement' },
        { id: uuid('cpay-3'), tenantId: T1, propertyId: P1, commissionRecordIds: JSON.stringify([uuid('crec-1'), uuid('crec-2')]), payeeName: 'Booking.com B.V.', payeeType: 'ota', totalAmount: 4875, paymentMethod: 'bank_transfer', reference: 'WIRE-BC-2024-015', paidAt: daysAgo(5), notes: 'Bi-weekly settlement for Booking.com' },
        { id: uuid('cpay-4'), tenantId: T1, propertyId: P1, commissionRecordIds: JSON.stringify([uuid('crec-5')]), payeeName: 'TCS Corporate', payeeType: 'corporate', totalAmount: 500, paymentMethod: 'bank_transfer', reference: 'NEFT-TCS-2024-042', paidAt: daysAgo(3), notes: 'Corporate referral bonus payment' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ CommissionPayment (4 rows)');
  } catch (e: any) {
    console.log('✗ CommissionPayment:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. FinancingPlan
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.financingPlan.createMany({
      data: [
        { id: uuid('fplan-1'), tenantId: T1, propertyId: P1, name: 'Easy EMI – 3 Months', provider: 'internal', minAmount: 10000, maxAmount: 100000, interestRate: 0, durationMonths: 3, minInstallment: 3333.33, maxInstallments: 3, isActive: true, terms: '0% interest EMI for bookings above INR 10,000' },
        { id: uuid('fplan-2'), tenantId: T1, propertyId: P1, name: 'Standard EMI – 6 Months', provider: 'internal', minAmount: 25000, maxAmount: 250000, interestRate: 8.5, durationMonths: 6, minInstallment: 5000, maxInstallments: 6, isActive: true, terms: '8.5% p.a. interest, processing fee waived for loyalty members' },
        { id: uuid('fplan-3'), tenantId: T1, propertyId: P1, name: 'Long Stay EMI – 12 Months', provider: 'klarna', minAmount: 50000, maxAmount: 500000, interestRate: 12.0, durationMonths: 12, minInstallment: 5000, maxInstallments: 12, isActive: true, terms: 'Powered by Klarna, 12% p.a., min INR 50,000 booking' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ FinancingPlan (3 rows)');
  } catch (e: any) {
    console.log('✗ FinancingPlan:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. FinancingInstallment
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.financingInstallment.createMany({
      data: [
        { id: uuid('fins-1'), tenantId: T1, financingPlanId: uuid('fplan-1'), bookingId: B4, guestId: G5, totalAmount: 84100, installmentAmount: 28033.33, installmentNumber: 1, dueDate: daysAgo(15), paidAmount: 28033.33, status: 'paid', paidAt: daysAgo(15), paymentRef: 'EMI-PAY-001' },
        { id: uuid('fins-2'), tenantId: T1, financingPlanId: uuid('fplan-1'), bookingId: B4, guestId: G5, totalAmount: 84100, installmentAmount: 28033.33, installmentNumber: 2, dueDate: daysFromNow(15), paidAmount: 0, status: 'pending' },
        { id: uuid('fins-3'), tenantId: T1, financingPlanId: uuid('fplan-1'), bookingId: B4, guestId: G5, totalAmount: 84100, installmentAmount: 28033.34, installmentNumber: 3, dueDate: daysFromNow(45), paidAmount: 0, status: 'pending' },
        { id: uuid('fins-4'), tenantId: T1, financingPlanId: uuid('fplan-2'), bookingId: B2, guestId: G3, totalAmount: 58640, installmentAmount: 9773.33, installmentNumber: 1, dueDate: daysAgo(30), paidAmount: 9773.33, status: 'paid', paidAt: daysAgo(30), paymentRef: 'EMI-PAY-002' },
        { id: uuid('fins-5'), tenantId: T1, financingPlanId: uuid('fplan-2'), bookingId: B2, guestId: G3, totalAmount: 58640, installmentAmount: 9773.33, installmentNumber: 2, dueDate: daysAgo(0), paidAmount: 9773.33, status: 'paid', paidAt: daysAgo(0), paymentRef: 'EMI-PAY-003' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ FinancingInstallment (5 rows)');
  } catch (e: any) {
    console.log('✗ FinancingInstallment:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 9. GstReturn
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.gstReturn.createMany({
      data: [
        { id: uuid('gstret-1'), tenantId: T1, propertyId: P1, returnType: 'GSTR-3B', period: '2024-01', fromMonth: 1, fromYear: 2024, status: 'filed', totalOutwardSupply: 450000, totalTaxableValue: 450000, totalCgst: 40500, totalSgst: 40500, totalIgst: 0, totalCess: 0, totalTaxLiability: 81000, totalItcClaimed: 22500, netTaxPayable: 58500, filedDate: daysAgo(45), arn: 'AA200124001234Z', notes: 'Monthly return – January 2024', filedBy: uuid('user-1') },
        { id: uuid('gstret-2'), tenantId: T1, propertyId: P1, returnType: 'GSTR-3B', period: '2024-02', fromMonth: 2, fromYear: 2024, status: 'filed', totalOutwardSupply: 380000, totalTaxableValue: 380000, totalCgst: 34200, totalSgst: 34200, totalIgst: 0, totalCess: 0, totalTaxLiability: 68400, totalItcClaimed: 19000, netTaxPayable: 49400, filedDate: daysAgo(15), arn: 'AA200224001567Z', notes: 'Monthly return – February 2024', filedBy: uuid('user-1') },
        { id: uuid('gstret-3'), tenantId: T1, propertyId: P1, returnType: 'GSTR-3B', period: '2024-03', fromMonth: 3, fromYear: 2024, status: 'draft', totalOutwardSupply: 520000, totalTaxableValue: 520000, totalCgst: 46800, totalSgst: 46800, totalIgst: 0, totalCess: 0, totalTaxLiability: 93600, totalItcClaimed: 26000, netTaxPayable: 67600, notes: 'Monthly return – March 2024 (draft)' },
        { id: uuid('gstret-4'), tenantId: T1, propertyId: P1, returnType: 'GSTR-1', period: '2024-01', fromMonth: 1, fromYear: 2024, status: 'filed', totalOutwardSupply: 450000, totalTaxableValue: 450000, totalCgst: 40500, totalSgst: 40500, totalIgst: 0, totalCess: 0, totalTaxLiability: 81000, totalItcClaimed: 0, netTaxPayable: 81000, filedDate: daysAgo(50), arn: 'AA110124000987Z', notes: 'Outward supply return – January 2024', filedBy: uuid('user-1') },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GstReturn (4 rows)');
  } catch (e: any) {
    console.log('✗ GstReturn:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 10. InvoiceMatch
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.invoiceMatch.createMany({
      data: [
        { id: uuid('invm-1'), tenantId: T1, propertyId: P1, poNumber: 'PO-2024-001', invoiceNumber: 'INV-PL-2024-001', vendorId: V1, vendorName: 'Premium Linen Supply', invoiceDate: daysAgo(10), invoiceAmount: 45000, poAmount: 45000, receivedAmount: 45000, matchStatus: 'matched', varianceAmount: 0, variancePercent: 0, tolerancePercent: 5, matchedBy: uuid('user-1'), matchedAt: daysAgo(8), notes: 'Full match – linen order' },
        { id: uuid('invm-2'), tenantId: T1, propertyId: P1, poNumber: 'PO-2024-002', invoiceNumber: 'INV-CP-2024-003', vendorId: V2, vendorName: 'CleanPro Services', invoiceDate: daysAgo(5), invoiceAmount: 28000, poAmount: 25000, receivedAmount: 26000, matchStatus: 'variance', varianceAmount: 2000, variancePercent: 8, tolerancePercent: 5, notes: 'Variance on cleaning supplies – under review' },
        { id: uuid('invm-3'), tenantId: T1, propertyId: P1, poNumber: 'PO-2024-003', invoiceNumber: 'INV-TS-2024-007', vendorId: V3, vendorName: 'Tech Solutions India', invoiceDate: daysAgo(3), invoiceAmount: 120000, poAmount: 120000, receivedAmount: 120000, matchStatus: 'matched', varianceAmount: 0, variancePercent: 0, tolerancePercent: 5, matchedBy: uuid('user-2'), matchedAt: daysAgo(2), notes: 'IT equipment and software license' },
        { id: uuid('invm-4'), tenantId: T1, propertyId: P1, poNumber: 'PO-2024-004', invoiceNumber: 'INV-PL-2024-005', vendorId: V1, vendorName: 'Premium Linen Supply', invoiceDate: daysAgo(1), invoiceAmount: 18000, poAmount: 20000, receivedAmount: 20000, matchStatus: 'variance', varianceAmount: 2000, variancePercent: 10, tolerancePercent: 5, notes: 'Invoice amount less than PO – partial delivery' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ InvoiceMatch (4 rows)');
  } catch (e: any) {
    console.log('✗ InvoiceMatch:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 11. InvoiceMatchLine
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.invoiceMatchLine.createMany({
      data: [
        { id: uuid('invml-1'), matchId: uuid('invm-1'), itemDescription: 'King Size Bed Sheets (200 pcs)', poQty: 200, invoiceQty: 200, receivedQty: 200, poUnitPrice: 150, invoiceUnitPrice: 150, lineStatus: 'matched', varianceAmount: 0 },
        { id: uuid('invml-2'), matchId: uuid('invm-1'), itemDescription: 'Bath Towels (500 pcs)', poQty: 500, invoiceQty: 500, receivedQty: 500, poUnitPrice: 30, invoiceUnitPrice: 30, lineStatus: 'matched', varianceAmount: 0 },
        { id: uuid('invml-3'), matchId: uuid('invm-2'), itemDescription: 'Floor Cleaning Solution (50L)', poQty: 50, invoiceQty: 60, receivedQty: 55, poUnitPrice: 200, invoiceUnitPrice: 200, lineStatus: 'variance', varianceAmount: 2000 },
        { id: uuid('invml-4'), matchId: uuid('invm-3'), itemDescription: 'Network Switch 48-Port', poQty: 2, invoiceQty: 2, receivedQty: 2, poUnitPrice: 35000, invoiceUnitPrice: 35000, lineStatus: 'matched', varianceAmount: 0 },
        { id: uuid('invml-5'), matchId: uuid('invm-3'), itemDescription: 'Access Point License (3 yr)', poQty: 10, invoiceQty: 10, receivedQty: 10, poUnitPrice: 5000, invoiceUnitPrice: 5000, lineStatus: 'matched', varianceAmount: 0 },
      ],
      skipDuplicates: true,
    });
    console.log('✓ InvoiceMatchLine (5 rows)');
  } catch (e: any) {
    console.log('✗ InvoiceMatchLine:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 12. PaymentSchedule
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.paymentSchedule.createMany({
      data: [
        { id: uuid('psched-1'), tenantId: T1, propertyId: P1, folioId: F1, bookingId: B1, guestId: G1, scheduleName: 'Standard Payment Plan', totalAmount: 20970, depositAmount: 5000, depositDueDate: daysAgo(10), installments: JSON.stringify([{ amount: 5000, dueDate: daysAgo(10).toISOString(), status: 'paid', paymentId: uuid('pay-1'), paidAt: daysAgo(10).toISOString() }, { amount: 15970, dueDate: daysAgo(0).toISOString(), status: 'pending', paidAt: null }]), currency: 'INR', status: 'active', paidAmount: 10000, remainingAmount: 10970 },
        { id: uuid('psched-2'), tenantId: T1, propertyId: P1, folioId: F3, bookingId: B3, guestId: G2, scheduleName: 'Full Payment at Check-in', totalAmount: 27960, depositAmount: 0, installments: JSON.stringify([{ amount: 27960, dueDate: daysAgo(0).toISOString(), status: 'pending', paidAt: null }]), currency: 'INR', status: 'active', paidAmount: 0, remainingAmount: 27960 },
        { id: uuid('psched-3'), tenantId: T1, propertyId: P1, folioId: F4, bookingId: B4, guestId: G5, scheduleName: 'Split Payment – Card + UPI', totalAmount: 84100, depositAmount: 50000, depositDueDate: daysAgo(5), installments: JSON.stringify([{ amount: 50000, dueDate: daysAgo(5).toISOString(), status: 'paid', paymentId: uuid('pay-4'), paidAt: daysAgo(5).toISOString() }, { amount: 34100, dueDate: daysAgo(0).toISOString(), status: 'paid', paymentId: uuid('pay-5'), paidAt: daysAgo(0).toISOString() }]), currency: 'INR', status: 'completed', paidAmount: 84100, remainingAmount: 0 },
        { id: uuid('psched-4'), tenantId: T1, propertyId: P1, folioId: F5, bookingId: B5, guestId: G4, scheduleName: '50% Advance, 50% at Check-in', totalAmount: 13290, depositAmount: 6645, depositDueDate: daysAgo(14), installments: JSON.stringify([{ amount: 6645, dueDate: daysAgo(14).toISOString(), status: 'paid', paidAt: daysAgo(14).toISOString() }, { amount: 6645, dueDate: daysFromNow(7).toISOString(), status: 'pending', paidAt: null }]), currency: 'INR', status: 'active', paidAmount: 6645, remainingAmount: 6645 },
      ],
      skipDuplicates: true,
    });
    console.log('✓ PaymentSchedule (4 rows)');
  } catch (e: any) {
    console.log('✗ PaymentSchedule:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 13. PaymentTerminal
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.paymentTerminal.createMany({
      data: [
        { id: uuid('pterm-1'), tenantId: T1, propertyId: P1, name: 'Front Desk Terminal 1', provider: 'verifone', model: 'P400', serialNumber: 'VF-P400-001234', location: 'Main Lobby – Front Desk', ipAddress: '192.168.1.101', status: 'online', p2peEnabled: true, p2peCertExpiry: daysFromNow(180), lastTransactionAt: daysAgo(0), isActive: true },
        { id: uuid('pterm-2'), tenantId: T1, propertyId: P1, name: 'Restaurant POS Terminal', provider: 'square', model: 'Square Terminal', serialNumber: 'SQ-T-005678', location: 'Restaurant – Billing Counter', ipAddress: '192.168.1.102', status: 'online', p2peEnabled: true, p2peCertExpiry: daysFromNow(200), lastTransactionAt: daysAgo(0), isActive: true },
        { id: uuid('pterm-3'), tenantId: T1, propertyId: P1, name: 'Spa Reception Terminal', provider: 'clover', model: 'Clover Station', serialNumber: 'CLV-S-009012', location: 'Spa & Wellness – Reception', ipAddress: '192.168.1.103', status: 'online', p2peEnabled: true, p2peCertExpiry: daysFromNow(120), lastTransactionAt: daysAgo(1), isActive: true },
      ],
      skipDuplicates: true,
    });
    console.log('✓ PaymentTerminal (3 rows)');
  } catch (e: any) {
    console.log('✗ PaymentTerminal:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 14. PaymentToken
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.paymentToken.createMany({
      data: [
        { id: uuid('ptok-1'), tenantId: T1, propertyId: P1, guestId: G1, folioId: F1, tokenType: 'stripe_token', gatewayTokenId: 'pm_1Ab2Cd3Ef4Gh5Ij', cardType: 'credit', cardLast4: '4242', cardExpiryMonth: 12, cardExpiryYear: 2026, cardBrand: 'visa', isDefault: true, status: 'active', metadata: JSON.stringify({ funding: 'credit', country: 'IN' }) },
        { id: uuid('ptok-2'), tenantId: T1, propertyId: P1, guestId: G3, folioId: F2, tokenType: 'stripe_token', gatewayTokenId: 'pm_9Zz8Yy7Xx6Ww5Vv', cardType: 'credit', cardLast4: '5555', cardExpiryMonth: 8, cardExpiryYear: 2027, cardBrand: 'mastercard', isDefault: true, status: 'active', metadata: JSON.stringify({ funding: 'credit', country: 'IN' }) },
        { id: uuid('ptok-3'), tenantId: T1, propertyId: P1, guestId: G5, folioId: F4, tokenType: 'stripe_token', gatewayTokenId: 'pm_Kk3Jj2Ii1Hh0Gg', cardType: 'credit', cardLast4: '8888', cardExpiryMonth: 3, cardExpiryYear: 2025, cardBrand: 'mastercard', isDefault: true, status: 'active', metadata: JSON.stringify({ funding: 'credit', country: 'IN' }) },
        { id: uuid('ptok-4'), tenantId: T1, propertyId: P1, guestId: G1, tokenType: 'paypal_token', gatewayTokenId: 'BAC-2XZZZZZ12345', isDefault: false, status: 'active', metadata: JSON.stringify({ email: 'amit.m@email.com', payerId: 'ABCDE12345' }) },
        { id: uuid('ptok-5'), tenantId: T1, propertyId: P1, guestId: G4, folioId: F5, tokenType: 'stripe_token', gatewayTokenId: 'pm_Qq9Rr8Pp7Oo6Nn', cardType: 'debit', cardLast4: '1234', cardExpiryMonth: 6, cardExpiryYear: 2026, cardBrand: 'visa', isDefault: true, status: 'active', metadata: JSON.stringify({ funding: 'debit', country: 'IN' }) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ PaymentToken (5 rows)');
  } catch (e: any) {
    console.log('✗ PaymentToken:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 15. TaxExemption
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.taxExemption.createMany({
      data: [
        { id: uuid('taxex-1'), tenantId: T1, bookingId: B2, folioId: F2, guestId: G3, exemptionType: 'government', certificateNumber: 'GOV-EXM-2024-001', issuingAuthority: 'Ministry of External Affairs, Govt. of India', exemptTaxTypes: JSON.stringify(['gst', 'luxury_tax']), exemptAmount: 8640, status: 'approved', approvedBy: uuid('user-1'), approvedAt: daysAgo(5), expiresAt: daysFromNow(180) },
        { id: uuid('taxex-2'), tenantId: T1, bookingId: B4, guestId: G5, exemptionType: 'diplomatic', certificateNumber: 'DIP-EXM-2024-045', certificateUrl: '/uploads/exemptions/dip-045.pdf', issuingAuthority: 'Consulate General of Japan', exemptTaxTypes: JSON.stringify(['gst']), exemptAmount: 12600, status: 'approved', approvedBy: uuid('user-1'), approvedAt: daysAgo(2), expiresAt: daysFromNow(90) },
        { id: uuid('taxex-3'), tenantId: T1, guestId: G1, exemptionType: 'charity', certificateNumber: 'CHA-EXM-2024-012', issuingAuthority: 'Indian Red Cross Society', exemptTaxTypes: JSON.stringify(['service_tax']), exemptAmount: 500, status: 'pending', expiresAt: daysFromNow(365) },
        { id: uuid('taxex-4'), tenantId: T1, bookingId: B6, guestId: G6, exemptionType: 'inter_state', certificateNumber: 'IST-EXM-2024-078', issuingAuthority: 'GST Council', exemptTaxTypes: JSON.stringify(['gst']), exemptAmount: 1890, status: 'pending', expiresAt: daysFromNow(60) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ TaxExemption (4 rows)');
  } catch (e: any) {
    console.log('✗ TaxExemption:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 16. VendorPayment
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.vendorPayment.createMany({
      data: [
        { id: uuid('vpay-1'), tenantId: T1, vendorId: V1, paymentNumber: 'VP-2024-001', amount: 45000, currency: 'INR', status: 'paid', paymentMethod: 'bank_transfer', paymentDate: daysAgo(8), dueDate: daysAgo(5), bankName: 'State Bank of India', bankAccount: 'SBI-3820-001234-5678', transactionRef: 'NEFT-SBI-2024-04521', notes: 'Full payment for linen order PO-2024-001', paidAt: daysAgo(8) },
        { id: uuid('vpay-2'), tenantId: T1, vendorId: V2, paymentNumber: 'VP-2024-002', amount: 25000, currency: 'INR', status: 'paid', paymentMethod: 'bank_transfer', paymentDate: daysAgo(5), dueDate: daysAgo(3), bankName: 'HDFC Bank', bankAccount: 'HDFC-2200-009876-5432', transactionRef: 'NEFT-HDFC-2024-08832', notes: 'Cleaning services for January', paidAt: daysAgo(5) },
        { id: uuid('vpay-3'), tenantId: T1, vendorId: V3, paymentNumber: 'VP-2024-003', amount: 120000, currency: 'INR', status: 'processing', paymentMethod: 'bank_transfer', dueDate: daysFromNow(5), bankName: 'ICICI Bank', bankAccount: 'ICICI-1500-001122-3344', notes: 'IT equipment and software – awaiting PO approval' },
        { id: uuid('vpay-4'), tenantId: T1, vendorId: V1, paymentNumber: 'VP-2024-004', amount: 20000, currency: 'INR', status: 'pending', paymentMethod: 'check', dueDate: daysFromNow(15), checkNumber: 'CHQ-789012', notes: 'Pending linen replenishment order' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ VendorPayment (4 rows)');
  } catch (e: any) {
    console.log('✗ VendorPayment:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 17. TerminalTransaction
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.terminalTransaction.createMany({
      data: [
        { id: uuid('ttxn-1'), tenantId: T1, terminalId: uuid('pterm-1'), folioId: F1, bookingId: B1, amount: 5000, currency: 'INR', cardType: 'visa', cardLast4: '4242', entryMethod: 'chip', transactionType: 'sale', authCode: 'AUTH001', reference: 'TXN-FD-001', status: 'approved' },
        { id: uuid('ttxn-2'), tenantId: T1, terminalId: uuid('pterm-1'), folioId: F4, bookingId: B4, amount: 50000, currency: 'INR', cardType: 'mastercard', cardLast4: '8888', entryMethod: 'contactless', transactionType: 'sale', authCode: 'AUTH002', reference: 'TXN-FD-002', status: 'approved' },
        { id: uuid('ttxn-3'), tenantId: T1, terminalId: uuid('pterm-2'), amount: 3500, currency: 'INR', cardType: 'visa', cardLast4: '4242', entryMethod: 'nfc', transactionType: 'sale', authCode: 'AUTH003', reference: 'TXN-RST-001', status: 'approved' },
        { id: uuid('ttxn-4'), tenantId: T1, terminalId: uuid('pterm-3'), folioId: F2, bookingId: B2, amount: 4500, currency: 'INR', cardType: 'mastercard', cardLast4: '5555', entryMethod: 'chip', transactionType: 'sale', authCode: 'AUTH004', reference: 'TXN-SPA-001', status: 'approved' },
        { id: uuid('ttxn-5'), tenantId: T1, terminalId: uuid('pterm-1'), amount: 1500, currency: 'INR', cardType: 'visa', cardLast4: '9999', entryMethod: 'chip', transactionType: 'refund', authCode: 'AUTH005', reference: 'TXN-FD-REF-001', status: 'approved' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ TerminalTransaction (5 rows)');
  } catch (e: any) {
    console.log('✗ TerminalTransaction:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 18. FraudDetectionRule
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.fraudDetectionRule.createMany({
      data: [
        { id: uuid('fdrule-1'), tenantId: T1, name: 'High Velocity Card Transactions', description: 'Flag when more than 5 card transactions occur within 10 minutes from the same guest', isEnabled: true, ruleType: 'velocity', conditions: JSON.stringify({ maxTransactions: 5, windowMinutes: 10, scope: 'guest' }), action: 'flag', severity: 'high' },
        { id: uuid('fdrule-2'), tenantId: T1, name: 'Large Amount Anomaly', description: 'Flag payments exceeding INR 200,000 in a single transaction', isEnabled: true, ruleType: 'amount', conditions: JSON.stringify({ maxAmount: 200000, currency: 'INR' }), action: 'review', severity: 'high' },
        { id: uuid('fdrule-3'), tenantId: T1, name: 'Multiple Booking Cancellations', description: 'Flag guests who cancel more than 3 bookings within 30 days', isEnabled: true, ruleType: 'pattern', conditions: JSON.stringify({ maxCancellations: 3, windowDays: 30, scope: 'guest' }), action: 'flag', severity: 'medium' },
        { id: uuid('fdrule-4'), tenantId: T1, name: 'Geolocation Mismatch', description: 'Flag when card IP and booking IP are from different countries', isEnabled: true, ruleType: 'geolocation', conditions: JSON.stringify({ checkCrossCountry: true }), action: 'mfa_required', severity: 'critical' },
        { id: uuid('fdrule-5'), tenantId: T2, name: 'Rapid Repeat Booking', description: 'Flag when the same card is used for 3+ bookings within 1 hour', isEnabled: false, ruleType: 'velocity', conditions: JSON.stringify({ maxBookings: 3, windowMinutes: 60, scope: 'card' }), action: 'block', severity: 'high' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ FraudDetectionRule (5 rows)');
  } catch (e: any) {
    console.log('✗ FraudDetectionRule:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 19. FraudAlert
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.fraudAlert.createMany({
      data: [
        { id: uuid('falert-1'), tenantId: T1, paymentId: uuid('pay-4'), userId: G5, ruleId: uuid('fdrule-2'), alertType: 'amount_anomaly', severity: 'high', status: 'reviewed', riskScore: 72, details: JSON.stringify({ amount: 50000, threshold: 200000, reason: 'Large but within acceptable range for VIP guest' }), reviewedBy: uuid('user-1'), reviewedAt: daysAgo(0), resolution: 'Legitimate – VIP corporate guest with prior high-value stays' },
        { id: uuid('falert-2'), tenantId: T1, ruleId: uuid('fdrule-1'), alertType: 'velocity_exceeded', severity: 'high', status: 'open', riskScore: 85, details: JSON.stringify({ transactions: 7, windowMinutes: 10, guestId: G4, bookingId: B5 }) },
        { id: uuid('falert-3'), tenantId: T1, ruleId: uuid('fdrule-3'), alertType: 'pattern_match', severity: 'medium', status: 'dismissed', riskScore: 45, details: JSON.stringify({ cancellations: 4, windowDays: 30, guestId: G5 }), reviewedBy: uuid('user-2'), reviewedAt: daysAgo(3), resolution: 'Legitimate schedule changes – business traveler' },
        { id: uuid('falert-4'), tenantId: T1, ruleId: uuid('fdrule-4'), alertType: 'pattern_match', severity: 'critical', status: 'open', riskScore: 92, details: JSON.stringify({ cardCountry: 'US', bookingCountry: 'IN', guestId: G4 }) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ FraudAlert (4 rows)');
  } catch (e: any) {
    console.log('✗ FraudAlert:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 20. GdsConnection
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.gdsConnection.createMany({
      data: [
        { id: uuid('gds-conn-1'), tenantId: T1, propertyId: P1, provider: 'amadeus', pcc: JSON.stringify(['CCU1A', 'CCU1B']), hotelCode: 'RSTCCU', chainCode: 'RS', endpointUrl: 'https://test.webservices.amadeus.com', apiKey: 'amadeus-test-key-***', apiSecret: 'amadeus-test-secret-***', username: 'RS_CCU_GDS', password: '***', status: 'active', lastSyncAt: daysAgo(0), autoSync: true, syncInterval: 300 },
        { id: uuid('gds-conn-2'), tenantId: T1, propertyId: P2, provider: 'sabre', pcc: JSON.stringify(['DAR1A']), hotelCode: 'RSTDAR', chainCode: 'RS', endpointUrl: 'https://api.sabre.com', apiKey: 'sabre-test-key-***', apiSecret: 'sabre-test-secret-***', status: 'pending', autoSync: true, syncInterval: 300 },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GdsConnection (2 rows)');
  } catch (e: any) {
    console.log('✗ GdsConnection:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 21. GdsBooking
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.gdsBooking.createMany({
      data: [
        { id: uuid('gdsbook-1'), tenantId: T1, connectionId: uuid('gds-conn-1'), gdsRef: 'GDS-RST-2024-001', pnr: 'ABC123', guestName: 'Mukherjee, Amit', guestEmail: 'amit.m@email.com', guestPhone: '+91-9830012345', checkIn: daysAgo(2), checkOut: daysAgo(0), roomType: 'DLX', rateCode: 'BAR', adults: 2, children: 0, status: 'checked_in', bookingId: B1, syncStatus: 'synced', rawPayload: null },
        { id: uuid('gdsbook-2'), tenantId: T1, connectionId: uuid('gds-conn-1'), gdsRef: 'GDS-RST-2024-002', pnr: 'DEF456', guestName: 'Banerjee, Rahul', guestEmail: 'rahul.b@email.com', guestPhone: '+91-9830034567', checkIn: daysAgo(1), checkOut: daysFromNow(3), roomType: 'EXEC', rateCode: 'BAR', adults: 2, children: 0, status: 'checked_in', bookingId: B2, syncStatus: 'synced', rawPayload: null },
        { id: uuid('gdsbook-3'), tenantId: T1, connectionId: uuid('gds-conn-1'), gdsRef: 'GDS-RST-2024-003', pnr: 'GHI789', guestName: 'Singh, Vikram', guestEmail: 'vikram.s@email.com', guestPhone: '+91-9830056789', checkIn: daysFromNow(7), checkOut: daysFromNow(9), roomType: 'DLX', rateCode: 'NRF', adults: 2, children: 1, status: 'confirmed', bookingId: null, syncStatus: 'pending', rawPayload: null },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GdsBooking (3 rows)');
  } catch (e: any) {
    console.log('✗ GdsBooking:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 22. GdsRateCode
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.gdsRateCode.createMany({
      data: [
        { id: uuid('gdsrate-1'), tenantId: T1, connectionId: uuid('gds-conn-1'), code: 'BAR', name: 'Best Available Rate', rateType: 'BAR', description: 'Flexible rate with free cancellation', roomTypeId: uuid('roomtype-2'), ratePlanId: RP4, minStay: 1, maxStay: null, baseRate: 5500, currency: 'INR', isActive: true },
        { id: uuid('gdsrate-2'), tenantId: T1, connectionId: uuid('gds-conn-1'), code: 'GOV', name: 'Government Rate', rateType: 'Corporate', description: 'Special rate for government employees', roomTypeId: uuid('roomtype-1'), ratePlanId: RP1, minStay: 1, maxStay: 5, baseRate: 2800, currency: 'INR', isActive: true },
        { id: uuid('gdsrate-3'), tenantId: T1, connectionId: uuid('gds-conn-1'), code: 'PKG1', name: 'Weekend Package', rateType: 'Package', description: '2 nights with breakfast and spa access', roomTypeId: uuid('roomtype-3'), ratePlanId: RP6, minStay: 2, maxStay: 2, baseRate: 20000, currency: 'INR', isActive: true },
        { id: uuid('gdsrate-4'), tenantId: T1, connectionId: uuid('gds-conn-1'), code: 'NRF', name: 'Non-Refundable', rateType: 'BAR', description: 'Discounted non-refundable rate', roomTypeId: uuid('roomtype-2'), ratePlanId: RP5, minStay: 2, maxStay: null, baseRate: 4675, currency: 'INR', isActive: true },
        { id: uuid('gdsrate-5'), tenantId: T1, connectionId: uuid('gds-conn-2'), code: 'BAR', name: 'Best Available Rate – Darjeeling', rateType: 'BAR', description: 'Flexible rate for Darjeeling property', roomTypeId: uuid('roomtype-5'), ratePlanId: null, minStay: 1, maxStay: null, baseRate: 4500, currency: 'INR', isActive: true },
      ],
      skipDuplicates: true,
    });
    console.log('✓ GdsRateCode (5 rows)');
  } catch (e: any) {
    console.log('✗ GdsRateCode:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 23. MetaAdsConnection
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.metaAdsConnection.createMany({
      data: [
        { id: uuid('meta-conn-1'), tenantId: T1, propertyId: P1, appId: '123456789012345', appSecret: 'meta-app-secret-***', accessToken: 'EAAGm0PX4ZCpsBAKz7mNJZBKOxZBxLZBWMAZD', refreshToken: 'meta-refresh-token-***', accountId: 'act_987654321', pixelId: 'PIXEL-12345678', status: 'connected', config: { trackingEvents: ['PageView', 'ViewContent', 'InitiateCheckout', 'Purchase'] }, credentials: { apiVersion: 'v18.0' }, lastSyncedAt: daysAgo(1) },
        { id: uuid('meta-conn-2'), tenantId: T1, propertyId: P2, appId: '987654321098765', appSecret: 'meta-app-secret-darj-***', accessToken: 'EAAGm0PX4ZCpsBBTNRZBKOxZBxLZBWMAZD', refreshToken: 'meta-refresh-token-darj-***', accountId: 'act_555666777', pixelId: 'PIXEL-87654321', status: 'disconnected', config: {}, credentials: { apiVersion: 'v18.0' } },
      ],
      skipDuplicates: true,
    });
    console.log('✓ MetaAdsConnection (2 rows)');
  } catch (e: any) {
    console.log('✗ MetaAdsConnection:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 24. CampaignAbTest
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.campaignAbTest.createMany({
      data: [
        { id: uuid('abtest-1'), tenantId: T1, campaignId: CAMP1, variantLabel: 'A', variantName: 'Control – Original Subject', subject: 'Exclusive Offer Just for You!', content: 'Dear guest, enjoy 20% off your next stay at Royal Stay Hotels...', splitPercentage: 50, sentCount: 500, openedCount: 175, clickedCount: 45, conversionCount: 12, isWinner: false },
        { id: uuid('abtest-2'), tenantId: T1, campaignId: CAMP1, variantLabel: 'B', variantName: 'Emoji Subject Line', subject: '🏖️ Your Dream Getaway Awaits – Save 20%!', content: 'Dear guest, enjoy 20% off your next stay at Royal Stay Hotels...', splitPercentage: 50, sentCount: 500, openedCount: 225, clickedCount: 68, conversionCount: 19, isWinner: true, declaredAt: daysAgo(5) },
        { id: uuid('abtest-3'), tenantId: T1, campaignId: CAMP2, variantLabel: 'A', variantName: 'Text Only Email', subject: 'Weekend Special – Book Now', content: 'Book this weekend and get complimentary breakfast for two...', splitPercentage: 50, sentCount: 300, openedCount: 90, clickedCount: 25, conversionCount: 8, isWinner: false },
        { id: uuid('abtest-4'), tenantId: T1, campaignId: CAMP2, variantLabel: 'B', variantName: 'Image-Rich Email', subject: 'Weekend Special – Book Now', content: '<html><body><img src="banner.jpg" /> Book this weekend and get complimentary breakfast...', splitPercentage: 50, sentCount: 300, openedCount: 120, clickedCount: 42, conversionCount: 15, isWinner: true, declaredAt: daysAgo(3) },
      ],
      skipDuplicates: true,
    });
    console.log('✓ CampaignAbTest (4 rows)');
  } catch (e: any) {
    console.log('✗ CampaignAbTest:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 25. CancellationPredictionLog
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.cancellationPredictionLog.createMany({
      data: [
        { id: uuid('cpred-1'), tenantId: T1, bookingId: B3, riskScore: 0.72, riskLevel: 'high', factors: JSON.stringify(['ota_booking', 'no_deposit', 'lead_time_short']), modelVersion: 'v1', predictedAt: daysAgo(10), actualOutcome: null },
        { id: uuid('cpred-2'), tenantId: T1, bookingId: B1, riskScore: 0.15, riskLevel: 'low', factors: JSON.stringify(['repeat_guest', 'deposit_paid', 'direct_booking']), modelVersion: 'v1', predictedAt: daysAgo(12), actualOutcome: 'checked_in' },
        { id: uuid('cpred-3'), tenantId: T1, bookingId: B2, riskScore: 0.08, riskLevel: 'low', factors: JSON.stringify(['vip_guest', 'loyalty_platinum', 'corporate']), modelVersion: 'v1', predictedAt: daysAgo(8), actualOutcome: 'checked_in' },
        { id: uuid('cpred-4'), tenantId: T1, bookingId: B5, riskScore: 0.55, riskLevel: 'medium', factors: JSON.stringify(['airbnb_booking', 'first_time_guest', 'standard_room']), modelVersion: 'v1', predictedAt: daysAgo(14), actualOutcome: null },
        { id: uuid('cpred-5'), tenantId: T1, bookingId: B4, riskScore: 0.22, riskLevel: 'low', factors: JSON.stringify(['repeat_guest', 'gold_member', 'high_value']), modelVersion: 'v1', predictedAt: daysAgo(6), actualOutcome: 'checked_in' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ CancellationPredictionLog (5 rows)');
  } catch (e: any) {
    console.log('✗ CancellationPredictionLog:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 26. LoyaltyPointTransaction
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.loyaltyPointTransaction.createMany({
      data: [
        { id: uuid('ltx-1'), tenantId: T1, guestId: G1, points: 500, balance: 5000, type: 'earn', source: 'booking', referenceId: B1, referenceType: 'booking', description: 'Earned 500 points for booking stay at Royal Stay Kolkata', expiresAt: daysFromNow(365) },
        { id: uuid('ltx-2'), tenantId: T1, guestId: G3, points: 1200, balance: 13700, type: 'earn', source: 'booking', referenceId: B2, referenceType: 'booking', description: 'Earned 1200 points (Platinum 1.5x) for Executive Suite stay', expiresAt: daysFromNow(365) },
        { id: uuid('ltx-3'), tenantId: T1, guestId: G2, points: -200, balance: 2000, type: 'redeem', source: 'redemption', referenceId: uuid('lred-1'), referenceType: 'redemption', description: 'Redeemed 200 points for Free Welcome Drink reward' },
        { id: uuid('ltx-4'), tenantId: T1, guestId: G5, points: 350, balance: 5450, type: 'bonus', source: 'promotion', description: 'Bonus 350 points for booking via mobile app', expiresAt: daysFromNow(365) },
        { id: uuid('ltx-5'), tenantId: T1, guestId: G1, points: 100, balance: 5100, type: 'referral', source: 'referral', referenceId: G4, referenceType: 'guest', description: 'Earned 100 points for referring Pooja Saha' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ LoyaltyPointTransaction (5 rows)');
  } catch (e: any) {
    console.log('✗ LoyaltyPointTransaction:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 27. LoyaltyRedemption
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.loyaltyRedemption.createMany({
      data: [
        { id: uuid('lred-1'), tenantId: T1, guestId: G2, rewardId: LREWARD1, pointsSpent: 100, status: 'completed', redemptionCode: 'RDMP-DRINK-001', redeemedAt: daysAgo(15), expiresAt: daysFromNow(15) },
        { id: uuid('lred-2'), tenantId: T1, guestId: G3, rewardId: LREWARD2, pointsSpent: 200, status: 'completed', redemptionCode: 'RDMP-LCO-002', redeemedAt: daysAgo(5), expiresAt: daysFromNow(25) },
        { id: uuid('lred-3'), tenantId: T1, guestId: G5, rewardId: LREWARD1, pointsSpent: 100, status: 'completed', redemptionCode: 'RDMP-DRINK-003', redeemedAt: daysAgo(3), expiresAt: daysFromNow(27) },
        { id: uuid('lred-4'), tenantId: T1, guestId: G1, rewardId: LREWARD3, pointsSpent: 500, status: 'pending', redemptionCode: 'RDMP-SP-004', expiresAt: daysFromNow(30) },
        { id: uuid('lred-5'), tenantId: T1, guestId: G6, rewardId: LREWARD1, pointsSpent: 100, status: 'expired', redemptionCode: 'RDMP-DRINK-005', redeemedAt: daysAgo(60), cancelledAt: daysAgo(30), cancelledReason: 'Reward code expired unused' },
      ],
      skipDuplicates: true,
    });
    console.log('✓ LoyaltyRedemption (5 rows)');
  } catch (e: any) {
    console.log('✗ LoyaltyRedemption:', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 28. LoyaltyTransaction
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.loyaltyTransaction.createMany({
      data: [
        { id: uuid('ltrx-1'), tenantId: T1, guestId: G1, points: 500, type: 'earn', reason: 'Stay at Royal Stay Kolkata – Booking #1', referenceType: 'booking', referenceId: B1, balanceAfter: 5000 },
        { id: uuid('ltrx-2'), tenantId: T1, guestId: G3, points: 1200, type: 'earn', reason: 'Executive Suite stay – Platinum 1.5x multiplier', referenceType: 'booking', referenceId: B2, balanceAfter: 13700 },
        { id: uuid('ltrx-3'), tenantId: T1, guestId: G2, points: -200, type: 'redeem', reason: 'Redeemed Free Welcome Drink', referenceType: 'redemption', referenceId: uuid('lred-1'), balanceAfter: 2000 },
        { id: uuid('ltrx-4'), tenantId: T1, guestId: G5, points: 350, type: 'bonus', reason: 'Mobile app booking bonus', referenceType: 'promotion', balanceAfter: 5450 },
        { id: uuid('ltrx-5'), tenantId: T1, guestId: G6, points: 300, type: 'earn', reason: 'Standard Room stay at Royal Stay Kolkata', referenceType: 'booking', referenceId: B6, balanceAfter: 2100 },
      ],
      skipDuplicates: true,
    });
    console.log('✓ LoyaltyTransaction (5 rows)');
  } catch (e: any) {
    console.log('✗ LoyaltyTransaction:', e.message);
  }

  console.log('\n=== Group B seeding complete ===');
}
