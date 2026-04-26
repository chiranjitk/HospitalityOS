import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// GET /api/wifi/nas - List all NAS clients from PostgreSQL
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const nasList = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress", type,
             secret, "coaEnabled", "coaPort", "authPort", "acctPort", status,
             "createdAt", "updatedAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
      ORDER BY "createdAt" DESC
    `, context.tenantId);

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

// PUT /api/wifi/nas - Update NAS
export async function PUT(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { id, name, shortname, ipAddress, type, secret, sharedSecret, coaEnabled, coaPort, authPort, acctPort } = body;
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

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

    return NextResponse.json({ success: true, message: 'NAS updated' });
  } catch (error) {
    console.error('Error updating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to update NAS client' }, { status: 500 });
  }
}

// DELETE /api/wifi/nas - Delete NAS
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Delete from Prisma RadiusNAS
    await db.$executeRawUnsafe(`DELETE FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, context.tenantId);

    return NextResponse.json({ success: true, message: 'NAS deleted' });
  } catch (error) {
    console.error('Error deleting NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete NAS client' }, { status: 500 });
  }
}
