import { execFileSync } from 'child_process';
import { RADDB_PATH, RADCLIENT_BIN, RADIUS_DICT_DIR, RADIUS_LIB_DIR } from '@/lib/wifi/paths';

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
export async function radiusAuth(username: string, password: string): Promise<{
  accepted: boolean;
  replyAttrs: Record<string, string>;
  rejectReason?: string;
}> {
  try {
    const radclientBin = RADCLIENT_BIN;
    const raddbDir = RADDB_PATH;
    // Dictionary and lib dirs come from centralized paths.ts auto-detection
    const dictDir = RADIUS_DICT_DIR;
    const libDir = RADIUS_LIB_DIR;

    const radclientInput = `User-Name = '${username}', User-Password = '${password}', NAS-IP-Address = 127.0.0.1, NAS-Port = 0, NAS-Port-Type = Wireless-802.11, Called-Station-Id = '00:00:00:00:00:01'\n`;

    const output = execFileSync(radclientBin, ['-D', dictDir, '-x', '127.0.0.1', 'auth', 'testing123', '3'], {
      input: radclientInput,
      encoding: 'utf-8',
      timeout: 5000,
      cwd: raddbDir,
      env: { ...process.env, LD_LIBRARY_PATH: `${libDir}:${process.env.LD_LIBRARY_PATH || ''}` },
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
