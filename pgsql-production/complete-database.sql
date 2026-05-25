-- ============================================================================
-- StaySuite-HospitalityOS — Single-Shot Database Setup
-- ============================================================================
-- ONE FILE: All tables, views, and functions for a fresh database setup.
--
-- WHAT THIS FILE CREATES:
--   1. citext extension
--   2. Helper tables (nas, nasreload, data_usage_by_period, fup_switch_log)
--   3. Ensures Prisma-added columns on FreeRADIUS/Prisma tables
--   4. 6 reporting views (v_session_history, v_active_sessions,
--      v_auth_logs, v_user_usage, v_wifi_users, v_fup_switch_logs)
--   5. 8 database functions (IP pool, FUP, bandwidth, login limit)
--
-- PREREQUISITES:
--   - PostgreSQL 17+
--   - Database created: CREATE DATABASE staysuite;
--   - Prisma schema pushed: bunx prisma db push
--
-- DEPLOYMENT (3 steps):
--   Step 1: prisma db push              -> Creates all ~231 Prisma-managed tables
--   Step 2: psql -f complete-database.sql -> Creates extensions, tables, views, functions
--   Step 3: bunx prisma db seed          -> Inserts ALL demo data
--
-- RULE: This file is STRUCTURE ONLY -- no seed data.
--       All demo data lives in prisma/seed.ts and prisma/wifi-seed.ts.
--
-- PRISMA-MANAGED TABLES (NOT in this file, created by `prisma db push`):
--   RadiusCoaLog, CoaSessionDetail, RadPostAuth (incl. clientipaddress),
--   RadiusEvent, RadiusEventUser, and all other Prisma models.
--
-- BUGS FIXED (audit history):
--   [1] v_session_history missed app-created sessions -> LATERAL join fix
--   [2] fup_switch_log & data_usage_by_period tables were missing -> added
--   [3] WiFiUser.totalBytesIn/Out were Int -> changed to BigInt (overflow at 2GB)
--   [4] WiFiSession.dataUsed was Int -> changed to BigInt
--   [5] fap-policies-list API referenced non-existent throttleDownKbps columns
--   [6] Nas model added to Prisma schema so prisma db push won't drop it
--   [7] v_user_usage had upload/download SWAPPED (totalBytesIn mapped as download)
--       Fixed: totalBytesOut -> total_download_bytes (Out=NAS->user=Download)
--       Fixed: totalBytesIn  -> total_upload_bytes   (In=user->NAS=Upload)
--   [8] radpostauth.clientipaddress column missing -> added (now in Prisma schema)
--   [9] FairAccessPolicy missing throttleDownKbps/throttleUpKbps -> added
--   [10] Booking API SOLD_OUT check blocked walk-in with specific roomId -> added !roomId guard
--   [11] fn_check_login_limit returned TABLE (3 cols) -> changed to integer (single val)
--       FreeRADIUS SQL module needs scalar return, not set-returning function
--       Returns: 0 = login allowed, 1 = limit exceeded
--   [12] RadiusCoaLog + CoaSessionDetail added to Prisma schema (CoA audit)
--       RadiusCoaLog: real CoA operation log (bandwidth, disconnect actions)
--       CoaSessionDetail: detailed before/after per-session CoA audit
--   [13] radacct.loginType column added (text, default 'portal')
--       Tracks whether session was created via portal login or auto-reauth
--   [14] v_session_history + v_active_sessions: added DeviceProfile LATERAL join
--       New columns: loginType, userAgent, dp_macAddress, dp_authCount
--       deviceName/deviceType now COALESCE DeviceProfile data over WiFiSession
--   [15] radreply/radgroupcheck: replaced Mikrotik-* attrs with Cryptsk VSA attrs
--       Cryptsk-Rate-Limit, Cryptsk-Total-Limit, Cryptsk-Bandwidth-Max-Down/Up
--   [16] v_session_history + v_active_sessions: added burst/ceil columns
--       burstDownloadSpeed, burstUploadSpeed from WiFiPlan
--   [17] WiFiPlanIPPool junction table for multi-pool plan mapping
--       Many-to-many: a plan can have multiple IP pools
--       fn_check_ip_pool updated: checks WiFiPlanIPPool before legacy ipPoolId
--       fn_get_user_pool_info updated: returns all pools for a plan
--       fn_get_pool_attr updated: prefers highest-priority pool from junction
--   [18] v_session_history + v_active_sessions: added property_id column
--       Derived from COALESCE(wu."propertyId", b."propertyId") for tenant filtering
--       Fixes: live-sessions-list API crashed on "property_id" IN (SELECT ...)
--       Also added guest_phone to v_user_usage for consistency with v_wifi_users
-- ============================================================================

SET client_encoding = 'UTF8';
SET timezone = 'UTC';

BEGIN;

-- ============================================================================
-- SECTION 1: Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- SECTION 2: Helper Tables (not managed by Prisma)
-- ============================================================================
-- nas: FreeRADIUS NAS client registry (MikroTik, Cisco, Aruba, Ubiquiti APs)
-- nasreload: FreeRADIUS NAS reload tracking
-- data_usage_by_period: Aggregated data usage per user per period
-- fup_switch_log: Fair Access Policy throttle/restore audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS nas (
    id              serial PRIMARY KEY,
    nasname         text NOT NULL,
    shortname       text NOT NULL,
    type            text NOT NULL DEFAULT 'other',
    ports           integer,
    secret          text NOT NULL,
    server          text,
    community       text,
    description     text
);
CREATE INDEX IF NOT EXISTS nas_nasname ON nas (nasname);

CREATE TABLE IF NOT EXISTS nasreload (
    "NASIPAddress"  inet PRIMARY KEY,
    "ReloadTime"    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS data_usage_by_period (
    username TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ,
    acctinputoctets BIGINT NOT NULL DEFAULT 0,
    acctoutputoctets BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (username, period_start)
);

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
-- SECTION 3: Ensure Prisma-added columns exist on FreeRADIUS tables
-- ============================================================================
-- NOTE: RadPostAuth columns (nasIpAddress, propertyId, clientipaddress, class)
-- are now defined in Prisma schema (prisma/schema.prisma model RadPostAuth).
-- They are created by `prisma db push`. This section kept as safety net
-- for direct-SQL deployments that skip Prisma.
-- ============================================================================
DO $$
BEGIN
    -- radacct: add loginType column (portal | auto_reauth)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'radacct') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radacct' AND column_name = 'loginType'
        ) THEN
            ALTER TABLE radacct ADD COLUMN "loginType" text DEFAULT 'portal';
        END IF;
    END IF;

    -- Only attempt ALTER TABLE if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'radpostauth') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radpostauth' AND column_name = 'nasIpAddress'
        ) THEN
            ALTER TABLE radpostauth ADD COLUMN "nasIpAddress" text;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radpostauth' AND column_name = 'propertyId'
        ) THEN
            ALTER TABLE radpostauth ADD COLUMN "propertyId" uuid;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radpostauth' AND column_name = 'clientipaddress'
        ) THEN
            ALTER TABLE radpostauth ADD COLUMN "clientipaddress" text;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radpostauth' AND column_name = 'replyMessage'
        ) THEN
            ALTER TABLE radpostauth ADD COLUMN "replyMessage" text;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- SECTION 3b: Ensure custom columns on Prisma-managed tables
-- ============================================================================
DO $$
BEGIN
    -- FairAccessPolicy: throttle columns (added for FUP switch-over bandwidth)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FairAccessPolicy') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'FairAccessPolicy' AND column_name = 'throttleDownKbps'
        ) THEN
            ALTER TABLE "FairAccessPolicy" ADD COLUMN "throttleDownKbps" integer DEFAULT 256;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'FairAccessPolicy' AND column_name = 'throttleUpKbps'
        ) THEN
            ALTER TABLE "FairAccessPolicy" ADD COLUMN "throttleUpKbps" integer DEFAULT 128;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- SECTION 4: Reporting Views (6 views)
-- ============================================================================
-- All dashboard tabs, reports, and real-time widgets read from these views.
-- Views depend on Prisma tables (WiFiSession, WiFiUser, Guest, Booking, etc.)
-- and FreeRADIUS tables (radacct, radpostauth, radcheck, radusergroup).
--
-- DROP ALL views first -- CREATE OR REPLACE VIEW cannot change column lists.
--
-- IMPORTANT: RADIUS byte convention
--   acctinputoctets  = bytes INTO NAS from client  = USER UPLOAD
--   acctoutputoctets = bytes OUT of NAS to client   = USER DOWNLOAD
--   WiFiUser.totalBytesIn  = UPLOAD (synced from acctinputoctets)
--   WiFiUser.totalBytesOut = DOWNLOAD (synced from acctoutputoctets)
-- ============================================================================

DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_fup_switch_logs CASCADE;
DROP VIEW IF EXISTS v_auth_logs CASCADE;
DROP VIEW IF EXISTS v_user_usage CASCADE;
DROP VIEW IF EXISTS v_wifi_users CASCADE;
DROP VIEW IF EXISTS v_session_history CASCADE;

-- ---------------------------------------------------------------------------
-- VIEW: v_session_history (master view -- others depend on this)
-- Performs FULL JOIN between Prisma WiFiSession and FreeRADIUS radacct,
-- then uses LATERAL join to resolve WiFiUser via radacct username OR
-- via WiFiSession.guestId (handles app-created sessions without RADIUS).
--
-- 2026-05-05: MAC fallback — callingstationid now uses 3-way COALESCE:
--   WiFiSession.macAddress → radacct.callingstationid → DeviceProfile.macAddress
--   This ensures MAC is always populated even when RADIUS doesn't provide it
--   (e.g., captive portal auth on WAN side without real NAS).
-- ---------------------------------------------------------------------------
CREATE VIEW v_session_history AS  SELECT COALESCE(s.id::text, r.acctuniqueid) AS session_id,
    COALESCE(s.id::text, r.radacctid::text) AS radacctid,
    COALESCE(s.id::text, r.acctsessionid) AS acctsessionid,
    COALESCE(s."tenantId", '00000000-0000-0000-0000-000000000000'::uuid) AS "tenantId",
    COALESCE(s."planId", '00000000-0000-0000-0000-000000000000'::uuid) AS "planId",
    COALESCE(s."guestId", '00000000-0000-0000-0000-000000000000'::uuid) AS "guestId",
    COALESCE(s."bookingId", '00000000-0000-0000-0000-000000000000'::uuid) AS "bookingId",
    COALESCE(s."macAddress", r.callingstationid, dp."macAddress") AS callingstationid,
    COALESCE(s."macAddress", r.callingstationid, dp."macAddress") AS wifi_mac,
    COALESCE(s."ipAddress", r.framedipaddress) AS "ipAddress",
    COALESCE(s."ipAddress", r.framedipaddress) AS framedipaddress,
    COALESCE(dp."deviceName", s."deviceName") AS "deviceName",
    COALESCE(dp."deviceType", s."deviceType") AS "deviceType",
    COALESCE(s."startTime", r.acctstarttime) AS acctstarttime,
    COALESCE(s."startTime", r.acctupdatetime) AS acctupdatetime,
    COALESCE(s."endTime", r.acctstoptime) AS acctstoptime,
    COALESCE(s."dataUsed", 0::bigint) + COALESCE(r.acctinputoctets, 0::bigint) + COALESCE(r.acctoutputoctets, 0::bigint) AS total_data_used,
    COALESCE(s.duration::bigint, r.acctsessiontime, 0::bigint) AS acctsessiontime,
    COALESCE(
        CASE
            WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.7)::bigint
            ELSE r.acctoutputoctets
        END, 0::bigint) AS acctoutputoctets,
    COALESCE(
        CASE
            WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.3)::bigint
            ELSE r.acctinputoctets
        END, 0::bigint) AS acctinputoctets,
    s."authMethod",
    COALESCE(s.status,
        CASE
            WHEN r.acctstoptime IS NULL THEN 'active'::text
            ELSE 'completed'::text
        END) AS session_status,
    COALESCE(s.status,
        CASE
            WHEN r.acctstoptime IS NULL THEN 'active'::text
            ELSE 'completed'::text
        END) AS wifi_user_status,
    COALESCE(s.status,
        CASE
            WHEN r.acctstoptime IS NULL THEN 'active'::text
            ELSE 'completed'::text
        END) AS status,
    COALESCE(r.acctterminatecause,
        CASE
            WHEN s.status = 'active'::text THEN 'User-Request'::text
            ELSE 'NAS-Request'::text
        END) AS acctterminatecause,
    s."createdAt",
    s."updatedAt",
    COALESCE(wu.username, r.username, ''::text) AS username,
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(g.email, ''::citext) AS guest_email,
    COALESCE(g.phone, ''::text) AS guest_phone,
    COALESCE(g."loyaltyTier", ''::text) AS guest_loyalty_tier,
        CASE
            WHEN g."isVip" = true THEN 1
            ELSE 0
        END AS guest_is_vip,
    COALESCE(rm.number, ''::text) AS room_number,
    COALESCE(rm.name, ''::text) AS room_name,
    COALESCE(rm.floor, 0) AS room_floor,
    COALESCE(p.name, ''::text) AS property_name,
    COALESCE(wu."propertyId", b."propertyId") AS property_id,
    COALESCE(wp.name, ''::text) AS plan_name,
    wp."downloadSpeed" AS downloadspeed,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS uploadspeed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS datalimit,
    wp."dataLimit" AS plan_data_limit,
    wp."sessionTimeoutSec",
    wp."idleTimeoutSec",
    COALESCE(b."confirmationCode", ''::text) AS booking_code,
    COALESCE(b.status::text, ''::text) AS booking_status,
    COALESCE(s.id::text, r.acctuniqueid) AS acctuniqueid,
    r.framedipv6address,
    COALESCE(r.nasipaddress, '127.0.0.1'::text) AS nasipaddress,
    ''::text AS nasidentifier,
    r.nasportid,
    COALESCE(r.nasporttype, 'Wireless-802.11'::text) AS nasporttype,
    COALESCE(r.calledstationid, ''::text) AS calledstationid,
    r.connectinfo_start,
    r.connectinfo_stop,
    -- DeviceProfile enrichment columns
    COALESCE(r."loginType", 'portal') AS "loginType",
    dp."userAgent" AS "userAgent",
    dp."macAddress" AS "dp_macAddress",
    COALESCE(dp."authCount", 0) AS "dp_authCount",
    -- Burst (ceil) columns from WiFiPlan
    wp."burstDownloadSpeed",
    wp."burstUploadSpeed"
   FROM "WiFiSession" s
     FULL JOIN ( SELECT DISTINCT ON (radacct.username, radacct.acctsessionid) radacct.radacctid,
            radacct.acctsessionid,
            radacct.acctuniqueid,
            radacct.username,
            radacct.realm,
            radacct.nasipaddress,
            radacct.nasportid,
            radacct.nasporttype,
            radacct.acctstarttime,
            radacct.acctupdatetime,
            radacct.acctstoptime,
            radacct.acctinterval,
            radacct.acctsessiontime,
            radacct.acctauthentic,
            radacct.connectinfo_start,
            radacct.connectinfo_stop,
            radacct.acctinputoctets,
            radacct.acctoutputoctets,
            radacct.acctinputgigawords,
            radacct.acctoutputgigawords,
            radacct.calledstationid,
            radacct.callingstationid,
            radacct.acctterminatecause,
            radacct.servicetype,
            radacct.framedprotocol,
            radacct.framedipaddress,
            radacct.framedipv6address,
            radacct.framedipv6prefix,
            radacct.framedinterfaceid,
            radacct.delegatedipv6prefix,
            radacct.acctinputpackets,
            radacct.acctoutputpackets,
            radacct.acctstatus,
            radacct."createdAt",
            radacct."updatedAt",
            radacct.class,
            radacct."loginType"
           FROM radacct
          ORDER BY radacct.username, radacct.acctsessionid, radacct.radacctid DESC) r ON COALESCE(s."acctUniqueId", '')::text = r.acctuniqueid
             AND (s."acctUniqueId" IS NOT NULL OR s.id IS NULL)
     LEFT JOIN LATERAL ( SELECT "WiFiUser".id,
            "WiFiUser"."tenantId",
            "WiFiUser"."propertyId",
            "WiFiUser".username,
            "WiFiUser".password,
            "WiFiUser"."guestId",
            "WiFiUser"."bookingId",
            "WiFiUser"."userType",
            "WiFiUser"."planId",
            "WiFiUser"."ipPoolId",
            "WiFiUser"."validFrom",
            "WiFiUser"."validUntil",
            "WiFiUser"."maxSessions",
            "WiFiUser"."sessionCount",
            "WiFiUser"."totalBytesIn",
            "WiFiUser"."totalBytesOut",
            "WiFiUser".status,
            "WiFiUser"."radiusSynced",
            "WiFiUser"."radiusSyncedAt",
            "WiFiUser"."lastAccountingAt",
            "WiFiUser"."createdAt",
            "WiFiUser"."updatedAt"
           FROM "WiFiUser"
          WHERE "WiFiUser".username = r.username OR r.username IS NULL AND "WiFiUser"."guestId" IS NOT NULL AND "WiFiUser"."guestId" = s."guestId"
         LIMIT 1) wu ON true
     LEFT JOIN LATERAL ( SELECT "DeviceProfile"."deviceName",
            "DeviceProfile"."deviceType",
            "DeviceProfile"."macAddress",
            "DeviceProfile"."userAgent",
            "DeviceProfile"."authCount",
            "DeviceProfile"."wifiUserId"
           FROM "DeviceProfile"
          WHERE "DeviceProfile"."wifiUserId" = wu.id AND "DeviceProfile"."isActive" = true
         ORDER BY "DeviceProfile"."lastSeenAt" DESC
         LIMIT 1) dp ON true
     LEFT JOIN "Guest" g ON COALESCE(wu."guestId", s."guestId") IS NOT NULL AND COALESCE(wu."guestId", s."guestId") = g.id
     LEFT JOIN "Booking" b ON COALESCE(wu."bookingId", s."bookingId") IS NOT NULL AND COALESCE(wu."bookingId", s."bookingId") = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON COALESCE(wu."propertyId", b."propertyId") IS NOT NULL AND COALESCE(wu."propertyId", b."propertyId") = p.id
     LEFT JOIN "WiFiPlan" wp ON COALESCE(s."planId", wu."planId") = wp.id;;

-- ---------------------------------------------------------------------------
-- VIEW: v_active_sessions
-- Filters v_session_history for currently active (online) sessions.
-- Used by: Active Users tab, real-time stats widgets.
-- Inherits MAC fallback from v_session_history (3-way COALESCE).
-- ---------------------------------------------------------------------------
CREATE VIEW v_active_sessions AS  SELECT session_id,
    radacctid,
    acctsessionid,
    "tenantId",
    "planId",
    "guestId",
    "bookingId",
    callingstationid,
    wifi_mac,
    "ipAddress",
    framedipaddress,
    "deviceName",
    "deviceType",
    acctstarttime,
    acctupdatetime,
    acctstoptime,
    total_data_used,
    acctsessiontime,
    acctoutputoctets,
    acctinputoctets,
    "authMethod",
    session_status,
    wifi_user_status,
    status,
    acctterminatecause,
    "createdAt",
    "updatedAt",
    username,
    guest_first_name,
    guest_last_name,
    guest_email,
    guest_phone,
    guest_loyalty_tier,
    guest_is_vip,
    room_number,
    room_name,
    room_floor,
    property_name,
    property_id,
    plan_name,
    downloadspeed,
    plan_download_speed,
    uploadspeed,
    plan_upload_speed,
    datalimit,
    plan_data_limit,
    booking_code,
    booking_status,
    acctuniqueid,
    framedipv6address,
    nasipaddress,
    nasidentifier,
    nasportid,
    nasporttype,
    calledstationid,
    connectinfo_start,
    connectinfo_stop,
    -- DeviceProfile enrichment columns (from v_session_history)
    "loginType",
    "userAgent",
    "dp_macAddress",
    "dp_authCount",
    -- Timeout columns from WiFiPlan
    "sessionTimeoutSec",
    "idleTimeoutSec",
    -- Burst (ceil) columns from WiFiPlan
    "burstDownloadSpeed",
    "burstUploadSpeed"
   FROM v_session_history
  WHERE session_status = 'active'::text;;

-- ---------------------------------------------------------------------------
-- VIEW: v_auth_logs
-- Authentication attempt log based on FreeRADIUS radpostauth.
-- Used by: Auth Logs tab, security audit reports.
--
-- 2026-05-05: Added DeviceProfile MAC fallback for calling_station_id.
-- 2026-06: Uses radpostauth.replyMessage for external NAS rejects.
-- 2026-06: Deduplicate Accept+Reject pairs from IP pool rejects via subquery
--   with DISTINCT ON (username, date_trunc('second', authdate)), ORDER BY id DESC
--   to pick the Reject row (higher id, has replyMessage).
-- ---------------------------------------------------------------------------
CREATE VIEW v_auth_logs AS
SELECT pa.id::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    COALESCE(replace(acct.framedipaddress, '/32'::text, ''::text), ''::text) AS client_ip_address,
    COALESCE(NULLIF(pa."nasIpAddress", ''), pa.clientipaddress, ''::text) AS nas_ip_address,
    COALESCE(NULLIF(pa.clientipaddress, ''), COALESCE(pa."nasIpAddress", ''::text), ''::text) AS source_ip_address,
    COALESCE(pa.callingstationid, ''::text) AS calling_station_id,
    COALESCE(pa.calledstationid, ''::text) AS called_station_id,
    'PAP'::text AS auth_type,
    CASE
        WHEN pa.reply = 'Access-Accept'::text THEN
        CASE
            WHEN COALESCE(replace(acct.framedipaddress, '/32'::text, ''::text), ''::text) <> ''::text THEN 'Authenticated — client IP: '::text || replace(acct.framedipaddress, '/32'::text, ''::text)
            WHEN COALESCE(pa."nasIpAddress", ''::text) <> ''::text THEN 'Authenticated from NAS '::text || pa."nasIpAddress"
            ELSE 'Authenticated successfully'::text
        END
        ELSE
        CASE
            WHEN pa."replyMessage" IS NOT NULL AND pa."replyMessage" != ''::text THEN
                'Rejected — '::text || pa."replyMessage" ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'IP_NOT_IN_POOL:%%'::text THEN
                'Rejected — IP not in managed pool: '::text || replace(pa.pass, 'IP_NOT_IN_POOL:'::text, ''::text) ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'IP_NOT_DETERMINED'::text THEN
                'Rejected — could not determine client IP'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'MAX_SESSION%%'::text THEN
                'Rejected — max concurrent sessions reached'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'RADIUS_UNREACHABLE'::text THEN
                'Rejected — RADIUS server unreachable'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'ACCOUNT_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'INVALID_%%'::text OR pa.pass LIKE 'MISSING_%%'::text OR pa.pass LIKE 'VOUCHER_%%'::text OR pa.pass LIKE 'AUTH_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN wu.id IS NOT NULL THEN
                'Rejected — invalid password'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            ELSE
                'Rejected — user not found'::text ||
                COALESCE(' — username: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
        END
    END AS reply_message,
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(rm.number, ''::text) AS room_number,
    COALESCE(p.name, ''::text) AS property_name,
    u."propertyId" AS property_id,
    rg.groupname AS radius_group,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit
   FROM (
       SELECT DISTINCT ON (username, authdate_trunc) *
       FROM (
           SELECT *, date_trunc('second', authdate) AS authdate_trunc FROM radpostauth
       ) r
       ORDER BY username, authdate_trunc, id DESC
   ) pa
     LEFT JOIN LATERAL ( SELECT radacct.framedipaddress FROM radacct WHERE radacct.username = pa.username ORDER BY radacct.acctstarttime DESC LIMIT 1) acct ON true
     LEFT JOIN "WiFiUser" u ON pa.username = u.username
     LEFT JOIN "WiFiUser" wu ON pa.username = wu.username
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
     LEFT JOIN LATERAL (SELECT groupname FROM radusergroup WHERE username = pa.username LIMIT 1) rg ON true;

-- ---------------------------------------------------------------------------
-- VIEW: v_user_usage
-- Fixed: now aggregates bytes from BOTH WiFiUser AND radacct for external NAS
-- users (MikroTik, etc.) where WiFiUser.totalBytesIn/Out may be 0.
-- ---------------------------------------------------------------------------
CREATE VIEW v_user_usage AS  SELECT u.id AS user_id,
    u."tenantId",
    u."propertyId",
    u."guestId",
    u."bookingId",
    u.username,
    u."planId",
    u.status,
    -- Bytes: prefer WiFiUser (local NAS), fallback to radacct (external NAS)
    COALESCE(u."totalBytesIn", 0::bigint) AS "totalBytesIn",
    COALESCE(u."totalBytesOut", 0::bigint) AS "totalBytesOut",
    GREATEST(
        COALESCE(u."totalBytesIn", 0::bigint) + COALESCE(u."totalBytesOut", 0::bigint),
        COALESCE((
            SELECT SUM(COALESCE(acct.acctinputoctets, 0) + COALESCE(acct.acctoutputoctets, 0))
            FROM radacct acct WHERE acct.username = u.username
        ), 0::bigint)
    ) AS total_data_used,
    -- Sessions: count from radacct (works for both local and external NAS)
    COALESCE((SELECT count(DISTINCT radacctid) FROM radacct sh WHERE sh.username = u.username), 0) AS total_sessions,
    COALESCE((SELECT count(DISTINCT radacctid) FROM radacct sh WHERE sh.username = u.username AND sh.acctstoptime IS NULL), 0) AS active_sessions,
    -- Download/Upload: prefer WiFiUser, fallback to radacct
    GREATEST(
        COALESCE(u."totalBytesOut", 0::bigint),
        COALESCE((SELECT SUM(COALESCE(acct.acctoutputoctets, 0)) FROM radacct acct WHERE acct.username = u.username), 0::bigint)
    ) AS total_download_bytes,
    GREATEST(
        COALESCE(u."totalBytesIn", 0::bigint),
        COALESCE((SELECT SUM(COALESCE(acct.acctinputoctets, 0)) FROM radacct acct WHERE acct.username = u.username), 0::bigint)
    ) AS total_upload_bytes,
    COALESCE((SELECT sum(acct.acctsessiontime) FROM radacct acct WHERE acct.username = u.username), 0::bigint) AS total_session_time,
    COALESCE((
        SELECT MAX(acct.acctstarttime) FROM radacct acct WHERE acct.username = u.username
    ), u."lastAccountingAt") AS last_session_start,
    COALESCE((
        SELECT MIN(acct.acctstarttime) FROM radacct acct WHERE acct.username = u.username
    ), '1970-01-01 00:00:00+00'::timestamptz) AS first_session_start,
    COALESCE((
        SELECT MAX(acct.acctupdatetime) FROM radacct acct WHERE acct.username = u.username
    ), u."lastAccountingAt") AS "lastSeenAt",
    u."createdAt",
    u."updatedAt",
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(g.email, ''::citext) AS guest_email,
    COALESCE(g.phone, ''::text) AS guest_phone,
    COALESCE(g."loyaltyTier", ''::text) AS guest_loyalty_tier,
    CASE WHEN g."isVip" = true THEN 1 ELSE 0 END AS guest_is_vip,
    COALESCE(r.number, ''::text) AS room_number,
    COALESCE(r.name, ''::text) AS room_name,
    COALESCE(p.name, ''::text) AS property_name,
    COALESCE(wp.name, ''::text) AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit,
    COALESCE(b."confirmationCode", ''::text) AS booking_code,
    COALESCE(b.status::text, ''::text) AS booking_status
   FROM "WiFiUser" u
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" r ON b."roomId" = r.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;;

-- ---------------------------------------------------------------------------
-- VIEW: v_wifi_users
-- Complete WiFi user profile with RADIUS credential bridging.
-- Used by: Users management tab, RADIUS sync, user provisioning.
-- ---------------------------------------------------------------------------
CREATE VIEW v_wifi_users AS  SELECT u.id,
    u."tenantId",
    u."propertyId",
    u."guestId",
    u."bookingId",
    u.username,
    u."planId",
    u.status,
    NULL::text AS "authMethod",
    NULL::text AS "macAddress",
    u."validFrom",
    u."validUntil",
    u."totalBytesIn",
    u."totalBytesOut",
    u."sessionCount",
    u."lastAccountingAt" AS "lastSeenAt",
    u."createdAt",
    u."updatedAt",
    ( SELECT rc.value
           FROM radcheck rc
          WHERE rc.username = u.username AND rc.attribute = 'Cleartext-Password'::text
         LIMIT 1) AS radius_password,
    ( SELECT rg.groupname
           FROM radusergroup rg
          WHERE rg.username = u.username
         LIMIT 1) AS radius_group,
    g."firstName" AS guest_first_name,
    g."lastName" AS guest_last_name,
    g.email AS guest_email,
    g.phone AS guest_phone,
    g."loyaltyTier" AS guest_loyalty_tier,
        CASE
            WHEN g."isVip" = true THEN 1
            ELSE 0
        END AS guest_is_vip,
    r.number AS room_number,
    r.name AS room_name,
    r.floor AS room_floor,
    p.name AS property_name,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit,
    b."confirmationCode" AS booking_code,
    b.status::text AS booking_status,
    b."checkIn" AS booking_check_in,
    b."checkOut" AS booking_check_out
   FROM "WiFiUser" u
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" r ON b."roomId" = r.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;;

-- ---------------------------------------------------------------------------
-- VIEW: v_fup_switch_logs
-- Fair Access Policy throttle/restore events with user/plan/property enrichment.
-- Used by: FUP dashboard, bandwidth reports, policy audit.
-- ---------------------------------------------------------------------------
CREATE VIEW v_fup_switch_logs AS  SELECT fsl.id::text AS id,
    fsl.username,
    fsl.fup_policy_name,
    fsl.usage_mb,
    fsl.limit_mb,
    fsl.throttle_down_kbps,
    fsl.throttle_up_kbps,
    fsl.triggered_at,
    COALESCE(p.name, ''::text) AS property_name,
    wu."planId",
    wp.name AS plan_name,
    rg.groupname AS radius_group
   FROM fup_switch_log fsl
     LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
     LEFT JOIN "Property" p ON p.id = fsl.property_id
     LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
     LEFT JOIN radusergroup rg ON rg.username = fsl.username
  ORDER BY fsl.triggered_at DESC;;


-- ============================================================================
-- SECTION 5: Database Functions (8 functions)
-- ============================================================================

-- fn_check_ip_pool (see after COMMIT for the function — it references WiFiPlanIPPool)

-- fn_get_user_pool_info (multi-pool aware)
CREATE OR REPLACE FUNCTION public.fn_get_user_pool_info(p_username text)
 RETURNS TABLE(pool_name text, pool_id uuid, is_override boolean, source text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_user_pool_id UUID;
    v_plan_id UUID;
    v_plan_name TEXT;
    v_mapped_count INT;
    v_plan_pool_id UUID;
BEGIN
    SELECT wu."ipPoolId", wu."planId"
    INTO v_user_pool_id, v_plan_id
    FROM "WiFiUser" wu
    WHERE wu.username = p_username LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
        SELECT wp."ipPoolId", wp.name INTO v_plan_pool_id, v_plan_name
        FROM "WiFiPlan" wp WHERE wp.id = v_plan_id LIMIT 1;
    END IF;

    -- Priority 1: User override
    IF v_user_pool_id IS NOT NULL THEN
        RETURN QUERY SELECT ip.name, ip.id, true::boolean, 'User Override'::TEXT
        FROM "IpPool" ip WHERE ip.id = v_user_pool_id;
        RETURN;
    END IF;

    -- No plan → return default pool
    IF v_plan_id IS NULL THEN
        RETURN QUERY SELECT ip.name, ip.id, false::boolean, 'Default Pool'::TEXT
        FROM "IpPool" ip WHERE ip."isDefault" = true AND ip.enabled = true LIMIT 1;
        RETURN;
    END IF;

    -- Priority 2: Multi-pool mappings
    SELECT COUNT(*) INTO v_mapped_count FROM "WiFiPlanIPPool" WHERE "planId" = v_plan_id;
    IF v_mapped_count > 0 THEN
        RETURN QUERY
        SELECT ip.name, ip.id, false::boolean, ('Plan: ' || v_plan_name || ' [multi-pool]')::TEXT
        FROM "WiFiPlanIPPool" pp
        JOIN "IpPool" ip ON ip.id = pp."poolId"
        WHERE pp."planId" = v_plan_id
        ORDER BY pp."priority" ASC, ip.name ASC;
        RETURN;
    END IF;

    -- Priority 3: Legacy single pool
    IF v_plan_pool_id IS NOT NULL THEN
        RETURN QUERY SELECT ip.name, ip.id, false::boolean, ('Plan: ' || v_plan_name)::TEXT
        FROM "IpPool" ip WHERE ip.id = v_plan_pool_id;
        RETURN;
    END IF;

    -- Priority 4: Default pool
    RETURN QUERY SELECT ip.name, ip.id, false::boolean, 'Default Pool'::TEXT
    FROM "IpPool" ip WHERE ip."isDefault" = true AND ip.enabled = true LIMIT 1;
END;
$function$
;

-- fn_get_pool_attr (multi-pool aware)
CREATE OR REPLACE FUNCTION public.fn_get_pool_attr(p_username text, p_attr text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_pool_id UUID;
    v_value TEXT;
    v_plan_id UUID;
    v_mapped_count INT;
BEGIN
    -- User-level override first
    SELECT wu."ipPoolId", wu."planId"
    INTO v_pool_id, v_plan_id
    FROM "WiFiUser" wu
    WHERE wu.username = p_username LIMIT 1;

    IF v_pool_id IS NOT NULL THEN
        NULL; -- use v_pool_id from user override
    ELSIF v_plan_id IS NOT NULL THEN
        -- Check multi-pool mappings first (highest priority pool)
        SELECT COUNT(*) INTO v_mapped_count FROM "WiFiPlanIPPool" WHERE "planId" = v_plan_id;
        IF v_mapped_count > 0 THEN
            SELECT pp."poolId" INTO v_pool_id
            FROM "WiFiPlanIPPool" pp
            WHERE pp."planId" = v_plan_id
            ORDER BY pp."priority" ASC LIMIT 1;
        ELSE
            -- Fall back to legacy single pool
            SELECT wp."ipPoolId" INTO v_pool_id
            FROM "WiFiPlan" wp WHERE wp.id = v_plan_id LIMIT 1;
        END IF;
    END IF;

    IF v_pool_id IS NULL THEN
        SELECT id INTO v_pool_id FROM "IpPool" WHERE "isDefault" = true AND enabled = true LIMIT 1;
    END IF;
    IF v_pool_id IS NULL THEN RETURN NULL; END IF;
    IF p_attr = 'pool_name' THEN
        SELECT name INTO v_value FROM "IpPool" WHERE id = v_pool_id;
    ELSIF p_attr = 'gateway' THEN
        SELECT host(gateway) INTO v_value FROM "IpPool" WHERE id = v_pool_id;
    END IF;
    RETURN v_value;
END;
$function$
;

-- fn_check_fup
CREATE OR REPLACE FUNCTION public.fn_check_fup(p_username text)
 RETURNS TABLE(fup_triggered boolean, throttle_down integer, throttle_up integer, policy_name text, usage_mb double precision, limit_mb double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  SELECT (COALESCE(wu."totalBytesIn", 0)::bigint + COALESCE(wu."totalBytesOut", 0)::bigint) / (1024.0 * 1024.0) INTO v_usage_mb
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
END; $function$
;

-- fn_check_login_limit
-- Returns integer: 0 = login allowed, 1 = limit exceeded
-- Uses scalar return (not TABLE) because FreeRADIUS SQL module expects single value.
CREATE OR REPLACE FUNCTION public.fn_check_login_limit(p_username text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE v_max_sessions INT; v_current_count INT;
BEGIN
  SELECT COALESCE(wu."maxSessions", wp."maxDevices", 0) INTO v_max_sessions
  FROM "WiFiUser" wu LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
  IF v_max_sessions IS NULL OR v_max_sessions = 0 THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_current_count FROM radacct WHERE username = p_username AND acctstoptime IS NULL;
  IF v_current_count >= v_max_sessions THEN RETURN 1; END IF;
  RETURN 0;
END; $function$
;

-- fn_get_effective_bandwidth
CREATE OR REPLACE FUNCTION public.fn_get_effective_bandwidth(p_username text, p_direction text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_plan_id UUID; v_download_speed INTEGER; v_upload_speed INTEGER;
    v_fup_id UUID; v_fup_cycle TEXT; v_fup_limit_mb DOUBLE PRECISION;
    v_throttle_down INTEGER; v_throttle_up INTEGER;
    v_cycle_start TIMESTAMPTZ; v_usage_bytes BIGINT; v_usage_mb DOUBLE PRECISION;
    v_plan_name TEXT; v_fup_name TEXT;
BEGIN
    SELECT wp.id, wp."downloadSpeed", wp."uploadSpeed", wp."fupPolicyId",
           fp."cycleType", fp."dataLimitMb", bp."downloadKbps", bp."uploadKbps",
           wp.name, fp.name
    INTO v_plan_id, v_download_speed, v_upload_speed, v_fup_id, v_fup_cycle, v_fup_limit_mb,
         v_throttle_down, v_throttle_up, v_plan_name, v_fup_name
    FROM "WiFiUser" wu JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    LEFT JOIN "FairAccessPolicy" fp ON wp."fupPolicyId" = fp.id AND fp."isEnabled" = true
    LEFT JOIN "BandwidthPolicy" bp ON fp."switchOverBwPolicyId" = bp.id
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
END; $function$
;

-- fn_get_mikrotik_rate_limit
CREATE OR REPLACE FUNCTION public.fn_get_mikrotik_rate_limit(p_username text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE v_down INTEGER; v_up INTEGER; v_plan_down INTEGER;
BEGIN
    v_down := fn_get_effective_bandwidth(p_username, 'down');
    v_up := fn_get_effective_bandwidth(p_username, 'up');
    SELECT wp."downloadSpeed" INTO v_plan_down
    FROM "WiFiUser" wu JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
    -- Mikrotik-Rate-Limit rx/tx: rx=upload(from client), tx=download(to client)
    IF v_plan_down IS NULL THEN RETURN v_up || 'K/' || v_down || 'K'; END IF;
    IF v_down < v_plan_down * 1000 THEN
        RETURN v_up || 'K/' || v_down || 'K';
    ELSE
        RETURN (v_up / 1000) || 'M/' || (v_down / 1000) || 'M';
    END IF;
END; $function$
;

-- fn_is_fup_throttled
CREATE OR REPLACE FUNCTION public.fn_is_fup_throttled(p_username text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
END; $function$
;


COMMIT;
-- fn_check_ip_pool (text, inet) — multi-pool aware
-- Returns 1 = IP allowed, 0 = IP rejected
-- Logic:
--   1. User-level override pool → check only that pool
--   2. Plan has mapped pools (WiFiPlanIPPool junction) → check those pools
--   3. Plan has legacy ipPoolId (single pool FK) → check that pool
--   4. Plan exists but NO pools mapped → check ALL enabled pools (any pool is OK)
--   5. No plan at all → allow (no restriction)
CREATE OR REPLACE FUNCTION public.fn_check_ip_pool(p_username text, p_ip inet)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_user_pool_id UUID;
    v_plan_id UUID;
    v_in_pool BOOLEAN;
    v_mapped_count INT;
    v_plan_pool_id UUID;
BEGIN
    -- Resolve user's pool override and plan
    SELECT wu."ipPoolId", wu."planId"
    INTO v_user_pool_id, v_plan_id
    FROM "WiFiUser" wu
    WHERE wu.username = p_username AND wu.status = 'active'
    LIMIT 1;

    -- Priority 1: User-level IP pool override
    IF v_user_pool_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM "IpPoolRange"
            WHERE "poolId" = v_user_pool_id AND p_ip >= "startIp" AND p_ip <= "endIp"
        ) INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;

    -- Priority 2: No plan at all → still check ALL enabled pools.
    -- IP must exist in at least one managed pool, otherwise reject.
    -- Priority 2: No plan at all → allow
    IF v_plan_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM "IpPoolRange" r
            JOIN "IpPool" p ON p.id = r."poolId"
            WHERE p.enabled = true AND p_ip >= r."startIp" AND p_ip <= r."endIp"
        ) INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;

    -- Priority 3: Plan has multi-pool mappings (WiFiPlanIPPool junction table)
    SELECT COUNT(*) INTO v_mapped_count
    FROM "WiFiPlanIPPool" WHERE "planId" = v_plan_id;

    IF v_mapped_count > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM "WiFiPlanIPPool" pp
            JOIN "IpPoolRange" r ON r."poolId" = pp."poolId"
            WHERE pp."planId" = v_plan_id AND p_ip >= r."startIp" AND p_ip <= r."endIp"
        ) INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;

    -- Priority 4: Plan has legacy single ipPoolId
    SELECT wp."ipPoolId" INTO v_plan_pool_id
    FROM "WiFiPlan" wp WHERE wp.id = v_plan_id LIMIT 1;

    IF v_plan_pool_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM "IpPoolRange"
            WHERE "poolId" = v_plan_pool_id AND p_ip >= "startIp" AND p_ip <= "endIp"
        ) INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;

    -- Priority 5: Plan exists but has NO pools → check ALL enabled pools
    -- IP must exist in at least one pool, otherwise reject
    SELECT EXISTS (
        SELECT 1 FROM "IpPoolRange" r
        JOIN "IpPool" p ON p.id = r."poolId"
        WHERE p.enabled = true AND p_ip >= r."startIp" AND p_ip <= r."endIp"
    ) INTO v_in_pool;
    IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
END;
$function$
;
-- DeviceProfile — Maps browser device fingerprint / storage token to WiFi user.
-- Enables silent re-authentication on captive portal (survives MAC randomization).
-- ============================================================================
CREATE TABLE IF NOT EXISTS "DeviceProfile" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"        UUID NOT NULL,
    "propertyId"      UUID NOT NULL,
    "wifiUserId"      UUID NOT NULL,
    "guestId"         UUID,
    "fingerprintHash" TEXT NOT NULL,
    "storageToken"    TEXT,
    "macAddress"      TEXT,
    "ipAddress"       TEXT,
    "userAgent"       TEXT,
    "deviceName"      TEXT,
    "deviceType"      TEXT,
    "fingerprintData" TEXT,
    "authCount"       INTEGER NOT NULL DEFAULT 0,
    "lastAuthAt"      TIMESTAMPTZ,
    "firstSeenAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastSeenAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeviceProfile_fingerprintHash_propertyId_key" UNIQUE ("fingerprintHash", "propertyId"),
    CONSTRAINT "DeviceProfile_storageToken_propertyId_key" UNIQUE ("storageToken", "propertyId")
);

CREATE INDEX IF NOT EXISTS "DeviceProfile_wifiUserId_idx" ON "DeviceProfile"("wifiUserId");
CREATE INDEX IF NOT EXISTS "DeviceProfile_guestId_idx" ON "DeviceProfile"("guestId");
CREATE INDEX IF NOT EXISTS "DeviceProfile_tenantId_propertyId_lastSeenAt_idx" ON "DeviceProfile"("tenantId", "propertyId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "DeviceProfile_isActive_idx" ON "DeviceProfile"("isActive");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceProfile_wifiUserId_fkey') THEN
        ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_wifiUserId_fkey" FOREIGN KEY ("wifiUserId") REFERENCES "WiFiUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceProfile_tenantId_fkey') THEN
        ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceProfile_propertyId_fkey') THEN
        ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceProfile_guestId_fkey') THEN
        ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
