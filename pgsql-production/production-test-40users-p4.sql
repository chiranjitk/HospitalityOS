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
