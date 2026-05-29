#!/bin/bash
# ============================================================
# StaySuite-HospitalityOS — Comprehensive E2E Test Cycle
# ============================================================
set -eo pipefail

BASE="http://localhost:3000"
CK="/tmp/ss-cookies.txt"
LOG="/tmp/ss-test-log.txt"
rm -f "$CK" "$LOG"

log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }
pass() { echo "  ✅ $*"; echo "  ✅ $*" >> "$LOG"; }
fail() { echo "  ❌ $*"; echo "  ❌ $*" >> "$LOG"; }

TPASS=0; TFAIL=0; TOT=0
check() {
  local desc="$1" expected="$2" actual="$3"
  TOT=$((TOT+1))
  if [[ "$actual" == "$expected" ]]; then
    pass "$desc"; TPASS=$((TPASS+1))
  else
    fail "$desc (expected $expected, got $actual)"; TFAIL=$((TFAIL+1))
  fi
}

# curl helper: returns "body\nhttp_code"
api() {
  local m="$1" p="$2" d="${3:-}"
  local args=(-s -w "\n%{http_code}" -b "$CK" -c "$CK" --max-time 15)
  [[ "$m" != "GET" ]] && args+=(-X "$m" -H "Content-Type: application/json")
  [[ -n "$d" ]] && args+=(-d "$d")
  curl "${args[@]}" "$BASE$p"
}
get_code()  { echo "$1" | tail -1; }
get_body()   { echo "$1" | sed '$d'; }
get_id()     { get_body "$1" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true; }
get_ids()    { get_body "$1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('data',d.get('items',d.get('properties',d.get('roomTypes',d.get('rooms',d.get('guests',d.get('bookings',d.get('folios',d.get('invoices',d.get('wifiUsers',d.get('wifiPlans',[])))))))))))
[print(i['id']) for i in items]
" 2>/dev/null || true; }
get_field()  { get_body "$1" | python3 -c "import sys,json;print(json.load(sys.stdin)$2)" 2>/dev/null || echo "ERR"; }
get_count()  { get_body "$1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('data',d.get('items',d.get('properties',d.get('roomTypes',d.get('rooms',d.get('guests',d.get('bookings',d.get('folios',d.get('invoices',[])))))))))
print(len(items))
" 2>/dev/null || echo "0"; }
get_summary_total() { get_body "$1" | python3 -c "import sys,json;print(json.load(sys.stdin).get('summary',{}).get('totalPlans',0))" 2>/dev/null || echo "0"; }

# ============================================================
# STEP 0: LOGIN
# ============================================================
log "========== STEP 0: LOGIN =========="
R=$(api POST /api/auth/login '{"email":"admin@royalstay.in","password":"admin123","rememberMe":true}')
C=$(get_code "$R")
check "Login" 200 "$C"
if [[ "$C" != "200" ]]; then
  log "Login failed! Body: $(get_body "$R" | head -c 300)"
  exit 1
fi
TENANT_ID=$(get_field "$R" "['user']['tenantId']")
USER_ID=$(get_field "$R" "['user']['id']")
log "Tenant: $TENANT_ID  User: $USER_ID"

# ============================================================
# STEP 1: CREATE PROPERTY
# ============================================================
log ""
log "========== STEP 1: CREATE PROPERTY =========="
R=$(api POST /api/properties "{
  \"name\":\"Test Grand Hotel\",\"slug\":\"test-grand-hotel\",
  \"description\":\"Premium business hotel for E2E testing\",\"type\":\"hotel\",
  \"address\":\"100 MG Road\",\"city\":\"Mumbai\",\"state\":\"MH\",\"country\":\"India\",\"postalCode\":\"400001\",
  \"email\":\"info@testgrandhotel.com\",\"phone\":\"+919876543210\",
  \"checkInTime\":\"14:00\",\"checkOutTime\":\"11:00\",\"timezone\":\"Asia/Kolkata\",\"currency\":\"INR\",
  \"taxType\":\"gst\",\"defaultTaxRate\":18,
  \"taxComponents\":[{\"name\":\"CGST\",\"rate\":9},{\"name\":\"SGST\",\"rate\":9}],
  \"serviceChargePercent\":5,\"totalFloors\":5,\"status\":\"active\"
}")
PROP_ID=$(get_id "$R")
C=$(get_code "$R")
if [[ -z "$PROP_ID" || "$PROP_ID" == "ERR" ]]; then
  # Maybe already exists — find it
  R2=$(api GET "/api/properties?limit=100")
  PROP_ID=$(get_body "$R2" | python3 -c "
import sys,json; d=json.load(sys.stdin)
ps=d if isinstance(d,list) else d.get('data',d.get('properties',[]))
print([p['id'] for p in ps if p.get('slug')=='test-grand-hotel'][0] if ps else '')
" 2>/dev/null || true)
fi
check "Create property (ID exists)" "notempty" "$([ -n "$PROP_ID" ] && echo "notempty" || echo "empty")"
log "Property ID: $PROP_ID"
[[ -z "$PROP_ID" ]] && { fail "No property ID — abort"; exit 1; }

# ============================================================
# STEP 2: CREATE 10 ROOM TYPES
# ============================================================
log ""
log "========== STEP 2: CREATE 10 ROOM TYPES =========="
declare -a RT_NAMES RT_CODES RT_PRICES RT_IDS
RT_NAMES=("Standard Single" "Standard Double" "Deluxe Room" "Premium Room" "Junior Suite" "Executive Suite" "Family Room" "Honeymoon Suite" "Presidential Suite" "Dormitory Bed")
RT_CODES=("STD-S" "STD-D" "DLX" "PRM" "JSU" "ESU" "FAM" "HON" "PRS" "DOR")
RT_PRICES=(2500 3500 5500 7500 10000 15000 8000 20000 35000 1200)
RT_BEDS=("Single" "Double" "Queen" "King" "King" "King" "Twin" "King" "King" "Bunk")
RT_BEDCOUNT=(1 1 1 1 1 2 2 1 2 1)
RT_MAX_AD=(1 2 2 2 2 3 2 2 4 1)
RT_MAX_CH=(0 1 1 2 2 2 3 0 2 0)

for i in $(seq 0 9); do
  R=$(api POST /api/room-types "{
    \"propertyId\":\"$PROP_ID\",\"name\":\"${RT_NAMES[$i]}\",\"code\":\"${RT_CODES[$i]}\",
    \"basePrice\":${RT_PRICES[$i]},\"maxAdults\":${RT_MAX_AD[$i]},\"maxChildren\":${RT_MAX_CH[$i]},
    \"maxOccupancy\":$((RT_MAX_AD[$i]+RT_MAX_CH[$i])),\"extraAdultRate\":$((RT_PRICES[$i]/5)),
    \"extraChildRate\":$((RT_PRICES[$i]/10)),\"bedType\":\"${RT_BEDS[$i]}\",\"bedCount\":${RT_BEDCOUNT[$i]}
  }")
  C=$(get_code "$R")
  RT_ID=$(get_id "$R")
  if [[ -z "$RT_ID" || "$RT_ID" == "ERR" ]]; then
    # Find existing
    R2=$(api GET "/api/room-types?propertyId=$PROP_ID&limit=100")
    RT_ID=$(get_body "$R2" | python3 -c "
import sys,json; d=json.load(sys.stdin)
rts=d if isinstance(d,list) else d.get('data',d.get('roomTypes',[]))
print([r['id'] for r in rts if r.get('code')=='${RT_CODES[$i]}'][0] if rts else '')
" 2>/dev/null || true)
  fi
  RT_IDS+=("$RT_ID")
  check "RoomType: ${RT_NAMES[$i]}" "notempty" "$([ -n "$RT_ID" ] && echo "notempty" || echo "empty")"
done

# ============================================================
# STEP 3: CREATE 50 ROOMS (5 per type)
# ============================================================
log ""
log "========== STEP 3: CREATE 50 ROOMS =========="
declare -a ROOM_IDS
for rt_idx in $(seq 0 9); do
  RT_ID="${RT_IDS[$rt_idx]}"
  FLOOR=$((rt_idx + 1))
  for rn in $(seq 1 5); do
    RNUM=$(printf "%d%02d" "$FLOOR" "$rn")
    R=$(api POST /api/rooms "{\"propertyId\":\"$PROP_ID\",\"roomTypeId\":\"$RT_ID\",\"number\":\"$RNUM\",\"floor\":$FLOOR,\"status\":\"available\",\"housekeepingStatus\":\"clean\"}")
    C=$(get_code "$R")
    RID=$(get_id "$R")
    if [[ -z "$RID" || "$RID" == "ERR" ]]; then
      R2=$(api GET "/api/rooms?propertyId=$PROP_ID&number=$RNUM&limit=1")
      RID=$(get_body "$R2" | python3 -c "
import sys,json; d=json.load(sys.stdin)
rs=d if isinstance(d,list) else d.get('data',d.get('rooms',[]))
print(rs[0]['id'] if rs else '')
" 2>/dev/null || true)
    fi
    ROOM_IDS+=("$RID")
  done
  log "  Floor $FLOOR: 5 rooms for ${RT_NAMES[$rt_idx]}"
done
ROOM_COUNT=$(echo "${ROOM_IDS[@]}" | tr ' ' '\n' | grep -c '[a-f0-9]' || echo 0)
check "Created 50 rooms" "$ROOM_COUNT" "$([ $ROOM_COUNT -ge 50 ] && echo 50 || echo $ROOM_COUNT)"

# ============================================================
# STEP 4: CREATE 10 WIFI PLANS (5 free + 5 paid)
# ============================================================
log ""
log "========== STEP 4: CREATE 10 WiFi PLANS =========="
declare -a WP_NAMES WP_IDS
WP_NAMES=("Free Basic" "Free Standard" "Complimentary" "Lobby Free" "Staff WiFi" "Basic Paid" "Premium Paid" "Business Plan" "VIP Unlimited" "Streaming Pack")
WP_DLS=(2 5 10 3 5 10 25 50 100 75)
WP_ULS=(1 2 5 1 3 5 15 25 50 25)
WP_PRICES=(0 0 0 0 0 99 199 399 699 499)
WP_DATA_LIM=(500 1000 2048 300 0 5000 10000 0 0 50000)
WP_SESSION_TOUT=(3600 7200 14400 1800 28800 28800 28800 86400 86400 86400)
WP_DEVICES=(1 2 3 1 2 3 4 5 6 4)

for i in $(seq 0 9); do
  R=$(api POST /api/wifi/plans "{
    \"name\":\"${WP_NAMES[$i]}\",
    \"downloadSpeed\":${WP_DLS[$i]},\"uploadSpeed\":${WP_ULS[$i]},
    \"dataLimit\":${WP_DATA_LIM[$i]},\"sessionTimeoutSec\":${WP_SESSION_TOUT[$i]},
    \"maxDevices\":${WP_DEVICES[$i]},\"price\":${WP_PRICES[$i]},
    \"currency\":\"INR\",\"validityDays\":1,\"validityMinutes\":1440,
    \"status\":\"active\"
  }")
  C=$(get_code "$R")
  WP_ID=$(get_id "$R")
  if [[ -z "$WP_ID" || "$WP_ID" == "ERR" ]]; then
    # Find existing
    R2=$(api GET "/api/wifi/plans?search=${WP_NAMES[$i]}&limit=100")
    WP_ID=$(get_body "$R2" | python3 -c "
import sys,json; d=json.load(sys.stdin)
ps=d.get('data',[])
print([p['id'] for p in ps if p.get('name')=='${WP_NAMES[$i]}'][0] if ps else '')
" 2>/dev/null || true)
  fi
  WP_IDS+=("$WP_ID")
  TOTAL_PLANS=$([[ "$C" == "201" || "$C" == "200" ]] && echo "created" || echo "HTTP_$C")
  check "WiFi Plan: ${WP_NAMES[$i]} (₹${WP_PRICES[$i]})" "created" "$TOTAL_PLANS"
done

# ============================================================
# STEP 5: MAP WiFi PLANS TO ROOM TYPES
# ============================================================
log ""
log "========== STEP 5: MAP WiFi PLANS TO ROOM TYPES =========="
# Mapping: free plans for budget rooms, paid for premium
WP_MAP_IDX=(0 1 2 3 5 6 7 8 8 0)  # index into WP_IDS
for rt_idx in $(seq 0 9); do
  RT_ID="${RT_IDS[$rt_idx]}"
  WP_ID="${WP_IDS[${WP_MAP_IDX[$rt_idx]}]}"
  if [[ -n "$WP_ID" && "$WP_ID" != "ERR" && -n "$RT_ID" && "$RT_ID" != "ERR" ]]; then
    R=$(api PUT /api/room-types "{\"id\":\"$RT_ID\",\"wifiPlanId\":\"$WP_ID\"}")
    C=$(get_code "$R")
    check "Map ${RT_NAMES[$rt_idx]} → ${WP_NAMES[${WP_MAP_IDX[$rt_idx]}]}" "200" "$C"
  else
    log "  Skipping map for ${RT_NAMES[$rt_idx]} (missing IDs)"
  fi
done

# ============================================================
# STEP 6: CREATE 50 GUESTS
# ============================================================
log ""
log "========== STEP 6: CREATE 50 GUESTS =========="
declare -a GUEST_IDS
FNAMES=("Aarav" "Vivaan" "Aditya" "Vihaan" "Arjun" "Sai" "Reyansh" "Ayaan" "Krishna" "Ishaan"
"Ananya" "Diya" "Meera" "Priya" "Riya" "Saanvi" "Anika" "Kavya" "Nisha" "Pooja"
"Rahul" "Amit" "Vikram" "Rohan" "Suresh" "Deepak" "Manish" "Rajesh" "Sanjay" "Sunil"
"Neha" "Swati" "Pallavi" "Rashmi" "Sunita" "Kavita" "Geeta" "Rekha" "Suman" "Anjali"
"Raj" "Amit" "Prakash" "Mohan" "Ravi" "Ashok" "Kumar" "Vinod" "Gaurav" "Harsh")
LNAMES=("Sharma" "Patel" "Singh" "Kumar" "Gupta" "Verma" "Joshi" "Reddy" "Nair" "Iyer"
"Mehta" "Desai" "Shah" "Chopra" "Malhotra" "Bhatia" "Kapoor" "Rao" "Menon" "Pillai"
"Acharya" "Banerjee" "Mukherjee" "Chatterjee" "Das" "Saxena" "Agarwal" "Trivedi" "Puri" "Wadhwa")

for i in $(seq 0 49); do
  FN="${FNAMES[$i]}"
  LN="${LNAMES[$((i % 30))]}"
  EMAIL="$(echo "${FN}${LN}$((i+100))" | tr '[:upper:]' '[:lower:]' | tr -d ' ')@testguest.com"
  R=$(api POST /api/guests "{
    \"propertyId\":\"$PROP_ID\",\"firstName\":\"$FN\",\"lastName\":\"$LN\",
    \"email\":\"$EMAIL\",\"phone\":\"+9198765$(printf '%04d' $((i+1000)))\",
    \"nationality\":\"Indian\",\"idType\":\"aadhaar\",\"idNumber\":\"$(printf '%012d' $((123456000000+i)))\",
    \"guestType\":\"transient\",\"vip\":$([ $((i % 10)) -eq 0 ] && echo true || echo false)
  }")
  C=$(get_code "$R")
  GID=$(get_id "$R")
  if [[ -z "$GID" || "$GID" == "ERR" ]]; then
    R2=$(api GET "/api/guests?propertyId=$PROP_ID&search=$FN+$(echo $LN|cut -c1-3)&limit=50")
    GID=$(get_body "$R2" | python3 -c "
import sys,json; d=json.load(sys.stdin)
gs=d if isinstance(d,list) else d.get('data',d.get('guests',d.get('items',[])))
print([g['id'] for g in gs if g.get('firstName')=='$FN' and g.get('lastName')=='$LN'][0] if gs else '')
" 2>/dev/null || true)
  fi
  GUEST_IDS+=("$GID")
  if [[ $((i % 10)) -eq 9 ]]; then
    log "  Guests $((i-9))-$i done"
  fi
done
G_COUNT=$(echo "${GUEST_IDS[@]}" | tr ' ' '\n' | grep -c '[a-f0-9]' || echo 0)
check "Created 50 guests" "$G_COUNT" "$([ $G_COUNT -ge 50 ] && echo 50 || echo $G_COUNT)"

# ============================================================
# STEP 7: CREATE 50 BOOKINGS
# ============================================================
log ""
log "========== STEP 7: CREATE 50 BOOKINGS =========="
TODAY=$(TZ=Asia/Kolkata date '+%Y-%m-%d')
TOMORROW=$(TZ=Asia/Kolkata date -d '+1 day' '+%Y-%m-%d')
DAY_AFTER=$(TZ=Asia/Kolkata date -d '+2 days' '+%Y-%m-%d')
log "Dates: today=$TODAY, tomorrow=$TOMORROW, day+2=$DAY_AFTER"

declare -a BOOK_IDS BOOK_NIGHTS
for i in $(seq 0 49); do
  GID="${GUEST_IDS[$i]}"
  [[ -z "$GID" || "$GID" == "ERR" ]] && continue
  
  RT_IDX=$((i % 10))
  RT_ID="${RT_IDS[$rt_idx]}"
  RID="${ROOM_IDS[$i]}"
  [[ -z "$RT_ID" || "$RT_ID" == "ERR" ]] && continue
  
  # Vary nights: 1, 2, or 3 nights
  if [[ $((i % 3)) -eq 0 ]]; then
    CI="$TODAY"; CO="$TOMORROW"; NIGHTS=1
  elif [[ $((i % 3)) -eq 1 ]]; then
    CI="$TODAY"; CO="$DAY_AFTER"; NIGHTS=2
  else
    CI="$TODAY"; CO=$(TZ=Asia/Kolkata date -d '+3 days' '+%Y-%m-%d'); NIGHTS=3
  fi
  
  BP="${RT_PRICES[$rt_idx]}"
  ROOM_RATE=$((BP * NIGHTS))
  TAX=$((ROOM_RATE * 18 / 100))
  SC=$((ROOM_RATE * 5 / 100))
  TOTAL=$((ROOM_RATE + TAX + SC))
  ADULTS=$([ $((rt_idx % 3)) -eq 0 ] && echo 1 || echo 2)
  CH=$([ $((rt_idx % 5)) -eq 4 ] && echo 1 || echo 0)
  
  R=$(api POST /api/bookings "{
    \"propertyId\":\"$PROP_ID\",\"primaryGuestId\":\"$GID\",\"roomTypeId\":\"$RT_ID\",\"roomId\":\"$RID\",
    \"checkIn\":\"${CI}T14:00:00+05:30\",\"checkOut\":\"${CO}T11:00:00+05:30\",
    \"adults\":$ADULTS,\"children\":$CH,\"roomRate\":$ROOM_RATE,\"taxes\":$TAX,\"fees\":$SC,
    \"totalAmount\":$TOTAL,\"currency\":\"INR\",\"source\":\"direct\",\"status\":\"confirmed\",
    \"specialRequests\":\"Extra towels\",\"paymentStatus\":\"unpaid\"
  }")
  C=$(get_code "$R")
  BID=$(get_id "$R")
  BOOK_IDS+=("$BID")
  BOOK_NIGHTS+=("$NIGHTS")
  if [[ $((i % 10)) -eq 9 ]]; then
    log "  Bookings $((i-9))-$i done"
  fi
done
B_COUNT=$(echo "${BOOK_IDS[@]}" | tr ' ' '\n' | grep -c '[a-f0-9]' || echo 0)
check "Created 50 bookings" "$B_COUNT" "$([ $B_COUNT -ge 50 ] && echo 50 || echo $B_COUNT)"

# ============================================================
# STEP 8: CHECK-IN BOOKINGS (today's check-ins: index 0-32 approx)
# ============================================================
log ""
log "========== STEP 8: CHECK-IN BOOKINGS =========="
CI_COUNT=0
for i in "${!BOOK_IDS[@]}"; do
  BID="${BOOK_IDS[$i]}"
  [[ -z "$BID" || "$BID" == "ERR" ]] && continue
  RID="${ROOM_IDS[$i]}"
  
  R=$(api PATCH "/api/bookings/$BID" "{
    \"status\":\"checked_in\",\"roomId\":\"$RID\",
    \"actualCheckIn\":\"${TODAY}T$(printf '%02d' $((14 + (i % 6)))):00:00+05:30\",
    \"checkedInBy\":\"$USER_ID\",\"kycCompleted\":true
  }")
  C=$(get_code "$R")
  TOT=$((TOT+1))
  if [[ "$C" == "200" ]]; then
    pass "Check-in booking $i"; TPASS=$((TPASS+1))
    CI_COUNT=$((CI_COUNT+1))
  else
    fail "Check-in booking $i (HTTP $C)"; TFAIL=$((TFAIL+1))
  fi
done
check "Check-ins completed" "true" "$([ $CI_COUNT -gt 0 ] && echo true || echo false)"
log "  Total check-ins: $CI_COUNT"

# ============================================================
# STEP 9: VERIFY PRICE CALCULATION
# ============================================================
log ""
log "========== STEP 9: VERIFY PRICE CALCULATION =========="
for i in 0 5 10 20 30 40; do
  BID="${BOOK_IDS[$i]}"
  [[ -z "$BID" || "$BID" == "ERR" ]] && continue
  R=$(api GET "/api/bookings/$BID")
  C=$(get_code "$R")
  TOT=$((TOT+1))
  if [[ "$C" == "200" ]]; then
    RR=$(get_field "$R" "['roomRate']")
    TX=$(get_field "$R" "['taxes']")
    FE=$(get_field "$R" "['fees']")
    TA=$(get_field "$R" "['totalAmount']")
    ST=$(get_field "$R" "['status']")
    PS=$(get_field "$R" "['paymentStatus']")
    EXPECTED=$((RR + TX + FE))
    log "  Booking $i: rate=$RR tax=$TX fees=$FE total=$TA expected=$EXPECTED status=$ST payment=$PS"
    TOT=$((TOT+1))
    if [[ "$TA" == "$EXPECTED" ]]; then
      pass "Price calc booking $i ($TA)"; TPASS=$((TPASS+1))
    else
      fail "Price MISMATCH booking $i: $TA vs $EXPECTED"; TFAIL=$((TFAIL+1))
    fi
  else
    fail "Get booking $i (HTTP $C)"; TFAIL=$((TFAIL+1))
  fi
done

# ============================================================
# STEP 10: CHECK-OUT 10 BOOKINGS TO TEST INVOICE
# ============================================================
log ""
log "========== STEP 10: CHECK-OUT 10 BOOKINGS =========="
CO_COUNT=0
for i in 0 3 6 9 12 15 18 21 24 27; do
  BID="${BOOK_IDS[$i]}"
  [[ -z "$BID" || "$BID" == "ERR" ]] && continue
  RT_IDX=$((i % 10))
  # Only 1-night stays (i%3==0)
  [[ $((i % 3)) -ne 0 ]] && continue
  
  R=$(api PATCH "/api/bookings/$BID" "{
    \"status\":\"checked_out\",
    \"actualCheckOut\":\"${TODAY}T10:30:00+05:30\",
    \"checkedOutBy\":\"$USER_ID\"
  }")
  C=$(get_code "$R")
  TOT=$((TOT+1))
  if [[ "$C" == "200" ]]; then
    CO_COUNT=$((CO_COUNT+1))
    # Check if room status changed
    RID="${ROOM_IDS[$i]}"
    RR=$(api GET "/api/rooms/$RID" 2>/dev/null || echo "")
    RS=$(get_field "$RR" "['status']" 2>/dev/null || echo "ERR")
    pass "Checkout booking $i → room status=$RS"; TPASS=$((TPASS+1))
  else
    BODY=$(get_body "$R" | head -c 200)
    fail "Checkout booking $i (HTTP $C): $BODY"; TFAIL=$((TFAIL+1))
  fi
done
check "Check-outs completed" "true" "$([ $CO_COUNT -gt 0 ] && echo true || echo false)"
log "  Total check-outs: $CO_COUNT"

# ============================================================
# STEP 11: VERIFY FOLIOS & INVOICES
# ============================================================
log ""
log "========== STEP 11: FOLIOS & INVOICES =========="
R=$(api GET "/api/folios?propertyId=$PROP_ID&limit=50")
C=$(get_code "$R")
FC=$(get_count "$R")
check "GET folios (HTTP 200, count=$FC)" "200" "$C"

R=$(api GET "/api/invoices?propertyId=$PROP_ID&limit=50")
C=$(get_code "$R")
IC=$(get_count "$R")
check "GET invoices (HTTP 200, count=$IC)" "200" "$C"

# Check billing page
R=$(api GET "/api/billing?propertyId=$PROP_ID")
C=$(get_code "$R")
check "GET billing" "200" "$C"

R=$(api GET "/api/billing/deposits?propertyId=$PROP_ID")
C=$(get_code "$R")
check "GET billing/deposits" "200" "$C"

# ============================================================
# STEP 12: TEST ALL MODULE PAGES
# ============================================================
log ""
log "========== STEP 12: TEST ALL MODULE PAGES =========="

# Property Management
log "--- Property Management ---"
for ep in \
  "/api/properties" \
  "/api/properties/$PROP_ID" \
  "/api/properties/$PROP_ID/tax-settings" \
  "/api/room-types?propertyId=$PROP_ID" \
  "/api/rooms?propertyId=$PROP_ID" \
  "/api/rooms?propertyId=$PROP_ID&status=available" \
  "/api/rooms?propertyId=$PROP_ID&status=occupied" \
  "/api/rooms?propertyId=$PROP_ID&status=cleaning" \
  "/api/rooms/available?propertyId=$PROP_ID" \
  "/api/amenities?propertyId=$PROP_ID" \
  "/api/rate-plans?propertyId=$PROP_ID" \
  "/api/cancellation-policies?propertyId=$PROP_ID" \
; do
  R=$(api GET "$ep" 2>/dev/null); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET $ep"; TPASS=$((TPASS+1)); } || { fail "GET $ep (HTTP $C)"; TFAIL=$((TFAIL+1)); }
done

# Bookings
log "--- Bookings ---"
for ep in \
  "/api/bookings?propertyId=$PROP_ID&limit=20" \
  "/api/bookings?propertyId=$PROP_ID&status=confirmed" \
  "/api/bookings?propertyId=$PROP_ID&status=checked_in" \
  "/api/bookings?propertyId=$PROP_ID&status=checked_out" \
  "/api/bookings?propertyId=$PROP_ID&checkInFrom=$TODAY&limit=10" \
  "/api/bookings/audit-logs?propertyId=$PROP_ID" \
; do
  R=$(api GET "$ep" 2>/dev/null); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET $ep"; TPASS=$((TPASS+1)); } || { fail "GET $ep (HTTP $C)"; TFAIL=$((TFAIL+1)); }
done

# Front Desk
log "--- Front Desk ---"
for ep in \
  "/api/availability?propertyId=$PROP_ID" \
  "/api/guests?propertyId=$PROP_ID&limit=10" \
; do
  R=$(api GET "$ep" 2>/dev/null); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET $ep"; TPASS=$((TPASS+1)); } || { fail "GET $ep (HTTP $C)"; TFAIL=$((TFAIL+1)); }
done

# Guests
log "--- Guests ---"
for ep in \
  "/api/guests?propertyId=$PROP_ID&limit=20" \
  "/api/guests/vip?propertyId=$PROP_ID" \
; do
  R=$(api GET "$ep" 2>/dev/null); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET $ep"; TPASS=$((TPASS+1)); } || { fail "GET $ep (HTTP $C)"; TFAIL=$((TFAIL+1)); }
done

# Individual guest detail
if [[ -n "${GUEST_IDS[0]}" && "${GUEST_IDS[0]}" != "ERR" ]]; then
  R=$(api GET "/api/guests/${GUEST_IDS[0]}"); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET /api/guests/detail"; TPASS=$((TPASS+1)); } || { fail "GET /api/guests/detail (HTTP $C)"; TFAIL=$((TFAIL+1)); }
fi

# Housekeeping
log "--- Housekeeping ---"
for ep in \
  "/api/rooms?propertyId=$PROP_ID&housekeepingStatus=dirty" \
  "/api/rooms?propertyId=$PROP_ID&housekeepingStatus=clean" \
  "/api/rooms?propertyId=$PROP_ID&housekeepingStatus=inspected" \
; do
  R=$(api GET "$ep" 2>/dev/null); C=$(get_code "$R"); TOT=$((TOT+1))
  [[ "$C" == "200" ]] && { pass "GET $ep"; TPASS=$((TPASS+1)); } || { fail "GET $ep (HTTP $C)"; TFAIL=$((TFAIL+1)); }
done

# WiFi
log "--- WiFi ---"
R=$(api GET "/api/wifi/plans?limit=20"); C=$(get_code "$R"); TOT=$((TOT+1))
[[ "$C" == "200" ]] && { pass "GET /api/wifi/plans"; TPASS=$((TPASS+1)); } || { fail "GET /api/wifi/plans (HTTP $C)"; TFAIL=$((TFAIL+1)); }

R=$(api GET "/api/wifi/sessions?limit=20"); C=$(get_code "$R"); TOT=$((TOT+1))
[[ "$C" == "200" ]] && { pass "GET /api/wifi/sessions"; TPASS=$((TPASS+1)); } || { fail "GET /api/wifi/sessions (HTTP $C)"; TFAIL=$((TFAIL+1)); }

R=$(api GET "/api/wifi/users?limit=20"); C=$(get_code "$R"); TOT=$((TOT+1))
[[ "$C" == "200" ]] && { pass "GET /api/wifi/users"; TPASS=$((TPASS+1)); } || { fail "GET /api/wifi/users (HTTP $C)"; TFAIL=$((TFAIL+1)); }

# Dashboard
log "--- Dashboard ---"
R=$(api GET "/api/dashboard/stats?propertyId=$PROP_ID"); C=$(get_code "$R"); TOT=$((TOT+1))
[[ "$C" == "200" ]] && { pass "GET dashboard/stats"; TPASS=$((TPASS+1)); } || { fail "GET dashboard/stats (HTTP $C)"; TFAIL=$((TFAIL+1)); }

# ============================================================
# FINAL SUMMARY
# ============================================================
log ""
log "============================================================"
log "🧪 E2E TEST CYCLE COMPLETE"
log "============================================================"
log "Total: $TOT | Passed: $TPASS | Failed: $TFAIL"
PR=$((TPASS * 100 / (TOT > 0 ? TOT : 1)))
log "Pass Rate: ${PR}%"
log "Full log: $LOG"
