-- ============================================================================
-- StaySuite-HospitalityOS — Advanced FUP & Login Limit Checks
-- ============================================================================
-- This file creates PostgreSQL functions for Fair Access Policy (FUP) enforcement
-- and concurrent login limit checking, plus the FUP switch-over audit log table.
--
-- Functions:
--   fn_check_fup(p_username)          → FUP status (throttle info if triggered)
--   fn_check_login_limit(p_username)  → Concurrent session limit check
--
-- Tables:
--   fup_switch_log                    → Audit log for FUP throttle events
--
-- Views:
--   v_fup_switch_logs                 → Enriched FUP switch log view
--   v_auth_logs                       → Updated auth log view with plan details
--
-- Dependencies:
--   - Prisma tables: "WiFiUser", "WiFiPlan", "FairAccessPolicy", "BandwidthPolicy",
--                    "Guest", "Booking", "Room", "Property"
--   - FreeRADIUS tables: radacct, radpostauth, radcheck, radusergroup
--
-- Run AFTER: 04-ip-pool-functions.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION: fn_check_fup
-- Checks whether a user has exceeded their Fair Access Policy data limit.
-- Joins WiFiUser → WiFiPlan → FairAccessPolicy to resolve the policy,
-- then checks cumulative data usage (WiFiUser counters or radacct).
-- If the limit is exceeded, returns throttle bandwidth from BandwidthPolicy.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   fup_triggered  — true if data limit exceeded
--   throttle_down  — download speed in kbps (from switchOverBwPolicyId)
--   throttle_up    — upload speed in kbps (from switchOverBwPolicyId)
--   policy_name    — name of the FairAccessPolicy
--   usage_mb       — user's current data usage in MB
--   limit_mb       — FUP data limit in MB
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_fup(p_username text)
RETURNS TABLE(
  fup_triggered boolean,
  throttle_down int,
  throttle_up int,
  policy_name text,
  usage_mb float,
  limit_mb float
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_plan_id UUID;
  v_fup_id UUID;
  v_fup_name TEXT;
  v_fup_limit_mb FLOAT;
  v_usage_mb FLOAT;
  v_throttle_bp_id UUID;
  v_throttle_down INT;
  v_throttle_up INT;
BEGIN
  -- Get plan and FUP policy for user
  SELECT wp.id, wp."fupPolicyId"
  INTO v_plan_id, v_fup_id
  FROM "WiFiUser" wu
  LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active'
  LIMIT 1;

  IF v_fup_id IS NULL THEN
    -- No FUP policy, return not triggered
    RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float;
    RETURN;
  END IF;

  -- Get FUP policy details
  SELECT name, "dataLimitMb", "switchOverBwPolicyId"
  INTO v_fup_name, v_fup_limit_mb, v_throttle_bp_id
  FROM "FairAccessPolicy"
  WHERE id = v_fup_id AND "isEnabled" = true;

  IF v_fup_name IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float;
    RETURN;
  END IF;

  -- Get user's current data usage (from WiFiUser or radacct)
  SELECT (COALESCE(wu."totalBytesIn", 0) + COALESCE(wu."totalBytesOut", 0)) / (1024.0 * 1024.0)
  INTO v_usage_mb
  FROM "WiFiUser" wu
  WHERE wu.username = p_username
  LIMIT 1;

  -- If user has no usage tracked in WiFiUser, check radacct
  IF v_usage_mb IS NULL OR v_usage_mb = 0 THEN
    SELECT COALESCE(SUM(COALESCE(acctinputoctets, 0) + COALESCE(acctoutputoctets, 0)), 0) / (1024.0 * 1024.0)
    INTO v_usage_mb
    FROM radacct
    WHERE username = p_username AND acctstarttime >= now() - interval '30 days';
  END IF;

  -- Check if FUP triggered
  IF v_usage_mb >= v_fup_limit_mb THEN
    -- Get throttle bandwidth policy
    IF v_throttle_bp_id IS NOT NULL THEN
      SELECT "downloadKbps", "uploadKbps" INTO v_throttle_down, v_throttle_up
      FROM "BandwidthPolicy"
      WHERE id = v_throttle_bp_id LIMIT 1;
    END IF;

    v_throttle_down := COALESCE(v_throttle_down, 1024); -- Default 1Mbps
    v_throttle_up := COALESCE(v_throttle_up, 512);     -- Default 512kbps

    RETURN QUERY SELECT true, v_throttle_down, v_throttle_up, v_fup_name, v_usage_mb, v_fup_limit_mb;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0, 0, v_fup_name, v_usage_mb, v_fup_limit_mb;
  RETURN;
END;
$$;

-- ============================================================================
-- FUNCTION: fn_check_login_limit
-- Checks whether a user has exceeded their maximum concurrent session limit.
-- Sources the limit from WiFiUser.maxSessions or WiFiPlan.maxDevices.
-- Counts active sessions from radacct (acctstoptime IS NULL).
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   exceeded       — true if user has reached or exceeded the limit
--   current_count  — number of currently active sessions
--   max_allowed    — maximum allowed concurrent sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_login_limit(p_username text)
RETURNS TABLE(exceeded boolean, current_count int, max_allowed int)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_max_sessions INT;
  v_current_count INT;
BEGIN
  -- Get max sessions from WiFiUser.maxSessions or WiFiPlan.maxDevices
  SELECT COALESCE(wu."maxSessions", wp."maxDevices", 0)
  INTO v_max_sessions
  FROM "WiFiUser" wu
  LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active'
  LIMIT 1;

  -- If no limit set, allow
  IF v_max_sessions IS NULL OR v_max_sessions = 0 THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- Count current active sessions
  SELECT COUNT(*) INTO v_current_count
  FROM radacct
  WHERE username = p_username AND acctstoptime IS NULL;

  IF v_current_count >= v_max_sessions THEN
    RETURN QUERY SELECT true, v_current_count, v_max_sessions;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_current_count, v_max_sessions;
  RETURN;
END;
$$;

-- ============================================================================
-- TABLE: fup_switch_log
-- Audit log for FUP throttle switch-over events.
-- Every time a user's data usage exceeds their FUP limit, an entry is recorded
-- to track when the throttle was applied and what policy triggered it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fup_switch_log (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    fup_policy_name TEXT,
    usage_mb FLOAT DEFAULT 0,
    limit_mb FLOAT DEFAULT 0,
    throttle_down_kbps INT DEFAULT 0,
    throttle_up_kbps INT DEFAULT 0,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    property_id UUID
);
CREATE INDEX IF NOT EXISTS fup_switch_log_username_idx ON fup_switch_log(username);
CREATE INDEX IF NOT EXISTS fup_switch_log_triggered_idx ON fup_switch_log(triggered_at);

-- ============================================================================
-- VIEW: v_fup_switch_logs
-- Enriched view of FUP switch-over events.
-- Joins fup_switch_log with WiFiUser, Property, and WiFiPlan to provide
-- full context for each FUP throttle event.
-- ============================================================================
CREATE OR REPLACE VIEW v_fup_switch_logs AS
SELECT fsl.id::text,
    fsl.username,
    fsl.fup_policy_name,
    fsl.usage_mb,
    fsl.limit_mb,
    fsl.throttle_down_kbps,
    fsl.throttle_up_kbps,
    fsl.triggered_at,
    COALESCE(p.name, '') AS property_name,
    wu."planId",
    wp.name AS plan_name
FROM fup_switch_log fsl
LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
LEFT JOIN "Property" p ON p.id = fsl.property_id
LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
ORDER BY fsl.triggered_at DESC;

-- ============================================================================
-- VIEW: v_auth_logs (updated)
-- Authentication attempt log based on FreeRADIUS radpostauth table.
-- Joins with radacct (LATERAL) to pull the user's assigned client IP (framedipaddress).
-- Joins through WiFiUser → Guest → Booking → Room → Property → WiFiPlan to enrich context.
-- Now includes plan details (download/upload speed, data limit) and RADIUS group.
-- Dropped and recreated to allow column additions and reordering.
-- ============================================================================
DROP VIEW IF EXISTS v_auth_logs;
CREATE VIEW v_auth_logs AS
SELECT (pa.id)::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    COALESCE(
        REPLACE(acct."framedipaddress"::text, '/32', ''),
        ''::text
    ) AS client_ip_address,
    COALESCE(pa."nasIpAddress", ''::text) AS nas_ip_address,
    COALESCE(pa.callingstationid, ''::text) AS calling_station_id,
    COALESCE(pa.calledstationid, ''::text) AS called_station_id,
    'PAP'::text AS auth_type,
    CASE WHEN (pa.reply = 'Access-Accept'::text) THEN
        CASE WHEN COALESCE(REPLACE(acct."framedipaddress"::text, '/32', ''), ''::text) != ''::text
             THEN 'Authenticated — client IP: ' || REPLACE(acct."framedipaddress"::text, '/32', '')
        WHEN COALESCE(pa."nasIpAddress", ''::text) != ''::text
             THEN 'Authenticated from NAS ' || pa."nasIpAddress"
             ELSE 'Authenticated successfully'::text END
    ELSE
        CASE WHEN (wu.id IS NOT NULL) THEN 'Authentication rejected — invalid password'::text
             ELSE 'Authentication rejected — user not found'::text END
    END AS reply_message,
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(rm.number, ''::text) AS room_number,
    COALESCE(p.name, ''::text) AS property_name,
    COALESCE(u."propertyId"::text, '') AS property_id,
    rg.groupname AS radius_group,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit
   FROM radpostauth pa
     LEFT JOIN LATERAL (
         SELECT "framedipaddress"
         FROM radacct
         WHERE username = pa.username
         ORDER BY "acctstarttime" DESC
         LIMIT 1
     ) acct ON true
     LEFT JOIN "WiFiUser" u ON pa.username = u.username
     LEFT JOIN "WiFiUser" wu ON pa.username = wu.username
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
     LEFT JOIN radusergroup rg ON pa.username = rg.username;

COMMIT;
