-- ============================================================================
-- StaySuite-HospitalityOS — 40-User Production Simulation Test
-- PART 2: WiFiUsers, RADIUS records, radacct, radpostauth, FUP
-- ============================================================================
-- Run PART 1 first, then this file.
-- ============================================================================

SET timezone = 'UTC';
BEGIN;

-- ============================================================================
-- STEP 5C: Create 40 WiFiUsers (10 per NAS vendor)
-- ============================================================================
INSERT INTO "WiFiUser" (id, "tenantId", "propertyId", username, password, "guestId", "bookingId", "userType", "planId", "validFrom", "validUntil", "maxSessions", "sessionCount", "totalBytesIn", "totalBytesOut", status, "radiusSynced", "lastAccountingAt", "createdAt", "updatedAt") VALUES
    -- Mikrotik users (01-10) — Free WiFi plan (5/2 Mbps, no FUP)
    ('u0000001-0001-0001-0001-000000000001'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.sanjay.kumar',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000001'::uuid, 'b0000001-0001-0001-0001-000000000001'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 3,  52428800,  20971520, 'active', true, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000002'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.deepa.sharma',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000002'::uuid, 'b0000001-0001-0001-0001-000000000002'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 1, 1,  10485760,   5242880, 'active', true, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000003'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.ravi.verma',     'Welcome@2024', 'g0000001-0001-0001-0001-000000000003'::uuid, 'b0000001-0001-0001-0001-000000000003'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 1, 2,  15728640,   7864320, 'active', true, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000004'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.anita.mehta',    'Welcome@2024', 'g0000001-0001-0001-0001-000000000004'::uuid, 'b0000001-0001-0001-0001-000000000004'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 1,   8388608,   4194304, 'active', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000005'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.prakash.das',    'Welcome@2024', 'g0000001-0001-0001-0001-000000000005'::uuid, 'b0000001-0001-0001-0001-000000000005'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 1, 4, 209715200, 104857600, 'active', true, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '4 days', NOW()),
    ('u0000001-0001-0001-0001-000000000006'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.sunita.panda',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000006'::uuid, 'b0000001-0001-0001-0001-000000000006'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 1,   6291456,   3145728, 'active', true, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000007'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.manish.rao',    'Welcome@2024', 'g0000001-0001-0001-0001-000000000007'::uuid, 'b0000001-0001-0001-0001-000000000007'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, 2,  36700160,  18350080, 'active', true, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000008'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.kavita.jain',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000008'::uuid, 'b0000001-0001-0001-0001-000000000008'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 1, 1,  10485760,   5242880, 'active', true, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000009'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.suresh.nair',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000009'::uuid, 'b0000001-0001-0001-0001-000000000009'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '5 days', NOW() + INTERVAL '0 days', 1, 5, 314572800, 157286400, 'active', true, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '5 days', NOW()),
    ('u0000001-0001-0001-0001-000000000010'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.lakshmi.iyer',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000010'::uuid, 'b0000001-0001-0001-0001-000000000010'::uuid, 'guest', 'c80731b1-952f-45c0-b6e5-9cb77deb2590'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 1, 1,  14680064,   7340032, 'active', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),

    -- Cisco users (11-20) — Basic Plan (10/5 Mbps, 2GB daily FUP)
    ('u0000001-0001-0001-0001-000000000011'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.arun.chopra',    'Welcome@2024', 'g0000001-0001-0001-0001-000000000011'::uuid, 'b0000001-0001-0001-0001-000000000011'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 2,  838860800, 419430400, 'active', true, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000012'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.meera.reddy',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000012'::uuid, 'b0000001-0001-0001-0001-000000000012'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, 3, 1073741824, 536870912, 'active', true, NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000013'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.vikas.malhotra','Welcome@2024', 'g0000001-0001-0001-0001-000000000013'::uuid, 'b0000001-0001-0001-0001-000000000013'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 1, 1,  524288000, 262144000, 'active', true, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000014'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.priya.bhatt',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000014'::uuid, 'b0000001-0001-0001-0001-000000000014'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 1, 4, 2147483648,1073741824, 'active', true, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000015'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.rajesh.gupta', 'Welcome@2024', 'g0000001-0001-0001-0001-000000000015'::uuid, 'b0000001-0001-0001-0001-000000000015'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 1, 1,  209715200, 104857600, 'active', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000016'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.neha.kapoor',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000016'::uuid, 'b0000001-0001-0001-0001-000000000016'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 2, 1572864000, 786432000, 'active', true, NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000017'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.siddharth.patel','Welcome@2024', 'g0000001-0001-0001-0001-000000000017'::uuid, 'b0000001-0001-0001-0001-000000000017'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 1, 1,  314572800, 157286400, 'active', true, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000018'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.anjali.deshmukh','Welcome@2024','g0000001-0001-0001-0001-000000000018'::uuid, 'b0000001-0001-0001-0001-000000000018'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 1, 3, 1782579200, 891289600, 'active', true, NOW() - INTERVAL '7 minutes', NOW() - INTERVAL '4 days', NOW()),
    ('u0000001-0001-0001-0001-000000000019'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.kiran.menon',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000019'::uuid, 'b0000001-0001-0001-0001-000000000019'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 1, 1,  104857600,  52428800, 'active', true, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000020'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.tanvi.shah',    'Welcome@2024', 'g0000001-0001-0001-0001-000000000020'::uuid, 'b0000001-0001-0001-0001-000000000020'::uuid, 'guest', 'adb7bd87-17eb-4b0e-bcf4-a6922445ac15'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '6 days', 1, 2, 943718400, 471859200, 'active', true, NOW() - INTERVAL '18 minutes', NOW() - INTERVAL '2 days', NOW()),

    -- Aruba users (21-30) — Standard Plan (25/10 Mbps, 5GB weekly FUP)
    ('u0000001-0001-0001-0001-000000000021'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.aditya.banerjee','Welcome@2024','g0000001-0001-0001-0001-000000000021'::uuid, 'b0000001-0001-0001-0001-000000000021'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 2, 3, 3221225472,1610612736, 'active', true, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000022'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.swati.mukherjee','Welcome@2024','g0000001-0001-0001-0001-000000000022'::uuid, 'b0000001-0001-0001-0001-000000000022'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '5 days', 2, 5, 5368709120,2684354560, 'active', true, NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000023'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.nikhil.sengupta','Welcome@2024','g0000001-0001-0001-0001-000000000023'::uuid, 'b0000001-0001-0001-0001-000000000023'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 2, 1, 1073741824, 536870912, 'active', true, NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000024'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.ritu.chakraborty','Welcome@2024','g0000001-0001-0001-0001-000000000024'::uuid, 'b0000001-0001-0001-0001-000000000024'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 2, 2, 2147483648,1073741824, 'active', true, NOW() - INTERVAL '6 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000025'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.debashis.roy',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000025'::uuid, 'b0000001-0001-0001-0001-000000000025'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, 1,  838860800, 419430400, 'active', true, NOW() - INTERVAL '55 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000026'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.priti.dey',      'Welcome@2024', 'g0000001-0001-0001-0001-000000000026'::uuid, 'b0000001-0001-0001-0001-000000000026'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '5 days', 2, 3, 4294967296,2147483648, 'active', true, NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000027'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.sabyasachi.ghosh','Welcome@2024','g0000001-0001-0001-0001-000000000027'::uuid, 'b0000001-0001-0001-0001-000000000027'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 2, 1, 1562378240, 781189120, 'active', true, NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000028'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.madhuri.sinha', 'Welcome@2024', 'g0000001-0001-0001-0001-000000000028'::uuid, 'b0000001-0001-0001-0001-000000000028'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 2, 2, 2684354560,1342177280, 'active', true, NOW() - INTERVAL '22 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000029'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.amitava.majumdar','Welcome@2024','g0000001-0001-0001-0001-000000000029'::uuid, 'b0000001-0001-0001-0001-000000000029'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 2, 1, 1992294400, 996147200, 'active', true, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000030'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.indrani.pal',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000030'::uuid, 'b0000001-0001-0001-0001-000000000030'::uuid, 'guest', '40486b74-cf4c-4f9e-82c8-d7621f36116c'::uuid, NOW() - INTERVAL '4 days', NOW() + INTERVAL '1 day', 2, 4, 6442450944,3221225472, 'active', true, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '4 days', NOW()),

    -- Ubiquiti users (31-40) — Premium Plan (50/25 Mbps, 15GB monthly FUP)
    ('u0000001-0001-0001-0001-000000000031'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.rohan.khanna',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000031'::uuid, 'b0000001-0001-0001-0001-000000000031'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 3, 2, 5368709120,2684354560, 'active', true, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000032'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.isha.tandon',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000032'::uuid, 'b0000001-0001-0001-0001-000000000032'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 3, 3, 8589934592,4294967296, 'active', true, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000033'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.varun.agarwal', 'Welcome@2024', 'g0000001-0001-0001-0001-000000000033'::uuid, 'b0000001-0001-0001-0001-000000000033'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 3, 1, 2147483648,1073741824, 'active', true, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000034'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.shreya.bhattacharya','Welcome@2024','g0000001-0001-0001-0001-000000000034'::uuid, 'b0000001-0001-0001-0001-000000000034'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '3 days', 3, 4,12884901888,6442450944, 'active', true, NOW() - INTERVAL '45 seconds', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000035'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.arjun.saxena',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000035'::uuid, 'b0000001-0001-0001-0001-000000000035'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 3, 1, 1073741824, 536870912, 'active', true, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000036'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.divya.chopra',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000036'::uuid, 'b0000001-0001-0001-0001-000000000036'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 3, 2, 6442450944,3221225472, 'active', true, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 days', NOW()),
    ('u0000001-0001-0001-0001-000000000037'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.karan.malik',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000037'::uuid, 'b0000001-0001-0001-0001-000000000037'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 3, 1, 3221225472,1610612736, 'active', true, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000038'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.nisha.goyal',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000038'::uuid, 'b0000001-0001-0001-0001-000000000038'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 3, 3, 9663676416,4831838208, 'active', true, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '3 days', NOW()),
    ('u0000001-0001-0001-0001-000000000039'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.tushar.joshi',  'Welcome@2024', 'g0000001-0001-0001-0001-000000000039'::uuid, 'b0000001-0001-0001-0001-000000000039'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 3, 1, 1562378240, 781189120, 'active', true, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '1 day', NOW()),
    ('u0000001-0001-0001-0001-000000000040'::uuid, '444017d5-e022-4c5f-ac07-ea0d51f4609b'::uuid, '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'guest.riya.thakur',   'Welcome@2024', 'g0000001-0001-0001-0001-000000000040'::uuid, 'b0000001-0001-0001-0001-000000000040'::uuid, 'guest', '418b8a64-88c1-4529-a68f-e153bb92f224'::uuid, NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', 3, 2, 4294967296,2147483648, 'active', true, NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '2 days', NOW());

-- Continue in PART 3...
COMMIT;
-- ============================================================================
-- StaySuite-HospitalityOS — 40-User Production Simulation Test
-- PART 3: RADIUS records (radcheck, radreply, radusergroup), radacct, radpostauth, FUP
-- ============================================================================
-- Run PART 1 + PART 2 first, then this file.
-- ============================================================================

SET timezone = 'UTC';
BEGIN;

-- ============================================================================
-- STEP 6: Insert radcheck (Cleartext-Password) for all 40 users
-- ============================================================================
INSERT INTO radcheck (id, "wifiUserId", username, attribute, op, value, priority, "isActive", "createdAt", "updatedAt") VALUES
    ('rc000001-0001-0001-0001-000000000001'::uuid, 'u0000001-0001-0001-0001-000000000001'::uuid, 'guest.sanjay.kumar',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000002'::uuid, 'u0000001-0001-0001-0001-000000000002'::uuid, 'guest.deepa.sharma',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000003'::uuid, 'u0000001-0001-0001-0001-000000000003'::uuid, 'guest.ravi.verma',      'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000004'::uuid, 'u0000001-0001-0001-0001-000000000004'::uuid, 'guest.anita.mehta',     'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000005'::uuid, 'u0000001-0001-0001-0001-000000000005'::uuid, 'guest.prakash.das',     'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000006'::uuid, 'u0000001-0001-0001-0001-000000000006'::uuid, 'guest.sunita.panda',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000007'::uuid, 'u0000001-0001-0001-0001-000000000007'::uuid, 'guest.manish.rao',     'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000008'::uuid, 'u0000001-0001-0001-0001-000000000008'::uuid, 'guest.kavita.jain',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000009'::uuid, 'u0000001-0001-0001-0001-000000000009'::uuid, 'guest.suresh.nair',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000010'::uuid, 'u0000001-0001-0001-0001-000000000010'::uuid, 'guest.lakshmi.iyer',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000011'::uuid, 'u0000001-0001-0001-0001-000000000011'::uuid, 'guest.arun.chopra',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000012'::uuid, 'u0000001-0001-0001-0001-000000000012'::uuid, 'guest.meera.reddy',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000013'::uuid, 'u0000001-0001-0001-0001-000000000013'::uuid, 'guest.vikas.malhotra', 'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000014'::uuid, 'u0000001-0001-0001-0001-000000000014'::uuid, 'guest.priya.bhatt',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000015'::uuid, 'u0000001-0001-0001-0001-000000000015'::uuid, 'guest.rajesh.gupta',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000016'::uuid, 'u0000001-0001-0001-0001-000000000016'::uuid, 'guest.neha.kapoor',    'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000017'::uuid, 'u0000001-0001-0001-0001-000000000017'::uuid, 'guest.siddharth.patel','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000018'::uuid, 'u0000001-0001-0001-0001-000000000018'::uuid, 'guest.anjali.deshmukh','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000019'::uuid, 'u0000001-0001-0001-0001-000000000019'::uuid, 'guest.kiran.menon',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000020'::uuid, 'u0000001-0001-0001-0001-000000000020'::uuid, 'guest.tanvi.shah',     'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000021'::uuid, 'u0000001-0001-0001-0001-000000000021'::uuid, 'guest.aditya.banerjee','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000022'::uuid, 'u0000001-0001-0001-0001-000000000022'::uuid, 'guest.swati.mukherjee','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000023'::uuid, 'u0000001-0001-0001-0001-000000000023'::uuid, 'guest.nikhil.sengupta','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000024'::uuid, 'u0000001-0001-0001-0001-000000000024'::uuid, 'guest.ritu.chakraborty','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000025'::uuid, 'u0000001-0001-0001-0001-000000000025'::uuid, 'guest.debashis.roy',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000026'::uuid, 'u0000001-0001-0001-0001-000000000026'::uuid, 'guest.priti.dey',      'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000027'::uuid, 'u0000001-0001-0001-0001-000000000027'::uuid, 'guest.sabyasachi.ghosh','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000028'::uuid, 'u0000001-0001-0001-0001-000000000028'::uuid, 'guest.madhuri.sinha', 'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000029'::uuid, 'u0000001-0001-0001-0001-000000000029'::uuid, 'guest.amitava.majumdar','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000030'::uuid, 'u0000001-0001-0001-0001-000000000030'::uuid, 'guest.indrani.pal',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000031'::uuid, 'u0000001-0001-0001-0001-000000000031'::uuid, 'guest.rohan.khanna',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000032'::uuid, 'u0000001-0001-0001-0001-000000000032'::uuid, 'guest.isha.tandon',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000033'::uuid, 'u0000001-0001-0001-0001-000000000033'::uuid, 'guest.varun.agarwal', 'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000034'::uuid, 'u0000001-0001-0001-0001-000000000034'::uuid, 'guest.shreya.bhattacharya','Cleartext-Password',':=','Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000035'::uuid, 'u0000001-0001-0001-0001-000000000035'::uuid, 'guest.arjun.saxena',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000036'::uuid, 'u0000001-0001-0001-0001-000000000036'::uuid, 'guest.divya.chopra',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000037'::uuid, 'u0000001-0001-0001-0001-000000000037'::uuid, 'guest.karan.malik',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000038'::uuid, 'u0000001-0001-0001-0001-000000000038'::uuid, 'guest.nisha.goyal',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000039'::uuid, 'u0000001-0001-0001-0001-000000000039'::uuid, 'guest.tushar.joshi',  'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW()),
    ('rc000001-0001-0001-0001-000000000040'::uuid, 'u0000001-0001-0001-0001-000000000040'::uuid, 'guest.riya.thakur',   'Cleartext-Password', ':=', 'Welcome@2024', 0, true, NOW(), NOW());

-- ============================================================================
-- STEP 7: Insert radusergroup for all 40 users (4 groups: free-wifi, basic, standard, premium)
-- ============================================================================
INSERT INTO radusergroup (id, username, groupname, priority, "createdAt") VALUES
    -- Mikrotik → free-wifi group
    ('rg000001-0001-0001-0001-000000000001'::uuid, 'guest.sanjay.kumar',    'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000002'::uuid, 'guest.deepa.sharma',    'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000003'::uuid, 'guest.ravi.verma',      'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000004'::uuid, 'guest.anita.mehta',     'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000005'::uuid, 'guest.prakash.das',     'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000006'::uuid, 'guest.sunita.panda',    'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000007'::uuid, 'guest.manish.rao',     'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000008'::uuid, 'guest.kavita.jain',    'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000009'::uuid, 'guest.suresh.nair',    'free-wifi',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000010'::uuid, 'guest.lakshmi.iyer',   'free-wifi',  0, NOW()),
    -- Cisco → basic-plan group
    ('rg000001-0001-0001-0001-000000000011'::uuid, 'guest.arun.chopra',    'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000012'::uuid, 'guest.meera.reddy',    'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000013'::uuid, 'guest.vikas.malhotra', 'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000014'::uuid, 'guest.priya.bhatt',    'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000015'::uuid, 'guest.rajesh.gupta',  'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000016'::uuid, 'guest.neha.kapoor',    'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000017'::uuid, 'guest.siddharth.patel','basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000018'::uuid, 'guest.anjali.deshmukh','basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000019'::uuid, 'guest.kiran.menon',   'basic-plan',  0, NOW()),
    ('rg000001-0001-0001-0001-000000000020'::uuid, 'guest.tanvi.shah',     'basic-plan',  0, NOW()),
    -- Aruba → standard-plan group
    ('rg000001-0001-0001-0001-000000000021'::uuid, 'guest.aditya.banerjee','standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000022'::uuid, 'guest.swati.mukherjee','standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000023'::uuid, 'guest.nikhil.sengupta','standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000024'::uuid, 'guest.ritu.chakraborty','standard-plan',0,NOW()),
    ('rg000001-0001-0001-0001-000000000025'::uuid, 'guest.debashis.roy',  'standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000026'::uuid, 'guest.priti.dey',      'standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000027'::uuid, 'guest.sabyasachi.ghosh','standard-plan',0,NOW()),
    ('rg000001-0001-0001-0001-000000000028'::uuid, 'guest.madhuri.sinha', 'standard-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000029'::uuid, 'guest.amitava.majumdar','standard-plan',0,NOW()),
    ('rg000001-0001-0001-0001-000000000030'::uuid, 'guest.indrani.pal',   'standard-plan',0, NOW()),
    -- Ubiquiti → premium-plan group
    ('rg000001-0001-0001-0001-000000000031'::uuid, 'guest.rohan.khanna',  'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000032'::uuid, 'guest.isha.tandon',   'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000033'::uuid, 'guest.varun.agarwal', 'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000034'::uuid, 'guest.shreya.bhattacharya','premium-plan',0,NOW()),
    ('rg000001-0001-0001-0001-000000000035'::uuid, 'guest.arjun.saxena',  'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000036'::uuid, 'guest.divya.chopra',  'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000037'::uuid, 'guest.karan.malik',  'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000038'::uuid, 'guest.nisha.goyal',   'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000039'::uuid, 'guest.tushar.joshi',  'premium-plan',0, NOW()),
    ('rg000001-0001-0001-0001-000000000040'::uuid, 'guest.riya.thakur',   'premium-plan',0, NOW());

-- ============================================================================
-- STEP 8: Insert radreply (bandwidth attrs per plan) for all 40 users
-- ============================================================================
-- Each user gets 3 reply attrs: WISPr-Bandwidth-Max-Down, WISPr-Bandwidth-Max-Up, Session-Timeout
INSERT INTO radreply (id, "wifiUserId", username, attribute, op, value, priority, "isActive", "createdAt", "updatedAt") VALUES
    -- Mikrotik users → 5 Mbps down / 2 Mbps up, 24h session timeout
    ('rr000001-0001-0001-0001-000000000001'::uuid, 'u0000001-0001-0001-0001-000000000001'::uuid, 'guest.sanjay.kumar',   'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000002'::uuid, 'u0000001-0001-0001-0001-000000000001'::uuid, 'guest.sanjay.kumar',   'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000003'::uuid, 'u0000001-0001-0001-0001-000000000001'::uuid, 'guest.sanjay.kumar',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000004'::uuid, 'u0000001-0001-0001-0001-000000000002'::uuid, 'guest.deepa.sharma',   'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000005'::uuid, 'u0000001-0001-0001-0001-000000000002'::uuid, 'guest.deepa.sharma',   'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000006'::uuid, 'u0000001-0001-0001-0001-000000000002'::uuid, 'guest.deepa.sharma',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000007'::uuid, 'u0000001-0001-0001-0001-000000000003'::uuid, 'guest.ravi.verma',     'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000008'::uuid, 'u0000001-0001-0001-0001-000000000003'::uuid, 'guest.ravi.verma',     'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000009'::uuid, 'u0000001-0001-0001-0001-000000000003'::uuid, 'guest.ravi.verma',     'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000010'::uuid, 'u0000001-0001-0001-0001-000000000004'::uuid, 'guest.anita.mehta',    'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000011'::uuid, 'u0000001-0001-0001-0001-000000000004'::uuid, 'guest.anita.mehta',    'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000012'::uuid, 'u0000001-0001-0001-0001-000000000004'::uuid, 'guest.anita.mehta',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000013'::uuid, 'u0000001-0001-0001-0001-000000000005'::uuid, 'guest.prakash.das',    'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000014'::uuid, 'u0000001-0001-0001-0001-000000000005'::uuid, 'guest.prakash.das',    'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000015'::uuid, 'u0000001-0001-0001-0001-000000000005'::uuid, 'guest.prakash.das',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000016'::uuid, 'u0000001-0001-0001-0001-000000000006'::uuid, 'guest.sunita.panda',   'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000017'::uuid, 'u0000001-0001-0001-0001-000000000006'::uuid, 'guest.sunita.panda',   'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000018'::uuid, 'u0000001-0001-0001-0001-000000000006'::uuid, 'guest.sunita.panda',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000019'::uuid, 'u0000001-0001-0001-0001-000000000007'::uuid, 'guest.manish.rao',    'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000020'::uuid, 'u0000001-0001-0001-0001-000000000007'::uuid, 'guest.manish.rao',    'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000021'::uuid, 'u0000001-0001-0001-0001-000000000007'::uuid, 'guest.manish.rao',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000022'::uuid, 'u0000001-0001-0001-0001-000000000008'::uuid, 'guest.kavita.jain',   'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000023'::uuid, 'u0000001-0001-0001-0001-000000000008'::uuid, 'guest.kavita.jain',   'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000024'::uuid, 'u0000001-0001-0001-0001-000000000008'::uuid, 'guest.kavita.jain',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000025'::uuid, 'u0000001-0001-0001-0001-000000000009'::uuid, 'guest.suresh.nair',   'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000026'::uuid, 'u0000001-0001-0001-0001-000000000009'::uuid, 'guest.suresh.nair',   'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000027'::uuid, 'u0000001-0001-0001-0001-000000000009'::uuid, 'guest.suresh.nair',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000028'::uuid, 'u0000001-0001-0001-0001-000000000010'::uuid, 'guest.lakshmi.iyer',  'WISPr-Bandwidth-Max-Down', ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000029'::uuid, 'u0000001-0001-0001-0001-000000000010'::uuid, 'guest.lakshmi.iyer',  'WISPr-Bandwidth-Max-Up',   ':=', '2000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000030'::uuid, 'u0000001-0001-0001-0001-000000000010'::uuid, 'guest.lakshmi.iyer',  'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),

    -- Cisco users → 10 Mbps down / 5 Mbps up, 24h session
    ('rr000001-0001-0001-0001-000000000031'::uuid, 'u0000001-0001-0001-0001-000000000011'::uuid, 'guest.arun.chopra',    'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000032'::uuid, 'u0000001-0001-0001-0001-000000000011'::uuid, 'guest.arun.chopra',    'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000033'::uuid, 'u0000001-0001-0001-0001-000000000011'::uuid, 'guest.arun.chopra',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000034'::uuid, 'u0000001-0001-0001-0001-000000000012'::uuid, 'guest.meera.reddy',   'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000035'::uuid, 'u0000001-0001-0001-0001-000000000012'::uuid, 'guest.meera.reddy',   'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000036'::uuid, 'u0000001-0001-0001-0001-000000000012'::uuid, 'guest.meera.reddy',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000037'::uuid, 'u0000001-0001-0001-0001-000000000013'::uuid, 'guest.vikas.malhotra','WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000038'::uuid, 'u0000001-0001-0001-0001-000000000013'::uuid, 'guest.vikas.malhotra','WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000039'::uuid, 'u0000001-0001-0001-0001-000000000013'::uuid, 'guest.vikas.malhotra','Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000040'::uuid, 'u0000001-0001-0001-0001-000000000014'::uuid, 'guest.priya.bhatt',   'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000041'::uuid, 'u0000001-0001-0001-0001-000000000014'::uuid, 'guest.priya.bhatt',   'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000042'::uuid, 'u0000001-0001-0001-0001-000000000014'::uuid, 'guest.priya.bhatt',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000043'::uuid, 'u0000001-0001-0001-0001-000000000015'::uuid, 'guest.rajesh.gupta', 'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000044'::uuid, 'u0000001-0001-0001-0001-000000000015'::uuid, 'guest.rajesh.gupta', 'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000045'::uuid, 'u0000001-0001-0001-0001-000000000015'::uuid, 'guest.rajesh.gupta', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000046'::uuid, 'u0000001-0001-0001-0001-000000000016'::uuid, 'guest.neha.kapoor',   'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000047'::uuid, 'u0000001-0001-0001-0001-000000000016'::uuid, 'guest.neha.kapoor',   'WISPr-Bandwidth-Max-Up',   ':=', '5000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000048'::uuid, 'u0000001-0001-0001-0001-000000000016'::uuid, 'guest.neha.kapoor',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000049'::uuid, 'u0000001-0001-0001-0001-000000000017'::uuid, 'guest.siddharth.patel','WISPr-Bandwidth-Max-Down',':=','10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000050'::uuid, 'u0000001-0001-0001-0001-000000000017'::uuid, 'guest.siddharth.patel','WISPr-Bandwidth-Max-Up',  ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000051'::uuid, 'u0000001-0001-0001-0001-000000000017'::uuid, 'guest.siddharth.patel','Session-Timeout',        ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000052'::uuid, 'u0000001-0001-0001-0001-000000000018'::uuid, 'guest.anjali.deshmukh','WISPr-Bandwidth-Max-Down',':=','10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000053'::uuid, 'u0000001-0001-0001-0001-000000000018'::uuid, 'guest.anjali.deshmukh','WISPr-Bandwidth-Max-Up',  ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000054'::uuid, 'u0000001-0001-0001-0001-000000000018'::uuid, 'guest.anjali.deshmukh','Session-Timeout',        ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000055'::uuid, 'u0000001-0001-0001-0001-000000000019'::uuid, 'guest.kiran.menon',   'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000056'::uuid, 'u0000001-0001-0001-0001-000000000019'::uuid, 'guest.kiran.menon',   'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000057'::uuid, 'u0000001-0001-0001-0001-000000000019'::uuid, 'guest.kiran.menon',   'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000058'::uuid, 'u0000001-0001-0001-0001-000000000020'::uuid, 'guest.tanvi.shah',    'WISPr-Bandwidth-Max-Down', ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000059'::uuid, 'u0000001-0001-0001-0001-000000000020'::uuid, 'guest.tanvi.shah',    'WISPr-Bandwidth-Max-Up',   ':=', '5000',  0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000060'::uuid, 'u0000001-0001-0001-0001-000000000020'::uuid, 'guest.tanvi.shah',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),

    -- Aruba users → 25 Mbps down / 10 Mbps up
    ('rr000001-0001-0001-0001-000000000061'::uuid, 'u0000001-0001-0001-0001-000000000021'::uuid, 'guest.aditya.banerjee','WISPr-Bandwidth-Max-Down',':=','25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000062'::uuid, 'u0000001-0001-0001-0001-000000000021'::uuid, 'guest.aditya.banerjee','WISPr-Bandwidth-Max-Up',  ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000063'::uuid, 'u0000001-0001-0001-0001-000000000021'::uuid, 'guest.aditya.banerjee','Session-Timeout',        ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000064'::uuid, 'u0000001-0001-0001-0001-000000000022'::uuid, 'guest.swati.mukherjee','WISPr-Bandwidth-Max-Down',':=','25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000065'::uuid, 'u0000001-0001-0001-0001-000000000022'::uuid, 'guest.swati.mukherjee','WISPr-Bandwidth-Max-Up',  ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000066'::uuid, 'u0000001-0001-0001-0001-000000000022'::uuid, 'guest.swati.mukherjee','Session-Timeout',        ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000067'::uuid, 'u0000001-0001-0001-0001-000000000023'::uuid, 'guest.nikhil.sengupta','WISPr-Bandwidth-Max-Down',':=','25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000068'::uuid, 'u0000001-0001-0001-0001-000000000023'::uuid, 'guest.nikhil.sengupta','WISPr-Bandwidth-Max-Up',  ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000069'::uuid, 'u0000001-0001-0001-0001-000000000023'::uuid, 'guest.nikhil.sengupta','Session-Timeout',        ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000070'::uuid, 'u0000001-0001-0001-0001-000000000024'::uuid, 'guest.ritu.chakraborty','WISPr-Bandwidth-Max-Down',':=','25000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000071'::uuid, 'u0000001-0001-0001-0001-000000000024'::uuid, 'guest.ritu.chakraborty','WISPr-Bandwidth-Max-Up',  ':=', '10000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000072'::uuid, 'u0000001-0001-0001-0001-000000000024'::uuid, 'guest.ritu.chakraborty','Session-Timeout',        ':=', '86400',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000073'::uuid, 'u0000001-0001-0001-0001-000000000025'::uuid, 'guest.debashis.roy', 'WISPr-Bandwidth-Max-Down', ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000074'::uuid, 'u0000001-0001-0001-0001-000000000025'::uuid, 'guest.debashis.roy', 'WISPr-Bandwidth-Max-Up',   ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000075'::uuid, 'u0000001-0001-0001-0001-000000000025'::uuid, 'guest.debashis.roy', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000076'::uuid, 'u0000001-0001-0001-0001-000000000026'::uuid, 'guest.priti.dey',    'WISPr-Bandwidth-Max-Down', ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000077'::uuid, 'u0000001-0001-0001-0001-000000000026'::uuid, 'guest.priti.dey',    'WISPr-Bandwidth-Max-Up',   ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000078'::uuid, 'u0000001-0001-0001-0001-000000000026'::uuid, 'guest.priti.dey',    'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000079'::uuid, 'u0000001-0001-0001-0001-000000000027'::uuid, 'guest.sabyasachi.ghosh','WISPr-Bandwidth-Max-Down',':=','25000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000080'::uuid, 'u0000001-0001-0001-0001-000000000027'::uuid, 'guest.sabyasachi.ghosh','WISPr-Bandwidth-Max-Up',  ':=', '10000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000081'::uuid, 'u0000001-0001-0001-0001-000000000027'::uuid, 'guest.sabyasachi.ghosh','Session-Timeout',        ':=', '86400',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000082'::uuid, 'u0000001-0001-0001-0001-000000000028'::uuid, 'guest.madhuri.sinha','WISPr-Bandwidth-Max-Down', ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000083'::uuid, 'u0000001-0001-0001-0001-000000000028'::uuid, 'guest.madhuri.sinha','WISPr-Bandwidth-Max-Up',   ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000084'::uuid, 'u0000001-0001-0001-0001-000000000028'::uuid, 'guest.madhuri.sinha','Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000085'::uuid, 'u0000001-0001-0001-0001-000000000029'::uuid, 'guest.amitava.majumdar','WISPr-Bandwidth-Max-Down',':=','25000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000086'::uuid, 'u0000001-0001-0001-0001-000000000029'::uuid, 'guest.amitava.majumdar','WISPr-Bandwidth-Max-Up',  ':=', '10000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000087'::uuid, 'u0000001-0001-0001-0001-000000000029'::uuid, 'guest.amitava.majumdar','Session-Timeout',        ':=', '86400',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000088'::uuid, 'u0000001-0001-0001-0001-000000000030'::uuid, 'guest.indrani.pal',  'WISPr-Bandwidth-Max-Down', ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000089'::uuid, 'u0000001-0001-0001-0001-000000000030'::uuid, 'guest.indrani.pal',  'WISPr-Bandwidth-Max-Up',   ':=', '10000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000090'::uuid, 'u0000001-0001-0001-0001-000000000030'::uuid, 'guest.indrani.pal',  'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),

    -- Ubiquiti users → 50 Mbps down / 25 Mbps up
    ('rr000001-0001-0001-0001-000000000091'::uuid, 'u0000001-0001-0001-0001-000000000031'::uuid, 'guest.rohan.khanna', 'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000092'::uuid, 'u0000001-0001-0001-0001-000000000031'::uuid, 'guest.rohan.khanna', 'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000093'::uuid, 'u0000001-0001-0001-0001-000000000031'::uuid, 'guest.rohan.khanna', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000094'::uuid, 'u0000001-0001-0001-0001-000000000032'::uuid, 'guest.isha.tandon',  'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000095'::uuid, 'u0000001-0001-0001-0001-000000000032'::uuid, 'guest.isha.tandon',  'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000096'::uuid, 'u0000001-0001-0001-0001-000000000032'::uuid, 'guest.isha.tandon',  'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000097'::uuid, 'u0000001-0001-0001-0001-000000000033'::uuid, 'guest.varun.agarwal','WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000098'::uuid, 'u0000001-0001-0001-0001-000000000033'::uuid, 'guest.varun.agarwal','WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000099'::uuid, 'u0000001-0001-0001-0001-000000000033'::uuid, 'guest.varun.agarwal','Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000100'::uuid, 'u0000001-0001-0001-0001-000000000034'::uuid, 'guest.shreya.bhattacharya','WISPr-Bandwidth-Max-Down',':=','50000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000101'::uuid, 'u0000001-0001-0001-0001-000000000034'::uuid, 'guest.shreya.bhattacharya','WISPr-Bandwidth-Max-Up',  ':=', '25000',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000102'::uuid, 'u0000001-0001-0001-0001-000000000034'::uuid, 'guest.shreya.bhattacharya','Session-Timeout',        ':=', '86400',0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000103'::uuid, 'u0000001-0001-0001-0001-000000000035'::uuid, 'guest.arjun.saxena', 'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000104'::uuid, 'u0000001-0001-0001-0001-000000000035'::uuid, 'guest.arjun.saxena', 'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000105'::uuid, 'u0000001-0001-0001-0001-000000000035'::uuid, 'guest.arjun.saxena', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000106'::uuid, 'u0000001-0001-0001-0001-000000000036'::uuid, 'guest.divya.chopra', 'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000107'::uuid, 'u0000001-0001-0001-0001-000000000036'::uuid, 'guest.divya.chopra', 'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000108'::uuid, 'u0000001-0001-0001-0001-000000000036'::uuid, 'guest.divya.chopra', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000109'::uuid, 'u0000001-0001-0001-0001-000000000037'::uuid, 'guest.karan.malik', 'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000110'::uuid, 'u0000001-0001-0001-0001-000000000037'::uuid, 'guest.karan.malik', 'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000111'::uuid, 'u0000001-0001-0001-0001-000000000037'::uuid, 'guest.karan.malik', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000112'::uuid, 'u0000001-0001-0001-0001-000000000038'::uuid, 'guest.nisha.goyal',  'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000113'::uuid, 'u0000001-0001-0001-0001-000000000038'::uuid, 'guest.nisha.goyal',  'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000114'::uuid, 'u0000001-0001-0001-0001-000000000038'::uuid, 'guest.nisha.goyal',  'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000115'::uuid, 'u0000001-0001-0001-0001-000000000039'::uuid, 'guest.tushar.joshi', 'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000116'::uuid, 'u0000001-0001-0001-0001-000000000039'::uuid, 'guest.tushar.joshi', 'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000117'::uuid, 'u0000001-0001-0001-0001-000000000039'::uuid, 'guest.tushar.joshi', 'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000118'::uuid, 'u0000001-0001-0001-0001-000000000040'::uuid, 'guest.riya.thakur',  'WISPr-Bandwidth-Max-Down', ':=', '50000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000119'::uuid, 'u0000001-0001-0001-0001-000000000040'::uuid, 'guest.riya.thakur',  'WISPr-Bandwidth-Max-Up',   ':=', '25000', 0, true, NOW(), NOW()),
    ('rr000001-0001-0001-0001-000000000120'::uuid, 'u0000001-0001-0001-0001-000000000040'::uuid, 'guest.riya.thakur',  'Session-Timeout',         ':=', '86400', 0, true, NOW(), NOW());

COMMIT;
-- ============================================================================
-- StaySuite-HospitalityOS — 40-User Production Simulation Test
-- PART 4: radacct (active + historical sessions), radpostauth, FUP, data usage
-- ============================================================================
-- Run PART 1 + PART 2 + PART 3 first, then this file.
-- ============================================================================

SET timezone = 'UTC';
BEGIN;

-- ============================================================================
-- STEP 9: Insert radacct — ACTIVE sessions (15 currently online)
-- ============================================================================
-- Users 1,2,3,4,5,7,8 from Mikrotik; 11,12,13,14,15 from Cisco; 21,24,30 from Aruba; 31,34 from Ubiquiti
INSERT INTO radacct ("acctuniqueid", "acctsessionid", username, "realm", "nasipaddress", "nasportid", "nasporttype", "acctstarttime", "acctupdatetime", "acctstoptime", "acctsessiontime", "acctauthentic", "connectinfo_start", "connectinfo_stop", "acctinputoctets", "acctoutputoctets", "acctinputgigawords", "acctoutputgigawords", "calledstationid", "callingstationid", "acctterminatecause", "framedipaddress", "framedipv6address", "acctstatus", "createdAt", "updatedAt") VALUES
    -- ACTIVE sessions from Mikrotik (192.168.10.1)
    ('radacct-active-001', '80000001', 'guest.sanjay.kumar',     NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 hours', NOW(), NULL, 7200, 'RADIUS', 'MikroTik 802.11', NULL, 52428800, 36700160, 0, 0, '00:0C:42:01:AA:01', 'AA:BB:CC:DD:EE:01', NULL, '10.10.1.101', NULL, 'start', NOW() - INTERVAL '2 hours', NOW()),
    ('radacct-active-002', '80000002', 'guest.deepa.sharma',     NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '45 minutes', NOW(), NULL, 2700, 'RADIUS', 'MikroTik 802.11', NULL, 10485760,  7864320, 0, 0, '00:0C:42:01:AA:02', 'AA:BB:CC:DD:EE:02', NULL, '10.10.1.102', NULL, 'start', NOW() - INTERVAL '45 minutes', NOW()),
    ('radacct-active-003', '80000003', 'guest.ravi.verma',       NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 hour', NOW(), NULL, 3600, 'RADIUS', 'MikroTik 802.11', NULL, 15728640, 10485760, 0, 0, '00:0C:42:01:AA:03', 'AA:BB:CC:DD:EE:03', NULL, '10.10.1.103', NULL, 'start', NOW() - INTERVAL '1 hour', NOW()),
    ('radacct-active-004', '80000004', 'guest.anita.mehta',      NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '30 minutes', NOW(), NULL, 1800, 'RADIUS', 'MikroTik 802.11', NULL, 8388608,  6291456, 0, 0, '00:0C:42:01:AA:04', 'AA:BB:CC:DD:EE:04', NULL, '10.10.1.104', NULL, 'start', NOW() - INTERVAL '30 minutes', NOW()),
    ('radacct-active-005', '80000005', 'guest.prakash.das',      NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '4 hours', NOW(), NULL, 14400, 'RADIUS', 'MikroTik 802.11', NULL, 209715200,146800640, 0, 0, '00:0C:42:01:AA:05', 'AA:BB:CC:DD:EE:05', NULL, '10.10.1.105', NULL, 'start', NOW() - INTERVAL '4 hours', NOW()),
    ('radacct-active-007', '80000007', 'guest.manish.rao',       NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 hour 30 min', NOW(), NULL, 5400, 'RADIUS', 'MikroTik 802.11', NULL, 36700160, 25585280, 0, 0, '00:0C:42:01:AA:07', 'AA:BB:CC:DD:EE:07', NULL, '10.10.1.107', NULL, 'start', NOW() - INTERVAL '1 hour 30 min', NOW()),
    ('radacct-active-008', '80000008', 'guest.kavita.jain',      NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '20 minutes', NOW(), NULL, 1200, 'RADIUS', 'MikroTik 802.11', NULL, 10485760,  7340032, 0, 0, '00:0C:42:01:AA:08', 'AA:BB:CC:DD:EE:08', NULL, '10.10.1.108', NULL, 'start', NOW() - INTERVAL '20 minutes', NOW()),

    -- ACTIVE sessions from Cisco (192.168.20.1)
    ('radacct-active-011', '80000011', 'guest.arun.chopra',      NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 hours', NOW(), NULL, 10800, 'RADIUS', 'Cisco 802.1X', NULL, 838860800, 524288000, 0, 0, 'F4:4E:05:01:BB:01', 'AA:BB:CC:DD:EE:11', NULL, '10.10.2.111', NULL, 'start', NOW() - INTERVAL '3 hours', NOW()),
    ('radacct-active-012', '80000012', 'guest.meera.reddy',      NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 hours', NOW(), NULL, 7200, 'RADIUS', 'Cisco 802.1X', NULL, 1073741824,644245094, 0, 0, 'F4:4E:05:01:BB:02', 'AA:BB:CC:DD:EE:12', NULL, '10.10.2.112', NULL, 'start', NOW() - INTERVAL '2 hours', NOW()),
    ('radacct-active-013', '80000013', 'guest.vikas.malhotra',   NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '30 minutes', NOW(), NULL, 1800, 'RADIUS', 'Cisco 802.1X', NULL, 524288000, 314572800, 0, 0, 'F4:4E:05:01:BB:03', 'AA:BB:CC:DD:EE:13', NULL, '10.10.2.113', NULL, 'start', NOW() - INTERVAL '30 minutes', NOW()),
    ('radacct-active-014', '80000014', 'guest.priya.bhatt',      NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '5 hours', NOW(), NULL, 18000, 'RADIUS', 'Cisco 802.1X', NULL, 2147483648,1288490188, 0, 0, 'F4:4E:05:01:BB:04', 'AA:BB:CC:DD:EE:14', NULL, '10.10.2.114', NULL, 'start', NOW() - INTERVAL '5 hours', NOW()),
    ('radacct-active-015', '80000015', 'guest.rajesh.gupta',     NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 hour', NOW(), NULL, 3600, 'RADIUS', 'Cisco 802.1X', NULL, 209715200, 125829120, 0, 0, 'F4:4E:05:01:BB:05', 'AA:BB:CC:DD:EE:15', NULL, '10.10.2.115', NULL, 'start', NOW() - INTERVAL '1 hour', NOW()),

    -- ACTIVE sessions from Aruba (192.168.30.1)
    ('radacct-active-021', '80000021', 'guest.aditya.banerjee',  NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 hours 15 min', NOW(), NULL, 8100, 'RADIUS', 'Aruba Open', NULL, 3221225472,1932735283, 0, 0, '2C:EA:D3:01:CC:01', 'AA:BB:CC:DD:EE:21', NULL, '10.10.3.121', NULL, 'start', NOW() - INTERVAL '2 hours 15 min', NOW()),
    ('radacct-active-024', '80000024', 'guest.ritu.chakraborty', NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 hour 45 min', NOW(), NULL, 6300, 'RADIUS', 'Aruba Open', NULL, 2147483648,1288490188, 0, 0, '2C:EA:D3:01:CC:04', 'AA:BB:CC:DD:EE:24', NULL, '10.10.3.124', NULL, 'start', NOW() - INTERVAL '1 hour 45 min', NOW()),
    ('radacct-active-030', '80000030', 'guest.indrani.pal',      NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 hours', NOW(), NULL, 10800, 'RADIUS', 'Aruba Open', NULL, 6442450944,3221225472, 0, 0, '2C:EA:D3:01:CC:10', 'AA:BB:CC:DD:EE:30', NULL, '10.10.3.130', NULL, 'start', NOW() - INTERVAL '3 hours', NOW()),

    -- ACTIVE sessions from Ubiquiti (192.168.40.1)
    ('radacct-active-031', '80000031', 'guest.rohan.khanna',     NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '4 hours', NOW(), NULL, 14400, 'RADIUS', 'UniFi PSK', NULL, 5368709120,3221225472, 0, 0, '78:8A:20:01:DD:01', 'AA:BB:CC:DD:EE:31', NULL, '10.10.4.131', NULL, 'start', NOW() - INTERVAL '4 hours', NOW()),
    ('radacct-active-034', '80000034', 'guest.shreya.bhattacharya',NULL,'192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '6 hours', NOW(), NULL, 21600, 'RADIUS', 'UniFi PSK', NULL, 12884901888,7516192768, 0, 0, '78:8A:20:01:DD:04', 'AA:BB:CC:DD:EE:34', NULL, '10.10.4.134', NULL, 'start', NOW() - INTERVAL '6 hours', NOW());

-- ============================================================================
-- STEP 10: Insert radacct — COMPLETED/HISTORICAL sessions (25 past sessions)
-- ============================================================================
INSERT INTO radacct ("acctuniqueid", "acctsessionid", username, "realm", "nasipaddress", "nasportid", "nasporttype", "acctstarttime", "acctupdatetime", "acctstoptime", "acctsessiontime", "acctauthentic", "connectinfo_start", "connectinfo_stop", "acctinputoctets", "acctoutputoctets", "acctinputgigawords", "acctoutputgigawords", "calledstationid", "callingstationid", "acctterminatecause", "framedipaddress", "framedipv6address", "acctstatus", "createdAt", "updatedAt") VALUES
    -- Completed Mikrotik sessions
    ('radacct-hist-006', '70000006', 'guest.sunita.panda',    NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days 23 hours', 82800, 'RADIUS', 'MikroTik 802.11', 'MikroTik 802.11', 6291456,  4194304, 0, 0, '00:0C:42:01:AA:06', 'AA:BB:CC:DD:EE:06', 'User-Request', '10.10.1.106', NULL, 'stop', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
    ('radacct-hist-009', '70000009', 'guest.suresh.nair',    NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days 20 hours', 100800, 'RADIUS', 'MikroTik 802.11', 'MikroTik 802.11', 314572800,209715200, 0, 0, '00:0C:42:01:AA:09', 'AA:BB:CC:DD:EE:09', 'NAS-Request', '10.10.1.109', NULL, 'stop', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),
    ('radacct-hist-010', '70000010', 'guest.lakshmi.iyer',   NULL, '192.168.10.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours', 43200, 'RADIUS', 'MikroTik 802.11', 'MikroTik 802.11', 14680064, 9437184, 0, 0, '00:0C:42:01:AA:10', 'AA:BB:CC:DD:EE:10', 'Idle-Timeout', '10.10.1.110', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),

    -- Completed Cisco sessions
    ('radacct-hist-016', '70000016', 'guest.neha.kapoor',    NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day 22 hours', 79200, 'RADIUS', 'Cisco 802.1X', 'Cisco 802.1X', 1572864000,943718400, 0, 0, 'F4:4E:05:01:BB:06', 'AA:BB:CC:DD:EE:16', 'User-Request', '10.10.2.116', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('radacct-hist-017', '70000017', 'guest.siddharth.patel',NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours', 36000, 'RADIUS', 'Cisco 802.1X', 'Cisco 802.1X', 314572800, 188743680, 0, 0, 'F4:4E:05:01:BB:07', 'AA:BB:CC:DD:EE:17', 'Admin-Reset', '10.10.2.117', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 hours'),
    ('radacct-hist-018', '70000018', 'guest.anjali.deshmukh',NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days 23 hours', 82800, 'RADIUS', 'Cisco 802.1X', 'Cisco 802.1X', 1782579200,1069547520, 0, 0, 'F4:4E:05:01:BB:08', 'AA:BB:CC:DD:EE:18', 'User-Request', '10.10.2.118', NULL, 'stop', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
    ('radacct-hist-019', '70000019', 'guest.kiran.menon',   NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours', 28800, 'RADIUS', 'Cisco 802.1X', 'Cisco 802.1X', 104857600,  62914560, 0, 0, 'F4:4E:05:01:BB:09', 'AA:BB:CC:DD:EE:19', 'Session-Timeout', '10.10.2.119', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 hours'),
    ('radacct-hist-020', '70000020', 'guest.tanvi.shah',    NULL, '192.168.20.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 6 hours', NOW() - INTERVAL '1 day 6 hours', 64800, 'RADIUS', 'Cisco 802.1X', 'Cisco 802.1X', 943718400, 566231040, 0, 0, 'F4:4E:05:01:BB:10', 'AA:BB:CC:DD:EE:20', 'User-Request', '10.10.2.120', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 6 hours'),

    -- Completed Aruba sessions
    ('radacct-hist-022', '70000022', 'guest.swati.mukherjee',NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days 21 hours', 93600, 'RADIUS', 'Aruba Open', 'Aruba Open', 5368709120,3221225472, 0, 0, '2C:EA:D3:01:CC:02', 'AA:BB:CC:DD:EE:22', 'User-Request', '10.10.3.122', NULL, 'stop', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
    ('radacct-hist-023', '70000023', 'guest.nikhil.sengupta',NULL,'192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '16 hours', NOW() - INTERVAL '16 hours', 28800, 'RADIUS', 'Aruba Open', 'Aruba Open', 1073741824, 644245094, 0, 0, '2C:EA:D3:01:CC:03', 'AA:BB:CC:DD:EE:23', 'Idle-Timeout', '10.10.3.123', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '16 hours'),
    ('radacct-hist-025', '70000025', 'guest.debashis.roy',  NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '20 hours', 14400, 'RADIUS', 'Aruba Open', 'Aruba Open', 838860800, 503316480, 0, 0, '2C:EA:D3:01:CC:05', 'AA:BB:CC:DD:EE:25', 'User-Request', '10.10.3.125', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours'),
    ('radacct-hist-026', '70000026', 'guest.priti.dey',      NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 4 hours', 72000, 'RADIUS', 'Aruba Open', 'Aruba Open', 4294967296,2576980377, 0, 0, '2C:EA:D3:01:CC:06', 'AA:BB:CC:DD:EE:26', 'NAS-Request', '10.10.3.126', NULL, 'stop', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 4 hours'),
    ('radacct-hist-027', '70000027', 'guest.sabyasachi.ghosh',NULL,'192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', 21600, 'RADIUS', 'Aruba Open', 'Aruba Open', 1562378240, 937425728, 0, 0, '2C:EA:D3:01:CC:07', 'AA:BB:CC:DD:EE:27', 'User-Request', '10.10.3.127', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours'),
    ('radacct-hist-028', '70000028', 'guest.madhuri.sinha', NULL, '192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 12 hours', NOW() - INTERVAL '1 day 12 hours', 57600, 'RADIUS', 'Aruba Open', 'Aruba Open', 2684354560,1610612736, 0, 0, '2C:EA:D3:01:CC:08', 'AA:BB:CC:DD:EE:28', 'Session-Timeout', '10.10.3.128', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 12 hours'),
    ('radacct-hist-029', '70000029', 'guest.amitava.majumdar',NULL,'192.168.30.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '18 hours', 21600, 'RADIUS', 'Aruba Open', 'Aruba Open', 1992294400,1195376640, 0, 0, '2C:EA:D3:01:CC:09', 'AA:BB:CC:DD:EE:29', 'Idle-Timeout', '10.10.3.129', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '18 hours'),

    -- Completed Ubiquiti sessions
    ('radacct-hist-032', '70000032', 'guest.isha.tandon',    NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 8 hours', 57600, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 8589934592,5153960755, 0, 0, '78:8A:20:01:DD:02', 'AA:BB:CC:DD:EE:32', 'User-Request', '10.10.4.132', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 8 hours'),
    ('radacct-hist-033', '70000033', 'guest.varun.agarwal',  NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '14 hours', NOW() - INTERVAL '14 hours', 36000, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 2147483648,1288490188, 0, 0, '78:8A:20:01:DD:03', 'AA:BB:CC:DD:EE:33', 'Admin-Reset', '10.10.4.133', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '14 hours'),
    ('radacct-hist-035', '70000035', 'guest.arjun.saxena',   NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '22 hours', NOW() - INTERVAL '22 hours', 7200, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 1073741824, 644245094, 0, 0, '78:8A:20:01:DD:05', 'AA:BB:CC:DD:EE:35', 'Idle-Timeout', '10.10.4.135', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '22 hours'),
    ('radacct-hist-036', '70000036', 'guest.divya.chopra',   NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day 20 hours', 79200, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 6442450944,3865470566, 0, 0, '78:8A:20:01:DD:06', 'AA:BB:CC:DD:EE:36', 'User-Request', '10.10.4.136', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('radacct-hist-037', '70000037', 'guest.karan.malik',   NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', 14400, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 3221225472,1932735283, 0, 0, '78:8A:20:01:DD:07', 'AA:BB:CC:DD:EE:37', 'Session-Timeout', '10.10.4.137', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 hours'),
    ('radacct-hist-038', '70000038', 'guest.nisha.goyal',    NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days 18 hours', 100800, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 9663676416,5798205850, 0, 0, '78:8A:20:01:DD:08', 'AA:BB:CC:DD:EE:38', 'User-Request', '10.10.4.138', NULL, 'stop', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
    ('radacct-hist-039', '70000039', 'guest.tushar.joshi',   NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours', 43200, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 1562378240, 937425728, 0, 0, '78:8A:20:01:DD:09', 'AA:BB:CC:DD:EE:39', 'Idle-Timeout', '10.10.4.139', NULL, 'stop', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 hours'),
    ('radacct-hist-040', '70000040', 'guest.riya.thakur',    NULL, '192.168.40.1', NULL, 'Wireless-802.11', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 10 hours', NOW() - INTERVAL '1 day 10 hours', 46800, 'RADIUS', 'UniFi PSK', 'UniFi PSK', 4294967296,2576980377, 0, 0, '78:8A:20:01:DD:10', 'AA:BB:CC:DD:EE:40', 'NAS-Request', '10.10.4.140', NULL, 'stop', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 10 hours');

-- ============================================================================
-- STEP 11: Insert radpostauth — Auth logs (40 accepts + 8 rejects)
-- ============================================================================
-- Recent auth accepts (last 7 days)
INSERT INTO radpostauth (username, pass, reply, "calledstationid", "callingstationid", authdate, "propertyId", "nasIpAddress") VALUES
    ('guest.sanjay.kumar',     'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:01', 'AA:BB:CC:DD:EE:01', NOW() - INTERVAL '2 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.deepa.sharma',     'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:02', 'AA:BB:CC:DD:EE:02', NOW() - INTERVAL '45 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.ravi.verma',       'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:03', 'AA:BB:CC:DD:EE:03', NOW() - INTERVAL '1 hour', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.anita.mehta',      'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:04', 'AA:BB:CC:DD:EE:04', NOW() - INTERVAL '30 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.prakash.das',      'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:05', 'AA:BB:CC:DD:EE:05', NOW() - INTERVAL '4 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.sunita.panda',     'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:06', 'AA:BB:CC:DD:EE:06', NOW() - INTERVAL '3 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.manish.rao',       'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:07', 'AA:BB:CC:DD:EE:07', NOW() - INTERVAL '1 hour 30 min', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.kavita.jain',      'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:08', 'AA:BB:CC:DD:EE:08', NOW() - INTERVAL '20 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.suresh.nair',      'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:09', 'AA:BB:CC:DD:EE:09', NOW() - INTERVAL '5 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.lakshmi.iyer',     'Welcome@2024', 'Access-Accept', '00:0C:42:01:AA:10', 'AA:BB:CC:DD:EE:10', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.arun.chopra',      'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:01', 'AA:BB:CC:DD:EE:11', NOW() - INTERVAL '3 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.meera.reddy',      'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:02', 'AA:BB:CC:DD:EE:12', NOW() - INTERVAL '2 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.vikas.malhotra',   'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:03', 'AA:BB:CC:DD:EE:13', NOW() - INTERVAL '30 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.priya.bhatt',      'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:04', 'AA:BB:CC:DD:EE:14', NOW() - INTERVAL '5 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.rajesh.gupta',     'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:05', 'AA:BB:CC:DD:EE:15', NOW() - INTERVAL '1 hour', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.neha.kapoor',      'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:06', 'AA:BB:CC:DD:EE:16', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.siddharth.patel',  'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:07', 'AA:BB:CC:DD:EE:17', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.anjali.deshmukh',  'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:08', 'AA:BB:CC:DD:EE:18', NOW() - INTERVAL '4 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.kiran.menon',      'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:09', 'AA:BB:CC:DD:EE:19', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.tanvi.shah',       'Welcome@2024', 'Access-Accept', 'F4:4E:05:01:BB:10', 'AA:BB:CC:DD:EE:20', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.aditya.banerjee',  'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:01', 'AA:BB:CC:DD:EE:21', NOW() - INTERVAL '2 hours 15 min', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.swati.mukherjee',  'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:02', 'AA:BB:CC:DD:EE:22', NOW() - INTERVAL '3 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.nikhil.sengupta',  'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:03', 'AA:BB:CC:DD:EE:23', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.ritu.chakraborty', 'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:04', 'AA:BB:CC:DD:EE:24', NOW() - INTERVAL '1 hour 45 min', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.debashis.roy',    'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:05', 'AA:BB:CC:DD:EE:25', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.priti.dey',       'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:06', 'AA:BB:CC:DD:EE:26', NOW() - INTERVAL '3 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.sabyasachi.ghosh','Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:07', 'AA:BB:CC:DD:EE:27', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.madhuri.sinha',   'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:08', 'AA:BB:CC:DD:EE:28', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.amitava.majumdar','Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:09', 'AA:BB:CC:DD:EE:29', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.indrani.pal',     'Welcome@2024', 'Access-Accept', '2C:EA:D3:01:CC:10', 'AA:BB:CC:DD:EE:30', NOW() - INTERVAL '3 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.rohan.khanna',    'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:01', 'AA:BB:CC:DD:EE:31', NOW() - INTERVAL '4 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.isha.tandon',     'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:02', 'AA:BB:CC:DD:EE:32', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.varun.agarwal',   'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:03', 'AA:BB:CC:DD:EE:33', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.shreya.bhattacharya','Welcome@2024','Access-Accept','78:8A:20:01:DD:04','AA:BB:CC:DD:EE:34',NOW() - INTERVAL '6 hours','281fde73-7836-4511-b644-91f3663d8fcd'::uuid,'192.168.40.1'),
    ('guest.arjun.saxena',    'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:05', 'AA:BB:CC:DD:EE:35', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.divya.chopra',    'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:06', 'AA:BB:CC:DD:EE:36', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.karan.malik',     'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:07', 'AA:BB:CC:DD:EE:37', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.nisha.goyal',     'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:08', 'AA:BB:CC:DD:EE:38', NOW() - INTERVAL '3 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.tushar.joshi',    'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:09', 'AA:BB:CC:DD:EE:39', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('guest.riya.thakur',     'Welcome@2024', 'Access-Accept', '78:8A:20:01:DD:10', 'AA:BB:CC:DD:EE:40', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    -- REJECT entries (wrong password, unknown users)
    ('guest.sanjay.kumar',    'WrongPass123',  'Access-Reject', '00:0C:42:01:AA:01', 'AA:BB:CC:DD:EE:01', NOW() - INTERVAL '2 hours 5 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('unknown.hacker1',       'hack123',       'Access-Reject', '00:0C:42:01:AA:01', 'FF:FF:FF:DD:EE:99', NOW() - INTERVAL '6 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.10.1'),
    ('guest.meera.reddy',     'WrongPass456',  'Access-Reject', 'F4:4E:05:01:BB:02', 'AA:BB:CC:DD:EE:12', NOW() - INTERVAL '2 hours 10 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('unknown.user2',         'password',      'Access-Reject', 'F4:4E:05:01:BB:01', 'FF:FF:FF:DD:EE:98', NOW() - INTERVAL '1 day', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.20.1'),
    ('guest.swati.mukherjee', 'WrongPass789',  'Access-Reject', '2C:EA:D3:01:CC:02', 'AA:BB:CC:DD:EE:22', NOW() - INTERVAL '3 days 5 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('unknown.guest3',        'guest',         'Access-Reject', '2C:EA:D3:01:CC:01', 'FF:FF:FF:DD:EE:97', NOW() - INTERVAL '2 days', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.30.1'),
    ('guest.isha.tandon',     'WrongPass000',  'Access-Reject', '78:8A:20:01:DD:02', 'AA:BB:CC:DD:EE:32', NOW() - INTERVAL '2 days 5 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1'),
    ('unknown.intruder',      'admin123',      'Access-Reject', '78:8A:20:01:DD:01', 'FF:FF:FF:DD:EE:96', NOW() - INTERVAL '4 hours', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, '192.168.40.1');

-- ============================================================================
-- STEP 12: Insert FUP switch log entries (users who exceeded data limits)
-- ============================================================================
-- guest.priya.bhatt (Cisco/Basic) exceeded 2GB daily
-- guest.anjali.deshmukh (Cisco/Basic) exceeded 2GB daily
-- guest.indrani.pal (Aruba/Standard) exceeded 5GB weekly
-- guest.swati.mukherjee (Aruba/Standard) exceeded 5GB weekly
-- guest.shreya.bhattacharya (Ubiquiti/Premium) exceeded 15GB monthly
INSERT INTO fup_switch_log (username, "fup_policy_name", "usage_mb", "limit_mb", "throttle_down_kbps", "throttle_up_kbps", "triggered_at", "property_id", "plan_name", "cycle_type", action, "original_down_kbps", "original_up_kbps", "nas_ip", "created_at") VALUES
    ('guest.priya.bhatt',      'Basic Daily 2GB',    2300.0, 2048.0, 2048, 1024, NOW() - INTERVAL '4 hours 30 minutes', '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'Basic Plan',    'daily',   'throttle', 10000, 5000, '192.168.20.1', NOW() - INTERVAL '4 hours 30 minutes'),
    ('guest.anjali.deshmukh',  'Basic Daily 2GB',    2100.0, 2048.0, 2048, 1024, NOW() - INTERVAL '3 days 2 hours',     '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'Basic Plan',    'daily',   'throttle', 10000, 5000, '192.168.20.1', NOW() - INTERVAL '3 days 2 hours'),
    ('guest.indrani.pal',      'Standard Weekly 5GB',5500.0, 5120.0, 25600, 10240, NOW() - INTERVAL '2 hours',          '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'Standard Plan', 'weekly',  'throttle', 25000, 10000, '192.168.30.1', NOW() - INTERVAL '2 hours'),
    ('guest.swati.mukherjee',  'Standard Weekly 5GB',5800.0, 5120.0, 25600, 10240, NOW() - INTERVAL '2 days 5 hours',   '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'Standard Plan', 'weekly',  'throttle', 25000, 10000, '192.168.30.1', NOW() - INTERVAL '2 days 5 hours'),
    ('guest.shreya.bhattacharya','Premium Monthly 15GB',16000.0,15360.0,51200,25600,NOW() - INTERVAL '5 hours',          '281fde73-7836-4511-b644-91f3663d8fcd'::uuid, 'Premium Plan', 'monthly', 'throttle', 50000, 25000, '192.168.40.1', NOW() - INTERVAL '5 hours');

-- ============================================================================
-- STEP 13: Insert data_usage_by_period (daily aggregation for active users)
-- ============================================================================
INSERT INTO data_usage_by_period (username, "period_start", "period_end", "acctinputoctets", "acctoutputoctets") VALUES
    ('guest.sanjay.kumar',   date_trunc('day', NOW()), NOW(), 52428800, 36700160),
    ('guest.deepa.sharma',   date_trunc('day', NOW()), NOW(), 10485760,  7864320),
    ('guest.ravi.verma',     date_trunc('day', NOW()), NOW(), 15728640, 10485760),
    ('guest.anita.mehta',    date_trunc('day', NOW()), NOW(), 8388608,  6291456),
    ('guest.prakash.das',    date_trunc('day', NOW()), NOW(), 209715200,146800640),
    ('guest.manish.rao',     date_trunc('day', NOW()), NOW(), 36700160, 25585280),
    ('guest.kavita.jain',    date_trunc('day', NOW()), NOW(), 10485760,  7340032),
    ('guest.arun.chopra',    date_trunc('day', NOW()), NOW(), 838860800,524288000),
    ('guest.meera.reddy',    date_trunc('day', NOW()), NOW(), 1073741824,644245094),
    ('guest.vikas.malhotra', date_trunc('day', NOW()), NOW(), 524288000,314572800),
    ('guest.priya.bhatt',    date_trunc('day', NOW()), NOW(), 2147483648,1288490188),
    ('guest.rajesh.gupta',   date_trunc('day', NOW()), NOW(), 209715200,125829120),
    ('guest.aditya.banerjee',date_trunc('day', NOW()), NOW(), 3221225472,1932735283),
    ('guest.ritu.chakraborty',date_trunc('day',NOW()), NOW(), 2147483648,1288490188),
    ('guest.indrani.pal',    date_trunc('day', NOW()), NOW(), 6442450944,3221225472),
    ('guest.rohan.khanna',   date_trunc('day', NOW()), NOW(), 5368709120,3221225472),
    ('guest.shreya.bhattacharya',date_trunc('day',NOW()), NOW(), 12884901888,7516192768);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm data)
-- ============================================================================
-- SELECT 'NAS entries' as check, COUNT(*) FROM nas;
-- SELECT 'FUP policies' as check, COUNT(*) FROM "FairAccessPolicy";
-- SELECT 'WiFi Users' as check, COUNT(*) FROM "WiFiUser" WHERE id LIKE 'u0000%';
-- SELECT 'radcheck' as check, COUNT(*) FROM radcheck WHERE id LIKE 'rc0000%';
-- SELECT 'radreply' as check, COUNT(*) FROM radreply WHERE id LIKE 'rr0000%';
-- SELECT 'radusergroup' as check, COUNT(*) FROM radusergroup WHERE id LIKE 'rg0000%';
-- SELECT 'Active sessions (radacct)' as check, COUNT(*) FROM radacct WHERE "acctstoptime" IS NULL;
-- SELECT 'Completed sessions (radacct)' as check, COUNT(*) FROM radacct WHERE "acctstoptime" IS NOT NULL;
-- SELECT 'Auth Accept' as check, COUNT(*) FROM radpostauth WHERE reply = 'Access-Accept';
-- SELECT 'Auth Reject' as check, COUNT(*) FROM radpostauth WHERE reply = 'Access-Reject';
-- SELECT 'FUP events' as check, COUNT(*) FROM fup_switch_log;
-- SELECT 'Active Users view' as check, COUNT(*) FROM v_active_sessions;
-- SELECT 'Session History view' as check, COUNT(*) FROM v_session_history;
-- SELECT 'Auth Logs view' as check, COUNT(*) FROM v_auth_logs;
-- SELECT 'WiFi Users view' as check, COUNT(*) FROM v_wifi_users WHERE id LIKE 'u0000%';
-- SELECT 'User Usage view' as check, COUNT(*) FROM v_user_usage WHERE "planId" IS NOT NULL;
