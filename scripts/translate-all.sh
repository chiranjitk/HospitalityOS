#!/bin/bash
# translate-all.sh - Translate all locales by namespace
# Usage: bash scripts/translate-all.sh [locale]
# If locale specified, only translate that locale. Otherwise translate all.

set -e

LOCALES=("ar" "bn" "de" "es" "fr" "gu" "hi" "ja" "ml" "mr" "pt" "ta" "te" "zh")
NAMESPACES=("navigation" "common" "layout" "forms" "messages" "language" "status" "dashboard" "bookings" "guests" "pms" "billing" "frontdesk" "pos" "inventory" "housekeeping" "experience" "communication" "parking" "security" "crm" "automation" "reports" "revenue" "channels" "integrations" "notifications" "webhooks" "ai" "admin" "settings" "chain" "marketing" "ads" "events" "staff" "help" "profile" "portal" "gdpr" "iot" "wifi" "auth" "audit")

if [ -n "$1" ]; then
  LOCALES=("$1")
fi

echo "========================================="
echo "  StaySuite i18n Translation Runner"
echo "  Locales: ${LOCALES[*]}"
echo "  Namespaces: ${#NAMESPACES[@]}"
echo "========================================="
echo ""

for LOCALE in "${LOCALES[@]}"; do
  echo "===== Translating $LOCALE ====="
  START=$(date +%s)
  
  for NS in "${NAMESPACES[@]}"; do
    RESULT=$(curl -s -X POST http://localhost:3000/api/translate \
      -H "Content-Type: application/json" \
      -d "{\"locale\":\"$LOCALE\",\"namespace\":\"$NS\"}" 2>/dev/null || echo '{"error":"request_failed"}')
    
    # Extract applied count
    APPLIED=$(echo "$RESULT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);console.log(j.applied||0);}catch{console.log(0);}" 2>/dev/null)
    
    if [ "$APPLIED" -gt 0 ]; then
      echo "  $NS: $APPLIED keys translated"
    fi
    
    # Small delay between requests
    sleep 0.5
  done
  
  END=$(date +%s)
  DURATION=$(( (END - START) / 60 ))
  echo "  $LOCALE completed in ${DURATION}m"
  echo ""
done

echo "========================================="
echo "  Checking final translation status..."
echo "========================================="
curl -s http://localhost:3000/api/translate | node -e "
const d=require('fs').readFileSync(0,'utf8');
const j=JSON.parse(d);
console.log('');
console.log('Locale | Translated | Coverage');
console.log('-------|------------|----------');
for (const [loc, s] of Object.entries(j)) {
  console.log(loc.padEnd(6) + ' | ' + String(s.translated).padStart(10) + ' | ' + s.pct + '%');
}
"
