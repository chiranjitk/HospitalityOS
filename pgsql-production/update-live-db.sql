-- ============================================================================
-- StaySuite-HospitalityOS — Live Database Update Script
-- ============================================================================
-- Run this on an EXISTING database to apply all fixes from the latest release.
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks / conditional
-- UPDATEs).
--
-- PREREQUISITES:
--   - PostgreSQL 17+
--   - Database already exists with Prisma tables applied
--
-- DEPLOYMENT:
--   psql -d staysuite -f update-live-db.sql
--
-- CHANGES:
--   [1] radacct: added "loginType" text column (default 'portal')
--   [2] radreply: removed Mikrotik-* and Aruba-* vendor attrs (device IS the NAS gateway)
--   [3] radreply: fixed WISPr bandwidth values from Kbps to bps per RFC spec
--   [4] radgroupcheck: replaced Mikrotik attrs with Cryptsk VSA attrs
--   [5] radgroupcheck: added Cryptsk-Bandwidth-Max-Down/Up for all plan groups
--   [6] radgroupreply: fixed any remaining WISPr Kbps values
--   [7] RadiusNAS: only Cryptsk gateway should be active (127.0.0.1)
--   [8] v_session_history: updated with DeviceProfile LATERAL join + loginType
--   [9] v_active_sessions: recreated to include new columns
--   [10] RadPostAuth: added clientipaddress column if missing
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] Add loginType column to radacct
-- ============================================================================
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'radacct') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radacct' AND column_name = 'loginType'
        ) THEN
            ALTER TABLE radacct ADD COLUMN "loginType" text DEFAULT 'portal';
            RAISE NOTICE '[1] Added radacct."loginType" column';
        ELSE
            RAISE NOTICE '[1] radacct."loginType" column already exists, skipping';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- [2] Remove non-Cryptsk vendor attrs from radreply
--    Device IS the NAS gateway — no external Mikrotik or Aruba attrs needed.
-- ============================================================================
DO $$ DECLARE
    v_mikrotik_count INTEGER;
    v_aruba_count INTEGER;
BEGIN
    DELETE FROM radreply WHERE attribute LIKE 'Mikrotik-%';
    GET DIAGNOSTICS v_mikrotik_count = ROW_COUNT;

    DELETE FROM radreply WHERE attribute = 'Aruba-User-Role';
    GET DIAGNOSTICS v_aruba_count = ROW_COUNT;

    RAISE NOTICE '[2] Removed % Mikrotik + % Aruba rows from radreply', v_mikrotik_count, v_aruba_count;
END $$;

-- ============================================================================
-- [3] Fix WISPr bandwidth values (Kbps -> bps per WISPr RFC 5416)
--    WISPr-Bandwidth-Max-Down/Up values < 100000 are likely in Kbps.
--    Free plan:   5Mbps  ->  5000000
--    Basic plan:  10Mbps -> 10000000
--    Standard:    25Mbps -> 25000000
--    Premium:     50Mbps -> 50000000
--    VIP:         100Mbps-> 100000000
--    Conference:  30Mbps -> 30000000
-- ============================================================================

-- radreply: fix WISPr-Bandwidth-Max-Down (Kbps -> bps)
UPDATE radreply
SET value = CASE value::integer
    WHEN 5120  THEN '5000000'    -- 5Mbps
    WHEN 10240 THEN '10000000'   -- 10Mbps
    WHEN 25600 THEN '25000000'   -- 25Mbps
    WHEN 51200 THEN '50000000'   -- 50Mbps
    WHEN 102400 THEN '100000000' -- 100Mbps
    WHEN 30720 THEN '30000000'   -- 30Mbps
    ELSE value
END
WHERE attribute = 'WISPr-Bandwidth-Max-Down'
  AND value::integer < 100000;

-- radreply: fix WISPr-Bandwidth-Max-Up (Kbps -> bps)
UPDATE radreply
SET value = CASE value::integer
    WHEN 2048  THEN '2000000'    -- 2Mbps
    WHEN 5120  THEN '5000000'    -- 5Mbps
    WHEN 10240 THEN '10000000'   -- 10Mbps
    WHEN 25600 THEN '25000000'   -- 25Mbps
    WHEN 51200 THEN '50000000'   -- 50Mbps
    WHEN 15360 THEN '15000000'   -- 15Mbps
    ELSE value
END
WHERE attribute = 'WISPr-Bandwidth-Max-Up'
  AND value::integer < 100000;

-- radgroupreply: fix WISPr-Bandwidth-Max-Down (Kbps -> bps)
UPDATE radgroupreply
SET value = CASE value::integer
    WHEN 5120  THEN '5000000'
    WHEN 10240 THEN '10000000'
    WHEN 25600 THEN '25000000'
    WHEN 51200 THEN '50000000'
    WHEN 102400 THEN '100000000'
    WHEN 30720 THEN '30000000'
    ELSE value
END
WHERE attribute = 'WISPr-Bandwidth-Max-Down'
  AND value::integer < 100000;

-- radgroupreply: fix WISPr-Bandwidth-Max-Up (Kbps -> bps)
UPDATE radgroupreply
SET value = CASE value::integer
    WHEN 2048  THEN '2000000'
    WHEN 5120  THEN '5000000'
    WHEN 10240 THEN '10000000'
    WHEN 25600 THEN '25000000'
    WHEN 51200 THEN '50000000'
    WHEN 15360 THEN '15000000'
    ELSE value
END
WHERE attribute = 'WISPr-Bandwidth-Max-Up'
  AND value::integer < 100000;

-- ============================================================================
-- [4] Replace Mikrotik attrs in radgroupcheck with Cryptsk VSA equivalents
-- ============================================================================
UPDATE radgroupcheck SET attribute = 'Cryptsk-Rate-Limit' WHERE attribute = 'Mikrotik-Rate-Limit';
UPDATE radgroupcheck SET attribute = 'Cryptsk-Total-Limit' WHERE attribute = 'Mikrotik-Total-Limit';

-- ============================================================================
-- [5] Add Cryptsk-Bandwidth-Max-Down/Up to each plan group in radgroupcheck
--    Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
--    Priority values chosen to not conflict with existing entries.
-- ============================================================================

-- Helper: create a temp function to safely insert group attrs
CREATE OR REPLACE FUNCTION _tmp_insert_group_attr(
    p_group text, p_attr text, p_value text, p_priority integer
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO radgroupcheck (groupname, attribute, op, value, priority)
    VALUES (p_group, p_attr, ':=', p_value, p_priority)
    ON CONFLICT DO NOTHING;
END;
$$;

DO $$
BEGIN
    -- free_plan: 5M/2M
    PERFORM _tmp_insert_group_attr('free_plan', 'Cryptsk-Bandwidth-Max-Down', '5000000', 10);
    PERFORM _tmp_insert_group_attr('free_plan', 'Cryptsk-Bandwidth-Max-Up', '2000000', 11);

    -- basic_plan: 10M/5M
    PERFORM _tmp_insert_group_attr('basic_plan', 'Cryptsk-Bandwidth-Max-Down', '10000000', 10);
    PERFORM _tmp_insert_group_attr('basic_plan', 'Cryptsk-Bandwidth-Max-Up', '5000000', 11);

    -- standard_plan: 25M/10M
    PERFORM _tmp_insert_group_attr('standard_plan', 'Cryptsk-Bandwidth-Max-Down', '25000000', 10);
    PERFORM _tmp_insert_group_attr('standard_plan', 'Cryptsk-Bandwidth-Max-Up', '10000000', 11);

    -- premium_plan: 50M/25M
    PERFORM _tmp_insert_group_attr('premium_plan', 'Cryptsk-Bandwidth-Max-Down', '50000000', 10);
    PERFORM _tmp_insert_group_attr('premium_plan', 'Cryptsk-Bandwidth-Max-Up', '25000000', 11);

    -- vip_suite_plan: 100M/50M
    PERFORM _tmp_insert_group_attr('vip_suite_plan', 'Cryptsk-Bandwidth-Max-Down', '100000000', 10);
    PERFORM _tmp_insert_group_attr('vip_suite_plan', 'Cryptsk-Bandwidth-Max-Up', '50000000', 11);

    -- conference_plan: 30M/15M
    PERFORM _tmp_insert_group_attr('conference_plan', 'Cryptsk-Bandwidth-Max-Down', '30000000', 10);
    PERFORM _tmp_insert_group_attr('conference_plan', 'Cryptsk-Bandwidth-Max-Up', '15000000', 11);

    RAISE NOTICE '[5] Cryptsk-Bandwidth-Max-Down/Up ensured for all 6 plan groups';
END;
$$;

-- Clean up temp function
DROP FUNCTION IF EXISTS _tmp_insert_group_attr(text, text, text, integer);

-- ============================================================================
-- [6] Fix any remaining WISPr Kbps values in radgroupreply
--    (belt-and-suspenders — section [3] already covers this)
-- ============================================================================
-- (Already handled by section [3] above — no additional action needed)

-- ============================================================================
-- [7] RadiusNAS: only Cryptsk gateway should be active (127.0.0.1)
--    External NAS entries (Mikrotik, Aruba) kept for reference but disabled.
--    This device IS the NAS gateway — no external NAS needed.
-- ============================================================================
UPDATE "RadiusNAS"
SET status = 'disabled'
WHERE type NOT IN ('cryptsk') AND status = 'active';

-- ============================================================================
-- [8] Recreate v_session_history view
--    Now includes DeviceProfile LATERAL join for enriched device data:
--      - loginType (from radacct)
--      - userAgent (from DeviceProfile)
--      - dp_macAddress (from DeviceProfile)
--      - dp_authCount (from DeviceProfile)
--    deviceName/deviceType COALESCE DeviceProfile data over WiFiSession.
-- ============================================================================
DROP VIEW IF EXISTS v_active_sessions;
DROP VIEW IF EXISTS v_session_history;

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
    COALESCE(wp."sessionTimeout", 0) AS "sessionTimeoutSec",
    COALESCE(wp."idleTimeout", 0) AS "idleTimeoutSec",
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
          ORDER BY radacct.username, radacct.acctsessionid, radacct.radacctid DESC) r ON s.id::text = r.acctuniqueid
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
     LEFT JOIN "WiFiPlan" wp ON COALESCE(s."planId", wu."planId") = wp.id;

-- ============================================================================
-- [9] Recreate v_active_sessions view (includes new DeviceProfile columns)
-- ============================================================================
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

-- ============================================================================
-- [10] RadPostAuth: ensure clientipaddress column exists
-- ============================================================================
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'radpostauth') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'radpostauth' AND column_name = 'clientipaddress'
        ) THEN
            ALTER TABLE radpostauth ADD COLUMN "clientipaddress" text;
            RAISE NOTICE '[10] Added radpostauth."clientipaddress" column';
        ELSE
            RAISE NOTICE '[10] radpostauth."clientipaddress" column already exists, skipping';
        END IF;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Summary
-- ============================================================================
-- All updates applied successfully. Changes made:
--   [1]  radacct."loginType" column (if missing)
--   [2]  Removed Mikrotik-* and Aruba-User-Role from radreply
--   [3]  Fixed WISPr Kbps->bps values in radreply + radgroupreply
--   [4]  Renamed Mikrotik-* to Cryptsk-* in radgroupcheck
--   [5]  Added Cryptsk-Bandwidth-Max-Down/Up for all 6 plan groups
--   [6]  (Covered by [3])
--   [7]  Disabled non-Cryptsk RadiusNAS entries
--   [8]  v_session_history: DeviceProfile LATERAL join + loginType
--   [9]  v_active_sessions: includes new DeviceProfile columns
--   [10] radpostauth."clientipaddress" column (if missing)
-- ============================================================================
