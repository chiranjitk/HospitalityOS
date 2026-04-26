-- ============================================================================
-- StaySuite-HospitalityOS — FUP Tables, Views & Functions
-- ============================================================================
-- This file creates the Fair Access Policy (FUP) infrastructure:
--   - fup_switch_log table: Audit log for FUP throttle/restore events
--   - v_fup_switch_logs view: Enriched FUP event view with user/plan/property
--   - fn_check_fup: Checks if a user has exceeded their FUP data limit
--   - fn_check_login_limit: Checks if a user has exceeded max concurrent sessions
--   - fn_get_effective_bandwidth: Returns current effective bandwidth (throttled or plan speed)
--   - fn_get_mikrotik_rate_limit: Returns MikroTik-formatted rate-limit string
--   - fn_is_fup_throttled: Simple boolean check if user is currently FUP-throttled
--
-- Dependencies:
--   - Prisma tables: "WiFiUser", "WiFiPlan", "FairAccessPolicy", "BandwidthPolicy",
--     "Property", "WiFiSession"
--   - FreeRADIUS tables: radacct
--   - Table: fup_switch_log (created in this file)
--
-- Run AFTER: 01-freeradius-schema.sql
-- Run AFTER: Prisma schema push (schema.prisma)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: fup_switch_log
-- Audit trail for Fair Access Policy throttle events.
-- Every time a user's bandwidth is throttled (or restored) due to FUP,
-- an event is logged here with the full context.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fup_switch_log (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    fup_policy_name TEXT,
    usage_mb DOUBLE PRECISION DEFAULT 0,
    limit_mb DOUBLE PRECISION DEFAULT 0,
    throttle_down_kbps INTEGER DEFAULT 0,
    throttle_up_kbps INTEGER DEFAULT 0,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    property_id UUID,
    plan_name TEXT,
    cycle_type TEXT,
    action TEXT DEFAULT 'throttle',
    original_down_kbps INTEGER DEFAULT 0,
    original_up_kbps INTEGER DEFAULT 0,
    nas_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fup_switch_log_triggered_idx ON fup_switch_log(triggered_at);
CREATE INDEX IF NOT EXISTS fup_switch_log_username_idx ON fup_switch_log(username);
CREATE INDEX IF NOT EXISTS idx_fup_switch_log_created_at ON fup_switch_log(created_at);

-- ============================================================================
-- VIEW: v_fup_switch_logs
-- Shows Fair Access Policy throttle events with user/plan/property enrichment.
-- Used by the FUP dashboard to display throttle history.
-- ============================================================================
CREATE OR REPLACE VIEW v_fup_switch_logs AS
SELECT fsl.id::text AS id,
    fsl.username,
    fsl.fup_policy_name,
    fsl.usage_mb,
    fsl.limit_mb,
    fsl.throttle_down_kbps,
    fsl.throttle_up_kbps,
    fsl.triggered_at,
    COALESCE(p.name, ''::text) AS property_name,
    wu."planId",
    wp.name AS plan_name
FROM fup_switch_log fsl
    LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
    LEFT JOIN "Property" p ON p.id = fsl.property_id
    LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
ORDER BY fsl.triggered_at DESC;

-- ============================================================================
-- FUNCTION: fn_check_fup
-- Checks if a user has exceeded their Fair Access Policy data limit.
-- Used by FreeRADIUS post-auth to determine if bandwidth should be throttled.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   fup_triggered  — true if user has exceeded their FUP limit
--   throttle_down  — Throttle download speed in Kbps
--   throttle_up    — Throttle upload speed in Kbps
--   policy_name    — Name of the FUP policy
--   usage_mb       — Current usage in MB
--   limit_mb       — FUP limit in MB
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_fup(p_username text)
RETURNS TABLE(fup_triggered boolean, throttle_down integer, throttle_up integer, policy_name text, usage_mb double precision, limit_mb double precision)
LANGUAGE plpgsql STABLE AS $function$
DECLARE
  v_plan_id UUID; v_fup_id UUID; v_fup_name TEXT; v_fup_limit_mb FLOAT;
  v_usage_mb FLOAT; v_throttle_bp_id UUID; v_throttle_down INT; v_throttle_up INT;
BEGIN
  SELECT wp.id, wp."fupPolicyId" INTO v_plan_id, v_fup_id
  FROM "WiFiUser" wu LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
  IF v_fup_id IS NULL THEN RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float; RETURN; END IF;
  SELECT name, "dataLimitMb", "switchOverBwPolicyId" INTO v_fup_name, v_fup_limit_mb, v_throttle_bp_id
  FROM "FairAccessPolicy" WHERE id = v_fup_id AND "isEnabled" = true;
  IF v_fup_name IS NULL THEN RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float; RETURN; END IF;
  SELECT (COALESCE(wu."totalBytesIn", 0) + COALESCE(wu."totalBytesOut", 0)) / (1024.0 * 1024.0) INTO v_usage_mb
  FROM "WiFiUser" wu WHERE wu.username = p_username LIMIT 1;
  IF v_usage_mb IS NULL OR v_usage_mb = 0 THEN
    SELECT COALESCE(SUM(COALESCE(acctinputoctets, 0) + COALESCE(acctoutputoctets, 0)), 0) / (1024.0 * 1024.0) INTO v_usage_mb
    FROM radacct WHERE username = p_username AND acctstarttime >= now() - interval '30 days';
  END IF;
  IF v_usage_mb >= v_fup_limit_mb THEN
    IF v_throttle_bp_id IS NOT NULL THEN
      SELECT "downloadKbps", "uploadKbps" INTO v_throttle_down, v_throttle_up FROM "BandwidthPolicy" WHERE id = v_throttle_bp_id LIMIT 1;
    END IF;
    v_throttle_down := COALESCE(v_throttle_down, 1024);
    v_throttle_up := COALESCE(v_throttle_up, 512);
    RETURN QUERY SELECT true, v_throttle_down, v_throttle_up, v_fup_name, v_usage_mb, v_fup_limit_mb; RETURN;
  END IF;
  RETURN QUERY SELECT false, 0, 0, v_fup_name, v_usage_mb, v_fup_limit_mb; RETURN;
END; $function$;

-- ============================================================================
-- FUNCTION: fn_check_login_limit
-- Checks if a user has exceeded their maximum concurrent session limit.
-- Used by FreeRADIUS authorize section to reject over-limit auth attempts.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   exceeded      — true if user has reached or exceeded max sessions
--   current_count — Number of currently active sessions
--   max_allowed   — Maximum sessions allowed for this user/plan
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_login_limit(p_username text)
RETURNS TABLE(exceeded boolean, current_count integer, max_allowed integer)
LANGUAGE plpgsql STABLE AS $function$
DECLARE v_max_sessions INT; v_current_count INT;
BEGIN
  SELECT COALESCE(wu."maxSessions", wp."maxDevices", 0) INTO v_max_sessions
  FROM "WiFiUser" wu LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
  IF v_max_sessions IS NULL OR v_max_sessions = 0 THEN RETURN QUERY SELECT false, 0, 0; RETURN; END IF;
  SELECT COUNT(*) INTO v_current_count FROM radacct WHERE username = p_username AND acctstoptime IS NULL;
  IF v_current_count >= v_max_sessions THEN RETURN QUERY SELECT true, v_current_count, v_max_sessions; RETURN; END IF;
  RETURN QUERY SELECT false, v_current_count, v_max_sessions; RETURN;
END; $function$;

-- ============================================================================
-- FUNCTION: fn_get_effective_bandwidth
-- Returns the current effective bandwidth for a user, taking into account
-- Fair Access Policy (FUP) throttle state. If the user has exceeded their
-- data limit within the current cycle, returns throttled bandwidth instead
-- of plan speed. Also logs throttle events to fup_switch_log.
--
-- Parameters:
--   p_username   — WiFiUser.username
--   p_direction  — 'down' or 'up'
--
-- Returns:
--   Bandwidth in Kbps (plan speed × 1000 or throttled Kbps)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_effective_bandwidth(p_username text, p_direction text)
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE
    v_plan_id UUID; v_download_speed INTEGER; v_upload_speed INTEGER;
    v_fup_id UUID; v_fup_cycle TEXT; v_fup_limit_mb DOUBLE PRECISION;
    v_throttle_down INTEGER; v_throttle_up INTEGER;
    v_cycle_start TIMESTAMPTZ; v_usage_bytes BIGINT; v_usage_mb DOUBLE PRECISION;
    v_plan_name TEXT; v_fup_name TEXT;
BEGIN
    SELECT wp.id, wp."downloadSpeed", wp."uploadSpeed", wp."fupPolicyId",
           fp."cycleType", fp."dataLimitMb", fp."throttleDownKbps", fp."throttleUpKbps",
           wp.name, fp.name
    INTO v_plan_id, v_download_speed, v_upload_speed, v_fup_id, v_fup_cycle, v_fup_limit_mb,
         v_throttle_down, v_throttle_up, v_plan_name, v_fup_name
    FROM "WiFiUser" wu JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    LEFT JOIN "FairAccessPolicy" fp ON wp."fupPolicyId" = fp.id AND fp."isEnabled" = true
    WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
    IF v_plan_id IS NULL THEN RETURN 0; END IF;
    IF v_fup_id IS NULL THEN
        RETURN CASE WHEN p_direction = 'down' THEN v_download_speed * 1000 ELSE v_upload_speed * 1000 END;
    END IF;
    v_cycle_start := CASE v_fup_cycle
        WHEN 'daily' THEN date_trunc('day', NOW())
        WHEN 'weekly' THEN date_trunc('week', NOW())
        WHEN 'monthly' THEN date_trunc('month', NOW())
        ELSE date_trunc('day', NOW()) END;
    SELECT COALESCE(SUM(COALESCE("acctinputoctets", 0) + COALESCE("acctoutputoctets", 0)), 0)
    INTO v_usage_bytes FROM radacct WHERE username = p_username AND "acctstarttime" >= v_cycle_start;
    v_usage_mb := v_usage_bytes / (1024.0 * 1024.0);
    IF v_usage_mb >= v_fup_limit_mb THEN
        IF NOT EXISTS (
            SELECT 1 FROM fup_switch_log WHERE username = p_username
            AND action = 'throttle' AND created_at > NOW() - INTERVAL '5 minutes'
        ) THEN
            INSERT INTO fup_switch_log (username, plan_name, fup_policy_name, cycle_type,
                usage_mb, limit_mb, action, original_down_kbps, original_up_kbps,
                throttle_down_kbps, throttle_up_kbps, nas_ip)
            VALUES (p_username, v_plan_name, v_fup_name, v_fup_cycle,
                   v_usage_mb, v_fup_limit_mb, 'throttle',
                   v_download_speed * 1000, v_upload_speed * 1000,
                   v_throttle_down, v_throttle_up, NULL);
        END IF;
        RETURN CASE WHEN p_direction = 'down' THEN COALESCE(v_throttle_down, 256)
               ELSE COALESCE(v_throttle_up, 128) END;
    ELSE
        RETURN CASE WHEN p_direction = 'down' THEN v_download_speed * 1000
               ELSE v_upload_speed * 1000 END;
    END IF;
END; $function$;

-- ============================================================================
-- FUNCTION: fn_get_mikrotik_rate_limit
-- Returns a MikroTik-formatted rate-limit string for a user.
-- Automatically chooses Kbps or Mbps notation based on speed magnitude.
-- Used by FreeRADIUS to push Mikrotik-Rate-Limit reply attribute.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   MikroTik rate-limit string, e.g. "512K/256K" or "50M/25M"
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_mikrotik_rate_limit(p_username text)
RETURNS text LANGUAGE plpgsql AS $function$
DECLARE v_down INTEGER; v_up INTEGER; v_plan_down INTEGER;
BEGIN
    v_down := fn_get_effective_bandwidth(p_username, 'down');
    v_up := fn_get_effective_bandwidth(p_username, 'up');
    SELECT wp."downloadSpeed" INTO v_plan_down
    FROM "WiFiUser" wu JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
    IF v_plan_down IS NULL THEN RETURN v_down || 'K/' || v_up || 'K'; END IF;
    IF v_down < v_plan_down * 1000 THEN
        RETURN v_down || 'K/' || v_up || 'K';
    ELSE
        RETURN (v_down / 1000) || 'M/' || (v_up / 1000) || 'M';
    END IF;
END; $function$;

-- ============================================================================
-- FUNCTION: fn_is_fup_throttled
-- Simple check whether a user is currently being FUP-throttled.
-- Computes cycle-based usage and compares against the FUP data limit.
-- Returns 1 if throttled, 0 if not.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   1 = user is currently FUP-throttled
--   0 = user is not throttled
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_is_fup_throttled(p_username text)
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE
    v_plan_id UUID; v_download_speed INTEGER; v_fup_id UUID; v_fup_limit_mb DOUBLE PRECISION;
    v_cycle_start TIMESTAMPTZ; v_usage_bytes BIGINT; v_usage_mb DOUBLE PRECISION;
BEGIN
    SELECT wp.id, wp."downloadSpeed", wp."fupPolicyId", fp."dataLimitMb"
    INTO v_plan_id, v_download_speed, v_fup_id, v_fup_limit_mb
    FROM "WiFiUser" wu JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    LEFT JOIN "FairAccessPolicy" fp ON wp."fupPolicyId" = fp.id AND fp."isEnabled" = true
    WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
    IF v_plan_id IS NULL OR v_fup_id IS NULL THEN RETURN 0; END IF;
    v_cycle_start := CASE
        WHEN (SELECT "cycleType" FROM "FairAccessPolicy" WHERE id = v_fup_id) = 'weekly' THEN date_trunc('week', NOW())
        WHEN (SELECT "cycleType" FROM "FairAccessPolicy" WHERE id = v_fup_id) = 'monthly' THEN date_trunc('month', NOW())
        ELSE date_trunc('day', NOW()) END;
    SELECT COALESCE(SUM(COALESCE("acctinputoctets", 0) + COALESCE("acctoutputoctets", 0)), 0)
    INTO v_usage_bytes FROM radacct WHERE username = p_username AND "acctstarttime" >= v_cycle_start;
    v_usage_mb := v_usage_bytes / (1024.0 * 1024.0);
    IF v_usage_mb >= v_fup_limit_mb THEN RETURN 1; ELSE RETURN 0; END IF;
END; $function$;

COMMIT;
