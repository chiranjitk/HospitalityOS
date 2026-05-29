/**
 * BEO Folio Posting Service
 *
 * Handles posting BEO charges to guest/organizer folios, processing deposit payments,
 * final settlements, and reversal of BEO postings. This is the core business logic
 * layer for the BEO → Folio integration.
 *
 * IMPORTANT: BEO folio posting is idempotent — calling postBEOToFolio twice on the
 * same BEO will check if charges are already posted and skip duplicates.
 */

import { db } from '@/lib/db';
import { generateFolioNumber } from '@/lib/billing/number-generation';
import { FolioLineType } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface BEOSummary {
  beoId: string;
  orderNumber: string;
  clientName: string;
  totalCharges: number;
  chargesByCategory: Record<string, number>;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
  depositRequired: number;
  depositPaid: number;
  outstandingDeposit: number;
  payments: BEOPaymentRecord[];
  outstandingBalance: number;
  folioId?: string;
  folioNumber?: string;
  folioStatus?: string;
}

export interface BEOFolioResult {
  folioId: string;
  folioNumber: string;
  lineItemsPosted: number;
  totalPosted: number;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
}

export interface BEODepositResult {
  paymentId?: string;
  folioLineItemId?: string;
  amount: number;
  totalDepositPaid: number;
  outstandingDeposit: number;
  gatewayRef?: string;
}

export interface BEOSettlementResult {
  folioId: string;
  folioNumber: string;
  settlementAmount: number;
  totalPayments: number;
  outstandingBalance: number;
  folioStatus: string;
}

export interface BEOReversalResult {
  lineItemsReversed: number;
  totalReversed: number;
  reason: string;
}

export interface BEOPaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  gatewayRef?: string;
  description?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────────

const DEFAULT_SERVICE_CHARGE_RATE = 0.10; // 10%
const DEFAULT_TAX_RATE = 0.18;           // 18%
const DEFAULT_DEPOSIT_PERCENT = 0.30;    // 30% of total

/** Maps BEOItem category to FolioLineType for folio posting */
function mapItemCategoryToFolioType(category: string): FolioLineType {
  const mapping: Record<string, FolioLineType> = {
    food: 'food_beverage',
    beverage: 'food_beverage',
    av: 'service',
    decoration: 'miscellaneous',
    staffing: 'service',
    rental: 'miscellaneous',
  };
  return mapping[category] || 'miscellaneous';
}

// ─── Core Functions ───────────────────────────────────────────────────────────────

/**
 * 1. postBEOToFolio — Posts all BEO charges to the organizer's folio.
 *
 * - Finds the associated Event and organizer
 * - Finds or creates a Booking + Folio for the event
 * - Posts each BEOItem as a FolioLineItem with appropriate category
 * - Calculates subtotals with service charge + tax
 * - Returns the posted folio
 *
 * Idempotent: checks for existing BEOPosting references before posting.
 */
export async function postBEOToFolio(
  beoId: string,
  tenantId: string
): Promise<BEOFolioResult> {
  const beo = await db.banquetEventOrder.findFirst({
    where: { id: beoId, tenantId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!beo) throw new Error('BEO not found');
  if (!['confirmed', 'in_progress', 'completed'].includes(beo.status)) {
    throw new Error(`Cannot post BEO to folio in status: ${beo.status}`);
  }

  // ── Idempotency check: see if we already posted for this BEO ──────────
  const existingFolioLines = await db.folioLineItem.findMany({
    where: {
      referenceType: 'BanquetEventOrder',
      referenceId: beoId,
    },
    select: { id: true },
  });

  if (existingFolioLines.length > 0) {
    // Already posted — return existing folio info
    const firstLine = await db.folioLineItem.findFirst({
      where: { referenceType: 'BanquetEventOrder', referenceId: beoId },
      select: { folioId: true },
    });
    if (firstLine) {
      const folio = await db.folio.findUnique({
        where: { id: firstLine.folioId },
        select: { folioNumber: true },
      });
      const totalPosted = beo.totalAmount || 0;
      const sc = totalPosted * DEFAULT_SERVICE_CHARGE_RATE;
      const tx = (totalPosted + sc) * DEFAULT_TAX_RATE;
      return {
        folioId: firstLine.folioId,
        folioNumber: folio?.folioNumber || 'UNKNOWN',
        lineItemsPosted: existingFolioLines.length,
        totalPosted,
        serviceCharge: sc,
        tax: tx,
        grandTotal: totalPosted + sc + tx,
      };
    }
  }

  // ── Get or create booking + folio for the event ──────────────────────
  const { folio } = await getOrCreateEventFolio(beo, tenantId);

  // ── Calculate charges ────────────────────────────────────────────────
  const totalCharges = beo.totalAmount || 0;
  const serviceCharge = Math.round(totalCharges * DEFAULT_SERVICE_CHARGE_RATE * 100) / 100;
  const taxableSubtotal = totalCharges + serviceCharge;
  const tax = Math.round(taxableSubtotal * DEFAULT_TAX_RATE * 100) / 100;
  const grandTotal = Math.round((totalCharges + serviceCharge + tax) * 100) / 100;

  // ── Post charges in a transaction ────────────────────────────────────
  await db.$transaction(async (tx) => {
    // Post each BEO item as a folio line item
    for (const item of beo.items) {
      const folioType = mapItemCategoryToFolioType(item.category);
      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `${item.description}${item.notes ? ` (${item.notes})` : ''}`,
          category: folioType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalPrice,
          serviceDate: beo.functionDate,
          referenceType: 'BanquetEventOrder',
          referenceId: beo.id,
          taxRate: 0, // Tax is posted separately
          taxAmount: 0,
          postedBy: 'system:beo_folio',
        },
      });
    }

    // Post service charge as a separate line item
    if (serviceCharge > 0) {
      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `Service Charge (${(DEFAULT_SERVICE_CHARGE_RATE * 100).toFixed(0)}%) — BEO ${beo.orderNumber}`,
          category: 'service',
          quantity: 1,
          unitPrice: serviceCharge,
          totalAmount: serviceCharge,
          serviceDate: beo.functionDate,
          referenceType: 'BanquetEventOrder',
          referenceId: beo.id,
          taxRate: 0,
          taxAmount: 0,
          postedBy: 'system:beo_folio',
        },
      });
    }

    // Post tax as a separate line item
    if (tax > 0) {
      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `Tax (${(DEFAULT_TAX_RATE * 100).toFixed(0)}%) — BEO ${beo.orderNumber}`,
          category: 'tax',
          quantity: 1,
          unitPrice: tax,
          totalAmount: tax,
          serviceDate: beo.functionDate,
          referenceType: 'BanquetEventOrder',
          referenceId: beo.id,
          taxRate: 0,
          taxAmount: 0,
          postedBy: 'system:beo_folio',
        },
      });
    }

    // Update folio totals
    await tx.folio.update({
      where: { id: folio.id },
      data: {
        subtotal: { increment: totalCharges + serviceCharge },
        taxes: { increment: tax },
        totalAmount: { increment: grandTotal },
        balance: { increment: grandTotal },
      },
    });
  });

  return {
    folioId: folio.id,
    folioNumber: folio.folioNumber,
    lineItemsPosted: beo.items.length + (serviceCharge > 0 ? 1 : 0) + (tax > 0 ? 1 : 0),
    totalPosted: totalCharges,
    serviceCharge,
    tax,
    grandTotal,
  };
}

/**
 * 2. postBEODeposit — Processes deposit payment for a BEO.
 *
 * - Validates amount ≤ deposit required
 * - Creates a payment record via the payment router (if applicable)
 * - Posts deposit as FolioLineItem (type: deposit, negative amount = credit)
 * - Updates BanquetEventOrder.depositPaid
 * - Returns payment details
 */
export async function postBEODeposit(
  beoId: string,
  tenantId: string,
  amount: number,
  paymentMethod: string,
  gatewayToken?: string
): Promise<BEODepositResult> {
  const beo = await db.banquetEventOrder.findFirst({
    where: { id: beoId, tenantId },
  });

  if (!beo) throw new Error('BEO not found');
  if (!['draft', 'confirmed', 'in_progress'].includes(beo.status)) {
    throw new Error(`Cannot process deposit for BEO in status: ${beo.status}`);
  }

  // Calculate deposit required (30% of total or explicit depositAmount)
  const depositRequired = beo.depositAmount > 0
    ? beo.depositAmount
    : Math.round((beo.totalAmount || 0) * DEFAULT_DEPOSIT_PERCENT * 100) / 100;

  if (amount <= 0) throw new Error('Deposit amount must be positive');
  if (amount > depositRequired - beo.depositPaid) {
    throw new Error(`Deposit amount exceeds remaining required deposit of ${depositRequired - beo.depositPaid}`);
  }

  // Get or create event folio
  const { folio } = await getOrCreateEventFolio(beo, tenantId);

  let gatewayRef: string | undefined;

  // Process payment through gateway if token provided
  if (gatewayToken && paymentMethod !== 'cash' && paymentMethod !== 'bank_transfer' && paymentMethod !== 'cheque') {
    try {
      const { createPaymentRouter } = await import('@/lib/payments/router');
      const router = await createPaymentRouter(tenantId);

      const result = await router.processPayment({
        amount,
        currency: beo.currency || 'USD',
        customerId: undefined,
        guestId: undefined,
        paymentMethod: paymentMethod as any,
        idempotencyKey: `beo-deposit-${beoId}-${Date.now()}`,
        metadata: {
          beoId,
          type: 'beo_deposit',
          orderNumber: beo.orderNumber,
        },
      });

      if (result.success && result.gatewayRef) {
        gatewayRef = result.gatewayRef;
      }
    } catch (error) {
      console.error('[beo-folio] Payment gateway error, falling back to manual:', error);
      // Fall back to manual recording
    }
  }

  // Post deposit as a credit (negative amount) to the folio
  await db.$transaction(async (tx) => {
    await tx.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Deposit Payment — BEO ${beo.orderNumber} (${paymentMethod})`,
        category: 'deposit',
        quantity: 1,
        unitPrice: -amount, // Negative = credit
        totalAmount: -amount,
        serviceDate: new Date(),
        referenceType: 'BanquetEventOrder',
        referenceId: beo.id,
        taxRate: 0,
        taxAmount: 0,
        postedBy: 'system:beo_deposit',
      },
    });

    // Update folio
    await tx.folio.update({
      where: { id: folio.id },
      data: {
        paidAmount: { increment: amount },
        balance: { decrement: amount },
      },
    });

    // Update BEO deposit paid
    await tx.banquetEventOrder.update({
      where: { id: beoId },
      data: {
        depositPaid: beo.depositPaid + amount,
        depositAmount: depositRequired,
      },
    });
  });

  const totalDepositPaid = beo.depositPaid + amount;

  return {
    amount,
    totalDepositPaid,
    outstandingDeposit: Math.max(0, depositRequired - totalDepositPaid),
    gatewayRef,
  };
}

/**
 * 3. postBEOfinalSettlement — Final settlement after event.
 *
 * - Calculates remaining balance (total charges - deposit - payments)
 * - Processes final payment
 * - Posts to folio
 * - Closes the event folio
 * - Updates BanquetEventOrder.finalAmountPaid
 */
export async function postBEOfinalSettlement(
  beoId: string,
  tenantId: string,
  paymentMethod: string,
  gatewayToken?: string
): Promise<BEOSettlementResult> {
  const beo = await db.banquetEventOrder.findFirst({
    where: { id: beoId, tenantId },
  });

  if (!beo) throw new Error('BEO not found');
  if (!['confirmed', 'in_progress', 'completed'].includes(beo.status)) {
    throw new Error(`Cannot settle BEO in status: ${beo.status}`);
  }

  // Get the folio for this BEO
  const folioLine = await db.folioLineItem.findFirst({
    where: {
      referenceType: 'BanquetEventOrder',
      referenceId: beoId,
    },
    select: { folioId: true },
  });

  if (!folioLine) throw new Error('No folio found for this BEO. Post charges first.');

  const folio = await db.folio.findUnique({
    where: { id: folioLine.folioId },
  });

  if (!folio) throw new Error('Folio not found');
  if (folio.status === 'closed') throw new Error('Folio is already closed');

  // Calculate outstanding balance
  const outstandingBalance = Math.max(0, folio.balance);

  if (outstandingBalance === 0) {
    // Nothing to settle — just close the folio
    await db.folio.update({
      where: { id: folio.id },
      data: { status: 'closed', closedAt: new Date() },
    });

    await db.banquetEventOrder.update({
      where: { id: beoId },
      data: {
        finalAmountPaid: beo.depositPaid,
        status: 'completed',
      },
    });

    return {
      folioId: folio.id,
      folioNumber: folio.folioNumber,
      settlementAmount: 0,
      totalPayments: folio.paidAmount,
      outstandingBalance: 0,
      folioStatus: 'closed',
    };
  }

  let gatewayRef: string | undefined;

  // Process payment through gateway if needed
  if (gatewayToken && paymentMethod !== 'cash' && paymentMethod !== 'bank_transfer' && paymentMethod !== 'cheque') {
    try {
      const { createPaymentRouter } = await import('@/lib/payments/router');
      const router = await createPaymentRouter(tenantId);

      const result = await router.processPayment({
        amount: outstandingBalance,
        currency: beo.currency || 'USD',
        customerId: undefined,
        guestId: undefined,
        paymentMethod: paymentMethod as any,
        idempotencyKey: `beo-settlement-${beoId}-${Date.now()}`,
        metadata: {
          beoId,
          type: 'beo_settlement',
          orderNumber: beo.orderNumber,
        },
      });

      if (result.success && result.gatewayRef) {
        gatewayRef = result.gatewayRef;
      }
    } catch (error) {
      console.error('[beo-folio] Payment gateway error, falling back to manual:', error);
    }
  }

  // Post final payment and close folio
  await db.$transaction(async (tx) => {
    // Post final payment as a credit
    await tx.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Final Settlement — BEO ${beo.orderNumber} (${paymentMethod})`,
        category: 'payment',
        quantity: 1,
        unitPrice: -outstandingBalance,
        totalAmount: -outstandingBalance,
        serviceDate: new Date(),
        referenceType: 'BanquetEventOrder',
        referenceId: beo.id,
        taxRate: 0,
        taxAmount: 0,
        postedBy: 'system:beo_settlement',
      },
    });

    // Update and close folio
    await tx.folio.update({
      where: { id: folio.id },
      data: {
        paidAmount: { increment: outstandingBalance },
        balance: 0,
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Update BEO
    await tx.banquetEventOrder.update({
      where: { id: beoId },
      data: {
        finalAmountPaid: beo.depositPaid + outstandingBalance,
        status: 'completed',
      },
    });
  });

  return {
    folioId: folio.id,
    folioNumber: folio.folioNumber,
    settlementAmount: outstandingBalance,
    totalPayments: folio.paidAmount + outstandingBalance,
    outstandingBalance: 0,
    folioStatus: 'closed',
  };
}

/**
 * 4. reverseBEOPosting — Reverses a BEO folio posting.
 *
 * - Creates negative folio line items
 * - Records reversal reason
 * - Updates folio totals
 */
export async function reverseBEOPosting(
  beoId: string,
  tenantId: string,
  reason: string
): Promise<BEOReversalResult> {
  const beo = await db.banquetEventOrder.findFirst({
    where: { id: beoId, tenantId },
  });

  if (!beo) throw new Error('BEO not found');

  // Find all folio line items posted for this BEO (not deposits or payments)
  const existingLines = await db.folioLineItem.findMany({
    where: {
      referenceType: 'BanquetEventOrder',
      referenceId: beoId,
      category: { notIn: ['deposit', 'payment'] },
    },
    select: { id: true, folioId: true, totalAmount: true, description: true, category: true, quantity: true, unitPrice: true, serviceDate: true, referenceType: true, referenceId: true, taxRate: true, taxAmount: true },
  });

  if (existingLines.length === 0) {
    return { lineItemsReversed: 0, totalReversed: 0, reason };
  }

  let totalReversed = 0;
  let reversedCount = 0;

  await db.$transaction(async (tx) => {
    for (const line of existingLines) {
      // Create a reversing line item (negative of original)
      await tx.folioLineItem.create({
        data: {
          folioId: line.folioId,
          description: `REVERSAL: ${line.description}`,
          category: line.category as FolioLineType,
          quantity: line.quantity,
          unitPrice: -(line.unitPrice),
          totalAmount: -(line.totalAmount),
          serviceDate: line.serviceDate,
          referenceType: 'BanquetEventOrder',
          referenceId: beoId,
          taxRate: line.taxRate,
          taxAmount: -(line.taxAmount || 0),
          postedBy: 'system:beo_reversal',
        },
      });

      // Delete original line
      await tx.folioLineItem.delete({ where: { id: line.id } });

      totalReversed += line.totalAmount;
      reversedCount++;
    }

    // Update folio totals (reverse the amounts)
    if (existingLines.length > 0) {
      const folioId = existingLines[0].folioId;
      await tx.folio.update({
        where: { id: folioId },
        data: {
          subtotal: { decrement: Math.max(0, totalReversed) },
          totalAmount: { decrement: Math.max(0, totalReversed) },
          balance: { decrement: Math.max(0, totalReversed) },
        },
      });
    }
  });

  return {
    lineItemsReversed: reversedCount,
    totalReversed: Math.round(totalReversed * 100) / 100,
    reason,
  };
}

/**
 * 5. getBEOSummary — Returns comprehensive BEO financial summary.
 *
 * - Total charges by category (F&B, AV, etc.)
 * - Service charge + tax breakdown
 * - Deposit paid / remaining
 * - Payment history (from folio line items)
 * - Outstanding balance
 */
export async function getBEOSummary(beoId: string): Promise<BEOSummary> {
  const beo = await db.banquetEventOrder.findUnique({
    where: { id: beoId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!beo) throw new Error('BEO not found');

  // ── Charges by category ──────────────────────────────────────────────
  const chargesByCategory: Record<string, number> = {};
  let totalCharges = 0;

  for (const item of beo.items) {
    const cat = item.category || 'miscellaneous';
    chargesByCategory[cat] = (chargesByCategory[cat] || 0) + (item.totalPrice || 0);
    totalCharges += item.totalPrice || 0;
  }

  const serviceCharge = Math.round(totalCharges * DEFAULT_SERVICE_CHARGE_RATE * 100) / 100;
  const tax = Math.round((totalCharges + serviceCharge) * DEFAULT_TAX_RATE * 100) / 100;
  const grandTotal = Math.round((totalCharges + serviceCharge + tax) * 100) / 100;

  // Deposit
  const depositRequired = beo.depositAmount > 0
    ? beo.depositAmount
    : Math.round(totalCharges * DEFAULT_DEPOSIT_PERCENT * 100) / 100;

  // ── Folio info ──────────────────────────────────────────────────────
  const folioLines = await db.folioLineItem.findMany({
    where: {
      referenceType: 'BanquetEventOrder',
      referenceId: beoId,
    },
    orderBy: { createdAt: 'desc' },
  });

  let folioId: string | undefined;
  let folioNumber: string | undefined;
  let folioStatus: string | undefined;

  if (folioLines.length > 0) {
    const folio = await db.folio.findUnique({
      where: { id: folioLines[0].folioId },
      select: { folioNumber: true, status: true },
    });
    folioId = folioLines[0].folioId;
    folioNumber = folio?.folioNumber;
    folioStatus = folio?.status;
  }

  // ── Payment history ─────────────────────────────────────────────────
  const payments: BEOPaymentRecord[] = folioLines
    .filter(line => line.category === 'deposit' || line.category === 'payment')
    .map(line => ({
      id: line.id,
      amount: Math.abs(line.totalAmount),
      method: line.description.includes('cash') ? 'cash'
        : line.description.includes('credit_card') ? 'credit_card'
        : line.description.includes('bank_transfer') ? 'bank_transfer'
        : 'other',
      status: 'completed',
      createdAt: line.createdAt.toISOString(),
      description: line.description,
    }));

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingBalance = Math.max(0, grandTotal - totalPaid);

  return {
    beoId: beo.id,
    orderNumber: beo.orderNumber,
    clientName: beo.clientName,
    totalCharges,
    chargesByCategory,
    serviceCharge,
    tax,
    grandTotal,
    depositRequired,
    depositPaid: beo.depositPaid,
    outstandingDeposit: Math.max(0, depositRequired - beo.depositPaid),
    payments,
    outstandingBalance,
    folioId,
    folioNumber,
    folioStatus,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────────

/**
 * Get or create a booking + folio for an event.
 *
 * Since Folio requires a bookingId, and events may not always have an associated
 * booking, this function:
 * 1. Looks up the associated Event
 * 2. Checks if a booking already exists for this event
 * 3. If not, creates a Guest record for the organizer and a Booking record
 * 4. Creates or finds an open Folio for the booking
 */
async function getOrCreateEventFolio(
  beo: { eventId: string; tenantId: string; propertyId: string; clientName: string; clientEmail?: string | null; clientPhone?: string | null; currency?: string },
  tenantId: string
): Promise<{ folio: { id: string; folioNumber: string } }> {
  // Check if BEO already has folio line items (folio exists)
  const existingLine = await db.folioLineItem.findFirst({
    where: {
      referenceType: 'BanquetEventOrder',
      referenceId: beo.id,
    },
    select: { folioId: true, folio: { select: { id: true, folioNumber: true } } },
  });

  if (existingLine?.folio) {
    return { folio: existingLine.folio };
  }

  // Look for an event booking (a booking associated with this event)
  const event = await db.event.findUnique({
    where: { id: beo.eventId },
  });

  if (!event) {
    throw new Error(`Event ${beo.eventId} not found`);
  }

  // Check if there's a booking associated with this event via event's organizer info
  // Try to find an existing guest that matches the organizer
  let guestId = event.guestId;

  if (!guestId) {
    // Create a guest record for the event organizer
    const [firstName, ...lastNameParts] = beo.clientName.split(' ');
    const lastName = lastNameParts.join(' ') || 'Unknown';

    let guest = await db.guest.findFirst({
      where: {
        tenantId,
        email: beo.clientEmail || '',
      },
      select: { id: true },
    });

    if (!guest) {
      guest = await db.guest.create({
        data: {
          tenantId,
          firstName,
          lastName,
          email: beo.clientEmail || `${beo.clientName.toLowerCase().replace(/\s+/g, '.')}@event.local`,
          phone: beo.clientPhone || '',
          type: 'corporate',
        },
        select: { id: true },
      });
    }
    guestId = guest.id;

    // Link guest to event if possible (update if field exists)
    try {
      await db.event.update({
        where: { id: event.id },
        data: { organizerName: beo.clientName },
      });
    } catch {
      // Field might not be writable in this context, ignore
    }
  }

  // Find or create a booking for this event
  let booking = await db.booking.findFirst({
    where: {
      tenantId,
      primaryGuestId: guestId,
      status: { in: ['draft', 'confirmed', 'checked_in'] },
    },
    select: { id: true, confirmationCode: true, folios: { where: { status: 'open' }, select: { id: true, folioNumber: true }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });

  if (!booking) {
    // Create a new booking for the event
    const confirmationCode = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Look up a valid room type for this property
    const roomType = await db.roomType.findFirst({
      where: { propertyId: event.propertyId, deletedAt: null },
      select: { id: true },
    });
    const roomTypeId = roomType?.id || '00000000-0000-0000-0000-000000000000';

    booking = await db.booking.create({
      data: {
        tenantId,
        propertyId: event.propertyId,
        confirmationCode,
        primaryGuestId: guestId,
        roomTypeId,
        checkIn: event.startDate || new Date(),
        checkOut: event.endDate || new Date(),
        status: 'confirmed',
        currency: beo.currency || 'USD',
        notes: `Auto-created for event: ${event.name}. BEO organizer: ${beo.clientName}`,
        totalAmount: 0,
        paymentStatus: 'unpaid',
      },
      select: { id: true, confirmationCode: true, folios: { where: { status: 'open' }, select: { id: true, folioNumber: true }, take: 1 } },
    });
  }

  // Find or create an open folio for this booking
  let openFolio = booking.folios[0];

  if (!openFolio) {
    // Get the guest for the folio
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { id: true },
    });

    if (!guest) throw new Error('Guest not found');

    const folioNumber = generateFolioNumber('BEO');

    openFolio = await db.folio.create({
      data: {
        tenantId,
        propertyId: event.propertyId,
        bookingId: booking.id,
        folioNumber,
        guestId: guest.id,
        currency: beo.currency || 'USD',
        status: 'open',
      },
      select: { id: true, folioNumber: true },
    });
  }

  return { folio: openFolio };
}
