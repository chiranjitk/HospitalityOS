import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';
import { syncClientsConf } from '@/lib/wifi/nas-sync';

// System NAS constants — Cryptsk Multimode gateway (127.0.0.1 / cryptsk type)
// This entry represents the physical Cryptsk machine acting as gateway + RADIUS.
// It is NOT tied to a specific property — one machine = one gateway = one deployment.
// It must ALWAYS be visible regardless of property filter.
const SYSTEM_NAS_IP = '127.0.0.1';
const SYSTEM_NAS_TYPE = 'cryptsk';

// GET /api/wifi/nas - List NAS clients, always including the system gateway
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const syncNow = request.nextUrl.searchParams.get('sync');

    // If ?sync=1, rebuild clients.conf from nas table (for immediate fix)
    if (syncNow === '1') {
      const synced = await syncClientsConf();
      return NextResponse.json({ success: synced, message: synced ? 'clients.conf synced with nas table' : 'Failed to sync clients.conf' });
    }

    // Base: always within the tenant
    // When propertyId is given, show property NAS + system NAS (gateway machine)
    // When no propertyId, show all tenant NAS (system entry is naturally included)
    let query = `
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress", type,
             secret, "coaEnabled", "coaPort", "authPort", "acctPort",
             "apiUsername", "apiPassword", "apiPort", status,
             "createdAt", "updatedAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
    `;
    const params: unknown[] = [context.tenantId];

    if (propertyId) {
      // Show NAS for this property AND always include the system gateway entry
      // The system NAS (127.0.0.1 / cryptsk) is the physical machine itself —
      // it's not property-specific, it's the deployment instance.
      query += ` AND ("propertyId" = $2::uuid OR ("ipAddress" = '${SYSTEM_NAS_IP}' AND type = '${SYSTEM_NAS_TYPE}'))`;
      params.push(propertyId);
    }

    // System NAS always first, then by createdAt DESC
    query += ` ORDER BY CASE WHEN "ipAddress" = '${SYSTEM_NAS_IP}' AND type = '${SYSTEM_NAS_TYPE}' THEN 0 ELSE 1 END, "createdAt" DESC`;

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
      apiUsername: n.apiUsername || null,
      apiPassword: n.apiPassword || null,
      apiPort: Number(n.apiPort) || 443,
      status: n.status || 'active',
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching NAS clients:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch NAS clients' }, { status: 500 });
  }
}

// POST /api/wifi/nas - Create NAS in RadiusNAS (Prisma), nas (FR native), AND clients.conf
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { propertyId, name, shortname, ipAddress, type, secret, sharedSecret, coaEnabled, coaPort, authPort, acctPort, description, apiUsername, apiPassword, apiPort } = body;
    if (!name || !ipAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, ipAddress' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const nasSecret = sharedSecret || secret || 'changeme';
    const now = new Date().toISOString();

    // Insert into Prisma RadiusNAS
    await db.$executeRawUnsafe(`
      INSERT INTO "RadiusNAS" (id, "tenantId", "propertyId", name, shortname, "ipAddress", type, secret, "coaEnabled", "coaPort", "authPort", "acctPort", "apiUsername", "apiPassword", "apiPort", status, "createdAt", "updatedAt")
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', $16::timestamptz, $17::timestamptz)
    `, id, context.tenantId, propertyId || null, name, shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32), ipAddress, type || 'other', nasSecret,
       coaEnabled !== false, coaPort || 3799, authPort || 1812, acctPort || 1813,
       apiUsername || null, apiPassword || null, apiPort || 443,
       now, now);

    // Also insert into native FreeRADIUS nas table (ports = coaPort for RADIUS disconnect)
    const shortname = shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32);
    await db.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
    `, ipAddress, shortname, type || 'other', coaPort || 3799, nasSecret, description || name);

    // Sync clients.conf — FreeRADIUS needs this to accept packets from the new NAS
    await syncClientsConf();

    return NextResponse.json({ success: true, data: { id, name, ipAddress, type, secret: nasSecret, coaEnabled: coaEnabled !== false, authPort: authPort || 1812, acctPort: acctPort || 1813, coaPort: coaPort || 3799, apiUsername: apiUsername || null, apiPassword: apiPassword || null, apiPort: apiPort || 443, status: 'active' } });
  } catch (error) {
    console.error('Error creating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to create NAS client', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT /api/wifi/nas - Update NAS in RadiusNAS, native nas table, AND clients.conf
export async function PUT(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { id, name, shortname, ipAddress, type, secret, sharedSecret, coaEnabled, coaPort, authPort, acctPort, apiUsername, apiPassword, apiPort } = body;
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Fetch current NAS to get the old IP and check if it's the system entry
    const currentNas = await db.$queryRawUnsafe<Array<{ ipAddress: string; type: string }>>(
      `SELECT "ipAddress", type FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`,
      id, context.tenantId
    );
    if (!currentNas || currentNas.length === 0) {
      return NextResponse.json({ success: false, error: 'NAS client not found' }, { status: 404 });
    }
    const oldIpAddress = currentNas[0].ipAddress;
    const isSystemNas = currentNas[0].type === 'cryptsk' && oldIpAddress === '127.0.0.1';

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
    if (apiUsername !== undefined) { updates.push(`"apiUsername" = $${params.length + 1}`); params.push(apiUsername || null); }
    if (apiPassword !== undefined) { updates.push(`"apiPassword" = $${params.length + 1}`); params.push(apiPassword || null); }
    if (apiPort) { updates.push(`"apiPort" = $${params.length + 1}`); params.push(Number(apiPort)); }

    if (updates.length > 0) {
      params.push(id);
      await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET ${updates.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}::uuid AND "tenantId" = $${params.length + 1}::uuid`, ...params, context.tenantId);
    }

    // System NAS protection: if user tried to change IP or type on the system entry, revert
    if (isSystemNas) {
      if (ipAddress && ipAddress !== '127.0.0.1') {
        await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET "ipAddress" = '127.0.0.1' WHERE id = $1::uuid`, id);
      }
      if (type && type !== 'cryptsk') {
        await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET type = 'cryptsk' WHERE id = $1::uuid`, id);
      }
    }

    // Sync native FreeRADIUS nas table (including ports = coaPort)
    await db.$executeRawUnsafe(`
      UPDATE nas
      SET nasname = $1, shortname = $2, type = $3, secret = $4, ports = $5
      WHERE nasname = $6
    `, ipAddress || oldIpAddress,
      shortname || name?.replace(/\s+/g, '_').toLowerCase().slice(0, 32),
      type || 'other',
      sharedSecret || secret || 'changeme',
      coaPort || 3799,
      oldIpAddress
    );

    // Sync clients.conf — FreeRADIUS needs this to accept packets from the updated NAS
    await syncClientsConf();

    return NextResponse.json({ success: true, message: 'NAS updated' });
  } catch (error) {
    console.error('Error updating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to update NAS client' }, { status: 500 });
  }
}

// DELETE /api/wifi/nas - Delete NAS from RadiusNAS, native nas table, AND clients.conf
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Fetch the NAS record to check if it's the system entry
    const nasRecord = await db.$queryRawUnsafe<Array<{ ipAddress: string; type: string }>>(
      `SELECT "ipAddress", type FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`,
      id, context.tenantId
    );

    if (!nasRecord || nasRecord.length === 0) {
      return NextResponse.json({ success: false, error: 'NAS client not found' }, { status: 404 });
    }

    // Protect the system Cryptsk Multimode NAS from deletion
    if (nasRecord[0].ipAddress === SYSTEM_NAS_IP && nasRecord[0].type === SYSTEM_NAS_TYPE) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete the Cryptsk Gateway (Multimode) system NAS. This is required for multimode operation.',
      }, { status: 403 });
    }

    // Delete from Prisma RadiusNAS
    await db.$executeRawUnsafe(`DELETE FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, context.tenantId);

    // Also delete from native FreeRADIUS nas table
    await db.$executeRawUnsafe(`DELETE FROM nas WHERE nasname = $1`, nasRecord[0].ipAddress);

    // Sync clients.conf — remove the deleted NAS from FreeRADIUS client whitelist
    await syncClientsConf();

    return NextResponse.json({ success: true, message: 'NAS deleted' });
  } catch (error) {
    console.error('Error deleting NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete NAS client' }, { status: 500 });
  }
}
