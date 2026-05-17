import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota';

// ============================================
// CHANNEL-SPECIFIC EVENT TYPE MAPPING
// ============================================

// Map various OTA-specific event headers/payload fields to normalized event types
function resolveEventType(channel: string, body: Record<string, unknown>, headers: Record<string, string>): string {
  // Check explicit event type headers per channel
  const headerMap: Record<string, string[]> = {
    booking_com: ['x-booking-event', 'x-bcom-event'],
    expedia: ['x-expedia-event', 'x-epc-event'],
    airbnb: ['x-airbnb-event', 'x-anb-event'],
  };

  for (const headerKey of headerMap[channel] || []) {
    const val = headers[headerKey] || headers[headerKey.toLowerCase()];
    if (val) return val.toLowerCase();
  }

  // Fallback to payload fields
  const payloadType = (body.event_type || body.eventType || body.type || body.action || '') as string;
  if (payloadType) return payloadType.toLowerCase().replace(/\./g, '_');

  // Heuristic: detect from payload content
  if (body.reservation || body.reservation_id || body.booking_id || body.bookingId) {
    const status = (body.status || body.reservation_status || '').toString().toLowerCase();
    if (status.includes('cancel')) return 'booking_cancelled';
    if (status.includes('modif') || status.includes('change')) return 'booking_modified';
    return 'booking_created';
  }

  return 'unknown';
}

// Normalize event type to one of our known types
function normalizeEventType(raw: string): string {
  const mapping: Record<string, string> = {
    // Booking.com
    'reservation_created': 'booking_created',
    'reservation_modified': 'booking_modified',
    'reservation_cancelled': 'booking_cancelled',
    'booking_created': 'booking_created',
    'booking_modified': 'booking_modified',
    'booking_cancelled': 'booking_cancelled',
    'no_show': 'booking_no_show',
    'booking_no_show': 'booking_no_show',
    'new_reservation': 'booking_created',
    'modify_reservation': 'booking_modified',
    'cancel_reservation': 'booking_cancelled',
    // Expedia
    'itinerary_create': 'booking_created',
    'itinerary_modify': 'booking_modified',
    'itinerary_cancel': 'booking_cancelled',
    // Airbnb
    'reservation_created': 'booking_created',
    'reservation_updated': 'booking_modified',
    'reservation_canceled': 'booking_cancelled',
    'reservation_accepted': 'booking_created',
    'reservation_declined': 'booking_cancelled',
    // Generic
    'create': 'booking_created',
    'modify': 'booking_modified',
    'cancel': 'booking_cancelled',
  };
  return mapping[raw] || raw;
}

// ============================================
// MAIN HANDLER
// ============================================

// POST /api/ota/webhooks/[channel] - Handle OTA webhooks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;
  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  const headers = Object.fromEntries(request.headers.entries());

  try {
    // Find active connections for this channel
    const connections = await db.channelConnection.findMany({
      where: { channel, status: 'active' },
    });

    // ── Single-gateway fallback routing ──
    // 1. If only 1 connection matches → use it
    // 2. If multiple connections match, try to identify the correct one by matching payload property ID
    // 3. If still ambiguous and there's only 1 active gateway → use that as fallback
    // 4. If still ambiguous → log a warning and process for the first match only (not all)

    let selectedConnections = connections;

    if (connections.length > 1) {
      // Step 2: Try to narrow by property ID from payload
      const payloadPropertyId = (body.propertyId || body.property_id || body.hotelId || body.hotel_id) as string | undefined;

      if (payloadPropertyId) {
        const narrowed = connections.filter(c => c.propertyId === payloadPropertyId);
        if (narrowed.length > 0) {
          selectedConnections = narrowed;
        }
      }

      // Step 3: If still ambiguous and there's only 1 active gateway, use that as fallback
      if (selectedConnections.length > 1) {
        // Look for a single connection that has a hotelId set (acts as the gateway/master connection)
        const withHotelId = selectedConnections.filter(c => c.hotelId !== null);
        if (withHotelId.length === 1) {
          selectedConnections = [withHotelId[0]];
        } else {
          // No clear gateway — if only 1 connection has a non-null propertyId, prefer that
          const withProperty = selectedConnections.filter(c => c.propertyId !== null);
          if (withProperty.length === 1) {
            selectedConnections = [withProperty[0]];
          }
        }
      }

      // Step 4: If still ambiguous → log a warning and use first match only
      if (selectedConnections.length > 1) {
        console.warn(
          `[Webhook:${channel}] Ambiguous routing: ${selectedConnections.length} connections match. ` +
          `Using first match (${selectedConnections[0].id}) to avoid duplicate processing. ` +
          `Connection IDs: ${selectedConnections.map(c => c.id).join(', ')}`
        );
        selectedConnections = [selectedConnections[0]];
      }
    }

    if (selectedConnections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active connections for this channel' },
        { status: 404 }
      );
    }

    // ---- HMAC-SHA256 Signature Verification ----
    await verifyWebhookSignature(channel, rawBody, headers, selectedConnections);

    // Get the appropriate OTA client for event parsing
    const client = OTAClientFactory.createClient(channel);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Unknown channel type' },
        { status: 400 }
      );
    }

    // Process webhook via the OTA client (normalizes payload per channel)
    const result = await client.processWebhook(body, headers);

    // Determine the normalized event type
    const rawEventType = resolveEventType(channel, body, headers);
    const eventType = normalizeEventType(rawEventType);

    // Log the incoming webhook (use the selected connection)
    await logWebhookEvent(selectedConnections[0], channel, rawBody, headers, eventType, result);

    // Handle the event (single connection only — no duplicate processing)
    if (result.success && result.data) {
      const eventData = result.data as Record<string, unknown>;
      await routeWebhookEvent(channel, eventType, eventData, selectedConnections);
    }

    return NextResponse.json(result.response);
  } catch (error) {
    console.error(`[Webhook:${channel}] Processing error:`, error);

    // Push to dead letter queue for retry
    try {
      const connection = await db.channelConnection.findFirst({
        where: { channel, status: 'active' },
      });
      if (connection) {
        await db.channelDeadLetterQueue.create({
          data: {
            tenantId: connection.tenantId,
            propertyId: connection.propertyId || undefined,
            channelCode: channel,
            operation: 'webhook',
            payload: rawBody,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch (dlqError) {
      console.error(`[Webhook:${channel}] Failed to push to dead letter queue:`, dlqError);
    }

    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET /api/ota/webhooks/[channel] - Webhook verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Handle verification challenges from different OTAs
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token && challenge) {
    const expectedToken = process.env[`${channel.toUpperCase()}_VERIFY_TOKEN`];
    if (expectedToken) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
          return new NextResponse(challenge, { status: 200 });
        }
      } catch { /* ignore */ }
      return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
    }
  }

  // Return webhook URL info
  const webhookUrl = `/api/ota/webhooks/${channel}`;
  return NextResponse.json({
    channel,
    webhookUrl,
    message: 'Webhook endpoint active',
  });
}

// ============================================
// SIGNATURE VERIFICATION
// ============================================

async function verifyWebhookSignature(
  channel: string,
  rawBody: string,
  headers: Record<string, string>,
  connections: { id: string; apiSecret?: string | null }[]
): Promise<void> {
  // Collect possible signature headers per channel
  const sigHeaders = [
    'x-signature',
    'x-ota-signature',
    `x-${channel}-signature`,
    'x-hub-signature-256',
    'x-webhook-signature',
  ];

  let signature = '';
  for (const h of sigHeaders) {
    const val = headers[h] || headers[h.toUpperCase()];
    if (val) {
      // Strip "sha256=" prefix if present (common in hub signatures)
      signature = val.replace(/^sha256=/i, '');
      break;
    }
  }

  if (signature) {
    let signatureValid = false;
    for (const conn of connections) {
      if (!conn.apiSecret) continue;
      const expectedSig = crypto
        .createHmac('sha256', conn.apiSecret)
        .update(rawBody)
        .digest('hex');
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) continue;
      } catch {
        continue;
      }
      signatureValid = true;
      break;
    }
    if (!signatureValid) {
      console.warn(`[Webhook] Invalid signature for channel ${channel}`);
      throw new WebhookAuthError('Invalid signature');
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(`[Webhook] Missing signature for channel ${channel} in production mode`);
    throw new WebhookAuthError('Missing required signature header');
  } else {
    console.warn(`[Webhook] Unsigned request for channel ${channel} (dev mode - allowing)`);
  }
}

class WebhookAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookAuthError';
  }
}

// ============================================
// WEBHOOK LOGGING
// ============================================

async function logWebhookEvent(
  connection: { id: string },
  channel: string,
  rawBody: string,
  headers: Record<string, string>,
  eventType: string,
  result: { success: boolean }
) {
  await db.channelSyncLog.create({
    data: {
      connectionId: connection.id,
      syncType: 'bookings',
      direction: 'inbound',
      status: result.success ? 'success' : 'failed',
      requestPayload: JSON.stringify({
        contentType: headers['content-type'],
        userAgent: headers['user-agent'],
        signaturePresent: !!(headers['x-signature'] || headers['x-ota-signature'] || headers['x-hub-signature-256']),
      }),
      responsePayload: rawBody.length > 10000 ? rawBody.substring(0, 10000) + '...[truncated]' : rawBody,
      correlationId: `webhook-${channel}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}-${Date.now()}`,
    },
  });
}

// ============================================
// EVENT ROUTING
// ============================================

async function routeWebhookEvent(
  channel: string,
  eventType: string,
  eventData: Record<string, unknown>,
  connections: { id: string; tenantId: string; propertyId?: string | null }[]
): Promise<void> {
  // Try to process for all matching connections
  for (const connection of connections) {
    try {
      switch (eventType) {
        case 'booking_created':
          await handleBookingCreated(channel, connection, eventData);
          break;
        case 'booking_modified':
          await handleBookingModified(channel, connection, eventData);
          break;
        case 'booking_cancelled':
          await handleBookingCancelled(channel, connection, eventData);
          break;
        case 'booking_no_show':
          await handleBookingNoShow(channel, connection, eventData);
          break;
        default:
          console.log(`[Webhook:${channel}] Unhandled event type: ${eventType}`);
      }
    } catch (handlerError) {
      console.error(`[Webhook:${channel}] Handler error for ${eventType} on connection ${connection.id}:`, handlerError);
    }
  }
}

// ============================================
// BOOKING EVENT HANDLERS
// ============================================

async function handleBookingCreated(channel: string, connection: { id: string; tenantId: string; propertyId?: string | null }, eventData: Record<string, unknown>): Promise<void> {
  const reservationId = extractReservationId(eventData);
  if (!reservationId) {
    console.error(`[Webhook:${channel}] No reservation ID in booking.created event`);
    return;
  }

  // Check for existing booking (idempotency)
  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (existingBooking) return;

  // Extract guest data from event
  const guestData = extractGuestData(eventData);
  const dates = extractDates(eventData);
  const pricing = extractPricing(eventData);
  const guests = extractGuestCounts(eventData);
  const room = extractRoomData(eventData);

  // Validate dates
  if (!dates.checkIn || !dates.checkOut) {
    console.error(`[Webhook:${channel}] Missing dates for booking ${reservationId}`);
    return;
  }
  const checkIn = new Date(dates.checkIn);
  const checkOut = new Date(dates.checkOut);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkIn >= checkOut) {
    console.error(`[Webhook:${channel}] Invalid dates for booking ${reservationId}: checkIn=${dates.checkIn}, checkOut=${dates.checkOut}`);
    return;
  }

  // Find or create guest
  let guestId: string | null = null;
  if (guestData.email) {
    let guest = await db.guest.findFirst({
      where: { tenantId: connection.tenantId, email: guestData.email },
    });

    if (!guest) {
      guest = await db.guest.create({
        data: {
          tenantId: connection.tenantId,
          firstName: guestData.firstName || 'Unknown',
          lastName: guestData.lastName || 'Guest',
          email: guestData.email,
          phone: guestData.phone,
          nationality: guestData.country,
          source: channel,
          kycStatus: 'pending',
        },
      });
    }
    guestId = guest.id;
  }

  if (!guestId) {
    console.error(`[Webhook:${channel}] Cannot create booking ${reservationId}: no guest email`);
    return;
  }

  // Look up room type mapping
  const mapping = await db.channelMapping.findFirst({
    where: {
      connectionId: connection.id,
      externalRoomId: room?.externalRoomId || room?.roomTypeId || '',
    },
    include: {
      connection: { select: { propertyId: true } },
    },
  });

  // Find available room
  let roomId: string | undefined;
  if (mapping?.roomTypeId) {
    const bookedRoomIds = await db.booking.findMany({
      where: {
        tenantId: connection.tenantId,
        roomTypeId: mapping.roomTypeId,
        status: { notIn: ['cancelled', 'no_show'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { roomId: true },
    });

    const bookedIds = bookedRoomIds.map(b => b.roomId).filter((id): id is string => id !== null);

    const availableRoom = await db.room.findFirst({
      where: {
        roomTypeId: mapping.roomTypeId,
        id: { notIn: bookedIds },
        status: 'available',
      },
    });

    if (availableRoom) {
      roomId = availableRoom.id;
    }
  }

  const confirmationCode = `OTA-${Date.now().toString(36).toUpperCase()}`;
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const roomRate = pricing.totalAmount > 0 ? Math.round(pricing.totalAmount / nights * 100) / 100 : 0;

  await db.booking.create({
    data: {
      tenantId: connection.tenantId,
      propertyId: mapping?.connection.propertyId || connection.propertyId || '',
      confirmationCode,
      externalRef: reservationId,
      primaryGuestId: guestId,
      roomId,
      roomTypeId: mapping?.roomTypeId || '',
      checkIn,
      checkOut,
      adults: guests.adults,
      children: guests.children,
      roomRate,
      taxes: pricing.taxes,
      fees: pricing.fees,
      discount: pricing.discount,
      totalAmount: pricing.totalAmount,
      currency: pricing.currency || 'USD',
      source: channel,
      channelId: connection.id,
      status: 'confirmed',
      specialRequests: eventData.specialRequests as string | undefined,
      notes: eventData.notes as string | undefined,
    },
  });

  console.log(`[Webhook:${channel}] Created booking ${confirmationCode} for reservation ${reservationId}`);
}

async function handleBookingModified(channel: string, connection: { id: string; tenantId: string }, eventData: Record<string, unknown>): Promise<void> {
  const reservationId = extractReservationId(eventData);
  if (!reservationId) return;

  const booking = await db.booking.findFirst({
    where: { tenantId: connection.tenantId, externalRef: reservationId },
  });

  if (!booking) {
    // Treat as new booking if we don't have it yet
    await handleBookingCreated(channel, connection, eventData);
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  const dates = extractDates(eventData);
  const guests = extractGuestCounts(eventData);
  const pricing = extractPricing(eventData);

  if (dates.checkIn) {
    const d = new Date(dates.checkIn);
    if (!isNaN(d.getTime())) updateData.checkIn = d;
  }
  if (dates.checkOut) {
    const d = new Date(dates.checkOut);
    if (!isNaN(d.getTime())) updateData.checkOut = d;
  }
  if (guests.adults > 0) updateData.adults = guests.adults;
  if (guests.children > 0) updateData.children = guests.children;
  if (pricing.totalAmount > 0) updateData.totalAmount = pricing.totalAmount;
  if (pricing.roomRate > 0) updateData.roomRate = pricing.roomRate;

  if (eventData.specialRequests) updateData.specialRequests = eventData.specialRequests;
  if (eventData.notes) updateData.notes = eventData.notes;

  await db.booking.update({
    where: { id: booking.id },
    data: updateData,
  });

  console.log(`[Webhook:${channel}] Updated booking ${booking.confirmationCode} for reservation ${reservationId}`);
}

async function handleBookingCancelled(channel: string, connection: { id: string; tenantId: string }, eventData: Record<string, unknown>): Promise<void> {
  const reservationId = extractReservationId(eventData);
  if (!reservationId) return;

  const booking = await db.booking.findFirst({
    where: { tenantId: connection.tenantId, externalRef: reservationId },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: (eventData.cancellationReason as string) || 'Cancelled via OTA',
      updatedAt: new Date(),
    },
  });

  console.log(`[Webhook:${channel}] Cancelled booking ${booking.confirmationCode} for reservation ${reservationId}`);
}

async function handleBookingNoShow(channel: string, connection: { id: string; tenantId: string }, eventData: Record<string, unknown>): Promise<void> {
  const reservationId = extractReservationId(eventData);
  if (!reservationId) return;

  const booking = await db.booking.findFirst({
    where: { tenantId: connection.tenantId, externalRef: reservationId },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'no_show',
      updatedAt: new Date(),
    },
  });

  console.log(`[Webhook:${channel}] Marked booking ${booking.confirmationCode} as no-show for reservation ${reservationId}`);
}

// ============================================
// DATA EXTRACTION HELPERS
// ============================================

function extractReservationId(data: Record<string, unknown>): string | null {
  return (data.reservationId || data.reservation_id || data.bookingId || data.booking_id || data.id || data.externalBookingId || null) as string | null;
}

function extractGuestData(data: Record<string, unknown>): { firstName: string; lastName: string; email?: string; phone?: string; country?: string } {
  const guest = (data.guest || data.guest_data || data.customer || data.customer_data || {}) as Record<string, unknown>;
  return {
    firstName: (guest.firstName || guest.first_name || guest.guest_first_name || '') as string,
    lastName: (guest.lastName || guest.last_name || guest.guest_last_name || '') as string,
    email: (guest.email || guest.guest_email || data.email || null) as string | undefined,
    phone: (guest.phone || guest.guest_phone || data.phone || null) as string | undefined,
    country: (guest.country || guest.guest_country || guest.nationality || null) as string | undefined,
  };
}

function extractDates(data: Record<string, unknown>): { checkIn?: string; checkOut?: string } {
  const dates = (data.dates || data.dates_data || {}) as Record<string, unknown>;
  return {
    checkIn: (dates.checkIn || dates.check_in || dates.checkin_date || data.check_in || data.startDate || null) as string | undefined,
    checkOut: (dates.checkOut || dates.check_out || dates.checkout_date || data.check_out || data.endDate || null) as string | undefined,
  };
}

function extractPricing(data: Record<string, unknown>): { roomRate: number; taxes: number; fees: number; discount: number; totalAmount: number; currency: string } {
  const pricing = (data.pricing || data.pricing_data || data.rate || {}) as Record<string, unknown>;
  const totalAmount = (pricing.totalAmount || pricing.total_amount || pricing.total_price || data.total_amount || data.totalAmount || 0) as number;
  return {
    roomRate: (pricing.roomRate || pricing.room_rate || pricing.nightly_rate || data.roomRate || 0) as number,
    taxes: (pricing.taxes || pricing.tax || 0) as number,
    fees: (pricing.fees || pricing.fee || 0) as number,
    discount: (pricing.discount || 0) as number,
    totalAmount,
    currency: (pricing.currency || data.currency || 'USD') as string,
  };
}

function extractGuestCounts(data: Record<string, unknown>): { adults: number; children: number } {
  const guests = (data.guests || data.guests_data || data.occupancy || {}) as Record<string, unknown>;
  return {
    adults: (guests.adults || guests.num_adults || guests.adult_count || data.guests || data.adults || 1) as number,
    children: (guests.children || guests.num_children || guests.child_count || data.children || 0) as number,
  };
}

function extractRoomData(data: Record<string, unknown>): { externalRoomId?: string; roomTypeId?: string } {
  const room = (data.room || data.room_data || data.room_type || {}) as Record<string, unknown>;
  return {
    externalRoomId: (room.externalRoomId || room.room_id || room.room_type_id || room.id || null) as string | undefined,
    roomTypeId: (room.roomTypeId || room.internal_room_type_id || null) as string | undefined,
  };
}
