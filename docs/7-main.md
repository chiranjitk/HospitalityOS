# Task ID: 7 — dhcp-service SQLite → PostgreSQL Migration

## Summary
Successfully migrated `mini-services/dhcp-service/index.ts` from `bun:sqlite` to the `pg` (node-postgres) package connecting to PostgreSQL at `postgresql://z@localhost:5432/staysuite`.

## Key Changes

### Driver & Connection
- `import Database from 'bun:sqlite'` → `import pg from 'pg'`
- `new Database(DB_PATH)` → `new pg.Pool({ connectionString: DATABASE_URL })`
- Removed all SQLite PRAGMA statements (journal_mode, busy_timeout, foreign_keys, synchronous, wal_autocheckpoint)
- Added startup connection verification with masked URL logging
- Pool config: max=10, idleTimeout=30s, connectionTimeout=5s

### Query Pattern Conversion
| SQLite | PostgreSQL |
|--------|-----------|
| `db.query(SQL).all()` | `(await pool.query(SQL)).rows` |
| `db.query(SQL, params).get()` | `(await pool.query(SQL, params)).rows[0]` |
| `db.run(SQL, params)` | `await pool.query(SQL, params)` |
| `WHERE enabled = 1` | `WHERE "enabled" = true` |
| `?` placeholders | `$1, $2, ...` via `paramify()` helper |

### Type Adaptations
- **IDs**: `generateId()` → `generateUuid()` (crypto.randomUUID()) — all PKs are UUID type
- **Boolean**: `1/0` → `true/false` for enabled columns
- **Timestamps**: `new Date().toISOString()` → `new Date()` (pg handles Date→timestamptz)
- **Count**: `COUNT(*)::int` cast to avoid bigint string serialization
- **Mixed-case quoting**: All table names (`"DhcpSubnet"`) and column names (`"macAddress"`) quoted

### Async Conversion
- `generateConfig()` → async (7 parallel queries via Promise.all)
- `fullSync()`, `parseLeasesFile()`, `deriveSubnetCidr()` → async
- `startDnsmasq()`, `reloadDnsmasq()` → async
- All 30+ route handlers → async

## Verification
- ✅ Health check: `{"database":"postgresql","status":"healthy"}`
- ✅ Status: 4 subnets, 3 reservations, 3 options from PostgreSQL
- ✅ Config generation: 23 directives in dnsmasq conf
- ✅ All CRUD endpoints tested: subnets, reservations, options, blacklist, tag-rules, hostname-filters, lease-scripts
- ✅ PM2 running stable (process id 10)

## Files Modified
- `mini-services/dhcp-service/index.ts` — Full rewrite (1668 → ~1710 lines)
- `mini-services/dhcp-service/package.json` — Added `pg@8.20.0` dependency
- `worklog.md` — Added Task ID 7 entry
