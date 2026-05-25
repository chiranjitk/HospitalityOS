import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';
import { syncClientsConf } from '@/lib/wifi/nas-sync';

// System NAS constants — Cryptsk Multimode gateway (127.0.0.1 / cryptsk type)
const SYSTEM_NAS_IP = '127.0.0.1';
const SYSTEM_NAS_TYPE = 'cryptsk';

// Valid auth method values for NAS clients
const VALID_AUTH_METHODS = ['pap', 'chap', 'mschapv2', 'eap', 'eap-tls', 'eap-ttls', 'eap-peap', 'eap-md5', 'mac-auth'] as const;
type AuthMethod = (typeof VALID_AUTH_METHODS)[number];

/** Normalize and validate authMethods — returns comma-separated string */
function normalizeAuthMethods(raw: unknown): string {
  if (!raw) return 'pap,chap,mschapv2';
  const list = String(raw).split(',').map(s => s.trim().toLowerCase()).filter(s => (VALID_AUTH_METHODS as readonly string[]).includes(s));
  if (list.length === 0) return 'pap,chap,mschapv2';
  return [...new Set(list)].join(',');
}

/** Convert authMethods string to MikroTik login-by format */
export function authMethodsToMikrotikLoginBy(authMethods: string): string {
  const methods = authMethods.split(',').map(s => s.trim());
  const loginBy: string[] = [];
  if (methods.includes('pap')) loginBy.push('http-pap');
  if (methods.includes('chap')) loginBy.push('http-chap');
  // EAP methods (eap-tls, eap-ttls, eap-peap, eap-md5) are handled at RADIUS level, not in MikroTik login-by
  // But they also need http-chap/http-pap for the initial captive portal redirect
  if (methods.some(m => m.startsWith('eap'))) {
    if (!loginBy.includes('http-chap')) loginBy.push('http-chap');
    if (!loginBy.includes('http-pap')) loginBy.push('http-pap');
  }
  // mac-auth maps to MAC-based auth in MikroTik
  if (methods.includes('mac-auth')) loginBy.push('mac');
  // Default fallback
  if (loginBy.length === 0) loginBy.push('http-chap', 'http-pap');
  return loginBy.join(',');
}

// GET /api/wifi/nas - List NAS clients, always including the system gateway
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const syncNow = request.nextUrl.searchParams.get('sync');

    if (syncNow === '1') {
      const synced = await syncClientsConf();
      return NextResponse.json({ success: synced, message: synced ? 'clients.conf synced with nas table' : 'Failed to sync clients.conf' });
    }

    // Detect MAC address for system NAS
    if (request.nextUrl.searchParams.get('action') === 'detect-mac') {
      try {
        // Find the first non-loopback interface with a MAC
        let mac = '';
        let iface = '';
        try {
          const ipOutput = execSync('ip -o link show', { timeout: 5000 }).toString();
          const lines = ipOutput.split('\n').filter(l => l.trim());
          for (const line of lines) {
            // Skip loopback
            if (line.includes('lo:')) continue;
            const macMatch = line.match(/link\/\S+\s+([0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5})/);
            if (macMatch && macMatch[1] !== '00:00:00:00:00:00') {
              mac = macMatch[1].toLowerCase();
              const ifaceMatch = line.match(/^\d+:\s+(\S+):/);
              iface = ifaceMatch ? ifaceMatch[1] : 'unknown';
              break;
            }
          }
        } catch {
          // Fallback: try /sys/class/net
          try {
            const fs = await import('fs');
            const netDirs = fs.readdirSync('/sys/class/net').filter(d => d !== 'lo');
            for (const dir of netDirs) {
              try {
                const addr = fs.readFileSync(`/sys/class/net/${dir}/address`, 'utf8').trim();
                if (addr && addr !== '00:00:00:00:00:00') {
                  mac = addr.toLowerCase();
                  iface = dir;
                  break;
                }
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        }

        if (mac) {
          return NextResponse.json({ success: true, data: { mac, interface: iface } });
        } else {
          return NextResponse.json({ success: false, error: 'No MAC address found' }, { status: 404 });
        }
      } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to detect MAC address' }, { status: 500 });
      }
    }

    let query = `
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress", type,
             secret, "coaEnabled", "coaPort", "authPort", "acctPort",
             "apiUsername", "apiPassword", "apiPort", "authMethods",
             "requireMessageAuth", "calledStationId", "nasIdentifier", status,
             "createdAt", "updatedAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
    `;
    const params: unknown[] = [context.tenantId];

    if (propertyId) {
      // Only include system NAS if it belongs to the SAME property.
      // Previously, the OR clause matched ALL system NAS rows across properties,
      // causing duplicates when multiple system NAS entries existed.
      query += ` AND ("propertyId" = $2::uuid OR ("ipAddress" = '${SYSTEM_NAS_IP}' AND type = '${SYSTEM_NAS_TYPE}' AND "propertyId" = $2::uuid))`;
      params.push(propertyId);
    }

    query += ` ORDER BY CASE WHEN "ipAddress" = '${SYSTEM_NAS_IP}' AND type = '${SYSTEM_NAS_TYPE}' THEN 0 ELSE 1 END, "createdAt" DESC`;

    const nasList = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(query, ...params);

    // Deduplicate system NAS entries — in case multiple rows exist with same IP/type
    // across different properties, only keep the first one (sorted by createdAt DESC)
    const seen = new Set<string>();
    const deduped = nasList.filter((n) => {
      const key = `${n.ipAddress}_${n.type}`;
      if (n.ipAddress === SYSTEM_NAS_IP && n.type === SYSTEM_NAS_TYPE) {
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });

    const data = deduped.map((n) => ({
      id: String(n.id),
      name: n.name,
      ipAddress: n.ipAddress,
      sharedSecret: n.secret,
      shortname: n.shortname,
      type: n.type,
      ports: { auth: Number(n.authPort) || 1812, acct: Number(n.acctPort) || 1813, coa: Number(n.coaPort) || 3799 },
      coaEnabled: n.coaEnabled ?? true,
      authPort: Number(n.authPort) || 1812,
      acctPort: Number(n.acctPort) || 1813,
      coaPort: Number(n.coaPort) || 3799,
      secret: n.secret,
      apiUsername: n.apiUsername || null,
      apiPassword: n.apiPassword || null,
      apiPort: Number(n.apiPort) || 443,
      authMethods: n.authMethods || 'pap,chap,mschapv2',
      requireMessageAuth: n.requireMessageAuth ?? false,
      calledStationId: n.calledStationId || null,
      nasIdentifier: n.nasIdentifier || null,
      status: n.status || 'active',
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
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
    const {
      propertyId, name, shortname, ipAddress, type, secret, sharedSecret,
      coaEnabled, coaPort, authPort, acctPort, description,
      apiUsername, apiPassword, apiPort,
      authMethods: rawAuthMethods, requireMessageAuth,
      calledStationId, nasIdentifier,
    } = body;

    if (!name || !ipAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, ipAddress' }, { status: 400 });
    }

    // Prevent creating duplicate system NAS entries (Cryptsk Gateway is a singleton per tenant)
    if (ipAddress === SYSTEM_NAS_IP && (type === SYSTEM_NAS_TYPE || type === 'cryptsk')) {
      const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "RadiusNAS" WHERE "ipAddress" = $1 AND type = $2 AND "tenantId" = $3::uuid LIMIT 1`,
        SYSTEM_NAS_IP, SYSTEM_NAS_TYPE, context.tenantId
      );
      if (existing && existing.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'A Cryptsk Gateway (Multimode) system NAS already exists for this tenant. Cannot create a duplicate.',
        }, { status: 409 });
      }
    }

    const id = crypto.randomUUID();
    const nasSecret = sharedSecret || secret || 'changeme';
    const authMethods = normalizeAuthMethods(rawAuthMethods);
    const now = new Date().toISOString();

    // Insert into Prisma RadiusNAS (with authMethods, calledStationId, nasIdentifier)
    await db.$executeRawUnsafe(`
      INSERT INTO "RadiusNAS" (id, "tenantId", "propertyId", name, shortname, "ipAddress", type, secret,
        "coaEnabled", "coaPort", "authPort", "acctPort",
        "apiUsername", "apiPassword", "apiPort",
        "authMethods", "requireMessageAuth",
        "calledStationId", "nasIdentifier",
        status, "createdAt", "updatedAt")
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17,
        $18, $19,
        'active', $20::timestamptz, $21::timestamptz)
    `, id, context.tenantId, propertyId || null,
      name, shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32),
      ipAddress, type || 'other', nasSecret,
      coaEnabled !== false, coaPort || 3799, authPort || 1812, acctPort || 1813,
      apiUsername || null, apiPassword || null, apiPort || 443,
      authMethods, requireMessageAuth === true,
      calledStationId || null, nasIdentifier || null,
      now, now);

    // Insert into native FreeRADIUS nas table
    const frShortname = shortname || name.replace(/\s+/g, '_').toLowerCase().slice(0, 32);
    await db.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
    `, ipAddress, frShortname, type || 'other', coaPort || 3799, nasSecret, description || name);

    // Sync clients.conf
    await syncClientsConf();

    // Restart FreeRADIUS to apply changes
    try {
      execSync('pm2 restart staysuite-freeradius', { timeout: 15000 });
    } catch (restartErr) {
      console.error('[NAS Create] FreeRADIUS restart failed:', restartErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id, name, ipAddress, type, secret: nasSecret,
        coaEnabled: coaEnabled !== false,
        authPort: authPort || 1812, acctPort: acctPort || 1813, coaPort: coaPort || 3799,
        apiUsername: apiUsername || null, apiPassword: apiPassword || null, apiPort: apiPort || 443,
        authMethods, requireMessageAuth: requireMessageAuth === true,
        calledStationId: calledStationId || null, nasIdentifier: nasIdentifier || null,
        status: 'active',
      },
    });
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
    const {
      id, name, shortname, ipAddress, type, secret, sharedSecret,
      coaEnabled, coaPort, authPort, acctPort,
      apiUsername, apiPassword, apiPort,
      authMethods: rawAuthMethods, requireMessageAuth,
      calledStationId, nasIdentifier,
    } = body;

    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    // Fetch current NAS
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
    // Auth methods — always update (normalize before storing)
    if (rawAuthMethods !== undefined) {
      const authMethods = normalizeAuthMethods(rawAuthMethods);
      updates.push(`"authMethods" = $${params.length + 1}`);
      params.push(authMethods);
    }
    if (requireMessageAuth !== undefined) {
      updates.push(`"requireMessageAuth" = $${params.length + 1}`);
      params.push(requireMessageAuth);
    }
    if (calledStationId !== undefined) {
      updates.push(`"calledStationId" = $${params.length + 1}`);
      params.push(calledStationId || null);
    }
    if (nasIdentifier !== undefined) {
      updates.push(`"nasIdentifier" = $${params.length + 1}`);
      params.push(nasIdentifier || null);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.$executeRawUnsafe(
        `UPDATE "RadiusNAS" SET ${updates.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}::uuid AND "tenantId" = $${params.length + 1}::uuid`,
        ...params, context.tenantId
      );
    }

    // System NAS protection — force back immutable fields even if the UI sent changes
    if (isSystemNas) {
      if (ipAddress && ipAddress !== '127.0.0.1') {
        await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET "ipAddress" = '127.0.0.1' WHERE id = $1::uuid`, id);
      }
      if (type && type !== 'cryptsk') {
        await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET type = 'cryptsk' WHERE id = $1::uuid`, id);
      }
      // Revert secret if someone tried to change it on system NAS
      const currentSecret = await db.$queryRawUnsafe<Array<{ secret: string }>>(
        `SELECT secret FROM "RadiusNAS" WHERE id = $1::uuid`, id
      );
      if (currentSecret?.[0]?.secret && (secret || sharedSecret) && (sharedSecret || secret) !== currentSecret[0].secret) {
        await db.$executeRawUnsafe(`UPDATE "RadiusNAS" SET secret = $1 WHERE id = $2::uuid`, currentSecret[0].secret, id);
      }
    }

    // Sync native FreeRADIUS nas table (including ports = coaPort)
    // nas table has NOT NULL constraints on nasname, shortname, secret — always include them
    const finalIp = ipAddress || oldIpAddress;
    const finalShortname = shortname || name?.replace(/\s+/g, '_').toLowerCase().slice(0, 32) || 'nas';
    const finalType = type || 'other';
    const finalSecret = sharedSecret || secret || 'changeme';
    const finalCoaPort = coaPort || 3799;
    const finalDescription = name || finalShortname;
    await db.$executeRawUnsafe(`
      UPDATE nas
      SET nasname = $1, shortname = $2, type = $3, secret = $4, ports = $5, description = $6
      WHERE nasname = $7
    `, finalIp, finalShortname, finalType, finalSecret, finalCoaPort, finalDescription, oldIpAddress);

    await syncClientsConf();

    // Restart FreeRADIUS to apply changes
    try {
      execSync('pm2 restart staysuite-freeradius', { timeout: 15000 });
    } catch (restartErr) {
      console.error('[NAS Update] FreeRADIUS restart failed:', restartErr);
    }

    return NextResponse.json({ success: true, message: 'NAS updated' });
  } catch (error) {
    console.error('Error updating NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to update NAS client' }, { status: 500 });
  }
}

// DELETE /api/wifi/nas
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'NAS id is required' }, { status: 400 });

    const nasRecord = await db.$queryRawUnsafe<Array<{ ipAddress: string; type: string }>>(
      `SELECT "ipAddress", type FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`,
      id, context.tenantId
    );

    if (!nasRecord || nasRecord.length === 0) {
      return NextResponse.json({ success: false, error: 'NAS client not found' }, { status: 404 });
    }

    if (nasRecord[0].ipAddress === SYSTEM_NAS_IP && nasRecord[0].type === SYSTEM_NAS_TYPE) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete the Cryptsk Gateway (Multimode) system NAS. This is required for multimode operation.',
      }, { status: 403 });
    }

    await db.$executeRawUnsafe(`DELETE FROM "RadiusNAS" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, context.tenantId);
    await db.$executeRawUnsafe(`DELETE FROM nas WHERE nasname = $1`, nasRecord[0].ipAddress);
    await syncClientsConf();

    return NextResponse.json({ success: true, message: 'NAS deleted' });
  } catch (error) {
    console.error('Error deleting NAS client:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete NAS client' }, { status: 500 });
  }
}
