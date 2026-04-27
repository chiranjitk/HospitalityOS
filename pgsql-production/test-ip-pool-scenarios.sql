-- ============================================================================
-- StaySuite-HospitalityOS — Comprehensive IP Pool + Mixed Scenario Test
-- ============================================================================
-- Adds IP pools, ranges, and 12+ test scenarios to existing 40-user test.
--
-- SCENARIOS COVERED:
--   A. Wrong password (Access-Reject) — 5 new failed auth attempts
--   B. IP pool restriction — users assigned IP outside their pool range
--   C. Max login limit — users with concurrent session limit exceeded
--   D. FUP throttle — more edge cases for Fair Usage Policy
--   E. User-level IP pool override — user gets different pool than plan
--   F. Disabled user trying to auth
--   G. Expired user trying to auth
--   H. Unknown user (no WiFiUser entry)
--   I. Successful auth with correct pool + correct IP
--   J. Radacct session with IP outside ANY pool (should be flagged)
-- ============================================================================

SET timezone = 'UTC';

\echo '========================================='
\echo ' PHASE 1: Create IP Pools + Ranges'
\echo '========================================='

-- ============================================================================
-- 5 IP POOLS + 1 BLOCKED pool + 1 DEFAULT pool
-- ============================================================================
INSERT INTO "IpPool" (id, "tenantId", "propertyId", name, description, gateway, subnet, "isDefault", enabled, "createdAt", "updatedAt") VALUES
-- Pool 1: Lobby WiFi (Mikrotik AP) — 10.10.1.0/24
('b1000001-0001-0001-0001-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Lobby WiFi Pool', 'Mikrotik hAP ac3 — Lobby & Reception area', '10.10.1.1', '10.10.1.0/24',
 false, true, NOW(), NOW()),

-- Pool 2: Floor 3 WiFi (Cisco WLC) — 10.10.2.0/24
('b1000001-0001-0001-0001-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Floor 3 WiFi Pool', 'Cisco Catalyst 9800 — Floor 3 rooms', '10.10.2.1', '10.10.2.0/24',
 false, true, NOW(), NOW()),

-- Pool 3: Pool Area WiFi (Aruba) — 10.10.3.0/24
('b1000001-0001-0001-0001-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Pool Area WiFi Pool', 'Aruba AP-535 — Pool & Garden', '10.10.3.1', '10.10.3.0/24',
 false, true, NOW(), NOW()),

-- Pool 4: Roof Top WiFi (Ubiquiti) — 10.10.4.0/24
('b1000001-0001-0001-0001-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Roof Top WiFi Pool', 'Ubiquiti U6-Pro — Roof Top Restaurant', '10.10.4.1', '10.10.4.0/24',
 false, true, NOW(), NOW()),

-- Pool 5: Conference Room — 10.10.5.0/24 (smaller range)
('b1000001-0001-0001-0001-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Conference WiFi Pool', 'Conference Room — Restricted IP range', '10.10.5.1', '10.10.5.0/28',
 false, true, NOW(), NOW()),

-- Pool 6: Blocked IPs — 10.99.0.0/24 ( IPs that should never be assigned)
('b1000001-0001-0001-0001-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Blocked IPs', 'Blacklisted IP range — should reject', '10.99.0.1', '10.99.0.0/24',
 false, false, NOW(), NOW()),

-- Pool 7: DEFAULT fallback pool — 10.10.0.0/16 (catch-all)
('b1000001-0001-0001-0001-000000000007', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd',
 'Default Guest Pool', 'Default catch-all pool for unassigned users', '10.10.0.1', '10.10.0.0/16',
 true, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- IP RANGES (each pool gets ranges with gaps to simulate real allocation)
-- ============================================================================
INSERT INTO "IpPoolRange" (id, "poolId", "startIp", "endIp", comment, "createdAt") VALUES
-- Pool 1: Lobby — 10.10.1.100-150
('c1000001-0001-0001-0001-000000000001', 'b1000001-0001-0001-0001-000000000001', '10.10.1.100', '10.10.1.150', 'Lobby DHCP range', NOW()),

-- Pool 2: Floor 3 — 10.10.2.100-160
('c1000001-0001-0001-0001-000000000002', 'b1000001-0001-0001-0001-000000000002', '10.10.2.100', '10.10.2.160', 'Floor 3 DHCP range', NOW()),

-- Pool 3: Pool Area — 10.10.3.100-140
('c1000001-0001-0001-0001-000000000003', 'b1000001-0001-0001-0001-000000000003', '10.10.3.100', '10.10.3.140', 'Pool area DHCP range', NOW()),

-- Pool 4: Roof Top — 10.10.4.100-150
('c1000001-0001-0001-0001-000000000004', 'b1000001-0001-0001-0001-000000000004', '10.10.4.100', '10.10.4.150', 'Roof top DHCP range', NOW()),

-- Pool 5: Conference — 10.10.5.1-14 (very small)
('c1000001-0001-0001-0001-000000000005', 'b1000001-0001-0001-0001-000000000005', '10.10.5.1', '10.10.5.14', 'Conference restricted range', NOW()),

-- Pool 6: Blocked — no valid ranges (pool is disabled anyway)

-- Pool 7: Default — 10.10.0.100-10.10.255.254
('c1000001-0001-0001-0001-000000000007', 'b1000001-0001-0001-0001-000000000007', '10.10.0.100', '10.10.255.254', 'Default catch-all range', NOW())
ON CONFLICT DO NOTHING;


\echo ''
\echo '========================================='
\echo ' PHASE 2: Assign Pools to Plans + Users'
\echo '========================================='

-- ============================================================================
-- Assign IP pools to WiFiPlans
-- ============================================================================
-- Free WiFi → Lobby Pool (Pool 1)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000001' WHERE name = 'Free WiFi';

-- Basic Plan → Floor 3 Pool (Pool 2)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000002' WHERE name = 'Basic Plan';

-- Standard Plan → Pool Area Pool (Pool 3)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000003' WHERE name = 'Standard Plan';

-- Premium Plan → Roof Top Pool (Pool 4)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000004' WHERE name = 'Premium Plan';

-- Conference Plan → Conference Pool (Pool 5)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000005' WHERE name = 'Conference Plan';

-- VIP Suite → Default Pool (Pool 7, isDefault=true)
UPDATE "WiFiPlan" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000007' WHERE name = 'VIP Suite Plan';

-- ============================================================================
-- USER-LEVEL POOL OVERRIDES (Scenario E)
-- User gets a different pool than their plan
-- ============================================================================
-- guest.sanjay.kumar (Free WiFi plan → Pool 1) override to Conference Pool (Pool 5)
UPDATE "WiFiUser" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000005'
WHERE username = 'guest.sanjay.kumar';

-- guest.deepa.sharma (Free WiFi plan → Pool 1) override to Roof Top Pool (Pool 4)
UPDATE "WiFiUser" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000004'
WHERE username = 'guest.deepa.sharma';

-- guest.kavita.jain (Free WiFi plan → Pool 1) override to Default Pool (Pool 7)
UPDATE "WiFiUser" SET "ipPoolId" = 'b1000001-0001-0001-0001-000000000007'
WHERE username = 'guest.kavita.jain';


\echo ''
\echo '========================================='
\echo ' PHASE 3: Max Login Limit Setup (Scenario C)'
\echo '========================================='

-- ============================================================================
-- Set maxSessions to 1 for 5 users, then create multiple active radacct sessions
-- to simulate concurrent login violation
-- ============================================================================

-- guest.swati.mukherjee (Basic, maxSessions=1) — already has 1 active session + 1 completed
-- We add 2 more active sessions to simulate limit exceeded
UPDATE "WiFiUser" SET "maxSessions" = 1 WHERE username = 'guest.swati.mukherjee';

INSERT INTO radacct (radacctid, acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype,
    acctstarttime, acctupdatetime, acctstoptime, acctsessiontime, acctauthentic,
    connectinfo_start, connectinfo_stop, acctinputoctets, acctoutputoctets,
    calledstationid, callingstationid, acctterminatecause, framedipaddress, "createdAt", "updatedAt")
VALUES
-- 2 extra active sessions for swati (exceeds maxSessions=1)
(5001, '50000001-guest.swati.mukherjee-2nd', '50000001', 'guest.swati.mukherjee', '', '192.168.20.1', '0', 'Wireless-802.11',
    NOW() - interval '3 hours', NOW() - interval '5 minutes', NULL, 10800, 'RADIUS',
    NULL, NULL, 524288000, 262144000, 'AA:BB:CC:DD:EE:03', 'AA:BB:CC:DD:EE:13', NULL, '10.10.2.201', NOW(), NOW()),

(5002, '50000002-guest.swati.mukherjee-3rd', '50000002', 'guest.swati.mukherjee', '', '192.168.20.1', '0', 'Wireless-802.11',
    NOW() - interval '1 hour', NOW() - interval '2 minutes', NULL, 3600, 'RADIUS',
    NULL, NULL, 104857600, 52428800, 'AA:BB:CC:DD:EE:04', 'AA:BB:CC:DD:EE:14', NULL, '10.10.2.202', NOW(), NOW()),

-- guest.nisha.goyal (Premium, maxSessions=1) — add 2 extra active sessions
(5003, '50000003-guest.nisha.goyal-2nd', '50000003', 'guest.nisha.goyal', '', '192.168.40.1', '0', 'Wireless-802.11',
    NOW() - interval '2 hours', NOW() - interval '10 minutes', NULL, 7200, 'RADIUS',
    NULL, NULL, 3221225472, 1932735283, 'AA:BB:CC:DD:EE:05', 'AA:BB:CC:DD:EE:15', NULL, '10.10.4.201', NOW(), NOW()),

(5004, '50000004-guest.nisha.goyal-3rd', '50000004', 'guest.nisha.goyal', '', '192.168.40.1', '0', 'Wireless-802.11',
    NOW() - interval '30 minutes', NOW() - interval '1 minute', NULL, 1800, 'RADIUS',
    NULL, NULL, 524288000, 314572800, 'AA:BB:CC:DD:EE:06', 'AA:BB:CC:DD:EE:16', NULL, '10.10.4.202', NOW(), NOW()),

-- guest.madhuri.sinha (Standard, maxSessions=1) — add 1 extra active session
(5005, '50000005-guest.madhuri.sinha-2nd', '50000005', 'guest.madhuri.sinha', '', '192.168.30.1', '0', 'Wireless-802.11',
    NOW() - interval '4 hours', NOW() - interval '15 minutes', NULL, 14400, 'RADIUS',
    NULL, NULL, 1073741824, 644245094, 'AA:BB:CC:DD:EE:07', 'AA:BB:CC:DD:EE:17', NULL, '10.10.3.201', NOW(), NOW());

-- Reject entries for max login limit exceeded
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.swati.mukherjee', 'wrongpass123', 'Access-Reject', 'AA:BB:CC:DD:EE:03', 'AA:BB:CC:DD:EE:13', NOW() - interval '5 minutes', '192.168.20.1', NOW(), NOW()),
('guest.swati.mukherjee', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:04', 'AA:BB:CC:DD:EE:14', NOW() - interval '2 minutes', '192.168.20.1', NOW(), NOW()),
('guest.nisha.goyal', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:05', 'AA:BB:CC:DD:EE:15', NOW() - interval '10 minutes', '192.168.40.1', NOW(), NOW()),
('guest.madhuri.sinha', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:07', 'AA:BB:CC:DD:EE:17', NOW() - interval '15 minutes', '192.168.30.1', NOW(), NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 4: Wrong Password Attempts (Scenario A)'
\echo '========================================='

-- ============================================================================
-- 5 new wrong password attempts (Access-Reject) for various users
-- ============================================================================
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
-- Wrong password for existing user (1)
('guest.priya.bhatt', 'WRONG_P@ss!', 'Access-Reject', 'AA:BB:CC:DD:EE:10', 'AA:BB:CC:DD:EE:20', NOW() - interval '8 minutes', '192.168.20.1', NOW(), NOW()),

-- Wrong password for existing user (2)
('guest.rohan.khanna', 'invalid_password', 'Access-Reject', 'AA:BB:CC:DD:EE:11', 'AA:BB:CC:DD:EE:21', NOW() - interval '7 minutes', '192.168.40.1', NOW(), NOW()),

-- Wrong password for existing user (3)
('guest.anjali.deshmukh', 'Password123!', 'Access-Reject', 'AA:BB:CC:DD:EE:12', 'AA:BB:CC:DD:EE:22', NOW() - interval '6 minutes', '192.168.20.1', NOW(), NOW()),

-- Multiple failed attempts from same device (brute force)
('guest.priya.bhatt', 'p@ssw0rd', 'Access-Reject', 'AA:BB:CC:DD:EE:10', 'AA:BB:CC:DD:EE:20', NOW() - interval '5 minutes', '192.168.20.1', NOW(), NOW()),

-- Wrong password + then correct (recovery)
-- First the reject, then successful auth below in Phase 5
('guest.divya.chopra', 'WrongOne!', 'Access-Reject', 'AA:BB:CC:DD:EE:13', 'AA:BB:CC:DD:EE:23', NOW() - interval '3 minutes', '192.168.40.1', NOW(), NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 5: IP Pool Restriction Violations (Scenario B)'
\echo '========================================='

-- ============================================================================
-- Create radacct sessions where user has IP from WRONG pool
-- These simulate NAS assigning an IP that doesn't match user's pool
-- ============================================================================

-- guest.sanjay.kumar has override to Conference Pool (10.10.5.x) but got 10.10.1.108 (Lobby range)
-- fn_check_ip_pool should return 0 (IP not allowed)
-- Radacct already has this session with 10.10.1.101 — update to a clear out-of-pool IP
UPDATE radacct SET "framedipaddress" = '10.10.1.108'
WHERE username = 'guest.sanjay.kumar' AND acctstoptime IS NULL;

-- guest.deepa.sharma override to Roof Top Pool (10.10.4.x) but got 10.10.1.102 (Lobby range)
UPDATE radacct SET "framedipaddress" = '10.10.1.102'
WHERE username = 'guest.deepa.sharma' AND acctstoptime IS NULL;

-- New session: guest.kavita.jain (override to Default Pool) but got 10.10.5.20 (Conference range — valid in default 10.10.0.0/16)
-- This should PASS (default pool covers 10.10.0.0/16)
INSERT INTO radacct (radacctid, acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype,
    acctstarttime, acctupdatetime, acctstoptime, acctsessiontime, acctauthentic,
    connectinfo_start, connectinfo_stop, acctinputoctets, acctoutputoctets,
    calledstationid, callingstationid, acctterminatecause, framedipaddress, "createdAt", "updatedAt")
VALUES
(5006, '50000006-guest.kavita.jain-conf', '50000006', 'guest.kavita.jain', '', '192.168.10.1', '0', 'Wireless-802.11',
    NOW() - interval '20 minutes', NOW() - interval '1 minute', NULL, 1200, 'RADIUS',
    NULL, NULL, 20971520, 10485760, 'AA:BB:CC:DD:EE:08', 'AA:BB:CC:DD:EE:18', NULL, '10.10.5.20', NOW(), NOW());

-- New session with IP from BLOCKED range (10.99.x.x) — should be rejected by fn_check_ip_pool
INSERT INTO radacct (radacctid, acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype,
    acctstarttime, acctupdatetime, acctstoptime, acctsessiontime, acctauthentic,
    connectinfo_start, connectinfo_stop, acctinputoctets, acctoutputoctets,
    calledstationid, callingstationid, acctterminatecause, framedipaddress, "createdAt", "updatedAt")
VALUES
(5007, '50000007-guest.anita.mehta-blocked', '50000007', 'guest.anita.mehta', '', '192.168.10.1', '0', 'Wireless-802.11',
    NOW() - interval '10 minutes', NOW() - interval '30 seconds', NOW() - interval '2 minutes', 480, 'RADIUS',
    NULL, NULL, 1048576, 524288, 'AA:BB:CC:DD:EE:09', 'AA:BB:CC:DD:EE:19', 'Admin-Reset', '10.99.0.55', NOW(), NOW());

-- Reject for IP pool violation
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.anita.mehta', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:09', 'AA:BB:CC:DD:EE:19', NOW() - interval '12 minutes', '192.168.10.1', NOW(), NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 6: Additional FUP Edge Cases (Scenario D)'
\echo '========================================='

-- ============================================================================
-- More FUP throttle events including:
--   - User near limit (warning zone)
--   - User just crossed limit
--   - Restored to full speed after cycle reset (simulate)
-- ============================================================================

-- FUP event: guest.divya.chopra just crossed Premium Monthly 15GB limit
INSERT INTO fup_switch_log (username, fup_policy_name, usage_mb, limit_mb, throttle_down_kbps, throttle_up_kbps,
    triggered_at, property_id, plan_name, cycle_type, action, original_down_kbps, original_up_kbps, nas_ip, created_at)
VALUES
('guest.divya.chopra', 'Premium Monthly 15GB', 15600.5, 15360, 51200, 25600,
    NOW() - interval '1 hour', '281fde73-7836-4511-b644-91f3663d8fcd', 'Premium Plan', 'monthly', 'throttle',
    50000, 25000, '192.168.40.1', NOW()),

-- FUP event: guest.ritu.chakraborty crossed Standard Weekly 5GB limit
('guest.ritu.chakraborty', 'Standard Weekly 5GB', 5300.2, 5120, 25600, 10240,
    NOW() - interval '45 minutes', '281fde73-7836-4511-b644-91f3663d8fcd', 'Standard Plan', 'weekly', 'throttle',
    25000, 10000, '192.168.30.1', NOW()),

-- FUP event: guest.neha.kapoor crossed Basic Daily 2GB limit
('guest.neha.kapoor', 'Basic Daily 2GB', 2200.8, 2048, 2048, 1024,
    NOW() - interval '30 minutes', '281fde73-7836-4511-b644-91f3663d8fcd', 'Basic Plan', 'daily', 'throttle',
    10000, 5000, '192.168.20.1', NOW()),

-- FUP RESTORE: guest.priya.bhatt had Basic Daily 2GB throttle but daily cycle reset
-- (action='restore' shows she was restored to full speed)
('guest.priya.bhatt', 'Basic Daily 2GB', 0.0, 2048, 10000, 5000,
    NOW() - interval '5 minutes', '281fde73-7836-4511-b644-91f3663d8fcd', 'Basic Plan', 'daily', 'restore',
    2048, 1024, '192.168.20.1', NOW()),

-- FUP RESTORE: guest.indrani.pal Standard Weekly 5GB restored after weekly cycle reset
('guest.indrani.pal', 'Standard Weekly 5GB', 0.0, 5120, 25000, 10000,
    NOW() - interval '10 minutes', '281fde73-7836-4511-b644-91f3663d8fcd', 'Standard Plan', 'weekly', 'restore',
    25600, 10240, '192.168.30.1', NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 7: Disabled & Expired User Tests (Scenarios F, G)'
\echo '========================================='

-- ============================================================================
-- Scenario F: Disabled user trying to authenticate
-- ============================================================================
UPDATE "WiFiUser" SET status = 'disabled' WHERE username = 'guest.kiran.menon';

-- Reject entries for disabled user attempts
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.kiran.menon', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:30', 'AA:BB:CC:DD:EE:40', NOW() - interval '1 minute', '192.168.20.1', NOW(), NOW()),
('guest.kiran.menon', 'LetMeIn!2024', 'Access-Reject', 'AA:BB:CC:DD:EE:31', 'AA:BB:CC:DD:EE:41', NOW() - interval '30 seconds', '192.168.20.1', NOW(), NOW());

-- ============================================================================
-- Scenario G: Expired user trying to authenticate
-- ============================================================================
UPDATE "WiFiUser" SET status = 'expired', "validUntil" = NOW() - interval '2 days'
WHERE username = 'guest.lakshmi.iyer';

-- Reject entries for expired user
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.lakshmi.iyer', 'Welcome@123', 'Access-Reject', 'AA:BB:CC:DD:EE:32', 'AA:BB:CC:DD:EE:42', NOW() - interval '2 minutes', '192.168.10.1', NOW(), NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 8: Unknown User + Recovery (Scenarios H, I)'
\echo '========================================='

-- ============================================================================
-- Scenario H: Unknown user (no WiFiUser entry) attempting auth
-- ============================================================================
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('random.walker', 'guesspass', 'Access-Reject', 'AA:BB:CC:DD:EE:50', 'AA:BB:CC:DD:EE:60', NOW() - interval '3 minutes', '192.168.10.1', NOW(), NOW()),
('test.hacker', 'h4ck3r', 'Access-Reject', 'AA:BB:CC:DD:EE:51', 'AA:BB:CC:DD:EE:61', NOW() - interval '2 minutes', '192.168.20.1', NOW(), NOW()),
('wifi.freeloader', 'password123', 'Access-Reject', 'AA:BB:CC:DD:EE:52', 'AA:BB:CC:DD:EE:62', NOW() - interval '1 minute', '192.168.30.1', NOW(), NOW());

-- ============================================================================
-- Scenario I: Successful auth after wrong password recovery
-- ============================================================================
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.divya.chopra', 'Welcome@123', 'Access-Accept', 'AA:BB:CC:DD:EE:13', 'AA:BB:CC:DD:EE:23', NOW() - interval '2 minutes', '192.168.40.1', NOW(), NOW()),

-- Additional successful auth for new user sessions
('guest.kavita.jain', 'Welcome@123', 'Access-Accept', 'AA:BB:CC:DD:EE:08', 'AA:BB:CC:DD:EE:18', NOW() - interval '20 minutes', '192.168.10.1', NOW(), NOW());

-- ============================================================================
-- Scenario J: Successful auth with correct pool + correct IP (normal flow)
-- ============================================================================
INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, "nasIpAddress", "createdAt", "updatedAt") VALUES
('guest.meera.reddy', 'Welcome@123', 'Access-Accept', 'AA:BB:CC:DD:EE:33', 'AA:BB:CC:DD:EE:43', NOW() - interval '5 minutes', '192.168.20.1', NOW(), NOW()),
('guest.arun.chopra', 'Welcome@123', 'Access-Accept', 'AA:BB:CC:DD:EE:34', 'AA:BB:CC:DD:EE:44', NOW() - interval '3 minutes', '192.168.20.1', NOW(), NOW());


\echo ''
\echo '========================================='
\echo ' PHASE 9: Data Usage Periods for New Sessions'
\echo '========================================='

INSERT INTO data_usage_by_period (username, period_start, period_end, acctinputoctets, acctoutputoctets) VALUES
('guest.swati.mukherjee', date_trunc('day', NOW()), NULL, 1782579200, 1069547520),
('guest.nisha.goyal', date_trunc('day', NOW()), NULL, 3745326083, 2247195649),
('guest.madhuri.sinha', date_trunc('day', NOW()), NULL, 1073741824, 644245094),
('guest.kavita.jain', date_trunc('day', NOW()), NULL, 20971520, 10485760),
('guest.anita.mehta', date_trunc('day', NOW()), NULL, 1048576, 524288),
('guest.divya.chopra', date_trunc('day', NOW()), NULL, 2097152000, 1258291200)
ON CONFLICT (username, period_start) DO UPDATE SET
    acctinputoctets = EXCLUDED.acctinputoctets,
    acctoutputoctets = EXCLUDED.acctoutputoctets;


\echo ''
\echo '========================================='
\echo ' PHASE 10: Update WiFiUser Counters'
\echo '========================================='

-- Update session counts for users with extra sessions
UPDATE "WiFiUser" SET "sessionCount" = "sessionCount" + 2 WHERE username = 'guest.swati.mukherjee';
UPDATE "WiFiUser" SET "sessionCount" = "sessionCount" + 2 WHERE username = 'guest.nisha.goyal';
UPDATE "WiFiUser" SET "sessionCount" = "sessionCount" + 1 WHERE username = 'guest.madhuri.sinha';
UPDATE "WiFiUser" SET "sessionCount" = "sessionCount" + 1 WHERE username = 'guest.kavita.jain';
UPDATE "WiFiUser" SET "sessionCount" = "sessionCount" + 1 WHERE username = 'guest.anita.mehta';
UPDATE "WiFiUser" SET "lastAccountingAt" = NOW() WHERE username IN (
    'guest.swati.mukherjee', 'guest.nisha.goyal', 'guest.madhuri.sinha',
    'guest.kavita.jain', 'guest.anita.mehta', 'guest.divya.chopra'
);

\echo ''
\echo '========================================='
\echo ' TEST SETUP COMPLETE!'
\echo '========================================='
