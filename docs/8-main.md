# Task 8: Migrate dns-service from bun:sqlite to PostgreSQL

## Agent: Main Agent

## Summary
Successfully migrated the dns-service from bun:sqlite (dual-DB architecture) to PostgreSQL (pg package) with a single-database architecture.

## Changes Made

### Architecture Change
- **Before**: Two SQLite databases (own DB + Prisma DB) with bidirectional sync (~300 lines of sync code)
- **After**: Single PostgreSQL database (`postgresql://z@localhost:5432/staysuite`)

### Table Mapping
| Old (SQLite) | New (PostgreSQL) | Notes |
|---|---|---|
| DnsZone (own) | "DnsZone" (Prisma) | `type` field computed as 'forward' |
| DnsRecord (own) | "DnsRecord" (Prisma) | Direct mapping |
| DnsRedirect (own) | "DnsRedirectRule" (Prisma) | matchPattern↔domain/wildcard mapping |
| DnsForwarder (own) | "DnsForwarder" (new) | Created in PostgreSQL |
| DnsActivityLog (own) | "DnsActivityLog" (new) | Created in PostgreSQL |

### Key Conversions
- `bun:sqlite` → `pg.Pool` (max 10 connections)
- `?` params → `$1, $2, ...` (PostgreSQL parameterized)
- `db.query().all()` → `(await pool.query()).rows`
- `INTEGER` 0/1 → `BOOLEAN` true/false
- `datetime('now')` → `NOW()`
- `generateId()` → `crypto.randomUUID()`
- All DB calls made async
- Removed ~300 lines of dual-DB sync code

### Files Modified
- `mini-services/dns-service/index.ts` — Complete rewrite (1699 → ~830 lines)
- `mini-services/dns-service/package.json` — Added `pg@8.20.0`

### Tables Created in PostgreSQL
- "DnsForwarder" (TEXT PK, BOOLEAN enabled, TIMESTAMPTZ timestamps, UNIQUE constraint)
- "DnsActivityLog" (TEXT PK, TIMESTAMPTZ timestamp)

### Verified Endpoints
- `/health` → healthy, DB connected
- `/api/status` → 2 zones, 4 records, 2 redirects from real Prisma data
- `/api/redirects` → matchPattern correctly mapped to domain/wildcard
- `/api/forwarders` → CRUD round-trip working
- `/api/stats` → All counts correct

### Service Status
- Running on PM2 with `DATABASE_URL=postgresql://z@localhost:5432/staysuite`
- Port: 3012, Version: 2.0.0
- Zero errors in startup logs
