import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { RADDB_PATH, RADCLIENT_BIN, RADIUS_DICT_DIR, RADIUS_LIB_DIR } from '@/lib/wifi/paths';
import { db } from '@/lib/db';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * OpenSSL paths for radclient.
 *
 * Sandbox: radclient is compiled from source and linked against a compat OpenSSL
 *   that requires the legacy provider.  Custom OPENSSL_CONF + OPENSSL_MODULES
 *   must point to the sandbox-built libraries.
 *
 * Production (Rocky 10 / RHEL): radclient comes from the RPM and links against
 *   the system OpenSSL 3.x.  Rocky 10 ships the legacy provider at
 *   /usr/lib64/ossl-modules/legacy.so and the system openssl.cnf already enables
 *   it.  We only set OPENSSL_MODULES to the correct RHEL path and let the system
 *   OPENSSL_CONF be used automatically.
 */
const SANDBOX_OPENSSL_CONF = '/home/z/my-project/freeradius-install/openssl-with-legacy.cnf';
const SANDBOX_OPENSSL_MODULES = '/home/z/my-project/openssl-compat/lib64/ossl-modules';
const PRODUCTION_OPENSSL_MODULES = '/usr/lib64/ossl-modules';
const PRODUCTION_OPENSSL_CONF = '/opt/staysuite/config/openssl-with-legacy.cnf';

/** Build OpenSSL env vars for radclient child process. */
function getOpenSSLEnv(): Record<string, string> {
  // 1) Explicit env overrides always win
  const envConf = process.env.OPENSSL_CONF;
  const envModules = process.env.OPENSSL_MODULES;
  if (envConf || envModules) {
    const result: Record<string, string> = {};
    if (envConf) result.OPENSSL_CONF = envConf;
    if (envModules) result.OPENSSL_MODULES = envModules;
    return result;
  }

  if (isProduction) {
    // Production: use /opt/staysuite config if deployed, otherwise system default
    const result: Record<string, string> = {};
    if (existsSync(PRODUCTION_OPENSSL_CONF)) result.OPENSSL_CONF = PRODUCTION_OPENSSL_CONF;
    result.OPENSSL_MODULES = PRODUCTION_OPENSSL_MODULES;
    return result;
  }

  // Sandbox: use custom-built OpenSSL compat paths
  const result: Record<string, string> = {};
  if (existsSync(SANDBOX_OPENSSL_CONF)) result.OPENSSL_CONF = SANDBOX_OPENSSL_CONF;
  if (existsSync(SANDBOX_OPENSSL_MODULES)) result.OPENSSL_MODULES = SANDBOX_OPENSSL_MODULES;
  return result;
}

/**
 * Send a RADIUS Access-Request via radclient to FreeRADIUS on localhost.
 * This runs ALL authorization checks (sql module reads radcheck, checks
 * Simultaneous-Use via fn_check_login_limit, expiration, etc.).
 *
 * This device acts as a NAS gateway, so NAS-IP-Address is always 127.0.0.1.
 *
 * Uses execFileSync instead of execSync to avoid shell pipe dependency
 * on /bin/sh (which may not be resolvable in some sandbox environments).
 *
 * All FreeRADIUS paths (radclient binary, dictionary dir, lib dir) are
 * resolved from @/lib/wifi/paths which auto-detects the install prefix
 * by probing the filesystem (RPM at /usr vs source at /usr/local).
 */
const RADIUS_AUTH_TIMEOUT_MS = 15000; // 15 second total timeout including DB lookup + radclient

/**
 * Wraps a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function radiusAuth(username: string, password: string): Promise<{
  accepted: boolean;
  replyAttrs: Record<string, string>;
  rejectReason?: string;
}> {
  return withTimeout((async () => {
  try {
    const radclientBin = RADCLIENT_BIN;
    const raddbDir = RADDB_PATH;
    // Dictionary and lib dirs come from centralized paths.ts auto-detection
    const dictDir = RADIUS_DICT_DIR;
    const libDir = RADIUS_LIB_DIR;

    // Look up the shared secret for the local system NAS (Cryptsk Gateway)
    const { calledStationId, nasSecret, nasIdentifier } = await getSystemNasConfig();

    // Sanitize username/password to prevent RADIUS attribute injection
    const sanitizeRadius = (val: string) => val.replace(/'/g, '').replace(/,/g, '').replace(/\n/g, '').replace(/\r/g, '');

    const radclientInput = `User-Name = '${sanitizeRadius(username)}', User-Password = '${sanitizeRadius(password)}', NAS-IP-Address = 127.0.0.1, NAS-Port = 0, NAS-Port-Type = Wireless-802.11, Called-Station-Id = '${sanitizeRadius(calledStationId)}', NAS-Identifier = '${sanitizeRadius(nasIdentifier)}'\n`;

    const sslEnv = getOpenSSLEnv();

    const output = execFileSync(radclientBin, ['-D', dictDir, '-x', '127.0.0.1', 'auth', nasSecret, '3'], {
      input: radclientInput,
      encoding: 'utf-8',
      timeout: 5000,
      cwd: raddbDir,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${libDir}:${process.env.LD_LIBRARY_PATH || ''}`,
        ...sslEnv,
      },
    });

    // Parse radclient output — look for "Received Access-Accept" or "Received Access-Reject"
    const accepted = output.includes('Received Access-Accept');
    const rejected = output.includes('Received Access-Reject');

    if (accepted) {
      const replyAttrs: Record<string, string> = {};
      const lines = output.split('\n');
      for (const line of lines) {
        // Match reply attributes after "Received Access-Accept" block
        const match = line.match(/^\s+(\S+)\s*=\s*(.+)$/);
        if (match && match[1] !== 'Message-Authenticator') {
          replyAttrs[match[1]] = match[2].trim().replace(/^"(.*)"$/, '$1');
        }
      }
      return { accepted: true, replyAttrs };
    }

    let rejectReason = 'AUTH_FAILED';
    if (rejected) {
      if (output.includes('Simultaneous-Use') || output.includes('simul_count')) rejectReason = 'MAX_SESSIONS_REACHED';
      else if (output.includes('Expiration') || output.includes('expired')) rejectReason = 'ACCOUNT_EXPIRED';
      else rejectReason = 'INVALID_CREDENTIALS';
    }

    return { accepted: false, replyAttrs: {}, rejectReason };
  } catch (err) {
    const error = err as { status?: number; stdout?: string; stderr?: string; message?: string };

    // radclient exits with code 1 on Access-Reject — this is NOT unreachable
    const stdout = (error.stdout || '') + (error.stderr || '');
    if (stdout.includes('Received Access-Reject')) {
      let rejectReason = 'INVALID_CREDENTIALS';
      if (stdout.includes('Simultaneous-Use') || stdout.includes('simul_count')) rejectReason = 'MAX_SESSIONS_REACHED';
      else if (stdout.includes('Expiration') || stdout.includes('expired')) rejectReason = 'ACCOUNT_EXPIRED';
      return { accepted: false, replyAttrs: {}, rejectReason };
    }

    // Actual network/timeout failure
    console.error('[RADIUS Auth] radclient error:', error.message);
    return { accepted: false, replyAttrs: {}, rejectReason: 'RADIUS_UNREACHABLE' };
  }
  })(), RADIUS_AUTH_TIMEOUT_MS, 'RADIUS auth');
}

/**
 * Map a RADIUS rejection reason code to a user-friendly message.
 */
export function getRejectMessage(code: string): string {
  const messages: Record<string, string> = {
    MAX_SESSIONS_REACHED: 'Maximum concurrent sessions reached. Please disconnect another device first.',
    ACCOUNT_EXPIRED: 'Your WiFi session has expired. Please contact front desk to renew.',
    INVALID_CREDENTIALS: 'Authentication failed. Please verify your credentials and try again.',
    RADIUS_UNREACHABLE: 'Network authentication service is temporarily unavailable. Please try again.',
    AUTH_FAILED: 'Authentication failed. Please try again or contact front desk.',
  };
  return messages[code] || messages.AUTH_FAILED;
}

/**
 * Get the Called-Station-Id and NAS secret from the system NAS entry.
 * Falls back to '00:00:00:00:00:01' / 'localkey' if not configured.
 */
async function getSystemNasConfig(): Promise<{ calledStationId: string; nasSecret: string; nasIdentifier: string }> {
  try {
    // Look up ANY active system NAS on 127.0.0.1 (Cryptsk Gateway)
    // Don't filter by propertyId — the system NAS is shared across properties
    const systemNas = await db.radiusNAS.findFirst({
      where: { ipAddress: '127.0.0.1', status: 'active' },
      select: { calledStationId: true, secret: true, nasIdentifier: true },
    });
    return {
      calledStationId: systemNas?.calledStationId || '00:00:00:00:00:01',
      nasSecret: systemNas?.secret || 'localkey',
      nasIdentifier: systemNas?.nasIdentifier || 'cryptsk-gateway',
    };
  } catch {
    return { calledStationId: '00:00:00:00:00:01', nasSecret: 'localkey', nasIdentifier: 'cryptsk-gateway' };
  }
}
