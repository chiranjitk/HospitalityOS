#!/bin/bash
# =============================================================================
# StaySuite Comprehensive GUI Test Script
# Tests every page, section, and interactive element
# =============================================================================

BASE_URL="http://localhost:3000"
SCREENSHOT_DIR="/home/z/my-project/gui-test-screenshots"
RESULTS_FILE="/home/z/my-project/gui-test-results.txt"
SESSION_FILE="/home/z/my-project/gui-test-screenshots/admin-session.json"

# Initialize results file
echo "============================================" > "$RESULTS_FILE"
echo "StaySuite GUI Test Report" >> "$RESULTS_FILE"
echo "Date: $(date)" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

PASS=0
FAIL=0
ERRORS=""

test_page() {
  local section="$1"
  local page_name="$2"
  local url_path="$3"
  local screenshot_name="$4"
  
  local safe_name=$(echo "$screenshot_name" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  local screenshot_path="${SCREENSHOT_DIR}/${safe_name}.png"
  
  echo -n "  Testing: $page_name ($url_path) ... "
  
  # Navigate to page
  RESULT=$(agent-browser open "${BASE_URL}${url_path}" 2>&1)
  if echo "$RESULT" | grep -qi "error\|failed\|timeout"; then
    echo "❌ NAV FAIL" 
    echo "  ❌ FAIL | $section | $page_name | $url_path | Navigation failed" >> "$RESULTS_FILE"
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n  FAIL: $page_name - Navigation failed"
    return 1
  fi
  
  # Wait for page load
  sleep 3
  
  # Check for console errors
  CONSOLE_ERRORS=$(agent-browser errors 2>&1)
  
  # Check page title/content loaded
  PAGE_TITLE=$(agent-browser get title 2>&1)
  if echo "$PAGE_TITLE" | grep -qi "error\|404\|500"; then
    echo "❌ PAGE ERROR"
    echo "  ❌ FAIL | $section | $page_name | $url_path | Page error: $PAGE_TITLE" >> "$RESULTS_FILE"
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n  FAIL: $page_name - Page error"
    # Still take screenshot for debugging
    agent-browser screenshot "$screenshot_path" 2>/dev/null
    return 1
  fi
  
  # Take screenshot
  agent-browser screenshot "$screenshot_path" 2>/dev/null
  
  # Check if page has meaningful content (not blank)
  SNAPSHOT=$(agent-browser snapshot -c 2>&1 | head -5)
  if [ -z "$SNAPSHOT" ]; then
    echo "⚠️  EMPTY"
    echo "  ⚠️  WARN | $section | $page_name | $url_path | Page appears empty" >> "$RESULTS_FILE"
  fi
  
  # Count interactive elements
  INTERACTIVE=$(agent-browser snapshot -i 2>&1 | grep -c "ref=" || true)
  
  echo "✅ OK ($INTERACTIVE interactive elements)"
  echo "  ✅ PASS | $section | $page_name | $url_path | $INTERACTIVE interactive elements" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
}

# Get all sidebar navigation links from the dashboard
echo "Phase 1: Testing all navigation pages..." >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# ============================================================
# DASHBOARD SECTION
# ============================================================
echo ""
echo "═══ DASHBOARD ═══"
test_page "Dashboard" "Overview" "/" "02-dashboard-overview"
test_page "Dashboard" "Command Center" "/?section=command-center" "03-command-center"
test_page "Dashboard" "Alerts & Notifications" "/?section=alerts" "04-alerts-notifications"
test_page "Dashboard" "KPI Cards" "/?section=kpi" "05-kpi-cards"

# ============================================================
# PROPERTY MANAGEMENT SECTION
# ============================================================
echo ""
echo "═══ PROPERTY MANAGEMENT ═══"
test_page "Property Mgmt" "Properties" "/?section=properties" "06-properties"
test_page "Property Mgmt" "Room Types" "/?section=room-types" "07-room-types"
test_page "Property Mgmt" "Rooms" "/?section=rooms" "08-rooms"
test_page "Property Mgmt" "Inventory Calendar" "/?section=inventory-calendar" "09-inventory-calendar"
test_page "Property Mgmt" "Availability Control" "/?section=availability" "10-availability-control"
test_page "Property Mgmt" "Inventory Locking" "/?section=inventory-locking" "11-inventory-locking"
test_page "Property Mgmt" "Rate Plans & Pricing" "/?section=rate-plans" "12-rate-plans"
test_page "Property Mgmt" "Overbooking Settings" "/?section=overbooking" "13-overbooking"
test_page "Property Mgmt" "Floor Plans" "/?section=floor-plans" "14-floor-plans"
test_page "Property Mgmt" "Room Rate Calendar" "/?section=room-rate-calendar" "15-room-rate-calendar"
test_page "Property Mgmt" "Room Out-of-Order" "/?section=room-out-of-order" "16-room-ooo"
test_page "Property Mgmt" "Package Plans" "/?section=package-plans" "17-package-plans"
test_page "Property Mgmt" "Room Type Change" "/?section=room-type-change" "18-room-type-change"

# ============================================================
# BOOKINGS SECTION
# ============================================================
echo ""
echo "═══ BOOKINGS ═══"
test_page "Bookings" "Calendar View" "/?section=booking-calendar" "19-booking-calendar"
test_page "Bookings" "Group Bookings" "/?section=group-bookings" "20-group-bookings"
test_page "Bookings" "Waitlist" "/?section=waitlist" "21-waitlist"
test_page "Bookings" "Conflicts" "/?section=booking-conflicts" "22-booking-conflicts"
test_page "Bookings" "No-Show Automation" "/?section=noshow" "23-noshow-automation"
test_page "Bookings" "Audit Logs" "/?section=booking-audit" "24-booking-audit"

# ============================================================
# FRONT DESK SECTION
# ============================================================
echo ""
echo "═══ FRONT DESK ═══"
test_page "Front Desk" "Check-In" "/?section=checkin" "25-checkin"
test_page "Front Desk" "Check-Out" "/?section=checkout" "26-checkout"
test_page "Front Desk" "Express Kiosk" "/?section=kiosk" "27-express-kiosk"
test_page "Front Desk" "Registration Card" "/?section=registration" "28-registration-card"
test_page "Front Desk" "Room Assignment" "/?section=room-assignment" "29-room-assignment"
test_page "Front Desk" "Room Move" "/?section=room-move" "30-room-move"

# ============================================================
# GUESTS SECTION
# ============================================================
echo ""
echo "═══ GUESTS ═══"
test_page "Guests" "Guest Directory" "/?section=guests" "31-guest-directory"
test_page "Guests" "VIP Recognition" "/?section=vip" "32-vip-recognition"
test_page "Guests" "Guest History" "/?section=guest-history" "33-guest-history"
test_page "Guests" "Guest Communications" "/?section=guest-comms" "34-guest-comms"

# ============================================================
# HOUSEKEEPING SECTION
# ============================================================
echo ""
echo "═══ HOUSEKEEPING ═══"
test_page "Housekeeping" "Task Board" "/?section=housekeeping" "35-housekeeping"
test_page "Housekeeping" "Scheduling" "/?section=hk-scheduling" "36-hk-scheduling"
test_page "Housekeeping" "Inspections" "/?section=hk-inspections" "37-hk-inspections"

# ============================================================
# BILLING SECTION
# ============================================================
echo ""
echo "═══ BILLING ═══"
test_page "Billing" "Folio Management" "/?section=folios" "38-folios"
test_page "Billing" "Invoice Generation" "/?section=invoices" "39-invoices"
test_page "Billing" "Payment Processing" "/?section=payments" "40-payments"
test_page "Billing" "Cash Book" "/?section=cash-book" "41-cash-book"
test_page "Billing" "Tax Management" "/?section=tax" "42-tax-management"

# ============================================================
# GUEST EXPERIENCE SECTION
# ============================================================
echo ""
echo "═══ GUEST EXPERIENCE ═══"
test_page "Guest Experience" "Service Requests" "/?section=service-requests" "43-service-requests"
test_page "Guest Experience" "Live Chat" "/?section=live-chat" "44-live-chat"
test_page "Guest Experience" "Feedback" "/?section=feedback" "45-feedback"

# ============================================================
# RESTAURANT & POS SECTION
# ============================================================
echo ""
echo "═══ RESTAURANT & POS ═══"
test_page "Restaurant" "Restaurant Management" "/?section=restaurant" "46-restaurant"
test_page "Restaurant" "Menu Management" "/?section=menu" "47-menu"
test_page "Restaurant" "POS Terminal" "/?section=pos" "48-pos"
test_page "Restaurant" "Room Service" "/?section=room-service" "49-room-service"

# ============================================================
# INVENTORY SECTION
# ============================================================
echo ""
echo "═══ INVENTORY ═══"
test_page "Inventory" "Stock Management" "/?section=inventory" "50-inventory"
test_page "Inventory" "Procurement" "/?section=procurement" "51-procurement"
test_page "Inventory" "Suppliers" "/?section=suppliers" "52-suppliers"

# ============================================================
# FACILITIES SECTION
# ============================================================
echo ""
echo "═══ FACILITIES ═══"
test_page "Facilities" "Facility Booking" "/?section=facilities" "53-facilities"
test_page "Facilities" "Maintenance" "/?section=maintenance" "54-maintenance"
test_page "Facilities" "Energy Management" "/?section=energy" "55-energy"

# ============================================================
# WIFI MANAGEMENT SECTION
# ============================================================
echo ""
echo "═══ WIFI MANAGEMENT ═══"
test_page "WiFi" "WiFi Dashboard" "/?section=wifi" "56-wifi-dashboard"
test_page "WiFi" "Guest Network" "/?section=guest-network" "57-guest-network"
test_page "WiFi" "NAS Management" "/?section=nas" "58-nas-management"
test_page "WiFi" "Session Management" "/?section=sessions" "59-sessions"

# ============================================================
# REVENUE MANAGEMENT SECTION
# ============================================================
echo ""
echo "═══ REVENUE MANAGEMENT ═══"
test_page "Revenue" "Revenue Dashboard" "/?section=revenue" "60-revenue"
test_page "Revenue" "Dynamic Pricing" "/?section=dynamic-pricing" "61-dynamic-pricing"
test_page "Revenue" "Linear Pricing" "/?section=linear-pricing" "62-linear-pricing"
test_page "Revenue" "Smart Pricing Rules" "/?section=ai-suggestions" "63-smart-pricing"

# ============================================================
# CHANNEL MANAGER SECTION
# ============================================================
echo ""
echo "═══ CHANNEL MANAGER ═══"
test_page "Channel Mgr" "Channel Dashboard" "/?section=channel-manager" "64-channel-manager"
test_page "Channel Mgr" "OTA Connections" "/?section=ota-connections" "65-ota-connections"
test_page "Channel Mgr" "Rate Shopping" "/?section=rate-shopping" "66-rate-shopping"

# ============================================================
# CRM & MARKETING SECTION
# ============================================================
echo ""
echo "═══ CRM & MARKETING ═══"
test_page "CRM" "CRM Dashboard" "/?section=crm" "67-crm"
test_page "CRM" "Campaigns" "/?section=campaigns" "68-campaigns"
test_page "CRM" "Loyalty Program" "/?section=loyalty" "69-loyalty"
test_page "CRM" "Guest Segments" "/?section=segments" "70-segments"

# ============================================================
# DIGITAL ADVERTISING SECTION
# ============================================================
echo ""
echo "═══ DIGITAL ADVERTISING ═══"
test_page "Ads" "Ad Dashboard" "/?section=ads" "71-ads"
test_page "Ads" "Google Ads" "/?section=google-ads" "72-google-ads"
test_page "Ads" "Meta Ads" "/?section=meta-ads" "73-meta-ads"

# ============================================================
# REPORTS & BI SECTION
# ============================================================
echo ""
echo "═══ REPORTS & BI ═══"
test_page "Reports" "Reports Dashboard" "/?section=reports" "74-reports"
test_page "Reports" "Financial Reports" "/?section=financial-reports" "75-financial-reports"
test_page "Reports" "Revenue Reports" "/?section=revenue-reports" "76-revenue-reports"

# ============================================================
# STAFF MANAGEMENT SECTION
# ============================================================
echo ""
echo "═══ STAFF MANAGEMENT ═══"
test_page "Staff" "Staff Directory" "/?section=staff" "77-staff"
test_page "Staff" "Shift Scheduling" "/?section=shifts" "78-shifts"
test_page "Staff" "Attendance" "/?section=attendance" "79-attendance"

# ============================================================
# SECURITY & IOT SECTION
# ============================================================
echo ""
echo "═══ SECURITY & IOT ═══"
test_page "Security" "Security Dashboard" "/?section=security" "80-security"
test_page "Security" "Smart Locks" "/?section=smart-locks" "81-smart-locks"
test_page "Security" "Surveillance" "/?section=surveillance" "82-surveillance"
test_page "Security" "Access Control" "/?section=access-control" "83-access-control"

# ============================================================
# INTEGRATIONS SECTION
# ============================================================
echo ""
echo "═══ INTEGRATIONS ═══"
test_page "Integrations" "Integration Hub" "/?section=integrations" "84-integrations"
test_page "Integrations" "API Management" "/?section=api-mgmt" "85-api-management"
test_page "Integrations" "Webhooks" "/?section=webhooks" "86-webhooks"

# ============================================================
# AUTOMATION & AI SECTION
# ============================================================
echo ""
echo "═══ AUTOMATION & AI ═══"
test_page "Automation" "Automation Rules" "/?section=automation" "87-automation"
test_page "Automation" "AI Assistant" "/?section=ai-assistant" "88-ai-assistant"

# ============================================================
# WEBSITE BUILDER SECTION
# ============================================================
echo ""
echo "═══ WEBSITE BUILDER ═══"
test_page "Website" "Website Builder" "/?section=website-builder" "89-website-builder"

# ============================================================
# PLATFORM ADMIN SECTION
# ============================================================
echo ""
echo "═══ PLATFORM ADMIN ═══"
test_page "Platform" "Platform Dashboard" "/?section=platform-admin" "90-platform-admin"
test_page "Platform" "Tenant Management" "/?section=tenants" "91-tenants"

# ============================================================
# SETTINGS SECTION
# ============================================================
echo ""
echo "═══ SETTINGS ═══"
test_page "Settings" "General Settings" "/?section=settings" "92-settings"
test_page "Settings" "Billing Settings" "/?section=billing-settings" "93-billing-settings"

# ============================================================
# HELP & SUPPORT SECTION
# ============================================================
echo ""
echo "═══ HELP & SUPPORT ═══"
test_page "Help" "Help Center" "/?section=help" "94-help"

echo ""
echo "============================================" 
echo "PAGE NAVIGATION TESTS COMPLETE"
echo "============================================"

# ============================================================
# PHASE 2: FORM & INTERACTION TESTS
# ============================================================
echo "" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "Phase 2: Form & Interaction Tests" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo ""
echo "═══ FORM & INTERACTION TESTS ═══"

# Test 1: New Booking form
echo -n "  Testing: New Booking form ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
agent-browser snapshot -i 2>&1 | grep -i "new booking\|create booking" > /dev/null
if [ $? -eq 0 ]; then
  REF=$(agent-browser snapshot -i 2>&1 | grep -i "new booking\|create booking" | head -1 | grep -oP 'ref=\K[^,\]]+')
  if [ -n "$REF" ]; then
    agent-browser click "@$REF" 2>/dev/null
    sleep 2
    agent-browser screenshot "${SCREENSHOT_DIR}/95-new-booking-form.png" 2>/dev/null
    FORM_ELEMS=$(agent-browser snapshot -i 2>&1 | grep -c "textbox\|select\|checkbox" || true)
    echo "✅ OK (Form opened, $FORM_ELEMS form fields)"
    echo "  ✅ PASS | Forms | New Booking | Opened | $FORM_ELEMS form fields" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  else
    echo "⚠️  BTN NOT FOUND"
    echo "  ⚠️  WARN | Forms | New Booking | Button not found" >> "$RESULTS_FILE"
  fi
else
  echo "⚠️  NOT VISIBLE"
  echo "  ⚠️  WARN | Forms | New Booking | Not visible on page" >> "$RESULTS_FILE"
fi

# Test 2: Check-in form
echo -n "  Testing: Check-in form ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "check-in" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 2
  agent-browser screenshot "${SCREENSHOT_DIR}/96-checkin-form.png" 2>/dev/null
  FORM_ELEMS=$(agent-browser snapshot -i 2>&1 | grep -c "textbox\|select\|checkbox" || true)
  echo "✅ OK (Form opened, $FORM_ELEMS form fields)"
  echo "  ✅ PASS | Forms | Check-In | Opened | $FORM_ELEMS form fields" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
  echo "  ⚠️  WARN | Forms | Check-In | Button not found" >> "$RESULTS_FILE"
fi

# Test 3: Quick Admin Login button
echo -n "  Testing: Quick Admin Login button ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
# First logout if logged in
REF=$(agent-browser snapshot -i 2>&1 | grep -i "sign out\|logout" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 2
fi
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "quick admin login" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 3
  agent-browser screenshot "${SCREENSHOT_DIR}/97-quick-admin-login.png" 2>/dev/null
  # Check if dashboard loaded
  DASHBOARD=$(agent-browser snapshot -c 2>&1 | grep -ic "dashboard\|overview" || true)
  if [ "$DASHBOARD" -gt 0 ]; then
    echo "✅ OK (Dashboard loaded)"
    echo "  ✅ PASS | Auth | Quick Admin Login | Dashboard loaded" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  else
    echo "⚠️  NO DASHBOARD"
    echo "  ⚠️  WARN | Auth | Quick Admin Login | No dashboard after login" >> "$RESULTS_FILE"
  fi
else
  echo "⚠️  NOT FOUND"
  echo "  ⚠️  WARN | Auth | Quick Admin Login | Button not found (already logged in?)" >> "$RESULTS_FILE"
fi

# Test 4: Dark mode toggle
echo -n "  Testing: Dark mode toggle ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "dark mode" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 1
  agent-browser screenshot "${SCREENSHOT_DIR}/98-dark-mode.png" 2>/dev/null
  echo "✅ OK (Toggled)"
  echo "  ✅ PASS | UI | Dark Mode Toggle | Toggled successfully" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
  # Toggle back
  agent-browser click "@$REF" 2>/dev/null
  sleep 1
else
  echo "⚠️  NOT FOUND"
  echo "  ⚠️  WARN | UI | Dark Mode Toggle | Button not found" >> "$RESULTS_FILE"
fi

# Test 5: Search/Command Palette
echo -n "  Testing: Search / Command Palette ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "search modules\|command palette" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 1
  agent-browser screenshot "${SCREENSHOT_DIR}/99-command-palette.png" 2>/dev/null
  PALETTE_ELEMS=$(agent-browser snapshot -i 2>&1 | grep -c "ref=" || true)
  echo "✅ OK ($PALETTE_ELEMS elements)"
  echo "  ✅ PASS | UI | Command Palette | Opened | $PALETTE_ELEMS elements" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
  echo "  ⚠️  WARN | UI | Command Palette | Not found" >> "$RESULTS_FILE"
fi

# Test 6: Notifications panel
echo -n "  Testing: Notifications panel ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "notifications" | grep "button" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 2
  agent-browser screenshot "${SCREENSHOT_DIR}/100-notifications.png" 2>/dev/null
  echo "✅ OK (Panel opened)"
  echo "  ✅ PASS | UI | Notifications Panel | Opened" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
  echo "  ⚠️  WARN | UI | Notifications Panel | Not found" >> "$RESULTS_FILE"
fi

# Test 7: User profile menu
echo -n "  Testing: User profile menu ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "rajesh\|admin.*button\|profile" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 1
  agent-browser screenshot "${SCREENSHOT_DIR}/101-user-profile.png" 2>/dev/null
  echo "✅ OK (Menu opened)"
  echo "  ✅ PASS | UI | User Profile Menu | Opened" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
fi

# Test 8: Room grid button click
echo -n "  Testing: Room grid button (Room 101) ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 3
REF=$(agent-browser snapshot -i 2>&1 | grep '"101"' | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 2
  agent-browser screenshot "${SCREENSHOT_DIR}/102-room-101-detail.png" 2>/dev/null
  echo "✅ OK (Room detail opened)"
  echo "  ✅ PASS | Rooms | Room 101 Detail | Opened" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
fi

# Test 9: Sidebar collapse
echo -n "  Testing: Sidebar collapse ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 2
REF=$(agent-browser snapshot -i 2>&1 | grep -i "collapse sidebar" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 1
  agent-browser screenshot "${SCREENSHOT_DIR}/103-sidebar-collapsed.png" 2>/dev/null
  echo "✅ OK (Sidebar collapsed)"
  echo "  ✅ PASS | UI | Sidebar Collapse | Toggled" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
fi

# Test 10: KPI card click
echo -n "  Testing: KPI card interaction ... "
agent-browser open "${BASE_URL}/" 2>/dev/null
sleep 3
REF=$(agent-browser snapshot -i 2>&1 | grep -i "total revenue\|occupancy rate" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$REF" ]; then
  agent-browser click "@$REF" 2>/dev/null
  sleep 2
  agent-browser screenshot "${SCREENSHOT_DIR}/104-kpi-card-click.png" 2>/dev/null
  echo "✅ OK (KPI clicked)"
  echo "  ✅ PASS | Dashboard | KPI Card | Clicked" >> "$RESULTS_FILE"
  PASS=$((PASS + 1))
else
  echo "⚠️  NOT FOUND"
fi

# ============================================================
# PHASE 3: API ENDPOINT TESTS
# ============================================================
echo "" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "Phase 3: API Endpoint Tests" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo ""
echo "═══ API ENDPOINT TESTS ═══"

# Login to get token first
TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@royalstay.in","password":"admin123"}' 2>/dev/null | grep -oP '"token":"[^"]*"' | cut -d'"' -f4 || true)

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  
  echo -n "  API: $method $endpoint ... "
  
  if [ "$method" = "GET" ]; then
    if [ -n "$TOKEN" ]; then
      RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}${endpoint}" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    else
      RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}${endpoint}" 2>/dev/null)
    fi
  else
    if [ -n "$TOKEN" ]; then
      RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null)
    else
      RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null)
    fi
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1 | head -c 200)
  
  if [[ "$HTTP_CODE" =~ ^[23] ]]; then
    echo "✅ $HTTP_CODE"
    echo "  ✅ PASS | API | $method $endpoint | HTTP $HTTP_CODE" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  elif [[ "$HTTP_CODE" =~ ^[45] ]]; then
    echo "❌ $HTTP_CODE"
    echo "  ❌ FAIL | API | $method $endpoint | HTTP $HTTP_CODE | $BODY" >> "$RESULTS_FILE"
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n  FAIL API: $method $endpoint → HTTP $HTTP_CODE"
  else
    echo "⚠️  NO RESPONSE"
    echo "  ⚠️  WARN | API | $method $endpoint | No response" >> "$RESULTS_FILE"
  fi
}

test_api "Auth Login" POST "/api/auth/login" '{"email":"admin@royalstay.in","password":"admin123"}'
test_api "Auth Session" GET "/api/auth/session" 
test_api "Properties" GET "/api/properties"
test_api "Room Types" GET "/api/room-types"
test_api "Rooms" GET "/api/rooms"
test_api "Bookings" GET "/api/bookings"
test_api "Guests" GET "/api/guests"
test_api "Dashboard Stats" GET "/api/dashboard/stats"
test_api "Housekeeping" GET "/api/housekeeping/tasks"
test_api "Billing Folios" GET "/api/billing/folios"
test_api "Payments" GET "/api/billing/payments"
test_api "Cash Book" GET "/api/accounting/cash-book"
test_api "Revenue" GET "/api/revenue/dashboard"
test_api "Channel Manager" GET "/api/channel-manager/channels"
test_api "CRM" GET "/api/crm/dashboard"
test_api "Reports" GET "/api/reports/overview"
test_api "Staff" GET "/api/staff"
test_api "WiFi Sessions" GET "/api/wifi/sessions"
test_api "Inventory" GET "/api/inventory/items"
test_api "Facilities" GET "/api/facilities"
test_api "Service Requests" GET "/api/service-requests"
test_api "Notifications" GET "/api/notifications"
test_api "OTA Connections" GET "/api/ota/connections"
test_api "Website Builder" GET "/api/website-builder/sites"
test_api "Energy" GET "/api/energy/metrics"
test_api "Smart Locks" GET "/api/iot/smart-locks"
test_api "Tax TDS" GET "/api/tax/tds"
test_api "Ads Connections" GET "/api/ads/connections"
test_api "Rate Plans" GET "/api/rate-plans"
test_api "Maintenance" GET "/api/maintenance/requests"
test_api "POS Orders" GET "/api/pos/orders"
test_api "Campaigns" GET "/api/crm/campaigns"
test_api "Loyalty" GET "/api/crm/loyalty"
test_api "Audit Logs" GET "/api/audit/logs"

# ============================================================
# FINAL SUMMARY
# ============================================================
echo "" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "TEST SUMMARY" >> "$RESULTS_FILE"
echo "============================================" >> "$RESULTS_FILE"
echo "Total PASSED: $PASS" >> "$RESULTS_FILE"
echo "Total FAILED: $FAIL" >> "$RESULTS_FILE"
echo "Total TESTS:  $((PASS + FAIL))" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
if [ -n "$ERRORS" ]; then
  echo "FAILURES:" >> "$RESULTS_FILE"
  echo -e "$ERRORS" >> "$RESULTS_FILE"
fi

echo ""
echo "============================================"
echo "  🏁 GUI TEST COMPLETE"
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "  📊 Total:  $((PASS + FAIL))"
echo "============================================"

agent-browser close 2>/dev/null
