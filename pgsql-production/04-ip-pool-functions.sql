-- ============================================================================
-- StaySuite-HospitalityOS — IP Pool Access Control Functions & Seed Data
-- ============================================================================
-- This file creates two PostgreSQL functions for IP pool-based access control
-- and seeds a default IP pool for the initial tenant.
--
-- Functions:
--   fn_check_ip_pool(p_username, p_ip)  → Returns 1 (allow) or 0 (deny)
--   fn_get_user_pool_info(p_username)   → Returns pool assignment details
--
-- Seed Data:
--   Default IP Pool "Default Pool" with 10.0.0.0/16 range for tenant-1
--
-- Dependencies:
--   - Prisma tables: "IpPool", "IpPoolRange", "WiFiUser", "WiFiPlan"
--   - Seed tenant UUID: 444017d5-e022-4c5f-ac07-ea0d51f4609b (uuid('tenant-1'))
--
-- Run AFTER: 02-staysuite-views.sql
-- Run AFTER: Prisma schema push (schema.prisma) + app seed
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION: fn_check_ip_pool
-- Determines whether a given IP address is allowed for a WiFi user.
-- Implements a priority chain: User Override > Plan Pool > Default Pool > Allow
--
-- Parameters:
--   p_username  — WiFiUser.username
--   p_ip        — IP address to check (inet type)
--
-- Returns:
--   1 = IP is allowed (in pool or no restriction configured)
--   0 = IP is denied (not in assigned pool)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_ip_pool(p_username text, p_ip inet)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_pool_id UUID;
    v_in_pool BOOLEAN;
BEGIN
    -- Get effective pool: user override > plan > default
    SELECT COALESCE(wu."ipPoolId", wp."ipPoolId")
    INTO v_pool_id
    FROM "WiFiUser" wu
    LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    WHERE wu.username = p_username
    AND wu.status = 'active'
    LIMIT 1;

    -- If no pool assigned to user or plan, check for default pool
    IF v_pool_id IS NULL THEN
        SELECT id INTO v_pool_id
        FROM "IpPool"
        WHERE "isDefault" = true
        AND enabled = true
        LIMIT 1;
    END IF;

    -- If no pool at all, allow (no restriction configured)
    IF v_pool_id IS NULL THEN
        RETURN 1;
    END IF;

    -- Check if IP is within any range of the pool
    SELECT EXISTS (
        SELECT 1 FROM "IpPoolRange"
        WHERE "poolId" = v_pool_id
        AND p_ip >= "startIp"
        AND p_ip <= "endIp"
    ) INTO v_in_pool;

    IF v_in_pool THEN
        RETURN 1; -- Allow
    ELSE
        RETURN 0; -- Deny
    END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION: fn_get_user_pool_info
-- Returns the IP pool assignment information for a given WiFi user.
-- Useful for debugging pool resolution and displaying pool info in the GUI.
--
-- Parameters:
--   p_username  — WiFiUser.username
--
-- Returns:
--   pool_name   — Human-readable pool name
--   pool_id     — UUID of the assigned pool (NULL if no default exists)
--   is_override — true if user has a direct pool override
--   source      — How the pool was assigned ('User Override', 'Plan: <name>',
--                 or 'Default Pool')
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_user_pool_info(p_username text)
 RETURNS TABLE(pool_name text, pool_id uuid, is_override boolean, source text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_user_pool_id UUID;
    v_plan_pool_id UUID;
    v_plan_name TEXT;
BEGIN
    SELECT wu."ipPoolId", wp."ipPoolId", wp.name
    INTO v_user_pool_id, v_plan_pool_id, v_plan_name
    FROM "WiFiUser" wu
    LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    WHERE wu.username = p_username
    LIMIT 1;

    -- User override takes priority
    IF v_user_pool_id IS NOT NULL THEN
        RETURN QUERY
        SELECT ip.name, ip.id, true::boolean, 'User Override'::TEXT
        FROM "IpPool" ip
        WHERE ip.id = v_user_pool_id;
    ELSIF v_plan_pool_id IS NOT NULL THEN
        RETURN QUERY
        SELECT ip.name, ip.id, false::boolean, ('Plan: ' || v_plan_name)::TEXT
        FROM "IpPool" ip
        WHERE ip.id = v_plan_pool_id;
    ELSE
        RETURN QUERY
        SELECT ip.name, ip.id, false::boolean, 'Default Pool'::TEXT
        FROM "IpPool" ip
        WHERE ip."isDefault" = true
        LIMIT 1;
    END IF;
    RETURN;
END;
$function$;

-- ============================================================================
-- FUNCTION: fn_get_pool_attr
-- Returns a specific attribute (gateway or dns) from the user's effective
-- IP pool. Used by FreeRADIUS to push gateway and DNS via RADIUS reply.
--
-- Parameters:
--   p_username  — WiFiUser.username
--   p_attr      — 'gateway' or 'dns'
--
-- Returns:
--   text value of the requested attribute (gateway as clean IP, dns as
--   comma-separated string), or NULL if no pool assigned
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_get_pool_attr(p_username text, p_attr text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_pool_id UUID;
    v_value TEXT;
BEGIN
    SELECT COALESCE(wu."ipPoolId", wp."ipPoolId")
    INTO v_pool_id
    FROM "WiFiUser" wu
    LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
    WHERE wu.username = p_username
    LIMIT 1;

    IF v_pool_id IS NULL THEN
        SELECT id INTO v_pool_id FROM "IpPool" WHERE "isDefault" = true AND enabled = true LIMIT 1;
    END IF;

    IF v_pool_id IS NULL THEN RETURN NULL; END IF;

    IF p_attr = 'gateway' THEN
        SELECT host(gateway) INTO v_value FROM "IpPool" WHERE id = v_pool_id;
    ELSIF p_attr = 'dns' THEN
        SELECT "dnsServers" INTO v_value FROM "IpPool" WHERE id = v_pool_id;
    END IF;

    RETURN v_value;
END;
$function$;

-- ============================================================================
-- SEED: Default IP Pool
-- Creates a default IP pool for tenant-1 if it doesn't already exist.
-- Uses fixed UUIDs matching the existing production database.
--
-- Pool:     Default Pool (10.0.0.0/16, gateway 10.0.0.1)
-- Range:    10.0.0.1 – 10.0.255.254 (65,534 usable IPs)
-- DNS:      8.8.8.8, 8.8.4.4 (Google Public DNS)
-- ============================================================================
DO $$
BEGIN
    -- Insert default pool (idempotent: ON CONFLICT on unique [tenantId, name])
    INSERT INTO "IpPool" (
        id,
        "tenantId",
        name,
        description,
        gateway,
        "dnsServers",
        subnet,
        "isDefault",
        enabled,
        "createdAt",
        "updatedAt"
    ) VALUES (
        'f8d31515-5146-4a8b-b6da-3052fdd6a924'::uuid,
        '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid,
        'Default Pool',
        'Default IP pool — 10.0.0.0/16 private subnet for guest WiFi',
        '10.0.0.1'::inet,
        '8.8.8.8,8.8.4.4',
        '10.0.0.0/16'::inet,
        true,
        true,
        now(),
        now()
    )
    ON CONFLICT ("tenantId", name) DO NOTHING;

    -- Insert default pool range (idempotent: ON CONFLICT on primary key id)
    INSERT INTO "IpPoolRange" (
        id,
        "poolId",
        "startIp",
        "endIp",
        comment,
        "createdAt"
    ) VALUES (
        'e9d4f4c9-ff3a-4f42-960f-62367fdb31a6'::uuid,
        'f8d31515-5146-4a8b-b6da-3052fdd6a924'::uuid,
        '10.0.0.1'::inet,
        '10.0.255.254'::inet,
        'Default pool full range — 65,534 usable IPs',
        now()
    )
    ON CONFLICT (id) DO NOTHING;
END
$$;

COMMIT;
