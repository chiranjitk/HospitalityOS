#!/bin/bash
# Start DHCP and DNS mini-services for sandbox dev environment
# Usage: bash start-services.sh

PROJECT_ROOT="/home/z/my-project"
DHCP_DIR="$PROJECT_ROOT/mini-services/dhcp-service"
DNS_DIR="$PROJECT_ROOT/mini-services/dns-service"

# Kill existing instances
pkill -f "bun.*dhcp-service/index" 2>/dev/null
pkill -f "bun.*dns-service/index" 2>/dev/null
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

echo ""
echo "PIDs: dhcp=$DHCP_PID dns=$DNS_PID"
