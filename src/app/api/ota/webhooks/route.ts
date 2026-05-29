import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { generateFolioNumber } from '@/lib/billing/number-generation';

// OTA Webhook Handler - Handles inbound reservations from Booking.com, Airbnb, Expedia

export interface OTAWebhookPayload {
  event_type: 'reservation_created' | 'reservation_modified' | 'reservation_cancelled';
  event_id: string;
  timestamp: string;
  data: {
    reservation_id: string;
    channel: 'booking_com' | 'airbnb' | 'expedia';
    property_id?: string;
    // Secondary identifiers used when property_id is absent (H-26)
    hotel_id?: string;
    vendor_id?: string;
    external_property_ref?: string;
    room_type_id?: string;
    guest: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      country?: string;
    };
    check_in: string;
    check_out: string;
    guests: number;
    total_amount: number;
    currency: string;
    special_requests?: string;
    status: string;
  };
}

// ----------------------------------------------
// Connection resolution (H-26: multi-tenant safe)
// ----------------------------------------------

type ResolvedConnection = {
  id: string;
  tenantId: string;
  channel: string;
  propertyId?: string | null;
  hotelId?: string | null;
  listingId?: string | null;
  apiSecret?: string | null;
  lastSyncAt?: Date | null;
  updatedAt?: Date | null;
};

type ResolutionResult =
  | { ok: true; connection: ResolvedConnection; method: string }
  | { ok: false; status: number; error: string };

/**
 * H-26: Resolve the correct ChannelConnection for an incoming OTA webhook.
 *
 * Resolution strategy (ordered by confidence):
 *   1. property_id present  → direct lookup (fastest, most reliable)
 *   2. property_id absent   → fetch ALL active connections for the channel,
 *      score each against secondary identifiers (hotel_id, vendor_id,
 *      external_property_ref), pick the highest-scoring match.
 *      Ties are broken by most-recently-active (lastSyncAt / updatedAt).
 *   3. No match at all      → return 404 instead of silently picking a
 *      random tenant's connection.
 */
async function resolveConnection(
  channel: OTAWebhookPayload['data']['channel'],
  payload: OTAWebhookPayload
): Promise<ResolutionResult> {
  const { data } = payload;
  const logPrefix = `[H-26][${channel}]`;

  // ------ Step 1: Direct lookup when property_id is provided ------
  if (data.property_id) {
    console.info(
      `${logPrefix} property_id present (${data.property_id}) — attempting direct lookup`
    );

    const direct = await db.channelConnection.findFirst({
      where: { channel, status: 'active', propertyId: data.property_id },
    });

    if (direct) {
      console.info(
        `${logPrefix} direct match found: connection=${direct.id}, tenant=${direct.tenantId}`
      );
      return {
        ok: true,
        connection: direct,
        method: 'direct_property_id',
      };
    }

    console.warn(
      `${logPrefix} property_id=${data.property_id} did not match any active connection — falling through to secondary resolution`
    );
  }

  // ------ Step 2: Secondary identifier resolution ------
  console.info(
    `${logPrefix} property_id absent (or direct lookup failed) — resolving via secondary identifiers. ` +
      `Secondary keys in payload: hotel_id=${data.hotel_id ?? '(none)'}, ` +
      `vendor_id=${data.vendor_id ?? '(none)'}, ` +
      `external_property_ref=${data.external_property_ref ?? '(none)'}`
  );

  const candidates = await db.channelConnection.findMany({
    where: { channel, status: 'active' },
    orderBy: { lastSyncAt: 'desc' },
  });

  if (candidates.length === 0) {
    console.warn(`${logPrefix} no active connections found for channel=${channel}`);
    return {
      ok: false,
      status: 400,
      error: `No active ${channel} channel connection configured`,
    };
  }

  console.info(
    `${logPrefix} found ${candidates.length} active connection(s) for channel — scoring…`
  );

  // Score each candidate against the secondary identifiers available.
  // A higher score = more secondary fields matched.
  interface ScoredCandidate {
    connection: ResolvedConnection;
    score: number;
    matchDetails: string[];
  }

  let best: ScoredCandidate | null = null;
  const matched: ScoredCandidate[] = [];

  for (const c of candidates) {
    let score = 0;
    const details: string[] = [];

    // Match hotel_id  ↔  connection.hotelId
    if (data.hotel_id && c.hotelId && data.hotel_id === c.hotelId) {
      score += 10;
      details.push('hotel_id=hotelId');
    }

    // Match vendor_id  ↔  connection.listingId
    if (data.vendor_id && c.listingId && data.vendor_id === c.listingId) {
      score += 10;
      details.push('vendor_id=listingId');
    }

    // Match external_property_ref  ↔  connection.hotelId or connection.listingId
    if (data.external_property_ref) {
      if (c.hotelId && data.external_property_ref === c.hotelId) {
        score += 8;
        details.push('external_property_ref=hotelId');
      }
      if (c.listingId && data.external_property_ref === c.listingId) {
        score += 8;
        details.push('external_property_ref=listingId');
      }
    }

    const scored: ScoredCandidate = { connection: c, score, matchDetails: details };

    console.info(
      `${logPrefix}   connection=${c.id} tenant=${c.tenantId} ` +
        `propertyId=${c.propertyId ?? '(none)'} hotelId=${c.hotelId ?? '(none)'} ` +
        `listingId=${c.listingId ?? '(none)'} → score=${score} [${details.join(', ') || 'no match'}]`
    );

    if (score > 0) {
      matched.push(scored);
    }

    if (!best || score > best.score) {
      best = scored;
    }
  }

  // ------ No secondary matches at all ------
  if (matched.length === 0) {
    console.error(
      `${logPrefix} NO connection matched any secondary identifier. ` +
        `Candidates: ${candidates.map((c) => c.id).join(', ')}. ` +
        `Refusing to process webhook — would risk assigning to wrong tenant.`
    );
    return {
      ok: false,
      status: 404,
      error:
        `No ${channel} connection matches the provided identifiers ` +
        `(hotel_id=${data.hotel_id ?? '∅'}, vendor_id=${data.vendor_id ?? '∅'}, ` +
        `external_property_ref=${data.external_property_ref ?? '∅'}). ` +
        `Webhook cannot be routed — verify the channel mapping configuration.`,
    };
  }

  // ------ Ambiguous: multiple candidates with same top score ------
  if (matched.length > 1) {
    const topScore = best!.score;
    const ties = matched.filter((m) => m.score === topScore);

    if (ties.length > 1) {
      console.warn(
        `${logPrefix} AMBIGUOUS: ${ties.length} connections scored ${topScore}. ` +
          `Connections: ${ties.map((t) => `id=${t.connection.id} tenant=${t.connection.tenantId}`).join(', ')}. ` +
          `Picking the most recently active (lastSyncAt).`
      );
    }
  }

  // Break ties by most recently synced, then by updatedAt
  matched.sort((a, b) => {
    const aTime = a.connection.lastSyncAt?.getTime() ?? a.connection.updatedAt?.getTime() ?? 0;
    const bTime = b.connection.lastSyncAt?.getTime() ?? b.connection.updatedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const winner = matched[0];
  console.info(
    `${logPrefix} RESOLVED: connection=${winner.connection.id} tenant=${winner.connection.tenantId} ` +
      `score=${winner.score} method=secondary_identifiers [${winner.matchDetails.join(', ')}]`
  );

  return {
    ok: true,
    connection: winner.connection,
    method: 'secondary_identifiers',
  };
}

// Verify webhook signature using HMAC-SHA256
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Generate idempotency key
function generateIdempotencyKey(channel: string, eventId: string): string {
  return `${channel}:${eventId}`;
}

// POST /api/ota/webhooks - Handle OTA webhooks (unified endpoint)
export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.text();
    let payload: OTAWebhookPayload;
    
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Get signature from header
    const signature = request.headers.get('x-ota-signature') || 
                      request.headers.get('x-booking-signature') ||
                      request.headers.get('x-airbnb-signature') ||
                      request.headers.get('x-expedia-signature') ||
                      request.headers.get('x-hub-signature-256')?.replace(/^sha256=/i, '') || '';
    const channel = payload.data.channel;

    // H-26: Multi-tenant safe connection resolution.
    // When property_id is present → direct lookup.
    // When absent → resolve via secondary identifiers (hotel_id, vendor_id, etc.),
    // never fall back to a bare findFirst that could match the wrong tenant.
    const resolution = await resolveConnection(channel, payload);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.error }, { status: resolution.status });
    }
    const connection = resolution.connection;
    console.info(
      `[H-26][${channel}] Connection resolved via "${resolution.method}" for connection=${connection.id} tenant=${connection.tenantId}`
    );

    // SECURITY: Always verify webhook signatures (not just in production)
    const webhookSecret = connection.apiSecret || process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`];
    if (!webhookSecret) {
      return NextResponse.json({ error: 'No webhook secret configured' }, { status: 500 });
    }
    if (!verifySignature(rawPayload, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Check idempotency
    const idempotencyKey = generateIdempotencyKey(channel, payload.event_id);
    const existingLog = await db.channelSyncLog.findFirst({
      where: {
        connectionId: connection.id,
        correlationId: idempotencyKey,
      },
    });

    if (existingLog) {
      let bookingId = 'unknown';
      try {
        const responseData = JSON.parse(existingLog.responsePayload || '{}');
        bookingId = responseData.bookingId || 'unknown';
      } catch {
        // Keep default
      }
      
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        bookingId,
      });
    }

    // Process based on event type
    let booking;
    const tenantId = connection.tenantId;

    try {
      switch (payload.event_type) {
        case 'reservation_created':
          booking = await handleReservationCreated(tenantId, connection, payload);
          break;
        case 'reservation_modified':
          booking = await handleReservationModified(tenantId, connection, payload);
          break;
        case 'reservation_cancelled':
          booking = await handleReservationCancelled(tenantId, connection, payload);
          break;
        default:
          return NextResponse.json(
            { error: 'Unknown event type' },
            { status: 400 }
          );
      }
    } catch (handlerError) {
      // Push to dead letter queue on processing failure
      const dlqEntry = await db.channelDeadLetterQueue.create({
        data: {
          tenantId,
          propertyId: connection.propertyId || undefined,
          channelCode: channel,
          operation: 'webhook_unified',
          payload: rawPayload,
          error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
          attemptCount: 0,
          // Schedule first cron-driven retry 1 minute from now;
          // the immediate setTimeout retry below handles transient failures.
          nextRetryAt: new Date(Date.now() + 1 * 60 * 1000),
        },
      });

      // H-27 FIX: Attempt immediate retry for transient failures.
      // Retry once after a short delay for errors that may be transient
      // (DB lock, temporary unavailability). After retry, if still fails,
      // the entry remains in DLQ for manual inspection.
      if (dlqEntry) {
        setTimeout(async () => {
          try {
            let retryPayload: OTAWebhookPayload;
            try {
              retryPayload = JSON.parse(rawPayload);
            } catch { return; }

            switch (retryPayload.event_type) {
              case 'reservation_created':
                await handleReservationCreated(tenantId, connection, retryPayload);
                break;
              case 'reservation_modified':
                await handleReservationModified(tenantId, connection, retryPayload);
                break;
              case 'reservation_cancelled':
                await handleReservationCancelled(tenantId, connection, retryPayload);
                break;
            }

            // Retry succeeded - remove from DLQ
            await db.channelDeadLetterQueue.delete({ where: { id: dlqEntry.id } });
            console.log(`[OTA DLQ] Auto-retry succeeded for entry ${dlqEntry.id}`);
          } catch (retryError) {
            console.warn(`[OTA DLQ] Auto-retry failed for entry ${dlqEntry.id}:`, retryError);
            await db.channelDeadLetterQueue.update({
              where: { id: dlqEntry.id },
              data: { attemptCount: { increment: 1 } },
            });
          }
        }, 2000);
      }

      throw handlerError;
    }

    // Log sync with idempotency key
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: 'bookings',
        direction: 'inbound',
        status: 'success',
        correlationId: idempotencyKey,
        requestPayload: rawPayload,
        responsePayload: JSON.stringify({ bookingId: booking.id }),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'channel_manager',
        action: `ota_${payload.event_type}`,
        entityType: 'booking',
        entityId: booking.id,
        newValue: JSON.stringify({
          channel,
          reservationId: payload.data.reservation_id,
          guest: payload.data.guest,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      confirmationCode: booking.confirmationCode,
    });
  } catch (error) {
    console.error('OTA webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// RESERVATION HANDLERS
// ============================================

export async function handleReservationCreated(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string; propertyId?: string | null },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  return await db.$transaction(async (tx) => {
    // Find or create guest
    let guest = data.guest.email ? await tx.guest.findFirst({
      where: { email: data.guest.email, tenantId },
    }) : null;

    if (!guest) {
      guest = await tx.guest.create({
        data: {
          tenantId,
          firstName: data.guest.first_name,
          lastName: data.guest.last_name,
          email: data.guest.email,
          phone: data.guest.phone,
          nationality: data.guest.country,
          source: data.channel,
          kycStatus: 'pending',
        },
      });
    }

    // Find room type mapping
    const mapping = await tx.channelMapping.findFirst({
      where: {
        connectionId: connection.id,
        externalRoomId: data.room_type_id,
      },
      include: { roomType: true },
    });

    if (!mapping) {
      throw new Error('Room type mapping not found');
    }

    // Validate dates
    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new Error(`Invalid booking dates: check_in=${data.check_in}, check_out=${data.check_out}`);
    }
    if (checkIn >= checkOut) {
      throw new Error('Invalid booking: check_out must be after check_in');
    }

    // Check for available rooms
    const bookedRoomIds = await tx.booking.findMany({
      where: {
        tenantId,
        roomTypeId: mapping.roomTypeId,
        status: { notIn: ['cancelled', 'no_show'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { roomId: true },
    });

    const bookedIds = bookedRoomIds.map(b => b.roomId).filter((id): id is string => id !== null);

    const availableRoom = await tx.room.findFirst({
      where: {
        roomTypeId: mapping.roomTypeId,
        id: { notIn: bookedIds },
        status: 'available',
      },
    });

    // Calculate nights and room rate
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const roomRate = data.total_amount / nights;

    // Generate confirmation code
    const confirmationCode = `OTA-${Date.now().toString(36).toUpperCase()}`;

    // Create booking
    const booking = await tx.booking.create({
      data: {
        tenantId,
        propertyId: mapping.roomType.propertyId,
        confirmationCode,
        primaryGuestId: guest.id,
        roomId: availableRoom?.id,
        roomTypeId: mapping.roomTypeId,
        checkIn,
        checkOut,
        adults: data.guests,
        children: 0,
        roomRate,
        taxes: 0,
        fees: 0,
        totalAmount: data.total_amount,
        currency: data.currency || 'USD',
        source: data.channel,
        externalRef: data.reservation_id,
        channelId: connection.id,
        status: 'confirmed',
        specialRequests: data.special_requests,
      },
    });

    // M-34: Create a folio for the OTA booking so charges can be posted to it
    // OTA bookings without folios would have no way to receive posted charges.
    await tx.folio.create({
      data: {
        tenantId,
        propertyId: mapping.roomType.propertyId,
        bookingId: booking.id,
        guestId: guest.id,
        folioNumber: generateFolioNumber('OTA'),
        currency: data.currency || 'USD',
        status: 'open',
      },
    });

    return booking;
  });
}

export async function handleReservationModified(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId,
      externalRef: data.reservation_id,
    },
  });

  if (!existingBooking) {
    return handleReservationCreated(tenantId, connection, payload);
  }

  // Validate dates
  const checkIn = new Date(data.check_in);
  const checkOut = new Date(data.check_out);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkIn >= checkOut) {
    throw new Error(`Invalid booking dates: check_in=${data.check_in}, check_out=${data.check_out}`);
  }

  // SECURITY FIX: Use transaction for atomic modification
  return await db.$transaction(async (tx) => {
    return await tx.booking.update({
      where: { id: existingBooking.id },
      data: {
        checkIn,
        checkOut,
        adults: data.guests,
        totalAmount: data.total_amount,
        specialRequests: data.special_requests,
        updatedAt: new Date(),
      },
    });
  });
}

export async function handleReservationCancelled(
  tenantId: string,
  connection: { id: string; channel: string; tenantId: string },
  payload: OTAWebhookPayload
) {
  const { data } = payload;

  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId,
      externalRef: data.reservation_id,
    },
  });

  if (!existingBooking) {
    return { id: 'not_found', confirmationCode: 'N/A' } as any;
  }

  // SECURITY FIX: Use transaction for atomic cancellation
  return await db.$transaction(async (tx) => {
    return await tx.booking.update({
      where: { id: existingBooking.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled via OTA webhook',
      },
    });
  });
}

// GET /api/ota/webhooks - List recent webhook events (requires auth)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { tenantId: true, status: true } } },
  });

  if (!session || session.expiresAt < new Date() || session.user.status !== 'active') {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  const tenantId = session.user.tenantId;

  const logs = await db.channelSyncLog.findMany({
    where: {
      connection: { tenantId },
      syncType: 'bookings',
      direction: 'inbound',
    },
    include: {
      connection: {
        select: {
          displayName: true,
          channel: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ 
    success: true,
    logs: logs.map(log => ({
      ...log,
      channelName: log.connection.displayName,
      channelType: log.connection.channel,
    }))
  });
}
