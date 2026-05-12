-- ============================================================================
-- StaySuite-HospitalityOS — 40-User Production Simulation Test
-- ============================================================================
-- Simulates a real production environment with:
--   - 4 NAS vendors (Mikrotik, Cisco, Aruba, Ubiquiti)
--   - 4 WiFi Plans (Free, Basic, Standard, Premium) with different FUP configs
--   - 40 WiFi users (10 per NAS vendor)
--   - Mix of active + historical radacct sessions
--   - Auth logs (accept + reject)
--   - FUP throttle events
--   - Data usage by period
--
-- TARGET GUI TABS:
--   - Active Users (v_active_sessions)
--   - RADIUS Users (v_wifi_users)
--   - Auth Logs (v_auth_logs via radpostauth)
--   - Session History (v_session_history)
--   - User Usage (v_user_usage)
-- ============================================================================

SET timezone = 'UTC';
BEGIN;

-- ============================================================================
-- STEP 1: Clear existing test data (preserve seed WiFiUsers from demo)
-- ============================================================================
-- We clean RADIUS tables and test sessions but keep existing WiFiUsers/Guests
DELETE FROM fup_switch_log;
DELETE FROM data_usage_by_period;
DELETE FROM radacct;
DELETE FROM radpostauth;
DELETE FROM radreply WHERE "wifiUserId" IS NOT NULL;
DELETE FROM radcheck WHERE "wifiUserId" IS NOT NULL;
DELETE FROM radusergroup;

-- ============================================================================
-- STEP 2: Insert 4 NAS entries (one per vendor)
-- ============================================================================
INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description) VALUES
    ('192.168.10.1',  'mikrotik-lobby',  'mikrotik',   3779, 'MikroTikSecret2024!', NULL, NULL, 'Mikrotik hAP ac3 — Lobby AP'),
    ('192.168.20.1',  'cisco-floor3',    'cisco',       1812, 'CiscoSecret2024!',    NULL, NULL, 'Cisco Catalyst 9800 — Floor 3 WLC'),
    ('192.168.30.1',  'aruba-pool',      'aruba',       1812, 'ArubaSecret2024!',    NULL, NULL, 'Aruba AP-535 — Pool Area'),
    ('192.168.40.1',  'ubiquiti-roof',   'other',       1812, 'UniFiSecret2024!',    NULL, NULL, 'Ubiquiti U6-Pro — Roof Top')
ON CONFLICT DO NOTHING;

-- Get NAS IDs
-- NAS IDs will be 1, 2, 3, 4 (serial)

-- ============================================================================
-- STEP 3: Create 4 FUP (Fair Access Policy) rules
-- ============================================================================
-- FUP linked to different plans via WiFiPlan.fupPolicyId

-- FUP 1: No FUP for Free WiFi (no throttle)
-- We skip FUP for Free WiFi plan — it has no dataLimit

-- FUP 2: Basic Plan — 2 GB daily limit, throttle to 512/256 kbps
INSERT INTO "FairAccessPolicy" (id, "tenantId", "propertyId", name, description, "cycleType", "dataLimitMb", "dataLimitUnit", "switchOverBwPolicyId", "cycleResetHour", "cycleResetMinute", "applicableOn", "isEnabled", "priority", "createdAt", "updatedAt")
VALUES (
    'a0000001-0001-0001-0001-000000000001'::uuid,
    '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid,
    '281fde73-7836-4511-b644-91f3663d8fcd'::uuid,
    'Basic Daily 2GB', 'Throttle after 2GB daily usage', 'daily', 2048.0, 'mb',
    '62307af3-e904-4ad6-9cca-fde1cbf7b46f'::uuid, -- BandwidthPolicy: 2048/1024 kbps
    23, 59, 'total', true, 10, NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- FUP 3: Standard Plan — 5 GB weekly limit, throttle to 2 Mbps / 1 Mbps
INSERT INTO "FairAccessPolicy" (id, "tenantId", "propertyId", name, description, "cycleType", "dataLimitMb", "dataLimitUnit", "switchOverBwPolicyId", "cycleResetHour", "cycleResetMinute", "applicableOn", "isEnabled", "priority", "createdAt", "updatedAt")
VALUES (
    'a0000001-0001-0001-0001-000000000002'::uuid,
    '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid,
    '281fde73-7836-4511-b644-91f3663d8fcd'::uuid,
    'Standard Weekly 5GB', 'Throttle after 5GB weekly usage', 'weekly', 5120.0, 'mb',
    '2c13eaf5-08f3-49e3-922b-2e94c9f0ae84'::uuid, -- BandwidthPolicy: 25600/10240 kbps (but we'll set lower throttle)
    23, 59, 'total', true, 10, NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- FUP 4: Premium Plan — 15 GB monthly limit, throttle to 5 Mbps / 2.5 Mbps
INSERT INTO "FairAccessPolicy" (id, "tenantId", "propertyId", name, description, "cycleType", "dataLimitMb", "dataLimitUnit", "switchOverBwPolicyId", "cycleResetHour", "cycleResetMinute", "applicableOn", "isEnabled", "priority", "createdAt", "updatedAt")
VALUES (
    'a0000001-0001-0001-0001-000000000003'::uuid,
    '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid,
    '281fde73-7836-4511-b644-91f3663d8fcd'::uuid,
    'Premium Monthly 15GB', 'Throttle after 15GB monthly usage', 'monthly', 15360.0, 'mb',
    '47056f0c-597c-4aa2-9809-4b506268e4fd'::uuid, -- BandwidthPolicy: 51200/25600 kbps
    23, 59, 'total', true, 10, NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Update WiFi plans with FUP policy links
-- ============================================================================
UPDATE "WiFiPlan" SET "fupPolicyId" = NULL WHERE name = 'Free WiFi';
UPDATE "WiFiPlan" SET "fupPolicyId" = 'a0000001-0001-0001-0001-000000000001'::uuid WHERE name = 'Basic Plan';
UPDATE "WiFiPlan" SET "fupPolicyId" = 'a0000001-0001-0001-0001-000000000002'::uuid WHERE name = 'Standard Plan';
UPDATE "WiFiPlan" SET "fupPolicyId" = 'a0000001-0001-0001-0001-000000000003'::uuid WHERE name = 'Premium Plan';

-- ============================================================================
-- STEP 5: Create 40 Guests + Bookings + WiFiUsers + RADIUS records
-- ============================================================================
-- Distribution:
--   Users 01-10: Mikrotik NAS (192.168.10.1), Free WiFi plan (5/2 Mbps, no FUP)
--   Users 11-20: Cisco NAS (192.168.20.1), Basic Plan (10/5 Mbps, 2GB daily FUP)
--   Users 21-30: Aruba NAS (192.168.30.1), Standard Plan (25/10 Mbps, 5GB weekly FUP)
--   Users 31-40: Ubiquiti NAS (192.168.40.1), Premium Plan (50/25 Mbps, 15GB monthly FUP)
-- ============================================================================

-- Constants
-- Tenant: 444017d5-e022-4c5f-ac07-ea0d51f4609b
-- Property: 281fde73-7836-4511-b644-91f3663d8fcd
-- Plans:
--   Free WiFi:      c80731b1-952f-45c0-b6e5-9cb77deb2590  (5/2 Mbps, no limit)
--   Basic Plan:     adb7bd87-17eb-4b0e-bcf4-a6922445ac15  (10/5 Mbps, 2GB)
--   Standard Plan:  40486b74-cf4c-4f9e-82c8-d7621f36116c  (25/10 Mbps, 5GB)
--   Premium Plan:   418b8a64-88c1-4529-a68f-e153bb92f224  (50/25 Mbps, 15GB)
-- Rooms:
--   101: 2bd9e3e1-07f2-4535-ab58-5868a167f183
--   104: 9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f
--   510: ed3525fb-db41-4efe-bc14-f8d70265fcc5
--   801: df952a5d-0ea8-49c6-9445-0de11983d19a
--   1002: 511c8197-5769-497c-9efc-293067ff0671

-- ── 5A: Create 40 new Guests ──
INSERT INTO "Guest" (id, "tenantId", "firstName", "lastName", email, phone, "isVip", "loyaltyTier", "nationality", "idType", "idNumber", "createdAt", "updatedAt") VALUES
    -- Mikrotik users (01-10): Free WiFi plan guests
    ('a0000001-0001-0001-0001-000000000001'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Sanjay', 'Kumar', 'sanjay.k@email.com', '+91-9876500001', false, 'none', 'IN', 'passport', 'P001', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000002'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Deepa', 'Sharma', 'deepa.s@email.com', '+91-9876500002', false, 'none', 'IN', 'passport', 'P002', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000003'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Ravi', 'Verma', 'ravi.v@email.com', '+91-9876500003', false, 'none', 'IN', 'aadhaar', 'A003', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000004'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Anita', 'Mehta', 'anita.m@email.com', '+91-9876500004', false, 'none', 'IN', 'passport', 'P004', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000005'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Prakash', 'Das', 'prakash.d@email.com', '+91-9876500005', false, 'none', 'IN', 'passport', 'P005', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000006'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Sunita', 'Panda', 'sunita.p@email.com', '+91-9876500006', false, 'none', 'IN', 'aadhaar', 'A006', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000007'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Manish', 'Rao', 'manish.r@email.com', '+91-9876500007', false, 'none', 'IN', 'passport', 'P007', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000008'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Kavita', 'Jain', 'kavita.j@email.com', '+91-9876500008', false, 'none', 'IN', 'passport', 'P008', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000009'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Suresh', 'Nair', 'suresh.n@email.com', '+91-9876500009', false, 'none', 'IN', 'aadhaar', 'A009', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000010'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Lakshmi', 'Iyer', 'lakshmi.i@email.com', '+91-9876500010', false, 'none', 'IN', 'passport', 'P010', NOW(), NOW()),
    -- Cisco users (11-20): Basic Plan guests
    ('a0000001-0001-0001-0001-000000000011'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Arun', 'Chopra', 'arun.c@email.com', '+91-9876500011', false, 'bronze', 'IN', 'passport', 'P011', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000012'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Meera', 'Reddy', 'meera.r@email.com', '+91-9876500012', false, 'bronze', 'IN', 'passport', 'P012', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000013'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Vikas', 'Malhotra', 'vikas.m@email.com', '+91-9876500013', false, 'bronze', 'IN', 'aadhaar', 'A013', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000014'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Priya', 'Bhatt', 'priya.b@email.com', '+91-9876500014', false, 'bronze', 'IN', 'passport', 'P014', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000015'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Rajesh', 'Gupta', 'rajesh.g@email.com', '+91-9876500015', false, 'bronze', 'IN', 'aadhaar', 'A015', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000016'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Neha', 'Kapoor', 'neha.k@email.com', '+91-9876500016', false, 'bronze', 'IN', 'passport', 'P016', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000017'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Siddharth', 'Patel', 'sid.p@email.com', '+91-9876500017', false, 'bronze', 'IN', 'passport', 'P017', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000018'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Anjali', 'Deshmukh', 'anjali.d@email.com', '+91-9876500018', false, 'bronze', 'IN', 'aadhaar', 'A018', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000019'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Kiran', 'Menon', 'kiran.m@email.com', '+91-9876500019', false, 'bronze', 'IN', 'passport', 'P019', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000020'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Tanvi', 'Shah', 'tanvi.s@email.com', '+91-9876500020', false, 'bronze', 'IN', 'passport', 'P020', NOW(), NOW()),
    -- Aruba users (21-30): Standard Plan guests
    ('a0000001-0001-0001-0001-000000000021'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Aditya', 'Banerjee', 'aditya.b@email.com', '+91-9876500021', true, 'silver', 'IN', 'passport', 'P021', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000022'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Swati', 'Mukherjee', 'swati.m@email.com', '+91-9876500022', true, 'silver', 'IN', 'passport', 'P022', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000023'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Nikhil', 'Sengupta', 'nikhil.s@email.com', '+91-9876500023', false, 'silver', 'IN', 'aadhaar', 'A023', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000024'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Ritu', 'Chakraborty', 'ritu.c@email.com', '+91-9876500024', true, 'silver', 'IN', 'passport', 'P024', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000025'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Debashis', 'Roy', 'debu.r@email.com', '+91-9876500025', false, 'silver', 'IN', 'passport', 'P025', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000026'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Priti', 'Dey', 'priti.d@email.com', '+91-9876500026', false, 'silver', 'IN', 'aadhaar', 'A026', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000027'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Sabyasachi', 'Ghosh', 'sabya.g@email.com', '+91-9876500027', false, 'silver', 'IN', 'passport', 'P027', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000028'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Madhuri', 'Sinha', 'madhuri.s@email.com', '+91-9876500028', true, 'silver', 'IN', 'passport', 'P028', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000029'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Amitava', 'Majumdar', 'amitava.m@email.com', '+91-9876500029', false, 'silver', 'IN', 'aadhaar', 'A029', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000030'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Indrani', 'Pal', 'indrani.p@email.com', '+91-9876500030', false, 'silver', 'IN', 'passport', 'P030', NOW(), NOW()),
    -- Ubiquiti users (31-40): Premium Plan guests
    ('a0000001-0001-0001-0001-000000000031'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Rohan', 'Khanna', 'rohan.k@email.com', '+91-9876500031', true, 'gold', 'IN', 'passport', 'P031', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000032'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Isha', 'Tandon', 'isha.t@email.com', '+91-9876500032', true, 'gold', 'IN', 'passport', 'P032', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000033'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Varun', 'Agarwal', 'varun.a@email.com', '+91-9876500033', true, 'gold', 'IN', 'passport', 'P033', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000034'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Shreya', 'Bhattacharya', 'shreya.b@email.com', '+91-9876500034', true, 'platinum', 'IN', 'passport', 'P034', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000035'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Arjun', 'Saxena', 'arjun.s@email.com', '+91-9876500035', true, 'gold', 'IN', 'passport', 'P035', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000036'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Divya', 'Chopra', 'divya.c@email.com', '+91-9876500036', true, 'gold', 'IN', 'passport', 'P036', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000037'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Karan', 'Malik', 'karan.m@email.com', '+91-9876500037', true, 'platinum', 'IN', 'aadhaar', 'A037', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000038'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Nisha', 'Goyal', 'nisha.g@email.com', '+91-9876500038', true, 'gold', 'IN', 'passport', 'P038', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000039'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Tushar', 'Joshi', 'tushar.j@email.com', '+91-9876500039', true, 'gold', 'IN', 'passport', 'P039', NOW(), NOW()),
    ('a0000001-0001-0001-0001-000000000040'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, 'Riya', 'Thakur', 'riya.t@email.com', '+91-9876500040', true, 'platinum', 'IN', 'passport', 'P040', NOW(), NOW());

-- ── 5B: Create 40 Bookings (one per guest) ──
INSERT INTO "Booking" (id, "tenantId", "propertyId", "confirmationCode", "primaryGuestId", "roomId", "roomTypeId", "checkIn", "checkOut", adults, children, "roomRate", taxes, fees, "totalAmount", currency, status, "actualCheckIn", "createdAt", "updatedAt") VALUES
    -- Mikrotik users (01-10)
    ('b0000001-0001-0001-0001-000000000001'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-001', 'a0000001-0001-0001-0001-000000000001'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000002'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-002', 'a0000001-0001-0001-0001-000000000002'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 2, 0, 4500, 810, 250, 5560, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000003'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-003', 'a0000001-0001-0001-0001-000000000003'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '7 days', NOW()),
    ('b0000001-0001-0001-0001-000000000004'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-004', 'a0000001-0001-0001-0001-000000000004'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 1, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000005'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-005', 'a0000001-0001-0001-0001-000000000005'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 2, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '10 days', NOW()),
    ('b0000001-0001-0001-0001-000000000006'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-006', 'a0000001-0001-0001-0001-000000000006'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000007'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-007', 'a0000001-0001-0001-0001-000000000007'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000008'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-008', 'a0000001-0001-0001-0001-000000000008'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000009'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-009', 'a0000001-0001-0001-0001-000000000009'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '5 days', NOW() + INTERVAL '0 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '10 days', NOW()),
    ('b0000001-0001-0001-0001-000000000010'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-010', 'a0000001-0001-0001-0001-000000000010'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 1, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days', NOW()),
    -- Cisco users (11-20)
    ('b0000001-0001-0001-0001-000000000011'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-011', 'a0000001-0001-0001-0001-000000000011'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000012'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-012', 'a0000001-0001-0001-0001-000000000012'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 2, 0, 4500, 810, 250, 5560, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000013'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-013', 'a0000001-0001-0001-0001-000000000013'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000014'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-014', 'a0000001-0001-0001-0001-000000000014'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 1, 1, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000015'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-015', 'a0000001-0001-0001-0001-000000000015'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 2, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000016'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-016', 'a0000001-0001-0001-0001-000000000016'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000017'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-017', 'a0000001-0001-0001-0001-000000000017'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 1, 0, 3500, 630, 200, 4330, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000018'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-018', 'a0000001-0001-0001-0001-000000000018'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 2, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000019'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-019', 'a0000001-0001-0001-0001-000000000019'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW()),
    ('b0000001-0001-0001-0001-000000000020'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-020', 'a0000001-0001-0001-0001-000000000020'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '6 days', 1, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days', NOW()),
    -- Aruba users (21-30)
    ('b0000001-0001-0001-0001-000000000021'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-021', 'a0000001-0001-0001-0001-000000000021'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000022'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-022', 'a0000001-0001-0001-0001-000000000022'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '5 days', 2, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000023'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-023', 'a0000001-0001-0001-0001-000000000023'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()),
    ('b0000001-0001-0001-0001-000000000024'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-024', 'a0000001-0001-0001-0001-000000000024'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 1, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '7 days', NOW()),
    ('b0000001-0001-0001-0001-000000000025'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-025', 'a0000001-0001-0001-0001-000000000025'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW()),
    ('b0000001-0001-0001-0001-000000000026'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-026', 'a0000001-0001-0001-0001-000000000026'::uuid, '2bd9e3e1-07f2-4535-ab58-5868a167f183'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '5 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000027'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-027', 'a0000001-0001-0001-0001-000000000027'::uuid, '9b1e3d48-842e-40bb-aa34-9f7ce7e0bb1f'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000028'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-028', 'a0000001-0001-0001-0001-000000000028'::uuid, 'ed3525fb-db41-4efe-bc14-f8d70265fcc5'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 2, 0, 5500, 990, 300, 6790, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000029'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-029', 'a0000001-0001-0001-0001-000000000029'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000030'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-030', 'a0000001-0001-0001-0001-000000000030'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 1, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '8 days', NOW()),
    -- Ubiquiti users (31-40)
    ('b0000001-0001-0001-0001-000000000031'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-031', 'a0000001-0001-0001-0001-000000000031'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000032'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-032', 'a0000001-0001-0001-0001-000000000032'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 2, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 days', NOW()),
    ('b0000001-0001-0001-0001-000000000033'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-033', 'a0000001-0001-0001-0001-000000000033'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '7 days', NOW()),
    ('b0000001-0001-0001-0001-000000000034'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-034', 'a0000001-0001-0001-0001-000000000034'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '3 days', 1, 1, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days', NOW()),
    ('b0000001-0001-0001-0001-000000000035'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-035', 'a0000001-0001-0001-0001-000000000035'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW()),
    ('b0000001-0001-0001-0001-000000000036'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-036', 'a0000001-0001-0001-0001-000000000036'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 1, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '7 days', NOW()),
    ('b0000001-0001-0001-0001-000000000037'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-037', 'a0000001-0001-0001-0001-000000000037'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW()),
    ('b0000001-0001-0001-0001-000000000038'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-038', 'a0000001-0001-0001-0001-000000000038'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 2, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '9 days', NOW()),
    ('b0000001-0001-0001-0001-000000000039'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-039', 'a0000001-0001-0001-0001-000000000039'::uuid, 'df952a5d-0ea8-49c6-9445-0de11983d19a'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 1, 0, 8000, 1440, 400, 9840, 'INR', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '7 days', NOW()),
    ('b0000001-0001-0001-0001-000000000040'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'RS-TEST-040', 'a0000001-0001-0001-0001-000000000040'::uuid, '511c8197-5769-497c-9efc-293067ff0671'::uuid, '4d5269a2-63ad-48e7-8683-4b0efca11567'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', 1, 0, 12000, 2160, 500, 14660, 'INR', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days', NOW());

-- This file continues in part 2...
COMMIT;
