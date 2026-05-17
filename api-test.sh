#!/bin/bash
# API tester - tests multiple API endpoints
# Usage: bash api-test.sh

BASE_URL="http://localhost:3000"

# Login first
LOGIN_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@royalstay.in","password":"admin123"}' 2>/dev/null)
TOKEN=$(echo "$LOGIN_RESP" | grep -oP '"token":"[^"]*"' | cut -d'"' -f4 || true)
COOKIE=$(echo "$LOGIN_RESP" | grep -oP 'Set-Cookie: [^;]*' | head -1 | cut -d' ' -f2 || true)

ENDPOINTS=(
  "GET /api/auth/session"
  "GET /api/properties"
  "GET /api/room-types"
  "GET /api/rooms"
  "GET /api/bookings"
  "GET /api/guests"
  "GET /api/dashboard/stats"
  "GET /api/housekeeping/tasks"
  "GET /api/billing/folios"
  "GET /api/billing/payments"
  "GET /api/accounting/cash-book"
  "GET /api/revenue/dashboard"
  "GET /api/channel-manager/channels"
  "GET /api/crm/dashboard"
  "GET /api/reports/overview"
  "GET /api/staff"
  "GET /api/wifi/sessions"
  "GET /api/inventory/items"
  "GET /api/facilities"
  "GET /api/service-requests"
  "GET /api/notifications"
  "GET /api/ota/connections"
  "GET /api/website-builder/sites"
  "GET /api/energy/metrics"
  "GET /api/iot/smart-locks"
  "GET /api/tax/tds"
  "GET /api/ads/connections"
  "GET /api/rate-plans"
  "GET /api/maintenance/requests"
  "GET /api/pos/orders"
  "GET /api/crm/campaigns"
  "GET /api/crm/loyalty"
  "GET /api/audit/logs"
  "GET /api/financials/cash-flow"
  "GET /api/financials/budgets"
  "GET /api/revenue/hourly-pricing"
  "GET /api/automation/rules"
  "GET /api/integrations"
  "GET /api/iot/access-schedules"
  "GET /api/guests/vip"
  "GET /api/guests/vip-rules"
  "GET /api/website-builder/sync"
  "GET /api/ads/connections/test"
  "POST /api/auth/login"
)

for ep in "${ENDPOINTS[@]}"; do
  METHOD=$(echo "$ep" | cut -d' ' -f1)
  PATH_=$(echo "$ep" | cut -d' ' -f2)
  
  if [ "$METHOD" = "POST" ] && [ "$PATH_" = "/api/auth/login" ]; then
    RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}${PATH_}" \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@royalstay.in","password":"admin123"}' 2>/dev/null)
  elif [ -n "$TOKEN" ]; then
    RESP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${PATH_}" \
      -H "Authorization: Bearer $TOKEN" -b "next-auth.session-token=$TOKEN" 2>/dev/null)
  else
    RESP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${PATH_}" 2>/dev/null)
  fi
  
  if [[ "$RESP" =~ ^[23] ]]; then
    echo "✅ $RESP | $METHOD $PATH_"
  elif [[ "$RESP" =~ ^4 ]]; then
    echo "⚠️ $RESP | $METHOD $PATH_ (client error)"
  elif [[ "$RESP" =~ ^5 ]]; then
    echo "❌ $RESP | $METHOD $PATH_ (server error)"
  else
    echo "❓ N/A | $METHOD $PATH_ (no response: $RESP)"
  fi
done
