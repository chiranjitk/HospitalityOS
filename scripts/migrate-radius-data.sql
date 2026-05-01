-- ============================================================
-- StaySuite RADIUS Data Migration Script
-- ============================================================
-- Run this AFTER running migrate-radius-tables.sql AND bun run db:push
-- This migrates existing RADIUS credential data from _old tables
-- (standard FreeRADIUS serial-id schema) to new Prisma tables
-- (uuid-id extended schema).
--
-- Run as postgres superuser:
--   sudo -u postgres psql -d staysuite -f scripts/migrate-radius-data.sql
-- ============================================================

BEGIN;

-- Migrate radcheck data
INSERT INTO radcheck (id, username, attribute, op, value, "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "UserName",
  "Attribute",
  "op",
  "Value",
  true,
  NOW(),
  NOW()
FROM radcheck_old
ON CONFLICT DO NOTHING;

-- Migrate radreply data
INSERT INTO radreply (id, username, attribute, op, value, "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "UserName",
  "Attribute",
  "op",
  "Value",
  true,
  NOW(),
  NOW()
FROM radreply_old
ON CONFLICT DO NOTHING;

-- Migrate radusergroup data
INSERT INTO radusergroup (id, username, groupname, priority, "createdAt")
SELECT
  gen_random_uuid(),
  "UserName",
  "GroupName",
  "priority",
  NOW()
FROM radusergroup_old
ON CONFLICT DO NOTHING;

-- Migrate radgroupcheck data
INSERT INTO radgroupcheck (id, groupname, attribute, op, value, "createdAt")
SELECT
  gen_random_uuid(),
  "GroupName",
  "Attribute",
  "op",
  "Value",
  NOW()
FROM radgroupcheck_old
ON CONFLICT DO NOTHING;

-- Migrate radgroupreply data
INSERT INTO radgroupreply (id, groupname, attribute, op, value, "createdAt")
SELECT
  gen_random_uuid(),
  "GroupName",
  "Attribute",
  "op",
  "Value",
  NOW()
FROM radgroupreply_old
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- After verifying data migrated successfully, clean up old tables:
--   sudo -u postgres psql -d staysuite -c "DROP TABLE radcheck_old, radreply_old, radusergroup_old, radgroupcheck_old, radgroupreply_old;"
-- ============================================================
