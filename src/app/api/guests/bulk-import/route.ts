/**
 * Bulk Guest Import via CSV
 *
 * POST /api/guests/bulk-import
 *
 * Accepts multipart/form-data with a CSV file.
 * Parses headers: firstName, lastName, email, phone, nationality, idType, idNumber
 * Validates each row and creates guests in bulk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { parseCsv, validateGuestRow } from '@/lib/import/csv-parser';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.manage', 'admin.guests', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No CSV file provided. Use field name "file".' },
        { status: 400 },
      );
    }

    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV file (.csv)' },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 },
      );
    }

    const csvText = await file.text();
    const { headers, rows, errors: parseErrors } = parseCsv(csvText, { maxRows: 5000 });

    if (headers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty or has no headers' },
        { status: 400 },
      );
    }

    // Required columns check
    const requiredColumns = ['firstName', 'lastName'];
    const missingColumns = requiredColumns.filter((col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required columns: ${missingColumns.join(', ')}. Found: ${headers.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Map CSV headers to database fields
    const headerMap: Record<string, string> = {};
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      if (lower === 'firstname' || lower === 'first_name') headerMap[h] = 'firstName';
      else if (lower === 'lastname' || lower === 'last_name') headerMap[h] = 'lastName';
      else if (lower === 'email') headerMap[h] = 'email';
      else if (lower === 'phone' || lower === 'phone_number' || lower === 'mobile') headerMap[h] = 'phone';
      else if (lower === 'nationality') headerMap[h] = 'nationality';
      else if (lower === 'idtype' || lower === 'id_type' || lower === 'id type') headerMap[h] = 'idType';
      else if (lower === 'idnumber' || lower === 'id_number' || lower === 'id number') headerMap[h] = 'idNumber';
      else headerMap[h] = h; // Keep unmapped headers as-is
    }

    // Validate all rows
    const allErrors: string[] = [...parseErrors];
    const validRows: Array<Record<string, string>> = [];
    const failedRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      // Remap row keys from CSV headers to database field names
      const mappedRow: Record<string, string> = {};
      for (const [key, value] of Object.entries(rows[i])) {
        const dbField = headerMap[key];
        if (dbField) {
          mappedRow[dbField] = value;
        }
      }

      const rowErrors = validateGuestRow(mappedRow, i);
      if (rowErrors.length > 0) {
        allErrors.push(...rowErrors);
        failedRows.push(i);
      } else {
        validRows.push(mappedRow);
      }
    }

    // Bulk create guests
    let imported = 0;
    let bulkError = '';

    if (validRows.length > 0) {
      try {
        const result = await db.guest.createMany({
          data: validRows.map((row) => ({
            tenantId: user.tenantId,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
            phone: row.phone || null,
            nationality: row.nationality || null,
            idType: row.idType || null,
            idNumber: row.idNumber || null,
          })),
          skipDuplicates: true,
        });

        imported = result.count;
      } catch (dbError) {
        bulkError = dbError instanceof Error ? dbError.message : 'Bulk insert failed';
        allErrors.push(`Bulk insert: ${bulkError}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        failed: failedRows.length,
        total: rows.length,
        errors: allErrors,
      },
    });
  } catch (error) {
    console.error('[Bulk Guest Import] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
