/**
 * RADIUS LDAP Configuration API Route
 *
 * Manages RadiusLDAPConfig for FreeRADIUS LDAP/Active Directory authentication.
 * Provides CRUD, test connection, toggle, search users, sync groups, and diagnostics.
 *
 * When enabled, this module configures FreeRADIUS to forward authentication
 * requests to an external LDAP/AD server via the `rlm_ldap` module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { logAudit } from '@/lib/audit';

// FreeRADIUS mini-service port
const FREERADIUS_SERVICE_PORT = 3010;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lazy-import ldapjs to avoid issues when the package is not installed. */
async function getLdapjs() {
  let ldapjs: typeof import('ldapjs') | null = null;
  try {
    ldapjs = await import('ldapjs');
  } catch {
    throw new Error('ldapjs package is not installed. Run: bun add ldapjs');
  }
  return ldapjs;
}

/** Build an LDAPConfig-like object from a RadiusLDAPConfig row. */
function toLDAPConfig(cfg: {
  serverUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  searchFilter: string;
  useTls: boolean;
  useStartTls: boolean;
  timeout: number;
}) {
  return {
    url: cfg.serverUrl,
    baseDn: cfg.baseDn,
    bindDn: cfg.bindDn,
    bindPassword: cfg.bindPassword,
    searchFilter: cfg.searchFilter || '(sAMAccountName=%{User-Name})',
    useStartTls: cfg.useStartTls ?? false,
    useSsl: cfg.useTls ?? true,
    timeout: cfg.timeout || 30,
  };
}

/** Call the freeradius-service to push LDAP config to FreeRADIUS. */
async function applyLdapConfigToFreeRADIUS(config: Record<string, unknown>): Promise<{
  success: boolean;
  results?: string[];
  error?: string;
}> {
  try {
    const url = `/api/service/apply-ldap-config?XTransformPort=${FREERADIUS_SERVICE_PORT}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    if (result.success) {
      console.log('[radius-ldap] FreeRADIUS LDAP config applied:', result.results);
    } else {
      console.error('[radius-ldap] FreeRADIUS LDAP config apply failed:', result.error);
    }
    return result;
  } catch (err) {
    console.error('[radius-ldap] FreeRADIUS service unreachable:', err);
    return { success: false, error: 'FreeRADIUS service unreachable — config saved to DB only' };
  }
}

/**
 * Perform a real LDAP connection test.
 * Connects with bindDn/bindPassword, then does a small search under baseDn
 * using the configured searchFilter to verify search works.
 * Returns latency, connection status, and whether at least 1 user was found.
 */
async function testLdapConnection(cfg: {
  serverUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  searchFilter: string;
  useTls: boolean;
  useStartTls: boolean;
  timeout: number;
}): Promise<{
  connected: boolean;
  latencyMs: number;
  userCount: number;
  error?: string;
}> {
  const ldapjs = await getLdapjs();
  let client: InstanceType<typeof ldapjs.Client> | null = null;

  const startMs = Date.now();
  const defaultResult = {
    connected: false,
    latencyMs: Date.now() - startMs,
    userCount: 0,
    error: undefined as string | undefined,
  };

  try {
    client = ldapjs.createClient({
      url: cfg.serverUrl,
      connectTimeout: cfg.timeout * 1000,
      timeout: cfg.timeout * 1000,
      tlsOptions: cfg.useTls ? { rejectUnauthorized: false } : undefined,
    });

    // Step 1: Wait for connection then bind with service account
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Connection timeout after ${cfg.timeout}s`)), cfg.timeout * 1000);

      client!.on('connectError', (err: Error) => { clearTimeout(timer); reject(err); });
      client!.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
      client!.on('connect', () => {
        // Now bind
        client!.bind(cfg.bindDn, cfg.bindPassword, (bindErr) => {
          clearTimeout(timer);
          if (bindErr) reject(new Error(`Bind failed: ${bindErr.message}`));
          else resolve();
        });
      });
    });

    // Step 2: Execute a test search with the configured searchFilter (limit 1)
    // Replace RADIUS attribute macros with a wildcard to verify filter syntax
    const testFilter = cfg.searchFilter
      .replace(/%{User-Name}/g, '*')
      .replace(/%{Stripped-User-Name}/g, '*')
      .replace(/%{User-Password}/g, '*');

    const searchEntries: InstanceType<typeof ldapjs.SearchEntry>[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Search timeout after ${cfg.timeout}s`)), cfg.timeout * 1000);

      client!.search(
        cfg.baseDn,
        { filter: testFilter, scope: 'sub', attributes: ['dn'], sizeLimit: 1 },
        (err, res) => {
          if (err) { clearTimeout(timer); reject(new Error(`Search failed: ${err.message}`)); return; }
          res.on('searchEntry', (entry) => searchEntries.push(entry));
          res.on('error', (err) => { clearTimeout(timer); reject(new Error(`Search error: ${err.message}`)); });
          res.on('end', () => { clearTimeout(timer); resolve(); });
        },
      );
    });

    const latencyMs = Date.now() - startMs;

    // Cleanup
    try { await new Promise<void>((r) => client!.unbind(() => r())); } catch { /* ignore */ }

    return {
      connected: true,
      latencyMs,
      userCount: searchEntries.length,
    };
  } catch (err) {
    // Best-effort cleanup
    if (client) {
      try { await new Promise<void>((r) => client!.unbind(() => r())); } catch { /* ignore */ }
      try { client.destroy(); } catch { /* ignore */ }
    }
    return {
      ...defaultResult,
      latencyMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : 'LDAP connection failed',
    };
  }
}

// ---------------------------------------------------------------------------
// GET — fetch RadiusLDAPConfig for the current property
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(context, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 },
      );
    }

    const config = await db.radiusLDAPConfig.findUnique({
      where: { propertyId },
    });

    if (!config) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching RADIUS LDAP config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RADIUS LDAP config' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — save config / test / toggle / diagnostics / search-users / sync-groups
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { action } = body;

    const propertyId = await resolvePropertyId(context, body.propertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------------
    // action=undefined / no action → Save (upsert) configuration
    // ---------------------------------------------------------------
    if (!action) {
      const {
        serverUrl, baseDn, bindDn, bindPassword, searchFilter,
        useTls, useStartTls, timeout, poolMin, poolMax, networkTimeout,
        ldapBindAuth, mschapAuth, eapTtlsAuth,
        ntlmAuthPath, winbindDomain,
        usernameAttr, groupAttr, filterGroup,
        autoSyncGroups, syncIntervalMin, defaultPlanId, autoAssignPlan,
        enabled,
      } = body;

      // Validate required fields
      if (!serverUrl || !baseDn || !bindDn || !bindPassword) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: serverUrl, baseDn, bindDn, bindPassword' },
          { status: 400 },
        );
      }

      const config = await db.radiusLDAPConfig.upsert({
        where: { propertyId },
        update: {
          serverUrl, baseDn, bindDn, bindPassword, searchFilter,
          useTls, useStartTls, timeout, poolMin, poolMax, networkTimeout,
          ldapBindAuth, mschapAuth, eapTtlsAuth,
          ntlmAuthPath, winbindDomain,
          usernameAttr, groupAttr, filterGroup,
          autoSyncGroups, syncIntervalMin, defaultPlanId, autoAssignPlan,
          enabled,
        },
        create: {
          tenantId: context.tenantId,
          propertyId,
          serverUrl,
          baseDn,
          bindDn,
          bindPassword,
          searchFilter: searchFilter || '(sAMAccountName=%{User-Name})',
          useTls: useTls ?? true,
          useStartTls: useStartTls ?? false,
          timeout: timeout || 30,
          poolMin: poolMin || 5,
          poolMax: poolMax || 20,
          networkTimeout: networkTimeout || 5,
          ldapBindAuth: ldapBindAuth ?? true,
          mschapAuth: mschapAuth ?? false,
          eapTtlsAuth: eapTtlsAuth ?? false,
          ntlmAuthPath: ntlmAuthPath || '/usr/bin/ntlm_auth',
          winbindDomain: winbindDomain || null,
          usernameAttr: usernameAttr || 'sAMAccountName',
          groupAttr: groupAttr || 'memberOf',
          filterGroup: filterGroup || null,
          autoSyncGroups: autoSyncGroups ?? false,
          syncIntervalMin: syncIntervalMin || 60,
          defaultPlanId: defaultPlanId || null,
          autoAssignPlan: autoAssignPlan ?? false,
          enabled: enabled ?? false,
        },
      });

      // If enabled, push config to FreeRADIUS via mini-service
      let applyResult: { success: boolean; results?: string[]; error?: string } | null = null;
      if (config.enabled) {
        applyResult = await applyLdapConfigToFreeRADIUS({
          serverUrl: config.serverUrl,
          baseDn: config.baseDn,
          bindDn: config.bindDn,
          bindPassword: config.bindPassword,
          searchFilter: config.searchFilter,
          useTls: config.useTls,
          useStartTls: config.useStartTls,
          timeout: config.timeout,
          poolMin: config.poolMin,
          poolMax: config.poolMax,
          networkTimeout: config.networkTimeout,
          ldapBindAuth: config.ldapBindAuth,
          mschapAuth: config.mschapAuth,
          eapTtlsAuth: config.eapTtlsAuth,
          ntlmAuthPath: config.ntlmAuthPath,
          winbindDomain: config.winbindDomain,
          usernameAttr: config.usernameAttr,
          groupAttr: config.groupAttr,
          filterGroup: config.filterGroup,
          enabled: config.enabled,
        });

        // Update status tracking
        await db.radiusLDAPConfig.update({
          where: { propertyId },
          data: {
            status: applyResult?.success ? 'active' : 'error',
          },
        });
      }

      // Audit log
      await logAudit(request, 'update', 'nas_client', config.id, {
        action: 'save_ldap_config',
        enabled: config.enabled,
        serverUrl: config.serverUrl,
      }, { tenantId: context.tenantId, userId: context.userId });

      return NextResponse.json({
        success: true,
        data: config,
        message: applyResult?.success
          ? 'LDAP configuration saved and applied to FreeRADIUS'
          : config.enabled
            ? 'Configuration saved to DB but failed to apply to FreeRADIUS.'
            : 'LDAP configuration saved (module disabled).',
        applied: applyResult?.success ?? false,
        applyResults: applyResult?.results,
      });
    }

    // ---------------------------------------------------------------
    // action=test → Test LDAP connection
    // ---------------------------------------------------------------
    if (action === 'test') {
      const { serverUrl, baseDn, bindDn, bindPassword, searchFilter, useTls, useStartTls, timeout } = body;

      if (!serverUrl || !baseDn || !bindDn || !bindPassword) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: serverUrl, baseDn, bindDn, bindPassword' },
          { status: 400 },
        );
      }

      const result = await testLdapConnection({
        serverUrl, baseDn, bindDn, bindPassword,
        searchFilter: searchFilter || '(sAMAccountName=%{User-Name})',
        useTls: useTls ?? true, useStartTls: useStartTls ?? false,
        timeout: timeout || 30,
      });

      // Update status tracking in DB
      await db.radiusLDAPConfig.upsert({
        where: { propertyId },
        update: {
          lastTestAt: new Date(),
          lastTestOk: result.connected,
          lastTestLatencyMs: result.latencyMs,
          status: result.connected ? 'active' : 'error',
        },
        create: {
          tenantId: context.tenantId,
          propertyId,
          serverUrl, baseDn, bindDn, bindPassword,
          searchFilter: searchFilter || '(sAMAccountName=%{User-Name})',
          useTls: useTls ?? true,
          useStartTls: useStartTls ?? false,
          timeout: timeout || 30,
          lastTestAt: new Date(),
          lastTestOk: result.connected,
          lastTestLatencyMs: result.latencyMs,
          status: result.connected ? 'active' : 'error',
        },
      });

      // Audit log
      await logAudit(request, 'connect', 'nas_client', propertyId, {
        action: 'test_ldap_connection',
        connected: result.connected,
        latencyMs: result.latencyMs,
        userCount: result.userCount,
        error: result.error,
      }, { tenantId: context.tenantId, userId: context.userId });

      return NextResponse.json({
        success: true,
        data: result,
        message: result.connected
          ? `LDAP connection successful (${result.latencyMs}ms, ${result.userCount} user(s) found)`
          : `LDAP connection failed: ${result.error}`,
      });
    }

    // ---------------------------------------------------------------
    // action=toggle → Enable/disable LDAP module
    // ---------------------------------------------------------------
    if (action === 'toggle') {
      const existing = await db.radiusLDAPConfig.findUnique({ where: { propertyId } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'No LDAP configuration found for this property. Save a config first.' },
          { status: 404 },
        );
      }

      const newEnabled = !existing.enabled;
      const updated = await db.radiusLDAPConfig.update({
        where: { propertyId },
        data: {
          enabled: newEnabled,
          status: newEnabled ? 'active' : 'inactive',
        },
      });

      // Push config to FreeRADIUS
      let applyResult: { success: boolean; results?: string[]; error?: string } | null = null;
      applyResult = await applyLdapConfigToFreeRADIUS({
        serverUrl: updated.serverUrl,
        baseDn: updated.baseDn,
        bindDn: updated.bindDn,
        bindPassword: updated.bindPassword,
        searchFilter: updated.searchFilter,
        useTls: updated.useTls,
        useStartTls: updated.useStartTls,
        timeout: updated.timeout,
        poolMin: updated.poolMin,
        poolMax: updated.poolMax,
        networkTimeout: updated.networkTimeout,
        ldapBindAuth: updated.ldapBindAuth,
        mschapAuth: updated.mschapAuth,
        eapTtlsAuth: updated.eapTtlsAuth,
        ntlmAuthPath: updated.ntlmAuthPath,
        winbindDomain: updated.winbindDomain,
        usernameAttr: updated.usernameAttr,
        groupAttr: updated.groupAttr,
        filterGroup: updated.filterGroup,
        enabled: updated.enabled,
      });

      // Audit log
      await logAudit(request, 'update', 'nas_client', updated.id, {
        action: 'toggle_ldap_module',
        enabled: newEnabled,
      }, { tenantId: context.tenantId, userId: context.userId });

      return NextResponse.json({
        success: true,
        data: updated,
        message: newEnabled
          ? 'LDAP module enabled'
          : 'LDAP module disabled',
        applied: applyResult?.success ?? false,
      });
    }

    // ---------------------------------------------------------------
    // action=diagnostics → Full diagnostic check
    // ---------------------------------------------------------------
    if (action === 'diagnostics') {
      const existing = await db.radiusLDAPConfig.findUnique({ where: { propertyId } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'No LDAP configuration found for this property.' },
          { status: 404 },
        );
      }

      // Run both checks in parallel
      const [ldapResult, serviceResult] = await Promise.allSettled([
        testLdapConnection(toLDAPConfig(existing)),
        (async () => {
          try {
            const res = await fetch(`/api/service/ldap-diagnostics?XTransformPort=${FREERADIUS_SERVICE_PORT}`);
            return await res.json();
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'FreeRADIUS service unreachable' };
          }
        })(),
      ]);

      const ldapData = ldapResult.status === 'fulfilled'
        ? ldapResult.value
        : { connected: false, latencyMs: 0, userCount: 0, error: ldapResult.reason?.message || 'LDAP test failed' };

      const serviceData = serviceResult.status === 'fulfilled'
        ? serviceResult.value
        : { success: false, error: 'FreeRADIUS service unreachable' };

      // Update test status in DB
      await db.radiusLDAPConfig.update({
        where: { propertyId },
        data: {
          lastTestAt: new Date(),
          lastTestOk: ldapData.connected,
          lastTestLatencyMs: ldapData.latencyMs,
          status: ldapData.connected ? 'active' : 'error',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ldap: ldapData,
          service: serviceData,
          configSummary: {
            serverUrl: existing.serverUrl,
            baseDn: existing.baseDn,
            bindDn: existing.bindDn,
            enabled: existing.enabled,
            status: existing.status,
            lastTestAt: existing.lastTestAt,
            lastTestOk: existing.lastTestOk,
          },
        },
      });
    }

    // ---------------------------------------------------------------
    // action=search-users → Search AD/LDAP users
    // ---------------------------------------------------------------
    if (action === 'search-users') {
      const { searchTerm, serverUrl, baseDn, bindDn, bindPassword, searchFilter, useTls, useStartTls, timeout } = body;

      // Use existing config if no connection params provided
      let cfg = {
        serverUrl, baseDn, bindDn, bindPassword,
        searchFilter: searchFilter || '(sAMAccountName=%{User-Name})',
        useTls: useTls ?? true, useStartTls: useStartTls ?? false,
        timeout: timeout || 30,
      };

      if (!cfg.serverUrl || !cfg.baseDn || !cfg.bindDn || !cfg.bindPassword) {
        const existing = await db.radiusLDAPConfig.findUnique({ where: { propertyId } });
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'No LDAP configuration found. Provide connection params or save a config first.' },
            { status: 400 },
          );
        }
        cfg = {
          serverUrl: existing.serverUrl,
          baseDn: existing.baseDn,
          bindDn: existing.bindDn,
          bindPassword: existing.bindPassword,
          searchFilter: existing.searchFilter,
          useTls: existing.useTls,
          useStartTls: existing.useStartTls,
          timeout: existing.timeout,
        };
      }

      const ldapjs = await getLdapjs();
      let client: InstanceType<typeof ldapjs.Client> | null = null;
      const users: Array<Record<string, unknown>> = [];

      try {
        client = ldapjs.createClient({
          url: cfg.serverUrl,
          connectTimeout: cfg.timeout * 1000,
          timeout: cfg.timeout * 1000,
          tlsOptions: cfg.useTls ? { rejectUnauthorized: false } : undefined,
        });

        // Bind
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Bind timeout after ${cfg.timeout}s`)), cfg.timeout * 1000);
          client!.bind(cfg.bindDn, cfg.bindPassword, (err) => {
            clearTimeout(timer);
            if (err) reject(new Error(`Bind failed: ${err.message}`));
            else resolve();
          });
        });

        // Build search filter — replace RADIUS macros with the actual search term
        const safeTerm = (searchTerm || '*').replace(/[()\\*]/g, (c) => {
          if (c === '*') return '*';
          return `\\${c}`;
        });

        // If no searchTerm, use a broad filter; otherwise match on common attributes
        const filter = searchTerm
          ? `(|(cn=*${safeTerm}*)(mail=*${safeTerm}*)(sAMAccountName=*${safeTerm}*)(userPrincipalName=*${safeTerm}*)(displayName=*${safeTerm}*))`
          : '(objectClass=user)';

        const searchEntries: InstanceType<typeof ldapjs.SearchEntry>[] = [];
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Search timeout after ${cfg.timeout}s`)), cfg.timeout * 1000);

          client!.search(
            cfg.baseDn,
            {
              filter,
              scope: 'sub',
              attributes: ['dn', 'cn', 'sn', 'givenName', 'displayName', 'mail', 'sAMAccountName', 'userPrincipalName', 'memberOf', 'department', 'title', 'telephoneNumber', 'objectClass'],
              sizeLimit: 50,
            },
            (err, res) => {
              if (err) { clearTimeout(timer); reject(new Error(`Search failed: ${err.message}`)); return; }
              res.on('searchEntry', (entry) => searchEntries.push(entry));
              res.on('error', (err) => { clearTimeout(timer); reject(new Error(`Search error: ${err.message}`)); });
              res.on('end', () => { clearTimeout(timer); resolve(); });
            },
          );
        });

        // Convert entries to user objects
        for (const entry of searchEntries) {
          const attrs: Record<string, string | string[]> = {};
          for (const attr of entry.attributes) {
            const vals = attr.vals as Buffer[];
            if (vals.length === 1) {
              attrs[attr.type] = vals[0].toString('utf8');
            } else if (vals.length > 1) {
              attrs[attr.type] = vals.map((v) => v.toString('utf8'));
            }
          }

          const memberOf = attrs.memberOf;
          users.push({
            dn: entry.dn.toString(),
            cn: attrs.cn || '',
            sn: attrs.sn || null,
            givenName: attrs.givenName || null,
            displayName: attrs.displayName || null,
            mail: attrs.mail || null,
            sAMAccountName: attrs.sAMAccountName || null,
            userPrincipalName: attrs.userPrincipalName || null,
            department: attrs.department || null,
            title: attrs.title || null,
            telephoneNumber: attrs.telephoneNumber || null,
            memberOf: Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : [],
          });
        }

        return NextResponse.json({
          success: true,
          data: {
            users,
            total: users.length,
            searchTerm: searchTerm || null,
          },
        });
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : 'LDAP search failed',
        }, { status: 500 });
      } finally {
        if (client) {
          try { await new Promise<void>((r) => client!.unbind(() => r())); } catch { /* ignore */ }
          try { client.destroy(); } catch { /* ignore */ }
        }
      }
    }

    // ---------------------------------------------------------------
    // action=sync-groups → Sync AD groups to local RADIUS groups
    // ---------------------------------------------------------------
    if (action === 'sync-groups') {
      const existing = await db.radiusLDAPConfig.findUnique({ where: { propertyId } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'No LDAP configuration found. Save a config first.' },
          { status: 404 },
        );
      }

      const ldapjs = await getLdapjs();
      let client: InstanceType<typeof ldapjs.Client> | null = null;
      let groupsFound = 0;
      let groupsSynced = 0;
      const errors: string[] = [];

      try {
        client = ldapjs.createClient({
          url: existing.serverUrl,
          connectTimeout: existing.timeout * 1000,
          timeout: existing.timeout * 1000,
          tlsOptions: existing.useTls ? { rejectUnauthorized: false } : undefined,
        });

        // Bind
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Bind timeout`)), existing.timeout * 1000);
          client!.bind(existing.bindDn, existing.bindPassword, (err) => {
            clearTimeout(timer);
            if (err) reject(new Error(`Bind failed: ${err.message}`));
            else resolve();
          });
        });

        // Search for groups — either filterGroup or all groups
        const groupFilter = existing.filterGroup
          ? `(distinguishedName=${existing.filterGroup})`
          : '(objectClass=group)';

        const groupEntries: InstanceType<typeof ldapjs.SearchEntry>[] = [];
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Group search timeout`)), existing.timeout * 1000);

          client!.search(
            existing.baseDn,
            {
              filter: groupFilter,
              scope: 'sub',
              attributes: ['dn', 'cn', 'description', 'member'],
              sizeLimit: 200,
            },
            (err, res) => {
              if (err) { clearTimeout(timer); reject(new Error(`Group search failed: ${err.message}`)); return; }
              res.on('searchEntry', (entry) => groupEntries.push(entry));
              res.on('error', (err) => { clearTimeout(timer); reject(new Error(`Group search error: ${err.message}`)); });
              res.on('end', () => { clearTimeout(timer); resolve(); });
            },
          );
        });

        groupsFound = groupEntries.length;

        // For each group, create radgroupcheck/radgroupreply entries
        for (const group of groupEntries) {
          try {
            const attrs: Record<string, string | string[]> = {};
            for (const attr of group.attributes) {
              const vals = attr.vals as Buffer[];
              if (vals.length === 1) {
                attrs[attr.type] = vals[0].toString('utf8');
              } else if (vals.length > 1) {
                attrs[attr.type] = vals.map((v) => v.toString('utf8'));
              }
            }

            const groupName = attrs.cn as string;
            if (!groupName) continue;

            const memberCount = Array.isArray(attrs.member) ? attrs.member.length : (attrs.member ? 1 : 0);

            // Create radgroupcheck for LDAP-Group attribute
            try {
              await db.$executeRawUnsafe(`
                INSERT INTO radgroupcheck (groupname, attribute, op, value)
                VALUES ($1, 'LDAP-Group', '=', $2)
                ON CONFLICT DO NOTHING
              `, groupName, group.dn.toString());
            } catch (e) {
              errors.push(`radgroupcheck for ${groupName}: ${e instanceof Error ? e.message : 'Unknown'}`);
            }

            // If autoAssignPlan is on and defaultPlanId exists, assign a plan
            if (existing.autoAssignPlan && existing.defaultPlanId) {
              const plan = await db.wiFiPlan.findUnique({ where: { id: existing.defaultPlanId } });
              if (plan) {
                try {
                  await db.$executeRawUnsafe(`
                    INSERT INTO radgroupreply (groupname, attribute, op, value)
                    VALUES ($1, 'Session-Timeout', '=', $2)
                    ON CONFLICT DO NOTHING
                  `, groupName, String(plan.sessionTimeout || 86400));

                  // Also assign bandwidth if available
                  if (plan.bandwidthDown) {
                    await db.$executeRawUnsafe(`
                      INSERT INTO radgroupreply (groupname, attribute, op, value)
                      VALUES ($1, 'WISPr-Bandwidth-Max-Down', '=', $2)
                      ON CONFLICT DO NOTHING
                    `, groupName, String(plan.bandwidthDown));
                  }
                  if (plan.bandwidthUp) {
                    await db.$executeRawUnsafe(`
                      INSERT INTO radgroupreply (groupname, attribute, op, value)
                      VALUES ($1, 'WISPr-Bandwidth-Max-Up', '=', $2)
                      ON CONFLICT DO NOTHING
                    `, groupName, String(plan.bandwidthUp));
                  }
                } catch (e) {
                  errors.push(`radgroupreply for ${groupName}: ${e instanceof Error ? e.message : 'Unknown'}`);
                }
              }
            }

            groupsSynced++;
          } catch (e) {
            errors.push(`Group ${group.dn}: ${e instanceof Error ? e.message : 'Unknown'}`);
          }
        }

        // Update sync tracking
        await db.radiusLDAPConfig.update({
          where: { propertyId },
          data: {
            lastSyncAt: new Date(),
            usersSynced: (existing.usersSynced || 0) + groupsSynced,
          },
        });

        // Audit log
        await logAudit(request, 'sync', 'nas_client', existing.id, {
          action: 'sync_ldap_groups',
          groupsFound,
          groupsSynced,
          errors: errors.length,
        }, { tenantId: context.tenantId, userId: context.userId });

        return NextResponse.json({
          success: true,
          data: {
            groupsFound,
            groupsSynced,
            errors,
          },
          message: `Synced ${groupsSynced}/${groupsFound} groups from LDAP`,
        });
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : 'Group sync failed',
          data: { groupsFound, groupsSynced, errors },
        }, { status: 500 });
      } finally {
        if (client) {
          try { await new Promise<void>((r) => client!.unbind(() => r())); } catch { /* ignore */ }
          try { client.destroy(); } catch { /* ignore */ }
        }
      }
    }

    // ---------------------------------------------------------------
    // Unknown action
    // ---------------------------------------------------------------
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}. Valid actions: test, toggle, diagnostics, search-users, sync-groups` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error in RADIUS LDAP API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
