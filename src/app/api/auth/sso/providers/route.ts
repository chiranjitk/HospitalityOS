import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt, isEncrypted } from '@/lib/encryption';

/**
 * GET /api/auth/sso/providers
 *
 * Public endpoint (no auth required) that returns the list of available
 * SSO / identity providers so the login page can render "Sign in with …"
 * buttons.
 *
 * Logic:
 *  1. Check for Google OAuth (env vars or DB Integration record).
 *  2. Query active SSOConnection rows (SAML / OIDC / LDAP).
 *
 * Multi-tenant note:
 *   In a single-tenant deployment (the common case) the first tenant is used.
 *   The caller may pass `?tenantId=` to scope to a specific tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const providers: Array<{
      id: string;
      type: 'google' | 'saml' | 'oidc' | 'ldap';
      name: string;
      loginUrl: string;
      icon?: string;
    }> = [];

    // ── 1. Google OAuth ────────────────────────────────────────────────────
    let googleTenantId = tenantId || '';

    // Try to find a tenant with Google OAuth configured
    if (!googleTenantId) {
      const googleIntegration = await db.integration.findFirst({
        where: { type: 'google_oauth', provider: 'google_oauth' },
        include: { tenant: { select: { id: true, name: true } } },
      });

      if (googleIntegration) {
        googleTenantId = googleIntegration.tenantId;
      }
    }

    const googleClientId =
      process.env.GOOGLE_CLIENT_ID ||
      (googleTenantId ? await getDbGoogleClientId(googleTenantId) : '');

    if (googleClientId) {
      providers.push({
        id: 'google',
        type: 'google',
        name: 'Google',
        loginUrl: `/api/auth/google?action=login&tenantId=${googleTenantId}`,
        icon: 'google',
      });
    }

    // ── 2. SSO Connections (SAML / OIDC / LDAP) ──────────────────────────
    const where: Record<string, unknown> = { status: 'active' };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const connections = await db.sSOConnection.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        tenantId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const conn of connections) {
      if (conn.type === 'saml') {
        providers.push({
          id: conn.id,
          type: 'saml',
          name: conn.name || 'SAML SSO',
          loginUrl: `/api/auth/sso/saml/${conn.id}?tenantId=${conn.tenantId}`,
        });
      } else if (conn.type === 'oidc') {
        providers.push({
          id: conn.id,
          type: 'oidc',
          name: conn.name || 'OpenID Connect',
          loginUrl: `/api/auth/sso/oidc/${conn.id}?tenantId=${conn.tenantId}`,
        });
      } else if (conn.type === 'ldap') {
        // LDAP is form-based, so the "loginUrl" is the API endpoint (POST)
        providers.push({
          id: conn.id,
          type: 'ldap',
          name: conn.name || 'LDAP / Active Directory',
          loginUrl: `/api/auth/sso/ldap/${conn.id}`,
        });
      }
    }

    return NextResponse.json({ success: true, providers });
  } catch (error) {
    console.error('Error fetching SSO providers:', error);
    // Return empty list on error so login page still works
    return NextResponse.json({ success: true, providers: [] });
  }
}

/**
 * Helper: read Google client ID from DB Integration record
 */
async function getDbGoogleClientId(tenantId: string): Promise<string> {
  try {
    const integration = await db.integration.findFirst({
      where: { tenantId, type: 'google_oauth', provider: 'google_oauth' },
    });
    if (!integration) return '';
    const config = JSON.parse(integration.config || '{}') as Record<string, string>;
    const raw = config.clientId || '';
    if (typeof raw === 'string' && isEncrypted(raw)) {
      return decrypt(raw) || '';
    }
    return raw;
  } catch {
    return '';
  }
}
