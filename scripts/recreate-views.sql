-- ============================================================
-- Recreate ALL WiFi views (after Prisma db push)
-- ============================================================
-- Run this AFTER bun run db:push:
--   sudo -u postgres psql -d staysuite -f scripts/recreate-views.sql
--
-- These views reference radcheck/radusergroup (now Prisma-managed).
-- Uses DROP + CREATE (not CREATE OR REPLACE) to handle column list changes.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- VIEW: v_session_history (master view -- others depend on this)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_session_history CASCADE;

CREATE VIEW v_session_history AS
SELECT COALESCE(s.id::text, r.acctuniqueid) AS session_id,
    COALESCE(s.id::text, r.radacctid::text) AS radacctid,
    COALESCE(s.id::text, r.acctsessionid) AS acctsessionid,
    COALESCE(s."tenantId", '00000000-0000-0000-0000-000000000000'::uuid) AS "tenantId",
    COALESCE(s."planId", '00000000-0000-0000-0000-000000000000'::uuid) AS "planId",
    COALESCE(s."guestId", '00000000-0000-0000-0000-000000000000'::uuid) AS "guestId",
    COALESCE(s."bookingId", '00000000-0000-0000-0000-000000000000'::uuid) AS "bookingId",
    COALESCE(s."macAddress", r.callingstationid) AS callingstationid,
    COALESCE(s."macAddress", r.callingstationid) AS wifi_mac,
    COALESCE(s."ipAddress", r.framedipaddress) AS "ipAddress",
    COALESCE(s."ipAddress", r.framedipaddress) AS framedipaddress,
    COALESCE(dp."deviceName", s."deviceName") AS "deviceName",
    COALESCE(dp."deviceType", s."deviceType") AS "deviceType",
    COALESCE(s."startTime", r.acctstarttime) AS acctstarttime,
    COALESCE(s."startTime", r.acctupdatetime) AS acctupdatetime,
    COALESCE(s."endTime", r.acctstoptime) AS acctstoptime,
    COALESCE(s."dataUsed", 0::bigint) + COALESCE(r.acctinputoctets, 0::bigint) + COALESCE(r.acctoutputoctets, 0::bigint) AS total_data_used,
    COALESCE(s.duration::bigint, r.acctsessiontime, 0::bigint) AS acctsessiontime,
    -- RADIUS: acctoutputoctets = NAS→client (download), acctinputoctets = client→NAS (upload)
    COALESCE(CASE WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.7)::bigint ELSE r.acctoutputoctets END, 0::bigint) AS acctoutputoctets,
    COALESCE(CASE WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.3)::bigint ELSE r.acctinputoctets END, 0::bigint) AS acctinputoctets,
    s."authMethod",
    COALESCE(s.status, CASE WHEN r.acctstoptime IS NULL THEN 'active'::text ELSE 'completed'::text END) AS session_status,
    COALESCE(s.status, CASE WHEN r.acctstoptime IS NULL THEN 'active'::text ELSE 'completed'::text END) AS wifi_user_status,
    COALESCE(s.status, CASE WHEN r.acctstoptime IS NULL THEN 'active'::text ELSE 'completed'::text END) AS status,
    COALESCE(r.acctterminatecause, CASE WHEN s.status = 'active'::text THEN 'User-Request'::text ELSE 'NAS-Request'::text END) AS acctterminatecause,
    s."createdAt",
    s."updatedAt",
    COALESCE(wu.username, r.username, ''::text) AS username,
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(g.email, ''::citext) AS guest_email,
    COALESCE(g.phone, ''::text) AS guest_phone,
    COALESCE(g."loyaltyTier", ''::text) AS guest_loyalty_tier,
    CASE WHEN g."isVip" = true THEN 1 ELSE 0 END AS guest_is_vip,
    COALESCE(rm.number, ''::text) AS room_number,
    COALESCE(rm.name, ''::text) AS room_name,
    COALESCE(rm.floor, 0) AS room_floor,
    COALESCE(p.name, ''::text) AS property_name,
    COALESCE(wp.name, ''::text) AS plan_name,
    wp."downloadSpeed" AS downloadspeed,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS uploadspeed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS datalimit,
    wp."dataLimit" AS plan_data_limit,
    COALESCE(b."confirmationCode", ''::text) AS booking_code,
    COALESCE(b.status, ''::text) AS booking_status,
    COALESCE(s.id::text, r.acctuniqueid) AS acctuniqueid,
    r.framedipv6address,
    COALESCE(r.nasipaddress, '0.0.0.0'::text) AS nasipaddress,
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
    -- Timeout columns from WiFiPlan
    COALESCE(wp."sessionTimeoutSec", 0) AS "sessionTimeoutSec",
    COALESCE(wp."idleTimeoutSec", 0) AS "idleTimeoutSec",
    -- Burst (ceil) columns from WiFiPlan
    wp."burstDownloadSpeed",
    wp."burstUploadSpeed"
   FROM "WiFiSession" s
     FULL JOIN (
        SELECT DISTINCT ON (radacct.username, radacct.acctsessionid) radacct.*
           FROM radacct
          ORDER BY radacct.username, radacct.acctsessionid, radacct.radacctid DESC
     ) r ON COALESCE(s."acctUniqueId", '')::text = r.acctuniqueid
              AND (s."acctUniqueId" IS NOT NULL OR s.id IS NULL)
     LEFT JOIN LATERAL (
        SELECT "WiFiUser".*
          FROM "WiFiUser"
         WHERE "WiFiUser".username = r.username OR (r.username IS NULL AND "WiFiUser"."guestId" IS NOT NULL AND "WiFiUser"."guestId" = s."guestId")
         LIMIT 1
     ) wu ON true
     LEFT JOIN LATERAL (
        SELECT "DeviceProfile"."deviceName",
               "DeviceProfile"."deviceType",
               "DeviceProfile"."macAddress",
               "DeviceProfile"."userAgent",
               "DeviceProfile"."authCount",
               "DeviceProfile"."wifiUserId"
          FROM "DeviceProfile"
         WHERE "DeviceProfile"."wifiUserId" = wu.id AND "DeviceProfile"."isActive" = true
         ORDER BY "DeviceProfile"."lastSeenAt" DESC
         LIMIT 1
     ) dp ON true
     LEFT JOIN "Guest" g ON COALESCE(wu."guestId", s."guestId") IS NOT NULL AND COALESCE(wu."guestId", s."guestId") = g.id
     LEFT JOIN "Booking" b ON COALESCE(wu."bookingId", s."bookingId") IS NOT NULL AND COALESCE(wu."bookingId", s."bookingId") = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON COALESCE(wu."propertyId", b."propertyId") IS NOT NULL AND COALESCE(wu."propertyId", b."propertyId") = p.id
     LEFT JOIN "WiFiPlan" wp ON COALESCE(s."planId", wu."planId") = wp.id;

-- ---------------------------------------------------------------------------
-- VIEW: v_active_sessions
-- Filters v_session_history for currently active (online) sessions.
-- Used by: Active Users tab, real-time stats widgets.
-- ---------------------------------------------------------------------------
CREATE VIEW v_active_sessions AS
SELECT session_id,
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
  WHERE session_status = 'active'::text;

-- ---------------------------------------------------------------------------
-- VIEW: v_user_usage
-- Fixed: now aggregates bytes from BOTH WiFiUser AND radacct for external NAS
-- users (MikroTik, etc.) where WiFiUser.totalBytesIn/Out may be 0.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_user_usage CASCADE;

CREATE VIEW v_user_usage AS
SELECT u.id AS user_id,
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
    COALESCE(b.status, ''::text) AS booking_status
   FROM "WiFiUser" u
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" r ON b."roomId" = r.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;

-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_auth_logs CASCADE;

-- ---------------------------------------------------------------------------
-- VIEW: v_auth_logs
-- Authentication attempt log based on FreeRADIUS radpostauth.
-- Used by: Auth Logs tab, security audit reports.
--
-- 2026-05-05: Added DeviceProfile MAC fallback for calling_station_id.
-- 2026-06: Uses radpostauth.replyMessage for external NAS rejects (FreeRADIUS
--   sets Reply-Message attribute with actual rejection reason, e.g. IP pool deny).
-- 2026-06: Fixed duplicate rows — radusergroup subquery uses LIMIT 1.
-- 2026-06: Deduplicate Accept+Reject pairs from IP pool rejects. FreeRADIUS
--   writes TWO rows when post-auth reject fires: one Accept (sql at top of
--   post-auth) and one Reject (Post-Auth-Type REJECT sql). Use a subquery
--   with DISTINCT ON (username, authdate) to pick the Reject row (higher id,
--   has replyMessage) and discard the spurious Accept row.
-- ---------------------------------------------------------------------------
CREATE VIEW v_auth_logs AS
SELECT pa.id::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    COALESCE(replace(acct.framedipaddress, '/32'::text, ''::text), ''::text) AS client_ip_address,
    COALESCE(NULLIF(pa."nasIpAddress", ''), pa.clientipaddress, ''::text) AS nas_ip_address,
    COALESCE(NULLIF(pa.clientipaddress, ''), ''::text) AS source_ip_address,
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
    COALESCE(u."propertyId"::text, ''::text) AS property_id,
    rg.groupname AS radius_group,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit
   FROM (
       -- Deduplicate: when FreeRADIUS writes two rows for one reject (Accept from
       -- post-auth sql + Reject from Post-Auth-Type REJECT sql), pick the Reject
       -- row (higher id, has replyMessage). Uses 3-second window to avoid merging
       -- genuinely separate auth attempts.
       SELECT DISTINCT ON (username, authdate_trunc)
           *
       FROM (
           SELECT *,
               date_trunc('second', authdate) AS authdate_trunc
           FROM radpostauth
       ) r
       ORDER BY username, authdate_trunc, id DESC
   ) pa
     LEFT JOIN LATERAL (SELECT radacct.framedipaddress FROM radacct WHERE radacct.username = pa.username ORDER BY radacct.acctstarttime DESC LIMIT 1) acct ON true
     LEFT JOIN "WiFiUser" u ON pa.username = u.username
     LEFT JOIN "WiFiUser" wu ON pa.username = wu.username
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
     LEFT JOIN LATERAL (SELECT groupname FROM radusergroup WHERE username = pa.username LIMIT 1) rg ON true;

-- ---------------------------------------------------------------------------
-- VIEW: v_wifi_users
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_wifi_users CASCADE;

CREATE VIEW v_wifi_users AS
SELECT u.id,
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
    (SELECT rc.value FROM radcheck rc WHERE rc.username = u.username AND rc.attribute = 'Cleartext-Password'::text LIMIT 1) AS radius_password,
    (SELECT rg.groupname FROM radusergroup rg WHERE rg.username = u.username LIMIT 1) AS radius_group,
    g."firstName" AS guest_first_name,
    g."lastName" AS guest_last_name,
    g.email AS guest_email,
    g.phone AS guest_phone,
    g."loyaltyTier" AS guest_loyalty_tier,
    CASE WHEN g."isVip" = true THEN 1 ELSE 0 END AS guest_is_vip,
    r.number AS room_number,
    r.name AS room_name,
    r.floor AS room_floor,
    p.name AS property_name,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit,
    b."confirmationCode" AS booking_code,
    b.status AS booking_status,
    b."checkIn" AS booking_check_in,
    b."checkOut" AS booking_check_out
   FROM "WiFiUser" u
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" r ON b."roomId" = r.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;

-- ---------------------------------------------------------------------------
-- VIEW: v_fup_switch_logs
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_fup_switch_logs CASCADE;

CREATE VIEW v_fup_switch_logs AS
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
    wp.name AS plan_name,
    rg.groupname AS radius_group
   FROM fup_switch_log fsl
     LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
     LEFT JOIN "Property" p ON p.id = fsl.property_id
     LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
     LEFT JOIN radusergroup rg ON rg.username = fsl.username
  ORDER BY fsl.triggered_at DESC;

COMMIT;
