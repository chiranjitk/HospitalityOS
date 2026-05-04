# Database Backup Marks

## staysuite-backup-20260504-233811.dump

- **Date**: 2026-05-05 04:38 UTC
- **Format**: PostgreSQL custom (`-Fc`) — restore with `pg_restore`
- **Size**: ~1.1 MB
- **Database**: staysuite (PostgreSQL)

### What's Included

- All StaySuite HospitalityOS tables (Prisma-managed + raw SQL)
- **FreeRADIUS tables**: radacct, radpostauth, radcheck, radreply, radusergroup, nas
- **Custom views**: v_session_history, v_active_sessions, v_auth_logs
- **Key data**:
  - DeviceProfile records with MAC addresses (chiranjitk user)
  - WiFi users, guests, properties, rooms, bookings, plans
  - Captive portal zones with autoAuthEnabled settings
  - IP pools with WAN IP 21.0.0.1 in Guest Pool
  - Session history and auth logs
  - DHCP leases and DNS records

### Recent Code Changes Reflected

1. **Auto-auth fix**: Admin disconnect no longer deactivates DeviceProfile
2. **MAC in all tabs**: DeviceProfile MAC fallback in radacct/radpostauth + DB views
3. **v_session_history**: callingstationid now uses 3-way COALESCE (WiFiSession → radacct → DeviceProfile)
4. **v_auth_logs**: calling_station_id now falls back to DeviceProfile MAC
5. **v_active_sessions**: Rebuilt on updated v_session_history

### Restore Instructions

```bash
# Drop and recreate (destructive)
dropdb -U postgres -h 127.0.0.1 staysuite
createdb -U postgres -h 127.0.0.1 staysuite
pg_restore -U postgres -h 127.0.0.1 -d staysuite --no-owner --no-privileges staysuite-backup-20260504-233811.dump

# Or restore into a separate database for inspection
createdb -U postgres -h 127.0.0.1 staysuite_test
pg_restore -U postgres -h 127.0.0.1 -d staysuite_test --no-owner --no-privileges staysuite-backup-20260504-233811.dump
```

---

## staysuite-full-backup.sql

- **Date**: 2026-05-04 ~19:25 UTC (before auto-auth MAC changes)
- **Format**: Plain SQL
- **Size**: ~1.1 MB
- **Previous backup — pre MAC-fallback feature**
