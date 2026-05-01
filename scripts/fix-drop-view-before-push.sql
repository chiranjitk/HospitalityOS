-- ============================================================
-- Hotfix: Drop view v_wifi_users before db:push
-- ============================================================
-- The migration script renamed radcheck → radcheck_old,
-- but the view v_wifi_users still references radcheck (now radcheck_old).
-- Prisma db push tries to DROP radcheck_old but can't because
-- the view depends on it.
--
-- Run this BEFORE bun run db:push:
--   sudo -u postgres psql -d staysuite -f scripts/fix-drop-view-before-push.sql
-- ============================================================

BEGIN;

-- Drop the view that depends on radcheck_old
DROP VIEW IF EXISTS v_wifi_users CASCADE;

-- Also check for other views that might depend on _old tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' LOOP
    -- Skip if view was already dropped
    CONTINUE;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- NOW run: bun run db:push
-- THEN recreate the view (after Prisma creates new radcheck table):
--   sudo -u postgres psql -d staysuite -f scripts/recreate-views.sql
-- ============================================================
