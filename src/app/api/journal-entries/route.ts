/**
 * Journal Entries API — CRUD for JournalEntry
 *
 * GET:    List journal entries (paginated, filterable)
 * POST:   Create a new journal entry with lines
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list journal entries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entryNumber, date, description, reference, propertyId, lines } = body;

    if (!entryNumber || !date) {
      return NextResponse.json({ error: 'entryNumber and date are required' }, { status: 400 });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one journal entry line is required' }, { status: 400 });
    }

    // Validate debits = credits (journal entry must balance)
    const totalDebits = lines.reduce((sum: number, line: { debitAmount?: number; creditAmount?: number }) => sum + (line.debitAmount ?? 0), 0);
    const totalCredits = lines.reduce((sum: number, line: { debitAmount?: number; creditAmount?: number }) => sum + (line.creditAmount ?? 0), 0);
    // Round to 2 decimal places for comparison
    const roundedDebits = Math.round(totalDebits * 100) / 100;
    const roundedCredits = Math.round(totalCredits * 100) / 100;
    if (roundedDebits !== roundedCredits) {
      return NextResponse.json({ error: `Journal entry must balance. Total debits: ${roundedDebits}, Total credits: ${roundedCredits}` }, { status: 400 });
    }

    // Validate property belongs to tenant if provided
    if (propertyId) {
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 400 });
      }
    }

    const entry = await db.journalEntry.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        entryNumber,
        date: new Date(date),
        description: description || null,
        reference: reference || null,
        status: 'draft',
        postedBy: user.id,
        lines: {
          create: lines.map((line: { accountId: string; debitAmount?: number; creditAmount?: number; description?: string }) => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount ?? 0,
            creditAmount: line.creditAmount ?? 0,
            description: line.description || null,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create journal entry', error instanceof Error ? error : new Error(String(error)));
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Journal entry number already exists for this tenant' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
