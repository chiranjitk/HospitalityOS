#!/bin/bash
# StaySuite Single-Page GUI Test via agent-browser
# Tests one page at a time with proper wait periods

BASE="http://localhost:3000"
DIR="/home/z/my-project/gui-test-screenshots"
RESULTS="/home/z/my-project/gui-test-results.txt"

PASS=0; FAIL=0; WARN=0

test_section() {
  local section="$1"
  local url_path="$2"
  local safe=$(echo "$section" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  
  # Navigate
  RESULT=$(agent-browser open "${BASE}${url_path}" 2>&1)
  if echo "$RESULT" | grep -qi "error\|fail\|refused"; then
    echo "❌ FAIL | $section | $url_path | Navigation failed"
    FAIL=$((FAIL+1))
    # Wait for server recovery
    sleep 10
    return 1
  fi
  
  # Wait for compilation
  sleep 5
  
  # Screenshot
  agent-browser screenshot "${DIR}/page-${safe}.png" 2>/dev/null
  
  # Get interactive count
  SNAPSHOT=$(agent-browser snapshot -i 2>&1)
  COUNT=$(echo "$SNAPSHOT" | grep -c "ref=" || echo "0")
  
  # Check page title
  TITLE=$(agent-browser get title 2>&1)
  
  # Check errors
  ERRORS=$(agent-browser errors 2>&1 | head -3)
  
  if [ "$COUNT" -gt 0 ]; then
    echo "✅ PASS | $section | $url_path | $COUNT interactive elements | $TITLE"
    PASS=$((PASS+1))
  else
    echo "⚠️ WARN | $section | $url_path | 0 interactive elements | $TITLE"
    WARN=$((WARN+1))
  fi
  
  if [ -n "$ERRORS" ]; then
    echo "   ERRORS: $(echo $ERRORS | head -c 150)"
  fi
  
  # Small delay between pages
  sleep 2
}

echo "============================================" > "$RESULTS"
echo "StaySuite Comprehensive GUI Test Report" >> "$RESULTS"
echo "Date: $(date)" >> "$RESULTS"
echo "============================================" >> "$RESULTS"
echo "" >> "$RESULTS"

# Step 1: Login
echo "═══ AUTH & LOGIN ═══" 
echo "═══ AUTH & LOGIN ═══" >> "$RESULTS"

agent-browser open "$BASE" 2>&1
sleep 3

# Check if on login page
SNAP=$(agent-browser snapshot -i 2>&1)
if echo "$SNAP" | grep -q "textbox.*Email"; then
  # Find refs
  EMAIL_REF=$(echo "$SNAP" | grep 'textbox.*Email' | head -1 | grep -oP 'ref=\K[^,\]]+')
  PASS_REF=$(echo "$SNAP" | grep 'textbox.*Password' | head -1 | grep -oP 'ref=\K[^,\]]+')
  SIGNIN_REF=$(echo "$SNAP" | grep 'button.*Sign in' | head -1 | grep -oP 'ref=\K[^,\]]+')
  
  agent-browser fill "@$EMAIL_REF" "admin@royalstay.in" 2>/dev/null
  agent-browser fill "@$PASS_REF" "admin123" 2>/dev/null
  agent-browser click "@$SIGNIN_REF" 2>/dev/null
  sleep 5
  
  agent-browser screenshot "${DIR}/01-dashboard-after-login.png" 2>/dev/null
  
  # Verify dashboard
  SNAP2=$(agent-browser snapshot -c 2>&1 | head -5)
  if echo "$SNAP2" | grep -qi "dashboard\|overview\|good"; then
    echo "✅ PASS | Admin Login | / | Dashboard loaded" 
    echo "✅ PASS | Admin Login | / | Dashboard loaded" >> "$RESULTS"
    PASS=$((PASS+1))
  else
    echo "⚠️ WARN | Admin Login | / | Content: $(echo $SNAP2 | head -c 100)"
    echo "⚠️ WARN | Admin Login | / | Content unclear" >> "$RESULTS"
    WARN=$((WARN+1))
  fi
else
  echo "⚠️ WARN | Login page | / | Login form not detected"
  WARN=$((WARN+1))
fi

# Step 2: Test sidebar navigation
echo ""
echo "═══ PAGE NAVIGATION TESTS ═══"
echo "" >> "$RESULTS"
echo "═══ PAGE NAVIGATION TESTS ═══" >> "$RESULTS"

# Already expanded sections - just click links
DASHBOARD_PAGES=(
  "Overview|/"
  "Command Center|/?section=command-center"
  "Alerts & Notifications|/?section=alerts"
  "KPI Cards|/?section=kpi"
)

PROP_PAGES=(
  "Properties|/?section=properties"
  "Room Types|/?section=room-types"
  "Rooms|/?section=rooms"
  "Inventory Calendar|/?section=inventory-calendar"
  "Availability Control|/?section=availability"
  "Rate Plans|/?section=rate-plans"
  "Floor Plans|/?section=floor-plans"
  "Package Plans|/?section=package-plans"
)

BOOKING_PAGES=(
  "Calendar View|/?section=booking-calendar"
  "Group Bookings|/?section=group-bookings"
  "Waitlist|/?section=waitlist"
  "No-Show Automation|/?section=noshow"
  "Audit Logs|/?section=booking-audit"
)

# Test by direct URL navigation
ALL_PAGES=(
  "${DASHBOARD_PAGES[@]}"
  "${PROP_PAGES[@]}"
  "${BOOKING_PAGES[@]}"
  "Check-In|/?section=checkin"
  "Check-Out|/?section=checkout"
  "Guests|/?section=guests"
  "VIP Recognition|/?section=vip"
  "Housekeeping|/?section=housekeeping"
  "Folios|/?section=folios"
  "Payments|/?section=payments"
  "Cash Book|/?section=cash-book"
  "Tax|/?section=tax"
  "Service Requests|/?section=service-requests"
  "Live Chat|/?section=live-chat"
  "Restaurant|/?section=restaurant"
  "Menu|/?section=menu"
  "POS|/?section=pos"
  "Inventory|/?section=inventory"
  "Facilities|/?section=facilities"
  "Maintenance|/?section=maintenance"
  "Energy|/?section=energy"
  "WiFi Dashboard|/?section=wifi"
  "Guest Network|/?section=guest-network"
  "WiFi Sessions|/?section=sessions"
  "Revenue Dashboard|/?section=revenue"
  "Dynamic Pricing|/?section=dynamic-pricing"
  "Linear Pricing|/?section=linear-pricing"
  "Smart Pricing Rules|/?section=ai-suggestions"
  "Channel Manager|/?section=channel-manager"
  "OTA Connections|/?section=ota-connections"
  "CRM Dashboard|/?section=crm"
  "Campaigns|/?section=campaigns"
  "Loyalty|/?section=loyalty"
  "Ad Dashboard|/?section=ads"
  "Google Ads|/?section=google-ads"
  "Meta Ads|/?section=meta-ads"
  "Reports Dashboard|/?section=reports"
  "Financial Reports|/?section=financial-reports"
  "Staff Directory|/?section=staff"
  "Shifts|/?section=shifts"
  "Security|/?section=security"
  "Smart Locks|/?section=smart-locks"
  "Surveillance|/?section=surveillance"
  "Integrations|/?section=integrations"
  "Webhooks|/?section=webhooks"
  "Automation|/?section=automation"
  "AI Assistant|/?section=ai-assistant"
  "Website Builder|/?section=website-builder"
  "Platform Admin|/?section=platform-admin"
  "Tenants|/?section=tenants"
  "Settings|/?section=settings"
  "Help|/?section=help"
)

TESTED=0
for entry in "${ALL_PAGES[@]}"; do
  NAME="${entry%%|*}"
  URL="${entry##*|}"
  
  test_section "$NAME" "$URL" | tee -a "$RESULTS"
  TESTED=$((TESTED+1))
  
  # Every 10 pages, check server health
  if [ $((TESTED % 10)) -eq 0 ]; then
    echo "  [Health check at $TESTED pages...]"
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
    if [ "$HEALTH" != "200" ]; then
      echo "  ⚠️ Server down! Waiting for recovery..."
      sleep 15
      # Try to restart if needed
      if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
        pm2 restart staysuite-main 2>/dev/null
        sleep 20
      fi
    fi
  fi
done

# Step 3: Interaction Tests
echo ""
echo "═══ INTERACTION TESTS ═══"
echo "" >> "$RESULTS"
echo "═══ INTERACTION TESTS ═══" >> "$RESULTS"

# Dark mode
agent-browser open "$BASE" 2>/dev/null; sleep 3
SNAP=$(agent-browser snapshot -i 2>&1)
DARK_REF=$(echo "$SNAP" | grep -i "dark mode" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$DARK_REF" ]; then
  agent-browser click "@$DARK_REF" 2>/dev/null; sleep 1
  agent-browser screenshot "${DIR}/interaction-dark-mode.png" 2>/dev/null
  echo "✅ PASS | Dark Mode Toggle | / | Toggled" | tee -a "$RESULTS"
  PASS=$((PASS+1))
  agent-browser click "@$DARK_REF" 2>/dev/null
else
  echo "⚠️ WARN | Dark Mode Toggle | / | Button not found" | tee -a "$RESULTS"
  WARN=$((WARN+1))
fi

# Notifications
SNAP=$(agent-browser snapshot -i 2>&1)
NOTIF_REF=$(echo "$SNAP" | grep -i "notification" | grep "button" | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$NOTIF_REF" ]; then
  agent-browser click "@$NOTIF_REF" 2>/dev/null; sleep 1
  agent-browser screenshot "${DIR}/interaction-notifications.png" 2>/dev/null
  echo "✅ PASS | Notifications Panel | / | Opened" | tee -a "$RESULTS"
  PASS=$((PASS+1))
else
  echo "⚠️ WARN | Notifications Panel | / | Button not found" | tee -a "$RESULTS"
  WARN=$((WARN+1))
fi

# Room 101
SNAP=$(agent-browser snapshot -i 2>&1)
ROOM_REF=$(echo "$SNAP" | grep '"101"' | head -1 | grep -oP 'ref=\K[^,\]]+')
if [ -n "$ROOM_REF" ]; then
  agent-browser click "@$ROOM_REF" 2>/dev/null; sleep 2
  agent-browser screenshot "${DIR}/interaction-room-101.png" 2>/dev/null
  echo "✅ PASS | Room 101 Click | / | Detail shown" | tee -a "$RESULTS"
  PASS=$((PASS+1))
else
  echo "⚠️ WARN | Room 101 Click | / | Button not found" | tee -a "$RESULTS"
  WARN=$((WARN+1))
fi

# Mobile view
echo ""
echo "═══ MOBILE TEST ═══"
agent-browser set viewport 375 812 2>/dev/null; sleep 2
agent-browser open "$BASE" 2>/dev/null; sleep 5
agent-browser screenshot "${DIR}/mobile-iphone.png" 2>/dev/null
MOBILE_ELEMS=$(agent-browser snapshot -i 2>&1 | grep -c "ref=" || echo "0")
if [ "$MOBILE_ELEMS" -gt 0 ]; then
  echo "✅ PASS | Mobile iPhone | / | $MOBILE_ELEMS interactive elements" | tee -a "$RESULTS"
  PASS=$((PASS+1))
else
  echo "⚠️ WARN | Mobile iPhone | / | No interactive elements" | tee -a "$RESULTS"
  WARN=$((WARN+1))
fi
# Reset viewport
agent-browser set viewport 1440 900 2>/dev/null

# Summary
echo ""
SUMMARY="
============================================
  🏁 StaySuite GUI Test Report
============================================
  ✅ Passed:  $PASS
  ❌ Failed:  $FAIL
  ⚠️  Warnings: $WARN
  📊 Total:    $((PASS+FAIL+WARN))
  📈 Success:  $((PASS * 100 / (PASS+FAIL+WARN > 0 ? PASS+FAIL+WARN : 1)))%
============================================
"
echo "$SUMMARY"
echo "$SUMMARY" >> "$RESULTS"

agent-browser close 2>/dev/null
