import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// GET /api/wifi/nas - List all NAS clients from PostgreSQL, filtered by property
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let query = `
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress", type,
             secret, "coaEnabled", "coaPort", "authPort", "acctPort", status,
             "createdAt", "updatedAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
    `;
    const params: unknown[] = [context.tenantId];

    // Fix #3: Filter by propertyId when provided (multi-property support)
    if (propertyId) {
      query += ` AND "propertyId" = $2::uuid`;
      params.push(propertyId);
    }

    query += ` ORDER BY "createdAt" DESC`;

    const nasList = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(query, ...params);

    const data = nasList.map((n) => ({
      id: String(n.id),
      name: n.name,
      ipAddress: n.ipAddress,
      sharedSecret: n.secret,
      shortname: n.shortname,
      type: n.type,
      ports: { auth: Number(n.authPort) || 1812, acct: Number(n.acctPort) || 1813, coa: Number(n.coaPort) || 3799 },
      coaEnabled: n.coaEnabled ?? true,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      authPort: Number(n.authPort) || 1812,
      acctPort: Number(n.acctPort) || 1813,
      coaPort: Number(n.coaPort) || 3799,
      secret: n.secret,
      status: n.status || 'active',
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching NAS clients:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch NAS clients' }, { status: 500 });
  }
}

// POST /api/wifi/nas - Create NAS in both RadiusNAS (Prisma) and nas (FR native)
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { propertyId, name, shortname, ipAddress, type, secret, sharedSecret, coaEnabled, coaPort, authPort, acctPort, description } = body;
    if (!name || !ipAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, ipAddress' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const nasSecret = sharedSecret || secret || 'changeme';
    const now = new Date().toISOString();

    // Insert into Prisma RadiusNAS
    await db.$executeRawUnsafe(`
      INSERT INTO "RadiusNAS" (id, "tenantId", "propertyId", name, shortname, "ipAddress", type, secret, "coaEnabled", "coaPort", "authPort", "acctPort", status, "createdAt", "updatedAt")
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13::timestamptz, $14::timestamptz)
    `, id, context.tenantId, propertyId || null, name, shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32), ipAddress, type || 'other', nasSecret,
       coaEnabled !== false, coaPort || 3799, authPort || 1812, acctPort || 1813, now, now);

    // Also insert into native FreeRADIUS nas table
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
        VALUES ($1, $2, $3, 3779, $4, NULL, NULL, $5)
      `, ipAddress, shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32), type || 'other', nasSecret, description || name);
    } catch (nasErr) {
      console.warn('[NAS] Native nas table insert warning:', nasErr);
    }

    return NextResponse.json({ success: true, data: { id, name, ipAddress, type, secret: nasSecret, coaEnabled: coaEnabled !== false, authPort: authPort || 1812, acctPort: acctPort || 1813, coaPort: coaPort || 3799, status: 'active' } });
  } catch (error) {
    console.error('Error creating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to create NAS client', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT /api/wifi/nas - Update NAS in both RadiusNAS and native nas table
export async function PUT(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { id, name, shortname, ipAddress, type, secret, sharedSecret, coaEnabled, coaPort, authPort, acctPort } = body;
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Fix #4: Fetch current NAS to get the old IP for native nas table update
    const currentNas = await db.$queryRawUnsafe<Array<{ ipAddress: string }>>(
      `SELECT "ipAddress" FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`,
      id, context.tenantId
    );
    if (!currentNas || currentNas.length === 0) {
      return NextResponse.json({ success: false, error: 'NAS client not found' }, { status: 404 });
    }
    const oldIpAddress = currentNas[0].ipAddress;

    const updates: string[] = [];
    const params: unknown[] = [];
    if (name) { updates.push(`name = $${params.length + 1}`); params.push(name); }
    if (shortname) { updates.push(`shortname = $${params.length + 1}`); params.push(shortname); }
    if (ipAddress) { updates.push(`"ipAddress" = $${params.length + 1}`); params.push(ipAddress); }
    if (type) { updates.push(`type = $${params.length + 1}`); params.push(type); }
    if (secret || sharedSecret) { updates.push(`secret = $${params.length + 1}`); params.push(sharedSecret || secret); }
    if (coaEnabled !== undefined) { updates.push(`"coaEnabled" = $${params.length + 1}`); params.push(coaEnabled); }
    if (coaPort) { updates.push(`"coaPort" = $${params.length + 1}`); params.push(Number(coaPort)); }
    if (authPort) { updates.push(`"authPort" = $${params.length + 1}`); params.push(Number(authPort)); }
    if (acctPort) { updates.push(`"acctPort" = $${params.length + 1}`); params.push(Number(acctPort)); }

    if (updates.length > 0) {
      params.push(id);
      await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET ${updates.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}::uuid AND "tenantId" = $${params.length + 1}::uuid`, ...params, context.tenantId);
    }

    // Fix #4: Sync native FreeRADIUS nas table
    try {
      await db.$executeRawUnsafe(`
        UPDATE nas
        SET nasname = $1, shortname = $2, type = $3, secret = $4
        WHERE nasname = $5
      `,
        ipAddress || oldIpAddress,
        shortname || name?.replace(/\s+/g, '_').toLowerCase().slice(0, 32),
        type || 'other',
        sharedSecret || secret || 'changeme',
        oldIpAddress
      );
    } catch (nasErr) {
      console.warn('[NAS] Native nas table update warning:', nasErr);
    }

    return NextResponse.json({ success: true, message: 'NAS updated' });
  } catch (error) {
    console.error('Error updating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to update NAS client' }, { status: 500 });
  }
}

// DELETE /api/wifi/nas - Delete NAS from both RadiusNAS and native nas table
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Fix #4: Fetch IP before deleting so we can clean up native nas table
    const nasRecord = await db.$queryRawUnsafe<Array<{ ipAddress: string }>>(
      `SELECT "ipAddress" FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`,
      id, context.tenantId
    );

    // Delete from Prisma RadiusNAS
    await db.$executeRawUnsafe(`DELETE FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, context.tenantId);

    // Fix #4: Also delete from native FreeRADIUS nas table
    if (nasRecord && nasRecord.length > 0) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM nas WHERE nasname = $1`, nasRecord[0].ipAddress);
      } catch (nasErr) {
        console.warn('[NAS] Native nas table delete warning:', nasErr);
      }
    }

    return NextResponse.json({ success: true, message: 'NAS deleted' });
  } catch (error) {
    console.error('Error deleting NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete NAS client' }, { status: 500 });
  }
}
