import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Sentinel UUID used for pending consumptions without an active booking.
// These should be reconciled later via /api/minibar/consumption/reconcile
const PENDING_BOOKING_SENTINEL = '00000000-0000-0000-0000-pending000001';

/**
 * Auto-charge logic for smart minibar IoT devices.
 * Called when an IoT device detects consumption without human intervention.
 */

interface BookingInfo {
  id: string;
  tenantId: string;
}

interface FolioInfo {
  id: string;
  bookingId: string;
  tenantId: string;
  status: string;
}

interface MinibarItemInfo {
  id: string;
  name: string;
  sellPrice: number;
}

interface ConsumptionRecord {
  id: string;
  totalPrice: number;
  quantity: number;
  unitPrice: number;
  itemName: string;
  consumedAt: Date;
}

/**
 * Main auto-charge entry point for IoT smart minibar events.
 * Creates a MinibarConsumption record and auto-posts to the guest folio.
 * If no active booking exists, creates a "pending" consumption for later reconciliation.
 */
export async function processSmartMinibarEvent(
  roomId: string,
  itemId: string,
  quantity: number = 1,
  propertyId: string,
  detectedAt?: Date
): Promise<{
  success: boolean;
  consumption?: ConsumptionRecord;
  folioPosted: boolean;
  pending: boolean;
  error?: string;
  auditLogId?: string;
}> {
  const qty = Math.min(100, Math.max(1, quantity));
  const eventTime = detectedAt || new Date();

  try {
    // 1. Look up the minibar item
    const minibarItem = await db.minibarItem.findFirst({
      where: { id: itemId },
      select: { id: true, name: true, sellPrice: true, tenantId: true, propertyId: true },
    });
    if (!minibarItem) {
      return { success: false, error: `Minibar item not found: ${itemId}`, folioPosted: false, pending: false };
    }

    // 2. Find active booking for the room
    const booking = await resolveActiveBooking(roomId, propertyId);

    // 3. Look up room to get tenantId
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId },
      select: { id: true, property: { select: { tenantId: true } } },
    });
    if (!room) {
      return { success: false, error: `Room not found: ${roomId}`, folioPosted: false, pending: false };
    }
    const tenantId = room.property.tenantId;

    // 4. If no active booking, create a pending consumption
    if (!booking) {
      const pendingConsumption = await db.minibarConsumption.create({
        data: {
          tenantId,
          propertyId,
          bookingId: PENDING_BOOKING_SENTINEL, // Sentinel for pending reconciliation
          folioId: null,
          roomId,
          itemId: minibarItem.id,
          itemName: minibarItem.name,
          quantity: qty,
          unitPrice: minibarItem.sellPrice,
          totalPrice: Math.round(qty * minibarItem.sellPrice * 100) / 100,
          consumedAt: eventTime,
          postedToFolio: false,
          consumedBy: 'iot_smart_minibar',
          notes: 'IoT auto-detected consumption — no active booking found. Pending reconciliation.',
        },
      });

      // Audit log
      const auditLog = await db.auditLog.create({
        data: {
          tenantId,
          module: 'minibar',
          action: 'create',
          entityType: 'MinibarConsumption',
          entityId: pendingConsumption.id,
          newValue: JSON.stringify({
            source: 'iot_auto_charge',
            roomId,
            itemId: minibarItem.id,
            quantity: qty,
            status: 'pending_reconciliation',
          }),
        },
      });

      return {
        success: true,
        consumption: {
          id: pendingConsumption.id,
          totalPrice: pendingConsumption.totalPrice,
          quantity: pendingConsumption.quantity,
          unitPrice: pendingConsumption.unitPrice,
          itemName: pendingConsumption.itemName,
          consumedAt: pendingConsumption.consumedAt,
        },
        folioPosted: false,
        pending: true,
        auditLogId: auditLog.id,
      };
    }

    // 5. Create consumption with booking
    const consumption = await db.minibarConsumption.create({
      data: {
        tenantId,
        propertyId,
        bookingId: booking.id,
        folioId: null,
        roomId,
        itemId: minibarItem.id,
        itemName: minibarItem.name,
        quantity: qty,
        unitPrice: minibarItem.sellPrice,
        totalPrice: Math.round(qty * minibarItem.sellPrice * 100) / 100,
        consumedAt: eventTime,
        postedToFolio: false,
        consumedBy: 'iot_smart_minibar',
        notes: 'IoT auto-detected consumption',
      },
    });

    // 6. Resolve folio for the booking
    let folioPosted = false;
    try {
      const folio = await resolveActiveFolio(booking.id, tenantId);
      if (folio) {
        await postConsumptionToFolio(consumption, folio, tenantId, minibarItem);
        folioPosted = true;
      }
    } catch (folioError) {
      console.error('[auto-charge] Folio posting failed (fire-and-forget):', folioError);
      // We still return success — folio posting is fire-and-forget
    }

    // 7. Audit log
    const auditLog = await db.auditLog.create({
      data: {
        tenantId,
        module: 'minibar',
        action: 'create',
        entityType: 'MinibarConsumption',
        entityId: consumption.id,
        newValue: JSON.stringify({
          source: 'iot_auto_charge',
          roomId,
          itemId: minibarItem.id,
          quantity: qty,
          bookingId: booking.id,
          folioPosted,
        }),
      },
    });

    return {
      success: true,
      consumption: {
        id: consumption.id,
        totalPrice: consumption.totalPrice,
        quantity: consumption.quantity,
        unitPrice: consumption.unitPrice,
        itemName: consumption.itemName,
        consumedAt: consumption.consumedAt,
      },
      folioPosted,
      pending: false,
      auditLogId: auditLog.id,
    };
  } catch (error) {
    console.error('[processSmartMinibarEvent]', error);
    return { success: false, error: 'Internal error', folioPosted: false, pending: false };
  }
}

/**
 * Find an active (checked-in) booking for a given room.
 */
export async function resolveActiveBooking(roomId: string, propertyId: string): Promise<BookingInfo | null> {
  const now = new Date();

  const booking = await db.booking.findFirst({
    where: {
      roomId,
      propertyId,
      status: 'checked_in',
      checkIn: { lte: now },
      checkOut: { gt: now },
      deletedAt: null,
    },
    select: { id: true, tenantId: true },
    orderBy: { checkIn: 'desc' },
  });

  return booking;
}

/**
 * Find an active (open) folio for a booking.
 */
export async function resolveActiveFolio(bookingId: string, tenantId: string): Promise<FolioInfo | null> {
  const folio = await db.folio.findFirst({
    where: {
      bookingId,
      tenantId,
      status: 'open',
    },
    select: { id: true, bookingId: true, tenantId: true, status: true },
  });

  return folio;
}

/**
 * Post a minibar consumption to a folio and update the folio balance.
 * Uses a transaction for atomicity.
 */
export async function postConsumptionToFolio(
  consumption: { id: string; totalPrice: number; quantity: number; unitPrice: number; itemName: string; consumedAt: Date },
  folio: FolioInfo,
  tenantId: string,
  item: MinibarItemInfo,
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Calculate tax from property settings
    let taxRate = 0;
    const booking = await tx.booking.findFirst({
      where: { id: folio.bookingId },
      select: { propertyId: true },
    });
    if (booking) {
      const prop = await tx.property.findFirst({
        where: { id: booking.propertyId },
        select: { defaultTaxRate: true, taxComponents: true },
      });
      if (prop) {
        try {
          const tc = JSON.parse(prop.taxComponents || '[]');
          if (Array.isArray(tc) && tc.length > 0) {
            taxRate = tc.reduce((sum: number, c: { rate: number }) => sum + (c.rate || 0), 0) / 100;
          } else {
            taxRate = (prop.defaultTaxRate || 0) / 100;
          }
        } catch {
          taxRate = (prop.defaultTaxRate || 0) / 100;
        }
      }
    }

    const taxAmount = Math.round(consumption.totalPrice * taxRate * 100) / 100;

    // Create folio line item
    await tx.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Minibar: ${consumption.itemName} x${consumption.quantity}`,
        category: 'minibar',
        quantity: consumption.quantity,
        unitPrice: consumption.unitPrice,
        totalAmount: consumption.totalPrice,
        taxAmount,
        serviceDate: consumption.consumedAt,
        referenceType: 'minibar_consumption',
        referenceId: consumption.id,
        postedBy: 'iot_smart_minibar',
      },
    });

    // Recalculate folio totals
    const currentFolio = await tx.folio.findUnique({ where: { id: folio.id } });
    const allLineItems = await tx.folioLineItem.findMany({
      where: { folioId: folio.id },
      select: { totalAmount: true, taxAmount: true },
    });
    const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
    const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const newTotal = newSubtotal + newTaxes - (currentFolio?.discount || 0);

    await tx.folio.update({
      where: { id: folio.id },
      data: {
        subtotal: newSubtotal,
        taxes: newTaxes,
        totalAmount: newTotal,
        balance: newTotal - (currentFolio?.paidAmount || 0),
      },
    });

    // Mark consumption as posted
    await tx.minibarConsumption.update({
      where: { id: consumption.id },
      data: {
        postedToFolio: true,
        postedAt: new Date(),
      },
    });
  });
}
