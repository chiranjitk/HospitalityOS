-- ================================================================
-- nftables-service Database Tables
-- Mini-service: mini-services/nftables-service (port 3013)
--
-- These tables replace JSON file persistence with PostgreSQL
-- for the nftables firewall management service.
--
-- Apply: psql -h localhost -U postgres -d staysuite -f nftables-service-tables.sql
-- ================================================================

-- 1. GUI Firewall Rules (main rules stored by nftables-service)
CREATE TABLE IF NOT EXISTS "NftGuiRule" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  "chain"     TEXT NOT NULL CHECK ("chain" IN ('firewallchains','firewallchainsdn','firewallchains_conn','firewallchainsdn_conn','frchainspre','frchainspost')),
  protocol    TEXT NOT NULL DEFAULT 'tcp',
  "sourceIp"  TEXT,
  "destIp"    TEXT,
  "destPort"  TEXT,
  "sourcePort" TEXT,
  action      TEXT NOT NULL CHECK (action IN ('accept','drop','reject','log','mark','dnat','snat','masquerade')),
  "markValue" INTEGER,
  "dnatTo"    TEXT,
  "snatTo"    TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  comment     TEXT,
  priority    INTEGER NOT NULL DEFAULT 0,
  handle      INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NftGuiRule_chain_idx" ON "NftGuiRule"("chain");
CREATE INDEX IF NOT EXISTS "NftGuiRule_enabled_idx" ON "NftGuiRule"(enabled);
CREATE INDEX IF NOT EXISTS "NftGuiRule_priority_idx" ON "NftGuiRule"(priority);

-- 2. Port Forwarding Rules
CREATE TABLE IF NOT EXISTS "NftPortForward" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  protocol      TEXT NOT NULL CHECK (protocol IN ('tcp','udp','both')),
  "externalPort" INTEGER NOT NULL,
  "internalIp"  TEXT NOT NULL,
  "internalPort" INTEGER NOT NULL,
  "sourceIp"    TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  comment       TEXT,
  handle        INTEGER,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NftPortForward_enabled_idx" ON "NftPortForward"(enabled);

-- 3. Rate Limiting Rules
CREATE TABLE IF NOT EXISTS "NftRateLimit" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  "targetIp"      TEXT,
  "targetSet"     TEXT,
  "downloadRate"  TEXT NOT NULL,
  "uploadRate"    TEXT NOT NULL,
  protocol        TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  comment         TEXT,
  "downloadHandle" INTEGER,
  "uploadHandle"  INTEGER,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NftRateLimit_enabled_idx" ON "NftRateLimit"(enabled);

-- 4. Quick Block (IP/Subnet/MAC)
CREATE TABLE IF NOT EXISTS "NftQuickBlock" (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('ip','subnet','mac')),
  value      TEXT NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  handle     INTEGER,
  "blockedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NftQuickBlock_type_idx" ON "NftQuickBlock"(type);

-- 5. Firewall Schedules
CREATE TABLE IF NOT EXISTS "NftSchedule" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  days            TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
  "startTime"     TEXT NOT NULL DEFAULT '00:00',
  "endTime"       TEXT NOT NULL DEFAULT '23:59',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  "linkedRuleIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NftSchedule_enabled_idx" ON "NftSchedule"(enabled);
