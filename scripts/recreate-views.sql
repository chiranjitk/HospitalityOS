-- ============================================================
-- Recreate v_wifi_users view (pointing to new Prisma radcheck table)
-- ============================================================
-- Run this AFTER bun run db:push:
--   sudo -u postgres psql -d staysuite -f scripts/recreate-views.sql
-- ============================================================

BEGIN;

-- Recreate v_wifi_users view (now references new radcheck table created by Prisma)
CREATE OR REPLACE VIEW v_wifi_users AS
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
    b.status AS booking_status,
    b."checkIn" AS booking_check_in,
    b."checkOut" AS booking_check_out
   FROM "WiFiUser" u
     LEFT JOIN "Guest" g ON u."guestId" = g.id
     LEFT JOIN "Booking" b ON u."bookingId" = b.id
     LEFT JOIN "Room" r ON b."roomId" = r.id
     LEFT JOIN "Property" p ON u."propertyId" = p.id
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;

COMMIT;
