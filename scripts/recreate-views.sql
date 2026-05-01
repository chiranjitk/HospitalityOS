-- ============================================================
-- Recreate ALL WiFi views (after Prisma db push)
-- ============================================================
-- Run this AFTER bun run db:push:
--   sudo -u postgres psql -d staysuite -f scripts/recreate-views.sql
--
-- These views reference radcheck/radusergroup (now Prisma-managed).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- VIEW: v_session_history (master view -- others depend on this)
-- ---------------------------------------------------------------------------
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
    s."deviceName",
    s."deviceType",
    COALESCE(s."startTime", r.acctstarttime) AS acctstarttime,
    COALESCE(s."startTime", r.acctupdatetime) AS acctupdatetime,
    COALESCE(s."endTime", r.acctstoptime) AS acctstoptime,
    COALESCE(s."dataUsed", 0::bigint) + COALESCE(r.acctinputoctets, 0::bigint) + COALESCE(r.acctoutputoctets, 0::bigint) AS total_data_used,
    COALESCE(s.duration::bigint, r.acctsessiontime, 0::bigint) AS acctsessiontime,
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
    r.connectinfo_stop
   FROM "WiFiSession" s
     FULL JOIN (
        SELECT DISTINCT ON (radacct.username, radacct.acctsessionid) radacct.*
           FROM radacct
          ORDER BY radacct.username, radacct.acctsessionid, radacct.radacctid DESC
     ) r ON s.id::text = r.acctuniqueid
     LEFT JOIN LATERAL (
        SELECT "WiFiUser".*
          FROM "WiFiUser"
         WHERE "WiFiUser".username = r.username OR (r.username IS NULL AND "WiFiUser"."guestId" IS NOT NULL AND "WiFiUser"."guestId" = s."guestId")
         LIMIT 1
     ) wu ON true
     LEFT JOIN "Guest" g ON COALESCE(wu."guestId", s."guestId") IS NOT NULL AND COALESCE(wu."guestId", s."guestId") = g.id
     LEFT JOIN "Booking" b ON COALESCE(wu."bookingId", s."bookingId") IS NOT NULL AND COALESCE(wu."bookingId", s."bookingId") = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON COALESCE(wu."propertyId", b."propertyId") IS NOT NULL AND COALESCE(wu."propertyId", b."propertyId") = p.id
     LEFT JOIN "WiFiPlan" wp ON COALESCE(s."planId", wu."planId") = wp.id;

-- ---------------------------------------------------------------------------
-- VIEW: v_active_sessions
-- ---------------------------------------------------------------------------
CREATE VIEW v_active_sessions AS
SELECT *
   FROM v_session_history
  WHERE session_status = 'active'::text;

-- ---------------------------------------------------------------------------
-- VIEW: v_auth_logs
-- ---------------------------------------------------------------------------
CREATE VIEW v_auth_logs AS
SELECT pa.id::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    COALESCE(replace(acct.framedipaddress, '/32'::text, ''::text), ''::text) AS client_ip_address,
    COALESCE(pa."nasIpAddress", ''::text) AS nas_ip_address,
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
            WHEN wu.id IS NOT NULL THEN 'Authentication rejected — invalid password'::text
            ELSE 'Authentication rejected — user not found'::text
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
   FROM radpostauth pa
     LEFT JOIN LATERAL (SELECT radacct.framedipaddress FROM radacct WHERE radacct.username = pa.username ORDER BY radacct.acctstarttime DESC LIMIT 1) acct ON true
     LEFT JOIN "WiFiUser" u ON pa.username = u.username
     LEFT JOIN "WiFiUser" wu ON pa.username = wu.username
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" rm ON b."roomId" = rm.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
     LEFT JOIN radusergroup rg ON pa.username = rg.username;

-- ---------------------------------------------------------------------------
-- VIEW: v_user_usage
-- ---------------------------------------------------------------------------
CREATE VIEW v_user_usage AS
SELECT u.id AS user_id,
    u."tenantId",
    u."propertyId",
    u."guestId",
    u."bookingId",
    u.username,
    u."planId",
    u.status,
    u."totalBytesIn",
    u."totalBytesOut",
    u."totalBytesIn" + u."totalBytesOut" AS total_data_used,
    u."sessionCount" AS total_sessions,
    (SELECT count(*) FROM "WiFiSession" ws WHERE ws."guestId" = u."guestId" AND ws.status = 'active'::text) AS active_sessions,
    u."totalBytesOut" AS total_download_bytes,
    u."totalBytesIn" AS total_upload_bytes,
    COALESCE((SELECT sum(ws.duration) FROM "WiFiSession" ws WHERE ws."guestId" = u."guestId"), 0::bigint) AS total_session_time,
    u."lastAccountingAt" AS last_session_start,
    COALESCE((SELECT min(ws."startTime") FROM "WiFiSession" ws WHERE ws."guestId" = u."guestId"), '1970-01-01 00:00:00+00'::timestamptz) AS first_session_start,
    u."lastAccountingAt" AS "lastSeenAt",
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
-- VIEW: v_wifi_users
-- ---------------------------------------------------------------------------
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
