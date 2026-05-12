-- ============================================================
-- Hotfix: Drop ALL views that depend on _old RADIUS tables
-- ============================================================
-- The migration script renamed radcheck → radcheck_old etc.,
-- but 6 views still reference the _old table names.
-- Prisma db push cannot DROP _old tables while views depend on them.
--
-- Run this BEFORE bun run db:push:
--   sudo -u postgres psql -d staysuite -f scripts/fix-drop-view-before-push.sql
-- ============================================================

DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_session_history CASCADE;
DROP VIEW IF EXISTS v_auth_logs CASCADE;
DROP VIEW IF EXISTS v_user_usage CASCADE;
DROP VIEW IF EXISTS v_wifi_users CASCADE;
DROP VIEW IF EXISTS v_fup_switch_logs CASCADE;

-- ============================================================
-- NOW run: bun run db:push  (answer YES to warnings)
-- THEN recreate all views:
--   sudo -u postgres psql -d staysuite -f scripts/recreate-views.sql
-- ============================================================
