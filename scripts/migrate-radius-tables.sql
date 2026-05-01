-- ============================================================
-- StaySuite RADIUS Table Migration Script
-- ============================================================
-- PROBLEM: Production PostgreSQL has standard FreeRADIUS tables
--   (id serial, UserName, Attribute, op, Value) but Prisma schema
--   expects extended tables (id uuid, wifiUserId, isActive, etc.)
--
-- This script:
--   1. Backs up existing FreeRADIUS tables (_old suffix)
--   2. Drops old tables (they conflict with Prisma's table names)
--   3. After running this, execute: bun run db:push
--      to let Prisma create the tables with the correct schema
--
-- IMPORTANT: Run as postgres superuser:
--   sudo -u postgres psql -d staysuite -f scripts/migrate-radius-tables.sql
-- ============================================================

BEGIN;

-- 1. Backup existing tables (rename with _old suffix)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radcheck') THEN
    ALTER TABLE radcheck RENAME TO radcheck_old;
    RAISE NOTICE 'Backed up radcheck → radcheck_old';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radreply') THEN
    ALTER TABLE radreply RENAME TO radreply_old;
    RAISE NOTICE 'Backed up radreply → radreply_old';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radusergroup') THEN
    ALTER TABLE radusergroup RENAME TO radusergroup_old;
    RAISE NOTICE 'Backed up radusergroup → radusergroup_old';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radgroupcheck') THEN
    ALTER TABLE radgroupcheck RENAME TO radgroupcheck_old;
    RAISE NOTICE 'Backed up radgroupcheck → radgroupcheck_old';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radgroupreply') THEN
    ALTER TABLE radgroupreply RENAME TO radgroupreply_old;
    RAISE NOTICE 'Backed up radgroupreply → radgroupreply_old';
  END IF;
END $$;

-- 2. Drop the _old backup tables (they use serial id which conflicts with Prisma uuid id)
-- Keep them for 7 days, then delete manually if everything works:
--   DROP TABLE radcheck_old, radreply_old, radusergroup_old, radgroupcheck_old, radgroupreply_old;

-- 3. Migrate any existing data from _old tables to new tables after Prisma push
-- (Run this AFTER `bun run db:push` as a separate step)
-- See: scripts/migrate-radius-data.sql

COMMIT;

-- ============================================================
-- AFTER RUNNING THIS SCRIPT:
--   1. cd /home/z/my-project && bun run db:push
--   2. Restart PM2: pm2 restart all
--   3. Test voucher creation again
-- ============================================================
