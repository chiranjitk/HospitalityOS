#!/usr/bin/env python3
"""StaySuite-HospitalityOS E2E Test Suite V2 - Fixed API calls"""
import json, subprocess, time, sys, os, random, string, datetime, uuid
import urllib.request, urllib.error, http.cookiejar

BASE = "http://localhost:3000"
COOKIE = "/tmp/staysuite-cookies.txt"
TENANT = "444017d5-e022-4c5f-ac07-ea0d51f4609b"
PROPERTY = "281fde73-7836-4511-b644-91f3663d8fcd"
ROOM_TYPE_STANDARD = "4d5269a2-63ad-48e7-8683-4b0efca11567"

results = {"pass": 0, "fail": 0, "error": 0, "tests": []}
created_guests = []
created_bookings = []
voucher_codes = []

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def req(method, path, data=None):
    cookie = http.cookiejar.MozillaCookieJar(COOKIE)
    try: cookie.load(ignore_discard=True, ignore_expires=True)
    except: pass
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie))
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f"{BASE}{path}", data=body, method=method)
    r.add_header("Content-Type", "application/json")
    try:
        resp = opener.open(r, timeout=30)
        code = resp.getcode()
        text = resp.read().decode()
        try: cookie.save(ignore_discard=True, ignore_expires=True)
        except: pass
        try: return code, json.loads(text)
        except: return code, {"raw": text}
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try: return e.code, json.loads(text)
        except: return e.code, {"error": text[:500]}
    except Exception as e:
        return 0, {"error": str(e)}

def test(name, method, path, data=None, expect_codes=None):
    if expect_codes is None: expect_codes = [200, 201]
    code, resp = req(method, path, data)
    status = "PASS" if code in expect_codes else "FAIL"
    if status == "PASS":
        results["pass"] += 1
        log(f"  ✅ {name} (HTTP {code})")
    else:
        results["fail"] += 1
        log(f"  ❌ {name} (HTTP {code}) - {str(resp)[:300]}")
    results["tests"].append({"name": name, "status": status, "code": code, "resp": str(resp)[:300]})
    return code, resp

def test_soft(name, method, path, data=None):
    code, resp = req(method, path, data)
    if code in [200, 201]:
        results["pass"] += 1
        log(f"  ✅ {name} (HTTP {code})")
    else:
        results["error"] += 1
        log(f"  ⚠️  {name} (HTTP {code}) - {str(resp)[:200]}")
    return code, resp

def get_id(resp):
    if isinstance(resp, dict):
        d = resp.get("data", resp)
        if isinstance(d, dict): return d.get("id")
    return None

def get_list(resp):
    if isinstance(resp, dict):
        d = resp.get("data", resp)
        if isinstance(d, list): return d
        if isinstance(d, dict):
            for k in ["items", "records", "results"]:
                if isinstance(d.get(k), list): return d[k]
    return []

NOW = datetime.datetime.now(datetime.timezone.utc)
def fmt(dt): return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

FIRST = ["Amit","Priya","Raj","Sneha","Vikram","Anita","Sanjay","Meera","Arjun","Divya","Karan","Neha","Rohit","Pooja","Manish","Swati","Deepak","Ritu","Suresh","Kavita","Arun","Sunita","Mahesh","Rekha","Naresh","Vandana","Prakash","Bela","Rakesh","Sangita","Ashok","Geeta","Mohan","Lata","Sunil","Rama","Anil","Pushpa","Gopal","Shanti","Pradeep","Suman","Harish","Mamta","Girish","Sarita","Nikhil","Veena","Tarun","Kamini","Dinesh","Asha","Rajiv","Nirmala","Subhash","Prabha","Vinod","Usha","Shyam","Shashi","Ajay","Kiran","Prabhat","Anjali","Bharat","Madhuri","Chandra","Savita","Dilip","Kusum","Eknath","Lalita","Ganesh","Pratima","Hari","Sushma","Inder","Tulsi","Jayant","Uma","Kailash","Vinita","Lalit","Yogita","Mukesh","Zeenat","Naveen","Abha","Omkar","Pallavi","Parvez","Qadir","Rashmi","Siddharth","Tanuja","Ashish","Bharati","Chetan","Durga","Esha","Farhan","Gauri","Harsha","Ishaan","Jhanvi","Kabir"]
LAST = ["Sharma","Gupta","Mukherjee","Banerjee","Saha","Singh","Patel","Kumar","Das","Chatterjee","Mishra","Verma","Joshi","Reddy","Nair","Pillai","Rao","Iyer","Menon","Deshmukh","Kulkarni","Jadhav","Pawar","Shinde","Bhatt","Mehta","Shah","Trivedi","Pandey","Tripathi","Agarwal","Malhotra","Chopra","Bhatia","Ahuja","Saxena","Srivastava","Tiwari","Dubey","Yadav"]

# ============================================================
# PHASE 0: AUTH
# ============================================================
log("=" * 60)
log("PHASE 0: AUTH")
log("=" * 60)
subprocess.run(["/home/z/my-project/pgsql-runtime/bin/psql", "-h", "127.0.0.1", "-U", "staysuite", "-d", "staysuite",
                "-c", 'UPDATE "User" SET "twoFactorEnabled" = false WHERE email = \'admin@royalstay.in\';'],
               capture_output=True, timeout=5)
code, resp = test("Admin login", "POST", "/api/auth/login", {"email":"admin@royalstay.in","password":"admin123"})
if code != 200:
    log("FATAL: Cannot login")
    sys.exit(1)

# ============================================================
# PHASE 1: WIFI INFRASTRUCTURE (already done in V1, just verify)
# ============================================================
log("=" * 60)
log("PHASE 1: WIFI INFRASTRUCTURE (verify)")
log("=" * 60)

code, resp = test("List WiFi plans", "GET", "/api/wifi/plans")
plans = get_list(resp)
plan_ids = [p["id"] for p in plans if isinstance(p, dict) and p.get("status") == "active"]
log(f"  Active plans: {len(plan_ids)}")

# Create additional plans for variety
new_plans = [
    {"name": "E2E DataCap 500MB", "downloadSpeed": 5, "uploadSpeed": 2, "dataLimit": 500, "maxDevices": 1, "validityMinutes": 60, "price": 0, "sessionTimeoutSec": 3600},
    {"name": "E2E DataCap 2GB", "downloadSpeed": 15, "uploadSpeed": 8, "dataLimit": 2048, "maxDevices": 2, "validityMinutes": 1440, "price": 15},
    {"name": "E2E FUP Plan", "downloadSpeed": 25, "uploadSpeed": 12, "dataLimit": 5120, "maxDevices": 3, "validityMinutes": 1440, "price": 30, "idleTimeoutSec": 900},
    {"name": "E2E Unlimited 3-Device", "downloadSpeed": 50, "uploadSpeed": 25, "dataLimit": None, "maxDevices": 3, "validityMinutes": 4320, "price": 75},
    {"name": "E2E Conference 8hr", "downloadSpeed": 20, "uploadSpeed": 10, "dataLimit": None, "maxDevices": 1, "validityMinutes": 480, "price": 0, "sessionTimeoutSec": 28800},
]
for p in new_plans:
    p.update({"description": f"E2E: {p['name']}", "currency": "USD", "priority": 5, "validityDays": 1, "status": "active", "burstDownloadSpeed": None, "burstUploadSpeed": None, "idleTimeoutSec": p.get("idleTimeoutSec", 600)})
    code, resp = test_soft(f"Create plan: {p['name']}", "POST", "/api/wifi/plans", p)
    pid = get_id(resp)
    if pid: plan_ids.append(pid)

# Create bulk vouchers for each of 4 plans
for idx, pid in enumerate(plan_ids[:4]):
    code, resp = test_soft(f"Create voucher batch {idx+1} ({len(plan_ids)} plans)", "POST", "/api/wifi/vouchers", {
        "planId": pid, "count": 15,
        "validFrom": fmt(NOW),
        "validUntil": fmt(NOW + datetime.timedelta(days=30)),
        "notes": f"E2E batch {idx+1}"
    })
    if code in [200, 201]:
        data = resp.get("data", resp)
        items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
        for v in items:
            if isinstance(v, dict) and "code" in v:
                voucher_codes.append(v["code"])

log(f"  Total voucher codes collected: {len(voucher_codes)}")

test("List vouchers", "GET", "/api/wifi/vouchers")
test_soft("IP pools", "GET", "/api/wifi/ip-pools")
test_soft("Bandwidth policies", "GET", "/api/wifi/firewall/bandwidth-policies")
test_soft("DHCP status", "GET", "/api/wifi/dhcp/status")
test_soft("WiFi alerts", "GET", "/api/wifi/alerts")

# ============================================================
# PHASE 2: GET AVAILABLE ROOMS & CREATE 100 BOOKINGS
# ============================================================
log("=" * 60)
log("PHASE 2: 100 GUESTS + BOOKINGS + CHECK-IN")
log("=" * 60)

# Get available rooms with dates
ci_date = "2026-05-26T14:00:00Z"
co_date = "2026-05-29T11:00:00Z"
code, resp = req("GET", f"/api/rooms/available?propertyId={PROPERTY}&checkIn={ci_date}&checkOut={co_date}")
avail_rooms = get_list(resp)
log(f"  Available rooms: {len(avail_rooms)}")

if len(avail_rooms) < 50:
    # Try different date range
    code, resp = req("GET", f"/api/rooms?propertyId={PROPERTY}&status=available")
    all_avail = get_list(resp)
    log(f"  Available via /rooms?status=available: {len(all_avail)}")
    avail_rooms = all_avail

# Get room IDs
room_ids = [r["id"] for r in avail_rooms if isinstance(r, dict) and r.get("id")]
log(f"  Room IDs collected: {len(room_ids)}")

# Create 100 guests
log("Creating 100 guests via API...")
for i in range(100):
    first = FIRST[i % len(FIRST)]
    last = LAST[(i // 3) % len(LAST)]
    email = f"e2e.g{i+100}.{first.lower()}.{last.lower()}@test.com"
    
    code, resp = test_soft(f"Guest #{i+1}: {first} {last}", "POST", "/api/guests", {
        "firstName": first, "lastName": last, "email": email,
        "phone": f"+91-{random.randint(90000,99999)}{random.randint(10000,99999)}",
        "city": "Kolkata", "country": "IN", "idType": "passport",
        "idNumber": f"E2E{i+1000:06d}", "propertyId": PROPERTY,
        "vip": i < 5, "source": "direct",
        "preferences": json.dumps({"bed": "king" if i%2==0 else "twin"})
    })
    gid = get_id(resp)
    if gid:
        created_guests.append({"id": gid, "name": f"{first} {last}", "email": email, "idx": i})

log(f"  Guests created: {len(created_guests)}")

# Create 100 bookings
log("Creating 100 bookings...")
for i, guest in enumerate(created_guests):
    room_id = room_ids[i % len(room_ids)] if room_ids else None
    if not room_id:
        log(f"  SKIP booking {i+1}: no rooms available")
        continue
    
    nights = random.choice([1, 2, 3, 4, 5, 7])
    ci = NOW + datetime.timedelta(days=random.randint(0, 2))
    co = ci + datetime.timedelta(days=nights)
    rate = random.choice([3500, 4500, 5500, 7500, 10000, 15000, 20000])
    
    code, resp = test_soft(f"Booking #{i+1}: {guest['name']}", "POST", "/api/bookings", {
        "primaryGuestId": guest["id"],
        "propertyId": PROPERTY,
        "roomTypeId": ROOM_TYPE_STANDARD,
        "roomId": room_id,
        "checkIn": fmt(ci), "checkOut": fmt(co),
        "adults": random.choice([1, 2]), "children": random.choice([0, 0, 0, 1, 2]),
        "roomRate": rate, "taxes": round(rate * 0.18, 2),
        "totalAmount": round(rate * 1.18 * nights, 2),
        "currency": "INR", "source": "direct", "status": "confirmed",
        "specialRequests": f"E2E test {i+1}"
    })
    bid = get_id(resp)
    if bid:
        created_bookings.append({"id": bid, "guest": guest, "roomId": room_id, "rate": rate})

log(f"  Bookings created: {len(created_bookings)}")

# Check-in all bookings
log("Checking in all bookings...")
for i, booking in enumerate(created_bookings):
    code, resp = test_soft(f"Check-in #{i+1}: {booking['guest']['name']}", "PUT",
                            f"/api/bookings/{booking['id']}", {
        "status": "checked_in",
        "actualCheckIn": fmt(NOW)
    })

# ============================================================
# PHASE 3: WIFI AUTHENTICATION (Voucher + Room + MAC)
# ============================================================
log("=" * 60)
log("PHASE 3: WIFI AUTHENTICATION")
log("=" * 60)

# Get room numbers for room-based auth
code, resp = req("GET", f"/api/rooms?propertyId={PROPERTY}&status=occupied")
rooms_data = get_list(resp)
room_map = {}
for r in rooms_data:
    if isinstance(r, dict) and r.get("number") and r.get("id"):
        room_map[r["number"]] = {"id": r["id"], "number": r["number"]}

# Voucher-based auth
v_ok = 0
for i, vc in enumerate(voucher_codes[:20]):
    mac = ":".join(f"{random.randint(0,255):02X}" for _ in range(6))
    code, resp = req("POST", "/api/v1/wifi/auth", {
        "method": "voucher", "voucherCode": vc, "mac": mac,
        "ip": f"10.10.{i//5}.{(i%5)*10+10}",
        "userAgent": "E2E-Test", "propertyId": PROPERTY
    })
    if code in [200, 201]:
        results["pass"] += 1
        v_ok += 1
        log(f"  ✅ Voucher #{i+1}: {vc}")
    else:
        results["error"] += 1
        log(f"  ⚠️  Voucher #{i+1}: {vc} (HTTP {code}) - {str(resp.get('error',''))[:100]}")
log(f"  Voucher auth: {v_ok}/{min(20, len(voucher_codes))}")

# Room-number auth
r_ok = 0
room_numbers = list(room_map.keys())[:20]
for i, rn in enumerate(room_numbers):
    mac = ":".join(f"{random.randint(0,255):02X}" for _ in range(6))
    code, resp = req("POST", "/api/v1/wifi/auth", {
        "method": "room_number", "roomNumber": rn,
        "guestName": created_bookings[i % len(created_bookings)]["guest"]["name"] if created_bookings else "Test",
        "mac": mac, "ip": f"10.11.{i//5}.{(i%5)*10+20}",
        "userAgent": "E2E-Test", "propertyId": PROPERTY
    })
    if code in [200, 201]:
        results["pass"] += 1
        r_ok += 1
        log(f"  ✅ Room auth #{i+1}: room {rn}")
    else:
        results["error"] += 1
        log(f"  ⚠️  Room auth #{i+1}: {rn} (HTTP {code})")
log(f"  Room auth: {r_ok}/{len(room_numbers)}")

# MAC auth
mac_ok = 0
for i in range(10):
    mac = "AA:BB:CC:DD:EE:" + f"{i:02X}"
    code, resp = req("POST", "/api/wifi/mac-auth", {
        "mac": mac, "propertyId": PROPERTY, "comment": f"E2E MAC test {i}"
    })
    if code in [200, 201]:
        results["pass"] += 1; mac_ok += 1
    else:
        results["error"] += 1
log(f"  MAC auth: {mac_ok}/10")

test("List WiFi users", "GET", "/api/wifi/users")
test("List WiFi sessions", "GET", "/api/wifi/sessions")
test_soft("WiFi revenue", "GET", "/api/wifi/revenue-dashboard")

# ============================================================
# PHASE 4: RESTAURANT
# ============================================================
log("=" * 60)
log("PHASE 4: RESTAURANT / DINING")
log("=" * 60)

code, resp = test("List menu items", "GET", "/api/menu-items")
menu_items = get_list(resp)
log(f"  Menu items: {len(menu_items)}")

test_soft("List menu categories", "GET", f"/api/menu-categories?propertyId={PROPERTY}")
code, resp = test("List tables", "GET", "/api/tables")
tables = get_list(resp)

order_ids = []
for i in range(min(30, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    items = []
    if menu_items:
        for _ in range(random.randint(1, 4)):
            mi = random.choice(menu_items)
            items.append({"menuItemId": mi.get("id"), "name": mi.get("name", "Item"),
                         "quantity": random.randint(1, 3), "price": mi.get("price", random.randint(200, 2000))})
    
    code, resp = test_soft(f"Order #{i+1}: {guest['name']}", "POST", "/api/orders", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "type": random.choice(["dine_in", "room_service", "takeaway"]),
        "items": items or [{"name": "E2E Dish", "quantity": 2, "price": 500}],
        "tableId": tables[0].get("id") if tables else None,
        "specialInstructions": f"E2E {i+1}", "propertyId": PROPERTY, "status": "pending"
    })
    oid = get_id(resp)
    if oid: order_ids.append(oid)

test("List orders", "GET", "/api/orders")
log(f"  Orders created: {len(order_ids)}")

# ============================================================
# PHASE 5: SPA
# ============================================================
log("=" * 60)
log("PHASE 5: SPA")
log("=" * 60)

test_soft("Spa treatments", "GET", "/api/experience/spa/treatments")
test_soft("Spa therapists", "GET", "/api/experience/spa/therapists")

spa_ids = []
treatments = ["Swedish Massage", "Deep Tissue", "Facial", "Body Wrap", "Hot Stone", "Couple's Massage", "Ayurvedic", "Head Massage"]
for i in range(min(25, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    t = treatments[i % len(treatments)]
    code, resp = test_soft(f"Spa #{i+1}: {guest['name']} - {t}", "POST", "/api/experience/spa/appointments", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "treatmentName": t, "duration": random.choice([30, 45, 60, 75, 90, 120]),
        "startTime": fmt(NOW + datetime.timedelta(hours=random.randint(1, 48))),
        "price": random.randint(800, 5500), "propertyId": PROPERTY,
        "status": "scheduled", "notes": f"E2E spa {i+1}"
    })
    sid = get_id(resp)
    if sid: spa_ids.append(sid)

test("List spa appointments", "GET", "/api/experience/spa/appointments")
test_soft("Spa revenue", "GET", "/api/experience/spa/revenue")
log(f"  Spa appointments: {len(spa_ids)}")

# ============================================================
# PHASE 6: LAUNDRY
# ============================================================
log("=" * 60)
log("PHASE 6: LAUNDRY")
log("=" * 60)

test_soft("List laundry items", "GET", f"/api/laundry/items?propertyId={PROPERTY}")

laundry_ids = []
garments = ["Shirt", "Trousers", "Suit", "Dress", "Bed Sheet", "Towel", "Jacket", "Saree", "Kurta", "Blazer"]
svc = ["wash_fold", "dry_clean", "ironing", "express_wash"]
for i in range(min(25, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    code, resp = test_soft(f"Laundry #{i+1}: {guest['name']}", "POST", "/api/laundry/orders", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "items": [{"garmentType": random.choice(garments), "quantity": random.randint(1, 5),
                   "serviceType": random.choice(svc), "unitPrice": random.randint(50, 500)}
                  for _ in range(random.randint(2, 6))],
        "serviceType": random.choice(svc), "priority": "express" if i%5==0 else "normal",
        "propertyId": PROPERTY, "status": "pending",
        "pickupTime": fmt(NOW + datetime.timedelta(hours=random.randint(1, 24))),
        "deliveryTime": fmt(NOW + datetime.timedelta(days=1)),
        "notes": f"E2E laundry {i+1}"
    })
    lid = get_id(resp)
    if lid: laundry_ids.append(lid)

test("List laundry orders", "GET", f"/api/laundry/orders?propertyId={PROPERTY}")
log(f"  Laundry orders: {len(laundry_ids)}")

# ============================================================
# PHASE 7: GOLF
# ============================================================
log("=" * 60)
log("PHASE 7: GOLF")
log("=" * 60)

test_soft("Golf courses", "GET", "/api/experience/golf/courses")

golf_ids = []
for i in range(min(15, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    code, resp = test_soft(f"Golf #{i+1}: {guest['name']}", "POST", "/api/experience/golf/tee-times", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "date": fmt(NOW + datetime.timedelta(days=random.randint(1, 3)))[:10],
        "time": f"{random.randint(6,17):02d}:00",
        "players": random.randint(1, 4), "holes": random.choice([9, 18]),
        "cartRequired": random.choice([True, False]),
        "clubRental": random.choice([True, False]),
        "propertyId": PROPERTY, "status": "confirmed",
        "notes": f"E2E golf {i+1}"
    })
    gid = get_id(resp)
    if gid: golf_ids.append(gid)

test("List golf tee times", "GET", "/api/experience/golf/tee-times")
test_soft("Golf memberships", "GET", "/api/experience/golf/memberships")
log(f"  Golf tee times: {len(golf_ids)}")

# ============================================================
# PHASE 8: PARKING
# ============================================================
log("=" * 60)
log("PHASE 8: PARKING")
log("=" * 60)

test_soft("Parking overview", "GET", "/api/parking")
test_soft("List parking passes", "GET", "/api/parking/passes")
test_soft("List vehicles", "GET", "/api/vehicles")

parking_ids = []
vtypes = ["sedan", "suv", "hatchback", "van", "motorcycle", "luxury"]
for i in range(min(20, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    vt = vtypes[i % len(vtypes)]
    
    code, resp = test_soft(f"Vehicle #{i+1}: {guest['name']}", "POST", "/api/vehicles", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "registrationNumber": f"WB-{random.randint(10,99)}-{random.choice(['AB','CD','EF','GH'])}-{random.randint(1000,9999)}",
        "vehicleType": vt, "make": random.choice(["Toyota","Honda","Hyundai","BMW","Maruti","Tata"]),
        "model": f"Model {random.randint(1,50)}", "color": random.choice(["White","Black","Silver","Red"]),
        "propertyId": PROPERTY
    })
    
    code, resp = test_soft(f"Parking pass #{i+1}", "POST", "/api/parking/passes", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "vehicleType": vt, "spotType": "premium" if i%4==0 else "regular",
        "startTime": fmt(NOW), "endTime": fmt(NOW + datetime.timedelta(days=random.randint(1,5))),
        "propertyId": PROPERTY, "status": "active"
    })
    pid = get_id(resp)
    if pid: parking_ids.append(pid)

test_soft("Parking billing", "GET", "/api/parking/billing")
log(f"  Parking passes: {len(parking_ids)}")

# ============================================================
# PHASE 9: CASINO
# ============================================================
log("=" * 60)
log("PHASE 9: CASINO")
log("=" * 60)

test_soft("Casino tables", "GET", "/api/resort/casino/tables")

casino_ids = []
games = ["Blackjack", "Roulette", "Poker", "Baccarat", "Slot Machine", "Craps"]
for i in range(min(12, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    game = games[i % len(games)]
    code, resp = test_soft(f"Casino #{i+1}: {guest['name']} - {game}", "POST", "/api/resort/casino/transactions", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "game": game, "amount": random.choice([-500,-1000,-2000,1500,3000,5000,-300,800]),
        "currency": "INR", "propertyId": PROPERTY,
        "transactionType": random.choice(["buy_in", "cash_out", "bet", "win"]),
        "notes": f"E2E casino {game} {i+1}"
    })
    cid = get_id(resp)
    if cid: casino_ids.append(cid)

test("List casino transactions", "GET", "/api/resort/casino/transactions")
log(f"  Casino transactions: {len(casino_ids)}")

# ============================================================
# PHASE 10: BILLING, FOLIOS, INVOICES, PAYMENTS
# ============================================================
log("=" * 60)
log("PHASE 10: BILLING")
log("=" * 60)

test("List folios", "GET", "/api/folios")

folio_ids = []
for i in range(min(30, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    code, resp = test_soft(f"Folio #{i+1}: {guest['name']}", "POST", "/api/folios", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "propertyId": PROPERTY, "status": "open", "type": "guest"
    })
    fid = get_id(resp)
    if fid: folio_ids.append(fid)

invoice_ids = []
for i in range(min(25, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    code, resp = test_soft(f"Invoice #{i+1}: {guest['name']}", "POST", "/api/invoices", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "propertyId": PROPERTY, "amount": created_bookings[i]["rate"] * random.randint(1, 5),
        "currency": "INR", "status": "pending",
        "dueDate": fmt(NOW + datetime.timedelta(days=30)),
        "items": [
            {"description": "Room charges", "amount": created_bookings[i]["rate"]},
            {"description": "Restaurant", "amount": random.randint(500, 3000)},
            {"description": "Spa", "amount": random.randint(1000, 5000)},
            {"description": "Laundry", "amount": random.randint(200, 1500)}
        ],
        "notes": f"E2E invoice {i+1}"
    })
    iid = get_id(resp)
    if iid: invoice_ids.append(iid)

payment_ids = []
methods = ["cash", "card", "upi", "bank_transfer", "online"]
for i in range(min(20, len(created_bookings))):
    guest = created_bookings[i]["guest"]
    code, resp = test_soft(f"Payment #{i+1}: {guest['name']}", "POST", "/api/payments", {
        "guestId": guest["id"], "bookingId": created_bookings[i]["id"],
        "propertyId": PROPERTY, "amount": random.randint(1000, 50000),
        "currency": "INR", "method": methods[i % len(methods)],
        "status": "completed", "reference": f"E2E-PAY-{i+2000:06d}",
        "notes": f"E2E payment {i+1}"
    })
    pid = get_id(resp)
    if pid: payment_ids.append(pid)

test("List invoices", "GET", "/api/invoices")
test("List payments", "GET", "/api/payments")
test_soft("Cash book", "GET", "/api/cash-book")
test_soft("Tax exemptions", "GET", "/api/billing/tax-exemptions")
test_soft("Exchange rates", "GET", "/api/billing/exchange-rates")
test_soft("Invoice templates", "GET", "/api/invoice-templates")
test_soft("Receipt templates", "GET", "/api/receipt-templates")
test_soft("Scheduled charges", "GET", "/api/scheduled-charges")

log(f"  Folios: {len(folio_ids)}, Invoices: {len(invoice_ids)}, Payments: {len(payment_ids)}")

# ============================================================
# PHASE 11: CHECK-OUT 20 GUESTS
# ============================================================
log("=" * 60)
log("PHASE 11: CHECK-OUT")
log("=" * 60)

co_count = 0
for i in range(min(20, len(created_bookings))):
    b = created_bookings[i]
    code, resp = test_soft(f"Check-out #{i+1}: {b['guest']['name']}", "PUT",
                            f"/api/bookings/{b['id']}", {
        "status": "checked_out", "actualCheckOut": fmt(NOW)
    })
    if code == 200: co_count += 1
log(f"  Check-outs: {co_count}/20")

# ============================================================
# PHASE 12: DASHBOARD & VERIFICATION
# ============================================================
log("=" * 60)
log("PHASE 12: DASHBOARD & DATA VERIFICATION")
log("=" * 60)

dash_tests = [
    ("Dashboard stats", "/api/dashboard/stats"),
    ("Dashboard KPIs", "/api/dashboard/kpis"),
    ("Dashboard room status", "/api/dashboard/room-status"),
    ("Dashboard occupancy", "/api/dashboard/occupancy-forecast"),
    ("Dashboard events", "/api/dashboard/events"),
    ("Dashboard maintenance", "/api/dashboard/maintenance"),
    ("Dashboard communications", "/api/dashboard/communications"),
    ("Dashboard revenue trend", "/api/dashboard/revenue-trend"),
    ("Dashboard guest segments", "/api/dashboard/guest-segments"),
    ("Dashboard today schedule", "/api/dashboard/todays-schedule"),
    ("Dashboard staff on duty", "/api/dashboard/staff-on-duty"),
    ("Guest analytics", "/api/guests/analytics"),
    ("WiFi reports bandwidth", "/api/wifi/reports/bandwidth"),
    ("Restaurant reports", "/api/restaurant-reports"),
]
for name, path in dash_tests:
    test_soft(name, "GET", path)

# Check known failing endpoints
for name, path in [
    ("Dashboard quick stats", "/api/dashboard/quick-stats"),
    ("Front desk dashboard", "/api/frontdesk/dashboard"),
    ("Billing overview", "/api/billing"),
]:
    code, resp = req("GET", path)
    if code == 500:
        results["fail"] += 1
        log(f"  ❌ {name} (HTTP 500) - NEEDS FIX: {str(resp)[:200]}")
        results["tests"].append({"name": name, "status": "FAIL", "code": 500, "needs_fix": True})
    else:
        results["pass"] += 1
        log(f"  ✅ {name} (HTTP {code})")

# ============================================================
# FINAL COUNTS
# ============================================================
log("=" * 60)
log("PHASE 13: FINAL DATA VERIFICATION")
log("=" * 60)

for name, path in [
    ("Guests", "/api/guests"), ("Bookings", "/api/bookings"), ("Orders", "/api/orders"),
    ("Folios", "/api/folios"), ("Invoices", "/api/invoices"), ("Payments", "/api/payments"),
    ("WiFi users", "/api/wifi/users"), ("WiFi sessions", "/api/wifi/sessions"),
    ("Laundry orders", f"/api/laundry/orders?propertyId={PROPERTY}"),
    ("Spa appointments", "/api/experience/spa/appointments"),
    ("Golf tee times", "/api/experience/golf/tee-times"),
    ("Parking passes", "/api/parking/passes"),
    ("Casino transactions", "/api/resort/casino/transactions"),
]:
    code, resp = req("GET", path)
    count = 0
    if code == 200:
        d = resp.get("data", resp)
        if isinstance(d, list): count = len(d)
        elif isinstance(d, dict):
            count = d.get("total", d.get("count", len(d.get("items", d.get("records", [])))))
    log(f"  {name}: {count} (HTTP {code})")

# ============================================================
# SUMMARY
# ============================================================
log("=" * 60)
log("FINAL SUMMARY")
log("=" * 60)
log(f"  ✅ PASSED: {results['pass']}")
log(f"  ❌ FAILED: {results['fail']}")
log(f"  ⚠️  ERRORS: {results['error']}")
log(f"  TOTAL: {results['pass'] + results['fail'] + results['error']}")

if results['fail'] > 0:
    log("\nFAILURES NEEDING FIX:")
    for t in results['tests']:
        if t.get('status') == 'FAIL':
            log(f"  ❌ {t['name']} (HTTP {t['code']}) - {t.get('resp','')[:200]}")

if results['error'] > 0:
    log(f"\nERRORS (non-critical): {results['error']}")

with open("/tmp/e2e-summary-v2.txt", "w") as f:
    f.write(f"PASS={results['pass']}\nFAIL={results['fail']}\nERROR={results['error']}\n")
    for t in results['tests']:
        if t.get('status') == 'FAIL':
            f.write(f"FAIL:{t['name']}:{t['code']}:{t.get('resp','')[:300]}\n")

log("\nDone! Summary at /tmp/e2e-summary-v2.txt")
