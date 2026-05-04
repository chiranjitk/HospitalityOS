import { execSync } from 'child_process';

/**
 * StaySuite Firewall Script Runner
 *
 * Calls staysuite_login.sh / staysuite_logout.sh after RADIUS auth
 * to configure nftables rules + TC HTB bandwidth shaping.
 *
 * Production (Rocky 10, root):
 *   Scripts at /usr/local/scripts/staysuite_core/ (default)
 *   nft at /usr/sbin/nft (installed via dnf, already in PATH)
 *   State dirs at /var/run/staysuite/sessions and /var/lib/staysuite/sessions
 *
 * Environment overrides (for dev/testing):
 *   STAYSUITE_SCRIPTS_DIR  — script directory
 *   STAYSUITE_NAT_ACTION    — default NAT action (masq | snat | accept)
 *   SS_STATEDIR            — runtime state directory override
 *   SS_PERSIST_STATEDIR    — persistent state directory override
 *   LOGFILE                — login/logout log file path
 */

// ─── Configuration (production defaults, overridable via env) ────────

const SCRIPTS_DIR = process.env.STAYSUITE_SCRIPTS_DIR || '/usr/local/scripts/staysuite_core';
const LOGIN_SCRIPT = `${SCRIPTS_DIR}/staysuite_login.sh`;
const LOGOUT_SCRIPT = `${SCRIPTS_DIR}/staysuite_logout.sh`;
const DEFAULT_NAT_ACTION = process.env.STAYSUITE_NAT_ACTION || 'masq';

// ─── Class ID Generation ───────────────────────────────────────────
// TC classid minor is 16-bit (1–65535). Pool roots use small IDs.
// User leaf classes use deterministic hash of username to avoid
// collision and enable crash recovery (same user → same classid).
//
// Ranges:
//   1–999       : reserved (root, pool roots)
//   1000–1499   : pool root classes (1:1001, 1:1002, etc.)
//   2001–31000  : user download leaf classes
//   32001–63000 : user upload leaf classes

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Generate deterministic TC class IDs from username.
 * Same username always maps to same classid — essential for recovery.
 */
export function generateClassIds(username: string): { dn: number; up: number } {
  const h = hashString(username);
  const dn = (h % 29000) + 2001;  // 2001–31000
  const up = dn + 30000;          // 32001–61000
  return { dn, up };
}

/**
 * Generate a pool root class ID from the BandwidthPool database UUID.
 * Maps to range 1001–1499 for pool root HTB classes under 1:1.
 */
export function generatePoolClassId(poolUuid: string): number {
  const h = hashString(poolUuid);
  return (h % 499) + 1001;  // 1001–1499
}

// ─── Login Script Parameters ───────────────────────────────────────

export interface LoginScriptParams {
  /** Client IPv4 address */
  ip: string;
  /** NAT action: masq | snat | accept */
  action?: string;
  /** SNAT target IP (required when action=snat) */
  snatIp?: string;
  /** BandwidthPool ID (if > 0, creates pool root HTB class) */
  poolId?: number;
  /** Pool total download rate (kbps) */
  poolRateDn?: number;
  /** Pool total download ceil (kbps) */
  poolCeilDn?: number;
  /** Pool total upload rate (kbps) */
  poolRateUp?: number;
  /** Pool total upload ceil (kbps) */
  poolCeilUp?: number;
  /** User download HTB class minor ID */
  dnClassid?: number;
  /** User upload HTB class minor ID */
  upClassid?: number;
  /** User download rate (kbps) */
  dnKbps?: number;
  /** User upload rate (kbps) */
  upKbps?: number;
  /** Guaranteed download (kbps) */
  dnGuar?: number;
  /** Guaranteed upload (kbps) */
  upGuar?: number;
  /** Multi-gateway ID */
  gatewayId?: string;
  /** Session ID (for state file / recovery) */
  sessionId?: string;
  /** MAC address (AA:BB:CC:DD:EE:FF) */
  macAddress?: string;
  /** WiFiUser ID */
  userId?: string;
  /** Firewall policy chain ID */
  policyId?: string;
  /** fw filter priority (default: 100) */
  fwPref?: number;
}

export interface ScriptResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Execute staysuite_login.sh to activate firewall + bandwidth for a user.
 *
 * Returns success=true if the script ran (even with partial TC failure,
 * which only means no bandwidth limits — user still gets internet).
 * Returns success=false only if the script couldn't be found or timed out.
 */
export function runLoginScript(params: LoginScriptParams): ScriptResult {
  const args: string[] = [];
  args.push('-i', params.ip);
  args.push('-a', params.action || DEFAULT_NAT_ACTION);

  if (params.snatIp) args.push('-s', params.snatIp);
  if (params.poolId && params.poolId > 0) {
    args.push('-P', String(params.poolId));
    if (params.poolRateDn) args.push('-R', String(params.poolRateDn));
    if (params.poolCeilDn) args.push('-C', String(params.poolCeilDn));
    if (params.poolRateUp) args.push('-r', String(params.poolRateUp));
    if (params.poolCeilUp) args.push('-c', String(params.poolCeilUp));
  }
  if (params.dnClassid) args.push('-d', String(params.dnClassid));
  if (params.upClassid) args.push('-u', String(params.upClassid));
  if (params.dnKbps) args.push('-D', String(params.dnKbps));
  if (params.upKbps) args.push('-U', String(params.upKbps));
  if (params.dnGuar && params.dnGuar > 0) args.push('-g', String(params.dnGuar));
  if (params.upGuar && params.upGuar > 0) args.push('-G', String(params.upGuar));
  if (params.gatewayId && params.gatewayId !== '-1') args.push('-W', params.gatewayId);
  if (params.sessionId) args.push('-S', params.sessionId);
  if (params.macAddress) args.push('-m', params.macAddress);
  if (params.userId) args.push('-X', params.userId);
  if (params.policyId && params.policyId !== '0') args.push('-o', params.policyId);
  if (params.fwPref) args.push('-f', String(params.fwPref));

  // Log full command for manual debugging — copy-paste ready
  const cmdLine = `${LOGIN_SCRIPT} ${args.join(' ')}`;
  console.log(`[ScriptRunner] LOGIN >>> ${cmdLine}`);

  return runScript(LOGIN_SCRIPT, args, 15000);
}

/**
 * Execute staysuite_logout.sh to deactivate firewall + bandwidth for a user.
 *
 * Can be called with minimal params (-i <ip> only). The logout script
 * scans all chains for orphaned rules by comment tag if no session state
 * file is found.
 */
export interface LogoutScriptParams {
  /** Client IPv4 address */
  ip: string;
  /** Session ID (for state file lookup) */
  sessionId?: string;
  /** Download class minor ID */
  dnClassid?: number;
  /** Upload class minor ID */
  upClassid?: number;
  /** SNAT IP (to remove from loggedinuserssnatip set) */
  snatIp?: string;
  /** Gateway ID (to remove from gw ipset) */
  gatewayId?: string;
  /** Pool ID */
  poolId?: number;
  /** fw filter priority used during login */
  fwPref?: number;
}

export function runLogoutScript(params: LogoutScriptParams): ScriptResult {
  const args: string[] = [];
  args.push('-i', params.ip);
  if (params.sessionId) args.push('-S', params.sessionId);
  if (params.dnClassid) args.push('-d', String(params.dnClassid));
  if (params.upClassid) args.push('-u', String(params.upClassid));
  if (params.snatIp) args.push('-s', params.snatIp);
  if (params.gatewayId && params.gatewayId !== '-1') args.push('-W', params.gatewayId);
  if (params.poolId) args.push('-P', String(params.poolId));
  if (params.fwPref) args.push('-f', String(params.fwPref));

  // Log full command for manual debugging — copy-paste ready
  const cmdLine = `${LOGOUT_SCRIPT} ${args.join(' ')}`;
  console.log(`[ScriptRunner] LOGOUT >>> ${cmdLine}`);

  return runScript(LOGOUT_SCRIPT, args, 10000);
}

// ─── Internal Script Executor ──────────────────────────────────────

function runScript(scriptPath: string, args: string[], timeoutMs: number): ScriptResult {
  const startTime = Date.now();

  // Build environment: inherit process env, pass through any overrides.
  // Scripts call nft/tc/flock — they must be on PATH (standard on Rocky 10).
  // State dirs default to /var/run and /var/lib inside the scripts themselves;
  // override via SS_STATEDIR / SS_PERSIST_STATEDIR env vars if needed.
  const scriptEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) scriptEnv[k] = v;
  }

  // Dev/sandbox: override paths to writable locations when not running as root
  if (process.getuid?.() !== 0) {
    const projectRoot = process.cwd();
    scriptEnv.LOGFILE = scriptEnv.LOGFILE || `${projectRoot}/.staysuite/logs/staysuite_login.log`;
    scriptEnv.SS_STATEDIR = scriptEnv.SS_STATEDIR || `${projectRoot}/.staysuite/sessions`;
    scriptEnv.SS_PERSIST_STATEDIR = scriptEnv.SS_PERSIST_STATEDIR || `${projectRoot}/.staysuite/sessions`;
  }

  const cmd = `${scriptPath} ${args.join(' ')}`;

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: scriptEnv,
    });
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: '',
      durationMs,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const error = err as { status?: number; stdout?: string; stderr?: string; message?: string };

    // Script executed but returned non-zero exit code
    if (error.status !== undefined) {
      const stderr = (error.stderr || '').trim();
      // Log the full command + stderr for debugging firewall failures
      console.error(`[ScriptRunner] FAIL cmd="${cmd.substring(cmd.lastIndexOf('/') + 1)}" exit=${error.status} stderr="${stderr}" (${durationMs}ms)`);
      return {
        success: false,
        exitCode: error.status,
        stdout: (error.stdout || '').trim(),
        stderr,
        durationMs,
      };
    }

    // Script couldn't be found, timed out, or permission denied
    console.error(`[ScriptRunner] ERROR cmd="${cmd.substring(cmd.lastIndexOf('/') + 1)}" msg="${error.message || 'Unknown error'}" (${durationMs}ms)`);
    return {
      success: false,
      exitCode: null,
      stdout: '',
      stderr: error.message || 'Unknown error',
      durationMs,
    };
  }
}

// ─── Bandwidth Lookup Helper ──────────────────────────────────────

export interface PoolBandwidthInfo {
  poolId: number;
  poolRateDn: number;
  poolCeilDn: number;
  poolRateUp: number;
  poolCeilUp: number;
}

/**
 * Look up BandwidthPool for a given subnet/property.
 * Returns pool info if found, or zeroes if no pool configured.
 */
export async function lookupBandwidthPool(
  propertyId: string,
  subnet?: string | null
): Promise<PoolBandwidthInfo> {
  try {
    const { db } = await import('@/lib/db');

    // Try to match by subnet first
    if (subnet) {
      const bySubnet = await db.bandwidthPool.findFirst({
        where: { propertyId, enabled: true, subnet: { contains: subnet.split('/')[0] } },
        select: { id: true, totalDownloadKbps: true, totalUploadKbps: true },
      });
      if (bySubnet) {
        const poolId = generatePoolClassId(bySubnet.id);
        return {
          poolId,
          poolRateDn: bySubnet.totalDownloadKbps,
          poolCeilDn: Math.round(bySubnet.totalDownloadKbps * 1.2),
          poolRateUp: bySubnet.totalUploadKbps,
          poolCeilUp: Math.round(bySubnet.totalUploadKbps * 1.2),
        };
      }
    }

    // Fallback: find any enabled pool for this property
    const anyPool = await db.bandwidthPool.findFirst({
      where: { propertyId, enabled: true },
      select: { id: true, totalDownloadKbps: true, totalUploadKbps: true },
    });
    if (anyPool) {
      const poolId = generatePoolClassId(anyPool.id);
      return {
        poolId,
        poolRateDn: anyPool.totalDownloadKbps,
        poolCeilDn: Math.round(anyPool.totalDownloadKbps * 1.2),
        poolRateUp: anyPool.totalUploadKbps,
        poolCeilUp: Math.round(anyPool.totalUploadKbps * 1.2),
      };
    }
  } catch {
    // Non-fatal: if DB query fails, skip pool bandwidth
  }

  return { poolId: 0, poolRateDn: 0, poolCeilDn: 0, poolRateUp: 0, poolCeilUp: 0 };
}
