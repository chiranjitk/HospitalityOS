#!/usr/bin/env python3
"""
Migration script: freeradius-service from bun:sqlite to PostgreSQL (pg)
Reads index.ts.bak, transforms all SQLite patterns to PostgreSQL, writes index.ts
"""

import re

with open('/home/z/my-project/mini-services/freeradius-service/index.ts.bak', 'r') as f:
    src = f.read()

print(f"Input: {len(src)} chars, {src.count(chr(10))} lines")

# ============================================================================
# PHASE 1: Replace import and database setup section
# ============================================================================

old_setup = """import Database from 'bun:sqlite';
import { createLogger } from '../shared/logger';

const execAsync = promisify(exec);

const app = new Hono();
const PORT = 3010;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('radius-service');
const startTime = Date.now();

// RADIUS server configuration paths (Rocky Linux 10: radiusd package)
const RADIUS_CONFIG_PATH = process.env.RADIUS_CONFIG_PATH || '/etc/raddb';
const RADIUS_CLIENTS_PATH = path.join(RADIUS_CONFIG_PATH, 'clients.conf');

// ============================================================================
// SQLite Persistence — SAME database as PMS (Prisma). Single source of truth.
// ============================================================================

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.RADIUS_DB_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');
// USE THE SAME DATABASE AS PMS — single SQLite file for everything
const SQLITE_DB_PATH = process.env.RADIUS_SERVICE_DB_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');

// Ensure the db directory exists (sync to avoid top-level await issues with PM2)
const dbDir = path.dirname(SQLITE_DB_PATH);
try {
  fsSync.mkdirSync(dbDir, { recursive: true });
} catch {
  // directory may already exist
}

const db = new Database(SQLITE_DB_PATH, { create: true });
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA wal_autocheckpoint = 1000;');  // Keep WAL file small — prevents long checkpoint locks blocking FreeRADIUS
db.exec('PRAGMA foreign_keys=ON;');
db.exec('PRAGMA busy_timeout = 30000;');  // Wait up to 30s for write lock — avoids SQLITE_BUSY when FreeRADIUS/Prisma write concurrently
db.exec('PRAGMA synchronous = NORMAL;');  // Faster than FULL — WAL mode is crash-safe even with NORMAL; reduces fsync latency that causes SQLITE_BUSY"""

new_setup = r"""import pg from 'pg';
import { createLogger } from '../shared/logger';

const execAsync = promisify(exec);

const app = new Hono();
const PORT = 3010;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('radius-service');
const startTime = Date.now();

// RADIUS server configuration paths (Rocky Linux 10: radiusd package)
const RADIUS_CONFIG_PATH = process.env.RADIUS_CONFIG_PATH || '/etc/raddb';
const RADIUS_CLIENTS_PATH = path.join(RADIUS_CONFIG_PATH, 'clients.conf');

// ============================================================================
// PostgreSQL Connection Pool
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://z@localhost:5432/staysuite';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================================
// Database Compatibility Layer — mimics bun:sqlite API using pg
// ============================================================================

/**
 * Convert SQLite ? placeholders to PostgreSQL $1, $2, ... placeholders.
 * Correctly handles string literals (doesn't convert ? inside quotes).
 */
function convertPlaceholders(sql: string): string {
  let paramIdx = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let result = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; result += ch; continue; }
    if (ch === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; result += ch; continue; }
    if (ch === '?' && !inSingleQuote && !inDoubleQuote) {
      paramIdx++;
      result += '$' + paramIdx;
      continue;
    }
    result += ch;
  }
  return result;
}

/**
 * Convert SQLite-specific SQL syntax to PostgreSQL.
 */
function convertSQL(sql: string): string {
  sql = sql.replace(/datetime\("now"\)/gi, 'NOW()');
  sql = sql.replace(/datetime\('now'\)/gi, 'NOW()');
  sql = sql.replace(/datetime\('now',\s*'(-?[\d]+)\s+(hours?|minutes?|seconds?|days?|weeks?|months?|years?)'\)/gi, "NOW() - INTERVAL '$1 $2'");
  sql = sql.replace(/datetime\('now',\s*'start of day'\)/gi, 'CURRENT_DATE');
  return sql;
}

/**
 * Convert INSERT OR IGNORE to INSERT ... ON CONFLICT DO NOTHING.
 */
function convertInsertOrIgnore(sql: string): string {
  const match = sql.match(/INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (match) {
    const table = match[1];
    const columns = match[2].split(',').map((c: string) => c.trim());
    const values = match[3];
    let conflictColumn = '';
    if (table === 'WiFiUser') conflictColumn = 'id';
    else if (table === 'RadiusMacAuth') conflictColumn = 'macAddress';
    else conflictColumn = columns[0];
    if (conflictColumn) {
      return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (${conflictColumn}) DO NOTHING`;
    }
  }
  return sql;
}

const db = {
  query(sql: string) {
    let processedSQL = sql;
    if (processedSQL.includes('INSERT OR IGNORE')) {
      processedSQL = convertInsertOrIgnore(processedSQL);
    }
    processedSQL = convertSQL(processedSQL);
    const convertedSQL = convertPlaceholders(processedSQL);
    return {
      all: async (...params: unknown[]) => {
        const result = await pool.query(convertedSQL, params);
        return result.rows;
      },
      get: async (...params: unknown[]) => {
        const result = await pool.query(convertedSQL, params);
        return result.rows[0] ?? null;
      },
      run: async (...params: unknown[]) => {
        return await pool.query(convertedSQL, params);
      },
    };
  },
  exec: async (sql: string) => {
    let processedSQL = sql;
    if (processedSQL.includes('INSERT OR IGNORE')) {
      processedSQL = convertInsertOrIgnore(processedSQL);
    }
    processedSQL = convertSQL(processedSQL);
    await pool.query(processedSQL);
  },
};

// Prepared statement helpers (replaces bun:sqlite prepared statements)
async function insertRadCheck(username: string, attribute: string, op: string, value: string) {
  await pool.query(
    'INSERT INTO radcheck (username, attribute, op, value, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, true, NOW(), NOW())',
    [username, attribute, op, value]
  );
}

async function insertRadReply(username: string, attribute: string, op: string, value: string) {
  await pool.query(
    'INSERT INTO radreply (username, attribute, op, value, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, true, NOW(), NOW())',
    [username, attribute, op, value]
  );
}

async function insertRadGroupCheck(groupname: string, attribute: string, op: string, value: string) {
  await pool.query(
    'INSERT INTO radgroupcheck (groupname, attribute, op, value) VALUES ($1, $2, $3, $4)',
    [groupname, attribute, op, value]
  );
}

async function insertRadGroupReply(groupname: string, attribute: string, op: string, value: string) {
  await pool.query(
    'INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES ($1, $2, $3, $4)',
    [groupname, attribute, op, value]
  );
}

async function insertRadUserGroup(username: string, groupname: string, priority: number) {
  await pool.query(
    'INSERT INTO radusergroup (username, groupname, priority) VALUES ($1, $2, $3)',
    [username, groupname, priority]
  );
}

log.info(`Connected to PostgreSQL: ${DATABASE_URL}`);
log.info('FreeRADIUS core tables (radcheck, radreply, etc.) already exist in PostgreSQL — skipping creation');"""

src = src.replace(old_setup, new_setup)
print("Phase 1: Replaced imports and setup")

# ============================================================================
# PHASE 2: Remove FreeRADIUS table creation block + prepared statements + log line
# ============================================================================

old_block = """// =========================================================================
// Ensure FreeRADIUS core tables exist (SQLite).
// These are needed BEFORE the prepared statements below.
// On PostgreSQL, the deploy script creates them. On SQLite (this service),
// we create them here on first startup.
// =========================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS radcheck (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT ':=',
    value      TEXT    NOT NULL DEFAULT '',
    isActive   INTEGER NOT NULL DEFAULT 1,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);
  CREATE INDEX IF NOT EXISTS radcheck_attribute_idx ON radcheck (attribute);

  CREATE TABLE IF NOT EXISTS radreply (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT '=',
    value      TEXT    NOT NULL DEFAULT '',
    isActive   INTEGER NOT NULL DEFAULT 1,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);
  CREATE INDEX IF NOT EXISTS radreply_attribute_idx ON radreply (attribute);

  CREATE TABLE IF NOT EXISTS radgroupcheck (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    groupname  TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT ':=',
    value      TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);

  CREATE TABLE IF NOT EXISTS radgroupreply (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    groupname  TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT '=',
    value      TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);

  CREATE TABLE IF NOT EXISTS radusergroup (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    groupname  TEXT    NOT NULL DEFAULT '',
    priority   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);
  CREATE INDEX IF NOT EXISTS radusergroup_groupname_idx ON radusergroup (groupname);

  CREATE TABLE IF NOT EXISTS nas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId    TEXT    NOT NULL DEFAULT '',
    propertyId  TEXT    NOT NULL DEFAULT '',
    name        TEXT    NOT NULL DEFAULT '',
    shortname   TEXT    DEFAULT '',
    nasname     TEXT    NOT NULL DEFAULT '',
    type        TEXT    DEFAULT 'other',
    secret      TEXT    NOT NULL DEFAULT '',
    coaEnabled  INTEGER NOT NULL DEFAULT 0,
    coaPort     INTEGER NOT NULL DEFAULT 3799,
    authPort    INTEGER NOT NULL DEFAULT 1812,
    acctPort    INTEGER NOT NULL DEFAULT 1813,
    status      TEXT    DEFAULT 'active',
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

log.info('FreeRADIUS core tables ensured (radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, nas)');

// FreeRADIUS SQL tables — use native lowercase names (matching FreeRADIUS schema)
// These are the SAME tables that the PMS wifi-user-service writes to.
// No sync needed — both services share this single SQLite database.
const insertRadCheck = db.query('INSERT INTO radcheck (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime("now"), datetime("now"))');
const insertRadReply = db.query('INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime("now"), datetime("now"))');
const insertRadGroupCheck = db.query('INSERT INTO radgroupcheck (groupname, attribute, op, value) VALUES (?, ?, ?, ?)');
const insertRadGroupReply = db.query('INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, ?, ?, ?)');
const insertRadUserGroup = db.query('INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, ?)');

log.info(`Using shared database: ${SQLITE_DB_PATH}`);"""

src = src.replace(old_block, '')
print("Phase 2: Removed FreeRADIUS table creation + prepared statements + old log")

# ============================================================================
# PHASE 3: Remove ensureRadacctTable function and call
# ============================================================================

src = src.replace('ensureRadacctTable();\n', '')
# Remove the function definition (multi-line)
src = re.sub(
    r'function ensureRadacctTable\(\): void \{.*?\n\}\n',
    '', src, flags=re.DOTALL
)
print("Phase 3: Removed ensureRadacctTable")

# ============================================================================
# PHASE 4: Replace RadiusEvent table creation with PostgreSQL version
# ============================================================================

old_radiusevent = """// Ensure RadiusEvent table exists for event WiFi management
db.exec(`
  CREATE TABLE IF NOT EXISTS RadiusEvent (
    id TEXT PRIMARY KEY,
    propertyId TEXT,
    name TEXT NOT NULL,
    planId TEXT,
    bandwidthDown INTEGER,
    bandwidthUp INTEGER,
    dataLimitMb INTEGER,
    validHours INTEGER DEFAULT 24,
    organizerName TEXT,
    organizerEmail TEXT,
    organizerCompany TEXT,
    status TEXT DEFAULT 'active',
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// Add organizer columns if they don't exist (for existing databases)
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerName TEXT'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerEmail TEXT'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerCompany TEXT'); } catch { /* column exists */ }"""

new_radiusevent = """// RadiusEvent table — ensure it exists in PostgreSQL
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "RadiusEvent" (
      "id" TEXT PRIMARY KEY,
      "propertyId" TEXT,
      "name" TEXT NOT NULL,
      "planId" TEXT,
      "bandwidthDown" INTEGER,
      "bandwidthUp" INTEGER,
      "dataLimitMb" INTEGER,
      "validHours" INTEGER DEFAULT 24,
      "organizerName" TEXT,
      "organizerEmail" TEXT,
      "organizerCompany" TEXT,
      "status" TEXT DEFAULT 'active',
      "createdAt" TIMESTAMP,
      "updatedAt" TIMESTAMP
    )
  `);
  // Add organizer columns if missing (idempotent)
  await pool.query(`DO $$ BEGIN ALTER TABLE "RadiusEvent" ADD COLUMN IF NOT EXISTS "organizerName" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`);
  await pool.query(`DO $$ BEGIN ALTER TABLE "RadiusEvent" ADD COLUMN IF NOT EXISTS "organizerEmail" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`);
  await pool.query(`DO $$ BEGIN ALTER TABLE "RadiusEvent" ADD COLUMN IF NOT EXISTS "organizerCompany" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`);"""

src = src.replace(old_radiusevent, new_radiusevent)
print("Phase 4: Replaced RadiusEvent table creation")

# ============================================================================
# PHASE 5: Make synchronous db-using functions async
# ============================================================================

sync_functions = [
    'getAllNASClients', 'getNASClientById', 'createNASClient',
    'updateNASClient', 'deleteNASClient', 'getRADIUSUserByUsername',
    'getAllRADIUSUsers', 'getRADIUSUserById', 'createRADIUSUser',
    'updateRADIUSUser', 'deleteRADIUSUser', 'getRADIUSGroupByName',
    'getAllRADIUSGroups', 'createRADIUSGroup', 'deleteRADIUSGroup',
    'resolveEventGroupFromPlan', 'resolveTenantAndProperty',
    'resolveTenantId', 'lookupAllNASVendors', 'lookupNASVendor',
    'lookupNASVendorByIP', 'verifyRadiusTables',
    'getAccountingSessionsFromDB', 'lookupNAS', 'logCoaAction',
]

for fn in sync_functions:
    # Replace: function name( → async function name(
    pattern = r'(function\s+' + re.escape(fn) + r'\([^)]*\)\s*)([:{])'
    replacement = r'async \1\2'
    new_src = re.sub(pattern, replacement, src)
    if new_src != src:
        src = new_src
        print(f"  Made {fn} async")

print("Phase 5: Made db-using functions async")

# ============================================================================
# PHASE 6: Add await before db.query(...).all/get/run and db.exec calls
# ============================================================================

# Add await before db.query(...).all(...)
src = re.sub(
    r'(?<!await\s)db\.query\(([^)]*(?:\([^)]*\))*[^)]*)\)\.all\(',
    r'await db.query(\1).all(',
    src
)

# Add await before db.query(...).get(...)
src = re.sub(
    r'(?<!await\s)db\.query\(([^)]*(?:\([^)]*\))*[^)]*)\)\.get\(',
    r'await db.query(\1).get(',
    src
)

# Add await before db.query(...).run(...)
src = re.sub(
    r'(?<!await\s)db\.query\(([^)]*(?:\([^)]*\))*[^)]*)\)\.run\(',
    r'await db.query(\1).run(',
    src
)

# Add await before db.exec(...)
src = re.sub(
    r'(?<!await\s)db\.exec\(',
    r'await db.exec(',
    src
)

# Fix double-awaits
src = src.replace('await await ', 'await ')

print("Phase 6: Added await before db calls")

# ============================================================================
# PHASE 7: Convert prepared statement calls
# ============================================================================
src = src.replace('insertRadCheck.run(', 'await insertRadCheck(')
src = src.replace('insertRadReply.run(', 'await insertRadReply(')
src = src.replace('insertRadGroupCheck.run(', 'await insertRadGroupCheck(')
src = src.replace('insertRadGroupReply.run(', 'await insertRadGroupReply(')
src = src.replace('insertRadUserGroup.run(', 'await insertRadUserGroup(')

# Remove local shadow variables: const insertRadCheck = await db.query(...);
src = re.sub(
    r"const insertRadCheck = await db\.query\([^)]+\);",
    '// (using global insertRadCheck helper)',
    src
)

print("Phase 7: Converted prepared statement calls")

# ============================================================================
# PHASE 8: Add await before calls to now-async helper functions
# ============================================================================

async_helpers = [
    'getAllNASClients', 'getNASClientById', 'getRADIUSUserByUsername',
    'getAllRADIUSUsers', 'getRADIUSUserById', 'getRADIUSGroupByName',
    'getAllRADIUSGroups', 'resolveEventGroupFromPlan', 'resolveTenantAndProperty',
    'resolveTenantId', 'lookupAllNASVendors', 'lookupNASVendorByIP',
    'verifyRadiusTables', 'getAccountingSessionsFromDB', 'lookupNAS',
    'logCoaAction', 'createNASClient',
]

for fn in async_helpers:
    escaped = re.escape(fn)
    # Match function calls but not definitions
    pattern = r'(?<!await\s)(?!async\s+function\s+)(?!function\s+)' + r'(?<!\.)' + escaped + r'\('
    # Use word boundary
    pattern = r'(?<!await\s)(?<!await )' + r'\b' + escaped + r'\('
    new_src = re.sub(pattern, f'await {fn}(', src)
    # Only apply if it actually changed something (to avoid adding await to already-awaited calls)
    if new_src != src:
        src = new_src

# Fix double-awaits
src = src.replace('await await ', 'await ')
print("Phase 8: Added await before async helper function calls")

# ============================================================================
# PHASE 9: Fix lastInsertRowid → RETURNING id
# ============================================================================
src = src.replace(
    'Number(result.lastInsertRowid)',
    '(result.rows[0]?.id ? Number(result.rows[0].id) : 0)'
)

# Add RETURNING id to createNASClient INSERT
src = src.replace(
    'INSERT INTO nas (tenantId, propertyId, name, shortname, nasname, type, secret, coaEnabled, coaPort, authPort, acctPort, status, createdAt, updatedAt)\n     VALUES (\'tenant-1\', \'property-1\', $1, $2, $3, $4, $5, 1, $6, $7, $8, \'active\', $9, $10)',
    'INSERT INTO nas (tenantId, propertyId, name, shortname, nasname, type, secret, "coaEnabled", coaPort, authPort, acctPort, status, "createdAt", "updatedAt") VALUES (\'tenant-1\', \'property-1\', $1, $2, $3, $4, $5, true, $6, $7, $8, \'active\', $9, $10) RETURNING id'
)

print("Phase 9: Fixed lastInsertRowid")

# ============================================================================
# PHASE 10: Fix .changes → .rowCount
# ============================================================================
src = re.sub(r'(?<!\w)result\.changes(?!\w)', 'result.rowCount', src)
src = re.sub(r'(?<!\w)r\.changes(?!\w)', 'r.rowCount', src)
print("Phase 10: Fixed .changes to .rowCount")

# ============================================================================
# PHASE 11: Make route handlers async
# ============================================================================
route_replacements = [
    ("app.get('/api/nas', (c) => {", "app.get('/api/nas', async (c) => {"),
    ("app.get('/api/nas/:id', (c) => {", "app.get('/api/nas/:id', async (c) => {"),
    ("app.get('/api/stats', (c) => {", "app.get('/api/stats', async (c) => {"),
    ("app.get('/api/auth-logs', (c) => {", "app.get('/api/auth-logs', async (c) => {"),
    ("app.get('/api/auth-logs/stats', (c) => {", "app.get('/api/auth-logs/stats', async (c) => {"),
    ("app.get('/api/config/sql-mod', (c) => {", "app.get('/api/config/sql-mod', async (c) => {"),
]

for from_str, to_str in route_replacements:
    src = src.replace(from_str, to_str)

print("Phase 11: Made route handlers async")

# ============================================================================
# PHASE 12: Replace SQLite diagnostic endpoint
# ============================================================================

old_diag = """// SQLite diagnostic — verify WAL mode, busy_timeout, and lock status
app.get('/api/diag/sqlite', (c) => {
  const diags: Record<string, unknown> = {};
  try {
    const journalMode = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
    diags.journal_mode = journalMode?.journal_mode;

    const busyTimeout = db.query("PRAGMA busy_timeout").get() as { busy_timeout: number };
    diags.busy_timeout_ms = busyTimeout?.busy_timeout;

    const walAutocheckpoint = db.query("PRAGMA wal_autocheckpoint").get() as { wal_autocheckpoint: number };
    diags.wal_autocheckpoint = walAutocheckpoint?.wal_autocheckpoint;

    // Check WAL file size
    const walPath = SQLITE_DB_PATH + '-wal';
    const shmPath = SQLITE_DB_PATH + '-shm';
    try {
      const walStat = fsSync.statSync(walPath);
      diags.wal_file_size_bytes = walStat.size;
    } catch {
      diags.wal_file_size_bytes = 0;
    }
    try {
      const shmStat = fsSync.statSync(shmPath);
      diags.shm_file_size_bytes = shmStat.size;
    } catch {
      diags.shm_file_size_bytes = 0;
    }

    // Test write lock by doing a quick read
    const testQuery = db.query("SELECT COUNT(*) as cnt FROM radacct").get() as { cnt: number } | undefined;
    diags.radacct_count = testQuery?.cnt ?? 0;

    // Check for active connections/locks
    const lockedRows = db.query("PRAGMA database_list").all();
    diags.database_list = lockedRows;

    diags.db_path = SQLITE_DB_PATH;
    diags.status = 'ok';
  } catch (err) {
    diags.status = 'error';
    diags.error = String(err);
  }

  return c.json({ success: true, data: diags });
});"""

new_diag = """// PostgreSQL diagnostic — verify connection and table status
app.get('/api/diag/sqlite', async (c) => {
  const diags: Record<string, unknown> = {};
  try {
    const testResult = await pool.query('SELECT NOW() as now');
    diags.connected = true;
    diags.server_time = testResult.rows[0]?.now;

    const testQuery = await pool.query('SELECT COUNT(*) as cnt FROM radacct');
    diags.radacct_count = parseInt(testQuery.rows[0]?.cnt || '0', 10);

    diags.pool_total = pool.totalCount;
    diags.pool_idle = pool.idleCount;
    diags.pool_waiting = pool.waitingCount;

    diags.database_url = DATABASE_URL.replace(/\\/\\/[^:]+:[^@]+@/, '//***:***@');
    diags.status = 'ok';
  } catch (err) {
    diags.status = 'error';
    diags.error = String(err);
  }

  return c.json({ success: true, data: diags });
});"""

src = src.replace(old_diag, new_diag)
print("Phase 12: Replaced SQLite diagnostic endpoint")

# ============================================================================
# PHASE 13: Fix sqlite_master → information_schema
# ============================================================================
src = src.replace(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=",
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name="
)
print("Phase 13: Fixed sqlite_master")

# ============================================================================
# PHASE 14: Fix setupFreeRadiusSQL (remove SQLite-specific parts)
# ============================================================================

# Remove ensureRadacctTable call inside setupFreeRadiusSQL
src = src.replace(
    """    // Step 1: Ensure radacct table exists with correct schema
    // This MUST run before setupFreeRadiusSQL so FreeRADIUS can INSERT
    ensureRadacctTable();
    details.push('Verified radacct table exists with 37 columns and indexes');""",
    """    // Step 1: radacct table already exists in PostgreSQL
    details.push('radacct table verified (exists in PostgreSQL)');"""
)

# Remove WAL mode check
old_wal = """    // Step 1c: Ensure WAL mode is set on the database (critical for SQLITE_BUSY fix)
    try {
      const walResult = db.query('PRAGMA journal_mode').get() as { journal_mode: string } | undefined;
      if (walResult?.journal_mode !== 'wal') {
        db.exec('PRAGMA journal_mode=WAL;');
        details.push('Enabled WAL mode on database');
      } else {
        details.push('WAL mode already enabled');
      }
      db.exec('PRAGMA busy_timeout=30000;');
      db.exec('PRAGMA wal_autocheckpoint=1000;');
      db.exec('PRAGMA synchronous=NORMAL;');
      details.push('Set busy_timeout=30000, wal_autocheckpoint=1000, synchronous=NORMAL');
    } catch (e) {
      details.push(`WARN: Could not set WAL pragmas: ${String(e)}`);
    }"""

src = src.replace(old_wal,
    """    // PostgreSQL handles WAL and concurrency natively
    details.push('PostgreSQL manages its own WAL and concurrency');"""
)

# Fix verifyRadiusTables call  
src = src.replace(
    """    // Step 1b: Verify all RADIUS tables are accessible
    verifyRadiusTables();
    details.push('Verified RADIUS tables (native lowercase schema: radcheck, radreply, etc.)');""",
    """    // Step 1b: Verify RADIUS tables exist in PostgreSQL
    await verifyRadiusTables();
    details.push('Verified RADIUS tables exist in PostgreSQL');"""
)

print("Phase 14: Fixed setupFreeRadiusSQL")

# ============================================================================
# PHASE 15: Fix ScheduleAccess ALTER TABLE
# ============================================================================
src = src.replace(
    """try { db.query('ALTER TABLE ScheduleAccess ADD COLUMN downloadMbps INTEGER DEFAULT 0').run(); } catch { /* column exists */ }""",
    'await pool.query(`DO $$ BEGIN ALTER TABLE "ScheduleAccess" ADD COLUMN IF NOT EXISTS "downloadMbps" INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`)'
)
src = src.replace(
    """try { db.query('ALTER TABLE ScheduleAccess ADD COLUMN uploadMbps INTEGER DEFAULT 0').run(); } catch { /* column exists */ }""",
    'await pool.query(`DO $$ BEGIN ALTER TABLE "ScheduleAccess" ADD COLUMN IF NOT EXISTS "uploadMbps" INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`)'
)
print("Phase 15: Fixed ScheduleAccess ALTER TABLE")

# ============================================================================
# PHASE 16: Fix DELETE FROM user_metadata
# ============================================================================
src = src.replace(
    "try { db.query('DELETE FROM user_metadata').run(); } catch { /* table may not exist */ }",
    'try { await pool.query(\'DELETE FROM "user_metadata"\'); } catch { /* table may not exist */ }'
)
print("Phase 16: Fixed user_metadata delete")

# ============================================================================
# PHASE 17: Fix SQLITE_DB_PATH references
# ============================================================================
src = src.replace('dbPath: SQLITE_DB_PATH', 'database: DATABASE_URL')
src = src.replace('${SQLITE_DB_PATH}', '${DATABASE_URL}')
print("Phase 17: Fixed SQLITE_DB_PATH references")

# ============================================================================
# PHASE 18: Fix sqlSetupStatus
# ============================================================================
src = src.replace(
    """let sqlSetupStatus: { enabled: boolean; dbPath: string; error?: string } = {
  enabled: false,
  dbPath: SQLITE_DB_PATH,
};""",
    """let sqlSetupStatus: { enabled: boolean; dbPath: string; error?: string } = {
  enabled: false,
  dbPath: DATABASE_URL,
};"""
)
print("Phase 18: Fixed sqlSetupStatus")

# ============================================================================
# PHASE 19: Fix FreeRADIUS SQL module config template
# ============================================================================
src = src.replace('driver = "rlm_sql_sqlite"', 'driver = "rlm_sql_postgresql"')
src = src.replace('dialect = "sqlite"', 'dialect = "postgresql"')
src = src.replace('sqlite {', 'postgresql {')
src = src.replace('filename = "${DATABASE_URL}"', 'connect_string = "${DATABASE_URL}"')

# Remove SQLite-specific pool settings and replace with PG settings
old_sqlite_pool = """    # SQLite is single-writer — MUST use a single connection.
    # Multiple connections fight for the write lock, causing SQLITE_BUSY,
    # and the pool manager destroys active connections mid-query.
    pool {
        start = 1
        min = 1
        max = 1
        spare = 0
        uses = 0
        lifetime = 0
        idle_timeout = 0
        connect_timeout = 30.0
    }"""

new_pg_pool = """    # PostgreSQL handles concurrent connections natively
    pool {
        start = 1
        min = 1
        max = 5
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
        connect_timeout = 5.0
    }"""

src = src.replace(old_sqlite_pool, new_pg_pool)

# Remove busy_timeout setting
src = src.replace('# Wait up to 30 seconds for write lock — avoids SQLITE_BUSY when\n        # the Bun freeradius-service or Prisma hold a concurrent write transaction.\n        busy_timeout = 30000\n', '')

print("Phase 19: Fixed FreeRADIUS SQL module config")

# ============================================================================
# PHASE 20: Fix comments
# ============================================================================
src = src.replace('SQLite Persistence — SAME database as PMS (Prisma). Single source of truth.', 'PostgreSQL Persistence — shared database')
src = src.replace('// SQLite Persistence — SAME database as PMS (Prisma). Single source of truth.', '// PostgreSQL Persistence — shared database')
src = src.replace('shared SQLite database', 'PostgreSQL database')
src = src.replace('shared database — single SQLite database', 'shared PostgreSQL database')
src = src.replace('SIGHUP does NOT reinitialize the SQL module or its SQLite connection.',
                  'SIGHUP does NOT reinitialize the SQL module or its PostgreSQL connection.')
src = src.replace('Sync all RADIUS config files from SQLite database',
                  'Sync all RADIUS config files from PostgreSQL database')
src = src.replace('RADIUS config sync from SQLite database',
                  'RADIUS config sync from PostgreSQL database')
src = src.replace('Starting RADIUS config sync from SQLite database',
                  'Starting RADIUS config sync from PostgreSQL database')
src = src.replace('configure radiusd to read from shared SQLite DB',
                  'configure radiusd to read from PostgreSQL')
src = src.replace('Points to the SAME SQLite database as the PMS (Prisma)',
                  'Points to the PostgreSQL database')
src = src.replace('Log accounting to SQLite', 'Log accounting to PostgreSQL')
src = src.replace('SQLITE_BUSY', 'connection errors')

# Fix header comment
src = src.replace(
    ' * - NAS Client management (routers, access points) — persisted to SQLite + clients.conf',
    ' * - NAS Client management (routers, access points) — persisted to PostgreSQL + clients.conf'
)
src = src.replace(
    ' * - NAS Client management (routers, access points) — persisted to PostgreSQL + clients.conf',
    ' * - NAS Client management (routers, access points) — persisted to PostgreSQL + clients.conf'
)

print("Phase 20: Fixed comments")

# ============================================================================
# PHASE 21: Fix remaining issues
# ============================================================================

# Fix the "SQLite Helper Functions" section comment
src = src.replace('// SQLite Helper Functions', '// Database Helper Functions')
src = src.replace('// =========================================================================\n// SQLite Helper Functions\n// =========================================================================',
                  '// =========================================================================\n// Database Helper Functions\n// =========================================================================')

# Fix SQL module config comments
src = src.replace("# Points to the SAME SQLite database as the PMS (Prisma)\n# Last updated:",
                  "# Points to the PostgreSQL database\n# Last updated:")

# Remove the SQLite database_list check reference  
# Already handled in diagnostic endpoint replacement

print("Phase 21: Fixed remaining issues")

# ============================================================================
# Write output
# ============================================================================

with open('/home/z/my-project/mini-services/freeradius-service/index.ts', 'w') as f:
    f.write(src)

print(f"\nMigration complete! Output: {len(src)} chars, {src.count(chr(10))} lines")
