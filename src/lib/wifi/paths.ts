/**
 * System Paths — Sandbox vs Production Abstraction
 *
 * Supports three install methods for FreeRADIUS:
 *   1. RPM via dnf (Rocky Linux / RHEL)   → /usr/bin/radclient, /etc/raddb/
 *   2. Source compile (default prefix)     → /usr/local/bin/radclient, /usr/local/etc/raddb/
 *   3. Sandbox / custom install           → $FREERADIUS_HOME/ or <cwd>/freeradius-install/
 *
 * Auto-detection probes the filesystem so the correct paths are chosen
 * regardless of how FreeRADIUS was installed.  Every path can still be
 * overridden with an environment variable for edge cases.
 *
 * Set NODE_ENV=production to prefer system-wide paths.
 *
 * CRITICAL: No hardcoded absolute paths. Everything is relative to
 * process.cwd() (the project root at runtime) or an env var.
 */

const isProduction = process.env.NODE_ENV === 'production';

/** Project root — lazy to avoid process.cwd() at module scope (Edge Runtime) */
let _projectRoot: string | null = null;
function getProjectRoot(): string {
  if (_projectRoot !== null) return _projectRoot;
  try {
    _projectRoot = /*turbopackIgnore: true*/ process.cwd();
  } catch {
    // Edge Runtime fallback — use env or empty string
    _projectRoot = process.env.PROJECT_ROOT || '';
  }
  return _projectRoot;
}
/** @deprecated Use getProjectRoot() for Edge-safe access */
const PROJECT_ROOT = new Proxy({} as string, {
  get(_, prop) {
    const root = getProjectRoot();
    if (prop === 'length') return root.length;
    if (typeof prop === 'string' && !isNaN(Number(prop))) return root[Number(prop)];
    if (prop === Symbol.toPrimitive) return () => root;
    if (prop === 'toString') return () => root;
    if (prop === 'valueOf') return () => root;
    return root[prop as keyof string];
  },
});

// ── Auto-detect FreeRADIUS install prefix ──────────────────────────
// Probes for the radclient binary in the most common locations.
// Returns the *prefix* (parent of bin/ sbin/ etc/ share/).
//
// Uses lazy require('fs') instead of top-level import so this module
// is safe to import from Edge Runtime (instrumentation.ts).

/** Cached result — detection runs once per process */
let _detectedPrefix: string | null = null;

function detectFreeradiusPrefix(): string {
  if (_detectedPrefix !== null) return _detectedPrefix;

  // 1) Explicit env override wins (no fs needed)
  if (process.env.FREERADIUS_HOME) {
    _detectedPrefix = process.env.FREERADIUS_HOME;
    return _detectedPrefix;
  }

  // 2) Try filesystem probing (only works in Node.js, not Edge)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = /*turbopackIgnore: true*/ require('fs');

    // Sandbox / dev build — look for freeradius-install under project root
    if (!isProduction) {
      const sandboxHome = process.env.FREERADIUS_SANDBOX_HOME ||
        `${PROJECT_ROOT}/freeradius-install`;
      if (existsSync(`${sandboxHome}/bin/radclient`) || existsSync(`${sandboxHome}/sbin/radiusd`)) {
        _detectedPrefix = sandboxHome;
        return _detectedPrefix;
      }
    }

    // RPM (dnf) → /usr/bin/radclient, /usr/sbin/radiusd
    if (existsSync('/usr/bin/radclient') || existsSync('/usr/sbin/radiusd')) {
      _detectedPrefix = '/usr';
      return _detectedPrefix;
    }

    // Source compile → /usr/local/bin/radclient, /usr/local/sbin/radiusd
    if (existsSync('/usr/local/bin/radclient') || existsSync('/usr/local/sbin/radiusd')) {
      _detectedPrefix = '/usr/local';
      return _detectedPrefix;
    }
  } catch {
    // fs not available (Edge Runtime / build-time) — fall through to default
  }

  // 3) Fallback: assume RPM layout (most common on Rocky / RHEL)
  _detectedPrefix = isProduction
    ? '/usr'
    : `${PROJECT_ROOT}/freeradius-install`;
  return _detectedPrefix;
}

const FREERADIUS_PREFIX = detectFreeradiusPrefix();

/** Check if the detected prefix is a local/sandbox install (under cwd or explicit sandbox home) */
const isLocalPrefix = !isProduction &&
  (FREERADIUS_PREFIX === `${PROJECT_ROOT}/freeradius-install` ||
   FREERADIUS_PREFIX === process.env.FREERADIUS_SANDBOX_HOME);

// ── FreeRADIUS Paths ──────────────────────────────────────────────

/** Base directory for FreeRADIUS installation (auto-detected) */
export const FREERADIUS_HOME = FREERADIUS_PREFIX;

/** FreeRADIUS configuration directory (raddb) */
export const RADDB_PATH = process.env.RADDB_PATH ||
  (FREERADIUS_PREFIX === '/usr/local'
    ? '/usr/local/etc/raddb'
    : isLocalPrefix
      ? `${FREERADIUS_PREFIX}/etc/raddb`
      : '/etc/raddb');

/** FreeRADIUS binary name */
export const RADIUSD_BIN = process.env.RADIUSD_BIN || 'radiusd';

/** Full path to the radiusd binary */
export const RADIUSD_EXECUTABLE = process.env.RADIUSD_EXECUTABLE ||
  `${FREERADIUS_PREFIX}/sbin/${RADIUSD_BIN}`;

/** FreeRADIUS PID file path */
export const RADIUSD_PID_FILE = process.env.RADIUSD_PID_FILE ||
  (isProduction
    ? '/run/radiusd/radiusd.pid'     // Rocky 10 systemd
    : isLocalPrefix
      ? `${FREERADIUS_PREFIX}/var/run/radiusd/radiusd.pid`
      : `${FREERADIUS_PREFIX}/var/run/radiusd/radiusd.pid`);

/** FreeRADIUS log directory */
export const RADIUSD_LOG_DIR = process.env.RADIUSD_LOG_DIR ||
  (FREERADIUS_PREFIX === '/usr/local'
    ? '/usr/local/var/log/radiusd'
    : isLocalPrefix
      ? `${FREERADIUS_PREFIX}/var/log/radiusd`
      : '/var/log/radiusd');

/** FreeRADIUS main config file */
export const RADIUSD_CONF = `${RADDB_PATH}/radiusd.conf`;

/** clients.conf path */
export const CLIENTS_CONF = `${RADDB_PATH}/clients.conf`;

/** modules directory */
export const MODS_DIR = `${RADDB_PATH}/mods-enabled`;

/** sites directory */
export const SITES_DIR = `${RADDB_PATH}/sites-enabled`;

// ── RADIUS Dictionary & Library Paths ────────────────────────────

/** FreeRADIUS dictionary/share directory (for radclient -D) */
export const RADIUS_DICT_DIR = process.env.RADIUS_DICT_DIR ||
  (FREERADIUS_PREFIX === '/usr/local'
    ? '/usr/local/share/freeradius'
    : isLocalPrefix
      ? `${FREERADIUS_PREFIX}/share/freeradius`
      : '/usr/share/freeradius');

/** FreeRADIUS library directory (for LD_LIBRARY_PATH) */
export const RADIUS_LIB_DIR = process.env.RADIUS_LIB_DIR ||
  (FREERADIUS_PREFIX === '/usr/local'
    ? '/usr/local/lib/freeradius'
    : isLocalPrefix
      ? `${FREERADIUS_PREFIX}/lib/freeradius`
      : '/usr/lib64/freeradius');

// ── PostgreSQL Paths ──────────────────────────────────────────────

/** PostgreSQL data directory */
export const PG_DATA = process.env.PG_DATA ||
  (isProduction
    ? '/var/lib/pgsql/data'           // Rocky 10 default
    : `${PROJECT_ROOT}/pgsql-runtime/data`);

/** PostgreSQL bin directory */
export const PG_BIN = process.env.PG_BIN ||
  (isProduction
    ? '/usr/pgsql-17/bin'             // Rocky 10: postgresql17-server
    : `${PROJECT_ROOT}/pgsql-runtime/bin`);

/** PostgreSQL executable */
export const PG_CTL = `${PG_BIN}/pg_ctl`;

/** PostgreSQL port (for reference; actual connection uses DATABASE_URL) */
export const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);

// ── RADIUS Client Tools (radclient, radtest) ──────────────────────

/** Path to radclient binary */
export const RADCLIENT_BIN = process.env.RADCLIENT_BIN ||
  `${FREERADIUS_PREFIX}/bin/radclient`;

/** Path to radtest binary */
export const RADTEST_BIN = process.env.RADTEST_BIN ||
  `${FREERADIUS_PREFIX}/bin/radtest`;

// ── Service Management ────────────────────────────────────────────

/** How to manage FreeRADIUS service: 'systemd' (production) or 'direct' (sandbox) */
export const SERVICE_MODE: 'systemd' | 'direct' = isProduction ? 'systemd' : 'direct';

/** systemd service name */
export const SYSTEMD_SERVICE_NAME = process.env.SYSTEMD_SERVICE_NAME || 'radiusd';

// ── dnsmasq (DHCP + DNS) Paths ──────────────────────────────────

/** dnsmasq binary path */
export const DNSMASQ_BIN = process.env.DNSMASQ_BIN ||
  (isProduction ? '/usr/sbin/dnsmasq' : 'dnsmasq');

/** dnsmasq config directory (drop-in .conf files) */
export const DNSMASQ_CONF_DIR = process.env.DNSMASQ_CONF_DIR ||
  (isProduction
    ? '/etc/dnsmasq.d'
    : process.env.DHCP_SANDBOX_HOME || `${PROJECT_ROOT}/dhcp-local`);

/** Managed DHCP config file */
export const DNSMASQ_DHCP_CONF = `${DNSMASQ_CONF_DIR}/staysuite-dhcp.conf`;

/** Managed DNS config file */
export const DNSMASQ_DNS_CONF = `${DNSMASQ_CONF_DIR}/staysuite.conf`;

/** dnsmasq PID file */
export const DNSMASQ_PID_FILE = process.env.DNSMASQ_PID_FILE ||
  (isProduction
    ? '/run/dnsmasq/dnsmasq.pid'
    : '/tmp/dnsmasq.pid');

/** dnsmasq leases file */
export const DNSMASQ_LEASES_FILE = process.env.DNSMASQ_LEASES_FILE ||
  (isProduction
    ? '/var/lib/dnsmasq/dnsmasq.leases'
    : '/tmp/dnsmasq-dhcp.leases');

/** resolv.conf for dnsmasq DNS */
export const DNSMASQ_RESOLV_CONF = process.env.DNSMASQ_RESOLV_CONF ||
  (isProduction
    ? '/etc/resolv.conf'
    : `${DNSMASQ_CONF_DIR}/resolv.conf`);

// ── Scripts Paths ────────────────────────────────────────────────

/** StaySuite core scripts directory */
export const STAYSUITE_SCRIPTS_DIR = process.env.STAYSUITE_SCRIPTS_DIR ||
  (isProduction
    ? '/usr/local/scripts/staysuite_core'
    : `${PROJECT_ROOT}/scripts/staysuite_core`);

/** Network helper scripts directory */
export const NETWORK_SCRIPTS_DIR = process.env.NETWORK_SCRIPTS_DIR ||
  (isProduction
    ? '/usr/local/scripts/staysuite_core/network'
    : `${PROJECT_ROOT}/scripts/network`);

// ── Network Config Paths ────────────────────────────────────────

/** NetworkManager connections directory */
export const NM_CONNECTIONS_DIR = '/etc/NetworkManager/system-connections';

/** Static routes persistence file */
export const ROUTE_FILE = '/etc/route';

/** Restricted network file (captive portal subnets) */
export const RESTRICTED_NETWORK_PATH = process.env.RESTRICTED_NETWORK_PATH || '/etc/restrictednetwork';

/** Network interfaces file */
export const INTERFACES_FILE = '/etc/network/interfaces';

// ── Runtime Info (for display in UI) ──────────────────────────────

export function getRuntimeInfo() {
  return {
    environment: isProduction ? 'production' : 'sandbox',
    projectRoot: PROJECT_ROOT,
    detectedPrefix: FREERADIUS_PREFIX,
    freeRADIUS: {
      home: FREERADIUS_HOME,
      raddb: RADDB_PATH,
      binary: RADIUSD_EXECUTABLE,
      pidFile: RADIUSD_PID_FILE,
      logDir: RADIUSD_LOG_DIR,
      dictDir: RADIUS_DICT_DIR,
      libDir: RADIUS_LIB_DIR,
      serviceMode: SERVICE_MODE,
    },
    postgresql: {
      dataDir: PG_DATA,
      binDir: PG_BIN,
      port: PG_PORT,
    },
    dnsmasq: {
      binary: DNSMASQ_BIN,
      confDir: DNSMASQ_CONF_DIR,
      dhcpConf: DNSMASQ_DHCP_CONF,
      dnsConf: DNSMASQ_DNS_CONF,
      pidFile: DNSMASQ_PID_FILE,
      leasesFile: DNSMASQ_LEASES_FILE,
      resolvConf: DNSMASQ_RESOLV_CONF,
    },
    tools: {
      radclient: RADCLIENT_BIN,
      radtest: RADTEST_BIN,
    },
    scripts: {
      staysuiteCore: STAYSUITE_SCRIPTS_DIR,
      network: NETWORK_SCRIPTS_DIR,
    },
  };
}
