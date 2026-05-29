import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Cron: Waitlist Auto-Process
 *
 * POST /api/cron/waitlist-auto-process
 *   Scans all active properties and room types for waiting waitlist entries,
 *   then checks room availability and notifies guests when rooms become available.
 *
 *   Should be called by an external cron scheduler (e.g., cron-job.org,
 *   Vercel Cron, AWS EventBridge) every 5-15 minutes.
 *
 *   Auth: Bearer CRON_SECRET in the Authorization header.
 *
 * GET /api/cron/waitlist-auto-process
 *   Returns endpoint status and last execution info (requires cron secret).
 */

// ─── Cron Secret ──────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON:waitlist-auto-process] CRON_SECRET environment variable is required');
}
const CRON_SECRET_VALUE = CRON_SECRET;

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET_VALUE) return false;
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  return providedSecret === CRON_SECRET_VALUE;
}

// ─── Core Auto-Process Logic ─────────────────────────────────────────────────
// Extracted so it can be called from both the cron endpoint and the authenticated
// /api/waitlist/auto-process endpoint.

async function runWaitlistAutoProcess(): Promise<{
  success: boolean;
  totalProcessed: number;
  propertiesProcessed: number;
  details: { propertyId: string; roomTypeId: string; processedCount: number }[];
  error?: string;
}> {
  const results: { propertyId: string; roomTypeId: string; processedCount: number }[] = [];
  let totalProcessed = 0;
  let propertiesProcessed = 0;

  try {
    // Get all active properties
    const properties = await db.property.findMany({
      where: { status: 'active' },
      select: { id: true, tenantId: true },
    });

    for (const property of properties) {
      // Get all room types for this property
      const roomTypes = await db.roomType.findMany({
        where: { propertyId: property.id, status: 'active' },
        select: { id: true },
      });

      for (const roomType of roomTypes) {
        try {
          // Find waiting entries for this room type and property
          const waitingEntries = await db.waitlistEntry.findMany({
            where: {
              roomTypeId: roomType.id,
              propertyId: property.id,
              tenantId: property.tenantId,
              status: 'waiting',
            },
            orderBy: [
              { priority: 'desc' },
              { createdAt: 'asc' },
            ],
          });

          if (waitingEntries.length === 0) continue;

          // Get total available rooms for this room type
          const totalRooms = await db.room.count({
            where: { propertyId: property.id, roomTypeId: roomType.id },
          });

          if (totalRooms === 0) continue;

          // Count existing bookings that overlap with any waiting entry's date range
          // We check each entry individually since they may have different date ranges
          let processedCount = 0;

          // Collect all notified entries to account for reserved spots
          const notifiedEntries = await db.waitlistEntry.count({
            where: {
              roomTypeId: roomType.id,
              propertyId: property.id,
              tenantId: property.tenantId,
              status: 'notified',
            },
          });

          let availableRooms = Math.max(0, totalRooms - notifiedEntries);

          for (const entry of waitingEntries) {
            if (availableRooms <= 0) break;

            // Check if this entry's date range can be satisfied
            const entryOverlapBookings = await db.booking.count({
              where: {
                propertyId: property.id,
                roomTypeId: roomType.id,
                status: { in: ['confirmed', 'checked_in'] },
                checkIn: { lt: entry.checkOut },
                checkOut: { gt: entry.checkIn },
              },
            });

            const entryAvailable = totalRooms - entryOverlapBookings - notifiedEntries;

            if (entryAvailable > 0) {
              // Mark as notified
              await db.waitlistEntry.update({
                where: { id: entry.id },
                data: { status: 'notified' },
              });

              // Create a notification for the guest
              try {
                await db.notification.create({
                  data: {
                    tenantId: property.tenantId,
                    userId: entry.guestId,
                    type: 'waitlist',
                    category: 'success',
                    title: 'Room Available!',
                    message: `A room matching your waitlist request is now available for ${entry.checkIn.toLocaleDateString()} - ${entry.checkOut.toLocaleDateString()}.`,
                    priority: 'high',
                    actionType: 'view',
                    link: `/bookings/new?roomTypeId=${entry.roomTypeId}&checkIn=${entry.checkIn.toISOString().split('T')[0]}&checkOut=${entry.checkOut.toISOString().split('T')[0]}`,
                  },
                });
              } catch (notifyErr) {
                console.error(`[WaitlistCron] Failed to create notification for entry ${entry.id}:`, notifyErr);
                // Don't block the process
              }

              availableRooms--;
              processedCount++;
            }
          }

          if (processedCount > 0) {
            results.push({ propertyId: property.id, roomTypeId: roomType.id, processedCount });
            totalProcessed += processedCount;
          }
        } catch (roomTypeErr) {
          console.error(`[WaitlistCron] Error processing room type ${roomType.id}:`, roomTypeErr);
        }
      }

      propertiesProcessed++;
    }

    return {
      success: true,
      totalProcessed,
      propertiesProcessed,
      details: results,
    };
  } catch (error) {
    console.error('[WaitlistCron] Fatal error:', error);
    return {
      success: false,
      totalProcessed: 0,
      propertiesProcessed: 0,
      details: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── POST: Trigger waitlist auto-process ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET not configured' } },
        { status: 500 }
      );
    }

    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const result = await runWaitlistAutoProcess();
    const duration = Date.now() - startTime;

    console.log(`[WaitlistCron] Completed in ${duration}ms — processed ${result.totalProcessed} entries across ${result.propertiesProcessed} properties`);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          processedCount: result.totalProcessed,
          propertiesProcessed: result.propertiesProcessed,
          details: result.details,
          durationMs: duration,
        },
        message: result.totalProcessed > 0
          ? `Processed ${result.totalProcessed} waitlist entry/entries`
          : 'No waitlist entries to process',
      });
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'PROCESS_ERROR', message: result.error || 'Auto-process failed' } },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[WaitlistCron] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run waitlist auto-process' } },
      { status: 500 }
    );
  }
}

// ─── GET: Health check / status ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!CRON_SECRET_VALUE) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 }
    );
  }

  // Count total waiting entries across all tenants
  let totalWaiting = 0;
  try {
    totalWaiting = await db.waitlistEntry.count({ where: { status: 'waiting' } });
  } catch {
    // ignore
  }

  return NextResponse.json({
    success: true,
    message: 'Waitlist auto-process cron endpoint is active',
    scheduler: 'Should be called every 5-15 minutes by an external cron service',
    trigger: 'POST with Authorization: Bearer <CRON_SECRET> header',
    data: {
      endpoint: '/api/cron/waitlist-auto-process',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      recommendedSchedule: 'Every 5-15 minutes',
      totalWaitingEntries: totalWaiting,
    },
  });
}
