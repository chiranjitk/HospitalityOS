#!/bin/bash
# Start DHCP, DNS, and IPDR mini-services for sandbox dev environment
# Usage: bash start-services.sh

PROJECT_ROOT="/home/z/my-project"
DHCP_DIR="$PROJECT_ROOT/mini-services/dhcp-service"
DNS_DIR="$PROJECT_ROOT/mini-services/dns-service"
CONNTRACK_DIR="$PROJECT_ROOT/mini-services/conntrack-bridge"
DNS_PARSER_DIR="$PROJECT_ROOT/mini-services/dns-parser"
SNI_PARSER_DIR="$PROJECT_ROOT/mini-services/sni-parser"

# Kill existing instances
pkill -f "bun.*dhcp-service/index" 2>/dev/null
pkill -f "bun.*dns-service/index" 2>/dev/null
pkill -f "bun.*conntrack-bridge/index" 2>/dev/null
pkill -f "bun.*dns-parser/index" 2>/dev/null
pkill -f "bun.*sni-parser/index" 2>/dev/null
sleep 1

# Start DHCP Service (port 3011)
cd "$DHCP_DIR"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/staysuite" \
PROJECT_ROOT="$PROJECT_ROOT" \
DNSMASQ_CONF_DIR="$PROJECT_ROOT/dhcp-local" \
DNSMASQ_LEASES="/tmp/dnsmasq-dhcp.leases" \
nohup bun index.ts >> /tmp/dhcp-service.log 2>&1 &
DHCP_PID=$!
echo "DHCP Service started (PID: $DHCP_PID, Port: 3011)"

# Start DNS Service (port 3012)
cd "$DNS_DIR"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/staysuite" \
PROJECT_ROOT="$PROJECT_ROOT" \
DNSMASQ_CONFIG_DIR="$PROJECT_ROOT/dns-local" \
nohup bun index.ts >> /tmp/dns-service.log 2>&1 &
DNS_PID=$!
echo "DNS Service started (PID: $DNS_PID, Port: 3012)"

# Start conntrack-bridge Service (port 3020)
cd "$CONNTRACK_DIR"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://127.0.0.1:8123}" \
nohup bun index.ts >> /tmp/conntrack-bridge.log 2>&1 &
CONNTRACK_PID=$!
echo "conntrack-bridge Service started (PID: $CONNTRACK_PID, Port: 3020)"

# Start dns-parser Service (port 3021)
cd "$DNS_PARSER_DIR"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://127.0.0.1:8123}" \
DNS_LOG_FILE="${DNS_LOG_FILE:-/var/log/dns-queries.log}" \
nohup bun index.ts >> /tmp/dns-parser.log 2>&1 &
DNS_PARSER_PID=$!
echo "dns-parser Service started (PID: $DNS_PARSER_PID, Port: 3021)"

# Start sni-parser Service (port 3022)
cd "$SNI_PARSER_DIR"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://127.0.0.1:8123}" \
SNI_LOG_FILE="${SNI_LOG_FILE:-/var/log/sni-queries.log}" \
nohup bun index.ts >> /tmp/sni-parser.log 2>&1 &
SNI_PARSER_PID=$!
echo "sni-parser Service started (PID: $SNI_PARSER_PID, Port: 3022)"

# Wait and verify
sleep 5

echo ""
echo "=== Health Checks ==="

DHCP_HEALTH=$(curl -s --max-time 3 http://localhost:3011/health 2>/dev/null)
if [ -n "$DHCP_HEALTH" ]; then
  echo "DHCP Service: HEALTHY ✓"
else
  echo "DHCP Service: NOT RESPONDING ✗"
  echo "  Check logs: tail -20 /tmp/dhcp-service.log"
fi

DNS_HEALTH=$(curl -s --max-time 3 http://localhost:3012/health 2>/dev/null)
if [ -n "$DNS_HEALTH" ]; then
  echo "DNS Service: HEALTHY ✓"
else
  echo "DNS Service: NOT RESPONDING ✗"
  echo "  Check logs: tail -20 /tmp/dns-service.log"
fi

CONNTRACK_HEALTH=$(curl -s --max-time 3 http://localhost:3020/api/health 2>/dev/null)
if [ -n "$CONNTRACK_HEALTH" ]; then
  echo "conntrack-bridge Service: HEALTHY ✓"
else
  echo "conntrack-bridge Service: NOT RESPONDING ✗"
  echo "  Check logs: tail -20 /tmp/conntrack-bridge.log"
fi

DNS_PARSER_HEALTH=$(curl -s --max-time 3 http://localhost:3021/api/health 2>/dev/null)
if [ -n "$DNS_PARSER_HEALTH" ]; then
  echo "dns-parser Service: HEALTHY ✓"
else
  echo "dns-parser Service: NOT RESPONDING ✗"
  echo "  Check logs: tail -20 /tmp/dns-parser.log"
fi

SNI_PARSER_HEALTH=$(curl -s --max-time 3 http://localhost:3022/api/health 2>/dev/null)
if [ -n "$SNI_PARSER_HEALTH" ]; then
  echo "sni-parser Service: HEALTHY ✓"
else
  echo "sni-parser Service: NOT RESPONDING ✗"
  echo "  Check logs: tail -20 /tmp/sni-parser.log"
fi

echo ""
echo "PIDs: dhcp=$DHCP_PID dns=$DNS_PID conntrack=$CONNTRACK_PID dns-parser=$DNS_PARSER_PID sni-parser=$SNI_PARSER_PID"
