import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// OTA Webhook Handler - Handles inbound reservations from Booking.com, Airbnb, Expedia

interface OTAWebhookPayload {
  event_type: 'reservation_created' | 'reservation_modified' | 'reservation_cancelled';
  event_id: string;
  timestamp: string;
  data: {
    reservation_id: string;
    channel: 'booking_com' | 'airbnb' | 'expedia';
    property_id?: string;
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

    // Get channel connection to verify signature
    // H-26: Include propertyId filter from the webhook payload to ensure we find the
    // correct connection when multiple tenants use the same channel (e.g., Booking.com).
    // Without this, findFirst could return the wrong tenant's connection.
    const connection = await db.channelConnection.findFirst({
      where: {
        channel,
        status: 'active',
        ...(payload.data.property_id ? { propertyId: payload.data.property_id } : {}),
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Channel not configured or inactive' },
        { status: 400 }
      );
    }

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
      await db.channelDeadLetterQueue.create({
        data: {
          tenantId,
          propertyId: connection.propertyId || undefined,
          channelCode: channel,
          operation: 'webhook_unified',
          payload: rawPayload,
          error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
        },
      });
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

async function handleReservationCreated(
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

    return booking;
  });
}

async function handleReservationModified(
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

async function handleReservationCancelled(
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
