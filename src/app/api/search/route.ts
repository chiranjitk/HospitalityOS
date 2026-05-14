/**
 * Global Search API (Feature #23)
 *
 * Search across multiple models (Guests, Bookings, Rooms, Folios, Invoices, Properties).
 * Returns results grouped by type with match highlights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

const MAX_PER_TYPE = 5;
const MAX_TOTAL = 25;

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  highlights?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const types = searchParams.get('types')?.split(',').filter(Boolean);

    if (q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const query = `%${q}%`;
    const results: Record<string, SearchResult[]> = {};
    let total = 0;

    const searchTypes = types?.length ? types : ['guests', 'bookings', 'rooms', 'folios', 'invoices', 'properties'];

    for (const type of searchTypes) {
      if (total >= MAX_TOTAL) break;

      const limit = Math.min(MAX_PER_TYPE, MAX_TOTAL - total);
      let items: SearchResult[] = [];

      switch (type) {
        case 'guests': {
          const guests = await db.guest.findMany({
            where: {
              tenantId,
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            },
            take: limit,
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          });
          items = guests.map((g) => ({
            id: g.id,
            type: 'guest',
            title: `${g.firstName} ${g.lastName}`,
            subtitle: g.email || g.phone || undefined,
            highlights: [],
          }));
          break;
        }

        case 'bookings': {
          const bookings = await db.booking.findMany({
            where: {
              tenantId,
              deletedAt: null,
              OR: [
                { confirmationCode: { contains: q, mode: 'insensitive' } },
                { primaryGuest: { firstName: { contains: q, mode: 'insensitive' } } },
                { primaryGuest: { lastName: { contains: q, mode: 'insensitive' } } },
              ],
            },
            take: limit,
            select: {
              id: true,
              confirmationCode: true,
              status: true,
              primaryGuest: { select: { firstName: true, lastName: true } },
            },
          });
          items = bookings.map((b) => ({
            id: b.id,
            type: 'booking',
            title: `Booking #${b.confirmationCode}`,
            subtitle: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName} (${b.status})`,
            highlights: [],
          }));
          break;
        }

        case 'rooms': {
          const rooms = await db.room.findMany({
            where: {
              property: { tenantId },
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { roomType: { name: { contains: q, mode: 'insensitive' } } },
              ],
            },
            take: limit,
            select: {
              id: true,
              number: true,
              name: true,
              floor: true,
              roomType: { select: { name: true } },
              property: { select: { name: true } },
            },
          });
          items = rooms.map((r) => ({
            id: r.id,
            type: 'room',
            title: `Room ${r.number}${r.name ? ` - ${r.name}` : ''}`,
            subtitle: `${r.roomType.name} · Floor ${r.floor} · ${r.property.name}`,
            highlights: [],
          }));
          break;
        }

        case 'folios': {
          const folios = await db.folio.findMany({
            where: {
              tenantId,
              OR: [
                { folioNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: { id: true, folioNumber: true, status: true, totalAmount: true },
          });
          items = folios.map((f) => ({
            id: f.id,
            type: 'folio',
            title: `Folio #${f.folioNumber}`,
            subtitle: `${f.status} · $${(f.totalAmount || 0).toFixed(2)}`,
            highlights: [],
          }));
          break;
        }

        case 'invoices': {
          const invoices = await db.invoice.findMany({
            where: {
              tenantId,
              OR: [
                { invoiceNumber: { contains: q, mode: 'insensitive' } },
                { customerName: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: { id: true, invoiceNumber: true, customerName: true, totalAmount: true, status: true },
          });
          items = invoices.map((inv) => ({
            id: inv.id,
            type: 'invoice',
            title: `Invoice #${inv.invoiceNumber}`,
            subtitle: `${inv.customerName} · ${inv.status} · $${(inv.totalAmount || 0).toFixed(2)}`,
            highlights: [],
          }));
          break;
        }

        case 'properties': {
          const properties = await db.property.findMany({
            where: {
              tenantId,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: { id: true, name: true, city: true, country: true },
          });
          items = properties.map((p) => ({
            id: p.id,
            type: 'property',
            title: p.name,
            subtitle: [p.city, p.country].filter(Boolean).join(', '),
            highlights: [],
          }));
          break;
        }
      }

      if (items.length > 0) {
        results[type] = items;
        total += items.length;
      }
    }

    logger.info('Global search completed', { query: q, resultCount: total, tenantId, types: searchTypes });

    return NextResponse.json({ results, total });
  } catch (error) {
    logger.error('Global search failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
