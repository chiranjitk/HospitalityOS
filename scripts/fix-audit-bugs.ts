import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const DEFAULT_TAX_RATE = 0.18; // 18%

async function main() {
  console.log('=== StaySuite Data Reconciliation Script ===\n');
  console.log('Starting data reconciliation...\n');

  // ============================================================
  // FIX 1: BUG-005 — Orphaned rooms (status='occupied' but no active booking)
  // ============================================================
  console.log('--- FIX 1: BUG-005 — Orphaned rooms ---');

  const orphanedRooms = await db.room.findMany({
    where: {
      status: 'occupied',
      deletedAt: null,
      bookings: {
        none: {
          status: { in: ['confirmed', 'checked_in'] },
          deletedAt: null,
        },
      },
    },
    select: { id: true, number: true, status: true },
  });

  console.log(`Found ${orphanedRooms.length} orphaned rooms with status='occupied' but no active booking`);

  if (orphanedRooms.length > 0) {
    for (const room of orphanedRooms) {
      console.log(`  Room ${room.number} (${room.id}) → setting to 'available'`);
    }

    const result = await db.room.updateMany({
      where: {
        id: { in: orphanedRooms.map((r) => r.id) },
      },
      data: { status: 'available' },
    });

    console.log(`✓ Updated ${result.count} orphaned rooms to 'available'\n`);
  } else {
    console.log('  No orphaned rooms found.\n');
  }

  // ============================================================
  // FIX 2: BUG-002/SS-E1IY57 — Walk-in booking zero tax
  // Recalculate taxes for bookings where taxes=0, using property defaultTaxRate=18%
  // Update BOTH the folio AND the booking
  // ============================================================
  console.log('--- FIX 2: BUG-002 — Zero-tax bookings ---');

  const zeroTaxBookings = await db.booking.findMany({
    where: {
      taxes: 0,
      deletedAt: null,
    },
    include: {
      property: { select: { id: true, defaultTaxRate: true } },
      folios: true,
    },
  });

  console.log(`Found ${zeroTaxBookings.length} booking(s) with taxes=0`);

  for (const booking of zeroTaxBookings) {
    const taxRate = (booking.property.defaultTaxRate || 18) / 100;
    console.log(`  Booking ${booking.confirmationCode}: roomRate=${booking.roomRate}, propertyTaxRate=${taxRate * 100}%`);

    for (const folio of booking.folios) {
      const recalculatedTax = Math.round(folio.subtotal * taxRate * 100) / 100;
      const newTotalAmount = Math.round((folio.subtotal + recalculatedTax - folio.discount) * 100) / 100;

      console.log(`    Folio ${folio.folioNumber}: subtotal=${folio.subtotal}, discount=${folio.discount}`);
      console.log(`    Recalculated tax: ${folio.subtotal} × ${taxRate} = ${recalculatedTax}`);
      console.log(`    New totalAmount: ${folio.subtotal} + ${recalculatedTax} - ${folio.discount} = ${newTotalAmount}`);

      // Update folio line items with taxRate and taxAmount
      const lineItemsUpdated = await db.folioLineItem.updateMany({
        where: { folioId: folio.id, taxRate: 0 },
        data: {
          taxRate: taxRate * 100,
          taxAmount: Math.round(folio.subtotal * taxRate * 100) / 100,
        },
      });
      console.log(`    Updated ${lineItemsUpdated.count} folio line item(s) with taxRate=${taxRate * 100}%`);

      // Update the folio
      await db.folio.update({
        where: { id: folio.id },
        data: {
          taxes: recalculatedTax,
          totalAmount: newTotalAmount,
        },
      });
      console.log(`    ✓ Folio updated: taxes=${recalculatedTax}, totalAmount=${newTotalAmount}`);
    }

    // Update the booking taxes and totalAmount
    // After folio fix, read the updated folio to sync
    const updatedFolio = await db.folio.findFirst({
      where: { bookingId: booking.id },
    });

    if (updatedFolio) {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          taxes: updatedFolio.taxes,
          totalAmount: updatedFolio.totalAmount,
        },
      });
      console.log(`    ✓ Booking updated: taxes=${updatedFolio.taxes}, totalAmount=${updatedFolio.totalAmount}`);
    }
  }
  console.log('');

  // ============================================================
  // FIX 3: BUG-003 — Booking total ≠ Folio total
  // Sync booking.totalAmount, booking.taxes, booking.roomRate from folio
  // Folio is the source of truth
  // ============================================================
  console.log('--- FIX 3: BUG-003 — Sync booking financials with folio ---');

  const bookingsWithFolios = await db.booking.findMany({
    where: { deletedAt: null },
    include: { folios: true },
  });

  let syncedCount = 0;

  for (const booking of bookingsWithFolios) {
    const folio = booking.folios[0]; // Primary folio
    if (!folio) {
      console.log(`  WARNING: Booking ${booking.confirmationCode} has no folio, skipping`);
      continue;
    }

    const needsUpdate =
      booking.totalAmount !== folio.totalAmount ||
      booking.taxes !== folio.taxes ||
      booking.roomRate !== folio.subtotal;

    if (needsUpdate) {
      const oldTotal = booking.totalAmount;
      const oldTaxes = booking.taxes;
      const oldRoomRate = booking.roomRate;

      await db.booking.update({
        where: { id: booking.id },
        data: {
          totalAmount: folio.totalAmount,
          taxes: folio.taxes,
          roomRate: folio.subtotal,
        },
      });

      console.log(`  Booking ${booking.confirmationCode}:`);
      console.log(`    totalAmount: ${oldTotal} → ${folio.totalAmount}`);
      console.log(`    taxes:       ${oldTaxes} → ${folio.taxes}`);
      console.log(`    roomRate:    ${oldRoomRate} → ${folio.subtotal}`);
      syncedCount++;
    }
  }

  console.log(`✓ Synced ${syncedCount} booking(s) with their folio\n`);

  // ============================================================
  // FIX 4: BUG-018 — checkInDate/checkOutDate null
  // Set checkInDate = checkIn and checkOutDate = checkOut where null
  // ============================================================
  console.log('--- FIX 4: BUG-018 — Null checkInDate/checkOutDate ---');

  // Prisma doesn't support column-to-column updates, use raw SQL
  const nullCheckInResult = await db.$executeRaw`
    UPDATE "Booking"
    SET "checkInDate" = "checkIn"
    WHERE "checkInDate" IS NULL AND "deletedAt" IS NULL
  `;
  console.log(`✓ Set checkInDate = checkIn for ${nullCheckInResult} booking(s)`);

  const nullCheckOutResult = await db.$executeRaw`
    UPDATE "Booking"
    SET "checkOutDate" = "checkOut"
    WHERE "checkOutDate" IS NULL AND "deletedAt" IS NULL
  `;
  console.log(`✓ Set checkOutDate = checkOut for ${nullCheckOutResult} booking(s)\n`);

  // ============================================================
  // FIX 5: BUG-016 — Night audit stuck in 'in_progress'
  // Set the stuck night audit to 'failed' with a note so it can be retried
  // ============================================================
  console.log('--- FIX 5: BUG-016 — Stuck night audit ---');

  // UUID fields don't support startsWith in Prisma, use raw SQL to find by prefix
  const stuckAudits: { id: string; status: string; startedAt: Date; notes: string | null }[] =
    await db.$queryRaw`
      SELECT id, status, "startedAt", notes
      FROM "NightAudit"
      WHERE id::text LIKE '95eff89d%'
      AND status = 'in_progress'
    `;

  const stuckAudit = stuckAudits[0];

  if (stuckAudit) {
    await db.nightAudit.update({
      where: { id: stuckAudit.id },
      data: {
        status: 'failed',
        notes: `Marked as failed by data reconciliation script. Original note: "${stuckAudit.notes || ''}". This audit was stuck in_progress and can now be retried.`,
      },
    });
    console.log(`✓ Night audit ${stuckAudit.id} set to 'failed' (was in_progress)`);
    console.log(`  Started at: ${stuckAudit.startedAt}`);
    console.log(`  Original note: ${stuckAudit.notes}\n`);
  } else {
    console.log('  No stuck night audit found with id starting with 95eff89d\n');
  }

  // ============================================================
  // FIX 6: BUG-010 — paymentStatus (compute only, no schema change)
  // Compute what the payment status should be based on folio status
  // ============================================================
  console.log('--- FIX 6: BUG-010 — Payment status computation (report only) ---');

  const allBookingsWithFolios = await db.booking.findMany({
    where: { deletedAt: null },
    include: { folios: { select: { id: true, folioNumber: true, status: true } } },
  });

  const paymentStatusMap: Record<string, string> = {
    paid: 'paid',
    partially_paid: 'partially_paid',
    open: 'unpaid',
  };

  console.log('  Computed payment statuses (requires schema change to persist):');
  for (const booking of allBookingsWithFolios) {
    const folio = booking.folios[0];
    if (!folio) continue;

    const computedStatus = paymentStatusMap[folio.status] || 'unknown';
    console.log(`    Booking ${booking.confirmationCode}: folio.status="${folio.status}" → paymentStatus="${computedStatus}"`);
  }
  console.log('  NOTE: paymentStatus field does not exist on Booking model yet. Schema change required.\n');

  // ============================================================
  // FIX 7: BUG-007/RS-2024-004 — Specific booking sync verification
  // This should already be handled by FIX 3, but verify explicitly
  // ============================================================
  console.log('--- FIX 7: BUG-007 — RS-2024-004 specific verification ---');

  const rs2024_004 = await db.booking.findFirst({
    where: { confirmationCode: 'RS-2024-004', deletedAt: null },
    include: { folios: true },
  });

  if (rs2024_004) {
    const folio = rs2024_004.folios[0];
    const isSynced =
      rs2024_004.totalAmount === folio.totalAmount &&
      rs2024_004.taxes === folio.taxes &&
      rs2024_004.roomRate === folio.subtotal;

    console.log(`  Booking RS-2024-004:`);
    console.log(`    booking.totalAmount = ${rs2024_004.totalAmount}, folio.totalAmount = ${folio.totalAmount}`);
    console.log(`    booking.taxes = ${rs2024_004.taxes}, folio.taxes = ${folio.taxes}`);
    console.log(`    booking.roomRate = ${rs2024_004.roomRate}, folio.subtotal = ${folio.subtotal}`);
    console.log(`    folio.discount = ${folio.discount}`);
    console.log(`    Status: ${isSynced ? '✓ SYNCED' : '✗ OUT OF SYNC — needs manual review'}`);

    if (!isSynced) {
      await db.booking.update({
        where: { id: rs2024_004.id },
        data: {
          totalAmount: folio.totalAmount,
          taxes: folio.taxes,
          roomRate: folio.subtotal,
        },
      });
      console.log(`    ✓ Force-synced RS-2024-004 to folio values`);
    }
  } else {
    console.log('  Booking RS-2024-004 not found');
  }
  console.log('');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('=== Reconciliation Summary ===');
  console.log(`  BUG-005: ${orphanedRooms.length} orphaned rooms → set to 'available'`);
  console.log(`  BUG-002: ${zeroTaxBookings.length} zero-tax booking(s) → recalculated with 18% tax`);
  console.log(`  BUG-003: ${syncedCount} booking(s) synced with folio financials`);
  console.log(`  BUG-018: ${nullCheckInResult} booking(s) fixed null checkInDate`);
  console.log(`           ${nullCheckOutResult} booking(s) fixed null checkOutDate`);
  console.log(`  BUG-016: ${stuckAudit ? '1 stuck night audit → set to failed' : '0 stuck audits found'}`);
  console.log(`  BUG-010: Payment statuses computed (requires schema change)`);
  console.log(`  BUG-007: RS-2024-004 verified/synced`);
  console.log('\nData reconciliation complete!');
}

main().catch(console.error).finally(() => db.$disconnect());
