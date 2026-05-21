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

const tenantId = uuid('tenant-1');
const propertyId = uuid('property-1');

// Reusable dates
const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

export async function seedExtrasData(prisma: PrismaClient) {
  console.log('🌱 Seeding extras data — help, security, AI, automation, integrations, inventory, platform, channel, other…');

  // ═══════════════════════════════════════════════════════════════
  // 1-2. HELP CATEGORIES & ARTICLES
  // ═══════════════════════════════════════════════════════════════
  console.log('  📚 Help categories & articles…');
  await prisma.helpCategory.deleteMany({});
  await prisma.helpArticle.deleteMany({});

  const helpCategories = [
    { id: uuid('helpcat-1'), name: 'Getting Started', slug: 'getting-started', icon: 'rocket', sortOrder: 0, description: 'Onboarding and initial setup guides' },
    { id: uuid('helpcat-2'), name: 'Bookings', slug: 'bookings', icon: 'calendar', sortOrder: 1, description: 'Booking management and reservation workflows' },
    { id: uuid('helpcat-3'), name: 'Front Desk', slug: 'front-desk', icon: 'concierge-bell', sortOrder: 2, description: 'Check-in, check-out, and front desk operations' },
    { id: uuid('helpcat-4'), name: 'Billing', slug: 'billing', icon: 'indian-rupee', sortOrder: 3, description: 'Invoices, folios, payments, and financial reports' },
    { id: uuid('helpcat-5'), name: 'Housekeeping', slug: 'housekeeping', icon: 'sparkles', sortOrder: 4, description: 'Room cleaning, inspections, and maintenance' },
    { id: uuid('helpcat-6'), name: 'Settings', slug: 'settings', icon: 'settings', sortOrder: 5, description: 'System configuration and preferences' },
  ];
  await prisma.helpCategory.createMany({ data: helpCategories });

  await prisma.helpArticle.createMany({
    data: [
      { id: uuid('helpart-1'), tenantId, title: 'Getting Started with StaySuite', slug: 'getting-started-staysuite', content: '# Getting Started\n\nWelcome to StaySuite! This guide covers the essential steps to configure your property.', excerpt: 'Complete onboarding guide for new users', category: 'getting-started', tags: '["onboarding","setup"]', status: 'published', viewCount: 342, helpfulCount: 89, publishedAt: daysAgo(30) },
      { id: uuid('helpart-2'), tenantId, title: 'Creating Your First Booking', slug: 'first-booking', content: '# Creating Your First Booking\n\nNavigate to Bookings > New Booking and fill in guest details.', excerpt: 'Step-by-step booking creation guide', category: 'getting-started', tags: '["bookings","tutorial"]', status: 'published', viewCount: 256, helpfulCount: 67, publishedAt: daysAgo(28) },
      { id: uuid('helpart-3'), tenantId, title: 'Understanding Booking Statuses', slug: 'booking-statuses', content: '# Booking Statuses\n\nStaySuite uses the following statuses: draft, confirmed, checked_in, checked_out, cancelled, no_show.', excerpt: 'All booking statuses explained', category: 'bookings', tags: '["bookings","statuses"]', status: 'published', viewCount: 198, helpfulCount: 54, publishedAt: daysAgo(25) },
      { id: uuid('helpart-4'), tenantId, title: 'Managing Group Bookings', slug: 'group-bookings', content: '# Group Bookings\n\nLearn how to create room blocks and manage group inventory.', excerpt: 'Group booking management guide', category: 'bookings', tags: '["bookings","groups"]', status: 'published', viewCount: 156, helpfulCount: 41, publishedAt: daysAgo(20) },
      { id: uuid('helpart-5'), tenantId, title: 'Check-in Workflow', slug: 'checkin-workflow', content: '# Check-in Workflow\n\nProcess guest arrivals efficiently with digital check-in.', excerpt: 'Front desk check-in procedures', category: 'front-desk', tags: '["frontdesk","checkin"]', status: 'published', viewCount: 278, helpfulCount: 85, publishedAt: daysAgo(22) },
      { id: uuid('helpart-6'), tenantId, title: 'Digital Key Management', slug: 'digital-key-management', content: '# Digital Key Management\n\nIssue and manage mobile keys for guests.', excerpt: 'How to manage digital room keys', category: 'front-desk', tags: '["frontdesk","keys"]', status: 'published', viewCount: 145, helpfulCount: 38, publishedAt: daysAgo(18) },
      { id: uuid('helpart-7'), tenantId, title: 'Creating Invoices', slug: 'creating-invoices', content: '# Creating Invoices\n\nGenerate invoices from folios for guests and companies.', excerpt: 'Invoice creation and customization', category: 'billing', tags: '["billing","invoices"]', status: 'published', viewCount: 203, helpfulCount: 61, publishedAt: daysAgo(15) },
      { id: uuid('helpart-8'), tenantId, title: 'Payment Processing', slug: 'payment-processing', content: '# Payment Processing\n\nAccept payments via Razorpay, Stripe, and other gateways.', excerpt: 'Payment gateway integration guide', category: 'billing', tags: '["billing","payments"]', status: 'published', viewCount: 187, helpfulCount: 63, publishedAt: daysAgo(12) },
      { id: uuid('helpart-9'), tenantId, title: 'Housekeeping Task Management', slug: 'hk-task-management', content: '# Housekeeping Tasks\n\nCreate, assign, and track housekeeping tasks.', excerpt: 'Task management for housekeeping teams', category: 'housekeeping', tags: '["housekeeping","tasks"]', status: 'published', viewCount: 278, helpfulCount: 85, publishedAt: daysAgo(10) },
      { id: uuid('helpart-10'), tenantId, title: 'Room Inspection Checklists', slug: 'room-inspection', content: '# Room Inspections\n\nUse checklists for consistent quality assurance.', excerpt: 'Inspection checklist guide', category: 'housekeeping', tags: '["housekeeping","inspection"]', status: 'published', viewCount: 198, helpfulCount: 72, publishedAt: daysAgo(8) },
      { id: uuid('helpart-11'), tenantId, title: 'User Roles and Permissions', slug: 'user-roles', content: '# User Roles\n\nManage RBAC with admin, manager, front desk, and housekeeping roles.', excerpt: 'Role-based access control guide', category: 'settings', tags: '["settings","roles"]', status: 'published', viewCount: 176, helpfulCount: 58, publishedAt: daysAgo(5) },
      { id: uuid('helpart-12'), tenantId, title: 'Notification Templates', slug: 'notification-templates', content: '# Notification Templates\n\nCustomize email and SMS templates for guest communication.', excerpt: 'Template customization guide', category: 'settings', tags: '["settings","notifications"]', status: 'draft', viewCount: 45, helpfulCount: 12 },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 3-4. VIP RULES & VIP ALERTS
  // ═══════════════════════════════════════════════════════════════
  console.log('  ⭐ VIP rules & alerts…');
  await prisma.vipAlert.deleteMany({});
  await prisma.vipRule.deleteMany({});

  const vipRules = [
    { id: uuid('viprule-1'), tenantId, propertyId, name: 'Platinum Guest (10+ stays)', description: 'Guests with 10 or more stays are flagged as VIP', ruleType: 'stays', conditions: '{"minStays": 10}', alertLevel: 'vvip', alertMessage: 'Platinum guest arriving — prepare welcome amenity', autoUpgrade: true, isActive: true },
    { id: uuid('viprule-2'), tenantId, propertyId, name: 'High Spender (₹50,000+)', description: 'Guests who have spent over ₹50,000 total', ruleType: 'spend', conditions: '{"minSpend": 50000}', alertLevel: 'vip', alertMessage: 'High-value guest — assign best available room', autoUpgrade: false, isActive: true },
    { id: uuid('viprule-3'), tenantId, name: 'Corporate VIP Segment', description: 'Guests in the corporate VIP segment', ruleType: 'segment', conditions: '{"segment": "corporate_vip"}', alertLevel: 'vip', alertMessage: 'Corporate VIP — ensure executive floor room', autoUpgrade: false, isActive: true },
  ];
  await prisma.vipRule.createMany({ data: vipRules });

  await prisma.vipAlert.createMany({
    data: [
      { id: uuid('vipalert-1'), tenantId, propertyId, ruleId: uuid('viprule-1'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), alertLevel: 'vvip', message: 'Platinum guest Rahul Banerjee checked in — 25 stays, ₹2.5L spent', isRead: true, readBy: uuid('user-2'), readAt: daysAgo(1) },
      { id: uuid('vipalert-2'), tenantId, propertyId, ruleId: uuid('viprule-2'), guestId: uuid('guest-5'), bookingId: uuid('booking-4'), alertLevel: 'vip', message: 'High-value guest Vikram Singh arriving — ₹92K total spent', isRead: false },
      { id: uuid('vipalert-3'), tenantId, propertyId, ruleId: uuid('viprule-1'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), alertLevel: 'vvip', message: 'Platinum guest Amit Mukherjee — 12 stays, ₹85K spent', isRead: true, readBy: uuid('user-1'), readAt: daysAgo(2) },
      { id: uuid('vipalert-4'), tenantId, propertyId, ruleId: uuid('viprule-2'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), alertLevel: 'vip', message: 'Rahul Banerjee exceeds ₹50K spend threshold', isRead: false },
      { id: uuid('vipalert-5'), tenantId, propertyId, ruleId: uuid('viprule-3'), guestId: uuid('guest-1'), alertLevel: 'vip', message: 'Corporate VIP Amit Mukherjee identified', isRead: true, readBy: uuid('user-2'), readAt: daysAgo(3), actionTaken: 'Upgraded to Executive Suite' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. GUEST CREDIT LIMITS
  // ═══════════════════════════════════════════════════════════════
  console.log('  💳 Guest credit limits…');
  await prisma.guestCreditLimit.deleteMany({});

  await prisma.guestCreditLimit.createMany({
    data: [
      { id: uuid('creditlimit-1'), tenantId, guestId: uuid('guest-1'), limitAmount: 50000, currentBalance: 12500, availableCredit: 37500, status: 'active', adjustedBy: uuid('user-1'), notes: 'Gold tier — standard credit line' },
      { id: uuid('creditlimit-2'), tenantId, guestId: uuid('guest-3'), limitAmount: 100000, currentBalance: 28000, availableCredit: 72000, status: 'active', adjustedBy: uuid('user-1'), notes: 'Platinum tier — enhanced credit line' },
      { id: uuid('creditlimit-3'), tenantId, guestId: uuid('guest-5'), limitAmount: 50000, currentBalance: 0, availableCredit: 50000, status: 'active', adjustedBy: uuid('user-2'), notes: 'Gold tier — standard credit line' },
      { id: uuid('creditlimit-4'), tenantId, guestId: uuid('guest-2'), limitAmount: 25000, currentBalance: 18500, availableCredit: 6500, status: 'active', adjustedBy: uuid('user-2'), notes: 'Silver tier — limited credit' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. DIGITAL KEY ACCESS LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🔑 Digital key access logs…');
  await prisma.digitalKeyAccessLog.deleteMany({});

  await prisma.digitalKeyAccessLog.createMany({
    data: [
      { id: uuid('dklog-1'), tenantId, roomId: uuid('room-501'), guestId: uuid('guest-1'), accessType: 'unlock', method: 'mobile_app', success: true, deviceType: 'iOS', ipAddress: '10.0.1.45', accessedAt: daysAgo(2) },
      { id: uuid('dklog-2'), tenantId, roomId: uuid('room-501'), guestId: uuid('guest-1'), accessType: 'lock', method: 'mobile_app', success: true, deviceType: 'iOS', ipAddress: '10.0.1.45', accessedAt: daysAgo(2) },
      { id: uuid('dklog-3'), tenantId, roomId: uuid('room-801'), guestId: uuid('guest-3'), accessType: 'unlock', method: 'mobile_app', success: true, deviceType: 'Android', ipAddress: '10.0.1.78', accessedAt: daysAgo(1) },
      { id: uuid('dklog-4'), tenantId, roomId: uuid('room-801'), guestId: uuid('guest-3'), accessType: 'unlock', method: 'mobile_app', success: false, failureReason: 'Key expired', deviceType: 'Android', ipAddress: '10.0.1.78', accessedAt: daysAgo(1) },
      { id: uuid('dklog-5'), tenantId, roomId: uuid('room-305'), guestId: uuid('guest-6'), accessType: 'unlock', method: 'nfc_card', success: true, accessedAt: daysAgo(3) },
      { id: uuid('dklog-6'), tenantId, roomId: uuid('room-501'), guestId: uuid('guest-1'), accessType: 'unlock', method: 'mobile_app', success: true, deviceType: 'iOS', ipAddress: '10.0.1.45', accessedAt: daysAgo(1) },
      { id: uuid('dklog-7'), tenantId, roomId: uuid('room-801'), guestId: uuid('guest-3'), accessType: 'lock', method: 'mobile_app', success: true, deviceType: 'Android', accessedAt: daysAgo(0) },
      { id: uuid('dklog-8'), tenantId, roomId: uuid('room-305'), guestId: uuid('guest-6'), accessType: 'lock', method: 'nfc_card', success: true, accessedAt: daysAgo(0) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 7-8. SMART LOCKS & SMART LOCK ACCESS LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🔐 Smart locks & access logs…');
  await prisma.smartLockAccessLog.deleteMany({});
  await prisma.smartLock.deleteMany({});

  const smartLocks = [
    { id: uuid('slock-1'), tenantId, propertyId, roomId: uuid('room-501'), name: 'Room 501 Lock', provider: 'assa_abloy', lockId: uuid('lock-hw-501'), firmwareVersion: '3.2.1', batteryLevel: 87, signalStrength: -45, doorStatus: 'closed', lockStatus: 'locked', lastActivity: daysAgo(0), isActive: true },
    { id: uuid('slock-2'), tenantId, propertyId, roomId: uuid('room-801'), name: 'Room 801 Lock', provider: 'assa_abloy', lockId: uuid('lock-hw-801'), firmwareVersion: '3.2.1', batteryLevel: 95, signalStrength: -38, doorStatus: 'closed', lockStatus: 'locked', lastActivity: daysAgo(0), isActive: true },
    { id: uuid('slock-3'), tenantId, propertyId, roomId: uuid('room-1002'), name: 'Room 1002 Lock', provider: 'salto', lockId: uuid('lock-hw-1002'), firmwareVersion: '2.8.4', batteryLevel: 72, signalStrength: -52, doorStatus: 'closed', lockStatus: 'locked', lastActivity: daysAgo(1), isActive: true },
    { id: uuid('slock-4'), tenantId, propertyId, roomId: uuid('room-305'), name: 'Room 305 Lock', provider: 'dormakaba', lockId: uuid('lock-hw-305'), firmwareVersion: '4.1.0', batteryLevel: 63, signalStrength: -60, doorStatus: 'closed', lockStatus: 'locked', lastActivity: daysAgo(0), isActive: true },
  ];
  await prisma.smartLock.createMany({ data: smartLocks });

  await prisma.smartLockAccessLog.createMany({
    data: [
      { id: uuid('slocklog-1'), tenantId, lockId: uuid('slock-1'), guestId: uuid('guest-1'), accessMethod: 'mobile_key', action: 'unlock', success: true, createdAt: daysAgo(2) },
      { id: uuid('slocklog-2'), tenantId, lockId: uuid('slock-1'), guestId: uuid('guest-1'), accessMethod: 'mobile_key', action: 'lock', success: true, createdAt: daysAgo(2) },
      { id: uuid('slocklog-3'), tenantId, lockId: uuid('slock-2'), guestId: uuid('guest-3'), accessMethod: 'mobile_key', action: 'unlock', success: true, createdAt: daysAgo(1) },
      { id: uuid('slocklog-4'), tenantId, lockId: uuid('slock-2'), userId: uuid('user-2'), accessMethod: 'master_key', action: 'unlock', success: true, createdAt: daysAgo(1) },
      { id: uuid('slocklog-5'), tenantId, lockId: uuid('slock-3'), guestId: uuid('guest-5'), accessMethod: 'key_card', action: 'unlock', success: true, createdAt: daysAgo(0) },
      { id: uuid('slocklog-6'), tenantId, lockId: uuid('slock-4'), guestId: uuid('guest-6'), accessMethod: 'key_card', action: 'unlock', success: true, createdAt: daysAgo(3) },
      { id: uuid('slocklog-7'), tenantId, lockId: uuid('slock-4'), guestId: uuid('guest-6'), accessMethod: 'key_card', action: 'lock', success: true, createdAt: daysAgo(0) },
      { id: uuid('slocklog-8'), tenantId, lockId: uuid('slock-1'), guestId: uuid('guest-1'), accessMethod: 'mobile_key', action: 'unlock', success: true, createdAt: daysAgo(1) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. KEY CARDS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🪪 Key cards…');
  await prisma.keyCard.deleteMany({});

  await prisma.keyCard.createMany({
    data: [
      { id: uuid('keycard-1'), tenantId, propertyId, roomId: uuid('room-501'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), cardNumber: 'KC-501-0001', cardType: 'digital', issuerName: 'Priya Das', status: 'active', issuedAt: daysAgo(2), activatedAt: daysAgo(2), validFrom: daysAgo(2), validTo: daysFromNow(1) },
      { id: uuid('keycard-2'), tenantId, propertyId, roomId: uuid('room-801'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), cardNumber: 'KC-801-0001', cardType: 'digital', issuerName: 'Priya Das', status: 'active', issuedAt: daysAgo(1), activatedAt: daysAgo(1), validFrom: daysAgo(1), validTo: daysFromNow(3), accessLevel: 'vip' },
      { id: uuid('keycard-3'), tenantId, propertyId, roomId: uuid('room-1002'), guestId: uuid('guest-5'), bookingId: uuid('booking-4'), cardNumber: 'KC-1002-0001', cardType: 'digital', issuerName: 'Priya Das', status: 'issued', issuedAt: daysAgo(0), validFrom: daysFromNow(0), validTo: daysFromNow(2), accessLevel: 'vip' },
      { id: uuid('keycard-4'), tenantId, propertyId, roomId: uuid('room-305'), guestId: uuid('guest-6'), bookingId: uuid('booking-6'), cardNumber: 'KC-305-0001', cardType: 'physical', issuerName: 'Anita Roy', status: 'active', issuedAt: daysAgo(3), activatedAt: daysAgo(3), validFrom: daysAgo(3), validTo: daysFromNow(0) },
      { id: uuid('keycard-5'), tenantId, propertyId, roomId: uuid('room-510'), cardNumber: 'KC-510-0001', cardType: 'physical', issuerName: 'Anita Roy', status: 'deactivated', issuedAt: daysAgo(10), deactivatedAt: daysAgo(7), validFrom: daysAgo(10), validTo: daysAgo(3), notes: 'Master card for housekeeping' },
      { id: uuid('keycard-6'), tenantId, propertyId, roomId: uuid('room-101'), cardNumber: 'KC-101-0001', cardType: 'physical', issuerName: 'Priya Das', status: 'returned', issuedAt: daysAgo(15), returnedAt: daysAgo(12), returnReason: 'Guest checkout', validFrom: daysAgo(15), validTo: daysAgo(12) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 10-11. AI CONVERSATIONS & MESSAGES
  // ═══════════════════════════════════════════════════════════════
  console.log('  🤖 AI conversations & messages…');
  await prisma.aiConversationMessage.deleteMany({});
  await prisma.aiConversation.deleteMany({});

  await prisma.aiConversation.createMany({
    data: [
      { id: uuid('aiconv-1'), tenantId, userId: uuid('user-1'), title: 'Pricing Strategy for Durga Puja', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { id: uuid('aiconv-2'), tenantId, userId: uuid('user-1'), title: 'Occupancy Forecast Analysis', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { id: uuid('aiconv-3'), tenantId, userId: uuid('user-1'), title: 'Guest Segmentation Ideas', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    ],
  });

  await prisma.aiConversationMessage.createMany({
    data: [
      { id: uuid('aimsg-1'), conversationId: uuid('aiconv-1'), role: 'user', content: 'What pricing strategy should I use for Durga Puja week? We usually see 95% occupancy.', createdAt: daysAgo(3) },
      { id: uuid('aimsg-2'), conversationId: uuid('aiconv-1'), role: 'assistant', content: 'Based on your historical data, I recommend a 30-40% premium over BAR for Durga Puja week. Implement a tiered approach: Book 60% at 30% premium 45 days out, then increase to 40% premium as you approach 80% occupancy. Consider a 3-night minimum stay restriction.', createdAt: daysAgo(3) },
      { id: uuid('aimsg-3'), conversationId: uuid('aiconv-1'), role: 'user', content: 'Should I offer any packages?', createdAt: daysAgo(3) },
      { id: uuid('aimsg-4'), conversationId: uuid('aiconv-1'), role: 'assistant', content: 'Yes! A "Puja Special" package with room + breakfast + airport transfer could command an additional ₹2,000-3,000 premium. Also consider a "Family Bundle" for suites with complimentary kids\' meals and a puja gift hamper.', createdAt: daysAgo(3) },
      { id: uuid('aimsg-5'), conversationId: uuid('aiconv-2'), role: 'user', content: 'What is the occupancy forecast for next month?', createdAt: daysAgo(1) },
      { id: uuid('aimsg-6'), conversationId: uuid('aiconv-2'), role: 'assistant', content: 'Based on current pace and historical patterns, next month is projected at 72% occupancy (vs 68% last year). Weekends are trending at 88% while weekdays are at 62%. Booking.com is your strongest channel at 45% of bookings.', createdAt: daysAgo(1) },
      { id: uuid('aimsg-7'), conversationId: uuid('aiconv-2'), role: 'user', content: 'How can I improve weekday occupancy?', createdAt: daysAgo(1) },
      { id: uuid('aimsg-8'), conversationId: uuid('aiconv-2'), role: 'assistant', content: 'Consider a "Corporate Midweek" rate plan with 20% off BAR for Mon-Thu stays targeting business travelers. Also activate a "Stay 3 Pay 2" promotion on direct bookings. Corporate bookings currently account for only 15% — there\'s room to grow.', createdAt: daysAgo(1) },
      { id: uuid('aimsg-9'), conversationId: uuid('aiconv-3'), role: 'user', content: 'Suggest guest segmentation strategies for our property.', createdAt: daysAgo(0) },
      { id: uuid('aimsg-10'), conversationId: uuid('aiconv-3'), role: 'assistant', content: 'Based on your guest data, I see 4 clear segments: 1) Business Regulars (35%, avg stay 2 nights, M-Th), 2) Leisure Families (28%, avg stay 3 nights, weekends), 3) Event Groups (22%, avg stay 2-4 nights), 4) OTA Price Shoppers (15%, 1 night stays). Each segment has distinct spending patterns.', createdAt: daysAgo(0) },
      { id: uuid('aimsg-11'), conversationId: uuid('aiconv-3'), role: 'user', content: 'What loyalty perks work best for Business Regulars?', createdAt: daysAgo(0) },
      { id: uuid('aimsg-12'), conversationId: uuid('aiconv-3'), role: 'assistant', content: 'Business Regulars value: free late checkout (most requested), room upgrade on availability, dedicated express check-in/out, complimentary laundry for stays 3+ nights, and meeting room discounts. These drive 40% higher repeat booking rates based on industry benchmarks.', createdAt: daysAgo(0) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 12. AI SUGGESTIONS
  // ═══════════════════════════════════════════════════════════════
  console.log('  💡 AI suggestions…');
  await prisma.aISuggestion.deleteMany({});

  await prisma.aISuggestion.createMany({
    data: [
      { id: uuid('aisug-1'), tenantId, type: 'pricing', title: 'Increase weekend rates by 15%', description: 'Weekend demand is outpacing supply. Current ADR of ₹5,800 could be raised to ₹6,670 based on demand elasticity analysis.', impact: 'high', potentialRevenue: 45000, confidence: 0.92, status: 'pending', data: '{"currentADR":5800,"suggestedADR":6670,"roomsAffected":35,"avgWeekendOccupancy":0.88}' },
      { id: uuid('aisug-2'), tenantId, type: 'occupancy', title: 'Launch corporate midweek promotion', description: 'Weekday occupancy is at 62%. A corporate rate with 20% discount Mon-Thu could fill 15-20 additional rooms per week.', impact: 'medium', potentialRevenue: 28000, confidence: 0.85, status: 'applied', appliedAt: daysAgo(2), data: '{"currentWeekdayOcc":0.62,"targetOcc":0.75,"discount":0.20}' },
      { id: uuid('aisug-3'), tenantId, type: 'upsell', title: 'Offer suite upgrades to gold guests', description: '12 gold-tier guests have upcoming bookings in Deluxe rooms. Suite upgrades at ₹3,000/night could generate ₹72,000 additional revenue.', impact: 'medium', potentialRevenue: 72000, confidence: 0.78, status: 'pending', data: '{"eligibleGuests":12,"upgradePrice":3000,"avgStayNights":2}' },
      { id: uuid('aisug-4'), tenantId, type: 'channel', title: 'Reduce Airbnb allocation by 10%', description: 'Airbnb shows 12% cancellation rate vs 4% on direct. Shifting inventory to direct and Booking.com could reduce revenue leakage.', impact: 'low', potentialRevenue: 15000, confidence: 0.71, status: 'dismissed', dismissedAt: daysAgo(5) },
      { id: uuid('aisug-5'), tenantId, type: 'revenue', title: 'Implement length-of-stay pricing', description: 'Guests staying 1 night pay full BAR while 3+ night guests get 10% off. A graduated discount model could increase average stay length from 2.1 to 2.5 nights.', impact: 'high', potentialRevenue: 65000, confidence: 0.88, status: 'pending', data: '{"currentAvgStay":2.1,"targetAvgStay":2.5,"avgRoomRate":5500}' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 13. AUTOMATION TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  console.log('  ⚡ Automation templates…');
  await prisma.automationTemplate.deleteMany({});

  await prisma.automationTemplate.createMany({
    data: [
      { id: uuid('autotmpl-1'), tenantId, name: 'Pre-Arrival Email', description: 'Send a welcome email with check-in instructions 24 hours before arrival', category: 'pre_arrival', triggerEvent: 'booking.checked_in', triggerConditions: '{"hoursBefore": 24}', actions: '[{"type": "send_email", "template": "pre-arrival"}]', isSystem: true, usageCount: 156, isActive: true, sortOrder: 0, icon: 'mail' },
      { id: uuid('autotmpl-2'), tenantId, name: 'Post-Checkout Review Request', description: 'Send a review request and NPS survey after checkout', category: 'post_stay', triggerEvent: 'booking.checked_out', triggerConditions: '{"hoursAfter": 24}', actions: '[{"type": "send_email", "template": "review-request"}, {"type": "send_nps_survey"}]', isSystem: true, usageCount: 142, isActive: true, sortOrder: 1, icon: 'star' },
      { id: uuid('autotmpl-3'), tenantId, name: 'Auto Housekeeping on Checkout', description: 'Create a cleaning task when a guest checks out', category: 'housekeeping', triggerEvent: 'booking.checked_out', actions: '[{"type": "create_task", "taskType": "cleaning", "priority": "high"}]', isSystem: true, usageCount: 298, isActive: true, sortOrder: 2, icon: 'sparkles' },
      { id: uuid('autotmpl-4'), tenantId, name: 'VIP Guest Welcome', description: 'Send VIP alert and prepare welcome amenities for VIP guests', category: 'vip', triggerEvent: 'vip.alert_created', actions: '[{"type": "notify_staff", "roles": ["front_desk", "housekeeping"]}, {"type": "create_task", "taskType": "amenity_setup", "priority": "urgent"}]', isSystem: true, usageCount: 34, isActive: true, sortOrder: 3, icon: 'crown' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 14. AUTOMATION EXECUTION LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📋 Automation execution logs…');
  await prisma.automationExecutionLog.deleteMany({});

  await prisma.automationExecutionLog.createMany({
    data: [
      { id: uuid('autolog-1'), ruleId: uuid('arule-1'), triggerData: '{"bookingId": "booking-1", "guestId": "guest-1"}', status: 'completed', actionsResult: '{"emails_sent": 1, "sms_sent": 1}', executedAt: daysAgo(2) },
      { id: uuid('autolog-2'), ruleId: uuid('arule-1'), triggerData: '{"bookingId": "booking-2", "guestId": "guest-3"}', status: 'completed', actionsResult: '{"emails_sent": 1, "sms_sent": 1}', executedAt: daysAgo(1) },
      { id: uuid('autolog-3'), ruleId: uuid('arule-2'), triggerData: '{"bookingId": "booking-6", "guestId": "guest-6"}', status: 'completed', actionsResult: '{"emails_sent": 1}', executedAt: daysAgo(0) },
      { id: uuid('autolog-4'), ruleId: uuid('arule-3'), triggerData: '{"bookingId": "booking-5", "roomId": "room-101"}', status: 'completed', actionsResult: '{"room_status_updated": true, "task_created": true}', executedAt: daysAgo(1) },
      { id: uuid('autolog-5'), ruleId: uuid('arule-1'), triggerData: '{"bookingId": "booking-3", "guestId": "guest-2"}', status: 'failed', errorMessage: 'Email service timeout — retry scheduled', executedAt: daysAgo(0) },
      { id: uuid('autolog-6'), ruleId: uuid('arule-3'), triggerData: '{"bookingId": "booking-4", "roomId": "room-1002"}', status: 'completed', actionsResult: '{"room_status_updated": true, "task_created": true}', executedAt: daysAgo(0) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 15. PAYMENT GATEWAYS
  // ═══════════════════════════════════════════════════════════════
  console.log('  💰 Payment gateways…');
  await prisma.paymentGateway.deleteMany({});

  await prisma.paymentGateway.createMany({
    data: [
      { id: uuid('paygw-1'), tenantId, name: 'Razorpay', provider: 'razorpay', priority: 1, isPrimary: true, status: 'active', mode: 'live', apiKey: 'rzp_live_xxxxxxxxxx', merchantId: uuid('rzp-merchant-1'), feePercentage: 2.0, feeFixed: 0, supportedCurrencies: 'INR', totalTransactions: 1245, totalVolume: 4850000, lastSyncAt: daysAgo(0) },
      { id: uuid('paygw-2'), tenantId, name: 'Stripe', provider: 'stripe', priority: 2, isPrimary: false, status: 'active', mode: 'live', apiKey: 'sk_live_xxxxxxxxxx', feePercentage: 2.9, feeFixed: 0, supportedCurrencies: 'USD,EUR,GBP,INR', totalTransactions: 342, totalVolume: 1250000, lastSyncAt: daysAgo(0) },
      { id: uuid('paygw-3'), tenantId, name: 'PhonePe', provider: 'phonepe', priority: 3, isPrimary: false, status: 'active', mode: 'live', apiKey: 'pp_live_xxxxxxxxxx', feePercentage: 1.5, feeFixed: 0, supportedCurrencies: 'INR', totalTransactions: 890, totalVolume: 3200000, lastSyncAt: daysAgo(0) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 16. HARDWARE ADAPTERS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🔧 Hardware adapters…');
  await prisma.hardwareAdapter.deleteMany({});

  await prisma.hardwareAdapter.createMany({
    data: [
      { id: uuid('hwadpt-1'), tenantId, propertyId, providerId: 'assa-abloy-visionline', category: 'lock', displayName: 'ASSA ABLOY Visionline', config: '{"apiUrl": "https://api.assaabloy.com/v1", "hotelCode": "RSKOL"}', credentials: '{"clientId": "xx", "clientSecret": "xx"}', enabled: true, healthStatus: 'healthy', lastHealthyAt: daysAgo(0), lastCheckedAt: daysAgo(0) },
      { id: uuid('hwadpt-2'), tenantId, propertyId, providerId: 'salto-ks', category: 'lock', displayName: 'Salto KS', config: '{"apiUrl": "https://api.saltoks.com/v2", "siteId": "RSKOL-SITE-01"}', credentials: '{"apiKey": "xx", "apiSecret": "xx"}', enabled: true, healthStatus: 'healthy', lastHealthyAt: daysAgo(0), lastCheckedAt: daysAgo(0) },
      { id: uuid('hwadpt-3'), tenantId, propertyId, providerId: 'dormakaba-saflok', category: 'lock', displayName: 'dormakaba Saflok', config: '{"apiUrl": "https://api.dormakaba.com/v1", "propertyCode": "RSKOL-DK"}', credentials: '{"apiKey": "xx"}', enabled: true, healthStatus: 'degraded', lastHealthyAt: daysAgo(1), lastCheckedAt: daysAgo(0) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 17-19. INVENTORY ITEMS, STOCK CONSUMPTION, INVENTORY MOVEMENTS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📦 Inventory items, consumption, movements…');
  await prisma.inventoryMovement.deleteMany({});
  await prisma.stockConsumption.deleteMany({});
  await prisma.inventoryItem.deleteMany({});

  await prisma.inventoryItem.createMany({
    data: [
      { id: uuid('invitem-1'), propertyId, name: 'Bath Towels (Premium)', category: 'Linens', currentStock: 200, unit: 'pcs', unitCost: 280, lowStockThreshold: 50, reorderLevel: 30, supplierName: 'Kolkata Textiles', status: 'in_stock', lastRestocked: daysAgo(5) },
      { id: uuid('invitem-2'), propertyId, name: 'Bed Sheets (King)', category: 'Linens', currentStock: 150, unit: 'pcs', unitCost: 450, lowStockThreshold: 40, reorderLevel: 25, supplierName: 'Kolkata Textiles', status: 'in_stock', lastRestocked: daysAgo(7) },
      { id: uuid('invitem-3'), propertyId, name: 'Pillows (Hypoallergenic)', category: 'Linens', currentStock: 120, unit: 'pcs', unitCost: 350, lowStockThreshold: 30, reorderLevel: 20, supplierName: 'SleepWell India', status: 'in_stock', lastRestocked: daysAgo(10) },
      { id: uuid('invitem-4'), propertyId, name: 'Shampoo 50ml Bottles', category: 'Amenities', currentStock: 500, unit: 'pcs', unitCost: 35, lowStockThreshold: 100, reorderLevel: 200, supplierName: 'AmenityPro', status: 'in_stock', lastRestocked: daysAgo(3) },
      { id: uuid('invitem-5'), propertyId, name: 'Body Lotion 50ml Bottles', category: 'Amenities', currentStock: 450, unit: 'pcs', unitCost: 32, lowStockThreshold: 100, reorderLevel: 200, supplierName: 'AmenityPro', status: 'in_stock', lastRestocked: daysAgo(3) },
      { id: uuid('invitem-6'), propertyId, name: 'Toilet Paper Rolls', category: 'Consumables', currentStock: 800, unit: 'rolls', unitCost: 15, lowStockThreshold: 200, reorderLevel: 400, supplierName: 'CleanSupply Co', status: 'in_stock', lastRestocked: daysAgo(2) },
      { id: uuid('invitem-7'), propertyId, name: 'Hand Soap Dispensers', category: 'Amenities', currentStock: 15, unit: 'pcs', unitCost: 180, lowStockThreshold: 10, reorderLevel: 5, supplierName: 'AmenityPro', status: 'low_stock', lastRestocked: daysAgo(20) },
      { id: uuid('invitem-8'), propertyId, name: 'Slippers (Disposable)', category: 'Amenities', currentStock: 300, unit: 'pairs', unitCost: 25, lowStockThreshold: 75, reorderLevel: 100, supplierName: 'HotelSupplies India', status: 'in_stock', lastRestocked: daysAgo(4) },
      { id: uuid('invitem-9'), propertyId, name: 'Coffee Sachets (Nescafe)', category: 'F&B', currentStock: 1000, unit: 'pcs', unitCost: 12, lowStockThreshold: 250, reorderLevel: 500, supplierName: 'Nestle India', status: 'in_stock', lastRestocked: daysAgo(6) },
      { id: uuid('invitem-10'), propertyId, name: 'Bathrobes (White)', category: 'Linens', currentStock: 8, unit: 'pcs', unitCost: 1200, lowStockThreshold: 10, reorderLevel: 5, supplierName: 'Kolkata Textiles', status: 'low_stock', lastRestocked: daysAgo(30) },
    ],
  });

  await prisma.stockConsumption.createMany({
    data: [
      { id: uuid('stockcons-1'), stockItemId: uuid('stock-1'), quantity: 12, type: 'room_turnover', reference: 'Room 501 checkout', cost: 3000, notes: 'Standard room cleaning', recordedBy: uuid('user-3'), createdAt: daysAgo(2) },
      { id: uuid('stockcons-2'), stockItemId: uuid('stock-3'), quantity: 4, type: 'room_turnover', reference: 'Room 801 checkout', cost: 140, notes: 'Suite amenity refill', recordedBy: uuid('user-3'), createdAt: daysAgo(1) },
      { id: uuid('stockcons-3'), stockItemId: uuid('stock-5'), quantity: 8, type: 'restock', reference: 'Floor 5 restocking', cost: 120, notes: 'Weekly floor restock', recordedBy: uuid('user-3'), createdAt: daysAgo(1) },
      { id: uuid('stockcons-4'), stockItemId: uuid('stock-2'), quantity: 10, type: 'room_turnover', reference: 'Room 501 turnover', cost: 1500, notes: 'Regular turnover', recordedBy: uuid('user-3'), createdAt: daysAgo(3) },
      { id: uuid('stockcons-5'), stockItemId: uuid('stock-6'), quantity: 6, type: 'room_turnover', reference: 'Floor 3 amenity refill', cost: 150, notes: 'Hand soap dispensers', recordedBy: uuid('user-3'), createdAt: daysAgo(2) },
      { id: uuid('stockcons-6'), stockItemId: uuid('stock-1'), quantity: 20, type: 'damage', reference: 'Discarded damaged towels', cost: 5000, notes: 'Stained and torn — disposed', recordedBy: uuid('user-3'), createdAt: daysAgo(5) },
      { id: uuid('stockcons-7'), stockItemId: uuid('stock-4'), quantity: 8, type: 'room_turnover', reference: 'Room 1002 preparation', cost: 280, notes: 'Presidential suite setup', recordedBy: uuid('user-3'), createdAt: daysAgo(0) },
      { id: uuid('stockcons-8'), stockItemId: uuid('stock-3'), quantity: 6, type: 'room_turnover', reference: 'Room 305 checkout', cost: 210, notes: 'Regular amenity replacement', recordedBy: uuid('user-3'), createdAt: daysAgo(0) },
    ],
  });

  await prisma.inventoryMovement.createMany({
    data: [
      { id: uuid('invmove-1'), propertyId, inventoryItemId: uuid('invitem-1'), quantity: 50, previousStock: 150, newStock: 200, reason: 'purchase_received', note: 'PO-2024-015 received from Kolkata Textiles', performedBy: uuid('user-3'), createdAt: daysAgo(5) },
      { id: uuid('invmove-2'), propertyId, inventoryItemId: uuid('invitem-4'), quantity: 200, previousStock: 300, newStock: 500, reason: 'purchase_received', note: 'PO-2024-016 received from AmenityPro', performedBy: uuid('user-3'), createdAt: daysAgo(3) },
      { id: uuid('invmove-3'), propertyId, inventoryItemId: uuid('invitem-1'), quantity: -12, previousStock: 212, newStock: 200, reason: 'consumption', note: 'Room 501 checkout consumption', performedBy: uuid('user-3'), createdAt: daysAgo(2) },
      { id: uuid('invmove-4'), propertyId, inventoryItemId: uuid('invitem-6'), quantity: -8, previousStock: 808, newStock: 800, reason: 'consumption', note: 'Floor 5 restocking', performedBy: uuid('user-3'), createdAt: daysAgo(1) },
      { id: uuid('invmove-5'), propertyId, inventoryItemId: uuid('invitem-10'), quantity: -2, previousStock: 10, newStock: 8, reason: 'damage', note: 'Bathrobes returned damaged — disposed', performedBy: uuid('user-3'), createdAt: daysAgo(0) },
      { id: uuid('invmove-6'), propertyId, inventoryItemId: uuid('invitem-9'), quantity: 500, previousStock: 500, newStock: 1000, reason: 'purchase_received', note: 'PO-2024-017 received from Nestle India', performedBy: uuid('user-3'), createdAt: daysAgo(6) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 20-21. SUBSCRIPTIONS & INVOICES
  // ═══════════════════════════════════════════════════════════════
  console.log('  📋 Subscriptions & invoices…');
  await prisma.subscriptionInvoice.deleteMany({});
  await prisma.subscription.deleteMany({});

  // Get actual subscription plan IDs from database
  const subPlans = await prisma.subscriptionPlan.findMany({ select: { id: true, name: true } });
  const subEntPlan = subPlans.find(p => p.name === 'enterprise') || subPlans[0];
  const subProPlan = subPlans.find(p => p.name === 'professional') || subPlans[1];

  await prisma.subscription.createMany({
    data: [
      {
        id: uuid('sub-1'),
        tenantId,
        planId: subEntPlan?.id || '',
        planName: 'Enterprise Cloud',
        billingCycle: 'monthly',
        amount: 17999,
        currency: 'INR',
        status: 'active',
        currentPeriodStart: daysAgo(15),
        currentPeriodEnd: daysFromNow(15),
      },
      {
        id: uuid('sub-2'),
        tenantId,
        planId: subProPlan?.id || '',
        planName: 'Professional Cloud',
        billingCycle: 'yearly',
        amount: 99990,
        currency: 'INR',
        status: 'active',
        currentPeriodStart: daysAgo(180),
        currentPeriodEnd: daysFromNow(185),
      },
    ],
  });

  await prisma.subscriptionInvoice.createMany({
    data: [
      { id: uuid('subinv-1'), subscriptionId: uuid('sub-1'), invoiceNumber: 'INV-SUB-2024-001', amount: 17999, currency: 'INR', status: 'paid', issuedAt: daysAgo(45), dueAt: daysAgo(30), paidAt: daysAgo(32) },
      { id: uuid('subinv-2'), subscriptionId: uuid('sub-1'), invoiceNumber: 'INV-SUB-2024-002', amount: 17999, currency: 'INR', status: 'paid', issuedAt: daysAgo(15), dueAt: daysFromNow(0), paidAt: daysAgo(12) },
      { id: uuid('subinv-3'), subscriptionId: uuid('sub-2'), invoiceNumber: 'INV-SUB-2024-003', amount: 99990, currency: 'INR', status: 'paid', issuedAt: daysAgo(180), dueAt: daysAgo(165), paidAt: daysAgo(170) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 22. LICENSE KEYS (FK → RegistrationPlan, not SubscriptionPlan!)
  // ═══════════════════════════════════════════════════════════════
  console.log('  🔑 License keys…');
  await prisma.licenseKey.deleteMany({});

  // Ensure RegistrationPlan records exist (LicenseKey.planId → RegistrationPlan)
  const regPlans = await prisma.registrationPlan.findMany({ select: { id: true, name: true } });
  if (regPlans.length === 0) {
    await prisma.registrationPlan.createMany({
      data: [
        { id: uuid('regplan-trial'), name: 'trial', displayName: 'Trial', description: '14-day free trial', price: 0, currency: 'INR', maxProperties: 1, maxRoomsPerProperty: 10, maxUsers: 3, maxStaff: 5, sortOrder: 0, isActive: true, highlighted: false, trialDays: 14 },
        { id: uuid('regplan-starter'), name: 'starter', displayName: 'Starter Cloud', description: 'For small hotels up to 30 rooms', price: 4999, currency: 'INR', maxProperties: 1, maxRoomsPerProperty: 30, maxUsers: 5, maxStaff: 10, sortOrder: 1, isActive: true, highlighted: false },
        { id: uuid('regplan-professional'), name: 'professional', displayName: 'Professional Cloud', description: 'For growing hotels up to 80 rooms', price: 9999, currency: 'INR', maxProperties: 2, maxRoomsPerProperty: 80, maxUsers: 15, maxStaff: 25, sortOrder: 2, isActive: true, highlighted: true },
        { id: uuid('regplan-enterprise'), name: 'enterprise', displayName: 'Enterprise Cloud', description: 'For large hotels & chains up to 200 rooms', price: 17999, currency: 'INR', maxProperties: 5, maxRoomsPerProperty: 200, maxUsers: 30, maxStaff: 50, sortOrder: 3, isActive: true, highlighted: false },
      ],
    });
  }

  const regPlansNow = await prisma.registrationPlan.findMany({ select: { id: true, name: true } });
  const enterprisePlan = regPlansNow.find(p => p.name === 'enterprise') || regPlansNow[0];
  const professionalPlan = regPlansNow.find(p => p.name === 'professional') || regPlansNow[1];
  const starterPlan = regPlansNow.find(p => p.name === 'starter') || regPlansNow[2];

  if (enterprisePlan) {
    await prisma.licenseKey.createMany({
      data: [
        { id: uuid('licensekey-1'), key: 'STS-A1B2-C3D4-E5F6-7890', planId: enterprisePlan.id, status: 'activated', activatedBy: uuid('user-platform'), activatedAt: daysAgo(200), tenantId, expiresAt: daysFromNow(165), note: 'Royal Stay Hotels enterprise activation', batchId: 'batch-2024-Q1' },
        ...(professionalPlan ? [{ id: uuid('licensekey-2'), key: 'STS-F6E5-D4C3-B2A1-0987', planId: professionalPlan.id, status: 'active', generatedBy: uuid('user-platform'), generatedFor: 'Demo partner - Ocean View', expiresAt: daysFromNow(365), note: 'Pre-generated for demo partner', batchId: 'batch-2024-Q2' }] : []),
        ...(starterPlan ? [{ id: uuid('licensekey-3'), key: 'STS-1111-2222-3333-4444', planId: starterPlan.id, status: 'active', generatedBy: uuid('user-platform'), expiresAt: daysFromNow(180), note: 'Trial extension key', batchId: 'batch-2024-Q3' }] : []),
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 23. PLUGINS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🧩 Plugins…');
  await prisma.pluginInstallation.deleteMany({});
  await prisma.plugin.deleteMany({});

  await prisma.plugin.createMany({
    data: [
      { id: uuid('plugin-1'), name: 'WhatsApp Notifications', slug: 'whatsapp-notifications', description: 'Send booking confirmations, reminders, and updates via WhatsApp Business API', version: '2.1.0', author: 'StaySuite', icon: 'message-circle', category: 'communication', status: 'active', isOfficial: true, installedAt: daysAgo(90) },
      { id: uuid('plugin-2'), name: 'GST Compliance', slug: 'gst-compliance', description: 'Auto-generate GST-compliant invoices with HSN/SAC codes and tax breakdowns', version: '1.5.2', author: 'StaySuite', icon: 'receipt', category: 'billing', status: 'active', isOfficial: true, installedAt: daysAgo(90) },
      { id: uuid('plugin-3'), name: 'OTA Review Scraper', slug: 'ota-review-scraper', description: 'Automatically fetch and aggregate reviews from Google, TripAdvisor, and Booking.com', version: '1.2.0', author: 'StaySuite Labs', icon: 'star', category: 'reputation', status: 'active', isOfficial: true, installedAt: daysAgo(60) },
      { id: uuid('plugin-4'), name: 'Dynamic Pricing Engine', slug: 'dynamic-pricing-engine', description: 'AI-powered dynamic pricing based on demand, competition, and market conditions', version: '3.0.0', author: 'StaySuite AI', icon: 'trending-up', category: 'revenue', status: 'active', isOfficial: true, installedAt: daysAgo(30) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 24. FEATURE ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📢 Feature announcements…');
  await prisma.featureAnnouncement.deleteMany({});

  await prisma.featureAnnouncement.createMany({
    data: [
      { id: uuid('featann-1'), title: 'AI-Powered Revenue Recommendations', content: 'StaySuite now provides AI-driven pricing and revenue optimization suggestions. Check the new AI Insights panel on your dashboard for personalized recommendations.', type: 'feature', targetRoles: '["admin","manager"]', startsAt: daysAgo(7), endsAt: daysFromNow(23), dismissible: true, status: 'active' },
      { id: uuid('featann-2'), title: 'WhatsApp Guest Communication', content: 'You can now send booking confirmations, pre-arrival messages, and checkout summaries directly to your guests via WhatsApp. Enable it in Settings > Notifications.', type: 'feature', targetRoles: '["admin","manager","front_desk"]', startsAt: daysAgo(3), endsAt: daysFromNow(27), dismissible: true, status: 'active' },
      { id: uuid('featann-3'), title: 'Scheduled Maintenance Window', content: 'StaySuite will undergo scheduled maintenance on Saturday from 2:00 AM to 4:00 AM IST. Services will be briefly unavailable during this period.', type: 'maintenance', targetRoles: '["*"]', startsAt: daysFromNow(1), endsAt: daysFromNow(2), dismissible: false, status: 'active' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 25. HOTEL WEBSITE
  // ═══════════════════════════════════════════════════════════════
  console.log('  🌐 Hotel website…');
  await prisma.hotelWebsite.deleteMany({});

  await prisma.hotelWebsite.createMany({
    data: [
      {
        id: uuid('hotelweb-1'),
        tenantId,
        propertyId,
        domain: 'royalstay-kolkata.staysuite.com',
        customDomain: 'www.royalstaykolkata.in',
        status: 'published',
        template: 'modern',
        theme: '{"primaryColor":"#10b981","secondaryColor":"#1e293b","fontFamily":"Inter","borderRadius":"8","logoUrl":"/logos/royal-stay.png","heroImageUrl":"/images/royal-stay-hero.jpg"}',
        pages: '[{"slug":"home","title":"Royal Stay Kolkata","published":true},{"slug":"rooms","title":"Rooms & Suites","published":true},{"slug":"dining","title":"Dining","published":true},{"slug":"events","title":"Events","published":true},{"slug":"contact","title":"Contact Us","published":true}]',
        seo: '{"title":"Royal Stay Kolkata | 5-Star Luxury Hotel in Park Street","description":"Experience luxury at Royal Stay Kolkata. Book rooms, suites, and event spaces at the best rates.","keywords":"kolkata hotel, luxury hotel, park street, royal stay"}',
        analytics: '{"googleAnalyticsId":"GA-XXXXXXXXX","facebookPixelId":"FB-XXXXXXXXX"}',
        publishedAt: daysAgo(60),
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 26-27. NPS SURVEYS & RESPONSES
  // ═══════════════════════════════════════════════════════════════
  console.log('  📊 NPS surveys & responses…');
  await prisma.npsResponse.deleteMany({});
  await prisma.npsSurvey.deleteMany({});

  await prisma.npsSurvey.createMany({
    data: [
      { id: uuid('npssurvey-1'), tenantId, propertyId, name: 'Post-Checkout NPS', triggerEvent: 'post_checkout', subject: 'How was your stay at Royal Stay Kolkata?', message: 'We would love to hear about your experience. It only takes a minute!', customQuestion: 'What could we improve?', minScore: 0, maxScore: 10, isActive: true, sentCount: 89, responseCount: 42, avgScore: 8.2 },
      { id: uuid('npssurvey-2'), tenantId, propertyId, name: 'Post-Stay Email NPS', triggerEvent: 'post_stay', subject: 'Tell us about your recent stay', isActive: true, sentCount: 45, responseCount: 28, avgScore: 7.5 },
    ],
  });

  await prisma.npsResponse.createMany({
    data: [
      { id: uuid('npsresp-1'), surveyId: uuid('npssurvey-1'), tenantId, bookingId: uuid('booking-1'), guestId: uuid('guest-1'), score: 10, category: 'promoter', comment: 'Excellent stay! Staff was very courteous and the room was spotless.', respondedAt: daysAgo(1) },
      { id: uuid('npsresp-2'), surveyId: uuid('npssurvey-1'), tenantId, bookingId: uuid('booking-2'), guestId: uuid('guest-3'), score: 9, category: 'promoter', comment: 'Great experience overall. Would love faster WiFi.', respondedAt: daysAgo(1) },
      { id: uuid('npsresp-3'), surveyId: uuid('npssurvey-1'), tenantId, guestId: uuid('guest-2'), score: 8, category: 'promoter', comment: 'Very comfortable room. Breakfast could have more variety.', respondedAt: daysAgo(5) },
      { id: uuid('npsresp-4'), surveyId: uuid('npssurvey-1'), tenantId, guestId: uuid('guest-4'), score: 7, category: 'passive', comment: 'Decent hotel but nothing extraordinary.', respondedAt: daysAgo(10) },
      { id: uuid('npsresp-5'), surveyId: uuid('npssurvey-2'), tenantId, guestId: uuid('guest-5'), score: 4, category: 'detractor', comment: 'Room service was very slow. Had to call twice for extra towels.', respondedAt: daysAgo(7) },
      { id: uuid('npsresp-6'), surveyId: uuid('npssurvey-2'), tenantId, guestId: uuid('guest-6'), score: 9, category: 'promoter', comment: 'Love this hotel! The staff remembers my preferences every time.', respondedAt: daysAgo(3) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 28. PARKING PASSES
  // ═══════════════════════════════════════════════════════════════
  console.log('  🅿️ Parking passes…');
  await prisma.parkingPass.deleteMany({});

  await prisma.parkingPass.createMany({
    data: [
      { id: uuid('parkpass-1'), tenantId, propertyId, holderName: 'Rajesh Sharma', holderEmail: 'rajesh@royalstay.in', holderPhone: '+91-9830010000', licensePlate: 'WB-01-AB-1234', startDate: daysAgo(30), endDate: daysFromNow(60), duration: 'monthly', amount: 5000, currency: 'INR', status: 'active', autoRenew: true, paymentStatus: 'paid' },
      { id: uuid('parkpass-2'), tenantId, propertyId, holderName: 'Priya Das', holderEmail: 'priya@royalstay.in', holderPhone: '+91-9830020000', licensePlate: 'WB-01-CD-5678', startDate: daysAgo(15), endDate: daysFromNow(15), duration: 'monthly', amount: 5000, currency: 'INR', status: 'active', autoRenew: false, paymentStatus: 'paid' },
      { id: uuid('parkpass-3'), tenantId, propertyId, holderName: 'Amit Mukherjee', holderEmail: 'amit.m@email.com', licensePlate: 'WB-02-EF-9012', startDate: daysAgo(60), endDate: daysAgo(5), duration: 'quarterly', amount: 12000, currency: 'INR', status: 'expired', autoRenew: false, paymentStatus: 'paid' },
      { id: uuid('parkpass-4'), tenantId, propertyId, holderName: 'Corporate - TCS', holderEmail: 'travel@tcs.com', licensePlate: 'WB-04-GH-3456', startDate: daysAgo(0), endDate: daysFromNow(30), duration: 'monthly', amount: 5000, currency: 'INR', status: 'active', autoRenew: true, paymentStatus: 'paid', notes: 'Corporate monthly parking — TCS block booking' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 29. INVOICE TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  console.log('  🧾 Invoice templates…');
  await prisma.invoiceTemplate.deleteMany({});

  await prisma.invoiceTemplate.createMany({
    data: [
      {
        id: uuid('invtmpl-1'),
        tenantId,
        name: 'Standard GST Invoice',
        description: 'GST-compliant invoice with HSN/SAC codes, CGST, SGST breakdown',
        isDefault: true,
        logoUrl: '/logos/royal-stay.png',
        primaryColor: '#10b981',
        footerText: 'Royal Stay Hotels | 123 Park Street, Kolkata 700016 | GSTIN: 19AABCR1234F1Z5 | PAN: AABCR1234F',
      },
      {
        id: uuid('invtmpl-2'),
        tenantId,
        name: 'Proforma Invoice',
        description: 'Proforma invoice for advance payments and corporate billing',
        isDefault: false,
        logoUrl: '/logos/royal-stay.png',
        primaryColor: '#1e293b',
        footerText: 'This is a proforma invoice and not a tax invoice. Validity: 7 days from issue date.',
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 30-31. CHANNEL SETTLEMENTS & ITEMS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🏦 Channel settlements & items…');
  await prisma.channelSettlementItem.deleteMany({});
  await prisma.channelSettlement.deleteMany({});

  await prisma.channelSettlement.createMany({
    data: [
      {
        id: uuid('chsettle-1'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-1'),
        channelCode: 'booking_com',
        settlementRef: 'BC-SETTLE-2024-001',
        periodFrom: daysAgo(60),
        periodTo: daysAgo(30),
        totalBookings: 28,
        totalGross: 385000,
        totalCommission: 57750,
        totalNet: 327250,
        totalReceived: 327250,
        currency: 'INR',
        settlementDate: daysAgo(25),
        dueDate: daysAgo(20),
        status: 'reconciled',
      },
      {
        id: uuid('chsettle-2'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-2'),
        channelCode: 'airbnb',
        settlementRef: 'AB-SETTLE-2024-001',
        periodFrom: daysAgo(45),
        periodTo: daysAgo(15),
        totalBookings: 15,
        totalGross: 195000,
        totalCommission: 29250,
        totalNet: 165750,
        totalReceived: 165750,
        currency: 'INR',
        settlementDate: daysAgo(10),
        dueDate: daysAgo(5),
        status: 'received',
      },
    ],
  });

  await prisma.channelSettlementItem.createMany({
    data: [
      { id: uuid('chsetitem-1'), tenantId, settlementId: uuid('chsettle-1'), bookingId: uuid('booking-3'), channelBookingRef: 'BC-255847891', guestName: 'Sneha Gupta', checkIn: daysAgo(2), checkOut: daysFromNow(4), roomType: 'Deluxe Room', grossAmount: 23490, commissionAmount: 3524, netAmount: 19966, receivedAmount: 19966, status: 'matched' },
      { id: uuid('chsetitem-2'), tenantId, settlementId: uuid('chsettle-1'), channelBookingRef: 'BC-255912345', guestName: 'Anonymous Guest', checkIn: daysAgo(40), checkOut: daysAgo(38), roomType: 'Standard Room', grossAmount: 11430, commissionAmount: 1715, netAmount: 9715, receivedAmount: 9715, status: 'matched' },
      { id: uuid('chsetitem-3'), tenantId, settlementId: uuid('chsettle-1'), channelBookingRef: 'BC-256001234', guestName: 'Ravi Kumar', checkIn: daysAgo(50), checkOut: daysAgo(48), roomType: 'Executive Suite', grossAmount: 38400, commissionAmount: 5760, netAmount: 32640, receivedAmount: 32640, status: 'matched' },
      { id: uuid('chsetitem-4'), tenantId, settlementId: uuid('chsettle-2'), channelBookingRef: 'AB-RSK-98765', guestName: 'Pooja Saha', checkIn: daysFromNow(7), checkOut: daysFromNow(10), roomType: 'Standard Room', grossAmount: 11430, commissionAmount: 1715, netAmount: 9715, receivedAmount: 9715, status: 'matched' },
      { id: uuid('chsetitem-5'), tenantId, settlementId: uuid('chsettle-2'), channelBookingRef: 'AB-RSK-87654', guestName: 'Dev Patel', checkIn: daysAgo(35), checkOut: daysAgo(33), roomType: 'Deluxe Room', grossAmount: 16500, commissionAmount: 2475, netAmount: 14025, receivedAmount: 14025, status: 'matched' },
      { id: uuid('chsetitem-6'), tenantId, settlementId: uuid('chsettle-2'), channelBookingRef: 'AB-RSK-76543', guestName: 'Meera Joshi', checkIn: daysAgo(30), checkOut: daysAgo(27), roomType: 'Executive Suite', grossAmount: 48000, commissionAmount: 7200, netAmount: 40800, receivedAmount: 40800, discrepancy: 0, status: 'matched' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 32. CHANNEL COMMISSION CONFIGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📊 Channel commission configs…');
  await prisma.channelCommissionConfig.deleteMany({});

  await prisma.channelCommissionConfig.createMany({
    data: [
      {
        id: uuid('chcomm-1'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-1'),
        channelCode: 'booking_com',
        commissionType: 'percentage',
        baseCommission: 15,
        currency: 'INR',
        commissionModel: 'gross',
        billingCycle: 'monthly',
        paymentTerms: 30,
        vatApplicable: true,
        vatRate: 18,
        includedInRate: true,
        minCommission: 500,
        isActive: true,
        effectiveFrom: daysAgo(365),
      },
      {
        id: uuid('chcomm-2'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-2'),
        channelCode: 'airbnb',
        commissionType: 'percentage',
        baseCommission: 15,
        currency: 'INR',
        commissionModel: 'gross',
        billingCycle: 'per_booking',
        paymentTerms: 0,
        vatApplicable: false,
        includedInRate: true,
        minCommission: 200,
        isActive: true,
        effectiveFrom: daysAgo(180),
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 33-34. ALLOTMENT RELEASE RULES & LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📅 Allotment release rules & logs…');
  await prisma.allotmentReleaseLog.deleteMany({});
  await prisma.allotmentReleaseRule.deleteMany({});

  await prisma.allotmentReleaseRule.createMany({
    data: [
      {
        id: uuid('allrelrule-1'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-1'),
        channelCode: 'booking_com',
        roomTypeId: uuid('roomtype-1'),
        releaseType: 'graduated',
        releaseSchedule: '[{"daysBefore": 30, "releasePercent": 20}, {"daysBefore": 14, "releasePercent": 50}, {"daysBefore": 7, "releasePercent": 100}]',
        startReleaseFrom: daysAgo(60),
        endReleaseAt: daysFromNow(60),
        minAllotment: 5,
        autoRelease: true,
        isActive: true,
      },
      {
        id: uuid('allrelrule-2'),
        tenantId,
        propertyId,
        connectionId: uuid('channel-2'),
        channelCode: 'airbnb',
        roomTypeId: uuid('roomtype-2'),
        releaseType: 'fixed',
        releaseSchedule: '[{"daysBefore": 14, "releasePercent": 100}]',
        releaseAllDays: 14,
        startReleaseFrom: daysAgo(30),
        endReleaseAt: daysFromNow(30),
        minAllotment: 3,
        autoRelease: true,
        isActive: true,
      },
    ],
  });

  await prisma.allotmentReleaseLog.createMany({
    data: [
      { id: uuid('allrellog-1'), tenantId, ruleId: uuid('allrelrule-1'), connectionId: uuid('channel-1'), channelCode: 'booking_com', roomTypeId: uuid('roomtype-1'), date: daysAgo(14), roomsReleased: 8, roomsBefore: 12, roomsAfter: 20, releaseType: 'graduated', daysBeforeArrival: 14, triggeredBy: 'auto' },
      { id: uuid('allrellog-2'), tenantId, ruleId: uuid('allrelrule-1'), connectionId: uuid('channel-1'), channelCode: 'booking_com', roomTypeId: uuid('roomtype-1'), date: daysAgo(7), roomsReleased: 12, roomsBefore: 20, roomsAfter: 32, releaseType: 'graduated', daysBeforeArrival: 7, triggeredBy: 'auto' },
      { id: uuid('allrellog-3'), tenantId, ruleId: uuid('allrelrule-2'), connectionId: uuid('channel-2'), channelCode: 'airbnb', roomTypeId: uuid('roomtype-2'), date: daysAgo(14), roomsReleased: 5, roomsBefore: 3, roomsAfter: 8, releaseType: 'fixed', daysBeforeArrival: 14, triggeredBy: 'auto' },
      { id: uuid('allrellog-4'), tenantId, ruleId: uuid('allrelrule-2'), connectionId: uuid('channel-2'), channelCode: 'airbnb', roomTypeId: uuid('roomtype-2'), date: daysAgo(7), roomsReleased: 4, roomsBefore: 8, roomsAfter: 12, releaseType: 'fixed', daysBeforeArrival: 7, triggeredBy: 'manual' },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 35. BOOKING MODIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  console.log('  ✏️ Booking modifications…');
  await prisma.bookingModification.deleteMany({});

  await prisma.bookingModification.createMany({
    data: [
      { id: uuid('bkmod-1'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', bookingId: uuid('booking-3'), channelBookingRef: 'BC-255847891', modificationType: 'date_change', previousValue: 'Original dates', newValue: 'Extended by 1 night', previousCheckIn: daysAgo(3), newCheckIn: daysAgo(2), previousCheckOut: daysFromNow(3), newCheckOut: daysFromNow(4), priceDifference: 5500, status: 'applied', autoApply: false, requiresApproval: true, requestedAt: daysAgo(3), processedAt: daysAgo(3) },
      { id: uuid('bkmod-2'), tenantId, propertyId, connectionId: uuid('channel-2'), channelCode: 'airbnb', bookingId: uuid('booking-5'), channelBookingRef: 'AB-RSK-98765', modificationType: 'guest_change', previousValue: 'Pooja Saha', newValue: 'Pooja Saha + 1 child', previousAdults: 1, newAdults: 1, previousChildren: 0, newChildren: 1, status: 'applied', autoApply: true, requiresApproval: false, requestedAt: daysAgo(5), processedAt: daysAgo(5) },
      { id: uuid('bkmod-3'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', channelBookingRef: 'BC-256001234', modificationType: 'room_change', previousRoomType: 'Standard Room', newRoomType: 'Deluxe Room', previousRate: 3500, newRate: 5500, priceDifference: 4000, status: 'applied', autoApply: false, requiresApproval: true, requestedAt: daysAgo(10), processedAt: daysAgo(10) },
      { id: uuid('bkmod-4'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', bookingId: uuid('booking-4'), channelBookingRef: 'BC-256100001', modificationType: 'special_request', previousValue: '', newValue: 'Extra pillows and early check-in requested', status: 'applied', autoApply: true, requiresApproval: false, requestedAt: daysAgo(1), processedAt: daysAgo(1) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 36. CHANNEL PRIORITIES
  // ═══════════════════════════════════════════════════════════════
  console.log('  📊 Channel priorities…');
  await prisma.channelPriority.deleteMany({});

  await prisma.channelPriority.createMany({
    data: [
      { id: uuid('chpri-1'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', priority: 1, syncOrder: 1, preferredChannel: true, inventoryWeight: 0.4, rateWeight: 0.35, bookingWeight: 0.45, maxInventoryPercent: 80, notes: 'Primary channel — highest allocation', isActive: true },
      { id: uuid('chpri-2'), tenantId, propertyId, connectionId: uuid('channel-2'), channelCode: 'airbnb', priority: 2, syncOrder: 2, preferredChannel: false, inventoryWeight: 0.3, rateWeight: 0.25, bookingWeight: 0.2, maxInventoryPercent: 60, notes: 'Secondary channel — moderate allocation', isActive: true },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 37. CHANNEL RATE OVERRIDES
  // ═══════════════════════════════════════════════════════════════
  console.log('  💲 Channel rate overrides…');
  await prisma.channelRateOverride.deleteMany({});

  await prisma.channelRateOverride.createMany({
    data: [
      { id: uuid('chrateovr-1'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', name: 'Durga Puja Premium', description: '15% markup for Durga Puja week', roomTypeId: uuid('roomtype-2'), ratePlanId: uuid('rateplan-4'), overrideType: 'percentage', overrideValue: 15, currency: 'INR', appliesTo: 'specific_dates', specificDates: '[{"from":"2025-10-01","to":"2025-10-10"}]', priority: 10, isActive: true, effectiveFrom: daysFromNow(30), effectiveTo: daysFromNow(50) },
      { id: uuid('chrateovr-2'), tenantId, propertyId, connectionId: uuid('channel-2'), channelCode: 'airbnb', name: 'Weekend Surcharge', description: '10% surcharge for Friday and Saturday nights', roomTypeId: uuid('roomtype-1'), overrideType: 'percentage', overrideValue: 10, currency: 'INR', appliesTo: 'weekends', priority: 5, isActive: true },
      { id: uuid('chrateovr-3'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', name: 'Long Stay Discount', description: '10% discount for stays of 5+ nights', roomTypeId: uuid('roomtype-3'), overrideType: 'percentage', overrideValue: -10, currency: 'INR', minRate: 10000, appliesTo: 'all', priority: 3, isActive: true },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 38. CHANNEL BOOKING LIMITS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🚫 Channel booking limits…');
  await prisma.channelBookingLimit.deleteMany({});

  await prisma.channelBookingLimit.createMany({
    data: [
      { id: uuid('chbklimit-1'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', roomTypeId: uuid('roomtype-1'), startDate: daysFromNow(30), endDate: daysFromNow(50), maxBookings: 25, usedBookings: 8, appliesTo: 'specific_room_type', priority: 10, isActive: true },
      { id: uuid('chbklimit-2'), tenantId, propertyId, connectionId: uuid('channel-2'), channelCode: 'airbnb', roomTypeId: uuid('roomtype-2'), startDate: daysFromNow(0), endDate: daysFromNow(30), maxBookings: 15, usedBookings: 4, appliesTo: 'specific_room_type', priority: 5, isActive: true },
      { id: uuid('chbklimit-3'), tenantId, propertyId, connectionId: uuid('channel-1'), channelCode: 'booking_com', startDate: daysFromNow(0), endDate: daysFromNow(30), maxBookings: 50, usedBookings: 18, appliesTo: 'all_room_types', priority: 1, isActive: true },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 39. CHANNEL SYNC LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('  🔄 Channel sync logs…');
  await prisma.channelSyncLog.deleteMany({});

  await prisma.channelSyncLog.createMany({
    data: [
      { id: uuid('chsynclog-1'), connectionId: uuid('channel-1'), syncType: 'inventory', direction: 'outbound', requestPayload: '{"roomType": "Standard Room", "date": "2025-01-15", "available": 30}', responsePayload: '{"success": true}', statusCode: 200, status: 'success', attemptCount: 1, createdAt: daysAgo(1) },
      { id: uuid('chsynclog-2'), connectionId: uuid('channel-1'), syncType: 'rates', direction: 'outbound', requestPayload: '{"roomType": "Deluxe Room", "dates": ["2025-01-15","2025-01-16"], "rate": 5500}', responsePayload: '{"success": true}', statusCode: 200, status: 'success', attemptCount: 1, createdAt: daysAgo(1) },
      { id: uuid('chsynclog-3'), connectionId: uuid('channel-2'), syncType: 'inventory', direction: 'outbound', requestPayload: '{"listingId": "AB-STD-001", "dates": ["2025-01-15"], "available": 25}', responsePayload: '{"success": true}', statusCode: 200, status: 'success', attemptCount: 1, createdAt: daysAgo(2) },
      { id: uuid('chsynclog-4'), connectionId: uuid('channel-1'), syncType: 'booking', direction: 'inbound', requestPayload: '{"bookingRef": "BC-255847891"}', responsePayload: '{"action": "created"}', statusCode: 200, status: 'success', attemptCount: 1, createdAt: daysAgo(3) },
      { id: uuid('chsynclog-5'), connectionId: uuid('channel-1'), syncType: 'rates', direction: 'outbound', requestPayload: '{"roomType": "Executive Suite", "rate": 12000}', responsePayload: '{"error": "rate_limit_exceeded"}', statusCode: 429, status: 'failed', errorMessage: 'Rate limit exceeded — retry in 60s', attemptCount: 2, createdAt: daysAgo(0) },
      { id: uuid('chsynclog-6'), connectionId: uuid('channel-2'), syncType: 'booking', direction: 'inbound', requestPayload: '{"bookingRef": "AB-RSK-98765"}', responsePayload: '{"action": "modified"}', statusCode: 200, status: 'success', attemptCount: 1, createdAt: daysAgo(5) },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 40. BOOKING PACE CONFIG
  // ═══════════════════════════════════════════════════════════════
  console.log('  📈 Booking pace config…');
  await prisma.bookingPaceSnapshot.deleteMany({});
  await prisma.bookingPaceConfig.deleteMany({});

  await prisma.bookingPaceConfig.createMany({
    data: [
      {
        id: uuid('bkpacecfg-1'),
        tenantId,
        propertyId,
        comparisonPeriod: 'same_period_last_year',
        lookbackDays: 90,
        paceIntervalDays: 1,
        isActive: true,
      },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 41. BOOKING PACE SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════
  console.log('  📊 Booking pace snapshots…');
  await prisma.bookingPaceSnapshot.deleteMany({});

  await prisma.bookingPaceSnapshot.createMany({
    data: [
      { id: uuid('bkpace-1'), tenantId, propertyId, arrivalDate: daysFromNow(14), snapshotDate: daysAgo(30), daysBeforeArrival: 30, totalBookings: 15, totalRooms: 15, totalRevenue: 66000, adr: 4400, cancellations: 2, netBookings: 13 },
      { id: uuid('bkpace-2'), tenantId, propertyId, arrivalDate: daysFromNow(14), snapshotDate: daysAgo(21), daysBeforeArrival: 21, totalBookings: 22, totalRooms: 22, totalRevenue: 99000, adr: 4500, cancellations: 3, netBookings: 19 },
      { id: uuid('bkpace-3'), tenantId, propertyId, arrivalDate: daysFromNow(14), snapshotDate: daysAgo(14), daysBeforeArrival: 14, totalBookings: 35, totalRooms: 35, totalRevenue: 168000, adr: 4800, cancellations: 4, netBookings: 31 },
      { id: uuid('bkpace-4'), tenantId, propertyId, arrivalDate: daysFromNow(14), snapshotDate: daysAgo(7), daysBeforeArrival: 7, totalBookings: 52, totalRooms: 52, totalRevenue: 260000, adr: 5000, cancellations: 5, netBookings: 47 },
      { id: uuid('bkpace-5'), tenantId, propertyId, arrivalDate: daysFromNow(14), snapshotDate: daysAgo(0), daysBeforeArrival: 0, totalBookings: 68, totalRooms: 68, totalRevenue: 374000, adr: 5500, cancellations: 6, netBookings: 62, channelCode: null, roomTypeId: null },
    ],
  });

  console.log('✅ Extras seed data complete!\n');
}
