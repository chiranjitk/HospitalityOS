/**
 * OTA Message Manager
 * Enables hotels to receive and reply to guest messages from Booking.com, Expedia, Airbnb, etc.
 * directly from the PMS - critical for maintaining review scores.
 */

import { db } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export interface OTAMessage {
  id: string;
  tenantId: string;
  propertyId: string;
  channelName: string;
  reservationId: string;
  guestName: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'unread' | 'read' | 'replied' | 'archived';
  priority: 'normal' | 'high' | 'urgent';
  guestEmail?: string;
  guestPhone?: string;
  bookingRef?: string;
  channelMessageId?: string;
  receivedAt: Date;
  repliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OTAMessageThread {
  reservationId: string;
  channelName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  bookingRef?: string;
  messages: OTAMessage[];
  lastMessageAt: Date;
  unreadCount: number;
  priority: 'normal' | 'high' | 'urgent';
}

export interface ReplyResult {
  success: boolean;
  channelMessageId?: string;
  error?: string;
}

// ============================================
// CHANNEL-SPECIFIC MESSAGE FORMATTERS
// ============================================

/**
 * Format reply per channel requirements
 */
function formatReplyForChannel(channelName: string, replyBody: string, guestName: string): string {
  const formatted = replyBody.trim();

  switch (channelName) {
    case 'booking_com':
      return `Dear ${guestName},\n\n${formatted}\n\nBest regards,\nStaySuite Property Management`;

    case 'expedia':
      return `Hello ${guestName},\n\n${formatted}\n\nKind regards,\nStaySuite`;

    case 'airbnb':
      return `Hi ${guestName},\n\n${formatted}\n\nThanks,\nStaySuite`;

    case 'agoda':
      return `Dear ${guestName},\n\n${formatted}\n\nBest regards,\nStaySuite`;

    case 'makemytrip':
      return `Dear ${guestName},\n\n${formatted}\n\nWarm regards,\nStaySuite`;

    default:
      return `Dear ${guestName},\n\n${formatted}\n\nBest regards,\nStaySuite`;
  }
}

/**
 * Simulate sending reply to channel messaging API
 * In production, this would call:
 * - Booking.com Inbox API
 * - Expedia Partner Messages API
 * - Airbnb Thread API
 * - etc.
 */
async function sendReplyToChannelAPI(
  channelName: string,
  connectionId: string,
  reservationId: string,
  formattedBody: string
): Promise<{ success: boolean; channelMessageId?: string; error?: string }> {
  // In production, this would make real API calls:
  //
  // Booking.com: POST /xml/hotel_messages
  // Expedia: POST /v1/messages
  // Airbnb: POST /v2/messages
  //
  // We simulate the response here.

  const channelMessageId = `ch_${channelName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Simulate occasional failures (5% chance)
  if (Math.random() < 0.05) {
    return {
      success: false,
      error: `Channel ${channelName} messaging API returned an error: timeout`,
    };
  }

  return {
    success: true,
    channelMessageId,
  };
}

/**
 * Simulate fetching messages from channel
 * In production, this would call:
 * - Booking.com: GET /xml/inbox
 * - Expedia: GET /v1/messages
 * - Airbnb: GET /v2/threads
 */
async function fetchMessagesFromChannelAPI(
  channelName: string,
  connectionId: string,
  propertyId: string,
  since?: Date
): Promise<Array<{
  channelMessageId: string;
  reservationId: string;
  guestName: string;
  subject: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
}>> {
  // In production, this would fetch from the real channel API.
  // Returns empty array since we're simulating.
  return [];
}

// ============================================
// PRIORITY DETECTION
// ============================================

function detectMessagePriority(subject: string, body: string): 'normal' | 'high' | 'urgent' {
  const text = `${subject} ${body}`.toLowerCase();

  const urgentKeywords = ['urgent', 'emergency', 'immediately', 'asap', 'complaint', 'unacceptable', 'disappointed', 'terrible'];
  const highKeywords = ['problem', 'issue', 'concern', 'request', 'special', 'important', 'help'];

  for (const keyword of urgentKeywords) {
    if (text.includes(keyword)) return 'urgent';
  }

  for (const keyword of highKeywords) {
    if (text.includes(keyword)) return 'high';
  }

  return 'normal';
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Fetch messages from a specific channel and store them locally
 */
export async function fetchMessagesFromChannel(
  tenantId: string,
  propertyId: string,
  channelName: string
): Promise<OTAMessage[]> {
  // Find active channel connection
  const connection = await db.channelConnection.findFirst({
    where: { tenantId, channel: channelName, status: 'active' },
  });

  if (!connection) {
    return [];
  }

  // Get the last message timestamp for incremental fetching
  const lastMessage = await db.oTAMessage.findFirst({
    where: { tenantId, propertyId, channelName, direction: 'inbound' },
    orderBy: { receivedAt: 'desc' },
  });

  // Fetch from channel API
  const channelMessages = await fetchMessagesFromChannelAPI(
    channelName,
    connection.id,
    propertyId,
    lastMessage?.receivedAt
  );

  // Store new messages in DB
  const newMessages: OTAMessage[] = [];

  for (const msg of channelMessages) {
    // Check for duplicates
    const existing = await db.oTAMessage.findFirst({
      where: {
        tenantId,
        channelName,
        channelMessageId: msg.channelMessageId,
      },
    });

    if (existing) continue;

    // Find the reservation by external reference
    let reservationId = msg.reservationId;
    if (!reservationId || reservationId === 'unknown') {
      // Try to match by booking with channel source
      const booking = await db.booking.findFirst({
        where: {
          tenantId,
          propertyId,
          source: channelName,
          status: { in: ['confirmed', 'checked_in'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      reservationId = booking?.id || 'unknown';
    }

    const priority = detectMessagePriority(msg.subject, msg.body);

    const stored = await db.oTAMessage.create({
      data: {
        tenantId,
        propertyId,
        channelName,
        reservationId,
        guestName: msg.guestName,
        subject: msg.subject,
        body: msg.body,
        direction: 'inbound',
        status: 'unread',
        priority,
        channelMessageId: msg.channelMessageId,
      },
    });

    newMessages.push(mapMessageToInterface(stored));
  }

  return newMessages;
}

/**
 * Fetch messages from all connected channels
 */
export async function fetchAllMessages(
  tenantId: string,
  propertyId: string
): Promise<OTAMessage[]> {
  const connections = await db.channelConnection.findMany({
    where: { tenantId, status: 'active' },
  });

  const allNewMessages: OTAMessage[] = [];

  for (const connection of connections) {
    const messages = await fetchMessagesFromChannel(tenantId, propertyId, connection.channel);
    allNewMessages.push(...messages);
  }

  return allNewMessages;
}

/**
 * Reply to a message through the channel's messaging API
 */
export async function replyToMessage(
  tenantId: string,
  messageId: string,
  replyBody: string
): Promise<ReplyResult> {
  // Find the original message
  const message = await db.oTAMessage.findFirst({
    where: { id: messageId, tenantId },
  });

  if (!message) {
    return { success: false, error: 'Message not found' };
  }

  // Find active channel connection
  const connection = await db.channelConnection.findFirst({
    where: { tenantId, channel: message.channelName, status: 'active' },
  });

  if (!connection) {
    return { success: false, error: `No active connection for channel ${message.channelName}` };
  }

  // Format reply per channel requirements
  const formattedBody = formatReplyForChannel(message.channelName, replyBody, message.guestName);

  // Send reply to channel API
  const apiResult = await sendReplyToChannelAPI(
    message.channelName,
    connection.id,
    message.reservationId,
    formattedBody
  );

  if (!apiResult.success) {
    return { success: false, error: apiResult.error };
  }

  // Store the outbound message
  await db.oTAMessage.create({
    data: {
      tenantId,
      propertyId: message.propertyId,
      channelName: message.channelName,
      reservationId: message.reservationId,
      guestName: message.guestName,
      subject: `Re: ${message.subject}`,
      body: replyBody,
      direction: 'outbound',
      status: 'replied',
      priority: message.priority,
      guestEmail: message.guestEmail,
      guestPhone: message.guestPhone,
      bookingRef: message.bookingRef,
      channelMessageId: apiResult.channelMessageId,
    },
  });

  // Update original message status to 'replied'
  await db.oTAMessage.update({
    where: { id: messageId },
    data: {
      status: 'replied',
      repliedAt: new Date(),
    },
  });

  return {
    success: true,
    channelMessageId: apiResult.channelMessageId,
  };
}

/**
 * Get message threads grouped by reservation
 */
export async function getMessageThreads(
  tenantId: string,
  propertyId: string,
  options?: { channelName?: string; unreadOnly?: boolean; limit?: number; offset?: number }
): Promise<{ threads: OTAMessageThread[]; total: number }> {
  const where: Record<string, unknown> = {
    tenantId,
    propertyId,
  };

  if (options?.channelName) {
    where.channelName = options.channelName;
  }

  if (options?.unreadOnly) {
    // For threads with unread messages, we need at least one unread message
    // We'll filter after fetching
  }

  // Get all messages for this property, ordered by time
  const messages = await db.oTAMessage.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: options?.limit ? options.limit * 10 : 500, // Fetch more for grouping
    skip: options?.offset || 0,
  });

  // Group by reservationId + channelName
  const threadMap = new Map<string, OTAMessageThread>();

  for (const msg of messages) {
    const key = `${msg.reservationId}-${msg.channelName}`;
    const mapped = mapMessageToInterface(msg);

    if (threadMap.has(key)) {
      const thread = threadMap.get(key)!;
      thread.messages.push(mapped);
      thread.unreadCount = thread.messages.filter(m => m.status === 'unread' && m.direction === 'inbound').length;
      if (new Date(mapped.receivedAt) > new Date(thread.lastMessageAt)) {
        thread.lastMessageAt = mapped.receivedAt;
      }
    } else {
      threadMap.set(key, {
        reservationId: msg.reservationId,
        channelName: msg.channelName,
        guestName: msg.guestName,
        guestEmail: msg.guestEmail || undefined,
        guestPhone: msg.guestPhone || undefined,
        bookingRef: msg.bookingRef || undefined,
        messages: [mapped],
        lastMessageAt: mapped.receivedAt,
        unreadCount: mapped.status === 'unread' && mapped.direction === 'inbound' ? 1 : 0,
        priority: mapped.priority,
      });
    }
  }

  let threads = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  // Filter for unread-only if requested
  if (options?.unreadOnly) {
    threads = threads.filter(t => t.unreadCount > 0);
  }

  return {
    threads,
    total: threadMap.size,
  };
}

/**
 * Mark a message as read
 */
export async function markMessageRead(
  tenantId: string,
  messageId: string
): Promise<void> {
  await db.oTAMessage.updateMany({
    where: { id: messageId, tenantId, status: 'unread' },
    data: { status: 'read' },
  });
}

/**
 * Mark multiple messages as read
 */
export async function markMessagesRead(
  tenantId: string,
  messageIds: string[]
): Promise<number> {
  const result = await db.oTAMessage.updateMany({
    where: {
      id: { in: messageIds },
      tenantId,
      status: 'unread',
    },
    data: { status: 'read' },
  });
  return result.count;
}

/**
 * Get count of unread messages
 */
export async function getUnreadMessageCount(
  tenantId: string,
  propertyId: string
): Promise<number> {
  return db.oTAMessage.count({
    where: {
      tenantId,
      propertyId,
      status: 'unread',
      direction: 'inbound',
    },
  });
}

/**
 * List messages with filters
 */
export async function listMessages(
  tenantId: string,
  propertyId: string,
  options?: {
    channelName?: string;
    status?: string;
    unreadOnly?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ messages: OTAMessage[]; total: number }> {
  const where: Record<string, unknown> = {
    tenantId,
    propertyId,
  };

  if (options?.channelName) {
    where.channelName = options.channelName;
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.unreadOnly) {
    where.status = 'unread';
    where.direction = 'inbound';
  }
  if (options?.priority) {
    where.priority = options.priority;
  }
  if (options?.startDate) {
    where.receivedAt = { ...(where.receivedAt as Record<string, unknown> || {}), gte: new Date(options.startDate) };
  }
  if (options?.endDate) {
    where.receivedAt = { ...(where.receivedAt as Record<string, unknown> || {}), lte: new Date(options.endDate) };
  }
  if (options?.search) {
    where.OR = [
      { guestName: { contains: options.search } },
      { subject: { contains: options.search } },
      { body: { contains: options.search } },
    ];
  }

  const [messages, total] = await Promise.all([
    db.oTAMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    db.oTAMessage.count({ where }),
  ]);

  return {
    messages: messages.map(mapMessageToInterface),
    total,
  };
}

// ============================================
// HELPERS
// ============================================

function mapMessageToInterface(msg: {
  id: string;
  tenantId: string;
  propertyId: string;
  channelName: string;
  reservationId: string;
  guestName: string;
  subject: string;
  body: string;
  direction: string;
  status: string;
  priority: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  bookingRef?: string | null;
  channelMessageId?: string | null;
  receivedAt: Date;
  repliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OTAMessage {
  return {
    id: msg.id,
    tenantId: msg.tenantId,
    propertyId: msg.propertyId,
    channelName: msg.channelName,
    reservationId: msg.reservationId,
    guestName: msg.guestName,
    subject: msg.subject,
    body: msg.body,
    direction: msg.direction as 'inbound' | 'outbound',
    status: msg.status as 'unread' | 'read' | 'replied' | 'archived',
    priority: msg.priority as 'normal' | 'high' | 'urgent',
    guestEmail: msg.guestEmail || undefined,
    guestPhone: msg.guestPhone || undefined,
    bookingRef: msg.bookingRef || undefined,
    channelMessageId: msg.channelMessageId || undefined,
    receivedAt: msg.receivedAt,
    repliedAt: msg.repliedAt || undefined,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}
