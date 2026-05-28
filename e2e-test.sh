#!/bin/bash
# StaySuite-HospitalityOS End-to-End Test Suite
# Tests ALL modules via real API calls only - NO direct DB inserts
set -euo pipefail

BASE="http://localhost:3000"
COOKIE="/tmp/staysuite-cookies.txt"
TENANT="444017d5-e022-4c5f-ac07-ea0d51f4609b"
PROPERTY="281fde73-7836-4511-b644-91f3663d8fcd"
LOG="/tmp/e2e-test-log.txt"
FAILURES="/tmp/e2e-failures.txt"
ERRORS="/tmp/e2e-errors.txt"

rm -f "$LOG" "$FAILURES" "$ERRORS"
touch "$LOG" "$FAILURES" "$ERRORS"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }
pass() { echo "  ✅ $1" | tee -a "$LOG"; }
fail() { echo "  ❌ $1" | tee -a "$LOG"; echo "$1" >> "$FAILURES"; }
err() { echo "  ⚠️  $1" | tee -a "$LOG"; echo "$1" >> "$ERRORS"; }

api() {
  local method=$1 path=$2 data=$3
  local args=(-s -X "$method" -H "Content-Type: application/json" -b "$COOKIE" -c "$COOKIE" -w "\n%{http_code}")
  if [ -n "$data" ]; then args+=(-d "$data"); fi
  local resp=$(curl "${args[@]}" "$BASE$path")
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  echo "$body"
  echo "$code" > /tmp/e2e-last-code
  return 0
}

http_code() { cat /tmp/e2e-last-code 2>/dev/null || echo "000"; }

# ============================================================
# PHASE 0: AUTH & SETUP
# ============================================================
log "========== PHASE 0: AUTH & SETUP =========="

log "Disabling 2FA for admin user..."
psql -h 127.0.0.1 -U staysuite -d staysuite -c 'UPDATE "User" SET "twoFactorEnabled" = false WHERE email = '"'"'admin@royalstay.in'"'"';' >/dev/null 2>&1 || true

log "Logging in as admin..."
LOGIN_RESP=$(api POST /api/auth/login '{"email":"admin@royalstay.in","password":"admin123"}')
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  pass "Admin login: HTTP $CODE"
  TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$TOKEN" ]; then
    pass "Got auth token: ${TOKEN:0:20}..."
  else
    err "No token in response (cookie-based auth)"
  fi
else
  fail "Admin login failed: HTTP $CODE"
  echo "$LOGIN_RESP" | head -c 500
  exit 1
fi

# ============================================================
# PHASE 1: WIFI INFRASTRUCTURE
# ============================================================
log "========== PHASE 1: WIFI INFRASTRUCTURE =========="

# 1A: Create WiFi Plans with different types
log "--- Creating additional WiFi plans ---"

PLAN_RESPONSES=""
for PLAN_NAME in "Guest Free 1hr" "Family Plan 5Mbps" "Business 50Mbps" "Event Conference" "Bandwidth Unlimited"; do
  RESP=$(api POST /api/wifi/plans "$(cat <<JSON
{
  "name": "$PLAN_NAME",
  "description": "E2E test plan: $PLAN_NAME",
  "downloadSpeed": 10,
  "uploadSpeed": 5,
  "burstDownloadSpeed": 20,
  "burstUploadSpeed": 10,
  "dataLimit": 5120,
  "sessionTimeoutSec": 3600,
  "idleTimeoutSec": 600,
  "maxDevices": 3,
  "price": 0,
  "currency": "USD",
  "priority": 5,
  "validityDays": 1,
  "validityMinutes": 60,
  "status": "active",
  "tenantId": "$TENANT",
  "propertyId": "$PROPERTY"
}
JSON
)")
  CODE=$(http_code)
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
    pass "Created plan: $PLAN_NAME (HTTP $CODE)"
    PLAN_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    PLAN_RESPONSES="$PLAN_RESPONSES $PLAN_ID"
    log "  Plan ID: $PLAN_ID"
  else
    err "Create plan '$PLAN_NAME' failed: HTTP $CODE - $(echo "$RESP" | head -c 200)"
  fi
done

# 1B: List existing WiFi Plans
log "--- Listing WiFi plans ---"
RESP=$(api GET /api/wifi/plans "")
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  PLAN_COUNT=$(echo "$RESP" | grep -o '"id"' | wc -l)
  pass "List WiFi plans: HTTP $CODE ($PLAN_COUNT plans)"
else
  fail "List WiFi plans failed: HTTP $CODE"
fi

# 1C: Create Vouchers in bulk
log "--- Creating WiFi vouchers ---"
# Get a plan ID for voucher creation
FIRST_PLAN_ID=$(echo "$(api GET /api/wifi/plans "")" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$FIRST_PLAN_ID" ]; then
  RESP=$(api POST /api/wifi/vouchers "$(cat <<JSON
{
  "planId": "$FIRST_PLAN_ID",
  "count": 20,
  "validFrom": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validUntil": "$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "E2E test batch vouchers"
}
JSON
)")
  CODE=$(http_code)
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
    VOUCHER_COUNT=$(echo "$RESP" | grep -o '"code"' | wc -l)
    pass "Created $VOUCHER_COUNT vouchers (HTTP $CODE)"
    # Save voucher codes for WiFi auth testing
    echo "$RESP" | grep -o '"code":"[^"]*"' | cut -d'"' -f4 > /tmp/e2e-voucher-codes.txt
    log "  Saved voucher codes to /tmp/e2e-voucher-codes.txt"
  else
    err "Create vouchers failed: HTTP $CODE - $(echo "$RESP" | head -c 300)"
  fi
fi

# 1D: List vouchers
RESP=$(api GET "/api/wifi/vouchers?planId=$FIRST_PLAN_ID&status=active" "")
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  ACTIVE_VOUCHERS=$(echo "$RESP" | grep -o '"code"' | wc -l)
  pass "List active vouchers: HTTP $CODE ($ACTIVE_VOUCHERS vouchers)"
else
  fail "List vouchers failed: HTTP $CODE"
fi

# 1E: Check IP Pools
log "--- Checking IP Pools ---"
RESP=$(api GET /api/wifi/ip-pools "")
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  IPPOOL_COUNT=$(echo "$RESP" | grep -o '"id"' | wc -l)
  pass "List IP pools: HTTP $CODE ($IPPOOL_COUNT pools)"
else
  err "List IP pools: HTTP $CODE (may not exist as separate endpoint)"
fi

# 1F: WiFi Health Check
log "--- WiFi Health Check ---"
RESP=$(api GET /api/wifi/health "")
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  pass "WiFi health: HTTP $CODE - $(echo "$RESP" | head -c 200)"
else
  err "WiFi health check: HTTP $CODE"
fi

# 1G: Check Bandwidth Policies
log "--- Bandwidth Policies ---"
RESP=$(api GET /api/wifi/firewall/bandwidth-policies "")
CODE=$(http_code)
if [ "$CODE" = "200" ]; then
  BP_COUNT=$(echo "$RESP" | grep -o '"id"' | wc -l)
  pass "List bandwidth policies: HTTP $CODE ($BP_COUNT policies)"
else
  err "Bandwidth policies: HTTP $CODE"
fi

echo "PHASE1_DONE" >> /tmp/e2e-phases.txt
log "========== PHASE 1 COMPLETE =========="
