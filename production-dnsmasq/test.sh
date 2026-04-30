#!/bin/bash
# ============================================================
# StaySuite dnsmasq — Full Test Suite
# ============================================================
# Tests DNS resolution and validates config syntax
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DNSMASQ_BIN="$SCRIPT_DIR/src/dnsmasq"
DEV_CONF="$SCRIPT_DIR/etc/dnsmasq-dev.conf"
PROD_CONF="$SCRIPT_DIR/etc/dnsmasq.conf"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$SCRIPT_DIR/logs" "$SCRIPT_DIR/run"

# Ensure dnsmasq is running
if ! pgrep -f "production-dnsmasq/src/dnsmasq" > /dev/null 2>&1; then
  echo -e "${YELLOW}Starting dnsmasq for testing...${NC}"
  bash "$SCRIPT_DIR/start.sh" 2>&1 | tail -1
  sleep 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   StaySuite dnsmasq 2.90 — Full Test Suite          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Config Syntax Tests ──
echo -e "${YELLOW}━━━ Config Syntax Validation ━━━${NC}"
echo ""

echo -n "  Production config (DHCP + DNS):  "
if $DNSMASQ_BIN -C "$PROD_CONF" --test 2>&1 | grep -q "OK"; then
  echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}"; ((FAIL++))
fi

echo -n "  Dev config (DNS only):           "
if $DNSMASQ_BIN -C "$DEV_CONF" --test 2>&1 | grep -q "OK"; then
  echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}"; ((FAIL++))
fi

# ── 2. DHCP Config File Check ──
echo ""
echo -e "${YELLOW}━━━ DHCP Config File (dhcp-service output) ━━━${NC}"
echo ""

DHCP_CONF="/home/z/my-project/dhcp-local/staysuite-dhcp.conf"
if [ -f "$DHCP_CONF" ]; then
  echo -n "  File exists:                    "
  echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))

  echo -n "  Has dhcp-range directives:      "
  if grep -q "^dhcp-range=" "$DHCP_CONF"; then
    SUBNET_COUNT=$(grep -c "^dhcp-range=" "$DHCP_CONF")
    echo -e "${GREEN}✅ PASS${NC} ($SUBNET_COUNT subnets)"; ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC} (no dhcp-range found)"; ((FAIL++))
  fi

  echo -n "  Has MAC reservations:           "
  if grep -q "^dhcp-host=" "$DHCP_CONF"; then
    RES_COUNT=$(grep -c "^dhcp-host=" "$DHCP_CONF")
    echo -e "${GREEN}✅ PASS${NC} ($RES_COUNT reservations)"; ((PASS++))
  else
    echo -e "${YELLOW}⚠️  SKIP${NC} (no reservations)"
  fi

  echo -n "  No hostnames in IP-only options: "
  if grep -E "ntp-server|dns-server|router," "$DHCP_CONF" | grep -v "^#" | grep -qE "[a-zA-Z]+\.[a-zA-Z]+"; then
    # Check if any IP-value options contain unresolved hostnames
    BAD_LINES=$(grep -E "^dhcp-option=option:(ntp-server|dns-server|router)," "$DHCP_CONF" | grep -vE "(\d{1,3}\.){3}\d{1,3}" | grep -v "^#" || true)
    if [ -n "$BAD_LINES" ]; then
      echo -e "${RED}❌ FAIL${NC} (unresolved hostnames found):"; echo "$BAD_LINES"; ((FAIL++))
    else
      echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))
    fi
  else
    echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))
  fi

  echo -n "  No spaces after commas:         "
  if grep -v "^#" "$DHCP_CONF" | grep -E "dhcp-option=.*,\s+" | grep -vq "^$"; then
    echo -e "${RED}❌ FAIL${NC} (spaces after commas found)"; ((FAIL++))
  else
    echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))
  fi
else
  echo -e "  ${RED}❌ FAIL — $DHCP_CONF not found${NC}"; ((FAIL++))
fi

# ── 3. DNS Config File Check ──
echo ""
echo -e "${YELLOW}━━━ DNS Config File (dns-service output) ━━━${NC}"
echo ""

DNS_CONF="/home/z/my-project/dns-local/staysuite.conf"
if [ -f "$DNS_CONF" ]; then
  echo -n "  File exists:                    "
  echo -e "${GREEN}✅ PASS${NC}"; ((PASS++))

  echo -n "  Has DNS zones:                  "
  if grep -q "^address=" "$DNS_CONF"; then
    ZONE_COUNT=$(grep -c "^address=" "$DNS_CONF")
    echo -e "${GREEN}✅ PASS${NC} ($ZONE_COUNT records)"; ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}"; ((FAIL++))
  fi

  echo -n "  Has upstream forwarders:        "
  if grep -q "^server=" "$DNS_CONF"; then
    FW_COUNT=$(grep -c "^server=" "$DNS_CONF")
    echo -e "${GREEN}✅ PASS${NC} ($FW_COUNT forwarders)"; ((PASS++))
  else
    echo -e "${YELLOW}⚠️  SKIP${NC}"
  fi
else
  echo -e "  ${RED}❌ FAIL — $DNS_CONF not found${NC}"; ((FAIL++))
fi

# ── 4. Live DNS Resolution Tests ──
echo ""
echo -e "${YELLOW}━━━ Live DNS Resolution ━━━${NC}"
echo ""

test_dns() {
  local domain="$1"
  local expected="$2"
  local result=$(dig @127.0.0.1 -p 5353 "$domain" +short +time=3 2>&1 | head -1)
  if [ "$result" = "$expected" ]; then
    echo -e "  ${GREEN}✅${NC} ${domain} → ${expected}"
    ((PASS++))
  else
    echo -e "  ${RED}❌${NC} ${domain} → expected ${expected}, got ${result}"
    ((FAIL++))
  fi
}

test_dns "portal.staysuite.local" "192.168.1.10"
test_dns "dns.staysuite.local" "192.168.1.1"
test_dns "portal.guest.staysuite.local" "192.168.10.1"
test_dns "gateway.royalstay.local" "192.168.1.1"
test_dns "pms.royalstay.local" "192.168.1.50"
test_dns "wifi.royalstay.local" "192.168.10.1"
test_dns "connect.staysuite.local" "192.168.10.1"

echo ""
echo -n "  Upstream (google.com):           "
GOOGLE_IP=$(dig @127.0.0.1 -p 5353 google.com +short +time=5 2>&1 | head -1)
if echo "$GOOGLE_IP" | grep -qE "^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"; then
  echo -e "${GREEN}✅ PASS${NC} ($GOOGLE_IP)"; ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC} (got: ${GOOGLE_IP})"; ((FAIL++))
fi

# ── Summary ──
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  Total: $TOTAL  |  ${GREEN}Passed: $PASS${NC}  |  ${RED}Failed: $FAIL${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}  🎉 ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}  ⚠️  $FAIL test(s) failed${NC}"
  exit 1
fi
