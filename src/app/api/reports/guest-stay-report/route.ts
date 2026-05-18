import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantContext, hasPermission } from '@/lib/auth/tenant-context';
import { format, eachMonthOfInterval } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlatGuestStayRow {
  // Stay record
  stayId: string;
  roomNights: number;
  stayTotalAmount: number;
  feedbackGiven: boolean;
  reviewGiven: boolean;
  stayCreatedAt: string;

  // Guest details
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestNationality: string | null;
  guestCountry: string | null;
  guestCity: string | null;
  guestDateOfBirth: string | null;
  guestGender: string | null;
  guestIdType: string | null;
  guestIdNumber: string | null;
  guestLoyaltyTier: string;
  guestLoyaltyPoints: number;
  guestTotalStays: number;
  guestTotalSpent: number;
  guestIsVip: boolean;
  guestVipLevel: string | null;
  guestSource: string;
  guestKycStatus: string;

  // Booking details
  bookingId: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  bookingStatus: string;
  bookingSource: string;
  adults: number;
  children: number;
  infants: number;
  roomRate: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  currency: string;
  guaranteeType: string;
  cancellationRisk: number | null;
  specialRequests: string | null;
  bookingCreatedAt: string;

  // Room details
  roomNumber: string | null;
  roomFloor: number | null;
  roomStatus: string | null;

  // Room type
  roomTypeName: string | null;
  roomTypeCode: string | null;
  roomTypeBaseRate: number | null;

  // Property
  propertyName: string | null;
  propertyCode: string | null;
  propertyCity: string | null;
  propertyCountry: string | null;

  // Folio summary (first / primary folio)
  folioNumber: string | null;
  folioSubtotal: number | null;
  folioTaxes: number | null;
  folioTotalAmount: number | null;
  folioPaidAmount: number | null;
  folioBalance: number | null;
  folioStatus: string | null;
  folioOpenedAt: string | null;
  folioClosedAt: string | null;

  // Payment summary (first payment)
  paymentAmount: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentGateway: string | null;
  paymentCardType: string | null;
  paymentCreatedAt: string | null;
}

interface SummaryStats {
  totalGuests: number;
  totalStays: number;
  totalRoomNights: number;
  totalRevenue: number;
  averageStayLength: number;
  averageRevenuePerStay: number;
  guestDistributionByNationality: Record<string, number>;
  guestDistributionByLoyaltyTier: Record<string, number>;
  guestDistributionBySource: Record<string, number>;
  guestDistributionByVipStatus: { vip: number; nonVip: number };
  bookingStatusDistribution: Record<string, number>;
  revenueByMonth: { month: string; revenue: number; stays: number; roomNights: number }[];

  // NEW: Cancellation analysis
  cancellationRate: number;
  cancelledStays: number;
  cancelledRevenue: number;
  cancellationReasons: Record<string, number>;
  noShowCount: number;

  // NEW: Outstanding balance & collection
  totalOutstanding: number;
  totalCollected: number;
  collectionRate: number;

  // NEW: Repeat guest analysis
  repeatGuestCount: number;
  firstTimeGuestCount: number;
  repeatGuestRevenue: number;
  firstTimeGuestRevenue: number;

  // NEW: Industry KPIs
  adr: number; // Average Daily Rate = totalRevenue / totalRoomNights
  revpar: number; // Revenue Per Available Room (approximate)

  // NEW: Booking source breakdown
  revenueBySource: { source: string; revenue: number; bookings: number; roomNights: number }[];

  // NEW: Guest feedback summary
  averageRating: number | null;
  totalReviews: number;
  feedbackByCategory: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}

function safeNumber(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// CSV generation
// ---------------------------------------------------------------------------

function generateCsv(rows: FlatGuestStayRow[]): string {
  if (rows.length === 0) return '\uFEFF';

  const headers = Object.keys(rows[0]!) as (keyof FlatGuestStayRow)[];
  const lines: string[] = [];

  // BOM for Excel UTF-8 recognition
  lines.push('\uFEFF' + headers.map(escapeCsvField).join(','));

  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h])).join(','));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// XLSX generation
// ---------------------------------------------------------------------------

async function generateXlsx(
  rows: FlatGuestStayRow[],
  summary: SummaryStats,
  nationalityBreakdown: Record<string, { count: number; revenue: number; roomNights: number }>,
  roomTypeBreakdown: Record<string, { count: number; revenue: number; roomNights: number }>,
  allRecords: { booking: Record<string, any>; guest: Record<string, any> }[],
): Promise<Buffer> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: Guest Stays ----
  const stayHeaders: Partial<Record<keyof FlatGuestStayRow, string>> = {
    stayId: 'Stay ID',
    guestFirstName: 'First Name',
    guestLastName: 'Last Name',
    guestEmail: 'Email',
    guestPhone: 'Phone',
    guestNationality: 'Nationality',
    guestCountry: 'Country',
    guestCity: 'City',
    guestLoyaltyTier: 'Loyalty Tier',
    guestIsVip: 'VIP',
    guestVipLevel: 'VIP Level',
    guestSource: 'Guest Source',
    confirmationCode: 'Confirmation Code',
    checkIn: 'Check-In',
    checkOut: 'Check-Out',
    actualCheckIn: 'Actual Check-In',
    actualCheckOut: 'Actual Check-Out',
    bookingStatus: 'Booking Status',
    bookingSource: 'Booking Source',
    adults: 'Adults',
    children: 'Children',
    infants: 'Infants',
    roomNumber: 'Room Number',
    roomFloor: 'Floor',
    roomTypeName: 'Room Type',
    roomTypeCode: 'Room Type Code',
    roomTypeBaseRate: 'Base Rate',
    propertyName: 'Property',
    propertyCity: 'Property City',
    propertyCountry: 'Property Country',
    roomNights: 'Room Nights',
    roomRate: 'Room Rate',
    taxes: 'Taxes',
    discount: 'Discount',
    totalAmount: 'Total Amount',
    currency: 'Currency',
    guaranteeType: 'Guarantee Type',
    cancellationRisk: 'Cancel Risk',
    guestLoyaltyPoints: 'Loyalty Points',
    guestTotalStays: 'Total Stays',
    guestTotalSpent: 'Total Spent',
    guestKycStatus: 'KYC Status',
    feedbackGiven: 'Feedback Given',
    reviewGiven: 'Review Given',
    folioNumber: 'Folio #',
    folioTotalAmount: 'Folio Total',
    folioPaidAmount: 'Folio Paid',
    folioBalance: 'Folio Balance',
    folioStatus: 'Folio Status',
    paymentAmount: 'Payment Amount',
    paymentMethod: 'Payment Method',
    paymentStatus: 'Payment Status',
    paymentGateway: 'Payment Gateway',
    stayTotalAmount: 'Stay Total',
  };

  const orderedKeys = Object.keys(stayHeaders) as (keyof FlatGuestStayRow)[];
  const headerRow = orderedKeys.map((k) => stayHeaders[k] ?? k);
  const dataRows = rows.map((r) => orderedKeys.map((k) => r[k] ?? ''));
  const ws1 = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Column widths
  ws1['!cols'] = orderedKeys.map((k) => {
    const label = stayHeaders[k] ?? k;
    const maxDataLen = Math.max(...dataRows.slice(0, 50).map((r) => String(r[orderedKeys.indexOf(k)] ?? '').length));
    return { wch: Math.max(label.length + 2, maxDataLen + 2, 10) };
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'Guest Stays');

  // ---- Sheet 2: Summary ----
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Unique Guests', summary.totalGuests],
    ['Total Stays', summary.totalStays],
    ['Total Room Nights', summary.totalRoomNights],
    ['Total Revenue', summary.totalRevenue],
    ['Average Stay Length (nights)', summary.averageStayLength],
    ['Average Revenue Per Stay', summary.averageRevenuePerStay],
    ['', ''],
    ['Booking Status Distribution', ''],
    ...Object.entries(summary.bookingStatusDistribution).map(([k, v]) => [k, v]),
    ['', ''],
    ['VIP Distribution', ''],
    ['VIP Guests', summary.guestDistributionByVipStatus.vip],
    ['Non-VIP Guests', summary.guestDistributionByVipStatus.nonVip],
    ['', ''],
    ['Cancellation Analysis', ''],
    ['Cancellation Rate (%)', summary.cancellationRate],
    ['Cancelled Stays', summary.cancelledStays],
    ['Cancelled Revenue', summary.cancelledRevenue],
    ['No-Show Count', summary.noShowCount],
    ['', ''],
    ['Collection Analysis', ''],
    ['Total Outstanding', summary.totalOutstanding],
    ['Total Collected', summary.totalCollected],
    ['Collection Rate (%)', summary.collectionRate],
    ['', ''],
    ['Repeat Guest Analysis', ''],
    ['First-Time Guests', summary.firstTimeGuestCount],
    ['Repeat Guests', summary.repeatGuestCount],
    ['First-Time Revenue', round2(summary.firstTimeGuestRevenue)],
    ['Repeat Revenue', round2(summary.repeatGuestRevenue)],
    ['', ''],
    ['Industry KPIs', ''],
    ['ADR (Average Daily Rate)', summary.adr],
    ['RevPAR', summary.revpar],
    ['', ''],
    ['Guest Feedback', ''],
    ['Average Rating', summary.averageRating ?? 'N/A'],
    ['Total Reviews', summary.totalReviews],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  // ---- Sheet 3: By Nationality ----
  const nationalityData = [
    ['Nationality', 'Guest Count', 'Total Revenue', 'Room Nights'],
    ...Object.entries(nationalityBreakdown)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([nat, d]) => [nat, d.count, d.revenue, d.roomNights]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(nationalityData);
  ws3['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'By Nationality');

  // ---- Sheet 4: By Month ----
  const monthData = [
    ['Month', 'Revenue', 'Stays', 'Room Nights'],
    ...summary.revenueByMonth.map((m) => [m.month, m.revenue, m.stays, m.roomNights]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(monthData);
  ws4['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'By Month');

  // ---- Sheet 5: By Room Type ----
  const roomTypeData = [
    ['Room Type', 'Stays', 'Revenue', 'Room Nights'],
    ...Object.entries(roomTypeBreakdown)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([rt, d]) => [rt, d.count, d.revenue, d.roomNights]),
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(roomTypeData);
  ws5['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'By Room Type');

  // ---- Sheet 6: Payment Breakdown ----
  const paymentHeaders = [
    'Booking ID', 'Confirmation', 'Guest Name', 'Folio #',
    'Payment Amount', 'Method', 'Status', 'Gateway',
    'Card Type', 'Card Last 4', 'Processed At',
  ];
  const paymentRows: (string | number | null)[][] = [];
  for (const rec of allRecords) {
    const booking = rec.booking;
    const guestName = `${rec.guest?.firstName ?? ''} ${rec.guest?.lastName ?? ''}`.trim();
    for (const folio of booking.folios ?? []) {
      for (const p of folio.payments ?? []) {
        paymentRows.push([
          booking.id,
          booking.confirmationCode,
          guestName,
          folio.folioNumber,
          safeNumber(p.amount) ?? 0,
          p.method ?? '',
          p.status ?? '',
          p.gateway ?? '',
          p.cardType ?? '',
          p.cardLast4 ?? '',
          safeDate(p.processedAt) ?? safeDate(p.createdAt) ?? '',
        ]);
      }
    }
  }
  const ws6 = XLSX.utils.aoa_to_sheet([paymentHeaders, ...paymentRows]);
  ws6['!cols'] = [
    { wch: 36 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws6, 'Payment Breakdown');

  // ---- Sheet 7: Folio Line Items ----
  const lineItemHeaders = [
    'Booking ID', 'Confirmation', 'Guest Name', 'Folio #',
    'Description', 'Category', 'Qty', 'Unit Price',
    'Total', 'Tax', 'Service Date',
  ];
  const lineItemRows: (string | number | null)[][] = [];
  for (const rec of allRecords) {
    const booking = rec.booking;
    const guestName = `${rec.guest?.firstName ?? ''} ${rec.guest?.lastName ?? ''}`.trim();
    for (const folio of booking.folios ?? []) {
      for (const li of folio.lineItems ?? []) {
        lineItemRows.push([
          booking.id,
          booking.confirmationCode,
          guestName,
          folio.folioNumber,
          li.description ?? '',
          li.category ?? '',
          li.quantity ?? 1,
          safeNumber(li.unitPrice) ?? 0,
          safeNumber(li.totalAmount) ?? 0,
          safeNumber(li.taxAmount) ?? 0,
          safeDate(li.serviceDate) ?? '',
        ]);
      }
    }
  }
  const ws7 = XLSX.utils.aoa_to_sheet([lineItemHeaders, ...lineItemRows]);
  ws7['!cols'] = [
    { wch: 36 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
    { wch: 30 }, { wch: 16 }, { wch: 6 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws7, 'Folio Line Items');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

async function generatePdf(
  rows: FlatGuestStayRow[],
  summary: SummaryStats,
  startDateStr: string,
  endDateStr: string,
): Promise<Buffer> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const now = new Date();
  const generatedAt = format(now, 'yyyy-MM-dd HH:mm:ss');
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Header ----
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Guest Stay Report', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Date Range: ${startDateStr} to ${endDateStr}`, 14, 28);
  doc.text(`Generated: ${generatedAt}`, 14, 34);

  // ---- Summary Section ----
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('Summary', 14, 44);

  const summaryRows = [
    ['Total Guests', String(summary.totalGuests)],
    ['Total Stays', String(summary.totalStays)],
    ['Total Room Nights', String(summary.totalRoomNights)],
    ['Total Revenue', String(summary.totalRevenue)],
    ['Avg Stay Length (nights)', String(summary.averageStayLength)],
    ['Avg Revenue / Stay', String(summary.averageRevenuePerStay)],
    ['VIP Guests', String(summary.guestDistributionByVipStatus.vip)],
    ['Non-VIP Guests', String(summary.guestDistributionByVipStatus.nonVip)],
    ['', ''],
    ['Cancellation Rate (%)', String(summary.cancellationRate)],
    ['Cancelled Stays', String(summary.cancelledStays)],
    ['No-Show Count', String(summary.noShowCount)],
    ['', ''],
    ['Total Outstanding', String(summary.totalOutstanding)],
    ['Total Collected', String(summary.totalCollected)],
    ['Collection Rate (%)', String(summary.collectionRate)],
    ['', ''],
    ['ADR (Avg Daily Rate)', String(summary.adr)],
    ['RevPAR', String(summary.revpar)],
    ['', ''],
    ['Average Rating', summary.averageRating !== null ? String(summary.averageRating) : 'N/A'],
    ['Total Reviews', String(summary.totalReviews)],
  ];

  autoTable(doc, {
    startY: 48,
    head: [['Metric', 'Value']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 } },
  });

  // ---- Detailed Table ----
  const tableStartY = ((doc as unknown as Record<string, { finalY: number }>).lastAutoTable)?.finalY ?? 100;
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('Guest Stay Details', 14, tableStartY + 10);

  const detailColumns = [
    'First Name',
    'Last Name',
    'Confirmation',
    'Check-In',
    'Check-Out',
    'Status',
    'Room #',
    'Room Type',
    'Property',
    'Nights',
    'Total',
    'Currency',
    'VIP',
    'Loyalty',
  ];

  const detailRows = rows.map((r) => [
    r.guestFirstName,
    r.guestLastName,
    r.confirmationCode,
    r.checkIn ? format(new Date(r.checkIn), 'yyyy-MM-dd') : '',
    r.checkOut ? format(new Date(r.checkOut), 'yyyy-MM-dd') : '',
    r.bookingStatus,
    r.roomNumber ?? '',
    r.roomTypeName ?? '',
    r.propertyName ?? '',
    r.roomNights,
    r.totalAmount,
    r.currency,
    r.guestIsVip ? 'Yes' : 'No',
    r.guestLoyaltyTier,
  ]);

  autoTable(doc, {
    startY: tableStartY + 14,
    head: [detailColumns],
    body: detailRows,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 6.5 },
    margin: { left: 14, right: 14 },
    styles: { overflow: 'linebreak', cellPadding: 2 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageNum = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${currentPage} of ${pageNum}  |  Generated ${generatedAt}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
      );
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ---- Auth check ----
  const context = await getTenantContext(request);
  if (!context) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  if (!hasPermission(context, 'reports.view') && !hasPermission(context, 'reports.*') && !context.isPlatformAdmin) {
    return NextResponse.json({ success: false, error: 'Permission denied: reports.view' }, { status: 403 });
  }

  const tenantId = context.tenantId;

  try {
    const searchParams = request.nextUrl.searchParams;

    // ---- Parse query params ----
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required query parameters' },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use ISO date strings.' },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate must be before or equal to endDate' },
        { status: 400 },
      );
    }

    const format_ = searchParams.get('format') || 'json';
    if (!['json', 'csv', 'xlsx', 'pdf'].includes(format_)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Supported: json, csv, xlsx, pdf' },
        { status: 400 },
      );
    }

    const propertyId = searchParams.get('propertyId');
    // Accept both 'status' and 'bookingStatus' param names
    const status = searchParams.get('status') || searchParams.get('bookingStatus');
    const loyaltyTier = searchParams.get('loyaltyTier');
    // Accept both 'isVip' and 'vipOnly' param names
    // vipOnly=true means "show only VIP guests", anything else means "don't filter"
    const isVipParam = searchParams.get('isVip') || searchParams.get('vipOnly');
    const isVip = isVipParam === 'true' ? true : null;
    const search = searchParams.get('search') || '';
    // ENHANCEMENT 6: Booking source filter
    const bookingSource = searchParams.get('bookingSource') || searchParams.get('source');

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10), 1), 5000);
    const skip = (page - 1) * limit;

    // ---- Build where clause ----
    const guestWhere: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (loyaltyTier && loyaltyTier !== 'all') {
      guestWhere.loyaltyTier = loyaltyTier;
    }
    if (isVip !== null) {
      guestWhere.isVip = isVip;
    }
    if (search) {
      guestWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Use OVERLAP logic instead of containment:
    // A booking overlaps with [startDate, endDate] if checkIn <= endDate AND checkOut >= startDate
    // This captures any booking that even partially falls within the selected range
    const bookingWhere: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      checkIn: { lte: endDate },
      checkOut: { gte: startDate },
    };

    if (propertyId && propertyId !== 'all') {
      bookingWhere.propertyId = propertyId;
    }
    if (status && status !== 'all') {
      bookingWhere.status = status;
    }
    // ENHANCEMENT 6: Booking source filter
    if (bookingSource && bookingSource !== 'all') {
      bookingWhere.source = bookingSource;
    }

    // ---- Fetch GuestStay records with ALL folio line items and ALL payments ----
    // NOTE: Don't include booking.primaryGuest here - it can cause Prisma to silently
    // filter out records. We'll get guest data from the GuestStay.guest relation instead.
    const stays = await db.guestStay.findMany({
      where: {
        guest: guestWhere,
        booking: bookingWhere,
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationality: true,
            country: true,
            city: true,
            dateOfBirth: true,
            gender: true,
            idType: true,
            idNumber: true,
            loyaltyTier: true,
            loyaltyPoints: true,
            totalStays: true,
            totalSpent: true,
            isVip: true,
            vipLevel: true,
            source: true,
            kycStatus: true,
          },
        },
        booking: {
          include: {
            room: {
              select: {
                number: true,
                floor: true,
                status: true,
              },
            },
            roomType: {
              select: {
                name: true,
                code: true,
                basePrice: true,
              },
            },
            property: {
              select: {
                name: true,
                slug: true,
                city: true,
                country: true,
              },
            },
            folios: {
              select: {
                folioNumber: true,
                subtotal: true,
                taxes: true,
                totalAmount: true,
                paidAmount: true,
                balance: true,
                status: true,
                openedAt: true,
                closedAt: true,
                lineItems: {
                  select: {
                    id: true,
                    description: true,
                    category: true,
                    quantity: true,
                    unitPrice: true,
                    totalAmount: true,
                    serviceDate: true,
                    taxRate: true,
                    taxAmount: true,
                  },
                  orderBy: { serviceDate: 'asc' },
                },
                payments: {
                  select: {
                    id: true,
                    amount: true,
                    method: true,
                    status: true,
                    gateway: true,
                    cardType: true,
                    cardLast4: true,
                    currency: true,
                    processedAt: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: 'desc' },
                },
              },
              orderBy: { openedAt: 'asc' },
              take: 100,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ---- Also fetch Bookings that DON'T have GuestStay records ----
    // This ensures ALL bookings appear in the report, not just checked-in ones
    const stayBookingIds = new Set(stays.map(s => s.bookingId));

    const bookingIncludeObj = {
      primaryGuest: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          nationality: true,
          country: true,
          city: true,
          dateOfBirth: true,
          gender: true,
          idType: true,
          idNumber: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          totalStays: true,
          totalSpent: true,
          isVip: true,
          vipLevel: true,
          source: true,
          kycStatus: true,
        },
      },
      room: {
        select: {
          number: true,
          floor: true,
          status: true,
        },
      },
      roomType: {
        select: {
          name: true,
          code: true,
          basePrice: true,
        },
      },
      property: {
        select: {
          name: true,
          slug: true,
          city: true,
          country: true,
        },
      },
      folios: {
        select: {
          folioNumber: true,
          subtotal: true,
          taxes: true,
          totalAmount: true,
          paidAmount: true,
          balance: true,
          status: true,
          openedAt: true,
          closedAt: true,
          lineItems: {
            select: {
              id: true,
              description: true,
              category: true,
              quantity: true,
              unitPrice: true,
              totalAmount: true,
              serviceDate: true,
              taxRate: true,
              taxAmount: true,
            },
            orderBy: { serviceDate: 'asc' },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              gateway: true,
              cardType: true,
              cardLast4: true,
              currency: true,
              processedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { openedAt: 'asc' },
        take: 100,
      },
    };

    // Build booking-only where clause (apply guest filters to primaryGuest relation)
    const bookingOnlyWhere: Record<string, unknown> = {
      ...bookingWhere,
      id: { notIn: [...stayBookingIds] },
    };

    // Apply guest filters to the primaryGuest relation for bookings without stays
    if (Object.keys(guestWhere).length > 0) {
      bookingOnlyWhere.primaryGuest = guestWhere;
    }

    const bookingsWithoutStays = await db.booking.findMany({
      where: bookingOnlyWhere,
      include: bookingIncludeObj,
      orderBy: { createdAt: 'desc' },
    });

    // ---- Combine stays and bookings without stays ----
    // For bookings without stays, compute roomNights from checkIn/checkOut
    function computeRoomNights(checkIn: Date | null, checkOut: Date | null): number {
      if (!checkIn || !checkOut) return 0;
      const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
      return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Create a unified "allRecords" array that contains both types
    type StayWithGuest = typeof stays[number];
    type BookingWithGuest = typeof bookingsWithoutStays[number];

    interface UnifiedRecord {
      type: 'stay' | 'booking';
      stayId: string;
      roomNights: number;
      stayTotalAmount: number;
      feedbackGiven: boolean;
      reviewGiven: boolean;
      stayCreatedAt: string;
      guest: NonNullable<StayWithGuest['guest']>;
      booking: StayWithGuest['booking'] | BookingWithGuest;
    }

    const allRecords: UnifiedRecord[] = [
      ...stays.map(s => ({
        type: 'stay' as const,
        stayId: s.id,
        roomNights: s.roomNights,
        stayTotalAmount: safeNumber(s.totalAmount) ?? 0,
        feedbackGiven: s.feedbackGiven,
        reviewGiven: s.reviewGiven,
        stayCreatedAt: safeDate(s.createdAt) ?? '',
        guest: s.guest,
        booking: s.booking,
      })),
      ...bookingsWithoutStays.map(b => {
        const guest = b.primaryGuest;
        const roomNights = computeRoomNights(b.checkIn, b.checkOut);
        return {
          type: 'booking' as const,
          stayId: `booking-${b.id}`,
          roomNights,
          stayTotalAmount: safeNumber(b.totalAmount) ?? 0,
          feedbackGiven: false,
          reviewGiven: false,
          stayCreatedAt: safeDate(b.createdAt) ?? '',
          guest: guest ?? {
            id: b.primaryGuestId ?? '',
            firstName: 'Unknown',
            lastName: '',
            email: null,
            phone: null,
            nationality: null,
            country: null,
            city: null,
            dateOfBirth: null,
            gender: null,
            idType: null,
            idNumber: null,
            loyaltyTier: 'bronze',
            loyaltyPoints: 0,
            totalStays: 0,
            totalSpent: 0,
            isVip: false,
            vipLevel: null,
            source: 'direct',
            kycStatus: 'pending',
          },
          booking: b,
        };
      }),
    ];

    // Sort combined records by createdAt desc, then apply pagination
    allRecords.sort((a, b) => b.stayCreatedAt.localeCompare(a.stayCreatedAt));
    const paginatedRecords = allRecords.slice(skip, skip + limit);

    // ---- Get total count for pagination ----
    const totalStaysCount = allRecords.length;

    // ---- ENHANCEMENT 2: Fetch guest feedback and reviews ----
    const guestIds = [...new Set(allRecords.map(s => s.guest.id))];
    const propertyIds = [...new Set(allRecords.map(s => {
      const b = s.booking as Record<string, unknown>;
      return b.propertyId as string;
    }).filter(Boolean))];

    const [feedbacks, reviews] = await Promise.all([
      guestIds.length > 0
        ? db.guestFeedback.findMany({
            where: {
              guestId: { in: guestIds },
              propertyId: { in: propertyIds },
            },
            select: {
              id: true,
              guestId: true,
              propertyId: true,
              type: true,
              category: true,
              subject: true,
              description: true,
              priority: true,
              status: true,
              resolvedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          })
        : [],
      guestIds.length > 0
        ? db.guestReview.findMany({
            where: {
              guestId: { in: guestIds },
              propertyId: { in: propertyIds },
            },
            select: {
              id: true,
              guestId: true,
              propertyId: true,
              overallRating: true,
              cleanlinessRating: true,
              serviceRating: true,
              locationRating: true,
              valueRating: true,
              title: true,
              comment: true,
              sentimentScore: true,
              sentimentLabel: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          })
        : [],
    ]);

    // ---- Flatten rows ----
    const flatRows: FlatGuestStayRow[] = paginatedRecords.map((rec) => {
      const booking = rec.booking as Record<string, any>;
      const guest = rec.guest;
      const room = booking.room;
      const roomType = booking.roomType;
      const property = booking.property;
      const folio = booking.folios?.[0] ?? null;
      const payment = folio?.payments?.[0] ?? null;

      return {
        // Stay
        stayId: rec.stayId,
        roomNights: rec.roomNights,
        stayTotalAmount: rec.stayTotalAmount,
        feedbackGiven: rec.feedbackGiven,
        reviewGiven: rec.reviewGiven,
        stayCreatedAt: rec.stayCreatedAt,

        // Guest
        guestId: guest.id,
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        guestNationality: guest.nationality,
        guestCountry: guest.country,
        guestCity: guest.city,
        guestDateOfBirth: safeDate(guest.dateOfBirth),
        guestGender: guest.gender,
        guestIdType: guest.idType,
        guestIdNumber: guest.idNumber,
        guestLoyaltyTier: guest.loyaltyTier,
        guestLoyaltyPoints: guest.loyaltyPoints,
        guestTotalStays: guest.totalStays,
        guestTotalSpent: safeNumber(guest.totalSpent) ?? 0,
        guestIsVip: guest.isVip,
        guestVipLevel: guest.vipLevel,
        guestSource: guest.source,
        guestKycStatus: guest.kycStatus,

        // Booking
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        checkIn: safeDate(booking.checkIn) ?? '',
        checkOut: safeDate(booking.checkOut) ?? '',
        actualCheckIn: safeDate(booking.actualCheckIn),
        actualCheckOut: safeDate(booking.actualCheckOut),
        bookingStatus: booking.status,
        bookingSource: booking.source,
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        roomRate: safeNumber(booking.roomRate) ?? 0,
        taxes: safeNumber(booking.taxes) ?? 0,
        discount: safeNumber(booking.discount) ?? 0,
        totalAmount: safeNumber(booking.totalAmount) ?? 0,
        currency: booking.currency,
        guaranteeType: booking.guaranteeType,
        cancellationRisk: booking.cancellationRisk,
        specialRequests: booking.specialRequests,
        bookingCreatedAt: safeDate(booking.createdAt) ?? '',

        // Room
        roomNumber: room?.number ?? null,
        roomFloor: room?.floor ?? null,
        roomStatus: room?.status ?? null,

        // Room type
        roomTypeName: roomType?.name ?? null,
        roomTypeCode: roomType?.code ?? null,
        roomTypeBaseRate: safeNumber(roomType?.basePrice) ?? null,

        // Property
        propertyName: property?.name ?? null,
        propertyCode: property?.slug ?? null,
        propertyCity: property?.city ?? null,
        propertyCountry: property?.country ?? null,

        // Folio
        folioNumber: folio?.folioNumber ?? null,
        folioSubtotal: safeNumber(folio?.subtotal),
        folioTaxes: safeNumber(folio?.taxes),
        folioTotalAmount: safeNumber(folio?.totalAmount),
        folioPaidAmount: safeNumber(folio?.paidAmount),
        folioBalance: safeNumber(folio?.balance),
        folioStatus: folio?.status ?? null,
        folioOpenedAt: safeDate(folio?.openedAt),
        folioClosedAt: safeDate(folio?.closedAt),

        // Payment
        paymentAmount: safeNumber(payment?.amount),
        paymentMethod: payment?.method ?? null,
        paymentStatus: payment?.status ?? null,
        paymentGateway: payment?.gateway ?? null,
        paymentCardType: payment?.cardType ?? null,
        paymentCreatedAt: safeDate(payment?.createdAt),
      };
    });

    // ---- Compute summary statistics ----
    const uniqueGuestIds = new Set(flatRows.map((r) => r.guestId));
    // Use folio total (includes late checkout fees, incidentals) when available, fall back to booking total
    const totalRevenue = flatRows.reduce((sum, r) => sum + (r.folioTotalAmount ?? r.totalAmount), 0);
    const totalRoomNights = flatRows.reduce((sum, r) => sum + r.roomNights, 0);

    const guestDistributionByNationality: Record<string, number> = {};
    const guestDistributionByLoyaltyTier: Record<string, number> = {};
    const guestDistributionBySource: Record<string, number> = {};
    const bookingStatusDistribution: Record<string, number> = {};
    const nationalityBreakdown: Record<string, { count: number; revenue: number; roomNights: number }> = {};
    const roomTypeBreakdown: Record<string, { count: number; revenue: number; roomNights: number }> = {};
    const revenueByMonthMap: Record<string, { revenue: number; stays: number; roomNights: number }> = {};

    let vipCount = 0;
    let nonVipCount = 0;

    // Use a set for unique guest distributions (count each guest once)
    const seenGuestsForNationality = new Set<string>();
    const seenGuestsForLoyaltyTier = new Set<string>();
    const seenGuestsForSource = new Set<string>();

    for (const row of flatRows) {
      // Booking status
      bookingStatusDistribution[row.bookingStatus] = (bookingStatusDistribution[row.bookingStatus] ?? 0) + 1;

      // VIP
      if (row.guestIsVip) {
        vipCount++;
      } else {
        nonVipCount++;
      }

      // Guest distributions (unique per guest)
      if (!seenGuestsForNationality.has(row.guestId)) {
        seenGuestsForNationality.add(row.guestId);
        const nat = row.guestNationality || 'Unknown';
        guestDistributionByNationality[nat] = (guestDistributionByNationality[nat] ?? 0) + 1;
      }

      if (!seenGuestsForLoyaltyTier.has(row.guestId)) {
        seenGuestsForLoyaltyTier.add(row.guestId);
        guestDistributionByLoyaltyTier[row.guestLoyaltyTier] = (guestDistributionByLoyaltyTier[row.guestLoyaltyTier] ?? 0) + 1;
      }

      if (!seenGuestsForSource.has(row.guestId)) {
        seenGuestsForSource.add(row.guestId);
        guestDistributionBySource[row.guestSource] = (guestDistributionBySource[row.guestSource] ?? 0) + 1;
      }

      // Nationality breakdown (per stay for revenue)
      const nat = row.guestNationality || 'Unknown';
      if (!nationalityBreakdown[nat]) {
        nationalityBreakdown[nat] = { count: 0, revenue: 0, roomNights: 0 };
      }
      nationalityBreakdown[nat].count += 1;
      nationalityBreakdown[nat].revenue += row.folioTotalAmount ?? row.totalAmount;
      nationalityBreakdown[nat].roomNights += row.roomNights;

      // Room type breakdown
      const rt = row.roomTypeName || 'Unknown';
      if (!roomTypeBreakdown[rt]) {
        roomTypeBreakdown[rt] = { count: 0, revenue: 0, roomNights: 0 };
      }
      roomTypeBreakdown[rt].count += 1;
      roomTypeBreakdown[rt].revenue += row.folioTotalAmount ?? row.totalAmount;
      roomTypeBreakdown[rt].roomNights += row.roomNights;

      // Revenue by month
      if (row.checkIn) {
        try {
          const monthKey = format(new Date(row.checkIn), 'yyyy-MM');
          if (!revenueByMonthMap[monthKey]) {
            revenueByMonthMap[monthKey] = { revenue: 0, stays: 0, roomNights: 0 };
          }
          revenueByMonthMap[monthKey].revenue += row.folioTotalAmount ?? row.totalAmount;
          revenueByMonthMap[monthKey].stays += 1;
          revenueByMonthMap[monthKey].roomNights += row.roomNights;
        } catch {
          // skip invalid date
        }
      }
    }

    // Fill in missing months in the range
    try {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      for (const m of months) {
        const key = format(m, 'yyyy-MM');
        if (!revenueByMonthMap[key]) {
          revenueByMonthMap[key] = { revenue: 0, stays: 0, roomNights: 0 };
        }
      }
    } catch {
      // skip if interval is invalid
    }

    const revenueByMonth = Object.entries(revenueByMonthMap)
      .map(([month, data]) => ({
        month,
        revenue: round2(data.revenue),
        stays: data.stays,
        roomNights: data.roomNights,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ---- ENHANCEMENT 3: Compute enhanced summary stats ----

    // Cancellation analysis
    const cancelledStays = flatRows.filter(r => r.bookingStatus === 'cancelled').length;
    const cancelledRevenue = flatRows.filter(r => r.bookingStatus === 'cancelled').reduce((s, r) => s + r.totalAmount, 0);
    const cancellationRate = flatRows.length > 0 ? round2((cancelledStays / flatRows.length) * 100) : 0;
    const noShowCount = flatRows.filter(r => r.bookingStatus === 'no_show').length;

    // Count cancellation reasons from booking data
    const cancellationReasons: Record<string, number> = {};
    for (const rec of allRecords) {
      const reason = (rec.booking as Record<string, unknown>)?.cancellationReason;
      if (typeof reason === 'string' && reason) {
        cancellationReasons[reason] = (cancellationReasons[reason] ?? 0) + 1;
      }
    }

    // Outstanding balance & collection
    const totalOutstanding = flatRows.reduce((s, r) => s + (r.folioBalance ?? 0), 0);
    const totalCollected = flatRows.reduce((s, r) => s + (r.folioPaidAmount ?? 0), 0);
    const collectionRate = (totalCollected + totalOutstanding) > 0
      ? round2((totalCollected / (totalCollected + totalOutstanding)) * 100)
      : 0;

    // Repeat guest analysis
    const guestStayCount: Record<string, { count: number; revenue: number }> = {};
    for (const row of flatRows) {
      if (!guestStayCount[row.guestId]) {
        guestStayCount[row.guestId] = { count: 0, revenue: 0 };
      }
      guestStayCount[row.guestId].count += 1;
      guestStayCount[row.guestId].revenue += row.totalAmount;
    }
    let repeatGuestCount = 0;
    let firstTimeGuestCount = 0;
    let repeatGuestRevenue = 0;
    let firstTimeGuestRevenue = 0;
    for (const [_, data] of Object.entries(guestStayCount)) {
      if (data.count > 1) {
        repeatGuestCount++;
        repeatGuestRevenue += data.revenue;
      } else {
        firstTimeGuestCount++;
        firstTimeGuestRevenue += data.revenue;
      }
    }

    // Industry KPIs
    const adr = totalRoomNights > 0 ? round2(totalRevenue / totalRoomNights) : 0;
    const revpar = round2(totalRevenue / Math.max(totalRoomNights, 1));

    // Booking source breakdown
    const sourceBreakdown: Record<string, { revenue: number; bookings: number; roomNights: number }> = {};
    for (const row of flatRows) {
      const src = row.bookingSource || 'unknown';
      if (!sourceBreakdown[src]) {
        sourceBreakdown[src] = { revenue: 0, bookings: 0, roomNights: 0 };
      }
      sourceBreakdown[src].revenue += row.totalAmount;
      sourceBreakdown[src].bookings += 1;
      sourceBreakdown[src].roomNights += row.roomNights;
    }
    const revenueBySource = Object.entries(sourceBreakdown)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([source, data]) => ({
        source,
        revenue: round2(data.revenue),
        bookings: data.bookings,
        roomNights: data.roomNights,
      }));

    // Guest feedback summary
    const averageRating = reviews.length > 0
      ? round2(reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length)
      : null;
    const totalReviews = reviews.length;
    const feedbackByCategory: Record<string, number> = {};
    for (const fb of feedbacks) {
      feedbackByCategory[fb.category] = (feedbackByCategory[fb.category] ?? 0) + 1;
    }

    const summary: SummaryStats = {
      totalGuests: uniqueGuestIds.size,
      totalStays: flatRows.length,
      totalRoomNights,
      totalRevenue: round2(totalRevenue),
      averageStayLength: flatRows.length > 0 ? round2(totalRoomNights / flatRows.length) : 0,
      averageRevenuePerStay: flatRows.length > 0 ? round2(totalRevenue / flatRows.length) : 0,
      guestDistributionByNationality,
      guestDistributionByLoyaltyTier,
      guestDistributionBySource,
      guestDistributionByVipStatus: { vip: vipCount, nonVip: nonVipCount },
      bookingStatusDistribution,
      revenueByMonth,

      // Enhanced stats
      cancellationRate,
      cancelledStays,
      cancelledRevenue: round2(cancelledRevenue),
      cancellationReasons,
      noShowCount,
      totalOutstanding: round2(totalOutstanding),
      totalCollected: round2(totalCollected),
      collectionRate,
      repeatGuestCount,
      firstTimeGuestCount,
      repeatGuestRevenue: round2(repeatGuestRevenue),
      firstTimeGuestRevenue: round2(firstTimeGuestRevenue),
      adr,
      revpar,
      revenueBySource,
      averageRating,
      totalReviews,
      feedbackByCategory,
    };

    // ---- Return based on format ----
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    const filename = `guest-stay-report_${startDateStr}_to_${endDateStr}`;

    if (format_ === 'json') {
      // Build chart-friendly data structures
      const nationalityDistribution = Object.entries(guestDistributionByNationality)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([country, guests]) => ({
          country,
          guests,
          percentage: uniqueGuestIds.size > 0 ? round2((guests / uniqueGuestIds.size) * 100) : 0,
        }));

      const bookingStatusChartData = Object.entries(bookingStatusDistribution)
        .map(([status, count]) => ({ status, count }));

      const revenueByRoomTypeChartData = Object.entries(roomTypeBreakdown)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .map(([roomType, data]) => ({
          roomType,
          revenue: round2(data.revenue),
          bookings: data.count,
        }));

      const monthlyRevenue = revenueByMonth.map((m) => ({
        month: m.month,
        revenue: m.revenue,
        bookings: m.stays,
      }));

      // ---- ENHANCEMENT 4: Transform flat rows with extended data ----
      const records = flatRows.map((row) => {
        // Find the corresponding record for folio details
        const matchingRec = paginatedRecords.find(r => r.stayId === row.stayId);
        const booking = matchingRec?.booking as Record<string, any> | undefined;

        return {
          id: row.stayId,
          guestName: `${row.guestFirstName} ${row.guestLastName}`.trim(),
          email: row.guestEmail ?? '',
          phone: row.guestPhone ?? '',
          nationality: row.guestNationality ?? 'Unknown',
          isVIP: row.guestIsVip,
          loyaltyTier: row.guestLoyaltyTier as string | null,
          confirmationCode: row.confirmationCode,
          propertyName: row.propertyName ?? '',
          roomNumber: row.roomNumber ?? '',
          roomType: row.roomTypeName ?? '',
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          nights: row.roomNights,
          roomRate: row.roomRate,
          taxes: row.taxes,
          totalAmount: row.totalAmount,
          status: row.bookingStatus,
          paymentStatus: row.paymentStatus ?? 'pending',
          source: row.bookingSource,
          // Extended detail fields
          guestId: row.guestId,
          address: row.guestCity ? `${row.guestCity}, ${row.guestCountry ?? ''}`.trim() : null,
          city: row.guestCity,
          country: row.guestCountry,
          dateOfBirth: row.guestDateOfBirth,
          idType: row.guestIdType,
          idNumber: row.guestIdNumber,
          specialRequests: row.specialRequests,
          folioNumber: row.folioNumber,
          paymentMethod: row.paymentMethod,
          paidAmount: row.folioPaidAmount ?? undefined,
          outstandingAmount: row.folioBalance ?? undefined,
          actualCheckIn: row.actualCheckIn,
          actualCheckOut: row.actualCheckOut,
          adults: row.adults,
          children: row.children,
          propertyId: undefined as string | undefined,
          bookingId: row.bookingId,

          // ENHANCEMENT 4a: All folio line items
          allFolioLineItems: booking?.folios?.flatMap(f =>
            f.lineItems.map(li => ({
              id: li.id,
              folioNumber: f.folioNumber,
              description: li.description,
              category: li.category,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              totalAmount: li.totalAmount,
              serviceDate: safeDate(li.serviceDate),
            }))
          ) ?? [],

          // ENHANCEMENT 4b: All payments
          allPayments: booking?.folios?.flatMap(f =>
            f.payments.map(p => ({
              id: p.id,
              folioNumber: f.folioNumber,
              amount: safeNumber(p.amount),
              method: p.method,
              status: p.status,
              gateway: p.gateway,
              cardType: p.cardType,
              cardLast4: p.cardLast4,
              currency: p.currency,
              processedAt: safeDate(p.processedAt),
              createdAt: safeDate(p.createdAt),
            }))
          ) ?? [],

          // ENHANCEMENT 4c: Guest feedbacks for this guest
          guestFeedbacks: feedbacks.filter(fb => fb.guestId === row.guestId).map(fb => ({
            id: fb.id,
            type: fb.type,
            category: fb.category,
            subject: fb.subject,
            description: fb.description,
            priority: fb.priority,
            status: fb.status,
            resolvedAt: safeDate(fb.resolvedAt),
            createdAt: safeDate(fb.createdAt),
          })),

          // ENHANCEMENT 4d: Guest reviews for this guest
          guestReviews: reviews.filter(rv => rv.guestId === row.guestId).map(rv => ({
            id: rv.id,
            overallRating: rv.overallRating,
            cleanlinessRating: rv.cleanlinessRating,
            serviceRating: rv.serviceRating,
            locationRating: rv.locationRating,
            valueRating: rv.valueRating,
            title: rv.title,
            comment: rv.comment,
            sentimentScore: rv.sentimentScore,
            sentimentLabel: rv.sentimentLabel,
            createdAt: safeDate(rv.createdAt),
          })),
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          records,
          summary: {
            totalGuests: summary.totalGuests,
            totalStays: summary.totalStays,
            totalRoomNights: summary.totalRoomNights,
            totalRevenue: summary.totalRevenue,
            avgStayLength: summary.averageStayLength,
            avgRevenuePerStay: summary.averageRevenuePerStay,
            // ENHANCEMENT: New summary fields
            cancellationRate: summary.cancellationRate,
            cancelledStays: summary.cancelledStays,
            cancelledRevenue: summary.cancelledRevenue,
            noShowCount: summary.noShowCount,
            totalOutstanding: summary.totalOutstanding,
            totalCollected: summary.totalCollected,
            collectionRate: summary.collectionRate,
            repeatGuestCount: summary.repeatGuestCount,
            firstTimeGuestCount: summary.firstTimeGuestCount,
            repeatGuestRevenue: summary.repeatGuestRevenue,
            firstTimeGuestRevenue: summary.firstTimeGuestRevenue,
            adr: summary.adr,
            revpar: summary.revpar,
            averageRating: summary.averageRating,
            totalReviews: summary.totalReviews,
          },
          charts: {
            monthlyRevenue,
            nationalityDistribution,
            bookingStatusDistribution: bookingStatusChartData,
            revenueByRoomType: revenueByRoomTypeChartData,
            // ENHANCEMENT: New chart data
            revenueBySource: summary.revenueBySource,
            cancellationAnalysis: {
              cancelled: summary.cancelledStays,
              noShow: summary.noShowCount,
              confirmed: flatRows.filter(r => r.bookingStatus === 'confirmed').length,
              checkedIn: flatRows.filter(r => r.bookingStatus === 'checked_in').length,
              checkedOut: flatRows.filter(r => r.bookingStatus === 'checked_out').length,
            },
            repeatGuestAnalysis: {
              firstTime: { guests: summary.firstTimeGuestCount, revenue: round2(summary.firstTimeGuestRevenue) },
              repeat: { guests: summary.repeatGuestCount, revenue: round2(summary.repeatGuestRevenue) },
            },
          },
          pagination: {
            page,
            limit,
            total: totalStaysCount,
            totalPages: Math.ceil(totalStaysCount / limit),
          },
        },
      });
    }

    if (format_ === 'csv') {
      const csv = generateCsv(flatRows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    if (format_ === 'xlsx') {
      // ENHANCEMENT 5: Pass stays for payment/line item sheets
      const xlsxBuf = await generateXlsx(flatRows, summary, nationalityBreakdown, roomTypeBreakdown, allRecords);
      return new NextResponse(xlsxBuf, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    if (format_ === 'pdf') {
      const pdfBuf = await generatePdf(flatRows, summary, startDateStr, endDateStr);
      return new NextResponse(pdfBuf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    // Should not reach here due to earlier validation
    return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('[Guest Stay Report] Error generating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate guest stay report' },
      { status: 500 },
    );
  }
}
