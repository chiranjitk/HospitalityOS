import { execSync } from 'child_process';

/**
 * Send a RADIUS Access-Request via radclient to FreeRADIUS on localhost.
 * This runs ALL authorization checks (sql module reads radcheck, checks
 * Simultaneous-Use via fn_check_login_limit, expiration, etc.).
 *
 * This device acts as a NAS gateway, so NAS-IP-Address is always 127.0.0.1.
 */
export async function radiusAuth(username: string, password: string): Promise<{
  accepted: boolean;
  replyAttrs: Record<string, string>;
  rejectReason?: string;
}> {
  try {
    const radclientBin = '/home/z/my-project/freeradius-install/bin/radclient';
    const raddbDir = '/home/z/my-project/freeradius-install/etc/raddb';
    const dictDir = '/home/z/my-project/freeradius-install/share/freeradius';
    const libDir = '/home/z/my-project/freeradius-install/lib';

    // radclient needs LD_LIBRARY_PATH for shared libs and -D for dictionary path
    // LD_LIBRARY_PATH is set via env option below (no need for inline export)
    const escapedUsername = username.replace(/'/g, "'\\''");
    const escapedPassword = password.replace(/'/g, "'\\''");
    const radclientCmd = `echo "User-Name = '${escapedUsername}', User-Password = '${escapedPassword}', NAS-IP-Address = 127.0.0.1, NAS-Port = 0, NAS-Port-Type = Wireless-802.11, Called-Station-Id = '00:00:00:00:00:01'" | ${radclientBin} -D ${dictDir} -x 127.0.0.1 auth testing123 3`;

    const output = execSync(radclientCmd, {
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
    console.error('[RADIUS Auth] radclient error:', err);
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
