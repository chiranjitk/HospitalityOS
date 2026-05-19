/**
 * Pre-Arrival WiFi Delivery Scheduler
 *
 * Cron Job #5 for StaySuite HospitalityOS.
 *
 * Scans all enabled WiFiPreArrivalConfig records, identifies confirmed bookings
 * whose check-in date falls within the configured delivery window, generates
 * WiFi credentials (when autoGenerateCreds is enabled), queues notification
 * records (email/SMS) in pending state, and marks bookings as preArrivalSent
 * to prevent duplicate delivery.
 *
 * IMPORTANT: This service only QUEUES the delivery. The actual send is handled
 * by the existing /api/wifi/pre-arrival/send route (or a separate notification
 * worker that processes pending NotificationLog records).
 *
 * Usage:
 *   import { processPreArrivalDelivery } from '@/lib/wifi/services/pre-arrival-scheduler';
 *   const result = await processPreArrivalDelivery();
 *   // { processed: number; credentialsGenerated: number; notificationsQueued: number }
 */

import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

// ─── Return Type ────────────────────────────────────────────────────

export interface PreArrivalDeliveryResult {
  processed: number;
  credentialsGenerated: number;
  notificationsQueued: number;
}

// ─── Password Generator (lightweight, no confusing chars) ───────────

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// ─── Core Logic ─────────────────────────────────────────────────────

/**
 * Process pre-arrival WiFi delivery for all enabled properties.
 *
 * Algorithm:
 *  1. Fetch every enabled WiFiPreArrivalConfig.
 *  2. For each config, build a delivery window:
 *       windowStart = NOW()
 *       windowEnd   = NOW() + hoursBeforeArrival hours
 *  3. Query confirmed bookings whose checkIn falls inside the window and
 *     that have not yet been sent (preArrivalSent is false or null).
 *  4. For each matching booking (defensive try/catch per booking):
 *     a. If autoGenerateCreds → create a WiFiUser record.
 *     b. If sendEmail and guest has email → create a pending NotificationLog (email).
 *     c. If sendSms   and guest has phone → create a pending NotificationLog (sms).
 *     d. Mark booking.preArrivalSent = true.
 *  5. Return aggregate counts.
 */
export async function processPreArrivalDelivery(): Promise<PreArrivalDeliveryResult> {
  const result: PreArrivalDeliveryResult = {
    processed: 0,
    credentialsGenerated: 0,
    notificationsQueued: 0,
  };

  try {
    // ── Step 1: Fetch all enabled pre-arrival configs ─────────────────
    const configs = await db.wiFiPreArrivalConfig.findMany({
      where: { enabled: true },
    });

    if (configs.length === 0) {
      console.log('[PreArrivalScheduler] No enabled pre-arrival configs found — nothing to process.');
      return result;
    }

    console.log(`[PreArrivalScheduler] Found ${configs.length} enabled pre-arrival config(s).`);

    const now = new Date();

    // ── Step 2-4: Process each config ────────────────────────────────
    for (const config of configs) {
      try {
        // Calculate delivery window
        const windowStart = now;
        const windowEnd = new Date(now.getTime() + config.hoursBeforeArrival * 60 * 60 * 1000);

        console.log(
          `[PreArrivalScheduler] Processing property ${config.propertyId} (tenant ${config.tenantId}): ` +
          `window = ${windowStart.toISOString()} .. ${windowEnd.toISOString()}, ` +
          `hoursBeforeArrival = ${config.hoursBeforeArrival}`,
        );

        // ── Step 3: Find eligible bookings ────────────────────────────
        const bookings = await db.booking.findMany({
          where: {
            tenantId: config.tenantId,
            propertyId: config.propertyId,
            status: 'confirmed',
            checkIn: {
              gte: windowStart,
              lte: windowEnd,
            },
            preArrivalSent: false,
          },
          include: {
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (bookings.length === 0) {
          console.log(`[PreArrivalScheduler] No eligible bookings for property ${config.propertyId}.`);
          continue;
        }

        console.log(`[PreArrivalScheduler] Found ${bookings.length} eligible booking(s) for property ${config.propertyId}.`);

        // ── Step 4: Process each booking (defensive — one failure must not stop all) ──
        for (const booking of bookings) {
          try {
            await processBooking(booking, config, result);
          } catch (bookingError) {
            console.error(
              `[PreArrivalScheduler] Error processing booking ${booking.id} ` +
              `(confirmation: ${booking.confirmationCode}):`,
              bookingError,
            );
            // Continue with next booking
          }
        }
      } catch (configError) {
        console.error(
          `[PreArrivalScheduler] Error processing config for property ${config.propertyId}:`,
          configError,
        );
        // Continue with next config
      }
    }
  } catch (error) {
    console.error('[PreArrivalScheduler] Unhandled error in processPreArrivalDelivery:', error);
  }

  console.log(
    `[PreArrivalScheduler] Completed: processed=${result.processed}, ` +
    `credentialsGenerated=${result.credentialsGenerated}, ` +
    `notificationsQueued=${result.notificationsQueued}`,
  );

  return result;
}

// ─── Per-Booking Processing ─────────────────────────────────────────

/**
 * Process a single booking:
 *  - Generate WiFi credentials if configured
 *  - Queue pending notifications (email + SMS)
 *  - Mark booking as preArrivalSent
 */
async function processBooking(
  booking: {
    id: string;
    tenantId: string;
    propertyId: string;
    confirmationCode: string;
    checkIn: Date;
    checkOut: Date;
    primaryGuest: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    };
    property: {
      id: string;
      name: string;
    };
  },
  config: {
    tenantId: string;
    propertyId: string;
    autoGenerateCreds: boolean;
    sendEmail: boolean;
    sendSms: boolean;
    planId: string | null;
  },
  result: PreArrivalDeliveryResult,
): Promise<void> {
  const guest = booking.primaryGuest;
  const property = booking.property;
  const wifiUsername = `guest_${guest.firstName.toLowerCase().replace(/[^a-z]/g, '')}_${booking.confirmationCode.toLowerCase()}`;

  // ── 4a: Generate WiFi credentials ─────────────────────────────────
  if (config.autoGenerateCreds) {
    try {
      // Check if a WiFi user already exists for this booking (avoid duplicates)
      const existingUser = await db.wiFiUser.findFirst({
        where: {
          bookingId: booking.id,
          status: 'active',
        },
      });

      if (!existingUser) {
        // Build a unique username
        let finalUsername = wifiUsername;
        let counter = 1;
        while (await db.wiFiUser.findUnique({ where: { username: finalUsername } })) {
          finalUsername = `${wifiUsername}${counter}`;
          counter++;
        }

        const password = generatePassword();

        // Determine validity from plan (if configured) or booking dates
        const validFrom = new Date();
        let validUntil = new Date(booking.checkOut);
        if (booking.checkOut <= validFrom) {
          validUntil.setDate(validUntil.getDate() + 1);
        }

        if (config.planId) {
          const plan = await db.wiFiPlan.findUnique({
            where: { id: config.planId },
            select: { validityMinutes: true },
          });
          if (plan?.validityMinutes) {
            validUntil = new Date(validFrom.getTime() + plan.validityMinutes * 60 * 1000);
          }
        }

        await db.wiFiUser.create({
          data: {
            tenantId: config.tenantId,
            propertyId: config.propertyId,
            username: finalUsername,
            password,
            guestId: guest.id,
            bookingId: booking.id,
            userType: 'guest',
            planId: config.planId,
            validFrom,
            validUntil,
            status: 'active',
          },
        });

        result.credentialsGenerated++;
        console.log(
          `[PreArrivalScheduler] Generated WiFi credentials for booking ${booking.id}: ` +
          `username=${finalUsername}`,
        );
      } else {
        console.log(
          `[PreArrivalScheduler] WiFi user already exists for booking ${booking.id} (${existingUser.username}) — skipping credential generation.`,
        );
      }
    } catch (credError) {
      console.error(
        `[PreArrivalScheduler] Failed to generate credentials for booking ${booking.id}:`,
        credError,
      );
      // Don't abort — still queue notifications if possible
    }
  }

  // ── 4b: Queue email notification ──────────────────────────────────
  if (config.sendEmail && guest.email) {
    try {
      await db.notificationLog.create({
        data: {
          tenantId: config.tenantId,
          recipientType: 'guest',
          recipientId: guest.id,
          recipientEmail: guest.email,
          channel: 'email',
          subject: `[WiFi Pre-Arrival] Your WiFi Credentials for ${property.name}`,
          body: `WiFi credentials ready for ${guest.firstName} ${guest.lastName} — booking ${booking.confirmationCode}. Delivery will be triggered by the pre-arrival send worker.`,
          status: 'pending',
        },
      });
      result.notificationsQueued++;
    } catch (emailError) {
      console.error(
        `[PreArrivalScheduler] Failed to queue email notification for booking ${booking.id}:`,
        emailError,
      );
    }
  }

  // ── 4c: Queue SMS notification ────────────────────────────────────
  if (config.sendSms && guest.phone) {
    try {
      await db.notificationLog.create({
        data: {
          tenantId: config.tenantId,
          recipientType: 'guest',
          recipientId: guest.id,
          recipientPhone: guest.phone,
          channel: 'sms',
          subject: '[WiFi Pre-Arrival] WiFi Credentials',
          body: `WiFi credentials ready for ${guest.firstName} ${guest.lastName} — booking ${booking.confirmationCode}. Delivery will be triggered by the pre-arrival send worker.`,
          status: 'pending',
        },
      });
      result.notificationsQueued++;
    } catch (smsError) {
      console.error(
        `[PreArrivalScheduler] Failed to queue SMS notification for booking ${booking.id}:`,
        smsError,
      );
    }
  }

  // ── 4d: Mark booking as sent ──────────────────────────────────────
  await db.booking.update({
    where: { id: booking.id },
    data: { preArrivalSent: true },
  });

  result.processed++;
  console.log(
    `[PreArrivalScheduler] ✓ Booking ${booking.id} (${booking.confirmationCode}) processed and marked as preArrivalSent.`,
  );
}

// ─── Preview / Count Helpers ────────────────────────────────────────

/**
 * Count bookings that are currently within the delivery window across all
 * enabled properties but have NOT yet been sent.
 *
 * Used by the GET handler on the cron endpoint to provide visibility into
 * upcoming deliveries without actually processing them.
 */
export async function countUpcomingDeliveries(): Promise<{
  total: number;
  byProperty: Array<{ propertyId: string; tenantId: string; hoursBeforeArrival: number; count: number }>;
}> {
  const configs = await db.wiFiPreArrivalConfig.findMany({
    where: { enabled: true },
    select: {
      tenantId: true,
      propertyId: true,
      hoursBeforeArrival: true,
    },
  });

  const now = new Date();
  let total = 0;
  const byProperty: Array<{ propertyId: string; tenantId: string; hoursBeforeArrival: number; count: number }> = [];

  for (const config of configs) {
    const windowEnd = new Date(now.getTime() + config.hoursBeforeArrival * 60 * 60 * 1000);

    const count = await db.booking.count({
      where: {
        tenantId: config.tenantId,
        propertyId: config.propertyId,
        status: 'confirmed',
        checkIn: {
          gte: now,
          lte: windowEnd,
        },
        preArrivalSent: false,
      },
    });

    if (count > 0) {
      byProperty.push({
        propertyId: config.propertyId,
        tenantId: config.tenantId,
        hoursBeforeArrival: config.hoursBeforeArrival,
        count,
      });
      total += count;
    }
  }

  return { total, byProperty };
}
