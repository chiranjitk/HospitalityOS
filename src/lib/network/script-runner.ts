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
// TC classid minor is 16-bit (1–65535). All classid numbers are passed
// as hex strings to tc commands (tc parses all numbers as hex via strtoul).
//
// HTB Hierarchy:
//   1:1          — Root (10Gbit, created by initialization.sh)
//   1:2 – 1:101  — Pool container classes (max 100, default 2Gbit each)
//   1:102+       — User leaf classes (per-plan bandwidth, under their pool)
//
// Design:
//   Pool class = large container (2Gbit) to hold all users — NOT the actual limit
//   User leaf  = per-plan bandwidth (50Mbps, 100Mbps, etc.) — does the real limiting
//   Pool is just a grouping mechanism (by subnet/IP range)
//
// Pool classid mapping: ordered by createdAt, first pool = 1:2, second = 1:3, etc.
// This mapping is cached in memory and refreshed on each lookup.
//
// User classids: deterministic hash of username → range 102–25101 (same for DN & UP — different devices)

/** Max pool classes reserved */
const MAX_POOL_CLASSES = 100;
/** Pool classids start at 1:2 (1:1 is root) */
const POOL_CLASSID_START = 2;
/** User classids start after the pool range */
const USER_CLASSID_START = POOL_CLASSID_START + MAX_POOL_CLASSES; // 102
/** Number of unique user classid slots */
const USER_CLASSID_SLOTS = 25000;

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
 *
 * Download and upload use the SAME classid because they live on DIFFERENT devices:
 *   ifb0 (download): 1:102  ← user's DN leaf
 *   ifb1 (upload):   1:102  ← user's UP leaf (same number, no collision)
 *
 * Range: (hash % 25000) + 102  → 102 – 25101
 */
export function generateClassIds(username: string): { dn: number; up: number } {
  const h = hashString(username);
  const classid = (h % USER_CLASSID_SLOTS) + USER_CLASSID_START;  // 102–25101
  return { dn: classid, up: classid };  // SAME — different devices (ifb0 vs ifb1)
}

/**
 * Pool classid cache: poolUuid → sequential classid (2-101)
 * Refreshed on every lookupBandwidthPool call or initializeAllPoolClasses.
 */
let _poolClassIdCache: Map<string, number> | null = null;

/**
 * Build the pool UUID → classid mapping from the database.
 * Pools ordered by createdAt → sequential classids 2, 3, 4, ...
 * Max 100 pools (classids 2-101).
 */
async function buildPoolClassIdMap(): Promise<Map<string, number>> {
  try {
    const { db } = await import('@/lib/db');
    const pools = await db.bandwidthPool.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const map = new Map<string, number>();
    pools.forEach((pool, index) => {
      if (index < MAX_POOL_CLASSES) {
        map.set(pool.id, POOL_CLASSID_START + index);  // 2, 3, 4, ...
      }
    });
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Get pool classid from UUID using cached sequential mapping.
 * Falls back to building the map if cache is empty.
 */
export async function getPoolClassId(poolUuid: string): Promise<number> {
  if (!_poolClassIdCache) {
    _poolClassIdCache = await buildPoolClassIdMap();
  }
  return _poolClassIdCache.get(poolUuid) || 0;
}

/**
 * @deprecated Use getPoolClassId() instead — kept for backward compat.
 * Generate a pool root class ID from the BandwidthPool database UUID.
 * Now uses sequential mapping (2-101) instead of hash.
 */
export function generatePoolClassId(poolUuid: string): number {
  // This synchronous fallback should not be used in production.
  // The async getPoolClassId() should be used instead.
  console.warn(`[ScriptRunner] generatePoolClassId() called synchronously for ${poolUuid} — use getPoolClassId() instead`);
  const h = hashString(poolUuid);
  return (h % (MAX_POOL_CLASSES - 1)) + POOL_CLASSID_START;  // 2-100
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
 * Uses the sequential pool classid mapping (2-101) based on DB creation order.
 * Returns pool info if found, or zeroes if no pool configured.
 */
export async function lookupBandwidthPool(
  propertyId: string | null | undefined,
  subnet?: string | null
): Promise<PoolBandwidthInfo> {
  try {
    const { db } = await import('@/lib/db');

    // Build where clause — handle null propertyId (match pools without property too)
    const baseWhere: Record<string, unknown> = { enabled: true };
    if (propertyId) baseWhere.propertyId = propertyId;

    // Try to match by subnet first (user IP → pool subnet → correct pool class)
    if (subnet) {
      const bySubnet = await db.bandwidthPool.findFirst({
        where: { ...baseWhere, subnet: { contains: subnet.split('/')[0] } },
        select: { id: true, totalDownloadKbps: true, totalUploadKbps: true },
      });
      if (bySubnet) {
        const poolId = await getPoolClassId(bySubnet.id);
        return {
          poolId,
          poolRateDn: bySubnet.totalDownloadKbps,
          poolCeilDn: Math.round(bySubnet.totalDownloadKbps * 1.2),
          poolRateUp: bySubnet.totalUploadKbps,
          poolCeilUp: Math.round(bySubnet.totalUploadKbps * 1.2),
        };
      }
    }

    // Fallback: find any enabled pool for this property (or any if no propertyId)
    const anyPool = await db.bandwidthPool.findFirst({
      where: baseWhere,
      select: { id: true, totalDownloadKbps: true, totalUploadKbps: true },
    });
    if (anyPool) {
      const poolId = await getPoolClassId(anyPool.id);
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

/**
 * Initialize all pool TC classes on server startup.
 * Queries all enabled BandwidthPools and creates their HTB root classes
 * (1:2, 1:3, ..., 1:N) on ifb0/ifb1 via staysuite_pool.sh.
 *
 * This ensures that when users log in, the pool parent class already exists
 * — the login script just creates user leaf classes under it.
 *
 * Call this on server startup (instrumentation.ts) or via API.
 */
export async function initializeAllPoolClasses(): Promise<{ created: number; failed: number; details: string[] }> {
  const details: string[] = [];
  let created = 0;
  let failed = 0;

  try {
    const { db } = await import('@/lib/db');
    const pools = await db.bandwidthPool.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        totalDownloadKbps: true,
        totalUploadKbps: true,
      },
    });

    if (pools.length === 0) {
      details.push('No enabled BandwidthPools found in database');
      return { created: 0, failed: 0, details };
    }

    // Build cache while we're at it
    const cache = new Map<string, number>();

    for (let i = 0; i < Math.min(pools.length, MAX_POOL_CLASSES); i++) {
      const pool = pools[i];
      const poolClassId = POOL_CLASSID_START + i;  // 2, 3, 4, ...
      cache.set(pool.id, poolClassId);

      const dnRate = pool.totalDownloadKbps;
      const dnCeil = Math.round(pool.totalDownloadKbps * 1.2);
      const upRate = pool.totalUploadKbps;
      const upCeil = Math.round(pool.totalUploadKbps * 1.2);

      try {
        const result = runPoolCreate(poolClassId, dnRate, dnCeil, upRate, upCeil);
        if (result.success) {
          created++;
          details.push(`Pool #${poolClassId} "${pool.name}" created (dn=${dnRate}/${dnCeil}k up=${upRate}/${upCeil}k)`);
        } else {
          failed++;
          details.push(`Pool #${poolClassId} "${pool.name}" FAILED: ${result.stderr}`);
        }
      } catch (err) {
        failed++;
        details.push(`Pool #${poolClassId} "${pool.name}" ERROR: ${String(err)}`);
      }
    }

    if (pools.length > MAX_POOL_CLASSES) {
      details.push(`WARNING: ${pools.length - MAX_POOL_CLASSES} pools exceed max ${MAX_POOL_CLASSES} — extra pools ignored`);
    }

    // Store cache for login lookups
    _poolClassIdCache = cache;

    console.log(`[PoolInit] ${created} pool classes created, ${failed} failed (total ${pools.length} pools)`);
  } catch (err) {
    details.push(`Database error: ${String(err)}`);
  }

  return { created, failed, details };
}

/**
 * Run staysuite_pool.sh create for a single pool.
 */
function runPoolCreate(poolId: number, dnRate: number, dnCeil: number, upRate: number, upCeil: number): ScriptResult {
  const poolScript = `${SCRIPTS_DIR}/staysuite_pool.sh`;
  const args = ['create', '-P', String(poolId), '-R', String(dnRate), '-C', String(dnCeil), '-r', String(upRate), '-c', String(upCeil)];
  const cmdLine = `${poolScript} ${args.join(' ')}`;
  console.log(`[PoolInit] CREATE >>> ${cmdLine}`);
  return runScript(poolScript, args, 10000);
}

/**
 * Invalidate pool classid cache (call after pool CRUD operations).
 */
export function invalidatePoolCache(): void {
  _poolClassIdCache = null;
  console.log('[ScriptRunner] Pool classid cache invalidated');
}
