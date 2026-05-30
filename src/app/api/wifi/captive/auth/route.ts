import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/wifi/captive/auth
 * Captive Portal WiFi Authentication
 *
 * Accepts three auth methods:
 *  - voucher: { method: "voucher", code: "XXXX", tenantId?: string }
 *  - room:    { method: "room", roomNumber: "101", lastName: "Smith", tenantId?: string }
 *  - ldap:    { method: "ldap", username: "jdoe", password: "secret", propertyId?: string }
 *
 * In production, this would validate against the RADIUS backend,
 * check voucher validity, or verify guest reservation details.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lazy-import ldapjs to avoid issues when the package is not installed. */
async function getLdapjs() {
  let ldapjs: typeof import('ldapjs') | null = null;
  try {
    ldapjs = await import('ldapjs');
  } catch {
    throw new Error('ldapjs package is not installed');
  }
  return ldapjs;
}

/**
 * Perform LDAP authentication: admin bind → user search → user bind.
 * Returns the user DN on success, or throws on failure.
 */
async function authenticateViaLdap(params: {
  serverUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  usernameAttr: string;
  username: string;
  password: string;
  useTls: boolean;
  timeout: number;
  filterGroup?: string | null;
}): Promise<{ userDn: string; userAttributes: Record<string, string | string[]> }> {
  const ldapjs = await getLdapjs();
  let client: InstanceType<typeof ldapjs.Client> | null = null;
  let userClient: InstanceType<typeof ldapjs.Client> | null = null;

  try {
    // Step 1: Create client and bind with service account
    client = ldapjs.createClient({
      url: params.serverUrl,
      connectTimeout: params.timeout * 1000,
      timeout: params.timeout * 1000,
      tlsOptions: params.useTls ? { rejectUnauthorized: false } : undefined,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`LDAP connection timeout after ${params.timeout}s`)),
        params.timeout * 1000,
      );
      client!.on('connectError', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
      client!.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
      client!.on('connect', () => {
        client!.bind(params.bindDn, params.bindPassword, (bindErr) => {
          clearTimeout(timer);
          if (bindErr) reject(new Error(`Service account bind failed: ${bindErr.message}`));
          else resolve();
        });
      });
    });

    // Step 2: Search for the user by usernameAttr
    const safeUsername = params.username.replace(/[()\\*]/g, (c) => `\\${c}`);
    const filter = params.filterGroup
      ? `(&(${params.usernameAttr}=${safeUsername})(memberOf=${params.filterGroup}))`
      : `(${params.usernameAttr}=${safeUsername})`;

    const searchEntries: InstanceType<typeof ldapjs.SearchEntry>[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`LDAP search timeout after ${params.timeout}s`)),
        params.timeout * 1000,
      );
      client!.search(
        params.baseDn,
        { filter, scope: 'sub', attributes: ['dn', params.usernameAttr, 'cn', 'mail', 'memberOf'], sizeLimit: 1 },
        (err, res) => {
          if (err) { clearTimeout(timer); reject(new Error(`LDAP search failed: ${err.message}`)); return; }
          res.on('searchEntry', (entry) => searchEntries.push(entry));
          res.on('error', (searchErr) => { clearTimeout(timer); reject(new Error(`LDAP search error: ${searchErr.message}`)); });
          res.on('end', () => { clearTimeout(timer); resolve(); });
        },
      );
    });

    if (searchEntries.length === 0) {
      throw new Error('User not found in LDAP directory');
    }

    const userDn = searchEntries[0].dn.toString();

    // Parse user attributes
    const userAttributes: Record<string, string | string[]> = {};
    for (const attr of searchEntries[0].attributes) {
      const vals = attr.vals as Buffer[];
      if (vals.length === 1) {
        userAttributes[attr.type] = vals[0].toString('utf8');
      } else if (vals.length > 1) {
        userAttributes[attr.type] = vals.map((v) => v.toString('utf8'));
      }
    }

    // Step 3: Disconnect service account client
    try { await new Promise<void>((r) => client!.unbind(() => r())); } catch { /* ignore */ }
    try { client!.destroy(); } catch { /* ignore */ }
    client = null;

    // Step 4: Bind as the user with their password to verify credentials
    userClient = ldapjs.createClient({
      url: params.serverUrl,
      connectTimeout: params.timeout * 1000,
      timeout: params.timeout * 1000,
      tlsOptions: params.useTls ? { rejectUnauthorized: false } : undefined,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`User bind timeout after ${params.timeout}s`)),
        params.timeout * 1000,
      );
      userClient!.bind(userDn, params.password, (bindErr) => {
        clearTimeout(timer);
        if (bindErr) {
          const ldapErr = bindErr as Error & { name?: string };
          if (ldapErr.name === 'InvalidCredentialsError' || bindErr.message.includes('invalid credentials')) {
            reject(new Error('Invalid credentials'));
          } else {
            reject(new Error(`User bind failed: ${bindErr.message}`));
          }
        } else {
          resolve();
        }
      });
    });

    // Cleanup user client
    try { await new Promise<void>((r) => userClient!.unbind(() => r())); } catch { /* ignore */ }
    try { userClient!.destroy(); } catch { /* ignore */ }
    userClient = null;

    return { userDn, userAttributes };
  } finally {
    // Best-effort cleanup
    const close = async (c: InstanceType<typeof ldapjs.Client> | null) => {
      if (!c) return;
      try { await new Promise<void>((r) => c.unbind(() => r())); } catch { /* ignore */ }
      try { c.destroy(); } catch { /* ignore */ }
    };
    await close(client);
    await close(userClient);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { method, tenantId } = body

    // Minimum tenant validation: if tenantId is provided, verify it exists
    if (tenantId) {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Invalid tenant' },
          { status: 400 }
        )
      }
    }

    // -----------------------------------------------------------------------
    // method=voucher
    // -----------------------------------------------------------------------
    if (method === 'voucher') {
      const { code } = body
      if (!code || typeof code !== 'string' || code.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Voucher code is required' },
          { status: 400 }
        )
      }

      // In production: validate voucher against database / RADIUS
      // For demo: accept any non-empty code
      return NextResponse.json({
        success: true,
        method: 'voucher',
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        network: 'RoyalStay-Guest',
        bandwidthLimit: '100Mbps',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Voucher validated successfully',
      })
    }

    // -----------------------------------------------------------------------
    // method=room
    // -----------------------------------------------------------------------
    if (method === 'room') {
      const { roomNumber, lastName } = body
      if (!roomNumber || typeof roomNumber !== 'string' || roomNumber.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Room number is required' },
          { status: 400 }
        )
      }
      if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Last name is required' },
          { status: 400 }
        )
      }

      // In production: verify against guest reservation system
      // For demo: accept any room + name combination
      return NextResponse.json({
        success: true,
        method: 'room',
        roomNumber: roomNumber.trim(),
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        network: 'RoyalStay-Guest',
        bandwidthLimit: '100Mbps',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Room authentication successful',
      })
    }

    // -----------------------------------------------------------------------
    // method=ldap — LDAP / Active Directory authentication
    // -----------------------------------------------------------------------
    if (method === 'ldap') {
      const { username, password, propertyId } = body

      // Validate required fields
      if (!username || typeof username !== 'string' || username.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Username is required' },
          { status: 400 },
        )
      }
      if (!password || typeof password !== 'string' || password.length < 1) {
        return NextResponse.json(
          { success: false, error: 'Password is required' },
          { status: 400 },
        )
      }

      // Step 1: Look up LDAP config — by propertyId if provided, otherwise first active config
      let ldapConfig = propertyId
        ? await db.radiusLDAPConfig.findUnique({ where: { propertyId } })
        : await db.radiusLDAPConfig.findFirst({ where: { enabled: true } });

      if (!ldapConfig || !ldapConfig.enabled) {
        // If we got a config by propertyId but it's not enabled, try finding any active one
        if (!ldapConfig?.enabled && !propertyId) {
          return NextResponse.json(
            { success: false, error: 'LDAP authentication is not configured' },
            { status: 400 },
          )
        }
        if (!ldapConfig?.enabled && propertyId) {
          // Try fallback to any active config
          ldapConfig = await db.radiusLDAPConfig.findFirst({ where: { enabled: true } });
        }
        if (!ldapConfig) {
          return NextResponse.json(
            { success: false, error: 'LDAP authentication is not configured' },
            { status: 400 },
          )
        }
      }

      // Step 2: Get tenant/property for creating WiFiUser
      const effectiveTenantId = ldapConfig.tenantId;
      const effectivePropertyId = ldapConfig.propertyId;

      // Step 3: Authenticate against LDAP server
      let ldapResult: { userDn: string; userAttributes: Record<string, string | string[]> };
      try {
        ldapResult = await authenticateViaLdap({
          serverUrl: ldapConfig.serverUrl,
          baseDn: ldapConfig.baseDn,
          bindDn: ldapConfig.bindDn,
          bindPassword: ldapConfig.bindPassword,
          usernameAttr: ldapConfig.usernameAttr || 'sAMAccountName',
          username: username.trim(),
          password,
          useTls: ldapConfig.useTls,
          timeout: ldapConfig.timeout || 30,
          filterGroup: ldapConfig.filterGroup,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'LDAP authentication failed';

        // Log failed auth attempt
        try {
          await db.radiusAuthLog.create({
            data: {
              propertyId: effectivePropertyId,
              username: username.trim(),
              authResult: 'Access-Reject',
              authType: 'PAP',
              replyMessage: errorMessage,
            },
          });
        } catch {
          // Best-effort logging
        }

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 401 },
        )
      }

      // Step 4: Create or update WiFiUser record
      const now = new Date();
      const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      try {
        await db.wiFiUser.upsert({
          where: { username: username.trim() },
          update: {
            status: 'active',
            userType: 'ldap',
            validFrom: now,
            validUntil,
            radiusSynced: true,
            radiusSyncedAt: now,
          },
          create: {
            tenantId: effectiveTenantId,
            propertyId: effectivePropertyId,
            username: username.trim(),
            password: `__ldap__${Date.now()}`, // Placeholder — actual auth is via LDAP
            status: 'active',
            userType: 'ldap',
            validFrom: now,
            validUntil,
            radiusSynced: true,
            radiusSyncedAt: now,
          },
        });
      } catch (dbErr) {
        console.error('[captive-auth:ldap] Failed to create/update WiFiUser:', dbErr);
        // Don't fail auth just because DB write failed — user already authenticated
      }

      // Step 5: Log successful auth
      try {
        await db.radiusAuthLog.create({
          data: {
            propertyId: effectivePropertyId,
            username: username.trim(),
            authResult: 'Access-Accept',
            authType: 'PAP',
            replyMessage: 'LDAP authentication successful',
          },
        });
      } catch {
        // Best-effort logging
      }

      // Step 6: Return success
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return NextResponse.json({
        success: true,
        method: 'ldap',
        sessionId,
        username: username.trim(),
        userDn: ldapResult.userDn,
        network: 'RoyalStay-Guest',
        bandwidthLimit: '100Mbps',
        expiresAt: validUntil.toISOString(),
        message: 'LDAP authentication successful',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid authentication method' },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
