/**
 * BI Export API (Feature #252/#373)
 *
 * Export report data as CSV, JSON, or streaming download.
 * Supports: revenue, occupancy, bookings, guests, financial, housekeeping.
 * Uses ReadableStream for memory-efficient CSV streaming on large datasets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 500;

function toCsvRow(row: Record<string, unknown>): string {
  return Object.values(row).map((v) => {
    const str = v === null || v === undefined ? '' : String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

function csvEscape(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type ReportFetcher = (tenantId: string, propertyId: string | null, startDate: Date, endDate: Date, skip: number, take: number)
  => Promise<{ headers: string[]; rows: Record<string, unknown>[] }>;

async function fetchRevenueReport(tenantId: string, propertyId: string | null, startDate: Date, endDate: Date, skip: number, take: number) {
  const baseWhere: Record<string, unknown> = { tenantId, checkIn: { gte: startDate, lte: endDate }, deletedAt: null };
  if (propertyId) baseWhere.propertyId = propertyId;
  const bookings = await db.booking.findMany({
    where: baseWhere,
    select: {
      id: true, confirmationCode: true, status: true,
      totalAmount: true, roomRate: true, taxes: true, fees: true, currency: true,
      checkIn: true, checkOut: true,
      property: { select: { name: true } },
      primaryGuest: { select: { firstName: true, lastName: true } },
    },
    orderBy: { checkIn: 'asc' },
    skip,
    take,
  });
  return {
    headers: ['ID', 'Confirmation', 'Status', 'Total', 'Room Rate', 'Taxes', 'Fees', 'Currency', 'Check-In', 'Check-Out', 'Property', 'Guest'],
    rows: bookings.map((b) => ({
      ID: b.id,
      Confirmation: b.confirmationCode,
      Status: b.status,
      Total: b.totalAmount,
      'Room Rate': b.roomRate,
      Taxes: b.taxes,
      Fees: b.fees,
      Currency: b.currency,
      'Check-In': b.checkIn.toISOString().split('T')[0],
      'Check-Out': b.checkOut.toISOString().split('T')[0],
      Property: b.property.name,
      Guest: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
    })),
  };
}

async function fetchBookingsReport(tenantId: string, propertyId: string | null, startDate: Date, endDate: Date, skip: number, take: number) {
  const baseWhere: Record<string, unknown> = { tenantId, createdAt: { gte: startDate, lte: endDate }, deletedAt: null };
  if (propertyId) baseWhere.propertyId = propertyId;
  const bookings = await db.booking.findMany({
    where: baseWhere,
    select: {
      id: true, confirmationCode: true, status: true, source: true,
      adults: true, children: true, totalAmount: true, currency: true,
      checkIn: true, checkOut: true,
      property: { select: { name: true } },
      primaryGuest: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
  return {
    headers: ['ID', 'Confirmation', 'Status', 'Source', 'Adults', 'Children', 'Total', 'Currency', 'Check-In', 'Check-Out', 'Property', 'Guest', 'Email'],
    rows: bookings.map((b) => ({
      ID: b.id,
      Confirmation: b.confirmationCode,
      Status: b.status,
      Source: b.source,
      Adults: b.adults,
      Children: b.children,
      Total: b.totalAmount,
      Currency: b.currency,
      'Check-In': b.checkIn.toISOString().split('T')[0],
      'Check-Out': b.checkOut.toISOString().split('T')[0],
      Property: b.property.name,
      Guest: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      Email: b.primaryGuest.email || '',
    })),
  };
}

async function fetchGuestsReport(tenantId: string, _propertyId: string | null, startDate: Date, endDate: Date, skip: number, take: number) {
  const guests = await db.guest.findMany({
    where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      city: true, country: true, vip: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
  return {
    headers: ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'City', 'Country', 'VIP', 'Created'],
    rows: guests.map((g) => ({
      ID: g.id,
      'First Name': g.firstName,
      'Last Name': g.lastName,
      Email: g.email || '',
      Phone: g.phone || '',
      City: g.city || '',
      Country: g.country || '',
      VIP: g.vip ? 'Yes' : 'No',
      Created: g.createdAt.toISOString().split('T')[0],
    })),
  };
}

async function fetchFinancialReport(tenantId: string, propertyId: string | null, startDate: Date, endDate: Date, skip: number, take: number) {
  const baseWhere: Record<string, unknown> = { tenantId, createdAt: { gte: startDate, lte: endDate } };
  if (propertyId) baseWhere.booking = { propertyId };
  const folios = await db.folio.findMany({
    where: baseWhere,
    select: {
      id: true, folioNumber: true, status: true, totalAmount: true,
      createdAt: true,
      booking: { select: { confirmationCode: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
  return {
    headers: ['ID', 'Folio Number', 'Status', 'Total', 'Created', 'Booking'],
    rows: folios.map((f) => ({
      ID: f.id,
      'Folio Number': f.folioNumber,
      Status: f.status,
      Total: f.totalAmount || 0,
      Created: f.createdAt.toISOString().split('T')[0],
      Booking: f.booking?.confirmationCode || '',
    })),
  };
}

async function fetchOccupancyReport(tenantId: string, propertyId: string | null, _startDate: Date, _endDate: Date, skip: number, take: number) {
  const rooms = await db.room.findMany({
    where: { property: { tenantId, ...(propertyId ? { id: propertyId } : {}) } },
    select: {
      id: true, number: true, floor: true, status: true,
      roomType: { select: { name: true } },
      property: { select: { name: true } },
    },
    skip,
    take,
  });
  return {
    headers: ['Room ID', 'Number', 'Floor', 'Status', 'Room Type', 'Property'],
    rows: rooms.map((r) => ({
      'Room ID': r.id,
      Number: r.number,
      Floor: r.floor,
      Status: r.status,
      'Room Type': r.roomType.name,
      Property: r.property.name,
    })),
  };
}

async function fetchHousekeepingReport(tenantId: string, propertyId: string | null, _startDate: Date, _endDate: Date, skip: number, take: number) {
  const rooms = await db.room.findMany({
    where: { property: { tenantId, ...(propertyId ? { id: propertyId } : {}) } },
    select: {
      id: true, number: true, floor: true, status: true,
      roomType: { select: { name: true } },
      property: { select: { name: true } },
    },
    skip,
    take,
  });
  return {
    headers: ['Room ID', 'Number', 'Floor', 'Status', 'Room Type', 'Property'],
    rows: rooms.map((r) => ({
      'Room ID': r.id,
      Number: r.number,
      Floor: r.floor,
      Status: r.status,
      'Room Type': r.roomType.name,
      Property: r.property.name,
    })),
  };
}

const reportFetchers: Record<string, ReportFetcher> = {
  revenue: fetchRevenueReport,
  bookings: fetchBookingsReport,
  guests: fetchGuestsReport,
  financial: fetchFinancialReport,
  occupancy: fetchOccupancyReport,
  housekeeping: fetchHousekeepingReport,
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const reportType = searchParams.get('reportType') || 'revenue';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const propertyId = searchParams.get('propertyId');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
    }

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format. Use ISO 8601.' }, { status: 400 });
    }

    const fetcher = reportFetchers[reportType];
    if (!fetcher) {
      return NextResponse.json({ error: `Unknown report type: ${reportType}. Supported: ${Object.keys(reportFetchers).join(', ')}` }, { status: 400 });
    }

    const filename = `staysuite-${reportType}-${dateFrom}-to-${dateTo}`;

    // JSON format - load all data into memory
    if (format === 'json') {
      const allRows: Record<string, unknown>[] = [];
      let headers: string[] = [];
      let skip = 0;

      // First batch to get headers
      const firstBatch = await fetcher(tenantId, propertyId, startDate, endDate, 0, BATCH_SIZE);
      headers = firstBatch.headers;
      allRows.push(...firstBatch.rows);

      // Continue fetching if there might be more
      if (firstBatch.rows.length === BATCH_SIZE) {
        skip = BATCH_SIZE;
        while (true) {
          const batch = await fetcher(tenantId, propertyId, startDate, endDate, skip, BATCH_SIZE);
          allRows.push(...batch.rows);
          if (batch.rows.length < BATCH_SIZE) break;
          skip += BATCH_SIZE;
        }
      }

      return new NextResponse(JSON.stringify({ headers, rows: allRows, generatedAt: new Date().toISOString(), totalRows: allRows.length }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV format - use streaming ReadableStream for memory-efficient delivery
    const encoder = new TextEncoder();
    let headerWritten = false;
    let skip = 0;

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const batch = await fetcher(tenantId, propertyId, startDate, endDate, skip, BATCH_SIZE);

          if (!headerWritten) {
            controller.enqueue(encoder.encode(batch.headers.map(csvEscape).join(',') + '\n'));
            headerWritten = true;
          }

          if (batch.rows.length === 0) {
            controller.close();
            return;
          }

          for (const row of batch.rows) {
            controller.enqueue(encoder.encode(toCsvRow(row) + '\n'));
          }

          if (batch.rows.length < BATCH_SIZE) {
            controller.close();
          } else {
            skip += BATCH_SIZE;
          }
        } catch (err) {
          logger.error('BI export stream error', err instanceof Error ? err : new Error(String(err)));
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('BI export failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
