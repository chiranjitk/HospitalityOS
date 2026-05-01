-- StaySuite IPDR Database Schema
-- For TRAI IPDR Act compliance (13-month retention)

CREATE DATABASE IF NOT EXISTS ipdr;

-- Main NAT connection log (from conntrack-bridge)
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

-- DNS query cache (from dns-parser)
CREATE TABLE IF NOT EXISTS ipdr.dns_cache (
  timestamp DateTime,
  src_ip String,
  domain String,
  query_type String,
  query_type_num UInt16,
  dns_server String,
  response_ips String,
  ttl UInt32 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, src_ip, domain)
TTL timestamp + INTERVAL 7 DAY;

-- TLS SNI cache (from sni-parser)
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
TTL timestamp + INTERVAL 7 DAY;

-- Pre-aggregated web surfing report
CREATE TABLE IF NOT EXISTS ipdr.web_surfing_report (
  date Date,
  domain String,
  category String,
  src_ip String,
  visit_count UInt64,
  total_bytes UInt64,
  unique_hours UInt8,
  first_seen DateTime,
  last_seen DateTime
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, domain, src_ip, category)
TTL date + INTERVAL 30 DAY;
