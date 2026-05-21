/**
 * Room Type Change Cascade
 *
 * When a room's type is changed, this module handles cascading effects:
 * - Updates active booking pricing if room type rates differ
 * - Logs the change in AuditLog
 */

import { db } from '@/lib/db';

interface CascadeResult {
  updated: number;
}

/**
 * Cascade effects of a room type change.
 *
 * @param roomId - The room whose type was changed
 * @param oldTypeId - Previous room type ID
 * @param newTypeId - New room type ID
 * @param propertyId - Property the room belongs to
 * @param tenantId - Tenant the room belongs to
 * @param userId - User who made the change (for audit logging)
 * @returns Object with count of updated bookings
 */
export async function cascadeRoomTypeChange(
  roomId: string,
  oldTypeId: string,
  newTypeId: string,
  propertyId: string,
  tenantId: string,
  userId?: string,
): Promise<CascadeResult> {
  // Get the old and new room type prices
  const [oldRoomType, newRoomType] = await Promise.all([
    db.roomType.findUnique({ where: { id: oldTypeId }, select: { basePrice: true, name: true } }),
    db.roomType.findUnique({ where: { id: newTypeId }, select: { basePrice: true, name: true } }),
  ]);

  const oldPrice = oldRoomType?.basePrice ?? 0;
  const newPrice = newRoomType?.basePrice ?? 0;

  let updated = 0;

  // Only update pricing if rates differ
  if (oldPrice !== newPrice) {
    // Find active bookings for this room
    const activeBookings = await db.booking.findMany({
      where: {
        roomId,
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
      },
    });

    if (activeBookings.length > 0) {
      // Update room rate for each booking if it was using the old type's base price
      const result = await db.booking.updateMany({
        where: {
          id: { in: activeBookings.map((b) => b.id) },
          roomRate: oldPrice, // Only update if rate matches old type
        },
        data: {
          roomRate: newPrice,
        },
      });
      updated = result.count;

      // Recalculate total amount for updated bookings
      if (updated > 0) {
        const updatedBookings = await db.booking.findMany({
          where: {
            id: { in: activeBookings.map((b) => b.id) },
          },
        });

        for (const booking of updatedBookings) {
          const nights = Math.max(
            1,
            Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)),
          );
          const newTotal = newPrice * nights + booking.taxes + booking.fees - booking.discount;

          await db.booking.update({
            where: { id: booking.id },
            data: { totalAmount: newTotal },
          });
        }
      }
    }

    // Log cascade in AuditLog
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        module: 'rooms',
        action: 'update',
        entityType: 'Room',
        entityId: roomId,
        oldValue: JSON.stringify({
          roomTypeId: oldTypeId,
          roomTypeName: oldRoomType?.name,
          basePrice: oldPrice,
        }),
        newValue: JSON.stringify({
          roomTypeId: newTypeId,
          roomTypeName: newRoomType?.name,
          basePrice: newPrice,
          bookingsUpdated: updated,
        }),
      },
    });
  }

  return { updated };
}
