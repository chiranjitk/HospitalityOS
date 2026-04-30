/**
 * FreeRADIUS & System Paths — Sandbox vs Production Abstraction
 *
 * Sandbox (this dev environment):
 *   FreeRADIUS = project-local build at freeradius-install/
 *   PostgreSQL  = project-local at pgsql-runtime/
 *
 * Production (Rocky Linux 10 via dnf):
 *   FreeRADIUS = dnf install freeradius → /usr/sbin/radiusd, /etc/raddb/
 *   PostgreSQL  = dnf install postgresql17-server → /usr/bin/pg_ctl, /var/lib/pgsql/
 *
 * All paths are resolved via environment variables with sensible defaults.
 * Set NODE_ENV=production to auto-switch to system paths.
 */

import { existsSync as fsExistsSync } from 'fs';

const isProduction = process.env.NODE_ENV === 'production';

// ── FreeRADIUS Paths ──────────────────────────────────────────────

/** Base directory for FreeRADIUS installation */
export const FREERADIUS_HOME = process.env.FREERADIUS_HOME ||
  (isProduction
    ? '/usr'                          // Rocky 10: dnf installs to /usr
    : fsExistsSync('/home/z/my-project/freeradius-install')
      ? '/home/z/my-project/freeradius-install'
      : '/usr');

/** FreeRADIUS configuration directory (raddb) */
export const RADDB_PATH = process.env.RADDB_PATH ||
  (isProduction
    ? '/etc/raddb'                    // Rocky 10: dnf default
    : `${FREERADIUS_HOME}/etc/raddb`);

/** FreeRADIUS binary name */
export const RADIUSD_BIN = process.env.RADIUSD_BIN || 'radiusd';

/** Full path to the radiusd binary */
export const RADIUSD_EXECUTABLE = process.env.RADIUSD_EXECUTABLE ||
  `${FREERADIUS_HOME}/sbin/${RADIUSD_BIN}`;

/** FreeRADIUS PID file path */
export const RADIUSD_PID_FILE = process.env.RADIUSD_PID_FILE ||
  (isProduction
    ? '/run/radiusd/radiusd.pid'     // Rocky 10 systemd
    : `${FREERADIUS_HOME}/var/run/radiusd/radiusd.pid`);

/** FreeRADIUS log directory */
export const RADIUSD_LOG_DIR = process.env.RADIUSD_LOG_DIR ||
  (isProduction
    ? '/var/log/radiusd'              // Rocky 10
    : `${FREERADIUS_HOME}/var/log/radiusd`);

/** FreeRADIUS main config file */
export const RADIUSD_CONF = `${RADDB_PATH}/radiusd.conf`;

/** clients.conf path */
export const CLIENTS_CONF = `${RADDB_PATH}/clients.conf`;

/** modules directory */
export const MODS_DIR = `${RADDB_PATH}/mods-enabled`;

/** sites directory */
export const SITES_DIR = `${RADDB_PATH}/sites-enabled`;

// ── PostgreSQL Paths ──────────────────────────────────────────────

/** PostgreSQL data directory */
export const PG_DATA = process.env.PG_DATA ||
  (isProduction
    ? '/var/lib/pgsql/data'           // Rocky 10 default
    : '/home/z/my-project/pgsql-runtime/data');

/** PostgreSQL bin directory */
export const PG_BIN = process.env.PG_BIN ||
  (isProduction
    ? '/usr/pgsql-17/bin'             // Rocky 10: postgresql17-server
    : '/home/z/my-project/pgsql-runtime/bin');

/** PostgreSQL executable */
export const PG_CTL = `${PG_BIN}/pg_ctl`;

/** PostgreSQL port (for reference; actual connection uses DATABASE_URL) */
export const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);

// ── RADIUS Client Tools (radclient, radtest) ──────────────────────

/** Path to radclient binary */
export const RADCLIENT_BIN = process.env.RADCLIENT_BIN ||
  `${FREERADIUS_HOME}/bin/radclient`;

/** Path to radtest binary */
export const RADTEST_BIN = process.env.RADTEST_BIN ||
  `${FREERADIUS_HOME}/bin/radtest`;

// ── Service Management ────────────────────────────────────────────

/** How to manage FreeRADIUS service: 'systemd' (production) or 'direct' (sandbox) */
export const SERVICE_MODE: 'systemd' | 'direct' = isProduction ? 'systemd' : 'direct';

/** systemd service name */
export const SYSTEMD_SERVICE_NAME = process.env.SYSTEMD_SERVICE_NAME || 'radiusd';

// ── Runtime Info (for display in UI) ──────────────────────────────

export function getRuntimeInfo() {
  return {
    environment: isProduction ? 'production' : 'sandbox',
    freeRADIUS: {
      home: FREERADIUS_HOME,
      raddb: RADDB_PATH,
      binary: RADIUSD_EXECUTABLE,
      pidFile: RADIUSD_PID_FILE,
      logDir: RADIUSD_LOG_DIR,
      serviceMode: SERVICE_MODE,
    },
    postgresql: {
      dataDir: PG_DATA,
      binDir: PG_BIN,
      port: PG_PORT,
    },
    tools: {
      radclient: RADCLIENT_BIN,
      radtest: RADTEST_BIN,
    },
  };
}
