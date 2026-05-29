/**
 * Group Folio Module (H-02)
 *
 * Consolidated folio management for group bookings.
 * Aggregates totals from child booking folios into a single master GroupFolio.
 * Supports line item management, payment application, and distribution to child folios.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupFolioItemInput {
  description: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  serviceDate?: Date | string;
  referenceType?: string;
  referenceId?: string;
  postedBy?: string;
}

export interface GroupFolioPaymentInput {
  tenantId: string;
  propertyId: string;
  amount: number;
  method: string;
  reference?: string;
  description?: string;
  processedBy?: string;
  distributeToChildFolios?: boolean;
}

// ---------------------------------------------------------------------------
// recalculateFolioTotals — Re-aggregate totals from all child booking folios
// ---------------------------------------------------------------------------

export async function recalculateFolioTotals(groupFolioId: string) {
  const groupFolio = await db.groupFolio.findUnique({
    where: { id: groupFolioId },
    select: { id: true, groupBookingId: true },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  // Fetch all child bookings for this group
  const childBookings = await db.booking.findMany({
    where: {
      groupId: groupFolio.groupBookingId,
      status: { not: 'cancelled' },
      deletedAt: null,
    },
    select: { id: true },
  });

  const bookingIds = childBookings.map((b) => b.id);

  // Sum up folio totals across all child bookings
  const folioAgg = await db.folio.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: bookingIds } },
    _sum: { subtotal: true, taxes: true, totalAmount: true, paidAmount: true },
  });

  let aggregatedSubtotal = 0;
  let aggregatedTaxes = 0;
  let aggregatedTotal = 0;
  let aggregatedPaid = 0;

  for (const row of folioAgg) {
    aggregatedSubtotal += row._sum.subtotal ?? 0;
    aggregatedTaxes += row._sum.taxes ?? 0;
    aggregatedTotal += row._sum.totalAmount ?? 0;
    aggregatedPaid += row._sum.paidAmount ?? 0;
  }

  // Sum group folio line items (supplementary charges)
  const itemsAgg = await db.groupFolioItem.aggregate({
    where: { groupFolioId },
    _sum: { totalAmount: true, taxAmount: true },
  });
  const itemSubtotal = itemsAgg._sum.totalAmount ?? 0;
  const itemTax = itemsAgg._sum.taxAmount ?? 0;

  // Sum group folio payments
  const paymentsAgg = await db.groupFolioPayment.aggregate({
    where: { groupFolioId, status: 'completed' },
    _sum: { amount: true },
  });
  const totalPayments = paymentsAgg._sum.amount ?? 0;

  // Combined totals: child folios + supplementary items
  const subtotal = Math.round((aggregatedSubtotal + itemSubtotal) * 100) / 100;
  const taxes = Math.round((aggregatedTaxes + itemTax) * 100) / 100;
  const totalAmount = Math.round((aggregatedTotal + itemSubtotal + itemTax) * 100) / 100;
  const paidAmount = Math.round((aggregatedPaid + totalPayments) * 100) / 100;
  const balance = Math.round(Math.max(0, totalAmount - paidAmount) * 100) / 100;

  // Derive status
  let status: string;
  if (balance <= 0 && totalAmount > 0) {
    status = 'paid';
  } else if (paidAmount > 0) {
    status = 'partially_paid';
  } else {
    status = 'open';
  }

  // Persist updated totals
  const updated = await db.groupFolio.update({
    where: { id: groupFolioId },
    data: { subtotal, taxes, totalAmount, paidAmount, balance, status },
  });

  return updated;
}

/** Backward-compatible alias */
export const recalcGroupFolio = recalculateFolioTotals;

// ---------------------------------------------------------------------------
// createGroupFolio — Create a new GroupFolio for a group booking
// ---------------------------------------------------------------------------

export async function createGroupFolio(params: {
  tenantId: string;
  propertyId: string;
  groupBookingId: string;
  organizerGuestId?: string;
  currency?: string;
}) {
  const { tenantId, propertyId, groupBookingId, organizerGuestId, currency } = params;

  // Check if a folio already exists for this group booking
  const existing = await db.groupFolio.findFirst({
    where: { groupBookingId },
  });

  if (existing) {
    // Recalculate and return existing
    return recalculateFolioTotals(existing.id);
  }

  // Determine currency from property
  let resolvedCurrency = currency || 'USD';
  if (!currency) {
    const prop = await db.property.findUnique({
      where: { id: propertyId },
      select: { currency: true },
    });
    if (prop?.currency) {
      resolvedCurrency = prop.currency;
    }
  }

  const groupFolio = await db.groupFolio.create({
    data: {
      tenantId,
      propertyId,
      groupBookingId,
      organizerGuestId: organizerGuestId || null,
      currency: resolvedCurrency,
    },
  });

  // Initial recalculation from child folios
  const recalculated = await recalculateFolioTotals(groupFolio.id);

  return recalculated;
}

// ---------------------------------------------------------------------------
// addItemToFolio — Add a supplementary line item to the group folio
// ---------------------------------------------------------------------------

export async function addItemToFolio(folioId: string, item: GroupFolioItemInput) {
  const groupFolio = await db.groupFolio.findUnique({
    where: { id: folioId },
    select: { id: true, status: true },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  if (groupFolio.status === 'closed') {
    throw new Error('FOLIO_CLOSED');
  }

  const quantity = Math.max(1, item.quantity ?? 1);
  const unitPrice = Math.max(0, item.unitPrice ?? 0);
  const taxRate = Math.max(0, item.taxRate ?? 0);
  const totalAmount = Math.round(quantity * unitPrice * 100) / 100;
  const taxAmount = Math.round(totalAmount * (taxRate / 100) * 100) / 100;

  const folioItem = await db.groupFolioItem.create({
    data: {
      groupFolioId: folioId,
      description: item.description,
      category: item.category || 'miscellaneous',
      quantity,
      unitPrice,
      totalAmount,
      taxRate,
      taxAmount,
      serviceDate: item.serviceDate ? new Date(item.serviceDate) : new Date(),
      referenceType: item.referenceType || null,
      referenceId: item.referenceId || null,
      postedBy: item.postedBy || null,
    },
  });

  // Recalculate folio totals
  await recalculateFolioTotals(folioId);

  return folioItem;
}

// ---------------------------------------------------------------------------
// removeItemFromFolio — Remove a line item and recalculate
// ---------------------------------------------------------------------------

export async function removeItemFromFolio(folioId: string, itemId: string) {
  const groupFolio = await db.groupFolio.findUnique({
    where: { id: folioId },
    select: { id: true, status: true },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  if (groupFolio.status === 'closed') {
    throw new Error('FOLIO_CLOSED');
  }

  const item = await db.groupFolioItem.findFirst({
    where: { id: itemId, groupFolioId: folioId },
  });

  if (!item) {
    throw new Error('ITEM_NOT_FOUND');
  }

  await db.groupFolioItem.delete({
    where: { id: itemId },
  });

  // Recalculate folio totals
  const recalculated = await recalculateFolioTotals(folioId);

  return { deletedItemId: itemId, folio: recalculated };
}

// ---------------------------------------------------------------------------
// recordPayment — Record a payment and distribute to child folios
// ---------------------------------------------------------------------------

export async function recordPayment(
  folioId: string,
  payment: GroupFolioPaymentInput
) {
  const {
    tenantId,
    propertyId,
    amount,
    method,
    reference,
    description,
    processedBy,
    distributeToChildFolios = true,
  } = payment;

  const safeAmount = Math.round(amount * 100) / 100;
  if (safeAmount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const groupFolio = await db.groupFolio.findUnique({
    where: { id: folioId },
    select: { id: true, groupBookingId: true, status: true, balance: true },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  if (groupFolio.status === 'closed') {
    throw new Error('FOLIO_CLOSED');
  }

  // Create the payment record on the group folio
  const paymentRecord = await db.groupFolioPayment.create({
    data: {
      tenantId,
      propertyId,
      groupFolioId: folioId,
      amount: safeAmount,
      method,
      status: 'completed',
      reference,
      description,
      processedBy,
    },
  });

  // Distribute payment to child booking folios (proportional to their balances)
  if (distributeToChildFolios) {
    const childBookings = await db.booking.findMany({
      where: {
        groupId: groupFolio.groupBookingId,
        status: { not: 'cancelled' },
        deletedAt: null,
      },
      select: { id: true },
    });

    const bookingIds = childBookings.map((b) => b.id);

    // Get all open folios with a positive balance
    const childFolios = await db.folio.findMany({
      where: {
        bookingId: { in: bookingIds },
        status: { in: ['open', 'partially_paid'] },
      },
      select: { id: true, balance: true, bookingId: true },
      orderBy: { balance: 'desc' },
    });

    const totalChildBalance = childFolios.reduce(
      (sum, f) => sum + Math.max(0, f.balance),
      0
    );

    if (totalChildBalance > 0 && childFolios.length > 0) {
      let remaining = safeAmount;
      for (const folio of childFolios) {
        if (remaining <= 0) break;
        const folioBalance = Math.max(0, folio.balance);
        if (folioBalance <= 0) continue;

        // Proportional distribution
        const proportionalShare =
          Math.round((safeAmount * folioBalance) / totalChildBalance * 100) /
          100;
        const allocation = Math.min(
          proportionalShare,
          remaining,
          folioBalance
        );

        if (allocation > 0) {
          await db.folio.update({
            where: { id: folio.id },
            data: {
              paidAmount: { increment: allocation },
              balance: { decrement: allocation },
              status:
                folio.balance - allocation <= 0 ? 'paid' : 'partially_paid',
            },
          });

          remaining -= allocation;
        }
      }
    }
  }

  // Recalculate the group folio totals
  const recalculated = await recalculateFolioTotals(folioId);

  return { payment: paymentRecord, folio: recalculated };
}

/** Backward-compatible alias */
export async function applyPaymentToGroupFolio(
  params: GroupFolioPaymentInput & { groupFolioId: string }
) {
  const { groupFolioId, ...payment } = params;
  return recordPayment(groupFolioId, payment);
}

// ---------------------------------------------------------------------------
// closeFolio — Close the group folio and settle all child folios
// ---------------------------------------------------------------------------

export async function closeFolio(folioId: string) {
  const groupFolio = await db.groupFolio.findUnique({
    where: { id: folioId },
    select: { id: true, groupBookingId: true, status: true, balance: true },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  if (groupFolio.status === 'closed') {
    throw new Error('FOLIO_ALREADY_CLOSED');
  }

  // Recalculate to get final totals
  const recalculated = await recalculateFolioTotals(folioId);

  // If there's a remaining balance, mark as partially_paid (not fully settled)
  // Otherwise close it
  const finalStatus = recalculated.balance > 0.01 ? 'partially_paid' : 'paid';

  const closed = await db.groupFolio.update({
    where: { id: folioId },
    data: {
      status: finalStatus === 'paid' ? 'closed' : 'partially_paid',
      closedAt: finalStatus === 'paid' ? new Date() : null,
    },
  });

  return closed;
}

/** Backward-compatible alias */
export const closeGroupFolio = closeFolio;

// ---------------------------------------------------------------------------
// getGroupFolioSummary — Full consolidated view with child folio details
// ---------------------------------------------------------------------------

export async function getGroupFolioSummary(folioId: string) {
  const groupFolio = await db.groupFolio.findUnique({
    where: { id: folioId },
    include: {
      folioItems: {
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
      groupBooking: {
        select: {
          id: true,
          name: true,
          contactName: true,
          contactEmail: true,
        },
      },
    },
  });

  if (!groupFolio) {
    throw new Error('GROUP_FOLIO_NOT_FOUND');
  }

  // Fetch child bookings and their folios
  const childBookings = await db.booking.findMany({
    where: {
      groupId: groupFolio.groupBookingId,
      status: { not: 'cancelled' },
      deletedAt: null,
    },
    include: {
      primaryGuest: {
        select: { id: true, firstName: true, lastName: true },
      },
      room: {
        select: { id: true, number: true },
      },
      folios: {
        select: {
          id: true,
          folioNumber: true,
          subtotal: true,
          taxes: true,
          totalAmount: true,
          paidAmount: true,
          balance: true,
          status: true,
        },
      },
    },
    orderBy: [{ checkIn: 'asc' }, { confirmationCode: 'asc' }],
  });

  return {
    ...groupFolio,
    childBookings: childBookings.map((b) => ({
      id: b.id,
      confirmationCode: b.confirmationCode,
      guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`.trim(),
      roomNumber: b.room?.number || null,
      folios: b.folios,
      totalFolioBalance: b.folios.reduce((s, f) => s + f.balance, 0),
    })),
  };
}

/** Backward-compatible alias */
export const getGroupFolioWithBreakdown = getGroupFolioSummary;
