/**
 * Daily Cash Book Service
 * Tracks daily cash transactions with auto-populate from payments
 */

import { db } from '@/lib/db';

export interface CashBookEntry {
  id: string;
  tenantId: string;
  propertyId: string;
  date: Date;
  openingBalance: number;
  closingBalance: number;
  preparedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'open' | 'closed' | 'adjusted';
  transactions: CashTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CashTransaction {
  id: string;
  cashBookId: string;
  time: string;
  description: string;
  category: 'receipt' | 'payment' | 'transfer_in' | 'transfer_out' | 'petty_cash' | 'refund' | 'advance' | 'settlement';
  amount: number;
  reference?: string;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'online';
  createdBy?: string;
  approved: boolean;
  createdAt: Date;
}

export async function getOrCreateCashBook(tenantId: string, propertyId: string, date: Date) {
  const dateStr = new Date(date);
  dateStr.setHours(0, 0, 0, 0);

  let cashBook = await db.cashBookEntry.findFirst({
    where: {
      tenantId,
      propertyId,
      date: dateStr,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!cashBook) {
    // Get previous day's closing balance as opening balance
    const prevDate = new Date(dateStr);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevBook = await db.cashBookEntry.findFirst({
      where: { tenantId, propertyId, date: prevDate },
    });

    const openingBalance = prevBook?.closingBalance || 0;

    cashBook = await db.cashBookEntry.create({
      data: {
        tenantId,
        propertyId,
        date: dateStr,
        openingBalance,
        closingBalance: openingBalance,
        status: 'open',
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  return parseCashBook(cashBook);
}

export async function addCashEntry(tenantId: string, cashBookId: string, entry: Omit<CashTransaction, 'id' | 'cashBookId' | 'approved' | 'createdAt'>) {
  const cashBook = await db.cashBookEntry.findUnique({ where: { id: cashBookId } });
  if (!cashBook) throw new Error('Cash book not found');
  if (cashBook.status === 'closed') throw new Error('Cash book is already closed');
  if (cashBook.tenantId !== tenantId) throw new Error('Unauthorized');

  const transaction = await db.cashTransaction.create({
    data: {
      cashBookId,
      time: entry.time,
      description: entry.description,
      category: entry.category,
      amount: entry.amount,
      reference: entry.reference,
      paymentMethod: entry.paymentMethod,
      createdBy: entry.createdBy,
      approved: false,
    },
  });

  // Recalculate closing balance
  await recalculateClosingBalance(cashBookId);

  const updated = await db.cashBookEntry.findUnique({
    where: { id: cashBookId },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return parseCashBook(updated!);
}

export async function updateCashEntry(tenantId: string, transactionId: string, updates: Partial<CashTransaction>) {
  const transaction = await db.cashTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new Error('Transaction not found');

  const cashBook = await db.cashBookEntry.findUnique({ where: { id: transaction.cashBookId } });
  if (!cashBook || cashBook.tenantId !== tenantId) throw new Error('Unauthorized');
  if (cashBook.status === 'closed') throw new Error('Cash book is already closed');

  const data: Record<string, unknown> = {};
  if (updates.time !== undefined) data.time = updates.time;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.amount !== undefined) data.amount = updates.amount;
  if (updates.reference !== undefined) data.reference = updates.reference;
  if (updates.paymentMethod !== undefined) data.paymentMethod = updates.paymentMethod;

  await db.cashTransaction.update({
    where: { id: transactionId },
    data,
  });

  await recalculateClosingBalance(transaction.cashBookId);

  const updated = await db.cashBookEntry.findUnique({
    where: { id: transaction.cashBookId },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return parseCashBook(updated!);
}

export async function deleteCashEntry(tenantId: string, transactionId: string) {
  const transaction = await db.cashTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new Error('Transaction not found');

  const cashBook = await db.cashBookEntry.findUnique({ where: { id: transaction.cashBookId } });
  if (!cashBook || cashBook.tenantId !== tenantId) throw new Error('Unauthorized');
  if (cashBook.status === 'closed') throw new Error('Cash book is already closed');

  await db.cashTransaction.delete({ where: { id: transactionId } });
  await recalculateClosingBalance(transaction.cashBookId);

  const updated = await db.cashBookEntry.findUnique({
    where: { id: transaction.cashBookId },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return parseCashBook(updated!);
}

export async function closeCashBook(tenantId: string, cashBookId: string, userId: string) {
  const cashBook = await db.cashBookEntry.findUnique({ where: { id: cashBookId } });
  if (!cashBook) throw new Error('Cash book not found');
  if (cashBook.tenantId !== tenantId) throw new Error('Unauthorized');
  if (cashBook.status === 'closed') throw new Error('Cash book is already closed');

  await recalculateClosingBalance(cashBookId);

  const updated = await db.cashBookEntry.update({
    where: { id: cashBookId },
    data: {
      status: 'closed',
      preparedBy: userId,
    },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return parseCashBook(updated);
}

export async function approveCashBook(tenantId: string, cashBookId: string, approverId: string) {
  const cashBook = await db.cashBookEntry.findUnique({ where: { id: cashBookId } });
  if (!cashBook) throw new Error('Cash book not found');
  if (cashBook.tenantId !== tenantId) throw new Error('Unauthorized');

  const updated = await db.cashBookEntry.update({
    where: { id: cashBookId },
    data: {
      approvedBy: approverId,
      approvedAt: new Date(),
    },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return parseCashBook(updated);
}

export async function getCashBookHistory(tenantId: string, propertyId: string, startDate: Date, endDate: Date) {
  const cashBooks = await db.cashBookEntry.findMany({
    where: {
      tenantId,
      propertyId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'desc' },
    include: { transactions: true },
  });

  return cashBooks.map(parseCashBook);
}

export async function autoPopulateFromPayments(tenantId: string, propertyId: string, date: Date, userId: string) {
  const cashBook = await getOrCreateCashBook(tenantId, propertyId, date);

  if (cashBook.status === 'closed') throw new Error('Cash book is already closed');

  // Find today's payments
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const payments = await db.payment.findMany({
    where: {
      tenantId,
      propertyId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: 'completed',
    },
    include: {
      booking: {
        select: {
          confirmationCode: true,
          primaryGuest: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  let added = 0;

  for (const payment of payments) {
    // Check if already imported
    const existingRef = await db.cashTransaction.findFirst({
      where: { cashBookId: cashBook.id, reference: `PAY-${payment.id}` },
    });

    if (existingRef) continue;

    const guestName = payment.booking?.primaryGuest
      ? `${payment.booking.primaryGuest.firstName} ${payment.booking.primaryGuest.lastName}`
      : 'Guest';

    await db.cashTransaction.create({
      data: {
        cashBookId: cashBook.id,
        time: payment.createdAt.toTimeString().slice(0, 5),
        description: `Payment from ${guestName}${payment.booking?.confirmationCode ? ` (${payment.booking.confirmationCode})` : ''}`,
        category: 'receipt',
        amount: payment.amount,
        reference: `PAY-${payment.id}`,
        paymentMethod: payment.method || 'cash',
        createdBy: userId,
        approved: true,
      },
    });

    added++;
  }

  await recalculateClosingBalance(cashBook.id);

  const updated = await db.cashBookEntry.findUnique({
    where: { id: cashBook.id },
    include: { transactions: { orderBy: { createdAt: 'asc' } } },
  });

  return { ...parseCashBook(updated!), autoPopulated: added };
}

export async function getCashBookReport(tenantId: string, propertyId: string, date: Date) {
  const cashBook = await getOrCreateCashBook(tenantId, propertyId, date);

  const totals: Record<string, { count: number; amount: number }> = {};
  const methodTotals: Record<string, { count: number; amount: number }> = {};

  for (const tx of cashBook.transactions) {
    if (!totals[tx.category]) totals[tx.category] = { count: 0, amount: 0 };
    totals[tx.category].count++;
    totals[tx.category].amount += tx.amount;

    if (!methodTotals[tx.paymentMethod]) methodTotals[tx.paymentMethod] = { count: 0, amount: 0 };
    methodTotals[tx.paymentMethod].count++;
    methodTotals[tx.paymentMethod].amount += tx.amount;
  }

  const totalReceipts = cashBook.transactions
    .filter(t => ['receipt', 'transfer_in', 'advance'].includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPayments = cashBook.transactions
    .filter(t => ['payment', 'transfer_out', 'refund', 'petty_cash', 'settlement'].includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    ...cashBook,
    summary: {
      totalTransactions: cashBook.transactions.length,
      totalReceipts,
      totalPayments,
      netChange: totalReceipts - totalPayments,
      balance: cashBook.closingBalance,
      byCategory: totals,
      byPaymentMethod: methodTotals,
    },
  };
}

async function recalculateClosingBalance(cashBookId: string) {
  const transactions = await db.cashTransaction.findMany({
    where: { cashBookId },
  });

  const cashBook = await db.cashBookEntry.findUnique({ where: { id: cashBookId } });
  if (!cashBook) return;

  let balance = cashBook.openingBalance;

  for (const tx of transactions) {
    if (['receipt', 'transfer_in', 'advance'].includes(tx.category)) {
      balance += tx.amount;
    } else {
      balance -= tx.amount;
    }
  }

  await db.cashBookEntry.update({
    where: { id: cashBookId },
    data: { closingBalance: Math.round(balance * 100) / 100 },
  });
}

function parseCashBook(raw: any): CashBookEntry {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    propertyId: raw.propertyId,
    date: raw.date,
    openingBalance: raw.openingBalance,
    closingBalance: raw.closingBalance,
    preparedBy: raw.preparedBy,
    approvedBy: raw.approvedBy,
    approvedAt: raw.approvedAt,
    status: raw.status,
    transactions: raw.transactions?.map(parseTransaction) || [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function parseTransaction(raw: any): CashTransaction {
  return {
    id: raw.id,
    cashBookId: raw.cashBookId,
    time: raw.time,
    description: raw.description,
    category: raw.category,
    amount: raw.amount,
    reference: raw.reference,
    paymentMethod: raw.paymentMethod,
    createdBy: raw.createdBy,
    approved: raw.approved,
    createdAt: raw.createdAt,
  };
}
