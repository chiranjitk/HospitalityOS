import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// System-provided automation templates
const SYSTEM_TEMPLATES = [
  {
    name: 'Pre-Arrival Email',
    description: 'Send a personalized pre-arrival email 3 days before check-in with check-in instructions, property info, and upsell opportunities.',
    category: 'pre_arrival',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ checkInDaysAhead: 3 }),
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'pre-arrival', channel: 'email' } },
      { type: 'send_sms', config: { templateId: 'pre-arrival-sms', channel: 'sms' } },
    ]),
    icon: 'Mail',
    sortOrder: 1,
  },
  {
    name: 'Post-Checkout Thank You',
    description: 'Send a thank-you message after guest check-out with a review request link and return booking incentive.',
    category: 'post_stay',
    triggerEvent: 'guest.check_out',
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'post-checkout-thank-you', delayHours: 24 } },
      { type: 'create_notification', config: { type: 'survey', category: 'info' } },
    ]),
    icon: 'Heart',
    sortOrder: 2,
  },
  {
    name: 'VIP Welcome Package',
    description: 'Trigger VIP welcome workflow: room upgrade priority, welcome amenity setup, and personalized greeting.',
    category: 'vip',
    triggerEvent: 'booking.confirmed',
    triggerConditions: JSON.stringify({ guestIsVip: true }),
    actions: JSON.stringify([
      { type: 'create_task', config: { title: 'VIP Welcome Setup', priority: 'high', department: 'housekeeping' } },
      { type: 'send_email', config: { templateId: 'vip-welcome', channel: 'email' } },
      { type: 'add_tag', config: { tag: 'vip-arrival' } },
    ]),
    icon: 'Crown',
    sortOrder: 3,
  },
  {
    name: 'Housekeeping Alert (Dirty Room)',
    description: 'Alert housekeeping team when a room remains dirty for more than 2 hours after guest checkout.',
    category: 'housekeeping',
    triggerEvent: 'scheduled.hourly',
    triggerConditions: JSON.stringify({ hoursSinceCheckout: 2, housekeepingStatus: 'dirty' }),
    actions: JSON.stringify([
      { type: 'create_task', config: { title: 'Room needs cleaning', priority: 'high', department: 'housekeeping' } },
      { type: 'send_notification', config: { channel: 'push', department: 'housekeeping' } },
    ]),
    icon: 'AlertTriangle',
    sortOrder: 4,
  },
  {
    name: 'Low Rating Follow-up',
    description: 'Automatically create a follow-up task and notify management when a guest submits a survey score below 7.',
    category: 'post_stay',
    triggerEvent: 'nps.response',
    triggerConditions: JSON.stringify({ maxScore: 6 }),
    actions: JSON.stringify([
      { type: 'create_task', config: { title: 'Low Rating Follow-up Required', priority: 'urgent', department: 'management' } },
      { type: 'send_email', config: { templateId: 'low-rating-apology', channel: 'email' } },
      { type: 'send_notification', config: { channel: 'push', department: 'management' } },
    ]),
    icon: 'ThumbsDown',
    sortOrder: 5,
  },
  {
    name: 'Birthday / Anniversary Offer',
    description: 'Send a personalized birthday or anniversary greeting with a special offer or discount.',
    category: 'marketing',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ event: 'birthday_or_anniversary', daysAhead: 0 }),
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'birthday-offer', channel: 'email' } },
      { type: 'add_tag', config: { tag: 'birthday-campaign' } },
    ]),
    icon: 'Gift',
    sortOrder: 6,
  },
  {
    name: 'Rate Change Notification',
    description: 'Notify guests with active bookings when their room rate changes due to dynamic pricing adjustments.',
    category: 'billing',
    triggerEvent: 'booking.rate_changed',
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'rate-change-notification', channel: 'email' } },
      { type: 'send_notification', config: { channel: 'push' } },
    ]),
    icon: 'TrendingUp',
    sortOrder: 7,
  },
  {
    name: 'No-Show Auto-Cancel',
    description: 'Automatically cancel bookings and release rooms for guests who do not check in by end of the check-in day.',
    category: 'check_in',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ time: '23:59', status: 'confirmed', checkInToday: true }),
    actions: JSON.stringify([
      { type: 'update_booking', config: { status: 'no_show' } },
      { type: 'release_room', config: {} },
      { type: 'send_email', config: { templateId: 'no-show-notice', channel: 'email' } },
    ]),
    icon: 'XCircle',
    sortOrder: 8,
  },
  {
    name: 'Long-Stay Weekly Touchpoint',
    description: 'Send a weekly check-in message to long-stay guests (7+ nights) to ensure satisfaction and offer additional services.',
    category: 'check_in',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ minNights: 7, interval: 'weekly' }),
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'long-stay-touchpoint', channel: 'email' } },
      { type: 'create_task', config: { title: 'Long-stay guest check', priority: 'normal', department: 'front_desk' } },
    ]),
    icon: 'CalendarDays',
    sortOrder: 9,
  },
  {
    name: 'Deposit Reminder',
    description: 'Send a payment reminder to guests 7 days before the deposit deadline for unpaid bookings.',
    category: 'billing',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ depositDeadlineDays: 7, depositPaid: false }),
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'deposit-reminder', channel: 'email' } },
      { type: 'send_sms', config: { templateId: 'deposit-reminder-sms', channel: 'sms' } },
    ]),
    icon: 'CreditCard',
    sortOrder: 10,
  },
  {
    name: 'Loyalty Tier Upgrade Notification',
    description: 'Celebrate and notify guests when they reach a new loyalty tier, with details of new benefits.',
    category: 'marketing',
    triggerEvent: 'loyalty.tier_upgraded',
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'loyalty-upgrade', channel: 'email' } },
      { type: 'add_tag', config: { tag: 'tier-upgrade' } },
      { type: 'send_notification', config: { channel: 'push' } },
    ]),
    icon: 'Award',
    sortOrder: 11,
  },
  {
    name: 'Group Booking Rooming List Reminder',
    description: 'Send a reminder to group organizers to submit or update their rooming list before the deadline.',
    category: 'pre_arrival',
    triggerEvent: 'scheduled.daily',
    triggerConditions: JSON.stringify({ bookingType: 'group', daysBeforeCheckIn: 14 }),
    actions: JSON.stringify([
      { type: 'send_email', config: { templateId: 'group-rooming-list-reminder', channel: 'email' } },
      { type: 'create_task', config: { title: 'Follow up on group rooming list', priority: 'normal', department: 'sales' } },
    ]),
    icon: 'Users',
    sortOrder: 12,
  },
];

// GET /api/automations/templates/system - Get system-provided templates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // GAP-FIX(17b): Added missing permission check for viewing system templates
    if (!hasPermission(user, 'automation.view') && !hasPermission(user, 'automation.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');

    // Get existing system templates from DB for this tenant
    const existingSystemTemplates = await db.automationTemplate.findMany({
      where: { tenantId: user.tenantId, isSystem: true },
      select: { name: true },
    });
    const existingNames = new Set(existingSystemTemplates.map(t => t.name));

    // Filter templates by category if specified
    const filtered = category
      ? SYSTEM_TEMPLATES.filter(t => t.category === category)
      : SYSTEM_TEMPLATES;

    // Return system templates (excluding already-installed ones, or merge usage data)
    const templates = await Promise.all(filtered.map(async (template) => {
      const existing = await db.automationTemplate.findFirst({
        where: { tenantId: user.tenantId, name: template.name },
        select: { id: true, usageCount: true, isActive: true },
      });

      return {
        ...template,
        isSystem: true,
        alreadyInstalled: !!existing,
        existingId: existing?.id || null,
        usageCount: existing?.usageCount || 0,
        isActive: existing?.isActive ?? true,
      };
    }));

    return NextResponse.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        actions: typeof t.actions === 'string' ? JSON.parse(t.actions) : t.actions,
        triggerConditions: t.triggerConditions ? (typeof t.triggerConditions === 'string' ? JSON.parse(t.triggerConditions) : t.triggerConditions) : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching system templates:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch system templates' } }, { status: 500 });
  }
}

// POST /api/automations/templates/system - Install system template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // GAP-FIX(17b): Added missing permission check for installing system templates
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'automation.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { templateName } = body;

    if (!templateName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'templateName is required' } },
        { status: 400 }
      );
    }

    const systemTemplate = SYSTEM_TEMPLATES.find(t => t.name === templateName);
    if (!systemTemplate) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'System template not found' } },
        { status: 404 }
      );
    }

    // Check if already installed
    const existing = await db.automationTemplate.findFirst({
      where: { tenantId: user.tenantId, name: templateName },
    });

    if (existing) {
      // Reactivate if deactivated
      if (!existing.isActive) {
        const updated = await db.automationTemplate.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        return NextResponse.json({ success: true, data: updated });
      }
      return NextResponse.json({ success: true, data: existing, message: 'Template already installed' });
    }

    // Create from system template
    const template = await db.automationTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: systemTemplate.name,
        description: systemTemplate.description,
        category: systemTemplate.category,
        triggerEvent: systemTemplate.triggerEvent,
        triggerConditions: systemTemplate.triggerConditions,
        actions: systemTemplate.actions,
        isSystem: true,
        icon: systemTemplate.icon,
        sortOrder: systemTemplate.sortOrder,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Error installing system template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to install system template' } }, { status: 500 });
  }
}
