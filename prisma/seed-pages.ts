import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Generate deterministic UUIDs from seed strings for PostgreSQL @db.Uuid compatibility.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31)
  ].join('-');
};

const TENANT_ID = uuid('tenant-1');
const PROPERTY_ID = uuid('property-1');
const PROPERTY_2_ID = uuid('property-2');
const USER_ADMIN = uuid('user-1');
const USER_FRONTDESK = uuid('user-2');
const USER_HK = uuid('user-3');
const GUEST_1 = uuid('guest-1');
const GUEST_2 = uuid('guest-2');
const GUEST_3 = uuid('guest-3');
const GUEST_5 = uuid('guest-5');
const GUEST_6 = uuid('guest-6');

// Existing seed IDs from seed.ts
const BOOKING_1 = uuid('booking-1');  // checked_in, guest-1, room-501
const BOOKING_2 = uuid('booking-2');  // checked_in, guest-3, room-801
const BOOKING_3 = uuid('booking-3');  // confirmed, guest-2, room-510
const BOOKING_4 = uuid('booking-4');  // confirmed, guest-5, room-1002
const BOOKING_5 = uuid('booking-5');  // confirmed, guest-4, room-101
const BOOKING_6 = uuid('booking-6');  // checked_in, guest-6, room-305

// Rooms
const ROOM_101 = uuid('room-101');
const ROOM_102 = uuid('room-102');
const ROOM_103 = uuid('room-103');
const ROOM_110 = uuid('room-110');
const ROOM_130 = uuid('room-130');
const ROOM_305 = uuid('room-305');
const ROOM_140 = uuid('room-140');
const ROOM_501 = uuid('room-501');
const ROOM_502 = uuid('room-502');
const ROOM_510 = uuid('room-510');
const ROOM_601 = uuid('room-601');
const ROOM_701 = uuid('room-701');
const ROOM_801 = uuid('room-801');
const ROOM_802 = uuid('room-802');
const ROOM_1002 = uuid('room-1002');

// Floor plans
const FP_1 = uuid('fp-1');  // Ground Floor
const FP_2 = uuid('fp-2');  // Fifth Floor - Deluxe Wing
const FP_3 = uuid('fp-3');  // Eighth Floor - Executive Wing

// Staff channels
const SCH_1 = uuid('sch-1');  // Front Desk
const SCH_2 = uuid('sch-2');  // Maintenance Updates
const SCH_3 = uuid('sch-3');  // General Announcements

// Chat conversations (only 1 exists: conv-1)
const CONV_1 = uuid('conv-1');

// Campaigns & segments
const CAMPAIGN_1 = uuid('campaign-1');  // Summer Special
const CAMPAIGN_2 = uuid('campaign-2');  // Loyalty Bonus
const SEGMENT_1 = uuid('segment-1');    // Business Travelers
const SEGMENT_2 = uuid('segment-2');    // Leisure Guests
const SEGMENT_3 = uuid('segment-3');    // VIP Guests

// Ad campaigns
const ADCAMPAIGN_1 = uuid('adcampaign-1');  // Durga Puja Special Offer
const ADCAMPAIGN_2 = uuid('adcampaign-2');  // Corporate Retreats Kolkata
const ADCAMPAIGN_3 = uuid('adcampaign-3');  // Weekend Getaway - Social

// Vendors
const VENDOR_1 = uuid('vendor-1');
const VENDOR_2 = uuid('vendor-2');
const VENDOR_3 = uuid('vendor-3');

// Channel connections
const CH_CONN_1 = uuid('channel-conn-1');  // Booking.com
const CH_CONN_2 = uuid('channel-conn-2');  // Expedia

// Rate plans
const RP_1 = uuid('rateplan-1');
const RP_3 = uuid('rateplan-3');
const RP_4 = uuid('rateplan-4');
const RP_6 = uuid('rateplan-6');
const RP_7 = uuid('rateplan-7');

// Bandwidth policy IDs from wifi-seed.ts
const BW_POLICY_FREE = uuid('bwpolicy-free');
const BW_POLICY_STD = uuid('bwpolicy-standard');
const BW_POLICY_PREM = uuid('bwpolicy-premium');

// Stock items
const STOCK_1 = uuid('stock-1');
const STOCK_2 = uuid('stock-2');
const STOCK_3 = uuid('stock-3');
const STOCK_4 = uuid('stock-4');
const STOCK_5 = uuid('stock-5');
const STOCK_6 = uuid('stock-6');

export async function seedPageData(prisma: PrismaClient) {
  const now = new Date();
  const day = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  const hour = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const min = (m: number) => new Date(now.getTime() + m * 60 * 1000);

  console.log('\n📄 Seeding page data supplement...');

  // ═══════════════════════════════════════════════════════════════
  // 1. CHAT MESSAGES — Additional conversations for Guest ↔ Staff chat
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding additional chat conversations and messages...');
  try {
    // Create 3 more conversations with messages
    const conv2Id = uuid('conv-2');
    const conv3Id = uuid('conv-3');
    const conv4Id = uuid('conv-4');

    await prisma.chatConversation.createMany({
      data: [
        { id: conv2Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_3, bookingId: BOOKING_2, channel: 'in_app', status: 'open', priority: 'high', lastMessageAt: hour(-1), lastMessage: 'Please arrange the airport pickup for tomorrow.', unreadCount: 1 },
        { id: conv3Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_6, bookingId: BOOKING_6, channel: 'whatsapp', status: 'open', priority: 'normal', lastMessageAt: hour(-3), lastMessage: 'Thank you for the wonderful stay!', unreadCount: 0 },
        { id: conv4Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_2, bookingId: BOOKING_3, channel: 'in_app', status: 'open', priority: 'normal', lastMessageAt: min(-20), lastMessage: 'Looking forward to my visit!', unreadCount: 0 },
      ],
    });

    await prisma.chatMessage.createMany({
      data: [
        // Conv 2 — Rahul Banerjee (guest-3, VIP platinum) in room-801
        { id: uuid('chat-7'), conversationId: conv2Id, senderId: null, content: 'Hello, this is Rahul Banerjee in room 801. I need to schedule a meeting in your conference room tomorrow from 10 AM to 1 PM.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'read', sentAt: hour(-4), readAt: hour(-3.5) },
        { id: uuid('chat-8'), conversationId: conv2Id, senderId: USER_FRONTDESK, content: 'Good afternoon, Mr. Banerjee! We have the Park View Conference Room available tomorrow. It accommodates up to 20 guests with full AV setup. Shall I book it for you?', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'read', sentAt: hour(-3.5), readAt: hour(-3) },
        { id: uuid('chat-9'), conversationId: conv2Id, senderId: null, content: 'Yes, please. Also, could you arrange a buffet lunch for 12 people? Preferrably vegetarian options alongside non-veg.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'read', sentAt: hour(-2) },
        { id: uuid('chat-10'), conversationId: conv2Id, senderId: USER_FRONTDESK, content: 'Absolutely! I\'ll coordinate with our F&B team. May I suggest our Executive Thali with both veg and non-veg platters at ₹1,200 per person? We can also set up a live chaat counter.', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'delivered', sentAt: hour(-1.5) },
        { id: uuid('chat-11'), conversationId: conv2Id, senderId: null, content: 'That sounds perfect. Please arrange the airport pickup for tomorrow — flight is at 5 PM from CCU.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'delivered', sentAt: hour(-1) },

        // Conv 3 — Rina Chatterjee (guest-6, silver) in room-305, checked in
        { id: uuid('chat-12'), conversationId: conv3Id, senderId: null, content: 'Hi! I checked in yesterday. The room is lovely but the hot water takes a very long time to come.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'read', sentAt: hour(-8), readAt: hour(-7) },
        { id: uuid('chat-13'), conversationId: conv3Id, senderId: USER_FRONTDESK, content: 'Thank you for letting us know, Ms. Chatterjee. I\'ll send our maintenance team to check the geyser in room 305 right away. Apologies for the inconvenience.', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'read', sentAt: hour(-7), readAt: hour(-6.5) },
        { id: uuid('chat-14'), conversationId: conv3Id, senderId: USER_FRONTDESK, content: 'Update: Our maintenance team has checked the geyser. It needed a thermostat replacement which is now done. Hot water should work perfectly. We\'ve also added a complimentary dessert to your room as an apology.', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'read', sentAt: hour(-5), readAt: hour(-4) },
        { id: uuid('chat-15'), conversationId: conv3Id, senderId: null, content: 'Thank you so much! That\'s very kind. Also, what time is checkout tomorrow?', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'read', sentAt: hour(-3) },
        { id: uuid('chat-16'), conversationId: conv3Id, senderId: USER_FRONTDESK, content: 'Checkout is at 11:00 AM. Would you like a late checkout extension? As a silver member, you\'re eligible for a complimentary 1-hour extension until noon.', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'read', sentAt: hour(-3), readAt: hour(-2) },
        { id: uuid('chat-17'), conversationId: conv3Id, senderId: null, content: 'Thank you for the wonderful stay! I\'ll check out at noon.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'delivered', sentAt: hour(-3) },

        // Conv 4 — Sneha Gupta (guest-2) pre-arrival for booking-3
        { id: uuid('chat-18'), conversationId: conv4Id, senderId: null, content: 'Hello, I have a booking confirmation RS-2024-003 for today. My ETA is around 3 PM.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'read', sentAt: min(-120), readAt: min(-100) },
        { id: uuid('chat-19'), conversationId: conv4Id, senderId: USER_FRONTDESK, content: 'Welcome, Ms. Gupta! Your booking is confirmed for Deluxe Room 510. We\'ll have everything ready for your 3 PM arrival. Is there anything specific you\'d like us to prepare?', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'read', sentAt: min(-90), readAt: min(-70) },
        { id: uuid('chat-20'), conversationId: conv4Id, senderId: null, content: 'Could I get a room on a higher floor if possible? And extra hangers would be great.', messageType: 'text', attachments: '[]', senderType: 'guest', status: 'delivered', sentAt: min(-30) },
        { id: uuid('chat-21'), conversationId: conv4Id, senderId: USER_FRONTDESK, content: 'We\'ll do our best to accommodate your floor preference. I\'ve noted the extra hangers — they\'ll be in your room before you arrive. Looking forward to welcoming you!', messageType: 'text', attachments: '[]', senderType: 'staff', status: 'delivered', sentAt: min(-20) },
      ],
    });
    console.log('✓ 3 additional chat conversations + 21 messages seeded');
  } catch (e: any) {
    console.log('Chat messages seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. STAFF CHAT MESSAGES — Messages in staff channels
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding staff chat messages...');
  try {
    await prisma.staffChatMessage.createMany({
      data: [
        // Channel 1 — Front Desk
        { id: uuid('smsg-1'), channelId: SCH_1, senderId: USER_FRONTDESK, content: 'Good morning team! We have 4 arrivals and 2 departures today. Arrival list is updated in the system.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-8), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
        { id: uuid('smsg-2'), channelId: SCH_1, senderId: USER_ADMIN, content: 'Thanks Priya. Please ensure the VIP amenity basket is ready for Mr. Rahul Banerjee in room 801. He\'s a platinum member.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-7.5), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
        { id: uuid('smsg-3'), channelId: SCH_1, senderId: USER_FRONTDESK, content: 'VIP basket arranged — includes Darjeeling tea, Assorted mithai box, and a handwritten note from the GM.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-7), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
        { id: uuid('smsg-4'), channelId: SCH_1, senderId: USER_FRONTDESK, content: 'Mr. Vikram Singh just arrived for room 1002 (Presidential Suite). He\'s being escorted by the butler now.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-2), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
        { id: uuid('smsg-5'), channelId: SCH_1, senderId: USER_ADMIN, content: 'Confirmed. Please activate all premium services for the Presidential Suite — welcome drinks, fruit basket, and daily newspaper.', messageType: 'text', attachments: '[]', replyToId: uuid('smsg-4'), isEdited: false, sentAt: hour(-1.5), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
        { id: uuid('smsg-6'), channelId: SCH_1, senderId: USER_FRONTDESK, content: 'All done. Mr. Singh is very happy with the suite. He requested a dinner reservation at Aahar for 8 PM — 2 guests.', messageType: 'text', attachments: '[]', replyToId: uuid('smsg-5'), isEdited: false, sentAt: hour(-1), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },

        // Channel 2 — Maintenance Updates
        { id: uuid('smsg-7'), channelId: SCH_2, senderId: USER_ADMIN, content: 'Anita, the AC in room 801 is still not cooling properly. Guest is a VIP platinum member — this needs urgent attention.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-6), readBy: JSON.stringify([USER_ADMIN, USER_HK]) },
        { id: uuid('smsg-8'), channelId: SCH_2, senderId: USER_HK, content: 'On it! I\'ve dispatched the HVAC technician. The compressor seems to be the issue. Temp fix applied — should hold for 2-3 hours while we arrange a replacement part.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-5.5), readBy: JSON.stringify([USER_ADMIN, USER_HK]) },
        { id: uuid('smsg-9'), channelId: SCH_2, senderId: USER_HK, content: 'Replacement compressor for room 801 AC has been ordered from CleanPro. Expected delivery tomorrow morning. Vendor ID: vendor-2.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-4), readBy: JSON.stringify([USER_ADMIN, USER_HK]) },
        { id: uuid('smsg-10'), channelId: SCH_2, senderId: USER_ADMIN, content: 'Good work Anita. Please follow up tomorrow and ensure the replacement is done before noon. The guest extends his stay until day after.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-3), readBy: JSON.stringify([USER_ADMIN, USER_HK]) },

        // Channel 3 — General Announcements
        { id: uuid('smsg-11'), channelId: SCH_3, senderId: USER_ADMIN, content: '📢 Team, please note: Staff meeting tomorrow at 9 AM in the conference room. Agenda: Durga Puja special arrangements and upcoming festival season planning.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-24), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK, USER_HK]) },
        { id: uuid('smsg-12'), channelId: SCH_3, senderId: USER_FRONTDESK, content: 'Acknowledged. I\'ll prepare the occupancy forecast report for the Puja week. Last year we were at 98% — expecting similar this year.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-23), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK, USER_HK]) },
        { id: uuid('smsg-13'), channelId: SCH_3, senderId: USER_HK, content: 'Noted. I\'ll ensure all rooms are inspected and any pending maintenance is completed before the festive rush. We have 3 rooms currently under maintenance.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-22), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK, USER_HK]) },
        { id: uuid('smsg-14'), channelId: SCH_3, senderId: USER_ADMIN, content: 'Also, welcome our new front desk trainee, Arjun Mehta, who joins us next Monday. Priya, please buddy him during onboarding.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-20), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK, USER_HK]) },
        { id: uuid('smsg-15'), channelId: SCH_3, senderId: USER_FRONTDESK, content: 'Of course! I\'ll prepare the onboarding checklist and shadow schedule for Arjun.', messageType: 'text', attachments: '[]', isEdited: false, sentAt: hour(-19), readBy: JSON.stringify([USER_ADMIN, USER_FRONTDESK]) },
      ],
    });
    console.log('✓ 15 staff chat messages seeded across 3 channels');
  } catch (e: any) {
    console.log('Staff chat messages seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. LEAD ACTIVITIES — Activities for existing leads
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding lead activities...');
  try {
    // We need to find the first lead's ID since leads are auto-generated
    // We'll use prisma to find leads
    const leads = await prisma.lead.findMany({
      where: { tenantId: TENANT_ID, propertyId: PROPERTY_ID },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });

    if (leads.length >= 1) {
      await prisma.leadActivity.createMany({
        data: [
          // Activities for Lead 1 (Sarah Mitchell, TechCorp)
          { id: uuid('la-1'), leadId: leads[0].id, type: 'call', content: 'Initial discovery call with Sarah Mitchell. Discussed corporate retreat requirements — 10 rooms for 3 days. Interested in team-building activities and conference facilities.', createdBy: USER_ADMIN, createdAt: day(-12) },
          { id: uuid('la-2'), leadId: leads[0].id, type: 'email', content: 'Sent corporate retreat proposal deck covering room blocks, meeting rooms, F&B packages, and team activities. Total estimate: ₹4,50,000.', createdBy: USER_ADMIN, createdAt: day(-10) },
          { id: uuid('la-3'), leadId: leads[0].id, type: 'meeting', content: 'Site visit arranged for Sarah and her colleague David. Showed conference rooms, executive suites, and outdoor event space. Very positive response.', createdBy: USER_FRONTDESK, createdAt: day(-5) },
          { id: uuid('la-4'), leadId: leads[0].id, type: 'proposal', content: 'Final proposal sent: ₹4,25,000 for 10 rooms × 3 nights + conference room + 2 meals/day + airport transfers. Valid for 7 days.', createdBy: USER_ADMIN, createdAt: day(-3) },
          { id: uuid('la-5'), leadId: leads[0].id, type: 'follow_up', content: 'Follow-up call. Sarah confirmed they are reviewing the proposal with their finance team. Expects decision by next Wednesday.', createdBy: USER_ADMIN, createdAt: day(-1) },
          { id: uuid('la-6'), leadId: leads[0].id, type: 'status_change', content: 'Lead moved to "Proposal Sent" stage. Score updated to 88. Priority: Hot.', createdBy: USER_ADMIN, createdAt: day(-3) },
        ],
      });
    }

    if (leads.length >= 2) {
      await prisma.leadActivity.createMany({
        data: [
          // Activities for Lead 2 (James Rodriguez, Global Events)
          { id: uuid('la-7'), leadId: leads[1].id, type: 'call', content: 'Referral from Priya Nair at MMT Business. James is planning a 200-pax corporate conference. Needs 30 rooms + banquet hall for 2 days.', createdBy: USER_ADMIN, createdAt: day(-15) },
          { id: uuid('la-8'), leadId: leads[1].id, type: 'meeting', content: 'In-person meeting at their office in Salt Lake. Presented our MICE capabilities — pillarless banquet hall (500 pax), breakout rooms, and AV setup.', createdBy: USER_ADMIN, createdAt: day(-8) },
          { id: uuid('la-9'), leadId: leads[1].id, type: 'email', content: 'Custom event proposal sent: ₹7,80,000 covering 30 premium rooms, Grand Ballroom, stage setup, LED walls, catering for 200 pax (3 meals × 2 days).', createdBy: USER_ADMIN, createdAt: day(-5) },
          { id: uuid('la-10'), leadId: leads[1].id, type: 'note', content: 'James requested a site walkthrough for their event committee. Scheduled for next Monday at 11 AM.', createdBy: USER_FRONTDESK, createdAt: day(-2) },
          { id: uuid('la-11'), leadId: leads[1].id, type: 'follow_up', content: 'Negotiation call. They want a 10% discount on the total. Proposed: waive service charge (8%) instead of flat discount — effective value better for us.', createdBy: USER_ADMIN, createdAt: day(-1) },
        ],
      });
    }

    if (leads.length >= 3) {
      await prisma.leadActivity.createMany({
        data: [
          // Activities for Lead 3 (Emily Chen, Wedding Bliss)
          { id: uuid('la-12'), leadId: leads[2].id, type: 'email', content: 'Emily inquired via website about wedding reception + room block. Responded with initial availability for December-February dates.', createdBy: USER_FRONTDESK, createdAt: day(-7) },
          { id: uuid('la-13'), leadId: leads[2].id, type: 'call', content: 'Discovery call with Emily. Planning a December wedding reception for 50 guests + 15 room nights. Interested in poolside ceremony option.', createdBy: USER_ADMIN, createdAt: day(-4) },
          { id: uuid('la-14'), leadId: leads[2].id, type: 'assignment', content: 'Assigned to Priya Das for follow-up and site visit coordination. Emily will visit with her fiancé next weekend.', createdBy: USER_ADMIN, createdAt: day(-2) },
        ],
      });
    }

    console.log('✓ Lead activities seeded');
  } catch (e: any) {
    console.log('Lead activities seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CAMPAIGN SEGMENTS — Link campaigns to segments
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding campaign segments...');
  try {
    await prisma.campaignSegment.createMany({
      data: [
        { id: uuid('campseg-1'), campaignId: CAMPAIGN_1, segmentId: SEGMENT_2 },
        { id: uuid('campseg-2'), campaignId: CAMPAIGN_1, segmentId: SEGMENT_3 },
        { id: uuid('campseg-3'), campaignId: CAMPAIGN_2, segmentId: SEGMENT_1 },
        { id: uuid('campseg-4'), campaignId: CAMPAIGN_2, segmentId: SEGMENT_3 },
      ],
    });
    console.log('✓ 4 campaign-segment links seeded');
  } catch (e: any) {
    console.log('Campaign segments seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. FLOOR PLAN ROOMS — Link rooms to floor plans
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding floor plan rooms...');
  try {
    await prisma.floorPlanRoom.createMany({
      data: [
        // Ground Floor (fp-1) — Standard rooms 101-110
        { id: uuid('fpr-1'), floorPlanId: FP_1, roomId: ROOM_101, x: 80, y: 60, width: 100, height: 80, rotation: 0 },
        { id: uuid('fpr-2'), floorPlanId: FP_1, roomId: ROOM_102, x: 200, y: 60, width: 100, height: 80, rotation: 0 },
        { id: uuid('fpr-3'), floorPlanId: FP_1, roomId: ROOM_103, x: 320, y: 60, width: 100, height: 80, rotation: 0 },
        { id: uuid('fpr-4'), floorPlanId: FP_1, roomId: uuid('room-104'), x: 440, y: 60, width: 100, height: 80, rotation: 0 },
        { id: uuid('fpr-5'), floorPlanId: FP_1, roomId: uuid('room-105'), x: 80, y: 180, width: 100, height: 80, rotation: 0 },
        { id: uuid('fpr-6'), floorPlanId: FP_1, roomId: uuid('room-106'), x: 200, y: 180, width: 100, height: 80, rotation: 0 },

        // Fifth Floor (fp-2) — Deluxe rooms 501-512
        { id: uuid('fpr-7'), floorPlanId: FP_2, roomId: ROOM_501, x: 60, y: 50, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-8'), floorPlanId: FP_2, roomId: ROOM_502, x: 210, y: 50, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-9'), floorPlanId: FP_2, roomId: uuid('room-503'), x: 360, y: 50, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-10'), floorPlanId: FP_2, roomId: uuid('room-504'), x: 510, y: 50, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-11'), floorPlanId: FP_2, roomId: uuid('room-505'), x: 60, y: 190, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-12'), floorPlanId: FP_2, roomId: uuid('room-506'), x: 210, y: 190, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-13'), floorPlanId: FP_2, roomId: uuid('room-507'), x: 360, y: 190, width: 120, height: 100, rotation: 0 },
        { id: uuid('fpr-14'), floorPlanId: FP_2, roomId: ROOM_510, x: 360, y: 330, width: 120, height: 100, rotation: 0 },

        // Eighth Floor (fp-3) — Executive suites 801-808
        { id: uuid('fpr-15'), floorPlanId: FP_3, roomId: ROOM_801, x: 80, y: 60, width: 160, height: 140, rotation: 0 },
        { id: uuid('fpr-16'), floorPlanId: FP_3, roomId: ROOM_802, x: 280, y: 60, width: 160, height: 140, rotation: 0 },
        { id: uuid('fpr-17'), floorPlanId: FP_3, roomId: uuid('room-803'), x: 480, y: 60, width: 160, height: 140, rotation: 0 },
      ],
    });
    console.log('✓ 17 floor plan rooms seeded across 3 floors');
  } catch (e: any) {
    console.log('Floor plan rooms seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. PROMOTIONS — Marketing promotions
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding promotions...');
  try {
    await prisma.promotion.createMany({
      data: [
        {
          id: uuid('promo-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Durga Puja Special', code: 'PUJA2024',
          description: 'Flat 20% off on all room types during Durga Puja festival week. Valid for bookings made at least 3 days in advance.',
          discountType: 'percentage', discountValue: 20, maxDiscount: 5000, minBookingValue: 5000, minNights: 2,
          applicableRoomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3')]),
          startsAt: day(-5), endsAt: day(15), maxUses: 200, usedCount: 67, maxUsesPerUser: 2,
          status: 'active',
        },
        {
          id: uuid('promo-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Weekend Getaway', code: 'WEEKEND15',
          description: '15% off on weekend stays (Friday-Sunday). Applicable on Deluxe rooms and above.',
          discountType: 'percentage', discountValue: 15, maxDiscount: 3000, minBookingValue: 4000, minNights: 2,
          applicableRoomTypes: JSON.stringify([uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
          startsAt: day(-30), endsAt: day(60), maxUses: 500, usedCount: 234, maxUsesPerUser: 5,
          status: 'active',
        },
        {
          id: uuid('promo-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Extended Stay Discount', code: 'LONGSTAY10',
          description: 'Flat ₹2,000 off per night for stays of 5 nights or more. Perfect for business travelers and families.',
          discountType: 'fixed_amount', discountValue: 2000, minBookingValue: 15000, minNights: 5,
          applicableRoomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
          startsAt: day(-60), endsAt: day(90), maxUses: 100, usedCount: 42, maxUsesPerUser: 3,
          status: 'active',
        },
        {
          id: uuid('promo-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Early Bird Darjeeling', code: 'EARLYDARJ',
          description: 'Book 30 days in advance and get a complimentary room upgrade + free breakfast at Royal Stay Darjeeling.',
          discountType: 'free_night', discountValue: 0, minBookingValue: 10000, minNights: 3,
          applicableRoomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
          startsAt: day(-10), endsAt: day(120), maxUses: 50, usedCount: 12, maxUsesPerUser: 1,
          status: 'active',
        },
        {
          id: uuid('promo-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Diwali Bonanza', code: 'DIWALI24',
          description: 'Celebratory Diwali offer: 25% off + complimentary Diwali gift hamper in room. Valid for stays during Diwali week.',
          discountType: 'percentage', discountValue: 25, maxDiscount: 8000, minBookingValue: 7000, minNights: 2,
          applicableRoomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
          startsAt: day(20), endsAt: day(35), maxUses: 150, usedCount: 0, maxUsesPerUser: 1,
          status: 'scheduled',
        },
      ],
    });
    console.log('✓ 5 promotions seeded');
  } catch (e: any) {
    console.log('Promotions seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. EARLY CHECKIN REQUESTS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding early checkin requests...');
  try {
    await prisma.earlyCheckinRequest.createMany({
      data: [
        {
          id: uuid('eci-1'), bookingId: BOOKING_2, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_3,
          requestedTime: new Date(day(-1).getTime() + 10 * 60 * 60 * 1000),
          feeAmount: 2500, feeStatus: 'waived', reason: 'VIP Platinum member — arriving early on flight from Delhi.',
          status: 'approved', approvedBy: USER_ADMIN, approvedAt: hour(-24),
        },
        {
          id: uuid('eci-2'), bookingId: BOOKING_4, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_5,
          requestedTime: new Date(now.getTime() + 10 * 60 * 60 * 1000),
          feeAmount: 3500, feeStatus: 'paid', reason: 'Gold tier guest. Early arrival from Mumbai.',
          status: 'approved', approvedBy: USER_FRONTDESK, approvedAt: hour(-5),
        },
        {
          id: uuid('eci-3'), bookingId: BOOKING_3, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_2,
          requestedTime: new Date(now.getTime() + 11 * 60 * 60 * 1000),
          feeAmount: 1500, feeStatus: 'pending', reason: 'Requesting early check-in as my train arrives at 10:30 AM.',
          status: 'pending',
        },
      ],
    });
    console.log('✓ 3 early checkin requests seeded');
  } catch (e: any) {
    console.log('Early checkin requests seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. EARLY CHECKOUT REQUESTS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding early checkout requests...');
  try {
    const booking2CheckOut = day(3);
    await prisma.earlyCheckoutRequest.createMany({
      data: [
        {
          id: uuid('eco-1'), bookingId: BOOKING_2, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_3,
          requestedDate: day(1), originalCheckOut: booking2CheckOut,
          reason: 'Business meeting got rescheduled. Need to fly to Bangalore a day early.',
          status: 'approved', reviewedBy: USER_ADMIN, reviewedAt: hour(-6),
        },
        {
          id: uuid('eco-2'), bookingId: BOOKING_1, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_1,
          requestedDate: day(0), originalCheckOut: day(1),
          reason: 'Feeling unwell — would like to head home early to rest.',
          status: 'pending',
        },
      ],
    });
    console.log('✓ 2 early checkout requests seeded');
  } catch (e: any) {
    console.log('Early checkout requests seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. LATE CHECKOUT REQUESTS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding late checkout requests...');
  try {
    await prisma.lateCheckoutRequest.createMany({
      data: [
        {
          id: uuid('lco-1'), bookingId: BOOKING_6, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_6,
          requestedUntil: new Date(day(0).getTime() + 14 * 60 * 60 * 1000),
          feeAmount: 1750, feeStatus: 'waived', loyaltyWaived: true,
          reason: 'Silver member benefit — evening flight at 6 PM.',
          status: 'approved', approvedBy: USER_FRONTDESK, approvedAt: hour(-12),
        },
        {
          id: uuid('lco-2'), bookingId: BOOKING_2, tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: GUEST_3,
          requestedUntil: new Date(day(1).getTime() + 15 * 60 * 60 * 1000),
          feeAmount: 6000, feeStatus: 'waived', loyaltyWaived: true,
          reason: 'VIP Platinum member — late evening flight to London.',
          status: 'approved', approvedBy: USER_ADMIN, approvedAt: hour(-8),
        },
      ],
    });
    console.log('✓ 2 late checkout requests seeded');
  } catch (e: any) {
    console.log('Late checkout requests seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. MAINTENANCE BLOCKS — Room out-of-service blocks
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding maintenance blocks...');
  try {
    await prisma.maintenanceBlock.createMany({
      data: [
        {
          id: uuid('mblock-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          roomId: ROOM_110, roomNumber: '110',
          reason: 'renovation', description: 'Full bathroom renovation — replacing tiles, fixtures, and installing rain shower. Room will be upgraded to match Deluxe standard.',
          startDate: day(-2), endDate: day(5), blockedBy: USER_ADMIN,
          status: 'active', priority: 'normal', vendorId: VENDOR_2,
          estimatedCost: 85000, actualCost: null,
          notes: 'Expected completion by Oct 15. Guest in 203 has been notified of potential noise.',
        },
        {
          id: uuid('mblock-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          roomId: ROOM_140, roomNumber: '140',
          reason: 'maintenance', description: 'AC compressor replacement and full duct cleaning. HVAC vendor scheduled visit.',
          startDate: day(1), endDate: day(2), blockedBy: USER_HK,
          status: 'scheduled', priority: 'high', vendorId: VENDOR_3,
          estimatedCost: 15000, actualCost: null,
          notes: 'Parts ordered. Room 401 should be back online within 2 days.',
        },
        {
          id: uuid('mblock-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          roomId: ROOM_130, roomNumber: '130',
          reason: 'deep_cleaning', description: 'Post-checkout deep cleaning and sanitization. Includes mattress steam cleaning, carpet shampooing, and curtain dry cleaning.',
          startDate: day(-1), endDate: day(0), blockedBy: USER_HK,
          status: 'completed', priority: 'normal',
          estimatedCost: 3000, actualCost: 2800,
          notes: 'Deep clean completed ahead of schedule. Room is ready for next guest.',
        },
      ],
    });
    console.log('✓ 3 maintenance blocks seeded');
  } catch (e: any) {
    console.log('Maintenance blocks seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. CITY LEDGER ACCOUNTS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding city ledger accounts...');
  try {
    await prisma.cityLedgerAccount.createMany({
      data: [
        {
          id: uuid('cla-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          accountName: 'TCS Limited', accountCode: 'CL-TCS-001',
          accountType: 'corporate', contactPerson: 'Arun Kumar', email: 'travel@tcs.com', phone: '+91-22-67881234',
          address: 'TCS House, Raveline Street', city: 'Mumbai', country: 'India',
          taxId: 'AABCT1234Q1Z5', gstNumber: '27AABCT1234Q1Z5', panNumber: 'AABCT1234Q',
          creditLimit: 500000, currentBalance: 85000, paymentTerms: 'net_30', billingCycle: 'monthly',
          discountPercent: 10, status: 'active', isActive: true,
          notes: 'TCS corporate account. Quarterly settlement. Dedicated relationship manager: Rajesh Sharma.',
        },
        {
          id: uuid('cla-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          accountName: 'Infosys Technologies', accountCode: 'CL-INFY-002',
          accountType: 'corporate', contactPerson: 'Deepa Menon', email: 'corporate.travel@infosys.com', phone: '+91-80-28520111',
          address: 'Electronics City', city: 'Bengaluru', country: 'India',
          taxId: 'AABCI5678R1Z3', gstNumber: '29AABCI5678R1Z3', panNumber: 'AABCI5678R',
          creditLimit: 750000, currentBalance: 125000, paymentTerms: 'net_45', billingCycle: 'monthly',
          discountPercent: 12, status: 'active', isActive: true,
          notes: 'Infosys prefers executive suites. Often books during project transitions.',
        },
        {
          id: uuid('cla-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          accountName: 'Government of West Bengal', accountCode: 'CL-GOV-003',
          accountType: 'government', contactPerson: 'Subrata Roy', email: 'guest.house@wb.gov.in', phone: '+91-33-22141000',
          address: 'Writer\'s Building', city: 'Kolkata', country: 'India',
          taxId: 'GOVT-WB-EXEMPT', gstNumber: '',
          creditLimit: 200000, currentBalance: 0, paymentTerms: 'net_30', billingCycle: 'monthly',
          discountPercent: 15, status: 'active', isActive: true,
          notes: 'Government rate — GST exempt. Requires prior approval letter for billing.',
        },
        {
          id: uuid('cla-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          accountName: 'Emirates Airlines', accountCode: 'CL-EMI-004',
          accountType: 'airline', contactPerson: 'Station Manager', email: 'kolkata.crew@emirates.com', phone: '+91-33-22891567',
          address: 'Nehru Road', city: 'Kolkata', country: 'India',
          taxId: 'EMI-KOL-001', gstNumber: '19AAACE5432P1Z1',
          creditLimit: 1000000, currentBalance: 210000, paymentTerms: 'net_15', billingCycle: 'weekly',
          discountPercent: 20, status: 'active', isActive: true,
          notes: 'Crew layover hotel. Block 8-12 rooms on average. Weekly invoicing.',
        },
      ],
    });
    console.log('✓ 4 city ledger accounts seeded');
  } catch (e: any) {
    console.log('City ledger accounts seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 12. FOLIO ROUTING RULES
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding folio routing rules...');
  try {
    await prisma.folioRoutingRule.createMany({
      data: [
        {
          id: uuid('frr-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Room charges to Guest Folio', description: 'All room charges are posted to the guest\'s personal folio by default.',
          chargeCategory: 'room', targetFolioType: 'guest', priority: 10,
          conditions: '{}', isActive: true,
        },
        {
          id: uuid('frr-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Corporate F&B to Company Folio', description: 'Food & beverage charges for corporate guests (with valid company code) are routed to company folio.',
          chargeCategory: 'food_beverage', targetFolioType: 'company', priority: 20,
          conditions: JSON.stringify({ source: 'corporate', minAmount: 0 }),
          isActive: true,
        },
        {
          id: uuid('frr-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'OTA charges to Travel Agent', description: 'Room charges from OTA bookings (Booking.com, Expedia) are routed to the travel agent folio for commission tracking.',
          chargeCategory: 'room', targetFolioType: 'travel_agent', priority: 15,
          conditions: JSON.stringify({ source: ['booking_com', 'expedia', 'airbnb'] }),
          isActive: true,
        },
        {
          id: uuid('frr-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'SPA to Guest Folio', description: 'Spa charges are posted to guest folio unless the guest has a package deal.',
          chargeCategory: 'spa', targetFolioType: 'guest', priority: 10,
          conditions: '{}', isActive: true,
        },
        {
          id: uuid('frr-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'High-value F&B to City Ledger', description: 'F&B charges above ₹25,000 for banquet/event bookings are routed to city ledger for corporate invoicing.',
          chargeCategory: 'food_beverage', targetFolioType: 'city_ledger', priority: 25,
          conditions: JSON.stringify({ minAmount: 25000, channel: 'direct' }),
          isActive: true,
        },
      ],
    });
    console.log('✓ 5 folio routing rules seeded');
  } catch (e: any) {
    console.log('Folio routing rules seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 13. REGISTRATION CARDS — For checked-in guests
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding registration cards...');
  try {
    await prisma.registrationCard.createMany({
      data: [
        {
          id: uuid('reg-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          bookingId: BOOKING_1, guestId: GUEST_1,
          cardNumber: 'RC-KOL-2024-0001',
          checkInDate: day(-2), checkOutDate: day(1),
          roomNumber: '501', roomType: 'Deluxe Room',
          guestName: 'Amit Mukherjee', guestNationality: 'India',
          guestIdType: 'national_id', guestIdNumber: 'AADHAR-1234-5678-9012',
          guestAddress: '45 Lake Gardens, Kolkata', guestPhone: '+91-9830012345', guestEmail: 'amit.m@email.com',
          purpose: 'business',
          vehiclePlate: 'WB-01-AB-1234',
          companions: JSON.stringify([{ name: 'Priya Mukherjee', idType: 'national_id', idNumber: 'AADHAR-9012-3456-7890', nationality: 'India' }]),
          specialRequests: 'Extra pillows, high floor preference, vegetarian breakfast',
          termsAccepted: true, acceptedAt: day(-2),
        },
        {
          id: uuid('reg-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          bookingId: BOOKING_2, guestId: GUEST_3,
          cardNumber: 'RC-KOL-2024-0002',
          checkInDate: day(-1), checkOutDate: day(3),
          roomNumber: '801', roomType: 'Executive Suite',
          guestName: 'Rahul Banerjee', guestNationality: 'India',
          guestIdType: 'passport', guestIdNumber: 'J8765432',
          guestAddress: '12 Ballygunge Place, Kolkata', guestPhone: '+91-9830034567', guestEmail: 'rahul.b@email.com',
          purpose: 'business',
          vehiclePlate: 'WB-02-CD-5678',
          companions: JSON.stringify([{ name: 'Sunita Banerjee', idType: 'passport', idNumber: 'J8765433', nationality: 'India' }, { name: 'Aarav Banerjee', idType: 'national_id', idNumber: 'AADHAR-1122-3344-5566', nationality: 'India' }]),
          specialRequests: 'VIP amenities, newspaper delivery, meeting room access, late checkout',
          termsAccepted: true, acceptedAt: day(-1),
        },
        {
          id: uuid('reg-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          bookingId: BOOKING_6, guestId: GUEST_6,
          cardNumber: 'RC-KOL-2024-0003',
          checkInDate: day(-3), checkOutDate: day(0),
          roomNumber: '305', roomType: 'Standard Room',
          guestName: 'Rina Chatterjee', guestNationality: 'India',
          guestIdType: 'national_id', guestIdNumber: 'AADHAR-5566-7788-9900',
          guestAddress: '89 Gariahat, Kolkata', guestPhone: '+91-9830067890', guestEmail: 'rina.c@email.com',
          purpose: 'leisure',
          vehiclePlate: null,
          companions: JSON.stringify([{ name: 'Mousumi Chatterjee', idType: 'national_id', idNumber: 'AADHAR-6677-8899-0011', nationality: 'India' }]),
          specialRequests: 'Extra towels, early checkout at noon',
          termsAccepted: true, acceptedAt: day(-3),
        },
      ],
    });
    console.log('✓ 3 registration cards seeded');
  } catch (e: any) {
    console.log('Registration cards seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 14. KIOSK SETTINGS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding kiosk settings...');
  try {
    await prisma.kioskSettings.create({
      data: {
        id: 'kiosk-rsk-001',
        propertyId: PROPERTY_ID,
        tenantId: TENANT_ID,
        hotelName: 'Royal Stay Kolkata',
        welcomeMessage: 'Welcome to Royal Stay Kolkata — Where Heritage Meets Luxury',
        primaryColor: '#1a1a2e',
        backgroundStyle: 'gradient',
        idleTimeout: 120,
        showClock: true,
        enableCheckIn: true,
        enableCheckOut: true,
        enablePayment: false,
        termsContent: 'By using this self-service kiosk, I agree to the terms and conditions of Royal Stay Hotels. I confirm that the information provided is accurate. I understand that valid government-issued photo identification is required for check-in. Cancellation and refund policies as per my booking confirmation apply.',
      },
    });
    console.log('✓ 1 kiosk settings seeded');
  } catch (e: any) {
    console.log('Kiosk settings seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 15. BANDWIDTH TOPUP PACKAGES
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding bandwidth topup packages...');
  try {
    await prisma.bandwidthTopup.createMany({
      data: [
        {
          id: uuid('bwtopup-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: '2GB Boost', description: 'Add 2GB of high-speed data to your session. Perfect for video calls and light streaming.',
          allottedUploadMb: 512, allottedDownloadMb: 1536, allottedTotalMb: 2048,
          applicableType: 'total', bandwidthPolicyId: BW_POLICY_STD,
          price: 99, currency: 'INR', validityMinutes: 1440, enabled: true,
        },
        {
          id: uuid('bwtopup-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: '5GB Power Pack', description: 'Add 5GB of data — great for HD streaming and video conferences.',
          allottedUploadMb: 1280, allottedDownloadMb: 3840, allottedTotalMb: 5120,
          applicableType: 'total', bandwidthPolicyId: BW_POLICY_STD,
          price: 199, currency: 'INR', validityMinutes: 4320, enabled: true,
        },
        {
          id: uuid('bwtopup-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: '10GB Business Pack', description: '10GB high-speed data for business travelers. Includes premium bandwidth tier.',
          allottedUploadMb: 2560, allottedDownloadMb: 7680, allottedTotalMb: 10240,
          applicableType: 'total', bandwidthPolicyId: BW_POLICY_PREM,
          price: 349, currency: 'INR', validityMinutes: 10080, enabled: true,
        },
        {
          id: uuid('bwtopup-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Upload Booster 2GB', description: 'Extra upload bandwidth — 2GB dedicated upload for cloud backup and video uploads.',
          allottedUploadMb: 2048, allottedDownloadMb: 0, allottedTotalMb: 0,
          applicableType: 'upload', bandwidthPolicyId: BW_POLICY_PREM,
          price: 149, currency: 'INR', validityMinutes: 2880, enabled: true,
        },
      ],
    });
    console.log('✓ 4 bandwidth topup packages seeded');
  } catch (e: any) {
    console.log('Bandwidth topup packages seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 16. BANDWIDTH POLICY DETAILS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding bandwidth policy details...');
  try {
    await prisma.bandwidthPolicyDetail.createMany({
      data: [
        // Standard policy details
        {
          id: uuid('bwdetail-1'), tenantId: TENANT_ID, bandwidthPolicyId: BW_POLICY_STD,
          downloadLimitBps: 25600000, uploadLimitBps: 10240000,
          guaranteedDownBps: 5120000, guaranteedUpBps: 2048000,
          burstTimeSeconds: 30, burstThresholdBytes: 52428800,
          burstUpTimeSeconds: 15, burstUpThresholdBytes: 20971520,
          contentionRatio: 10, priority: 5, isEnabled: true,
        },
        {
          id: uuid('bwdetail-2'), tenantId: TENANT_ID, bandwidthPolicyId: BW_POLICY_STD,
          downloadLimitBps: 12800000, uploadLimitBps: 5120000,
          guaranteedDownBps: 2560000, guaranteedUpBps: 1024000,
          burstTimeSeconds: 20, burstThresholdBytes: 31457280,
          burstUpTimeSeconds: 10, burstUpThresholdBytes: 10485760,
          contentionRatio: 15, priority: 8, isEnabled: true,
        },
        // Premium policy details
        {
          id: uuid('bwdetail-3'), tenantId: TENANT_ID, bandwidthPolicyId: BW_POLICY_PREM,
          downloadLimitBps: 51200000, uploadLimitBps: 25600000,
          guaranteedDownBps: 10240000, guaranteedUpBps: 5120000,
          burstTimeSeconds: 60, burstThresholdBytes: 104857600,
          burstUpTimeSeconds: 30, burstUpThresholdBytes: 52428800,
          contentionRatio: 5, priority: 2, isEnabled: true,
        },
        {
          id: uuid('bwdetail-4'), tenantId: TENANT_ID, bandwidthPolicyId: BW_POLICY_PREM,
          downloadLimitBps: 25600000, uploadLimitBps: 12800000,
          guaranteedDownBps: 5120000, guaranteedUpBps: 2560000,
          burstTimeSeconds: 45, burstThresholdBytes: 73400320,
          burstUpTimeSeconds: 20, burstUpThresholdBytes: 26214400,
          contentionRatio: 8, priority: 4, isEnabled: true,
        },
      ],
    });
    console.log('✓ 4 bandwidth policy details seeded');
  } catch (e: any) {
    console.log('Bandwidth policy details seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 17. DEVICE GROUPS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding device groups...');
  try {
    await prisma.deviceGroup.createMany({
      data: [
        {
          id: uuid('devgrp-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Smart TVs', description: 'All in-room Samsung and LG smart TVs. Apply relaxed content filter.',
          matchType: 'mac_oui', matchCriteria: JSON.stringify({ oui: '00:1A:2B', description: 'Samsung Electronics' }),
          defaultPolicyId: null, deviceCount: 0, enabled: true,
        },
        {
          id: uuid('devgrp-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'IoT Devices', description: 'Smart thermostats, door locks, and sensors. Restricted network access.',
          matchType: 'device_type', matchCriteria: JSON.stringify({ deviceType: 'iot', description: 'Hotel IoT infrastructure devices' }),
          defaultPolicyId: null, deviceCount: 0, enabled: true,
        },
        {
          id: uuid('devgrp-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Staff Devices', description: 'All staff phones and laptops on the staff WiFi SSID.',
          matchType: 'ssid', matchCriteria: JSON.stringify({ ssid: 'RoyalStay-Staff', description: 'Staff-only WiFi network' }),
          defaultPolicyId: null, deviceCount: 0, enabled: true,
        },
        {
          id: uuid('devgrp-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Conference Room AV', description: 'AV equipment in conference rooms — projectors, displays, sound systems.',
          matchType: 'manual', matchCriteria: JSON.stringify({ description: 'Manually assigned AV devices' }),
          defaultPolicyId: null, deviceCount: 0, enabled: true,
        },
      ],
    });
    console.log('✓ 4 device groups seeded');
  } catch (e: any) {
    console.log('Device groups seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 18. DEVICE POLICIES
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding device policies...');
  try {
    await prisma.devicePolicy.createMany({
      data: [
        {
          id: uuid('devpol-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Guest Standard', description: 'Default policy for guest personal devices on the guest WiFi network.',
          trustLevel: 'standard', bandwidthDownKbps: 10240, bandwidthUpKbps: 5120,
          allowedZones: JSON.stringify(['guest-network', 'internet']), deniedZones: JSON.stringify(['staff-network', 'pos-network', 'iot-network']),
          contentFilterLevel: 'basic', sessionTimeoutMins: 1440, maxDevices: 3,
          isActive: true, autoApplyOnAuth: true, priority: 0,
        },
        {
          id: uuid('devpol-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'VIP Premium', description: 'Enhanced policy for VIP guests with higher bandwidth and broader access.',
          trustLevel: 'trusted', bandwidthDownKbps: 51200, bandwidthUpKbps: 25600,
          allowedZones: JSON.stringify(['guest-network', 'internet', 'premium-lounge']), deniedZones: JSON.stringify(['staff-network', 'pos-network', 'iot-network', 'server-network']),
          contentFilterLevel: 'none', sessionTimeoutMins: 4320, maxDevices: 10,
          isActive: true, autoApplyOnAuth: true, priority: 10,
        },
        {
          id: uuid('devpol-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'IoT Restricted', description: 'Highly restricted policy for IoT devices — only cloud management endpoints allowed.',
          trustLevel: 'restricted', bandwidthDownKbps: 512, bandwidthUpKbps: 256,
          allowedZones: JSON.stringify(['iot-network', 'iot-cloud']), deniedZones: JSON.stringify(['guest-network', 'staff-network', 'internet', 'pos-network', 'server-network']),
          contentFilterLevel: 'strict', sessionTimeoutMins: 43200, maxDevices: 1,
          isActive: true, autoApplyOnAuth: true, priority: 20,
        },
        {
          id: uuid('devpol-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          name: 'Staff Trusted', description: 'Policy for authenticated staff devices with access to hotel management systems.',
          trustLevel: 'trusted', bandwidthDownKbps: 25600, bandwidthUpKbps: 12800,
          allowedZones: JSON.stringify(['staff-network', 'internet', 'pos-network', 'guest-network']), deniedZones: JSON.stringify(['iot-network', 'server-network']),
          contentFilterLevel: 'basic', sessionTimeoutMins: 480, maxDevices: 2,
          isActive: true, autoApplyOnAuth: true, priority: 5,
        },
      ],
    });
    console.log('✓ 4 device policies seeded');
  } catch (e: any) {
    console.log('Device policies seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 19. PURCHASE REQUISITIONS + ITEMS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding purchase requisitions...');
  try {
    const pr1Id = uuid('pr-1');
    const pr2Id = uuid('pr-2');
    const pr3Id = uuid('pr-3');

    await prisma.purchaseRequisition.createMany({
      data: [
        {
          id: pr1Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          requisitionNo: 'PR-2024-001', department: 'Housekeeping',
          requestDate: day(-3), requiredBy: day(-1), status: 'approved', priority: 'high',
          vendorId: VENDOR_1, notes: 'Monthly linen replenishment — urgently needed before festive season.',
          totalAmount: 68500, approvedBy: USER_ADMIN, approvedAt: day(-2),
        },
        {
          id: pr2Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          requisitionNo: 'PR-2024-002', department: 'Food & Beverage',
          requestDate: day(-1), requiredBy: day(3), status: 'pending_approval', priority: 'normal',
          vendorId: null, notes: 'Durga Puja special menu ingredients — spices, dairy, and fresh produce.',
          totalAmount: 42000,
        },
        {
          id: pr3Id, tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          requisitionNo: 'PR-2024-003', department: 'Front Office',
          requestDate: day(-5), requiredBy: day(-2), status: 'received', priority: 'low',
          vendorId: VENDOR_3, notes: 'New key cards, registration card holders, and guest welcome kit supplies.',
          totalAmount: 18500, approvedBy: USER_FRONTDESK, approvedAt: day(-4),
        },
      ],
    });

    await prisma.purchaseRequisitionItem.createMany({
      data: [
        // PR-1 items (Housekeeping linen)
        { id: uuid('pri-1'), requisitionId: pr1Id, stockItemId: STOCK_1, itemName: 'Bath Towels', description: 'Premium cotton bath towels — 300 GSM', quantity: 150, unit: 'pcs', unitPrice: 250, totalPrice: 37500, receivedQty: 150, notes: 'Delivered on time' },
        { id: uuid('pri-2'), requisitionId: pr1Id, stockItemId: STOCK_2, itemName: 'Hand Towels', description: 'Soft cotton hand towels', quantity: 100, unit: 'pcs', unitPrice: 150, totalPrice: 15000, receivedQty: 100 },
        { id: uuid('pri-3'), requisitionId: pr1Id, stockItemId: null, itemName: 'Pillow Covers (King)', description: 'White cotton pillow covers for king beds', quantity: 80, unit: 'pcs', unitPrice: 200, totalPrice: 16000, receivedQty: 80 },

        // PR-2 items (F&B ingredients)
        { id: uuid('pri-4'), requisitionId: pr2Id, stockItemId: null, itemName: 'Ghee (Amul) 1kg', description: 'Pure desi ghee for festive cooking', quantity: 20, unit: 'kg', unitPrice: 550, totalPrice: 11000, receivedQty: 0 },
        { id: uuid('pri-5'), requisitionId: pr2Id, stockItemId: null, itemName: 'Basmati Rice (India Gate) 25kg', description: 'Premium basmati rice for banquet kitchen', quantity: 10, unit: 'bags', unitPrice: 1500, totalPrice: 15000, receivedQty: 0 },
        { id: uuid('pri-6'), requisitionId: pr2Id, stockItemId: null, itemName: 'Fresh Paneer 1kg blocks', description: 'Farm fresh paneer from local dairy', quantity: 30, unit: 'kg', unitPrice: 350, totalPrice: 10500, receivedQty: 0 },
        { id: uuid('pri-7'), requisitionId: pr2Id, stockItemId: null, itemName: 'Assorted Dry Fruits', description: 'Almonds, cashews, pistachios for mithai counter', quantity: 5, unit: 'kg', unitPrice: 1100, totalPrice: 5500, receivedQty: 0 },

        // PR-3 items (Front Office supplies)
        { id: uuid('pri-8'), requisitionId: pr3Id, stockItemId: null, itemName: 'RFID Key Cards (MIFARE)', description: 'Blank RFID key cards for room access', quantity: 500, unit: 'pcs', unitPrice: 25, totalPrice: 12500, receivedQty: 500 },
        { id: uuid('pri-9'), requisitionId: pr3Id, stockItemId: null, itemName: 'Welcome Folder (A4)', description: 'Printed hotel welcome folders with branding', quantity: 200, unit: 'pcs', unitPrice: 30, totalPrice: 6000, receivedQty: 200 },
      ],
    });
    console.log('✓ 3 purchase requisitions + 9 items seeded');
  } catch (e: any) {
    console.log('Purchase requisitions seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 20. INVENTORY TRANSFERS + ITEMS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding inventory transfers...');
  try {
    const it1Id = uuid('itransfer-1');
    const it2Id = uuid('itransfer-2');

    await prisma.inventoryTransfer.createMany({
      data: [
        {
          id: it1Id, tenantId: TENANT_ID,
          fromPropertyId: PROPERTY_ID, toPropertyId: PROPERTY_2_ID,
          status: 'in_transit', requestedBy: USER_ADMIN, approvedBy: USER_ADMIN,
          completedBy: null, reason: 'Darjeeling property running low on amenities — transferring excess stock from Kolkata.',
          notes: 'Sent via BlueDart courier. Tracking: BD1234567890IN.',
          approvedAt: day(-2), completedAt: null, rejectedAt: null, rejectionReason: null,
        },
        {
          id: it2Id, tenantId: TENANT_ID,
          fromPropertyId: PROPERTY_2_ID, toPropertyId: PROPERTY_ID,
          status: 'completed', requestedBy: USER_ADMIN, approvedBy: USER_ADMIN,
          completedBy: USER_HK, reason: 'Kolkata needed specialty tea supplies from Darjeeling property for Puja festive menu.',
          notes: 'Received via internal transport. All items in good condition.',
          approvedAt: day(-10), completedAt: day(-7), rejectedAt: null, rejectionReason: null,
        },
      ],
    });

    await prisma.inventoryTransferItem.createMany({
      data: [
        // Transfer 1: Kolkata → Darjeeling
        { id: uuid('iti-1'), transferId: it1Id, stockItemId: STOCK_3, stockItemName: 'Shampoo Bottles', quantity: 100, unit: 'piece', unitCost: 35 },
        { id: uuid('iti-2'), transferId: it1Id, stockItemId: STOCK_4, stockItemName: 'Conditioner Bottles', quantity: 100, unit: 'piece', unitCost: 35 },
        { id: uuid('iti-3'), transferId: it1Id, stockItemId: STOCK_6, stockItemName: 'Hand Soap', quantity: 50, unit: 'bottle', unitCost: 25 },

        // Transfer 2: Darjeeling → Kolkata (tea supplies from existing stock)
        { id: uuid('iti-4'), transferId: it2Id, stockItemId: STOCK_1, stockItemName: 'Bath Towels (Premium)', quantity: 25, unit: 'piece', unitCost: 250 },
        { id: uuid('iti-5'), transferId: it2Id, stockItemId: STOCK_2, stockItemName: 'Hand Towels (Premium)', quantity: 30, unit: 'piece', unitCost: 150 },
      ],
    });
    console.log('✓ 2 inventory transfers + 5 items seeded');
  } catch (e: any) {
    console.log('Inventory transfers seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 21. AD PERFORMANCE — Daily performance data for ad campaigns
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding ad performance data...');
  try {
    const perfData: any[] = [];

    // Campaign 1: Durga Puja Special Offer — 7 days of data
    for (let i = 6; i >= 0; i--) {
      const date = day(-i);
      date.setHours(0, 0, 0, 0);
      perfData.push({
        id: uuid(`adperf-1-${i}`),
        campaignId: ADCAMPAIGN_1,
        date,
        impressions: Math.floor(15000 + Math.random() * 5000),
        clicks: Math.floor(1000 + Math.random() * 400),
        conversions: Math.floor(20 + Math.random() * 15),
        cost: Math.floor(11000 + Math.random() * 3000),
        revenue: Math.floor(120000 + Math.random() * 40000),
        ctr: +(6 + Math.random() * 2).toFixed(2),
        cpc: +(9 + Math.random() * 2).toFixed(2),
        cpa: +(350 + Math.random() * 100).toFixed(0),
        roas: +(9 + Math.random() * 3).toFixed(2),
        conversionRate: +(1.8 + Math.random() * 0.6).toFixed(2),
        avgPosition: +(2.1 + Math.random() * 0.8).toFixed(1),
        qualityScore: +(7 + Math.random() * 2).toFixed(0),
        deviceBreakdown: JSON.stringify({ mobile: 0.45, desktop: 0.42, tablet: 0.13 }),
        sourceBreakdown: JSON.stringify({ google_search: 0.85, google_display: 0.15 }),
      });
    }

    // Campaign 2: Corporate Retreats Kolkata — 5 days
    for (let i = 4; i >= 0; i--) {
      const date = day(-i);
      date.setHours(0, 0, 0, 0);
      perfData.push({
        id: uuid(`adperf-2-${i}`),
        campaignId: ADCAMPAIGN_2,
        date,
        impressions: Math.floor(9000 + Math.random() * 3000),
        clicks: Math.floor(500 + Math.random() * 200),
        conversions: Math.floor(8 + Math.random() * 8),
        cost: Math.floor(7000 + Math.random() * 2000),
        revenue: Math.floor(60000 + Math.random() * 25000),
        ctr: +(5 + Math.random() * 1.5).toFixed(2),
        cpc: +(11 + Math.random() * 2).toFixed(2),
        cpa: +(700 + Math.random() * 200).toFixed(0),
        roas: +(7 + Math.random() * 2.5).toFixed(2),
        conversionRate: +(1.2 + Math.random() * 0.5).toFixed(2),
        avgPosition: +(2.5 + Math.random() * 1).toFixed(1),
        qualityScore: +(6 + Math.random() * 2).toFixed(0),
        deviceBreakdown: JSON.stringify({ mobile: 0.35, desktop: 0.55, tablet: 0.10 }),
        sourceBreakdown: JSON.stringify({ google_search: 1.0 }),
      });
    }

    // Campaign 3: Weekend Getaway — Social — 5 days (recent, before pause)
    for (let i = 9; i >= 5; i--) {
      const date = day(-i);
      date.setHours(0, 0, 0, 0);
      perfData.push({
        id: uuid(`adperf-3-${i}`),
        campaignId: ADCAMPAIGN_3,
        date,
        impressions: Math.floor(35000 + Math.random() * 10000),
        clicks: Math.floor(800 + Math.random() * 300),
        conversions: Math.floor(6 + Math.random() * 5),
        cost: Math.floor(5000 + Math.random() * 1500),
        revenue: Math.floor(30000 + Math.random() * 15000),
        ctr: +(1.8 + Math.random() * 0.5).toFixed(2),
        cpc: +(5 + Math.random() * 2).toFixed(2),
        cpa: +(600 + Math.random() * 200).toFixed(0),
        roas: +(4 + Math.random() * 2.5).toFixed(2),
        conversionRate: +(0.6 + Math.random() * 0.3).toFixed(2),
        avgPosition: null,
        qualityScore: null,
        deviceBreakdown: JSON.stringify({ mobile: 0.78, desktop: 0.15, tablet: 0.07 }),
        sourceBreakdown: JSON.stringify({ facebook: 0.6, instagram: 0.4 }),
      });
    }

    await prisma.adPerformance.createMany({ data: perfData });
    console.log(`✓ ${perfData.length} ad performance records seeded`);
  } catch (e: any) {
    console.log('Ad performance seed error:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 22. MEAL PLAN MAPPINGS — Channel-specific meal plan codes
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding meal plan mappings...');
  try {
    await prisma.mealPlanMapping.createMany({
      data: [
        {
          id: uuid('mpm-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          connectionId: CH_CONN_1,
          internalMealPlanId: RP_3, internalMealPlanName: 'Bed & Breakfast',
          channelCode: 'booking_com', channelMealPlanCode: 'BB', channelMealPlanName: 'Breakfast',
          mealPlanType: 'bed_breakfast', includesBreakfast: true, includesLunch: false, includesDinner: false,
          supplementAmount: 0, currency: 'INR', isActive: true,
        },
        {
          id: uuid('mpm-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          connectionId: CH_CONN_1,
          internalMealPlanId: RP_7, internalMealPlanName: 'Presidential Package',
          channelCode: 'booking_com', channelMealPlanCode: 'AI', channelMealPlanName: 'All Inclusive',
          mealPlanType: 'all_inclusive', includesBreakfast: true, includesLunch: true, includesDinner: true,
          supplementAmount: 0, currency: 'INR', isActive: true,
        },
        {
          id: uuid('mpm-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          connectionId: CH_CONN_2,
          internalMealPlanId: RP_3, internalMealPlanName: 'Bed & Breakfast',
          channelCode: 'expedia', channelMealPlanCode: 'BRKFAST_INCLUDED', channelMealPlanName: 'Breakfast Included',
          mealPlanType: 'bed_breakfast', includesBreakfast: true, includesLunch: false, includesDinner: false,
          supplementAmount: 0, currency: 'INR', isActive: true,
        },
        {
          id: uuid('mpm-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID,
          connectionId: CH_CONN_1,
          internalMealPlanId: RP_6, internalMealPlanName: 'Best Available Rate',
          channelCode: 'booking_com', channelMealPlanCode: 'RO', channelMealPlanName: 'Room Only',
          mealPlanType: 'room_only', includesBreakfast: false, includesLunch: false, includesDinner: false,
          supplementAmount: 800, currency: 'INR', isActive: true,
        },
      ],
    });
    console.log('✓ 4 meal plan mappings seeded');
  } catch (e: any) {
    console.log('Meal plan mappings seed error:', e.message);
  }

  console.log('\n✅ Page data supplement seeding complete!');
}
