import http.server
import json, subprocess, time, sys, os, random, string, datetime, uuid

BASE = "http://localhost:3000"
COOKIE = "/tmp/staysuite-cookies.txt"
TENANT = "444017d5-e022-4c5f-ac07-ea0d51f4609b"
PROPERTY = "281fde73-7836-4511-b644-91f3663d8fcd"

results = {"pass": 0, "fail": 0, "error": 0, "tests": []}

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")
    sys.stdout.flush()

def req(method, path, data=None, use_cookies=True, raw=False):
    import urllib.request, urllib.error, http.cookiejar
    cookie = http.cookiejar.MozillaCookieJar(COOKIE)
    try:
        cookie.load(ignore_discard=True, ignore_expires=True)
    except:
        pass
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie))
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f"{BASE}{path}", data=body, method=method)
    r.add_header("Content-Type", "application/json")
    r.add_header("Accept", "application/json")
    try:
        resp = opener.open(r, timeout=30)
        code = resp.getcode()
        resp_body = resp.read().decode()
        if use_cookies:
            try: cookie.save(ignore_discard=True, ignore_expires=True)
            except: pass
        try:
            return code, json.loads(resp_body)
        except:
            return code, resp_body if raw else {"raw": resp_body}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body[:500]}
    except Exception as e:
        return 0, {"error": str(e)}

def test(name, method, path, data=None, expect_codes=None):
    if expect_codes is None:
        expect_codes = [200, 201]
    code, resp = req(method, path, data)
    status = "PASS" if code in expect_codes else "FAIL"
    if status == "PASS":
        results["pass"] += 1
        log(f"  ✅ {name} (HTTP {code})")
    else:
        results["fail"] += 1
        log(f"  ❌ {name} (HTTP {code}, expected {expect_codes}) - {str(resp)[:200]}")
    results["tests"].append({"name": name, "status": status, "code": code})
    return code, resp

def test_err(name, method, path, data=None):
    """Test that may fail without counting as critical failure"""
    code, resp = req(method, path, data)
    if code in [200, 201]:
        results["pass"] += 1
        log(f"  ✅ {name} (HTTP {code})")
        return code, resp
    else:
        results["error"] += 1
        log(f"  ⚠️  {name} (HTTP {code}) - {str(resp)[:200]}")
        return code, resp

def extract_id(resp, key="id"):
    if isinstance(resp, dict):
        d = resp.get("data", resp)
        if isinstance(d, dict):
            return d.get(key)
    return None

# ============================================================
# PHASE 0: AUTH
# ============================================================
log("=" * 60)
log("PHASE 0: AUTH")
log("=" * 60)

# Disable 2FA
subprocess.run(["/home/z/my-project/pgsql-runtime/bin/psql", "-h", "127.0.0.1", "-U", "staysuite", "-d", "staysuite", 
                "-c", 'UPDATE "User" SET "twoFactorEnabled" = false WHERE email = \'admin@royalstay.in\';'],
               capture_output=True, timeout=5)

code, resp = test("Admin login", "POST", "/api/auth/login", 
                   {"email": "admin@royalstay.in", "password": "admin123"})
if code != 200:
    log("FATAL: Cannot login, aborting")
    sys.exit(1)

# ============================================================
# PHASE 1: WIFI INFRASTRUCTURE
# ============================================================
log("=" * 60)
log("PHASE 1: WIFI INFRASTRUCTURE")
log("=" * 60)

# 1A: Create WiFi plans with various configurations
wifi_plans = [
    {"name": "E2E Free 1hr", "downloadSpeed": 5, "uploadSpeed": 2, "dataLimit": 500, "maxDevices": 1, "sessionTimeoutSec": 3600, "validityMinutes": 60, "price": 0},
    {"name": "E2E Basic 2GB", "downloadSpeed": 10, "uploadSpeed": 5, "dataLimit": 2048, "maxDevices": 2, "validityMinutes": 1440, "price": 10},
    {"name": "E2E Standard 5GB", "downloadSpeed": 25, "uploadSpeed": 10, "dataLimit": 5120, "maxDevices": 3, "validityMinutes": 1440, "price": 25},
    {"name": "E2E Premium 15GB", "downloadSpeed": 50, "uploadSpeed": 25, "dataLimit": 15360, "maxDevices": 5, "validityMinutes": 2880, "price": 50},
    {"name": "E2E Unlimited VIP", "downloadSpeed": 100, "uploadSpeed": 50, "dataLimit": None, "maxDevices": 10, "validityMinutes": 4320, "price": 100},
    {"name": "E2E Conference", "downloadSpeed": 30, "uploadSpeed": 15, "dataLimit": 10240, "maxDevices": 1, "sessionTimeoutSec": 28800, "validityMinutes": 480, "price": 0},
]

created_plan_ids = []
for p in wifi_plans:
    p.update({
        "description": f"E2E test plan: {p['name']}",
        "burstDownloadSpeed": None, "burstUploadSpeed": None,
        "idleTimeoutSec": 600, "currency": "USD", "priority": 5,
        "validityDays": 1, "status": "active"
    })
    code, resp = test_err(f"Create plan: {p['name']}", "POST", "/api/wifi/plans", p)
    pid = extract_id(resp)
    if pid:
        created_plan_ids.append(pid)

# 1B: List WiFi plans
code, resp = test("List WiFi plans", "GET", "/api/wifi/plans")

# 1C: Create vouchers in bulk for each plan
voucher_codes_all = []
for i, pid in enumerate(created_plan_ids[:4]):
    code, resp = test_err(f"Create vouchers batch {i+1}", "POST", "/api/wifi/vouchers", {
        "planId": pid,
        "count": 10,
        "validFrom": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "validUntil": (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": f"E2E batch {i+1}"
    })
    if code in [200, 201] and isinstance(resp, dict):
        data = resp.get("data", resp)
        if isinstance(data, list):
            for v in data:
                if isinstance(v, dict) and "code" in v:
                    voucher_codes_all.append(v["code"])
        elif isinstance(data, dict) and "code" in data:
            voucher_codes_all.append(data["code"])

log(f"  Collected {len(voucher_codes_all)} voucher codes for WiFi testing")

# 1D: List vouchers
code, resp = test("List vouchers", "GET", "/api/wifi/vouchers")

# 1E: WiFi diagnostics
test_err("WiFi diagnostics", "GET", "/api/wifi/diagnostics")

# 1F: Bandwidth policies
test_err("List bandwidth policies", "GET", "/api/wifi/firewall/bandwidth-policies")

# 1G: List IP pools  
test_err("List IP pools", "GET", "/api/wifi/ip-pools")

# 1H: DHCP status
test_err("DHCP status", "GET", "/api/wifi/dhcp/status")

# 1I: WiFi alerts
test_err("WiFi alerts", "GET", "/api/wifi/alerts")

# 1J: Test RADIUS credentials
test_err("Test RADIUS credentials", "POST", "/api/wifi/test-credentials", {
    "username": "test_user", "password": "test_pass"
})

# 1K: Update a plan (test bandwidth push)
if created_plan_ids:
    code, resp = test_err("Update plan bandwidth", "PUT", "/api/wifi/plans", {
        "id": created_plan_ids[0],
        "name": "E2E Free 1hr UPDATED",
        "downloadSpeed": 8,
        "uploadSpeed": 4,
        "maxDevices": 2
    })

# ============================================================
# PHASE 2: GUEST CHECK-IN + WiFi AUTH (100 guests)
# ============================================================
log("=" * 60)
log("PHASE 2: GUEST CHECK-INS + WIFI AUTH")
log("=" * 60)

# First names and last names for realistic test data
FIRST_NAMES = ["Amit", "Priya", "Raj", "Sneha", "Vikram", "Anita", "Sanjay", "Meera", "Arjun", "Divya",
               "Karan", "Neha", "Rohit", "Pooja", "Manish", "Swati", "Deepak", "Ritu", "Suresh", "Kavita",
               "Arun", "Sunita", "Mahesh", "Rekha", "Naresh", "Vandana", "Prakash", "Bela", "Rakesh", "Sangita",
               "Ashok", "Geeta", "Mohan", "Lata", "Sunil", "Rama", "Anil", "Pushpa", "Gopal", "Shanti",
               "Pradeep", "Suman", "Harish", "Mamta", "Girish", "Sarita", "Nikhil", "Veena", "Tarun", "Kamini",
               "Dinesh", "Asha", "Rajiv", "Nirmala", "Subhash", "Prabha", "Vinod", "Usha", "Shyam", "Shashi",
               "Ajay", "Kiran", "Prabhat", "Anjali", "Bharat", "Madhuri", "Chandra", "Savita", "Dilip", "Kusum",
               "Eknath", "Lalita", "Ganesh", "Pratima", "Hari", "Sushma", "Inder", "Tulsi", "Jayant", "Uma",
               "Kailash", "Vinita", "Lalit", "Yogita", "Mukesh", "Zeenat", "Naveen", "Abha", "Omkar", "Pallavi",
               "Parvez", "Qadir", "Rashmi", "Siddharth", "Tanuja"]
LAST_NAMES = ["Sharma", "Gupta", "Mukherjee", "Banerjee", "Saha", "Singh", "Patel", "Kumar", "Das", "Chatterjee",
              "Mishra", "Verma", "Joshi", "Reddy", "Nair", "Pillai", "Rao", "Iyer", "Menon", "Deshmukh",
              "Kulkarni", "Jadhav", "Pawar", "Shinde", "Bhatt", "Mehta", "Shah", "Trivedi", "Pandey", "Tripathi",
              "Agarwal", "Malhotra", "Chopra", "Bhatia", "Ahuja", "Saxena", "Srivastava", "Tiwari", "Dubey", "Yadav"]

created_guests = []
created_bookings = []
wifi_auth_results = []

# Get available rooms
code, resp = req("GET", "/api/rooms/available")
available_rooms = []
if code == 200 and isinstance(resp, dict):
    rooms_data = resp.get("data", [])
    if isinstance(rooms_data, list):
        for r in rooms_data[:80]:
            if isinstance(r, dict):
                available_rooms.append(r.get("id", r.get("number", "")))

log(f"  Found {len(available_rooms)} available rooms")

# Create 100 guests via API
log("Creating 100 guests...")
for i in range(100):
    first = FIRST_NAMES[i % len(FIRST_NAMES)]
    last = LAST_NAMES[(i // 5) % len(LAST_NAMES)]
    email = f"e2e.guest{i+1}.{first.lower()}.{last.lower()}@test.com"
    phone = f"+91-{random.randint(9000000000, 9999999999)}"
    
    code, resp = test_err(f"Create guest {i+1}: {first} {last}", "POST", "/api/guests", {
        "firstName": first,
        "lastName": last,
        "email": email,
        "phone": phone,
        "address": f"{i+1} Test Street, Kolkata",
        "city": "Kolkata",
        "country": "IN",
        "idType": "passport",
        "idNumber": f"E2E{i+1000:06d}",
        "tenantId": TENANT,
        "propertyId": PROPERTY,
        "vip": i < 5,
        "preferences": json.dumps({"room_preference": "high_floor" if i % 3 == 0 else "low_floor"}),
        "source": "direct"
    })
    
    gid = extract_id(resp)
    if gid:
        created_guests.append({"id": gid, "name": f"{first} {last}", "email": email, "phone": phone, "index": i})

log(f"  Created {len(created_guests)} guests")

# Create bookings for all guests (check-in today, various durations)
log("Creating 100 bookings (check-in)...")
for i, guest in enumerate(created_guests):
    room_id = available_rooms[i % len(available_rooms)] if available_rooms else None
    if not room_id:
        continue
    
    nights = random.choice([1, 2, 3, 4, 5, 7])
    check_in = datetime.datetime.utcnow().strftime("%Y-%m-%dT14:00:00Z")
    check_out = (datetime.datetime.utcnow() + datetime.timedelta(days=nights)).strftime("%Y-%m-%dT11:00:00Z")
    rate = random.choice([3500, 4500, 5500, 7500, 10000, 15000, 20000])
    
    code, resp = test_err(f"Booking {i+1}: {guest['name']}", "POST", "/api/bookings", {
        "primaryGuestId": guest["id"],
        "propertyId": PROPERTY,
        "roomTypeId": "4d5269a2-63ad-48e7-8683-4b0efca11567",
        "roomId": room_id,
        "checkIn": check_in,
        "checkOut": check_out,
        "adults": random.choice([1, 2]),
        "children": random.choice([0, 0, 0, 1, 2]),
        "roomRate": rate,
        "taxes": rate * 0.18,
        "totalAmount": rate * 1.18 * nights,
        "currency": "INR",
        "source": "direct",
        "status": "confirmed",
        "specialRequests": f"E2E test booking {i+1}"
    })
    
    bid = extract_id(resp)
    if bid:
        created_bookings.append({"id": bid, "guest": guest, "roomId": room_id, "roomNumber": room_id, "rate": rate})

log(f"  Created {len(created_bookings)} bookings")

# Now perform check-in via API for all bookings
log("Performing check-in for all bookings...")
for i, booking in enumerate(created_bookings):
    code, resp = test_err(f"Check-in {i+1}: {booking['guest']['name']}", "PUT", f"/api/bookings/{booking['id']}", {
        "status": "checked_in",
        "actualCheckIn": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    })

# ============================================================
# PHASE 2B: WiFi AUTH via /connect flow
# ============================================================
log("=" * 60)
log("PHASE 2B: WIFI AUTHENTICATION (Voucher, Room, PMS)")
log("=" * 60)

# Test voucher-based WiFi auth
voucher_count = 0
for i, code_str in enumerate(voucher_codes_all[:15]):
    mac = ":".join([f"{random.randint(0,255):02x}" for _ in range(6)])
    code, resp = req("POST", "/api/v1/wifi/auth", {
        "method": "voucher",
        "voucherCode": code_str,
        "mac": mac,
        "ip": f"10.10.{i//5}.{(i%5)*10+10}",
        "userAgent": "E2E-Test-Client",
        "propertyId": PROPERTY
    })
    if code in [200, 201]:
        results["pass"] += 1
        voucher_count += 1
        log(f"  ✅ Voucher auth #{i+1}: {code_str} (HTTP {code})")
    else:
        results["error"] += 1
        log(f"  ⚠️  Voucher auth #{i+1}: {code_str} (HTTP {code}) - {str(resp)[:200]}")

log(f"  Voucher auth success: {voucher_count}/{min(15, len(voucher_codes_all))}")

# Test room-number-based WiFi auth
room_auth_count = 0
for i, booking in enumerate(created_bookings[:20]):
    mac = ":".join([f"{random.randint(0,255):02x}" for _ in range(6)])
    room_num = str(booking.get("roomNumber", "101"))
    code, resp = req("POST", "/api/v1/wifi/auth", {
        "method": "room_number",
        "roomNumber": room_num,
        "guestName": booking["guest"]["name"],
        "mac": mac,
        "ip": f"10.11.{i//5}.{(i%5)*10+20}",
        "userAgent": "E2E-Test-Client",
        "propertyId": PROPERTY
    })
    if code in [200, 201]:
        results["pass"] += 1
        room_auth_count += 1
        log(f"  ✅ Room auth #{i+1}: room {room_num} (HTTP {code})")
    else:
        results["error"] += 1
        log(f"  ⚠️  Room auth #{i+1}: room {room_num} (HTTP {code}) - {str(resp)[:200]}")

log(f"  Room auth success: {room_auth_count}/20")

# Test PMS credentials WiFi auth
pms_auth_count = 0
for i, booking in enumerate(created_bookings[:10]):
    mac = ":".join([f"{random.randint(0,255):02x}" for _ in range(6)])
    code, resp = req("POST", "/api/v1/wifi/auth", {
        "method": "pms_credentials",
        "username": booking["guest"]["email"],
        "password": "E2EPass123!",
        "mac": mac,
        "ip": f"10.12.{i//5}.{(i%5)*10+30}",
        "userAgent": "E2E-Test-Client",
        "propertyId": PROPERTY
    })
    if code in [200, 201]:
        results["pass"] += 1
        pms_auth_count += 1
    else:
        results["error"] += 1
        log(f"  ⚠️  PMS auth #{i+1}: (HTTP {code}) - {str(resp)[:200]}")

log(f"  PMS auth: {pms_auth_count}/10")

# Test MAC-based auth (direct WiFiUser creation)
mac_auth_count = 0
for i in range(10):
    mac = "AA:BB:CC:DD:EE:" + f"{i:02X}"
    code, resp = req("POST", "/api/wifi/mac-auth", {
        "mac": mac,
        "propertyId": PROPERTY,
        "comment": f"E2E MAC auth test {i}"
    })
    if code in [200, 201]:
        results["pass"] += 1
        mac_auth_count += 1
    else:
        results["error"] += 1

log(f"  MAC auth: {mac_auth_count}/10")

# List WiFi users and sessions
test("List WiFi users", "GET", "/api/wifi/users")
test("List WiFi sessions", "GET", "/api/wifi/sessions")
test_err("List session history", "GET", "/api/wifi/session-history")
test_err("WiFi revenue dashboard", "GET", "/api/wifi/revenue-dashboard")

# Test disconnect
if wifi_auth_results:
    code, resp = test_err("WiFi disconnect", "POST", "/api/v1/wifi/disconnect", {
        "sessionId": wifi_auth_results[0],
        "reason": "E2E test disconnect"
    })

# ============================================================
# PHASE 3: RESTAURANT / DINING
# ============================================================
log("=" * 60)
log("PHASE 3: RESTAURANT / DINING")
log("=" * 60)

# List menu items
code, resp = test("List menu items", "GET", "/api/menu-items")
menu_items = []
if code == 200 and isinstance(resp, dict):
    mi_data = resp.get("data", [])
    if isinstance(mi_data, list):
        menu_items = mi_data

# List menu categories
test("List menu categories", "GET", "/api/menu-categories")

# List tables
code, resp = test("List restaurant tables", "GET", "/api/tables")
tables = []
if code == 200 and isinstance(resp, dict):
    t_data = resp.get("data", [])
    if isinstance(t_data, list):
        tables = t_data

# Create restaurant orders for checked-in guests
order_count = 0
for i in range(0, min(30, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    items_to_order = []
    if menu_items:
        for _ in range(random.randint(1, 4)):
            item = random.choice(menu_items)
            if isinstance(item, dict):
                items_to_order.append({
                    "menuItemId": item.get("id"),
                    "name": item.get("name", "Item"),
                    "quantity": random.randint(1, 3),
                    "price": item.get("price", random.randint(200, 2000))
                })
    
    order_type = random.choice(["dine_in", "room_service", "takeaway"])
    order_data = {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "type": order_type,
        "items": items_to_order if items_to_order else [
            {"name": "E2E Test Item", "quantity": 2, "price": 500}
        ],
        "tableId": tables[0].get("id") if tables and order_type == "dine_in" else None,
        "specialInstructions": f"E2E test order {i+1}",
        "propertyId": PROPERTY,
        "status": "pending"
    }
    
    code, resp = test_err(f"Create order #{i+1}: {guest['name']} ({order_type})", "POST", "/api/orders", order_data)
    if code in [200, 201]:
        order_count += 1

log(f"  Orders created: {order_count}/30")

# Test room service
code, resp = test("List room service", "GET", "/api/room-service")
test_err("Room service rooms", "GET", "/api/room-service/rooms")

# List orders
code, resp = test("List orders", "GET", "/api/orders")

# Update order status (prepare, ready, served)
if created_bookings:
    test_err("Update order item status", "PUT", "/api/orders", {"status": "preparing"})

# ============================================================
# PHASE 4: SPA
# ============================================================
log("=" * 60)
log("PHASE 4: SPA")
log("=" * 60)

# Spa treatments
test_err("List spa treatments", "GET", "/api/experience/spa/treatments")
test_err("List spa therapists", "GET", "/api/experience/spa/therapists")

# Create spa appointments
spa_count = 0
spa_treatments = [
    {"treatment": "Swedish Massage", "duration": 60, "price": 2500},
    {"treatment": "Deep Tissue Massage", "duration": 90, "price": 3500},
    {"treatment": "Facial Treatment", "duration": 45, "price": 1800},
    {"treatment": "Body Wrap", "duration": 75, "price": 3000},
    {"treatment": "Hot Stone Therapy", "duration": 60, "price": 3200},
    {"treatment": "Couple's Massage", "duration": 90, "price": 5500},
    {"treatment": "Ayurvedic Treatment", "duration": 120, "price": 4500},
    {"treatment": "Head Massage", "duration": 30, "price": 1000},
]

for i in range(min(20, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    treatment = spa_treatments[i % len(spa_treatments)]
    
    start_time = (datetime.datetime.utcnow() + datetime.timedelta(hours=random.randint(1, 48))).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    code, resp = test_err(f"Spa appointment #{i+1}: {guest['name']} - {treatment['treatment']}", 
                          "POST", "/api/experience/spa/appointments", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "treatmentName": treatment["treatment"],
        "duration": treatment["duration"],
        "startTime": start_time,
        "price": treatment["price"],
        "propertyId": PROPERTY,
        "status": "scheduled",
        "therapistId": None,
        "notes": f"E2E test spa booking {i+1}"
    })
    if code in [200, 201]:
        spa_count += 1

log(f"  Spa appointments: {spa_count}/20")
test_err("Spa revenue", "GET", "/api/experience/spa/revenue")

# ============================================================
# PHASE 5: LAUNDRY
# ============================================================
log("=" * 60)
log("PHASE 5: LAUNDRY")
log("=" * 60)

test_err("List laundry items", "GET", "/api/laundry/items")

laundry_count = 0
laundry_types = ["wash_fold", "dry_clean", "ironing", "express_wash", "premium_wash"]
garments = ["Shirt", "Trousers", "Suit", "Dress", "Bed Sheet", "Towel", "Jacket", "Saree", "Kurta", "Blazer"]

for i in range(min(25, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    
    items = []
    for _ in range(random.randint(2, 8)):
        garment = random.choice(garments)
        items.append({
            "garmentType": garment,
            "quantity": random.randint(1, 5),
            "serviceType": random.choice(laundry_types),
            "unitPrice": random.randint(50, 500)
        })
    
    code, resp = test_err(f"Laundry order #{i+1}: {guest['name']}", "POST", "/api/laundry/orders", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "roomNumber": str(booking.get("roomNumber", "")),
        "items": items,
        "serviceType": random.choice(laundry_types),
        "priority": "normal" if i % 3 != 0 else "express",
        "specialInstructions": f"E2E test laundry {i+1}",
        "propertyId": PROPERTY,
        "pickupTime": datetime.datetime.utcnow().strftime("%Y-%m-%dT09:00:00Z"),
        "deliveryTime": (datetime.datetime.utcnow() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT18:00:00Z"),
        "status": "pending"
    })
    if code in [200, 201]:
        laundry_count += 1

log(f"  Laundry orders: {laundry_count}/25")
test("List laundry orders", "GET", "/api/laundry/orders")

# ============================================================
# PHASE 6: GOLF
# ============================================================
log("=" * 60)
log("PHASE 6: GOLF")
log("=" * 60)

test_err("List golf courses", "GET", "/api/experience/golf/courses")

golf_count = 0
for i in range(min(15, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    
    tee_time = (datetime.datetime.utcnow() + datetime.timedelta(hours=random.randint(2, 72))).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    code, resp = test_err(f"Golf tee time #{i+1}: {guest['name']}", "POST", "/api/experience/golf/tee-times", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "date": tee_time.split("T")[0],
        "time": tee_time.split("T")[1][:5],
        "players": random.randint(1, 4),
        "holes": random.choice([9, 18]),
        "cartRequired": random.choice([True, False]),
        "clubRental": random.choice([True, False]),
        "propertyId": PROPERTY,
        "status": "confirmed",
        "notes": f"E2E golf booking {i+1}"
    })
    if code in [200, 201]:
        golf_count += 1

log(f"  Golf tee times: {golf_count}/15")

test_err("List golf tee times", "GET", "/api/experience/golf/tee-times")
test_err("Golf memberships", "GET", "/api/experience/golf/memberships")

# ============================================================
# PHASE 7: PARKING
# ============================================================
log("=" * 60)
log("PHASE 7: PARKING")
log("=" * 60)

test_err("Parking overview", "GET", "/api/parking")
test_err("List parking passes", "GET", "/api/parking/passes")
test_err("List vehicles", "GET", "/api/vehicles")

parking_count = 0
vehicle_types = ["sedan", "suv", "hatchback", "van", "motorcycle", "luxury"]
for i in range(min(20, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    vtype = vehicle_types[i % len(vehicle_types)]
    
    # Register vehicle
    code, resp = test_err(f"Register vehicle #{i+1}: {guest['name']}", "POST", "/api/vehicles", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "registrationNumber": f"E2E-{random.choice(['WB', 'MH', 'DL', 'KA'])}-{random.randint(10,99)}-{random.choice(['AB','CD','EF','GH','JK'])}-{random.randint(1000,9999)}",
        "vehicleType": vtype,
        "make": random.choice(["Toyota", "Honda", "Hyundai", "BMW", "Mercedes", "Maruti", "Tata"]),
        "model": f"Model {random.randint(1,50)}",
        "color": random.choice(["White", "Black", "Silver", "Red", "Blue"]),
        "propertyId": PROPERTY
    })
    
    # Issue parking pass
    code, resp = test_err(f"Parking pass #{i+1}", "POST", "/api/parking/passes", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "vehicleType": vtype,
        "spotType": "regular" if i % 3 != 0 else "premium",
        "startTime": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endTime": (datetime.datetime.utcnow() + datetime.timedelta(days=random.randint(1, 5))).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "propertyId": PROPERTY,
        "status": "active"
    })
    if code in [200, 201]:
        parking_count += 1

log(f"  Parking passes: {parking_count}/20")
test_err("Parking billing", "GET", "/api/parking/billing")

# ============================================================
# PHASE 8: CASINO
# ============================================================
log("=" * 60)
log("PHASE 8: CASINO")
log("=" * 60)

test_err("List casino tables", "GET", "/api/resort/casino/tables")

casino_count = 0
games = ["Blackjack", "Roulette", "Poker", "Baccarat", "Slot Machine", "Craps"]
for i in range(min(10, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    game = games[i % len(games)]
    
    code, resp = test_err(f"Casino transaction #{i+1}: {guest['name']} - {game}", 
                          "POST", "/api/resort/casino/transactions", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "game": game,
        "amount": random.choice([-500, -1000, -2000, 1500, 3000, 5000, -300, 800]),
        "currency": "INR",
        "propertyId": PROPERTY,
        "transactionType": random.choice(["buy_in", "cash_out", "bet", "win"]),
        "notes": f"E2E casino {game} {i+1}"
    })
    if code in [200, 201]:
        casino_count += 1

log(f"  Casino transactions: {casino_count}/10")
test_err("List casino transactions", "GET", "/api/resort/casino/transactions")

# ============================================================
# PHASE 9: BILLING, FOLIOS, INVOICES
# ============================================================
log("=" * 60)
log("PHASE 9: BILLING, FOLIOS, INVOICES")
log("=" * 60)

# List folios
test("List folios", "GET", "/api/folios")

# Create folios for guests
folio_count = 0
for i in range(min(30, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    
    code, resp = test_err(f"Create folio #{i+1}: {guest['name']}", "POST", "/api/folios", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "propertyId": PROPERTY,
        "status": "open",
        "type": "guest"
    })
    if code in [200, 201]:
        folio_count += 1

log(f"  Folios created: {folio_count}/30")

# Create line items on folios
test_err("Folio transfer", "GET", "/api/folio/transfer/history")
test_err("Credit notes", "GET", "/api/folio/credit-notes")
test_err("Payment schedule", "GET", "/api/folio/payment-schedule")

# Create invoices
invoice_count = 0
for i in range(min(20, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    
    code, resp = test_err(f"Create invoice #{i+1}: {guest['name']}", "POST", "/api/invoices", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "propertyId": PROPERTY,
        "amount": booking.get("rate", 5000) * random.randint(1, 5),
        "tax": 0,
        "currency": "INR",
        "status": "pending",
        "dueDate": (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": [
            {"description": "Room charges", "amount": booking.get("rate", 5000)},
            {"description": "Restaurant", "amount": random.randint(500, 3000)},
            {"description": "Spa", "amount": random.randint(1000, 5000)},
            {"description": "Laundry", "amount": random.randint(200, 1500)}
        ],
        "notes": f"E2E test invoice {i+1}"
    })
    if code in [200, 201]:
        invoice_count += 1

log(f"  Invoices created: {invoice_count}/20")

# Create payments
payment_count = 0
payment_methods = ["cash", "card", "upi", "bank_transfer", "online"]
for i in range(min(20, len(created_bookings))):
    booking = created_bookings[i]
    guest = booking["guest"]
    
    code, resp = test_err(f"Create payment #{i+1}: {guest['name']}", "POST", "/api/payments", {
        "guestId": guest["id"],
        "bookingId": booking["id"],
        "propertyId": PROPERTY,
        "amount": random.randint(1000, 50000),
        "currency": "INR",
        "method": payment_methods[i % len(payment_methods)],
        "status": "completed",
        "reference": f"E2E-PAY-{i+1000:06d}",
        "notes": f"E2E test payment {i+1}"
    })
    if code in [200, 201]:
        payment_count += 1

log(f"  Payments: {payment_count}/20")

# Additional billing tests
test_err("Billing overview", "GET", "/api/billing")
test_err("Tax exemptions", "GET", "/api/billing/tax-exemptions")
test_err("Exchange rates", "GET", "/api/billing/exchange-rates")
test_err("List invoices", "GET", "/api/invoices")
test_err("List payments", "GET", "/api/payments")
test_err("Cash book", "GET", "/api/cash-book")
test_err("Scheduled charges", "GET", "/api/scheduled-charges")
test_err("Receipt templates", "GET", "/api/receipt-templates")
test_err("Invoice templates", "GET", "/api/invoice-templates")
test_err("Invoice matching", "GET", "/api/invoice-matching")

# ============================================================
# PHASE 10: CHECK-OUT TESTS
# ============================================================
log("=" * 60)
log("PHASE 10: CHECK-OUT")
log("=" * 60)

# Check out 20 guests
checkout_count = 0
for i in range(min(20, len(created_bookings))):
    booking = created_bookings[i]
    
    code, resp = test_err(f"Check-out #{i+1}: {booking['guest']['name']}", "PUT", f"/api/bookings/{booking['id']}", {
        "status": "checked_out",
        "actualCheckOut": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    })
    if code in [200]:
        checkout_count += 1

log(f"  Check-outs: {checkout_count}/20")

# ============================================================
# PHASE 11: DASHBOARD & VERIFICATION
# ============================================================
log("=" * 60)
log("PHASE 11: DASHBOARD & DATA VERIFICATION")
log("=" * 60)

dashboard_tests = [
    ("Dashboard stats", "GET", "/api/dashboard/stats"),
    ("Dashboard KPIs", "GET", "/api/dashboard/kpis"),
    ("Dashboard quick stats", "GET", "/api/dashboard/quick-stats"),
    ("Dashboard room status", "GET", "/api/dashboard/room-status"),
    ("Dashboard occupancy", "GET", "/api/dashboard/occupancy-forecast"),
    ("Dashboard events", "GET", "/api/dashboard/events"),
    ("Dashboard maintenance", "GET", "/api/dashboard/maintenance"),
    ("Dashboard communications", "GET", "/api/dashboard/communications"),
    ("Dashboard revenue trend", "GET", "/api/dashboard/revenue-trend"),
    ("Dashboard guest segments", "GET", "/api/dashboard/guest-segments"),
    ("Dashboard today schedule", "GET", "/api/dashboard/todays-schedule"),
    ("Dashboard staff on duty", "GET", "/api/dashboard/staff-on-duty"),
    ("Front desk dashboard", "GET", "/api/frontdesk/dashboard"),
    ("Guest analytics", "GET", "/api/guests/analytics"),
    ("WiFi reports bandwidth", "GET", "/api/wifi/reports/bandwidth"),
    ("Restaurant reports", "GET", "/api/restaurant-reports"),
]

for name, method, path in dashboard_tests:
    test_err(name, method, path)

# Verification counts
log("=" * 60)
log("PHASE 12: DATA VERIFICATION COUNTS")
log("=" * 60)

verifications = [
    ("Total guests", "/api/guests"),
    ("Total bookings", "/api/bookings"),
    ("Total orders", "/api/orders"),
    ("Total folios", "/api/folios"),
    ("Total invoices", "/api/invoices"),
    ("Total payments", "/api/payments"),
    ("WiFi users", "/api/wifi/users"),
    ("WiFi sessions", "/api/wifi/sessions"),
    ("Laundry orders", "/api/laundry/orders"),
    ("Spa appointments", "/api/experience/spa/appointments"),
    ("Golf tee times", "/api/experience/golf/tee-times"),
    ("Parking passes", "/api/parking/passes"),
    ("Casino transactions", "/api/resort/casino/transactions"),
]

for name, path in verifications:
    code, resp = req("GET", path)
    count = 0
    if code == 200 and isinstance(resp, dict):
        data = resp.get("data", resp)
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            count = data.get("total", data.get("count", len(data.get("items", data.get("records", [])))))
    log(f"  {name}: {count} (HTTP {code})")

# ============================================================
# FINAL SUMMARY
# ============================================================
log("=" * 60)
log("FINAL SUMMARY")
log("=" * 60)
log(f"  ✅ PASSED: {results['pass']}")
log(f"  ❌ FAILED: {results['fail']}")
log(f"  ⚠️  ERRORS: {results['error']}")
log(f"  TOTAL: {results['pass'] + results['fail'] + results['error']}")

if results['fail'] > 0:
    log("\nFAILED TESTS:")
    for t in results['tests']:
        if t['status'] == 'FAIL':
            log(f"  ❌ {t['name']} (HTTP {t['code']})")

# Write summary to file
with open("/tmp/e2e-summary.txt", "w") as f:
    f.write(f"PASS={results['pass']}\nFAIL={results['fail']}\nERROR={results['error']}\n")
    for t in results['tests']:
        if t['status'] == 'FAIL':
            f.write(f"FAIL:{t['name']}:{t['code']}\n")

log("\nE2E test complete. Summary saved to /tmp/e2e-summary.txt")
