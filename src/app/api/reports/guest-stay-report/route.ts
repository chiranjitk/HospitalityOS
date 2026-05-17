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
    const isVipParam = searchParams.get('isVip') || searchParams.get('vipOnly');
    const isVip = isVipParam === 'true' ? true : isVipParam === 'false' ? false : null;
    const search = searchParams.get('search') || '';

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10), 1), 5000);
    const skip = (page - 1) * limit;

    // ---- Build where clause ----
    // We query through GuestStay -> booking -> to filter by tenant and date range
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

    const bookingWhere: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      checkIn: { gte: startDate },
      checkOut: { lte: endDate },
    };

    if (propertyId && propertyId !== 'all') {
      bookingWhere.propertyId = propertyId;
    }
    if (status && status !== 'all') {
      bookingWhere.status = status;
    }

    // ---- Fetch data with comprehensive includes ----
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
                payments: {
                  select: {
                    amount: true,
                    method: true,
                    status: true,
                    gateway: true,
                    cardType: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
              orderBy: { openedAt: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // ---- Get total count for pagination ----
    const totalStays = await db.guestStay.count({
      where: {
        guest: guestWhere,
        booking: bookingWhere,
      },
    });

    // ---- Flatten rows ----
    const flatRows: FlatGuestStayRow[] = stays.map((stay) => {
      const booking = stay.booking;
      const guest = stay.guest;
      const room = booking.room;
      const roomType = booking.roomType;
      const property = booking.property;
      const folio = booking.folios?.[0] ?? null;
      const payment = folio?.payments?.[0] ?? null;

      return {
        // Stay
        stayId: stay.id,
        roomNights: stay.roomNights,
        stayTotalAmount: safeNumber(stay.totalAmount) ?? 0,
        feedbackGiven: stay.feedbackGiven,
        reviewGiven: stay.reviewGiven,
        stayCreatedAt: safeDate(stay.createdAt) ?? '',

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
    const totalRevenue = flatRows.reduce((sum, r) => sum + r.totalAmount, 0);
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
      nationalityBreakdown[nat].revenue += row.totalAmount;
      nationalityBreakdown[nat].roomNights += row.roomNights;

      // Room type breakdown
      const rt = row.roomTypeName || 'Unknown';
      if (!roomTypeBreakdown[rt]) {
        roomTypeBreakdown[rt] = { count: 0, revenue: 0, roomNights: 0 };
      }
      roomTypeBreakdown[rt].count += 1;
      roomTypeBreakdown[rt].revenue += row.totalAmount;
      roomTypeBreakdown[rt].roomNights += row.roomNights;

      // Revenue by month
      if (row.checkIn) {
        try {
          const monthKey = format(new Date(row.checkIn), 'yyyy-MM');
          if (!revenueByMonthMap[monthKey]) {
            revenueByMonthMap[monthKey] = { revenue: 0, stays: 0, roomNights: 0 };
          }
          revenueByMonthMap[monthKey].revenue += row.totalAmount;
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

      // Transform flat rows to guest stay records for the frontend
      const records = flatRows.map((row) => ({
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
      }));

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
          },
          charts: {
            monthlyRevenue,
            nationalityDistribution,
            bookingStatusDistribution: bookingStatusChartData,
            revenueByRoomType: revenueByRoomTypeChartData,
          },
          pagination: {
            page,
            limit,
            total: totalStays,
            totalPages: Math.ceil(totalStays / limit),
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
      const xlsxBuf = await generateXlsx(flatRows, summary, nationalityBreakdown, roomTypeBreakdown);
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
