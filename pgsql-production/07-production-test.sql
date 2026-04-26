-- ============================================================================
-- StaySuite — Full Production Test: 40 Users, 6 Plans, All Scenarios
-- ============================================================================
-- All RADIUS data goes to PostgreSQL. FreeRADIUS reads from PG.
-- Clears old test data first, then seeds 40 users across 6 plans.
--
-- SCENARIOS COVERED:
--   1. Free Plan: 8 users, Simul=1, 5M/2M, no data limit
--   2. Basic Plan: 7 users, Simul=2, 10M/5M, 2GB data limit
--   3. Standard Plan: 7 users, Simul=3, 25M/10M, 5GB data limit
--   4. Premium Plan: 7 users, Simul=4, 50M/25M, 15GB data limit
--   5. VIP Plan: 6 users, Simul=5, 100M/50M, unlimited
--   6. Conference Plan: 5 users, Simul=2, 30M/15M, 10GB data limit
--
-- Also creates: FUP switch log table, advanced check functions,
-- updated views with property_id, speed, plan info.
-- ============================================================================

BEGIN;

-- ============================================================================
-- CLEAN OLD TEST DATA
-- ============================================================================
DELETE FROM radpostauth;
DELETE FROM radacct;
DELETE FROM radreply;
DELETE FROM radcheck WHERE username LIKE 'guest.test%';
DELETE FROM radusergroup WHERE username LIKE 'guest.test%';
DELETE FROM "WiFiUser" WHERE username LIKE 'guest.test%';

-- ============================================================================
-- INSERT 40 TEST USERS — radcheck (credentials)
-- ============================================================================
INSERT INTO radcheck (username, attribute, op, value) VALUES
  -- Group 1: Free Plan (8 users, Simul=1, 5M/2M)
  ('guest.test01', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test02', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test03', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test04', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test05', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test06', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test07', 'Cleartext-Password', ':=', 'Free@123'),
  ('guest.test08', 'Cleartext-Password', ':=', 'Free@123'),
  -- Group 2: Basic Plan (7 users, Simul=2, 10M/5M, 2GB)
  ('guest.test09',  'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test10', 'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test11', 'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test12', 'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test13', 'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test14', 'Cleartext-Password', ':=', 'Basic@123'),
  ('guest.test15', 'Cleartext-Password', ':=', 'Basic@123'),
  -- Group 3: Standard Plan (7 users, Simul=3, 25M/10M, 5GB)
  ('guest.test16', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test17', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test18', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test19', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test20', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test21', 'Cleartext-Password', ':=', 'Standard@123'),
  ('guest.test22', 'Cleartext-Password', ':=', 'Standard@123'),
  -- Group 4: Premium Plan (7 users, Simul=4, 50M/25M, 15GB)
  ('guest.test23', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test24', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test25', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test26', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test27', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test28', 'Cleartext-Password', ':=', 'Premium@123'),
  ('guest.test29', 'Cleartext-Password', ':=', 'Premium@123'),
  -- Group 5: VIP Plan (6 users, Simul=5, 100M/50M, unlimited)
  ('guest.test30', 'Cleartext-Password', ':=', 'VIP@123'),
  ('guest.test31', 'Cleartext-Password', ':=', 'VIP@123'),
  ('guest.test32', 'Cleartext-Password', ':=', 'VIP@123'),
  ('guest.test33', 'Cleartext-Password', ':=', 'VIP@123'),
  ('guest.test34', 'Cleartext-Password', ':=', 'VIP@123'),
  ('guest.test35', 'Cleartext-Password', ':=', 'VIP@123'),
  -- Group 6: Conference Plan (5 users, Simul=2, 30M/15M, 10GB)
  ('guest.test36', 'Cleartext-Password', ':=', 'Conf@123'),
  ('guest.test37', 'Cleartext-Password', ':=', 'Conf@123'),
  ('guest.test38', 'Cleartext-Password', ':=', 'Conf@123'),
  ('guest.test39', 'Cleartext-Password', ':=', 'Conf@123'),
  ('guest.test40', 'Cleartext-Password', ':=', 'Conf@123');

-- ============================================================================
-- INSERT radusergroup — plan/group mapping
-- ============================================================================
INSERT INTO radusergroup (username, groupname, priority) VALUES
  -- Free (wifi-free, Simul=1)
  ('guest.test01', 'wifi-free', 0),
  ('guest.test02', 'wifi-free', 0),
  ('guest.test03', 'wifi-free', 0),
  ('guest.test04', 'wifi-free', 0),
  ('guest.test05', 'wifi-free', 0),
  ('guest.test06', 'wifi-free', 0),
  ('guest.test07', 'wifi-free', 0),
  ('guest.test08', 'wifi-free', 0),
  -- Basic (wifi-basic, Simul=2)
  ('guest.test09',  'wifi-basic', 0),
  ('guest.test10', 'wifi-basic', 0),
  ('guest.test11', 'wifi-basic', 0),
  ('guest.test12', 'wifi-basic', 0),
  ('guest.test13', 'wifi-basic', 0),
  ('guest.test14', 'wifi-basic', 0),
  ('guest.test15', 'wifi-basic', 0),
  -- Standard (wifi-standard, Simul=3)
  ('guest.test16', 'wifi-standard', 0),
  ('guest.test17', 'wifi-standard', 0),
  ('guest.test18', 'wifi-standard', 0),
  ('guest.test19', 'wifi-standard', 0),
  ('guest.test20', 'wifi-standard', 0),
  ('guest.test21', 'wifi-standard', 0),
  ('guest.test22', 'wifi-standard', 0),
  -- Premium (wifi-premium, Simul=4)
  ('guest.test23', 'wifi-premium', 0),
  ('guest.test24', 'wifi-premium', 0),
  ('guest.test25', 'wifi-premium', 0),
  ('guest.test26', 'wifi-premium', 0),
  ('guest.test27', 'wifi-premium', 0),
  ('guest.test28', 'wifi-premium', 0),
  ('guest.test29', 'wifi-premium', 0),
  -- VIP (wifi-vip, Simul=5)
  ('guest.test30', 'wifi-vip', 0),
  ('guest.test31', 'wifi-vip', 0),
  ('guest.test32', 'wifi-vip', 0),
  ('guest.test33', 'wifi-vip', 0),
  ('guest.test34', 'wifi-vip', 0),
  ('guest.test35', 'wifi-vip', 0),
  -- Conference (wifi-conference, Simul=2)
  ('guest.test36', 'wifi-conference', 0),
  ('guest.test37', 'wifi-conference', 0),
  ('guest.test38', 'wifi-conference', 0),
  ('guest.test39', 'wifi-conference', 0),
  ('guest.test40', 'wifi-conference', 0);

-- ============================================================================
-- INSERT WiFiUser entries (Prisma table)
-- ============================================================================
INSERT INTO "WiFiUser" (id, "tenantId", "propertyId", username, password, "planId", "validFrom", "validUntil", status, "maxSessions", "createdAt", "updatedAt") VALUES
  ('b0000001-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test01', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test02', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test03', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test04', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test05', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test06', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000007', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test07', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000001-0001-0000-0000-000000000008', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test08', 'Free@123',    '10000001-0000-0000-0000-000000000001', now(), now()+interval '90 days', 'active', 1, now(), now()),
  ('b0000002-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test09',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test10',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test11',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test12',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test13',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test14',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000002-0001-0000-0000-000000000007', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test15',  'Basic@123',    '10000002-0000-0000-0000-000000000002', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000003-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test16', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test17', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test18', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test19', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test20', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test21', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000003-0001-0000-0000-000000000007', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test22', 'Standard@123','10000003-0000-0000-0000-000000000003', now(), now()+interval '90 days', 'active', 3, now(), now()),
  ('b0000004-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test23', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test24', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test25', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test26', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test27', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test28', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000004-0001-0000-0000-000000000007', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test29', 'Premium@123', '10000004-0000-0000-0000-000000000004', now(), now()+interval '90 days', 'active', 4, now(), now()),
  ('b0000005-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test30', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000005-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test31', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000005-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test32', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000005-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test33', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000005-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test34', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000005-0001-0000-0000-000000000006', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '281fde73-7836-4511-b644-91f3663d8fcd', 'guest.test35', 'VIP@123',     '10000005-0000-0000-0000-000000000005', now(), now()+interval '90 days', 'active', 5, now(), now()),
  ('b0000006-0001-0000-0000-000000000001', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '600daed4-4d6a-4cb2-a07e-46bec7f4c43b', 'guest.test36', 'Conf@123',    '10000006-0000-0000-0000-000000000006', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000006-0001-0000-0000-000000000002', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '600daed4-4d6a-4cb2-a07e-46bec7f4c43b', 'guest.test37', 'Conf@123',    '10000006-0000-0000-0000-000000000006', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000006-0001-0000-0000-000000000003', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '600daed4-4d6a-4cb2-a07e-46bec7f4c43b', 'guest.test38', 'Conf@123',    '10000006-0000-0000-0000-000000000006', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000006-0001-0000-0000-000000000004', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '600daed4-4d6a-4cb2-a07e-46bec7f4c43b', 'guest.test39', 'Conf@123',    '10000006-0000-0000-0000-000000000006', now(), now()+interval '90 days', 'active', 2, now(), now()),
  ('b0000006-0001-0000-0000-000000000005', '444017d5-e022-4c5f-ac07-ea0d51f4609b', '600daed4-4d6a-4cb2-a07e-46bec7f4c43b', 'guest.test40', 'Conf@123',    '10000006-0000-0000-0000-000000000006', now(), now()+interval '90 days', 'active', 2, now(), now());

-- ============================================================================
-- UPDATE existing user plans for property_id consistency
-- ============================================================================
UPDATE "WiFiUser" SET "maxSessions" = 1 WHERE "planId" = '10000001-0000-0000-0000-000000000001' AND "maxSessions" IS NULL OR "maxSessions" = 0;
UPDATE "WiFiUser" SET "maxSessions" = 2 WHERE "planId" = '10000002-0000-0000-0000-000000000002' AND ("maxSessions" IS NULL OR "maxSessions" = 0);
UPDATE "WiFiUser" SET "maxSessions" = 3 WHERE "planId" = '10000003-0000-0000-0000-000000000003' AND ("maxSessions" IS NULL OR "maxSessions" = 0);
UPDATE "WiFiUser" SET "maxSessions" = 4 WHERE "planId" = '10000004-0000-0000-0000-000000000004' AND ("maxSessions" IS NULL OR "maxSessions" = 0);
UPDATE "WiFiUser" SET "maxSessions" = 5 WHERE "planId" = '10000005-0000-0000-0000-000000000005' AND ("maxSessions" IS NULL OR "maxSessions" = 0);
UPDATE "WiFiUser" SET "maxSessions" = 2 WHERE "planId" = '10000006-0000-0000-0000-000000000006' AND ("maxSessions" IS NULL OR "maxSessions" = 0);

-- ============================================================================
-- FUP SWITCH LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fup_switch_log (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    fup_policy_name TEXT,
    usage_mb FLOAT DEFAULT 0,
    limit_mb FLOAT DEFAULT 0,
    throttle_down_kbps INT DEFAULT 0,
    throttle_up_kbps INT DEFAULT 0,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    property_id UUID
);
CREATE INDEX IF NOT EXISTS fup_switch_log_username_idx ON fup_switch_log(username);
CREATE INDEX IF NOT EXISTS fup_switch_log_triggered_idx ON fup_switch_log(triggered_at);

-- ============================================================================
-- ADVANCED FUNCTIONS: FUP check, login limit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_fup(p_username text)
RETURNS TABLE(
  fup_triggered boolean,
  throttle_down int,
  throttle_up int,
  policy_name text,
  usage_mb float,
  limit_mb float
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_plan_id UUID;
  v_fup_id UUID;
  v_fup_name TEXT;
  v_fup_limit_mb FLOAT;
  v_usage_mb FLOAT;
  v_throttle_bp_id UUID;
  v_throttle_down INT;
  v_throttle_up INT;
BEGIN
  SELECT wp.id, wp."fupPolicyId"
  INTO v_plan_id, v_fup_id
  FROM "WiFiUser" wu
  LEFT JOIN "WiFiPlan" wp ON wu."planId" = wp.id
  WHERE wu.username = p_username AND wu.status = 'active'
  LIMIT 1;

  IF v_fup_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float;
    RETURN;
  END IF;

  SELECT name, "dataLimitMb", "switchOverBwPolicyId"
  INTO v_fup_name, v_fup_limit_mb, v_throttle_bp_id
  FROM "FairAccessPolicy"
  WHERE id = v_fup_id AND "isEnabled" = true;

  IF v_fup_name IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, ''::text, 0.0::float, 0.0::float;
    RETURN;
  END IF;

  SELECT (COALESCE(wu."totalBytesIn", 0) + COALESCE(wu."totalBytesOut", 0)) / (1024.0 * 1024.0)
  INTO v_usage_mb
  FROM "WiFiUser" wu
  WHERE wu.username = p_username LIMIT 1;

  IF v_usage_mb IS NULL OR v_usage_mb = 0 THEN
    SELECT COALESCE(SUM(COALESCE(acctinputoctets, 0) + COALESCE(acctoutputoctets, 0)), 0) / (1024.0 * 1024.0)
    INTO v_usage_mb
    FROM radacct WHERE username = p_username AND acctstarttime >= now() - interval '30 days';
  END IF;

  IF v_usage_mb >= v_fup_limit_mb THEN
    IF v_throttle_bp_id IS NOT NULL THEN
      SELECT "downloadKbps", "uploadKbps" INTO v_throttle_down, v_throttle_up
      FROM "BandwidthPolicy" WHERE id = v_throttle_bp_id LIMIT 1;
    END IF;
    v_throttle_down := COALESCE(v_throttle_down, 1024);
    v_throttle_up := COALESCE(v_throttle_up, 512);
    RETURN QUERY SELECT true, v_throttle_down, v_throttle_up, v_fup_name, v_usage_mb, v_fup_limit_mb;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0, 0, v_fup_name, v_usage_mb, v_fup_limit_mb;
  RETURN;
END;
$$;

-- ============================================================================
-- UPDATED VIEW: v_auth_logs — adds property_id, plan info, speed
-- ============================================================================
CREATE OR REPLACE VIEW v_auth_logs AS
SELECT (pa.id)::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    COALESCE(REPLACE(acct."framedipaddress"::text, '/32', ''), ''::text) AS client_ip_address,
    COALESCE(pa.nasipaddress::text, ''::text) AS nas_ip_address,
    COALESCE(pa.callingstationid, ''::text) AS calling_station_id,
    COALESCE(pa.calledstationid, ''::text) AS called_station_id,
    'PAP'::text AS auth_type,
    CASE WHEN (pa.reply = 'Access-Accept'::text) THEN
        CASE WHEN COALESCE(REPLACE(acct."framedipaddress"::text, '/32', ''), ''::text) != ''::text
             THEN 'Authenticated — client IP: ' || REPLACE(acct."framedipaddress"::text, '/32', '')
        WHEN COALESCE(pa.nasipaddress::text, ''::text) != ''::text
             THEN 'Authenticated from NAS ' || pa.nasipaddress::text
             ELSE 'Authenticated successfully'::text END
    ELSE
        CASE WHEN (wu.id IS NOT NULL) THEN 'Authentication rejected — invalid password'::text
             ELSE 'Authentication rejected — user not found'::text END
    END AS reply_message,
    COALESCE(g."firstName", ''::text) AS guest_first_name,
    COALESCE(g."lastName", ''::text) AS guest_last_name,
    COALESCE(rm.number, ''::text) AS room_number,
    COALESCE(p.name, ''::text) AS property_name,
    COALESCE(u."propertyId", ''::text) AS property_id,
    rg.groupname AS radius_group,
    wp.name AS plan_name,
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit
   FROM ((((((((radpostauth pa
     LEFT JOIN LATERAL (
         SELECT "framedipaddress"
         FROM radacct
         WHERE username = pa.username
         ORDER BY "acctstarttime" DESC LIMIT 1
     ) acct ON true
     LEFT JOIN "WiFiUser" u ON pa.username = u.username)
     LEFT JOIN "WiFiUser" wu ON pa.username = wu.username)
     LEFT JOIN "Guest" g ON u."guestId" = g.id)
     LEFT JOIN "Booking" b ON u."bookingId" = b.id)
     LEFT JOIN "Room" rm ON b."roomId" = rm.id)
     LEFT JOIN "Property" p ON u."propertyId" = p.id)
     LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id)
     LEFT JOIN radusergroup rg ON pa.username = rg.username);

-- ============================================================================
-- FUP SWITCH LOG VIEW
-- ============================================================================
CREATE OR REPLACE VIEW v_fup_switch_logs AS
SELECT fsl.id::text,
    fsl.username,
    fsl.fup_policy_name,
    fsl.usage_mb,
    fsl.limit_mb,
    fsl.throttle_down_kbps,
    fsl.throttle_up_kbps,
    fsl.triggered_at,
    COALESCE(p.name, '') AS property_name,
    wp.name AS plan_name,
    rg.groupname AS radius_group
FROM fup_switch_log fsl
LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
LEFT JOIN "Property" p ON p.id = fsl.property_id
LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
LEFT JOIN radusergroup rg ON rg.username = fsl.username
ORDER BY fsl.triggered_at DESC;

COMMIT;
