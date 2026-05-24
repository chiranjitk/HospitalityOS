#!/bin/bash
# ╔════════════════════════════════════════════════════════════════════════════════╗
# ║  StaySuite — Quick RADIUS Verification Script                                 ║
# ║  Runs radclient auth tests against FreeRADIUS for recently created users       ║
# ║                                                                              ║
# ║  Usage: bash scripts/verify-radius-test.sh                                    ║
# ╚════════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────

RADCLIENT_BIN="/home/z/my-project/freeradius-install/bin/radclient"
RADCLIENT_DICT="/home/z/my-project/freeradius-install/share/freeradius"
RADCLIENT_LIB="/home/z/my-project/freeradius-install/lib"
RADIUS_SERVER="127.0.0.1"
RADIUS_SECRET="testing123"
PSQL_BIN="/home/z/my-project/pgsql-runtime/bin/psql"
DB_CONN="-h 127.0.0.1 -p 5432 -U staysuite -d staysuite"
PGPASSWORD="Staysuite2025"

PROPERTY_ID="281fde73-7836-4511-b644-91f3663d8fcd"

PASS=0
FAIL=0
WARN=0

# ── Colors ─────────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

assert() {
    if [ $1 -eq 0 ]; then
        echo -e "  ${GREEN}✅ $2${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}❌ $2${NC}"
        FAIL=$((FAIL + 1))
    fi
}

warn() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
    WARN=$((WARN + 1))
}

info() {
    echo -e "  ℹ️  $1"
}

# ── RADIUS Auth Helper ────────────────────────────────────────────────────────

radclient_test() {
    local username="$1"
    local password="$2"
    local description="$3"
    
    local tmpfile="/tmp/radverify-$$-$RANDOM.txt"
    
    cat > "$tmpfile" << EOF
User-Name="${username}"
User-Password="${password}"
NAS-IP-Address=127.0.0.1
NAS-Port=0
Called-Station-Id=StaySuite-Guest
Calling-Station-Id=00:00:00:00:00:00
Service-Type=Framed-User
EOF
    
    local result
    result=$(RADCLIENT_DICT="$RADCLIENT_DICT" LD_LIBRARY_PATH="$RADCLIENT_LIB" \
        timeout 10 "$RADCLIENT_BIN" -t 3 -r 1 -n 3 \
        "$RADIUS_SERVER":1812 auth "$RADIUS_SECRET" < "$tmpfile" 2>&1) || true
    
    rm -f "$tmpfile"
    
    if echo "$result" | grep -q "Access-Accept"; then
        assert 0 "$description → Access-Accept"
        # Extract reply attributes
        local bw_down bw_up session_timeout
        bw_down=$(echo "$result" | grep -oP 'WISPr-Bandwidth-Max-Down\s*=\s*"\K[^"]+' || echo "N/A")
        bw_up=$(echo "$result" | grep -oP 'WISPr-Bandwidth-Max-Up\s*=\s*"\K[^"]+' || echo "N/A")
        session_timeout=$(echo "$result" | grep -oP 'Session-Timeout\s*=\s*\K[0-9]+' || echo "N/A")
        
        if [ "$bw_down" != "N/A" ]; then
            local bw_down_mbps=$((bw_down / 1000000))
            local bw_up_mbps=$((bw_up / 1000000))
            info "    Bandwidth: ↓${bw_down_mbps}Mbps ↑${bw_up_mbps}Mbps, Session-Timeout: ${session_timeout}s"
        fi
        return 0
    else
        assert 1 "$description → Access-Reject"
        local reject_reason
        reject_reason=$(echo "$result" | grep -oP 'Reply-Message\s*=\s*"\K[^"]+' || echo "unknown")
        info "    Reject reason: $reject_reason"
        return 1
    fi
}

# ── MAC Auth Test Helper ──────────────────────────────────────────────────────

radclient_mac_test() {
    local mac="$1"
    local description="$2"
    
    # For MAC auth, username is MAC without colons in lowercase
    local mac_user
    mac_user=$(echo "$mac" | tr -d ':' | tr 'A-F' 'a-f')
    
    local tmpfile="/tmp/radverify-mac-$$-$RANDOM.txt"
    
    cat > "$tmpfile" << EOF
User-Name="${mac_user}"
User-Password=""
NAS-IP-Address=127.0.0.1
NAS-Port=0
Called-Station-Id=StaySuite-Guest
Calling-Station-Id="${mac}"
Service-Type=Call-Check
Framed-Protocol=PPP
EOF
    
    local result
    result=$(RADCLIENT_DICT="$RADCLIENT_DICT" LD_LIBRARY_PATH="$RADCLIENT_LIB" \
        timeout 10 "$RADCLIENT_BIN" -t 3 -r 1 -n 3 \
        "$RADIUS_SERVER":1812 auth "$RADIUS_SECRET" < "$tmpfile" 2>&1) || true
    
    rm -f "$tmpfile"
    
    if echo "$result" | grep -q "Access-Accept"; then
        assert 0 "$description → Access-Accept (MAC: $mac)"
        return 0
    else
        assert 1 "$description → Access-Reject (MAC: $mac)"
        return 1
    fi
}

# ── Main Tests ────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  StaySuite — Quick RADIUS Verification Script                                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check FreeRADIUS is Running ────────────────────────────────────────────

print_header "1. FreeRADIUS Health Check"

radclient_test "health-check-user" "test-password" "RADIUS server connectivity"

# ── 2. Test Known Seed Users ──────────────────────────────────────────────────

print_header "2. Known Seed User Authentication"

# These users were created by the wifi-seed.ts script with known passwords
radclient_test "guest.amit.mukherjee" "Amit@2024" "Seed user: guest.amit.mukherjee (Premium 50M)"
radclient_test "guest.rahul.banerjee" "Rahul@2024" "Seed user: guest.rahul.banerjee (VIP 100M)"
radclient_test "guest.sneha.gupta" "Sneha@2024" "Seed user: guest.sneha.gupta (Standard 25M)"
radclient_test "guest.vikram.singh" "Vikram@2024" "Seed user: guest.vikram.singh (VIP 100M)"
radclient_test "staff.priya.das" "Staff@Priya" "Staff user: staff.priya.das (Premium 50M)"
radclient_test "conference.room1" "Conf@2024" "Conference user: conference.room1 (30M)"

# ── 3. Test Recently Created Users ────────────────────────────────────────────

print_header "3. Recently Created Users (from production-wifi-test)"

# Get recent users from the DB
RECENT_USERS=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "
    SELECT username, password FROM \"WiFiUser\" 
    WHERE \"propertyId\" = '$PROPERTY_ID' 
    AND status = 'active' 
    AND \"createdAt\" > NOW() - interval '1 hour'
    ORDER BY \"createdAt\" DESC 
    LIMIT 10
" 2>/dev/null || echo "")

if [ -n "$RECENT_USERS" ]; then
    while IFS='|' read -r username password; do
        if [ -n "$username" ] && [ -n "$password" ]; then
            radclient_test "$username" "$password" "Recent user: $username"
        fi
    done <<< "$RECENT_USERS"
else
    warn "No recently created users found — skipping this section"
fi

# ── 4. Test Voucher Codes ─────────────────────────────────────────────────────

print_header "4. Voucher Code Authentication"

# Get recent vouchers
RECENT_VOUCHERS=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "
    SELECT code FROM \"WiFiVoucher\" 
    WHERE \"tenantId\" = '444017d5-e022-4c5f-ac07-ea0d51f4609b'
    AND status = 'active' 
    AND \"isUsed\" = false
    ORDER BY \"createdAt\" DESC 
    LIMIT 5
" 2>/dev/null || echo "")

if [ -n "$RECENT_VOUCHERS" ]; then
    while read -r code; do
        if [ -n "$code" ]; then
            # Voucher code is both username and password in RADIUS
            radclient_test "$code" "$code" "Voucher: $code"
        fi
    done <<< "$RECENT_VOUCHERS"
else
    warn "No active vouchers found — skipping this section"
fi

# ── 5. Test MAC Auth Entries ──────────────────────────────────────────────────

print_header "5. MAC Authentication"

# Get MAC auth entries
MAC_ENTRIES=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "
    SELECT \"macAddress\", \"guestName\" FROM \"RadiusMacAuth\"
    WHERE \"propertyId\" = '$PROPERTY_ID'
    AND status = 'active'
    ORDER BY \"createdAt\" DESC
    LIMIT 5
" 2>/dev/null || echo "")

if [ -n "$MAC_ENTRIES" ]; then
    while IFS='|' read -r mac guest_name; do
        if [ -n "$mac" ]; then
            radclient_mac_test "$mac" "MAC auth: ${guest_name:-unknown}"
        fi
    done <<< "$MAC_ENTRIES"
else
    warn "No MAC auth entries found — skipping this section"
fi

# ── 6. Negative Tests ─────────────────────────────────────────────────────────

print_header "6. Negative Tests (Should Reject)"

# Test with wrong password for a known user
radclient_test "guest.amit.mukherjee" "WrongPassword123" "REJECT: Wrong password for known user"

# Test with nonexistent user
radclient_test "nonexistent_user_abc123" "DoesNotExist" "REJECT: Nonexistent user"

# Test with expired user
EXPIRED_USER=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "
    SELECT username FROM \"WiFiUser\" 
    WHERE status = 'expired' 
    LIMIT 1
" 2>/dev/null || echo "")

if [ -n "$EXPIRED_USER" ]; then
    info "Found expired user: $EXPIRED_USER — testing rejection"
    # We don't know the password, but we can still test radclient
    radclient_test "$EXPIRED_USER" "ExpiredPass" "REJECT: Expired user ($EXPIRED_USER)"
else
    warn "No expired users found for negative test"
fi

# ── 7. Database Summary ───────────────────────────────────────────────────────

print_header "7. Database Summary"

WIFI_USER_COUNT=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "SELECT count(*) FROM \"WiFiUser\"" 2>/dev/null || echo "N/A")
RADCHECK_COUNT=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "SELECT count(*) FROM \"RadCheck\"" 2>/dev/null || echo "N/A")
RADREPLY_COUNT=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "SELECT count(*) FROM \"RadReply\"" 2>/dev/null || echo "N/A")
ACTIVE_SESSIONS=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "SELECT count(*) FROM radacct WHERE acctstoptime IS NULL" 2>/dev/null || echo "N/A")
AUTH_LOG_COUNT=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "SELECT count(*) FROM \"RadPostAuth\"" 2>/dev/null || echo "N/A")

info "WiFiUsers: $WIFI_USER_COUNT"
info "RadCheck entries: $RADCHECK_COUNT"
info "RadReply entries: $RADREPLY_COUNT"
info "Active RADIUS sessions: $ACTIVE_SESSIONS"
info "Auth log entries: $AUTH_LOG_COUNT"

# ── 8. RADIUS Group Verification ──────────────────────────────────────────────

print_header "8. RADIUS Group Verification"

GROUPS=$(PGPASSWORD="$PGPASSWORD" $PSQL_BIN $DB_CONN -t -A -c "
    SELECT groupname, attribute, value FROM \"RadGroupCheck\"
    ORDER BY groupname, priority
" 2>/dev/null || echo "")

if [ -n "$GROUPS" ]; then
    info "RADIUS group check attributes:"
    while IFS='|' read -r group attr value; do
        info "  $group: $attr = $value"
    done <<< "$GROUPS"
else
    warn "No RADIUS group check entries found"
fi

# ── Final Summary ─────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  VERIFICATION SUMMARY                                                         ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "  ${GREEN}✅ Passed:${NC}  $PASS"
echo -e "  ${RED}❌ Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}⚠️  Warnings:${NC} $WARN"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL RADIUS VERIFICATIONS PASSED${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME RADIUS VERIFICATIONS FAILED — review output above${NC}"
    exit 1
fi
