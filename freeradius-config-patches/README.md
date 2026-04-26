# FreeRADIUS Configuration Patches for StaySuite

These patch files contain the **StaySuite-specific modifications** to standard FreeRADIUS v3.2.x configuration.
Apply these patches AFTER installing FreeRADIUS on your production server.

## Files

### 1. `sql-module-config.patch`
Configuration settings for `raddb/mods-available/sql`:
- dialect, driver, radius_db connection string
- Table names, read_clients, debug cleanup

### 2. `queries-postauth.patch`
Replacement `post-auth` section for `raddb/mods-config/sql/main/postgresql/queries.conf`:
- Captures: calledstationid, callingstationid, nasipaddress, clientipaddress

### 3. `sites-default-postauth.patch`
StaySuite blocks for `raddb/sites-available/default` post-auth section:
- IP Pool restriction check (fn_check_ip_pool)
- Gateway push (fn_get_pool_attr)
- FUP bandwidth override (fn_get_mikrotik_rate_limit)

## How to Apply on Rocky 10 Production

```bash
# 1. Install FreeRADIUS
sudo dnf install -y freeradius freeradius-utils freeradius-postgresql

# 2. Source environment config
source production-env.conf

# 3. Apply patches (see each .patch file for instructions)

# 4. Verify config
sudo radiusd -XC

# 5. Start
sudo systemctl enable --now radiusd
```

## Path Differences: Rocky 10 vs Sandbox

| Component | Rocky 10 (dnf install) | Sandbox (source compile) |
|-----------|----------------------|--------------------------|
| FR binary | `/usr/sbin/radiusd` | `/home/z/freeradius-install/sbin/radiusd` |
| FR config | `/etc/raddb/` | `/home/z/freeradius-install/etc/raddb/` |
| FR logs | `/var/log/radiusd/` | `/home/z/freeradius-install/var/log/radiusd/` |
| sql symlink | `../mods-available/sql` (relative) | `/home/z/freeradius-install/...` (absolute) |
| PG binary | `/usr/pgsql-17/bin/` | `/home/z/pgsql-17/bin/` |
| PG data | `/var/lib/pgsql/17/data/` | `/home/z/pgsql-17/data/` |

## Important Notes

- On Rocky 10, the `sql` module symlink in `mods-enabled/` is already relative (correct)
- The `radius_db` connection string must use production credentials
- Remove `logfile = /tmp/sql_debug.log` from sql module for production
- Disable `sqlippool` module: `sudo rm -f /etc/raddb/mods-enabled/sqlippool`
- Enable `read_clients = yes` in sql module to read NAS from database
