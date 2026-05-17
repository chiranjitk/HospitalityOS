#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# PMS API Integration Test Runner
#
# Runs all 13 PMS test files sequentially.
# Each file creates data through the API flow (no manual DB seeds).
# State is shared between files via .test-state.json.
#
# Usage:
#   bash tests/pms/run-pms-tests.sh           # Run all tests
#   bash tests/pms/run-pms-tests.sh 07        # Run from test 07 onwards
#   bash tests/pms/run-pms-tests.sh 13        # Run only the E2E master test
#
# Prerequisites:
#   - Dev server running on port 3000
#   - Database seeded (bun run db:seed)
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
BASE_URL="http://localhost:3000"
START_TEST="${1:-01}"

# Track results
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_TESTS=()

echo ""
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}  StaySuite PMS API Integration Tests${NC}"
echo -e "${BOLD}${BLUE}  Sequential Runner — Real API Flow (No DB Seeds)${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check dev server is running
echo -e "${YELLOW}⏳ Checking dev server at ${BASE_URL}...${NC}"
if ! curl -sf -o /dev/null "${BASE_URL}/api/health" 2>/dev/null; then
    # Try without /api/health
    if ! curl -sf -o /dev/null "${BASE_URL}" 2>/dev/null; then
        echo -e "${RED}❌ Dev server is not running on port 3000.${NC}"
        echo -e "${RED}   Start it with: pm2 restart staysuite-main${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Dev server is running${NC}"
echo ""

# Check auth works
echo -e "${YELLOW}⏳ Verifying authentication...${NC}"
AUTH_TEST=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@royalstay.in","password":"admin123"}' 2>/dev/null || echo "")
if echo "$AUTH_TEST" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" 2>/dev/null; then
    echo -e "${GREEN}✅ Authentication verified${NC}"
else
    echo -e "${RED}❌ Authentication failed. Check that admin@royalstay.in exists.${NC}"
    echo -e "${RED}   Run: bun run db:seed${NC}"
    exit 1
fi
echo ""

# Define test files in order
TEST_FILES=(
    "01-properties"
    "02-room-types"
    "03-rooms"
    "04-rate-plans"
    "05-inventory-locks"
    "06-availability"
    "07-bookings-integration"
    "08-maintenance-blocks"
    "09-floor-plans"
    "10-packages"
    "11-room-type-change"
    "12-overbooking"
    "13-cross-module-verification"
)

# Filter based on start test
RUNNING=false
for TEST_NAME in "${TEST_FILES[@]}"; do
    TEST_NUM="${TEST_NAME%%-*}"
    if [ "$TEST_NUM" = "$START_TEST" ] || [ "$TEST_NUM" -ge "$START_TEST" ] 2>/dev/null; then
        RUNNING=true
    fi
    if [ "$RUNNING" = true ]; then
        TEST_FILE="${SCRIPT_DIR}/${TEST_NAME}.test.ts"

        if [ ! -f "$TEST_FILE" ]; then
            echo -e "${RED}❌ Test file not found: ${TEST_FILE}${NC}"
            FAILED_TESTS+=("$TEST_NAME (file not found)")
            TOTAL_FAIL=$((TOTAL_FAIL + 1))
            continue
        fi

        echo -e "${BOLD}${BLUE}───────────────────────────────────────────────────────────────────────${NC}"
        echo -e "${BOLD}  Running: ${TEST_NAME}${NC}"
        echo -e "${BOLD}${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

        START_TIME=$(date +%s)

        # Run the test
        set +e
        OUTPUT=$(bun run "$TEST_FILE" 2>&1)
        EXIT_CODE=$?
        set -e

        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))

        echo "$OUTPUT" | tail -5

        if [ $EXIT_CODE -eq 0 ]; then
            TOTAL_PASS=$((TOTAL_PASS + 1))
            echo -e "${GREEN}  ✅ ${TEST_NAME} passed (${DURATION}s)${NC}"
        else
            TOTAL_FAIL=$((TOTAL_FAIL + 1))
            FAILED_TESTS+=("$TEST_NAME")
            echo -e "${RED}  ❌ ${TEST_NAME} FAILED (${DURATION}s)${NC}"
            # Show error details
            echo "$OUTPUT" | grep -E "❌|Error|FAIL" | head -10
        fi
        echo ""
    fi
done

# Summary
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  TEST SUMMARY${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "  Total:  ${#TEST_FILES[@]}"
echo -e "  ${GREEN}Passed: ${TOTAL_PASS}${NC}"
echo -e "  ${RED}Failed: ${TOTAL_FAIL}${NC}"

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed tests:${NC}"
    for FT in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}❌ ${FT}${NC}"
    done
    echo ""
    echo -e "${RED}💡 Tip: Run a specific test to debug: bash tests/pms/run-pms-tests.sh <test-number>${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 ALL PMS TESTS PASSED!${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    exit 0
fi
