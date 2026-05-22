import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Deterministic UUID helper — same input always produces the same UUID.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31),
  ].join('-');
};

const tenantId = uuid('tenant-1');
const propertyId = uuid('property-1');

const today = new Date();

export async function seedBillingData(prisma: PrismaClient) {
  console.log('Seeding billing, revenue, staff, and marketing data...');

  // ──────────────────────────────────────────────────────────────
  // 0. Clean existing data (child tables first)
  // ──────────────────────────────────────────────────────────────
  console.log('Cleaning billing supplement data...');
  const tables = [
    'journeyAction',
    'journeyCampaign',
    'journeyStage',
    'abandonedBooking',
    'onlineReview',
    'corporateAccount',
    'upsellRule',
    'upsellOffer',
    'upsellCampaign',
    'salaryComponent',
    'payrollEntry',
    'payrollPeriod',
    'lastMinuteTrigger',
    'overbookingSlot',
    'overbookingConfig',
    'rateShoppingResult',
    'rateShoppingCompetitor',
    'apPayment',
    'apInvoiceLine',
    'apInvoice',
    'tdsRecord',
    'tcsRecord',
    'gstEInvoice',
    'gstSacCode',
    'gstSettings',
    'depositSchedule',
    'cashTransaction',
    'cashBookEntry',
    'cashFlowForecast',
    'budgetLine',
    'budget',
    'journalEntryLine',
    'journalEntry',
    'financialAccount',
    'exchangeRate',
    'folioTransfer',
    'creditNote',
  ] as const;

  for (const table of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[table].deleteMany({});
    } catch {
      // Ignore if table doesn't exist yet
    }
  }
  console.log('Billing supplement data cleaned.');

  // ──────────────────────────────────────────────────────────────
  // 1. CreditNote — 4 notes linked to folios and guests
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding CreditNotes...');
  await prisma.creditNote.createMany({
    data: [
      {
        id: uuid('credit-note-1'),
        tenantId,
        propertyId,
        folioId: uuid('folio-1'),
        creditNoteNumber: 'CN-2024-001',
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        reason: 'service_recovery',
        description: 'Complimentary for AC noise complaint',
        items: JSON.stringify([{ description: 'Room rate adjustment', amount: 2750 }]),
        subtotal: 2750,
        taxAmount: 495,
        totalAmount: 3245,
        currency: 'INR',
        status: 'applied',
        appliedAmount: 3245,
        remainingAmount: 0,
        issuedBy: uuid('user-1'),
        approvedBy: uuid('user-1'),
      },
      {
        id: uuid('credit-note-2'),
        tenantId,
        propertyId,
        folioId: uuid('folio-2'),
        creditNoteNumber: 'CN-2024-002',
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        reason: 'discount',
        description: 'Loyalty discount for silver member',
        items: JSON.stringify([{ description: 'Loyalty discount', amount: 1500 }]),
        subtotal: 1500,
        taxAmount: 270,
        totalAmount: 1770,
        currency: 'INR',
        status: 'issued',
        appliedAmount: 0,
        remainingAmount: 1770,
        issuedBy: uuid('user-2'),
      },
      {
        id: uuid('credit-note-3'),
        tenantId,
        propertyId,
        folioId: uuid('folio-3'),
        creditNoteNumber: 'CN-2024-003',
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        reason: 'correction',
        description: 'Overcharged minibar items',
        items: JSON.stringify([{ description: 'Minibar correction', amount: 850 }]),
        subtotal: 850,
        taxAmount: 153,
        totalAmount: 1003,
        currency: 'INR',
        status: 'partially_applied',
        appliedAmount: 500,
        remainingAmount: 503,
        issuedBy: uuid('user-1'),
      },
      {
        id: uuid('credit-note-4'),
        tenantId,
        propertyId,
        folioId: uuid('folio-4'),
        creditNoteNumber: 'CN-2024-004',
        guestId: uuid('guest-4'),
        bookingId: uuid('booking-5'),
        reason: 'refund',
        description: 'Late checkout fee waived',
        items: JSON.stringify([{ description: 'Late checkout waiver', amount: 2000 }]),
        subtotal: 2000,
        taxAmount: 360,
        totalAmount: 2360,
        currency: 'INR',
        status: 'issued',
        appliedAmount: 0,
        remainingAmount: 2360,
        issuedBy: uuid('user-2'),
        approvedBy: uuid('user-1'),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 2. FolioTransfer — 3 transfers between folios
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding FolioTransfers...');
  await prisma.folioTransfer.createMany({
    data: [
      {
        id: uuid('folio-transfer-1'),
        tenantId,
        propertyId,
        fromFolioId: uuid('folio-1'),
        toFolioId: uuid('folio-2'),
        bookingId: uuid('booking-1'),
        amount: 5000,
        currency: 'INR',
        reason: 'split_bill',
        description: 'Splitting shared expenses between guests',
        status: 'completed',
        transferredBy: uuid('user-2'),
        approvedBy: uuid('user-1'),
      },
      {
        id: uuid('folio-transfer-2'),
        tenantId,
        propertyId,
        fromFolioId: uuid('folio-2'),
        toFolioId: uuid('folio-3'),
        bookingId: uuid('booking-2'),
        amount: 3500,
        currency: 'INR',
        reason: 'correction',
        description: 'Correcting misplaced restaurant charge',
        status: 'completed',
        transferredBy: uuid('user-1'),
      },
      {
        id: uuid('folio-transfer-3'),
        tenantId,
        propertyId,
        fromFolioId: uuid('folio-5'),
        toFolioId: uuid('folio-6'),
        bookingId: uuid('booking-4'),
        amount: 12000,
        currency: 'INR',
        reason: 'group_transfer',
        description: 'Transferring banquet charges to company folio',
        status: 'completed',
        transferredBy: uuid('user-2'),
        approvedBy: uuid('user-1'),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 3. ExchangeRate — 6 rates (USD, EUR, GBP, AED, JPY, SGD to INR)
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding ExchangeRates...');
  await prisma.exchangeRate.createMany({
    data: [
      { id: uuid('xrate-usd-inr'), tenantId, fromCurrency: 'USD', toCurrency: 'INR', rate: 83.45, source: 'api', isActive: true },
      { id: uuid('xrate-eur-inr'), tenantId, fromCurrency: 'EUR', toCurrency: 'INR', rate: 91.12, source: 'api', isActive: true },
      { id: uuid('xrate-gbp-inr'), tenantId, fromCurrency: 'GBP', toCurrency: 'INR', rate: 105.78, source: 'api', isActive: true },
      { id: uuid('xrate-aed-inr'), tenantId, fromCurrency: 'AED', toCurrency: 'INR', rate: 22.72, source: 'api', isActive: true },
      { id: uuid('xrate-jpy-inr'), tenantId, fromCurrency: 'JPY', toCurrency: 'INR', rate: 0.558, source: 'api', isActive: true },
      { id: uuid('xrate-sgd-inr'), tenantId, fromCurrency: 'SGD', toCurrency: 'INR', rate: 62.18, source: 'api', isActive: true },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 4. FinancialAccount — 10 accounts
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding FinancialAccounts...');
  await prisma.financialAccount.createMany({
    data: [
      { id: uuid('fa-room-rev'), tenantId, propertyId, code: '4100', name: 'Room Revenue', accountType: 'revenue', category: 'room', description: 'Revenue from room rentals', sortOrder: 1 },
      { id: uuid('fa-fb-rev'), tenantId, propertyId, code: '4200', name: 'Food & Beverage Revenue', accountType: 'revenue', category: 'f_b', description: 'Revenue from restaurants, bars, and room service', sortOrder: 2 },
      { id: uuid('fa-spa-rev'), tenantId, propertyId, code: '4300', name: 'Spa Revenue', accountType: 'revenue', category: 'other', description: 'Revenue from spa and wellness services', sortOrder: 3 },
      { id: uuid('fa-events-rev'), tenantId, propertyId, code: '4400', name: 'Events & Banquets Revenue', accountType: 'revenue', category: 'events', description: 'Revenue from event space rentals and banquets', sortOrder: 4 },
      { id: uuid('fa-payroll'), tenantId, propertyId, code: '5100', name: 'Payroll Expense', accountType: 'expense', category: 'other', subCategory: 'Staff Costs', description: 'Employee salaries, wages, and benefits', sortOrder: 10 },
      { id: uuid('fa-utilities'), tenantId, propertyId, code: '5200', name: 'Utilities Expense', accountType: 'expense', category: 'other', subCategory: 'Operations', description: 'Electricity, water, gas, internet', sortOrder: 11 },
      { id: uuid('fa-maintenance'), tenantId, propertyId, code: '5300', name: 'Maintenance Expense', accountType: 'expense', category: 'other', subCategory: 'Operations', description: 'Repairs, preventive maintenance, supplies', sortOrder: 12 },
      { id: uuid('fa-marketing'), tenantId, propertyId, code: '5400', name: 'Marketing Expense', accountType: 'expense', category: 'other', subCategory: 'Sales & Marketing', description: 'Advertising, promotions, OTA commissions', sortOrder: 13 },
      { id: uuid('fa-tax-payable'), tenantId, propertyId, code: '2100', name: 'GST Payable', accountType: 'liability', category: 'other', subCategory: 'Tax', description: 'GST collected on sales', sortOrder: 20 },
      { id: uuid('fa-bank'), tenantId, propertyId, code: '1100', name: 'Operating Bank Account', accountType: 'asset', category: 'other', subCategory: 'Cash & Bank', description: 'Primary operating bank account — SBI', sortOrder: 30 },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 5. JournalEntry — 4 entries with nested JournalEntryLine
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding JournalEntries...');
  await prisma.journalEntry.createMany({
    data: [
      {
        id: uuid('je-1'),
        tenantId,
        propertyId,
        entryNumber: 'JE-2024-001',
        date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
        description: 'Monthly room revenue accrual',
        reference: 'INV-BATCH-JAN',
        status: 'posted',
        postedBy: uuid('user-1'),
      },
      {
        id: uuid('je-2'),
        tenantId,
        propertyId,
        entryNumber: 'JE-2024-002',
        date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        description: 'F&B supplier payment',
        reference: 'PAY-VOUCHER-042',
        status: 'posted',
        postedBy: uuid('user-1'),
      },
      {
        id: uuid('je-3'),
        tenantId,
        propertyId,
        entryNumber: 'JE-2024-003',
        date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        description: 'Payroll processing for January',
        reference: 'PAYROLL-JAN-2024',
        status: 'posted',
        postedBy: uuid('user-1'),
      },
      {
        id: uuid('je-4'),
        tenantId,
        propertyId,
        entryNumber: 'JE-2024-004',
        date: new Date(),
        description: 'Electricity bill accrual',
        reference: 'UTIL-ELEC-FEB',
        status: 'draft',
      },
    ],
  });

  // JournalEntryLine — nested under each journal entry
  await prisma.journalEntryLine.createMany({
    data: [
      // JE-1: Room revenue accrual — Dr Bank / Cr Room Revenue
      { id: uuid('jel-1-1'), journalEntryId: uuid('je-1'), accountId: uuid('fa-bank'), debitAmount: 450000, creditAmount: 0, description: 'Cash received for room revenue' },
      { id: uuid('jel-1-2'), journalEntryId: uuid('je-1'), accountId: uuid('fa-room-rev'), debitAmount: 0, creditAmount: 450000, description: 'Room revenue earned' },
      // JE-2: Supplier payment — Dr F&B (already expensed) / Cr Bank
      { id: uuid('jel-2-1'), journalEntryId: uuid('je-2'), accountId: uuid('fa-fb-rev'), debitAmount: 0, creditAmount: 85000, description: 'F&B revenue adjustment' },
      { id: uuid('jel-2-2'), journalEntryId: uuid('je-2'), accountId: uuid('fa-bank'), debitAmount: 85000, creditAmount: 0, description: 'Payment received from F&B supplier refund' },
      // JE-3: Payroll — Dr Payroll / Cr Bank
      { id: uuid('jel-3-1'), journalEntryId: uuid('je-3'), accountId: uuid('fa-payroll'), debitAmount: 380000, creditAmount: 0, description: 'Total payroll for January' },
      { id: uuid('jel-3-2'), journalEntryId: uuid('je-3'), accountId: uuid('fa-bank'), debitAmount: 0, creditAmount: 380000, description: 'Payroll disbursed from bank' },
      { id: uuid('jel-3-3'), journalEntryId: uuid('je-3'), accountId: uuid('fa-tax-payable'), debitAmount: 45000, creditAmount: 0, description: 'TDS remitted on salaries' },
      // JE-4: Electricity accrual — Dr Utilities / Cr Tax Payable
      { id: uuid('jel-4-1'), journalEntryId: uuid('je-4'), accountId: uuid('fa-utilities'), debitAmount: 125000, creditAmount: 0, description: 'Electricity expense for February' },
      { id: uuid('jel-4-2'), journalEntryId: uuid('je-4'), accountId: uuid('fa-tax-payable'), debitAmount: 0, creditAmount: 22500, description: 'GST on electricity bill' },
      { id: uuid('jel-4-3'), journalEntryId: uuid('je-4'), accountId: uuid('fa-bank'), debitAmount: 0, creditAmount: 102500, description: 'Net electricity payable' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 6. Budget — 1 budget for FY2025
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding Budget...');
  await prisma.budget.createMany({
    data: [
      {
        id: uuid('budget-fy2025'),
        tenantId,
        propertyId,
        name: 'FY 2025 Annual Budget',
        fiscalYear: 2025,
        periodType: 'monthly',
        status: 'active',
        totalBudget: 8500000,
        totalActual: 6200000,
        variance: -2300000,
        approvedBy: uuid('user-1'),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 7. BudgetLine — 12 lines (1 per month) for room revenue account
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding BudgetLines...');
  const budgetLinesData = [
    { id: uuid('bl-room-1'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 1, budgetedAmt: 500000, actualAmt: 485000, variance: -15000, pctUsed: 97 },
    { id: uuid('bl-room-2'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 2, budgetedAmt: 450000, actualAmt: 460000, variance: 10000, pctUsed: 102.2 },
    { id: uuid('bl-room-3'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 3, budgetedAmt: 550000, actualAmt: 520000, variance: -30000, pctUsed: 94.5 },
    { id: uuid('bl-room-4'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 4, budgetedAmt: 600000, actualAmt: 580000, variance: -20000, pctUsed: 96.7 },
    { id: uuid('bl-room-5'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 5, budgetedAmt: 650000, actualAmt: 635000, variance: -15000, pctUsed: 97.7 },
    { id: uuid('bl-room-6'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 6, budgetedAmt: 700000, actualAmt: 720000, variance: 20000, pctUsed: 102.9 },
    { id: uuid('bl-room-7'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 7, budgetedAmt: 680000, actualAmt: 650000, variance: -30000, pctUsed: 95.6 },
    { id: uuid('bl-room-8'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 8, budgetedAmt: 620000, actualAmt: 600000, variance: -20000, pctUsed: 96.8 },
    { id: uuid('bl-room-9'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 9, budgetedAmt: 580000, actualAmt: 0, variance: 0, pctUsed: 0 },
    { id: uuid('bl-room-10'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 10, budgetedAmt: 550000, actualAmt: 0, variance: 0, pctUsed: 0 },
    { id: uuid('bl-room-11'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 11, budgetedAmt: 520000, actualAmt: 0, variance: 0, pctUsed: 0 },
    { id: uuid('bl-room-12'), budgetId: uuid('budget-fy2025'), accountId: uuid('fa-room-rev'), period: 12, budgetedAmt: 500000, actualAmt: 0, variance: 0, pctUsed: 0 },
  ];
  await prisma.budgetLine.createMany({ data: budgetLinesData });

  // ──────────────────────────────────────────────────────────────
  // 8. CashFlowForecast — 6 monthly forecasts
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding CashFlowForecasts...');
  await prisma.cashFlowForecast.createMany({
    data: [
      { id: uuid('cff-1'), tenantId, propertyId, period: new Date(2025, 0, 1), openingBalance: 2500000, totalInflow: 1200000, totalOutflow: 850000, netCashFlow: 350000, closingBalance: 2850000, roomRevenue: 600000, fbRevenue: 350000, otherRevenue: 250000, payrollExpense: 400000, opexExpense: 300000, capexExpense: 150000, forecastType: 'actual' },
      { id: uuid('cff-2'), tenantId, propertyId, period: new Date(2025, 1, 1), openingBalance: 2850000, totalInflow: 1100000, totalOutflow: 800000, netCashFlow: 300000, closingBalance: 3150000, roomRevenue: 550000, fbRevenue: 320000, otherRevenue: 230000, payrollExpense: 380000, opexExpense: 280000, capexExpense: 140000, forecastType: 'actual' },
      { id: uuid('cff-3'), tenantId, propertyId, period: new Date(2025, 2, 1), openingBalance: 3150000, totalInflow: 1350000, totalOutflow: 900000, netCashFlow: 450000, closingBalance: 3600000, roomRevenue: 700000, fbRevenue: 400000, otherRevenue: 250000, payrollExpense: 420000, opexExpense: 320000, capexExpense: 160000, forecastType: 'actual' },
      { id: uuid('cff-4'), tenantId, propertyId, period: new Date(2025, 3, 1), openingBalance: 3600000, totalInflow: 1400000, totalOutflow: 950000, netCashFlow: 450000, closingBalance: 4050000, roomRevenue: 750000, fbRevenue: 400000, otherRevenue: 250000, payrollExpense: 430000, opexExpense: 340000, capexExpense: 180000, forecastType: 'projected' },
      { id: uuid('cff-5'), tenantId, propertyId, period: new Date(2025, 4, 1), openingBalance: 4050000, totalInflow: 1500000, totalOutflow: 1000000, netCashFlow: 500000, closingBalance: 4550000, roomRevenue: 800000, fbRevenue: 430000, otherRevenue: 270000, payrollExpense: 450000, opexExpense: 350000, capexExpense: 200000, forecastType: 'projected' },
      { id: uuid('cff-6'), tenantId, propertyId, period: new Date(2025, 5, 1), openingBalance: 4550000, totalInflow: 1600000, totalOutflow: 1050000, netCashFlow: 550000, closingBalance: 5100000, roomRevenue: 850000, fbRevenue: 470000, otherRevenue: 280000, payrollExpense: 470000, opexExpense: 360000, capexExpense: 220000, forecastType: 'projected' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 9. CashBookEntry — 3 entries with nested CashTransaction
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding CashBookEntries...');
  await prisma.cashBookEntry.createMany({
    data: [
      { id: uuid('cbe-1'), tenantId, propertyId, date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), openingBalance: 150000, closingBalance: 285000, preparedBy: uuid('user-2'), approvedBy: uuid('user-1'), status: 'closed' },
      { id: uuid('cbe-2'), tenantId, propertyId, date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), openingBalance: 285000, closingBalance: 310000, preparedBy: uuid('user-2'), approvedBy: uuid('user-1'), status: 'closed' },
      { id: uuid('cbe-3'), tenantId, propertyId, date: today, openingBalance: 310000, closingBalance: 310000, preparedBy: uuid('user-2'), status: 'open' },
    ],
  });

  await prisma.cashTransaction.createMany({
    data: [
      // Day 1 transactions
      { id: uuid('ctx-1-1'), cashBookId: uuid('cbe-1'), time: '08:15', description: 'Guest checkout settlement — Amit Mukherjee', category: 'receipt', amount: 17990, reference: 'FOL-001', paymentMethod: 'card', createdBy: uuid('user-2'), approved: true },
      { id: uuid('ctx-1-2'), cashBookId: uuid('cbe-1'), time: '09:30', description: 'Advance payment for booking RS-2024-004', category: 'receipt', amount: 50000, reference: 'RS-2024-004', paymentMethod: 'bank_transfer', createdBy: uuid('user-2'), approved: true },
      { id: uuid('ctx-1-3'), cashBookId: uuid('cbe-1'), time: '11:00', description: 'Petty cash — bell desk tips', category: 'payment', amount: 2000, reference: 'PC-001', paymentMethod: 'cash', createdBy: uuid('user-2'), approved: true },
      { id: uuid('ctx-1-4'), cashBookId: uuid('cbe-1'), time: '14:30', description: 'Refund to guest Pooja Saha — cancelled service', category: 'refund', amount: 1500, reference: 'RF-001', paymentMethod: 'card', createdBy: uuid('user-2'), approved: true },
      // Day 2 transactions
      { id: uuid('ctx-2-1'), cashBookId: uuid('cbe-2'), time: '07:45', description: 'Room service cash collection — overnight', category: 'receipt', amount: 4500, reference: 'RS-OVN', paymentMethod: 'cash', createdBy: uuid('user-2'), approved: true },
      { id: uuid('ctx-2-2'), cashBookId: uuid('cbe-2'), time: '10:00', description: 'Laundry service payment to vendor', category: 'payment', amount: 12000, reference: 'LAUN-003', paymentMethod: 'bank_transfer', createdBy: uuid('user-2'), approved: true },
      { id: uuid('ctx-2-3'), cashBookId: uuid('cbe-2'), time: '16:00', description: 'Restaurant dinner revenue', category: 'receipt', amount: 22500, reference: 'REST-005', paymentMethod: 'upi', createdBy: uuid('user-2'), approved: true },
      // Day 3 transactions (in progress)
      { id: uuid('ctx-3-1'), cashBookId: uuid('cbe-3'), time: '09:00', description: 'Morning checkout — Vikram Singh', category: 'receipt', amount: 35000, reference: 'FOL-004', paymentMethod: 'card', createdBy: uuid('user-2') },
      { id: uuid('ctx-3-2'), cashBookId: uuid('cbe-3'), time: '10:30', description: 'Mini bar restocking expense', category: 'payment', amount: 8500, reference: 'MB-RESTOCK', paymentMethod: 'cash', createdBy: uuid('user-2') },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 10. DepositSchedule — 8 schedules for bookings 1-6
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding DepositSchedules...');
  await prisma.depositSchedule.createMany({
    data: [
      { id: uuid('ds-1a'), tenantId, bookingId: uuid('booking-1'), name: 'Booking Deposit', milestoneType: 'at_booking', milestoneDays: 0, percentOfTotal: 30, dueAmount: 5397, paidAmount: 5397, status: 'paid', paymentMethod: 'card', paidAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-1b'), tenantId, bookingId: uuid('booking-1'), name: 'Balance at Check-in', milestoneType: 'at_checkin', milestoneDays: 0, percentOfTotal: 70, dueAmount: 12593, paidAmount: 12593, status: 'paid', paymentMethod: 'card', paidAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-2a'), tenantId, bookingId: uuid('booking-2'), name: 'Full Payment', milestoneType: 'at_booking', milestoneDays: 0, percentOfTotal: 100, dueAmount: 53160, paidAmount: 53160, status: 'paid', paymentMethod: 'bank_transfer', paidAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-3a'), tenantId, bookingId: uuid('booking-3'), name: '50% Advance', milestoneType: 'pre_arrival', milestoneDays: 7, percentOfTotal: 50, dueAmount: 11745, paidAmount: 11745, status: 'paid', paymentMethod: 'upi', paidAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-3b'), tenantId, bookingId: uuid('booking-3'), name: 'Balance Before Arrival', milestoneType: 'pre_arrival', milestoneDays: 1, percentOfTotal: 50, dueAmount: 11745, paidAmount: 0, status: 'pending' },
      { id: uuid('ds-4a'), tenantId, bookingId: uuid('booking-4'), name: 'Luxury Suite Deposit', milestoneType: 'at_booking', milestoneDays: 0, percentOfTotal: 25, dueAmount: 28450, paidAmount: 28450, status: 'paid', paymentMethod: 'card', paidAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-5a'), tenantId, bookingId: uuid('booking-5'), name: 'Standard Advance', milestoneType: 'pre_arrival', milestoneDays: 3, percentOfTotal: 100, dueAmount: 11430, paidAmount: 0, status: 'pending', milestoneDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000) },
      { id: uuid('ds-6a'), tenantId, bookingId: uuid('booking-6'), name: 'Walk-in Full Payment', milestoneType: 'at_checkin', milestoneDays: 0, percentOfTotal: 100, dueAmount: 11430, paidAmount: 11430, status: 'paid', paymentMethod: 'cash', paidAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 11. GstSettings — 1 GST settings record
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding GstSettings...');
  await prisma.gstSettings.createMany({
    data: [
      {
        id: uuid('gst-settings-1'),
        tenantId,
        propertyId,
        gstin: '19AABCR1234F1ZP',
        legalName: 'Royal Stay Hotels Private Limited',
        tradeName: 'Royal Stay Kolkata',
        stateCode: '19',
        stateName: 'West Bengal',
        address: '123 Park Street, Kolkata',
        city: 'Kolkata',
        pincode: '700016',
        registrationType: 'regular',
        scheme: 'regular',
        gstEntityType: 'private_limited',
        fssaiLicenseNo: '12345678901234',
        tcsRate: 0.01,
        tcsThreshold: 100000,
        tds194cRate: 0.01,
        tds194hRate: 0.05,
        tds194jRate: 0.10,
        panNumber: 'AABCR1234F',
        isActive: true,
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 12. GstSacCode — 5 SAC codes
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding GstSacCodes...');
  await prisma.gstSacCode.createMany({
    data: [
      { id: uuid('sac-room'), tenantId, serviceType: 'Accommodation', sacCode: '996311', description: 'Hotel accommodation services', cgstRate: 0.06, sgstRate: 0.06, igstRate: 0.12, cessRate: 0 },
      { id: uuid('sac-restaurant'), tenantId, serviceType: 'Restaurant', sacCode: '996312', description: 'Restaurant and food services within hotel', cgstRate: 0.025, sgstRate: 0.025, igstRate: 0.05, cessRate: 0 },
      { id: uuid('sac-banquet'), tenantId, serviceType: 'Banquet', sacCode: '996313', description: 'Banquet hall and conference room rental', cgstRate: 0.06, sgstRate: 0.06, igstRate: 0.12, cessRate: 0 },
      { id: uuid('sac-spa'), tenantId, serviceType: 'Spa & Wellness', sacCode: '999612', description: 'Spa, wellness and beauty services', cgstRate: 0.05, sgstRate: 0.05, igstRate: 0.10, cessRate: 0 },
      { id: uuid('sac-laundry'), tenantId, serviceType: 'Laundry', sacCode: '998511', description: 'Laundry and dry cleaning services', cgstRate: 0.05, sgstRate: 0.05, igstRate: 0.10, cessRate: 0 },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 13. GstEInvoice — 3 e-invoices linked to folios
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding GstEInvoices...');
  await prisma.gstEInvoice.createMany({
    data: [
      {
        id: uuid('einv-1'),
        tenantId,
        propertyId,
        folioId: uuid('folio-1'),
        bookingId: uuid('booking-1'),
        guestId: uuid('guest-1'),
        irn: '6a2f8c1e3d4b5678901234abcdef5678',
        ackNo: '112024011567890',
        ackDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: 'generated',
        supplyType: 'b2c',
        placeOfSupply: '19',
        invoiceNumber: 'INV-2024-001',
        invoiceDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        totalValue: 15242.86,
        totalCgst: 914.57,
        totalSgst: 914.57,
        totalIgst: 0,
        totalCess: 0,
        totalTax: 1829.14,
        totalAmount: 17072,
        generatedBy: uuid('user-1'),
      },
      {
        id: uuid('einv-2'),
        tenantId,
        propertyId,
        folioId: uuid('folio-2'),
        bookingId: uuid('booking-3'),
        guestId: uuid('guest-2'),
        irn: '7b3e9d2f4e5c6789012345bcdefg6789',
        ackNo: '112024021567891',
        ackDate: new Date(),
        status: 'generated',
        supplyType: 'b2c',
        placeOfSupply: '19',
        invoiceNumber: 'INV-2024-002',
        invoiceDate: new Date(),
        totalValue: 19894.29,
        totalCgst: 1193.66,
        totalSgst: 1193.66,
        totalIgst: 0,
        totalCess: 0,
        totalTax: 2387.31,
        totalAmount: 22281.60,
        generatedBy: uuid('user-2'),
      },
      {
        id: uuid('einv-3'),
        tenantId,
        propertyId,
        folioId: uuid('folio-3'),
        bookingId: uuid('booking-2'),
        guestId: uuid('guest-3'),
        status: 'draft',
        supplyType: 'b2b',
        placeOfSupply: '19',
        invoiceNumber: 'INV-2024-003',
        invoiceDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        totalValue: 45050.85,
        totalCgst: 2703.05,
        totalSgst: 2703.05,
        totalIgst: 0,
        totalCess: 0,
        totalTax: 5406.10,
        totalAmount: 50456.95,
        gstSettingsId: uuid('gst-settings-1'),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 14. TcsRecord — 4 TCS records
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding TcsRecords...');
  await prisma.tcsRecord.createMany({
    data: [
      {
        id: uuid('tcs-1'),
        tenantId,
        propertyId,
        bookingId: uuid('booking-1'),
        guestId: uuid('guest-1'),
        folioId: uuid('folio-1'),
        collectionDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        panNumber: 'BMKPM1234A',
        guestName: 'Amit Mukherjee',
        guestAddress: '45 Lake Gardens, Kolkata',
        bookingAmount: 17990,
        tcsRate: 0.01,
        tcsAmount: 180,
        thresholdExceeded: false,
        status: 'collected',
        period: 'January 2024',
      },
      {
        id: uuid('tcs-2'),
        tenantId,
        propertyId,
        bookingId: uuid('booking-2'),
        guestId: uuid('guest-3'),
        folioId: uuid('folio-3'),
        collectionDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        panNumber: 'BRPBH5678C',
        guestName: 'Rahul Banerjee',
        guestAddress: '12 Ballygunge Place, Kolkata',
        bookingAmount: 53160,
        tcsRate: 0.01,
        tcsAmount: 531.60,
        thresholdExceeded: false,
        challanNo: 'CHLN-TCS-2024-001',
        challanDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        depositedAmount: 531.60,
        status: 'deposited',
        period: 'January 2024',
      },
      {
        id: uuid('tcs-3'),
        tenantId,
        propertyId,
        bookingId: uuid('booking-4'),
        guestId: uuid('guest-5'),
        folioId: uuid('folio-5'),
        collectionDate: new Date(),
        panNumber: 'BVSPS9012D',
        guestName: 'Vikram Singh',
        guestAddress: '56 Sector V, Kolkata',
        bookingAmount: 113800,
        tcsRate: 0.01,
        tcsAmount: 1138,
        thresholdExceeded: true,
        status: 'collected',
        period: 'February 2024',
      },
      {
        id: uuid('tcs-4'),
        tenantId,
        propertyId,
        bookingId: uuid('booking-6'),
        guestId: uuid('guest-6'),
        folioId: uuid('folio-6'),
        collectionDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        guestName: 'Rina Chatterjee',
        guestAddress: '89 Gariahat, Kolkata',
        bookingAmount: 11430,
        tcsRate: 0.02,
        tcsAmount: 228.60,
        thresholdExceeded: false,
        status: 'collected',
        period: 'January 2024',
        notes: 'No PAN provided — higher TCS rate applied',
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 15. TdsRecord — 3 TDS records
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding TdsRecords...');
  await prisma.tdsRecord.createMany({
    data: [
      {
        id: uuid('tds-1'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-1'),
        vendorName: 'Premium Linen Supply',
        panNumber: 'ABCDP1234F',
        section: '194C',
        paymentDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
        paymentAmount: 37500,
        tdsRate: 0.01,
        tdsAmount: 375,
        challanNo: 'CHLN-TDS-2024-001',
        challanDate: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
        depositedAmount: 375,
        status: 'deposited',
        period: 'January 2024',
      },
      {
        id: uuid('tds-2'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-2'),
        vendorName: 'CleanPro Services',
        panNumber: 'BCDSP5678G',
        section: '194C',
        paymentDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        paymentAmount: 25000,
        tdsRate: 0.02,
        tdsAmount: 500,
        status: 'deducted',
        period: 'January 2024',
      },
      {
        id: uuid('tds-3'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-3'),
        vendorName: 'Tech Solutions India',
        panNumber: 'CDETJ9012H',
        section: '194J',
        paymentDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        paymentAmount: 85000,
        tdsRate: 0.10,
        tdsAmount: 8500,
        challanNo: 'CHLN-TDS-2024-002',
        challanDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
        depositedAmount: 8500,
        status: 'deposited',
        period: 'December 2023',
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 16. ApInvoice — 4 AP invoices from vendors
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding ApInvoices...');
  await prisma.apInvoice.createMany({
    data: [
      {
        id: uuid('apinv-1'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-1'),
        vendorName: 'Premium Linen Supply',
        invoiceNumber: 'PLS-2024-001',
        invoiceDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000),
        subtotal: 37500,
        taxAmount: 6750,
        totalAmount: 44250,
        currency: 'INR',
        department: 'Housekeeping',
        glAccount: '5300',
        status: 'approved',
        paymentTerms: 'net_30',
        approvedBy: uuid('user-1'),
        approvedAt: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('apinv-2'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-2'),
        vendorName: 'CleanPro Services',
        invoiceNumber: 'CPS-2024-010',
        invoiceDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        subtotal: 25000,
        taxAmount: 4500,
        totalAmount: 29500,
        currency: 'INR',
        department: 'Housekeeping',
        glAccount: '5300',
        status: 'pending',
        paymentTerms: 'net_15',
      },
      {
        id: uuid('apinv-3'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-3'),
        vendorName: 'Tech Solutions India',
        invoiceNumber: 'TSI-2024-005',
        invoiceDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 37 * 24 * 60 * 60 * 1000),
        subtotal: 85000,
        taxAmount: 15300,
        totalAmount: 100300,
        currency: 'INR',
        department: 'IT',
        glAccount: '5200',
        status: 'reviewed',
        paymentTerms: 'net_45',
      },
      {
        id: uuid('apinv-4'),
        tenantId,
        propertyId,
        vendorId: uuid('vendor-1'),
        vendorName: 'Premium Linen Supply',
        invoiceNumber: 'PLS-2024-002',
        invoiceDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 27 * 24 * 60 * 60 * 1000),
        subtotal: 42000,
        taxAmount: 7560,
        totalAmount: 49560,
        currency: 'INR',
        department: 'Housekeeping',
        glAccount: '5300',
        status: 'pending',
        paymentTerms: 'net_30',
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 17. ApInvoiceLine — 12 lines across invoices
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding ApInvoiceLines...');
  await prisma.apInvoiceLine.createMany({
    data: [
      // Invoice 1: Premium Linen Supply — linen items
      { id: uuid('apil-1-1'), invoiceId: uuid('apinv-1'), description: 'King-size bed sheets (200 pcs)', quantity: 200, unitPrice: 75, taxRate: 0.18, totalAmount: 17700, glAccount: '5300' },
      { id: uuid('apil-1-2'), invoiceId: uuid('apinv-1'), description: 'Pillow covers (400 pcs)', quantity: 400, unitPrice: 25, taxRate: 0.18, totalAmount: 11800, glAccount: '5300' },
      { id: uuid('apil-1-3'), invoiceId: uuid('apinv-1'), description: 'Bath towels (300 pcs)', quantity: 300, unitPrice: 45, taxRate: 0.18, totalAmount: 15930, glAccount: '5300' },
      // Invoice 2: CleanPro Services
      { id: uuid('apil-2-1'), invoiceId: uuid('apinv-2'), description: 'Deep cleaning — Floor 1 to 4', quantity: 1, unitPrice: 15000, taxRate: 0.18, totalAmount: 17700, glAccount: '5300' },
      { id: uuid('apil-2-2'), invoiceId: uuid('apinv-2'), description: 'Window cleaning — exterior', quantity: 1, unitPrice: 8000, taxRate: 0.18, totalAmount: 9440, glAccount: '5300' },
      { id: uuid('apil-2-3'), invoiceId: uuid('apinv-2'), description: 'Carpet shampooing — lobby', quantity: 1, unitPrice: 2000, taxRate: 0.18, totalAmount: 2360, glAccount: '5300' },
      // Invoice 3: Tech Solutions India
      { id: uuid('apil-3-1'), invoiceId: uuid('apinv-3'), description: 'Wi-Fi access points — 20 units', quantity: 20, unitPrice: 2500, taxRate: 0.18, totalAmount: 59000, glAccount: '5200' },
      { id: uuid('apil-3-2'), invoiceId: uuid('apinv-3'), description: 'Network switch — 48 port managed', quantity: 2, unitPrice: 8500, taxRate: 0.18, totalAmount: 20060, glAccount: '5200' },
      { id: uuid('apil-3-3'), invoiceId: uuid('apinv-3'), description: 'Fiber optic cabling — 500m', quantity: 500, unitPrice: 35, taxRate: 0.18, totalAmount: 20650, glAccount: '5200' },
      // Invoice 4: Premium Linen Supply — second order
      { id: uuid('apil-4-1'), invoiceId: uuid('apinv-4'), description: 'Bathrobes (100 pcs)', quantity: 100, unitPrice: 150, taxRate: 0.18, totalAmount: 17700, glAccount: '5300' },
      { id: uuid('apil-4-2'), invoiceId: uuid('apinv-4'), description: 'Duvet covers (150 pcs)', quantity: 150, unitPrice: 120, taxRate: 0.18, totalAmount: 21240, glAccount: '5300' },
      { id: uuid('apil-4-3'), invoiceId: uuid('apinv-4'), description: 'Table runners (50 pcs)', quantity: 50, unitPrice: 45, taxRate: 0.18, totalAmount: 2655, glAccount: '5300' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 18. ApPayment — 3 payments
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding ApPayments...');
  await prisma.apPayment.createMany({
    data: [
      {
        id: uuid('appay-1'),
        tenantId,
        invoiceId: uuid('apinv-1'),
        paymentDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
        amount: 44250,
        paymentMethod: 'bank_transfer',
        reference: 'NEFT-RSH-PLS-001',
        notes: 'Full payment for PLS-2024-001',
      },
      {
        id: uuid('appay-2'),
        tenantId,
        invoiceId: uuid('apinv-3'),
        paymentDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        amount: 50000,
        paymentMethod: 'bank_transfer',
        reference: 'NEFT-RSH-TSI-001',
        notes: 'Partial payment — 50% advance for TSI-2024-005',
      },
      {
        id: uuid('appay-3'),
        tenantId,
        invoiceId: uuid('apinv-2'),
        paymentDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        amount: 29500,
        paymentMethod: 'bank_transfer',
        reference: 'NEFT-RSH-CPS-001',
        notes: 'Full payment for CPS-2024-010',
      },
    ],
  });

  // =============================================================
  // REVENUE MODULE
  // =============================================================

  // ──────────────────────────────────────────────────────────────
  // 19. RateShoppingCompetitor — 5 competitors
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding RateShoppingCompetitors...');
  await prisma.rateShoppingCompetitor.createMany({
    data: [
      { id: uuid('rsc-1'), tenantId, name: 'ITC Sonar', channel: 'direct', propertyId, url: 'https://www.itchotels.com/in/en/itcsonar', isActive: true },
      { id: uuid('rsc-2'), tenantId, name: 'The Oberoi Grand', channel: 'direct', propertyId, url: 'https://www.oberoihotels.com', isActive: true },
      { id: uuid('rsc-3'), tenantId, name: 'Taj Bengal', channel: 'direct', propertyId, url: 'https://www.tajhotels.com', isActive: true },
      { id: uuid('rsc-4'), tenantId, name: 'Hyatt Regency Kolkata', channel: 'booking.com', propertyId, url: 'https://www.hyatt.com', isActive: true },
      { id: uuid('rsc-5'), tenantId, name: 'Novotel Kolkata', channel: 'expedia', propertyId, url: 'https://www.accor.com', isActive: true },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 20. RateShoppingResult — 10 results
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding RateShoppingResults...');
  await prisma.rateShoppingResult.createMany({
    data: [
      { id: uuid('rsr-1'), tenantId, competitorId: uuid('rsc-1'), roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000), competitorRate: 6200, ourRate: 5500, parityStatus: 'below', rateDifference: -700, currency: 'INR' },
      { id: uuid('rsr-2'), tenantId, competitorId: uuid('rsc-2'), roomTypeId: uuid('roomtype-3'), checkIn: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000), competitorRate: 14000, ourRate: 12000, parityStatus: 'below', rateDifference: -2000, currency: 'INR' },
      { id: uuid('rsr-3'), tenantId, competitorId: uuid('rsc-3'), roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000), competitorRate: 5800, ourRate: 5500, parityStatus: 'below', rateDifference: -300, currency: 'INR' },
      { id: uuid('rsr-4'), tenantId, competitorId: uuid('rsc-4'), roomTypeId: uuid('roomtype-1'), checkIn: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000), competitorRate: 3200, ourRate: 3500, parityStatus: 'above', rateDifference: 300, currency: 'INR' },
      { id: uuid('rsr-5'), tenantId, competitorId: uuid('rsc-5'), roomTypeId: uuid('roomtype-1'), checkIn: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000), competitorRate: 3400, ourRate: 3500, parityStatus: 'above', rateDifference: 100, currency: 'INR' },
      { id: uuid('rsr-6'), tenantId, competitorId: uuid('rsc-1'), roomTypeId: uuid('roomtype-4'), checkIn: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000), competitorRate: 38000, ourRate: 35000, parityStatus: 'below', rateDifference: -3000, currency: 'INR' },
      { id: uuid('rsr-7'), tenantId, competitorId: uuid('rsc-3'), roomTypeId: uuid('roomtype-3'), checkIn: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), competitorRate: 11500, ourRate: 12000, parityStatus: 'above', rateDifference: 500, currency: 'INR' },
      { id: uuid('rsr-8'), tenantId, competitorId: uuid('rsc-4'), roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 32 * 24 * 60 * 60 * 1000), competitorRate: 5500, ourRate: 5500, parityStatus: 'parity', rateDifference: 0, currency: 'INR' },
      { id: uuid('rsr-9'), tenantId, competitorId: uuid('rsc-2'), roomTypeId: uuid('roomtype-1'), checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 32 * 24 * 60 * 60 * 1000), competitorRate: 3800, ourRate: 3500, parityStatus: 'below', rateDifference: -300, currency: 'INR' },
      { id: uuid('rsr-10'), tenantId, competitorId: uuid('rsc-5'), roomTypeId: uuid('roomtype-3'), checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 33 * 24 * 60 * 60 * 1000), competitorRate: 10500, ourRate: 12000, parityStatus: 'above', rateDifference: 1500, currency: 'INR' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 21. OverbookingConfig — 1 config
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding OverbookingConfig...');
  await prisma.overbookingConfig.createMany({
    data: [
      {
        id: uuid('obc-1'),
        tenantId,
        propertyId,
        enabled: true,
        maxOverbookPercent: 5,
        minCancellationRisk: 0.15,
        allowedRoomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2')]),
        upgradePaths: JSON.stringify([
          { fromRoomTypeId: uuid('roomtype-1'), toRoomTypeId: uuid('roomtype-2') },
          { fromRoomTypeId: uuid('roomtype-2'), toRoomTypeId: uuid('roomtype-3') },
        ]),
        blacklistDates: JSON.stringify(['2024-12-25', '2025-01-01', '2025-01-26']),
        bufferDays: 1,
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 22. OverbookingSlot — 5 slots
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding OverbookingSlots...');
  await prisma.overbookingSlot.createMany({
    data: [
      { id: uuid('obs-1'), tenantId, propertyId, roomTypeId: uuid('roomtype-1'), date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), maxExtraRooms: 2, usedSlots: 0, confidence: 0.25, status: 'active' },
      { id: uuid('obs-2'), tenantId, propertyId, roomTypeId: uuid('roomtype-2'), date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), maxExtraRooms: 1, usedSlots: 1, confidence: 0.35, status: 'active' },
      { id: uuid('obs-3'), tenantId, propertyId, roomTypeId: uuid('roomtype-1'), date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), maxExtraRooms: 2, usedSlots: 0, confidence: 0.20, status: 'active' },
      { id: uuid('obs-4'), tenantId, propertyId, roomTypeId: uuid('roomtype-2'), date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), maxExtraRooms: 1, usedSlots: 0, confidence: 0.30, status: 'active' },
      { id: uuid('obs-5'), tenantId, propertyId, roomTypeId: uuid('roomtype-1'), date: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000), maxExtraRooms: 2, usedSlots: 2, confidence: 0.18, status: 'absorbed' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 23. LastMinuteTrigger — 3 triggers
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding LastMinuteTriggers...');
  await prisma.lastMinuteTrigger.createMany({
    data: [
      {
        id: uuid('lmt-1'),
        tenantId,
        propertyId,
        name: 'Same-day rate drop',
        enabled: true,
        triggerHoursBeforeCheckin: 6,
        action: 'decrease_rate',
        value: 15,
        minOccupancy: 0,
        maxOccupancy: 70,
        channelScope: 'all',
        roomTypeIds: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2')]),
      },
      {
        id: uuid('lmt-2'),
        tenantId,
        propertyId,
        name: 'High occupancy surge pricing',
        enabled: true,
        triggerHoursBeforeCheckin: 24,
        action: 'increase_rate',
        value: 10,
        minOccupancy: 85,
        maxOccupancy: 100,
        channelScope: 'direct_only',
        roomTypeIds: JSON.stringify([uuid('roomtype-3'), uuid('roomtype-4')]),
      },
      {
        id: uuid('lmt-3'),
        tenantId,
        propertyId,
        name: 'Flash sale for low-demand dates',
        enabled: true,
        triggerHoursBeforeCheckin: 48,
        action: 'send_offer',
        value: 20,
        minOccupancy: 0,
        maxOccupancy: 50,
        channelScope: 'all',
        roomTypeIds: JSON.stringify([uuid('roomtype-1')]),
      },
    ],
  });

  // =============================================================
  // STAFF MODULE
  // =============================================================

  // ──────────────────────────────────────────────────────────────
  // 24. PayrollPeriod — 2 periods
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding PayrollPeriods...');
  await prisma.payrollPeriod.createMany({
    data: [
      {
        id: uuid('pp-1'),
        tenantId,
        propertyId,
        name: 'January 2024',
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 0, 31),
        payDate: new Date(2024, 1, 5),
        status: 'paid',
        totalGross: 380000,
        totalDeductions: 76000,
        totalNet: 304000,
        totalEmployees: 3,
        approvedBy: uuid('user-1'),
        approvedAt: new Date(2024, 1, 1),
      },
      {
        id: uuid('pp-2'),
        tenantId,
        propertyId,
        name: 'February 2024',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 29),
        payDate: new Date(2024, 2, 5),
        status: 'approved',
        totalGross: 385000,
        totalDeductions: 77000,
        totalNet: 308000,
        totalEmployees: 3,
        approvedBy: uuid('user-1'),
        approvedAt: new Date(2024, 2, 1),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 25. PayrollEntry — 6 entries (user-1,2,3 × period-1,2)
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding PayrollEntries...');
  await prisma.payrollEntry.createMany({
    data: [
      // Period 1
      { id: uuid('pe-1-1'), tenantId, payrollPeriodId: uuid('pp-1'), userId: uuid('user-1'), basicSalary: 80000, overtimeAmount: 0, bonus: 10000, allowances: 25000, totalGross: 115000, taxDeduction: 11500, pfDeduction: 9600, esiDeduction: 1750, otherDeductions: 200, totalDeductions: 23050, netPay: 91950, daysWorked: 26, leaveDays: 0, overtimeHours: 0, status: 'paid', paidAt: new Date(2024, 1, 5) },
      { id: uuid('pe-1-2'), tenantId, payrollPeriodId: uuid('pp-1'), userId: uuid('user-2'), basicSalary: 45000, overtimeAmount: 4500, bonus: 0, allowances: 15000, totalGross: 64500, taxDeduction: 4500, pfDeduction: 5400, esiDeduction: 975, otherDeductions: 200, totalDeductions: 11075, netPay: 53425, daysWorked: 27, leaveDays: 0, overtimeHours: 12, status: 'paid', paidAt: new Date(2024, 1, 5) },
      { id: uuid('pe-1-3'), tenantId, payrollPeriodId: uuid('pp-1'), userId: uuid('user-3'), basicSalary: 35000, overtimeAmount: 5000, bonus: 2000, allowances: 10000, totalGross: 52000, taxDeduction: 2600, pfDeduction: 4200, esiDeduction: 780, otherDeductions: 200, totalDeductions: 7780, netPay: 44220, daysWorked: 26, leaveDays: 0, overtimeHours: 15, status: 'paid', paidAt: new Date(2024, 1, 5) },
      // Period 2
      { id: uuid('pe-2-1'), tenantId, payrollPeriodId: uuid('pp-2'), userId: uuid('user-1'), basicSalary: 80000, overtimeAmount: 0, bonus: 10000, allowances: 25000, totalGross: 115000, taxDeduction: 11500, pfDeduction: 9600, esiDeduction: 1750, otherDeductions: 200, totalDeductions: 23050, netPay: 91950, daysWorked: 25, leaveDays: 1, overtimeHours: 0, status: 'approved' },
      { id: uuid('pe-2-2'), tenantId, payrollPeriodId: uuid('pp-2'), userId: uuid('user-2'), basicSalary: 45000, overtimeAmount: 6000, bonus: 0, allowances: 15000, totalGross: 66000, taxDeduction: 4800, pfDeduction: 5400, esiDeduction: 975, otherDeductions: 200, totalDeductions: 11375, netPay: 54625, daysWorked: 27, leaveDays: 0, overtimeHours: 16, status: 'approved' },
      { id: uuid('pe-2-3'), tenantId, payrollPeriodId: uuid('pp-2'), userId: uuid('user-3'), basicSalary: 35000, overtimeAmount: 3000, bonus: 5000, allowances: 10000, totalGross: 53000, taxDeduction: 3000, pfDeduction: 4200, esiDeduction: 780, otherDeductions: 200, totalDeductions: 8180, netPay: 44820, daysWorked: 26, leaveDays: 0, overtimeHours: 8, status: 'approved' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 26. SalaryComponent — 8 components
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding SalaryComponents...');
  await prisma.salaryComponent.createMany({
    data: [
      { id: uuid('sc-basic'), tenantId, name: 'Basic Salary', componentType: 'earning', calculationType: 'fixed', value: 0, isActive: true, sortOrder: 1 },
      { id: uuid('sc-hra'), tenantId, name: 'House Rent Allowance (HRA)', componentType: 'earning', calculationType: 'percentage_of_basic', percentage: 30, value: 0, isActive: true, sortOrder: 2 },
      { id: uuid('sc-da'), tenantId, name: 'Dearness Allowance (DA)', componentType: 'earning', calculationType: 'percentage_of_basic', percentage: 10, value: 0, isActive: true, sortOrder: 3 },
      { id: uuid('sc-pf'), tenantId, name: 'Provident Fund (PF)', componentType: 'deduction', calculationType: 'percentage_of_basic', percentage: 12, value: 0, isActive: true, sortOrder: 10 },
      { id: uuid('sc-esi'), tenantId, name: 'Employee State Insurance (ESI)', componentType: 'deduction', calculationType: 'percentage_of_basic', percentage: 1.75, value: 0, isActive: true, sortOrder: 11 },
      { id: uuid('sc-bonus'), tenantId, name: 'Performance Bonus', componentType: 'earning', calculationType: 'fixed', value: 0, isActive: true, sortOrder: 4 },
      { id: uuid('sc-overtime'), tenantId, name: 'Overtime Pay', componentType: 'earning', calculationType: 'fixed', value: 0, isActive: true, sortOrder: 5 },
      { id: uuid('sc-ptax'), tenantId, name: 'Professional Tax', componentType: 'deduction', calculationType: 'fixed', value: 200, isActive: true, sortOrder: 12 },
    ],
  });

  // =============================================================
  // MARKETING MODULE
  // =============================================================

  // ──────────────────────────────────────────────────────────────
  // 27. UpsellCampaign — 3 campaigns
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding UpsellCampaigns...');
  await prisma.upsellCampaign.createMany({
    data: [
      {
        id: uuid('uc-1'),
        tenantId,
        propertyId,
        name: 'Pre-Arrival Room Upgrade',
        description: 'Offer room upgrades 3 days before check-in',
        campaignType: 'pre_arrival',
        triggerDaysBefore: 3,
        targetSegment: JSON.stringify(['all']),
        status: 'active',
        totalSent: 245,
        totalAccepted: 42,
        totalRevenue: 126000,
        conversionRate: 17.1,
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('uc-2'),
        tenantId,
        propertyId,
        name: 'Check-in Spa Package',
        description: 'Offer spa add-ons at check-in kiosk',
        campaignType: 'check_in',
        triggerDaysBefore: 0,
        targetSegment: JSON.stringify(['gold', 'platinum']),
        status: 'active',
        totalSent: 89,
        totalAccepted: 18,
        totalRevenue: 54000,
        conversionRate: 20.2,
        startDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('uc-3'),
        tenantId,
        propertyId,
        name: 'Extended Stay Late Checkout',
        description: 'Offer late checkout during stay for stays 2+ nights',
        campaignType: 'in_stay',
        triggerDaysBefore: null,
        targetSegment: JSON.stringify(['all']),
        status: 'paused',
        totalSent: 156,
        totalAccepted: 34,
        totalRevenue: 17000,
        conversionRate: 21.8,
        startDate: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 28. UpsellOffer — 8 offers across campaigns
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding UpsellOffers...');
  await prisma.upsellOffer.createMany({
    data: [
      // Campaign 1: Room upgrades
      { id: uuid('uo-1'), tenantId, campaignId: uuid('uc-1'), name: 'Upgrade to Deluxe', description: 'Upgrade from Standard to Deluxe Room', offerType: 'upgrade', originalPrice: 2000, upsellPrice: 1500, discount: 25, availability: 'always', isActive: true, sortOrder: 1 },
      { id: uuid('uo-2'), tenantId, campaignId: uuid('uc-1'), name: 'Upgrade to Executive Suite', description: 'Upgrade from Deluxe to Executive Suite', offerType: 'upgrade', originalPrice: 6500, upsellPrice: 4500, discount: 31, availability: 'limited', maxQuantity: 3, isActive: true, sortOrder: 2 },
      { id: uuid('uo-3'), tenantId, campaignId: uuid('uc-1'), name: 'Upgrade to Presidential Suite', description: 'Ultimate upgrade to Presidential Suite', offerType: 'upgrade', originalPrice: 29500, upsellPrice: 19900, discount: 33, availability: 'seasonal', maxQuantity: 1, isActive: true, sortOrder: 3 },
      // Campaign 2: Spa packages
      { id: uuid('uo-4'), tenantId, campaignId: uuid('uc-2'), name: 'Couples Spa Retreat', description: '90-minute couples massage package', offerType: 'spa', originalPrice: 6000, upsellPrice: 4500, discount: 25, availability: 'always', isActive: true, sortOrder: 1 },
      { id: uuid('uo-5'), tenantId, campaignId: uuid('uc-2'), name: 'Wellness Day Pass', description: 'Full-day spa access with treatments', offerType: 'spa', originalPrice: 4000, upsellPrice: 3000, discount: 25, availability: 'always', isActive: true, sortOrder: 2 },
      { id: uuid('uo-6'), tenantId, campaignId: uuid('uc-2'), name: 'Royal Bath Ritual', description: 'Signature bath ceremony experience', offerType: 'experience', originalPrice: 8000, upsellPrice: 5999, discount: 25, availability: 'limited', maxQuantity: 5, isActive: true, sortOrder: 3 },
      // Campaign 3: Late checkout
      { id: uuid('uo-7'), tenantId, campaignId: uuid('uc-3'), name: 'Late Checkout until 4 PM', description: 'Extend checkout to 4 PM', offerType: 'late_checkout', originalPrice: 2000, upsellPrice: 500, discount: 75, availability: 'always', isActive: true, sortOrder: 1 },
      { id: uuid('uo-8'), tenantId, campaignId: uuid('uc-3'), name: 'Early Check-in from 10 AM', description: 'Check in early at 10 AM', offerType: 'early_checkin', originalPrice: 2000, upsellPrice: 750, discount: 63, availability: 'always', isActive: true, sortOrder: 2 },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 29. UpsellRule — 3 rules
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding UpsellRules...');
  await prisma.upsellRule.createMany({
    data: [
      {
        id: uuid('ur-1'),
        tenantId,
        name: 'VIP Platinum Exclusives',
        description: 'Show premium offers only to platinum loyalty members',
        ruleType: 'loyalty_tier',
        conditions: JSON.stringify({ tier: ['platinum'] }),
        priority: 10,
        isActive: true,
      },
      {
        id: uuid('ur-2'),
        tenantId,
        name: 'Long Stay Upsell',
        description: 'Offer upgrades to guests staying 3+ nights',
        ruleType: 'stay_duration',
        conditions: JSON.stringify({ minNights: 3 }),
        priority: 5,
        isActive: true,
      },
      {
        id: uuid('ur-3'),
        tenantId,
        name: 'Direct Booking Bonus',
        description: 'Extra discounts for direct bookings',
        ruleType: 'booking_source',
        conditions: JSON.stringify({ sources: ['direct'] }),
        priority: 3,
        isActive: true,
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 30. AbandonedBooking — 5 abandoned bookings
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding AbandonedBookings...');
  await prisma.abandonedBooking.createMany({
    data: [
      { id: uuid('ab-1'), tenantId, propertyId, sessionId: 'sess-abc123', guestEmail: 'deepak.k@email.com', roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000), adults: 2, selectedRate: 5500, currency: 'INR', stepAbandoned: 'payment', recoveryStatus: 'emailed', recoveryEmailSentAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), recoveryOffer: 10 },
      { id: uuid('ab-2'), tenantId, propertyId, sessionId: 'sess-def456', guestEmail: 'meera.r@email.com', roomTypeId: uuid('roomtype-3'), checkIn: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000), adults: 2, children: 1, selectedRate: 12000, currency: 'INR', stepAbandoned: 'guest_info', recoveryStatus: 'recovered', recoveryEmailSentAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), recoveredAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), recoveredBookingId: uuid('booking-3') },
      { id: uuid('ab-3'), tenantId, propertyId, sessionId: 'sess-ghi789', guestPhone: '+91-9830098765', roomTypeId: uuid('roomtype-1'), checkIn: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), adults: 1, selectedRate: 3500, currency: 'INR', stepAbandoned: 'room_select', recoveryStatus: 'expired' },
      { id: uuid('ab-4'), tenantId, propertyId, sessionId: 'sess-jkl012', guestEmail: 'sanjay.m@email.com', roomTypeId: uuid('roomtype-4'), checkIn: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 22 * 24 * 60 * 60 * 1000), adults: 2, selectedRate: 35000, currency: 'INR', stepAbandoned: 'payment', recoveryStatus: 'sms_sent', recoverySmsSentAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), recoveryOffer: 15 },
      { id: uuid('ab-5'), tenantId, propertyId, sessionId: 'sess-mno345', guestEmail: 'anita.p@email.com', roomTypeId: uuid('roomtype-2'), checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), checkOut: new Date(today.getTime() + 33 * 24 * 60 * 60 * 1000), adults: 2, children: 1, selectedRate: 5500, currency: 'INR', stepAbandoned: 'search', recoveryStatus: 'pending' },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 31. CorporateAccount — 4 corporate accounts
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding CorporateAccounts...');
  await prisma.corporateAccount.createMany({
    data: [
      {
        id: uuid('corp-1'),
        tenantId,
        companyName: 'Tata Consultancy Services',
        contactName: 'Sanjay Mehta',
        contactEmail: 'travel@tcs.com',
        contactPhone: '+91-22-67890123',
        address: 'TCS House, Raveline Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        taxId: '19AABCT1234F1Z5',
        website: 'https://www.tcs.com',
        industry: 'Information Technology',
        accountType: 'corporate',
        billingTerms: 'net_30',
        creditLimit: 500000,
        outstandingBalance: 125000,
        discountPercent: 15,
        isPreferred: true,
        isActive: true,
      },
      {
        id: uuid('corp-2'),
        tenantId,
        companyName: 'Infosys Limited',
        contactName: 'Ramesh Kumar',
        contactEmail: 'travel@infosys.com',
        contactPhone: '+91-80-28520111',
        address: 'Electronics City',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560100',
        taxId: '29AABCI5678G1Z3',
        website: 'https://www.infosys.com',
        industry: 'Information Technology',
        accountType: 'corporate',
        billingTerms: 'net_30',
        creditLimit: 300000,
        outstandingBalance: 75000,
        discountPercent: 12,
        isPreferred: true,
        isActive: true,
      },
      {
        id: uuid('corp-3'),
        tenantId,
        companyName: 'Government of West Bengal',
        contactName: 'A.K. Banerjee',
        contactEmail: 'admin@wb.gov.in',
        contactPhone: '+91-33-22121000',
        address: 'Writers Building',
        city: 'Kolkata',
        state: 'West Bengal',
        country: 'India',
        postalCode: '700001',
        taxId: 'GOV-WB-2024',
        industry: 'Government',
        accountType: 'government',
        billingTerms: 'net_45',
        creditLimit: 1000000,
        outstandingBalance: 250000,
        discountPercent: 20,
        isPreferred: false,
        isActive: true,
      },
      {
        id: uuid('corp-4'),
        tenantId,
        companyName: 'Cox & Kings Travel',
        contactName: 'Priya Mehta',
        contactEmail: 'hotels@coxandkings.com',
        contactPhone: '+91-22-61581000',
        address: 'Century Bazaar',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400013',
        taxId: '27AABCC9012H1Z1',
        website: 'https://www.coxandkings.com',
        industry: 'Travel Agency',
        accountType: 'travel_agent',
        billingTerms: 'net_15',
        creditLimit: 200000,
        outstandingBalance: 45000,
        discountPercent: 8,
        isPreferred: false,
        isActive: true,
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 32. OnlineReview — 6 reviews from external platforms
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding OnlineReviews...');
  await prisma.onlineReview.createMany({
    data: [
      {
        id: uuid('or-1'),
        tenantId,
        propertyId,
        guestId: uuid('guest-1'),
        platform: 'google',
        externalId: 'goog-rev-001',
        authorName: 'Amit Mukherjee',
        rating: 4.5,
        title: 'Excellent stay with minor hiccups',
        content: 'The room was spacious and well-maintained. Staff was courteous. Only issue was slow check-in during peak hours. The restaurant food was outstanding.',
        reviewDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
        responseText: 'Thank you, Amit! We appreciate your feedback and are working on improving our check-in process.',
        respondedAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
        respondedBy: uuid('user-1'),
        sentimentScore: 0.85,
        sentimentLabel: 'positive',
        categories: JSON.stringify(['service', 'rooms', 'food']),
        isFeatured: true,
      },
      {
        id: uuid('or-2'),
        tenantId,
        propertyId,
        guestId: uuid('guest-2'),
        platform: 'tripadvisor',
        externalId: 'ta-rev-002',
        authorName: 'Sneha Gupta',
        rating: 4.0,
        title: 'Good value for money',
        content: 'Nice hotel in central Kolkata. Breakfast could have more variety. Pool area was clean and enjoyable.',
        reviewDate: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000),
        responseText: 'Thanks for staying with us, Sneha! We will look into expanding our breakfast menu.',
        respondedAt: new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000),
        respondedBy: uuid('user-2'),
        sentimentScore: 0.72,
        sentimentLabel: 'positive',
        categories: JSON.stringify(['value', 'food', 'pool']),
      },
      {
        id: uuid('or-3'),
        tenantId,
        propertyId,
        guestId: uuid('guest-3'),
        platform: 'booking_com',
        externalId: 'bcom-rev-003',
        authorName: 'Rahul Banerjee',
        rating: 5.0,
        title: 'Perfect luxury experience',
        content: 'As a platinum member, the VIP treatment was exceptional. Room upgrade, welcome amenities, and personalized service made this a memorable stay.',
        reviewDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        responseText: 'Thank you for your loyalty, Rahul! It is always a pleasure hosting you.',
        respondedAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        respondedBy: uuid('user-1'),
        sentimentScore: 0.98,
        sentimentLabel: 'positive',
        categories: JSON.stringify(['service', 'rooms', 'value']),
        isFeatured: true,
      },
      {
        id: uuid('or-4'),
        tenantId,
        propertyId,
        platform: 'google',
        externalId: 'goog-rev-004',
        authorName: 'Sourav Das',
        rating: 3.0,
        title: 'Average experience',
        content: 'The hotel needs renovation. Bathroom fixtures were old and the AC made noise. Location is good though.',
        reviewDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
        responseText: 'We are sorry to hear about your experience. We have started a renovation project and hope to welcome you back soon with improved facilities.',
        respondedAt: new Date(today.getTime() - 19 * 24 * 60 * 60 * 1000),
        respondedBy: uuid('user-1'),
        sentimentScore: 0.35,
        sentimentLabel: 'mixed',
        categories: JSON.stringify(['rooms', 'cleanliness', 'location']),
      },
      {
        id: uuid('or-5'),
        tenantId,
        propertyId,
        platform: 'agoda',
        externalId: 'agoda-rev-005',
        authorName: 'Neha Sharma',
        rating: 2.0,
        title: 'Disappointing for a 5-star',
        content: 'Expected much more. Front desk was unorganized, room service took 45 minutes, and Wi-Fi was slow. Not worth the premium price.',
        reviewDate: new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000),
        responseText: 'We sincerely apologize for the inconvenience. We have addressed these issues with our team and are implementing improvements.',
        respondedAt: new Date(today.getTime() - 24 * 24 * 60 * 60 * 1000),
        respondedBy: uuid('user-1'),
        sentimentScore: 0.12,
        sentimentLabel: 'negative',
        categories: JSON.stringify(['service', 'value', 'wifi']),
      },
      {
        id: uuid('or-6'),
        tenantId,
        propertyId,
        platform: 'expedia',
        externalId: 'exp-rev-006',
        authorName: 'Arjun Patel',
        rating: 4.0,
        title: 'Great for business travel',
        content: 'Well-equipped business center, fast internet, and proximity to IT parks. The executive lounge is a nice touch for catching up on work.',
        reviewDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
        sentimentScore: 0.78,
        sentimentLabel: 'positive',
        categories: JSON.stringify(['business', 'wifi', 'location']),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 33. JourneyStage — 5 stages
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding JourneyStages...');
  await prisma.journeyStage.createMany({
    data: [
      { id: uuid('js-1'), tenantId, name: 'Booking Confirmed', description: 'Triggered immediately after booking confirmation', stageOrder: 1, triggerType: 'event', triggerConfig: JSON.stringify({ event: 'booking.confirmed' }), delayMinutes: 0, isActive: true },
      { id: uuid('js-2'), tenantId, name: 'Pre-Arrival (7 days)', description: 'Send pre-arrival communication 7 days before check-in', stageOrder: 2, triggerType: 'time', triggerConfig: JSON.stringify({ beforeEvent: 'checkIn', days: 7 }), delayMinutes: 0, isActive: true },
      { id: uuid('js-3'), tenantId, name: 'Pre-Arrival (1 day)', description: 'Final reminder and upsell offer 1 day before check-in', stageOrder: 3, triggerType: 'time', triggerConfig: JSON.stringify({ beforeEvent: 'checkIn', days: 1 }), delayMinutes: 0, isActive: true },
      { id: uuid('js-4'), tenantId, name: 'During Stay', description: 'In-stay engagement and satisfaction check', stageOrder: 4, triggerType: 'time', triggerConfig: JSON.stringify({ afterEvent: 'checkIn', hours: 24 }), delayMinutes: 0, isActive: true },
      { id: uuid('js-5'), tenantId, name: 'Post Check-out', description: 'Thank you message and review request after departure', stageOrder: 5, triggerType: 'time', triggerConfig: JSON.stringify({ afterEvent: 'checkOut', hours: 4 }), delayMinutes: 0, isActive: true },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 34. JourneyCampaign — 2 campaigns
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding JourneyCampaigns...');
  await prisma.journeyCampaign.createMany({
    data: [
      {
        id: uuid('jc-1'),
        tenantId,
        name: 'Pre-Arrival Guest Journey',
        description: 'Automated communication flow from booking to check-in',
        journeyType: 'pre_arrival',
        triggerEvent: 'booking.confirmed',
        targetSegments: JSON.stringify(['all']),
        status: 'active',
        totalContacts: 312,
        convertedCount: 280,
        revenue: 45000,
        startedAt: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('jc-2'),
        tenantId,
        name: 'Post-Stay Review & Rebook',
        description: 'Thank guests and encourage reviews and rebooking',
        journeyType: 'post_stay',
        triggerEvent: 'booking.checked_out',
        targetSegments: JSON.stringify(['all']),
        status: 'active',
        totalContacts: 245,
        convertedCount: 89,
        revenue: 185000,
        startedAt: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────
  // 35. JourneyAction — 6 actions across campaigns and stages
  // ──────────────────────────────────────────────────────────────
  console.log('Seeding JourneyActions...');
  await prisma.journeyAction.createMany({
    data: [
      // Campaign 1: Pre-arrival actions
      { id: uuid('ja-1'), tenantId, journeyId: uuid('jc-1'), stageId: uuid('js-1'), actionType: 'email', actionConfig: JSON.stringify({ template: 'booking-confirmation' }), subject: 'Your Booking is Confirmed! ✅', content: 'Thank you for choosing Royal Stay Kolkata. Your reservation is confirmed.', sentCount: 312, openedCount: 285, clickedCount: 45, sortOrder: 1 },
      { id: uuid('ja-2'), tenantId, journeyId: uuid('jc-1'), stageId: uuid('js-2'), actionType: 'email', actionConfig: JSON.stringify({ template: 'pre-arrival-guide' }), subject: 'Your Kolkata Trip Awaits — Travel Guide Inside', content: 'We are excited about your upcoming stay. Here is a guide to make the most of Kolkata.', sentCount: 298, openedCount: 220, clickedCount: 67, sortOrder: 1 },
      { id: uuid('ja-3'), tenantId, journeyId: uuid('jc-1'), stageId: uuid('js-3'), actionType: 'email', actionConfig: JSON.stringify({ template: 'pre-arrival-upsell' }), subject: 'Enhance Your Stay — Exclusive Add-Ons', content: 'Upgrade your experience with our curated add-ons available at a special pre-arrival price.', sentCount: 290, openedCount: 195, clickedCount: 42, convertedCount: 28, sortOrder: 1 },
      { id: uuid('ja-4'), tenantId, journeyId: uuid('jc-1'), stageId: uuid('js-4'), actionType: 'sms', actionConfig: JSON.stringify({ template: 'in-stay-satisfaction' }), content: 'Hi {{guestName}}, hope you are enjoying your stay at Royal Stay! Reply YES for any assistance. 🏨', sentCount: 285, sortOrder: 1 },
      // Campaign 2: Post-stay actions
      { id: uuid('ja-5'), tenantId, journeyId: uuid('jc-2'), stageId: uuid('js-5'), actionType: 'email', actionConfig: JSON.stringify({ template: 'post-stay-thank-you' }), subject: 'Thank You for Staying With Us! 🙏', content: 'We hope you had a wonderful stay. We would love to hear your feedback and welcome you back.', sentCount: 245, openedCount: 210, clickedCount: 85, convertedCount: 52, sortOrder: 1 },
      { id: uuid('ja-6'), tenantId, journeyId: uuid('jc-2'), stageId: uuid('js-5'), actionType: 'wait', actionConfig: JSON.stringify({ waitHours: 48 }), sentCount: 0, sortOrder: 2 },
    ],
  });

  console.log('Billing, revenue, staff, and marketing seed data complete.');
}
