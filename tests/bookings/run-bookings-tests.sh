#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Bookings API Integration Test Runner
#
# Runs all 7 bookings test files sequentially.
# Builds on PMS test data (property, rooms, guest, booking).
# State is shared between files via tests/pms/.test-state.json.
#
# Usage:
#   bash tests/bookings/run-bookings-tests.sh           # Run all tests
#   bash tests/bookings/run-bookings-tests.sh 03        # Run from test 03 onwards
#   bash tests/bookings/run-bookings-tests.sh 07        # Run only the master test
#
# Prerequisites:
#   - Dev server running on port 3000
#   - PMS tests run first (creates property, rooms, guest, booking)
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
echo -e "${BOLD}${BLUE}  StaySuite Bookings Module API Integration Tests${NC}"
echo -e "${BOLD}${BLUE}  Sequential Runner — Builds on PMS Test Data${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check dev server is running
echo -e "${YELLOW}⏳ Checking dev server at ${BASE_URL}...${NC}"
if ! curl -sf -o /dev/null "${BASE_URL}/api/health" 2>/dev/null; then
    if ! curl -sf -o /dev/null "${BASE_URL}" 2>/dev/null; then
        echo -e "${RED}❌ Dev server is not running on port 3000.${NC}"
        echo -e "${RED}   Start it with: pm2 restart staysuite-main${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Dev server is running${NC}"
echo ""

# Check PMS test state exists
echo -e "${YELLOW}⏳ Checking PMS test state...${NC}"
STATE_FILE="${SCRIPT_DIR}/../pms/.test-state.json"
if [ ! -f "$STATE_FILE" ]; then
    echo -e "${RED}❌ PMS test state not found at ${STATE_FILE}${NC}"
    echo -e "${RED}   Run PMS tests first: bash tests/pms/run-pms-tests.sh${NC}"
    exit 1
fi

# Verify required fields in state
REQUIRED_FIELDS=("propertyId" "roomType1Id" "room2Id" "room3Id" "guestId" "bookingId")
for FIELD in "${REQUIRED_FIELDS[@]}"; do
    if ! grep -q "\"${FIELD}\"" "$STATE_FILE"; then
        echo -e "${RED}❌ PMS test state missing required field: ${FIELD}${NC}"
        echo -e "${RED}   Run PMS tests first: bash tests/pms/run-pms-tests.sh${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ PMS test state verified (property, rooms, guest, booking exist)${NC}"
echo ""

# Define test files in order
TEST_FILES=(
    "01-bookings-calendar"
    "02-group-bookings"
    "03-waitlist"
    "04-conflicts"
    "05-no-show"
    "06-audit-logs"
    "07-cross-module-verification"
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
echo -e "${BOLD}  BOOKINGS TEST SUMMARY${NC}"
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
    echo -e "${RED}💡 Tip: Run a specific test to debug: bash tests/bookings/run-bookings-tests.sh <test-number>${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 ALL BOOKINGS TESTS PASSED!${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
    exit 0
fi
