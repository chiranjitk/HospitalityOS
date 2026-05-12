# Database Backup Marks

## staysuite-backup-20260505-083436.dump

- **Date**: 2026-05-05 08:34 UTC
- **Format**: PostgreSQL custom (`-Fc`) — restore with `pg_restore`
- **Size**: ~1.1 MB (gzip compressed)
- **Database**: staysuite (PostgreSQL 17.4)
- **TOC Entries**: 2,220

### What's Included

- **271 Tables** (all Prisma-managed + FreeRADIUS + helper tables)
- **6 Views**: v_session_history, v_active_sessions, v_auth_logs, v_user_usage, v_wifi_users, v_fup_switch_logs
- **8 Functions**: fn_check_fup, fn_check_ip_pool, fn_check_login_limit, fn_get_effective_bandwidth, fn_get_mikrotik_rate_limit, fn_get_pool_attr, fn_get_user_pool_info, fn_is_fup_throttled
- **931 Indexes**, **439 FK Constraints**
- **All seed data**: 2 tenants, 7 users, properties, rooms, guests, bookings, WiFi plans, RADIUS credentials, vouchers, network config, etc.
- **Extensions**: citext, plpgsql
- **All 271 tables populated** (no empty tables)

### Restore Instructions

```bash
# Destructive restore (drop + recreate)
dropdb -U postgres -h 127.0.0.1 staysuite
createdb -U postgres -h 127.0.0.1 staysuite
pg_restore -U postgres -h 127.0.0.1 -d staysuite --no-owner --no-privileges db-backup/staysuite-backup-20260505-083436.dump

# Non-destructive restore into separate DB
createdb -U postgres -h 127.0.0.1 staysuite_test
pg_restore -U postgres -h 127.0.0.1 -d staysuite_test --no-owner --no-privileges db-backup/staysuite-backup-20260505-083436.dump
```

---

## staysuite-full-backup.sql

- **Date**: 2026-05-05 08:34 UTC
- **Format**: Plain SQL
- **Size**: ~1 MB
- **Same snapshot as .dump file** — human-readable, grep-friendly
