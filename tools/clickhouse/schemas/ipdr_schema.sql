-- StaySuite IPDR Database Schema
-- For TRAI IPDR Act compliance (13-month retention)
--
-- Architecture (2 trusted sources only):
--   1. conntrack → ipdr.nat_log    (bytes, packets, all connections)
--   2. NFLOG 443 SYN → ipdr.sni_log (TLS SNI domains)
--
-- WHY NOT DNS logs (dnsmasq)?
--   DNS logs are NOT a trusted source. If a user changes their global DNS
--   (e.g., 8.8.8.8, 1.1.1.1, 9.9.9.9), those queries BYPASS dnsmasq entirely.
--   SNI is captured from the TLS ClientHello at the network layer via NFLOG,
--   so it's reliable regardless of the user's DNS configuration.

CREATE DATABASE IF NOT EXISTS ipdr;

-- ─── 1. NAT Connection Log (from conntrack-bridge) ──────────────
-- Records every tracked connection: NEW, UPDATE, DESTROY events
-- with byte counts, packet counts, NAT tuples, and duration.
CREATE TABLE IF NOT EXISTS ipdr.nat_log (
  timestamp DateTime,
  proto String,
  event_type String,
  conntrack_id UInt64,
  src_ip String,
  src_port UInt16,
  dst_ip String,
  dst_port UInt16,
  nat_src_ip String,
  nat_src_port UInt16,
  nat_dst_ip String,
  nat_dst_port UInt16,
  bytes UInt64,
  packets UInt64,
  duration Float64,
  status String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, proto, src_ip, dst_ip)
TTL timestamp + INTERVAL 13 MONTH;

-- ─── 2. TLS SNI Log (from sni-parser via NFLOG port 443 SYN) ────
-- Captures the Server Name Indication from TLS ClientHello packets.
-- This is the TRUSTED source for domain identification because:
--   - Every HTTPS connection MUST send SNI in plaintext
--   - Cannot be bypassed even with custom/encrypted DNS
--   - Works regardless of DOH/DOT/DNS-over-HTTPS settings
-- Used to enrich nat_log with domain names and build web surfing reports.
CREATE TABLE IF NOT EXISTS ipdr.sni_log (
  timestamp DateTime,
  src_ip String,
  dst_ip String,
  dst_port UInt16,
  sni_domain String,
  tls_version String,
  ja3_hash String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, src_ip, sni_domain)
TTL timestamp + INTERVAL 13 MONTH;

-- ─── NO dns_cache table ─────────────────────────────────────────
-- Removed because dnsmasq DNS logs are unreliable:
--   - Users can set custom DNS (8.8.8.8, 1.1.1.1) → queries bypass dnsmasq
--   - DNS-over-HTTPS (DOH) and DNS-over-TLS (DOT) bypass local resolver
--   - SNI from NFLOG is the correct and complete source for domain data

-- ─── NO web_surfing_report table ────────────────────────────────
-- Removed — web surfing reports are now built dynamically by joining
-- ipdr.sni_log (domains) + ipdr.nat_log (bytes) at query time.
-- This avoids stale pre-aggregated data and provides accurate results.
