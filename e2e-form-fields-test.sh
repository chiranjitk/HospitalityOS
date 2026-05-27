#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# E2E Test: Portal Form Fields → Guest Profile Data Persistence
# Tests all 5 auth methods with ALL guest identity fields enabled
# ─────────────────────────────────────────────────────────────────────
set -uo pipefail

export PGPASSWORD="Staysuite2025"
BASE="http://localhost:3000"
PSQL="/home/z/my-project/pgsql-runtime/bin/psql"
PG="$PSQL -h localhost -U staysuite -d staysuite -t -A"

# All 7 guest identity fields we'll send in every test
GUEST_INFO='{
  "firstName": "TestE2E",
  "lastName": "FormFields",
  "email": "e2e-formtest@example.com",
  "phone": "+1-555-999-1234",
  "passport": "E2EPASS789012",
  "bookingId": "RS-2024-004"
}'

echo "═══════════════════════════════════════════════════════════════"
echo " E2E FORM FIELDS TEST — 5 Auth Methods × All Guest Identity"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Capture existing guest count BEFORE tests
BEFORE_COUNT=$($PG -c "SELECT COUNT(*) FROM \"Guest\" WHERE \"firstName\" = 'TestE2E';")
echo "Existing TestE2E guests BEFORE: $BEFORE_COUNT"
echo ""

RESULTS_DIR="/home/z/my-project/e2e-results"
mkdir -p "$RESULTS_DIR"

# ─── TEST 1: Open Access ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TEST 1: Open Access (no credentials, all guest info fields)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R1=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"open_access\",
    \"portalSlug\": \"royal-stay-guest\",
    \"guestInfo\": $GUEST_INFO,
    \"marketingEmailConsent\": \"true\",
    \"marketingSmsConsent\": \"false\"
  }")
echo "$R1" | python3 -m json.tool 2>/dev/null || echo "$R1"
echo "$R1" > "$RESULTS_DIR/test1-open-access.json"
AUTH1=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('authenticated','FAIL'))" 2>/dev/null || echo "PARSE_ERROR")
METHOD1=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('method','?'))" 2>/dev/null || echo "?")
echo "→ Auth: $AUTH1 | Method: $METHOD1"
echo ""

# ─── TEST 2: Voucher ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TEST 2: Voucher (RS-CONF-J1K2L3, all guest info fields)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R2=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"voucher\",
    \"portalSlug\": \"royal-stay-guest\",
    \"voucherCode\": \"RS-CONF-J1K2L3\",
    \"guestInfo\": $GUEST_INFO,
    \"marketingEmailConsent\": \"true\",
    \"marketingSmsConsent\": \"true\"
  }")
echo "$R2" | python3 -m json.tool 2>/dev/null || echo "$R2"
echo "$R2" > "$RESULTS_DIR/test2-voucher.json"
AUTH2=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('authenticated','FAIL'))" 2>/dev/null || echo "PARSE_ERROR")
METHOD2=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('method','?'))" 2>/dev/null || echo "?")
echo "→ Auth: $AUTH2 | Method: $METHOD2"
echo ""

# ─── TEST 3: Room Number ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TEST 3: Room Number (501 + Mukherjee, all guest info fields)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R3=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"room_number\",
    \"portalSlug\": \"royal-stay-guest\",
    \"roomNumber\": \"501\",
    \"lastName\": \"Mukherjee\",
    \"guestInfo\": $GUEST_INFO,
    \"marketingEmailConsent\": \"false\",
    \"marketingSmsConsent\": \"true\"
  }")
echo "$R3" | python3 -m json.tool 2>/dev/null || echo "$R3"
echo "$R3" > "$RESULTS_DIR/test3-room.json"
AUTH3=$(echo "$R3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('authenticated','FAIL'))" 2>/dev/null || echo "PARSE_ERROR")
METHOD3=$(echo "$R3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('method','?'))" 2>/dev/null || echo "?")
echo "→ Auth: $AUTH3 | Method: $METHOD3"
echo ""

# ─── TEST 4: OMS (pms_credentials) ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TEST 4: OMS / PMS Credentials (guest.sneha.gupta, all guest info)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R4=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"pms_credentials\",
    \"portalSlug\": \"royal-stay-guest\",
    \"username\": \"guest.sneha.gupta\",
    \"password\": \"Sneha@2024\",
    \"guestInfo\": $GUEST_INFO,
    \"marketingEmailConsent\": \"true\",
    \"marketingSmsConsent\": \"true\"
  }")
echo "$R4" | python3 -m json.tool 2>/dev/null || echo "$R4"
echo "$R4" > "$RESULTS_DIR/test4-oms.json"
AUTH4=$(echo "$R4" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('authenticated','FAIL'))" 2>/dev/null || echo "PARSE_ERROR")
METHOD4=$(echo "$R4" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('method','?'))" 2>/dev/null || echo "?")
echo "→ Auth: $AUTH4 | Method: $METHOD4"
echo ""

# ─── TEST 5: SMS OTP (2-step) ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TEST 5: SMS OTP — Step 1: Request OTP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R5A=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"sms_otp\",
    \"portalSlug\": \"royal-stay-guest\",
    \"phoneNumber\": \"+15559991234\"
  }")
echo "$R5A" | python3 -m json.tool 2>/dev/null || echo "$R5A"
echo "$R5A" > "$RESULTS_DIR/test5a-otp-send.json"

# Extract debug OTP
OTP_CODE=$(echo "$R5A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('_debugOtp','NONE'))" 2>/dev/null || echo "NONE")
echo ""
echo "→ OTP Code extracted: $OTP_CODE"
echo ""

if [ "$OTP_CODE" = "NONE" ]; then
  echo "⚠️  Could not get OTP code — checking server logs..."
  # Try to get OTP from PM2 logs
  OTP_CODE=$(pm2 logs staysuite-nextjs --lines 50 --nostream 2>/dev/null | rg "DEBUG OTP" | tail -1 | rg -oP '\d{6}')
  echo "→ OTP from logs: $OTP_CODE"
fi

if [ "$OTP_CODE" != "NONE" ] && [ -n "$OTP_CODE" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " TEST 5: SMS OTP — Step 2: Verify OTP with guest info"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  R5B=$(curl -s -X POST "$BASE/api/v1/wifi/auth" \
    -H "Content-Type: application/json" \
    -d "{
      \"method\": \"sms_otp\",
      \"portalSlug\": \"royal-stay-guest\",
      \"phoneNumber\": \"+15559991234\",
      \"otpCode\": \"$OTP_CODE\",
      \"guestInfo\": $GUEST_INFO,
      \"marketingEmailConsent\": \"true\",
      \"marketingSmsConsent\": \"false\"
    }")
  echo "$R5B" | python3 -m json.tool 2>/dev/null || echo "$R5B"
  echo "$R5B" > "$RESULTS_DIR/test5b-otp-verify.json"
  AUTH5=$(echo "$R5B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('authenticated','FAIL'))" 2>/dev/null || echo "PARSE_ERROR")
  METHOD5=$(echo "$R5B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('method','?'))" 2>/dev/null || echo "?")
  echo "→ Auth: $AUTH5 | Method: $METHOD5"
else
  echo "❌ TEST 5 SKIPPED — Could not obtain OTP code"
  AUTH5="SKIPPED"
  METHOD5="sms_otp"
fi
echo ""

# ─── Wait for async saveGuestInfoAfterAuth to complete ───
echo "Waiting 3 seconds for async guest info saves to complete..."
sleep 3

# ─── VERIFY DATABASE ───
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " DATABASE VERIFICATION — Guest Records"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "── TestE2E guests created by tests ───"
$PG -c "
SELECT 
  g.\"id\", 
  g.\"firstName\", 
  g.\"lastName\", 
  g.\"email\", 
  g.\"phone\", 
  g.\"idType\", 
  g.\"idNumber\", 
  g.\"emailOptIn\", 
  g.\"smsOptIn\",
  g.\"source\",
  g.\"createdAt\"
FROM \"Guest\" g 
WHERE g.\"firstName\" = 'TestE2E'
ORDER BY g.\"createdAt\" DESC;
"

echo ""
echo "── Amit Mukherjee (room auth target — should have TestE2E data) ───"
$PG -c "
SELECT 
  g.\"id\", 
  g.\"firstName\", 
  g.\"lastName\", 
  g.\"email\", 
  g.\"phone\", 
  g.\"idType\", 
  g.\"idNumber\", 
  g.\"emailOptIn\", 
  g.\"smsOptIn\"
FROM \"Guest\" g 
WHERE g.\"id\" = 'cb127462-1b96-4e37-8f78-65bbd0493ee1';
"

echo ""
echo "── Sneha Gupta (OMS auth target — should have TestE2E data) ───"
$PG -c "
SELECT 
  g.\"id\", 
  g.\"firstName\", 
  g.\"lastName\", 
  g.\"email\", 
  g.\"phone\", 
  g.\"idType\", 
  g.\"idNumber\", 
  g.\"emailOptIn\", 
  g.\"smsOptIn\"
FROM \"Guest\" g 
WHERE g.\"id\" = 'c5e15b10-5464-4323-87b6-41d1eb95c39a';
"

echo ""
echo "── Voucher RS-CONF-J1K2L3 linked guest ───"
$PG -c "
SELECT v.\"id\", v.\"code\", v.\"guestId\", v.\"isUsed\",
  CASE WHEN v.\"guestId\" IS NOT NULL THEN 
    (SELECT g.\"firstName\" || ' ' || g.\"lastName\" || ' | ' || g.\"email\" || ' | ' || g.\"phone\" || ' | ' || g.\"idType\" || ':' || g.\"idNumber\" FROM \"Guest\" g WHERE g.\"id\" = v.\"guestId\")
  ELSE 'NO GUEST LINKED'
  END as guest_info
FROM \"WiFiVoucher\" v 
WHERE v.\"code\" = 'RS-CONF-J1K2L3';
"

echo ""
echo "── Check if bookingId RS-2024-004 linked to any WiFiUser ───"
$PG -c "
SELECT w.\"id\", w.\"username\", w.\"guestId\", w.\"bookingId\",
  CASE WHEN w.\"guestId\" IS NOT NULL THEN 
    (SELECT g.\"firstName\" || ' ' || g.\"lastName\" || ' | email:' || g.\"email\" || ' | phone:' || g.\"phone\" || ' | ' || g.\"idType\" || ':' || g.\"idNumber\" || ' | optIn(email):' || g.\"emailOptIn\" || ' | optIn(sms):' || g.\"smsOptIn\" FROM \"Guest\" g WHERE g.\"id\" = w.\"guestId\")
  ELSE 'NO GUEST'
  END as full_info
FROM \"WiFiUser\" w 
WHERE w.\"bookingId\" IS NOT NULL 
  AND EXISTS (SELECT 1 FROM \"Booking\" b WHERE b.\"confirmationCode\" = 'RS-2024-004')
ORDER BY w.\"createdAt\" DESC
LIMIT 5;
"

echo ""
echo "── All WiFiUsers with TestE2E guest link ───"
$PG -c "
SELECT w.\"username\", w.\"status\", w.\"guestId\",
  (SELECT g.\"firstName\" || ' ' || g.\"lastName\" || ' | ' || g.\"email\" || ' | ' || g.\"phone\" || ' | ' || g.\"idType\" || ':' || g.\"idNumber\" || ' | eOpt:' || g.\"emailOptIn\" || ' sOpt:' || g.\"smsOptIn\" FROM \"Guest\" g WHERE g.\"id\" = w.\"guestId\") as info
FROM \"WiFiUser\" w 
WHERE w.\"guestId\" IN (SELECT \"id\" FROM \"Guest\" WHERE \"firstName\" = 'TestE2E')
ORDER BY w.\"createdAt\" DESC;
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
printf "  %-20s %-8s %-15s\n" "Method" "Auth" "Status"
printf "  %-20s %-8s %-15s\n" "────────────────────" "────────" "───────────────"
printf "  %-20s %-8s %-15s\n" "1. Open Access" "$AUTH1" "$( [ "$AUTH1" = "True" ] && echo '✅ PASS' || echo '❌ FAIL')"
printf "  %-20s %-8s %-15s\n" "2. Voucher" "$AUTH2" "$( [ "$AUTH2" = "True" ] && echo '✅ PASS' || echo '❌ FAIL')"
printf "  %-20s %-8s %-15s\n" "3. Room Number" "$AUTH3" "$( [ "$AUTH3" = "True" ] && echo '✅ PASS' || echo '❌ FAIL')"
printf "  %-20s %-8s %-15s\n" "4. OMS Credentials" "$AUTH4" "$( [ "$AUTH4" = "True" ] && echo '✅ PASS' || echo '❌ FAIL')"
printf "  %-20s %-8s %-15s\n" "5. SMS OTP" "$AUTH5" "$( [ "$AUTH5" = "True" ] && echo '✅ PASS' || ( [ "$AUTH5" = "SKIPPED" ] && echo '⚠️ SKIP' || echo '❌ FAIL' ))"
echo ""

AFTER_COUNT=$($PG -c "SELECT COUNT(*) FROM \"Guest\" WHERE \"firstName\" = 'TestE2E';")
echo "  TestE2E guests BEFORE: $BEFORE_COUNT → AFTER: $AFTER_COUNT"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo " SERVER LOGS (last 30 lines — check for GuestInfo entries)"
echo "═══════════════════════════════════════════════════════════════"
pm2 logs staysuite-nextjs --lines 30 --nostream 2>/dev/null | rg -i "guestinfo|guest info|Guest|OTP" || echo "(no matching log lines)"
echo ""
echo "DONE. Full results saved to $RESULTS_DIR/"
