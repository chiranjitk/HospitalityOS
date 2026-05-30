-- ============================================================================
-- Quick Fix: Recreate v_auth_logs view (property_id bug fix)
-- ============================================================================
-- Run this on production to restore Auth Logs immediately:
--   psql -d staysuite -f pgsql-production/fix-auth-logs-view.sql
--
-- BUG: The previous update-live-db.sql used COALESCE(u."propertyId"::text, ''::text)
-- which converts NULL to empty string ''. This broke the API's linked/orphan split:
--   - Linked query: WHERE property_id IS NOT NULL → TRUE (it's '') → but '' doesn't
--     match any Property.id UUID → 0 rows
--   - Orphan query: WHERE property_id IS NULL → FALSE (it's '') → 0 rows
-- Result: ALL logs disappeared.
--
-- FIX: Use u."propertyId" (native UUID, keeps NULL as NULL) so the API can
-- correctly split linked (property_id IS NOT NULL + matches Property) from
-- orphan (property_id IS NULL) entries.
--
-- Also includes: device name + MAC + room number in success auth message.
-- ============================================================================
DROP VIEW IF EXISTS v_auth_logs CASCADE;

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
            WHEN COALESCE(replace(acct.framedipaddress, '/32'::text, ''::text), ''::text) <> ''::text THEN
                'Authenticated — client IP: '::text || replace(acct.framedipaddress, '/32'::text, ''::text) ||
                COALESCE(' — device: '::text || dp."deviceName", ''::text) ||
                COALESCE(' — MAC: '::text || COALESCE(pa.callingstationid, dp."macAddress"), ''::text) ||
                COALESCE(' — room: '::text || rm.number, ''::text)
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
            WHEN pa.pass LIKE 'MAC_NOT_REGISTERED_FOR_USER'::text THEN
                'Rejected — MAC address not registered for this account'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text) ||
                COALESCE(' — MAC: '::text || pa.callingstationid, ''::text)
            WHEN pa.pass LIKE 'MAC_NOT_REGISTERED'::text THEN
                'Rejected — MAC address not in whitelist'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — MAC: '::text || pa.callingstationid, ''::text)
            WHEN pa.pass LIKE 'MAC_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text) ||
                COALESCE(' — MAC: '::text || pa.callingstationid, ''::text)
            WHEN pa.pass LIKE 'OTP_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'LDAP:%%'::text THEN
                'Rejected — LDAP auth failed: '::text || replace(pa.pass, 'LDAP:', ''::text) ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'LDAP_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'SOCIAL_%%'::text THEN
                'Rejected — '::text || lower(replace(pa.pass, '_'::text, ' '::text)) ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'RATE_LIMITED'::text THEN
                'Rejected — too many authentication attempts — try again later'::text ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'CONSENT_REQUIRED'::text THEN
                'Rejected — terms acceptance required'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text)
            WHEN pa.pass LIKE 'ROOM_NOT_FOUND'::text THEN
                'Rejected — no active guest found for this room'::text ||
                COALESCE(' — user: '::text || pa.username, ''::text) ||
                COALESCE(' — from: '::text || COALESCE(pa.clientipaddress, pa."nasIpAddress"), ''::text)
            WHEN pa.pass LIKE 'NO_PROPERTY'::text OR pa.pass LIKE 'CONFIG_ERROR'::text THEN
                'Rejected — portal configuration error — contact front desk'::text ||
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
     LEFT JOIN LATERAL (SELECT "deviceName", "macAddress" FROM "DeviceProfile" WHERE "wifiUserId" = u.id AND "isActive" = true ORDER BY "lastSeenAt" DESC LIMIT 1) dp ON true
     LEFT JOIN LATERAL (SELECT groupname FROM radusergroup WHERE username = pa.username LIMIT 1) rg ON true;

-- Verify the view was created
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_auth_logs') THEN
        RAISE NOTICE '✅ v_auth_logs view recreated successfully';
    ELSE
        RAISE NOTICE '❌ ERROR: v_auth_logs view was NOT created!';
    END IF;
END $$;
