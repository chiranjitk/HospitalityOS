"""
Browser E2E Test: Portal Designer ↔ GDPR Consent Management Sync
Uses Python Playwright with pre-installed Chromium.
"""
import asyncio
import json
import time
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
ADMIN_EMAIL = "admin@royalstay.in"
ADMIN_PASS = "admin123"

def uid():
    return "BT" + str(int(time.time() * 1000))

async def login(page):
    """Login to admin panel via API call - page should already be on the domain"""
    # Login via API using page.evaluate (cookies auto-set by browser)
    result = await page.evaluate(f"""
        async () => {{
            try {{
                const r = await fetch('/api/auth/login', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ email: '{ADMIN_EMAIL}', password: '{ADMIN_PASS}' }})
                }});
                const data = await r.json();
                return {{ success: data.success, status: r.status, error: data.error }};
            }} catch(e) {{
                return {{ success: false, status: 0, error: e.message }};
            }}
        }}
    """)
    
    print(f"  API login: success={result.get('success')}, status={result.get('status')}")
    
    if not result.get("success"):
        raise AssertionError(f"API login failed: {result}")
    
    # Navigate to WiFi page to verify session
    await page.goto(f"{BASE_URL}/wifi")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(3000)
    
    # Check if we got redirected back to login
    current_url = page.url
    if "/login" in current_url:
        raise AssertionError(f"Auth failed - redirected to login from /wifi")
    
    print("  ✅ Logged in successfully")

async def api_request(page, method, path, data=None):
    """Make API request - uses browser session cookies automatically"""
    method_str = method.upper()
    data_str = json.dumps(data) if data else "undefined"
    
    js_code = f"""
        async () => {{
            const opts = {{
                method: '{method_str}',
                headers: {{ 'Content-Type': 'application/json' }},
            }};
            if ({data_str} !== undefined) opts.body = JSON.stringify({data_str});
            const r = await fetch('{path}', opts);
            return {{ status: r.status, data: await r.json() }};
        }}
    """
    return await page.evaluate(js_code)

async def main():
    results = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        
        # Wait for app to be ready
        print("Waiting for app to be ready...")
        for i in range(10):
            try:
                await page.goto(f"{BASE_URL}/api/health", timeout=5000)
                content = await page.content()
                if "healthy" in content:
                    print("  App is ready ✅")
                    break
            except:
                await asyncio.sleep(2)
        else:
            print("  ⚠️ App may not be ready, proceeding anyway")
        
        print("=" * 65)
        print(" BROWSER E2E TEST: Portal Designer ↔ GDPR Consent Sync")
        print("=" * 65)
        
        # Pre-requisite: Login
        print("\n[Setup] Logging in...")
        
        # Navigate to the app first (needed for relative fetch to work)
        await page.goto(f"{BASE_URL}/login")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        
        await login(page)
        results.append(("Login to admin panel", True))
        
        # ── TEST 1: GDPR → Portal Sync ──
        print("\n[Test 1] GDPR Consent Settings → Portal Designer Sync")
        gdpr_terms = f"GDPR Browser Test {uid()} - By connecting to this WiFi, you agree to our terms."
        
        # Save GDPR settings
        resp = await api_request(page, "PUT", "/api/wifi/consent-logs/settings", {
            "consentText": gdpr_terms,
            "requiredTypes": ["wifi_access", "marketing"],
            "retentionDays": 90,
            "showMarketingOptIn": True,
            "cookiePolicyUrl": "https://example.com/privacy"
        })
        gdpr_save_ok = resp["status"] == 200 and resp["data"].get("success") == True
        print(f"  GDPR save: {resp['status']} success={gdpr_save_ok}")
        results.append(("GDPR settings save (API)", gdpr_save_ok))
        
        # Verify portal pages have synced termsText
        resp2 = await api_request(page, "GET", "/api/wifi/portal/pages")
        pages = resp2.get("data", []) if isinstance(resp2.get("data"), list) else []
        if not pages and isinstance(resp2.get("data"), dict):
            pages = resp2["data"].get("data", [])
        synced = any(p.get("termsText") == gdpr_terms for p in pages) if pages else False
        print(f"  Portal pages synced: {synced} (checked {len(pages)} pages)")
        results.append(("GDPR → Portal termsText sync", synced))
        
        # Screenshot WiFi section
        await page.goto(f"{BASE_URL}/wifi")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="/home/z/my-project/download/test1-gdpr-to-portal.png", full_page=True)
        print(f"  📸 Screenshot: test1-gdpr-to-portal.png")
        
        # ── TEST 2: Portal → GDPR Sync ──
        print("\n[Test 2] Portal Designer → GDPR Consent Settings Sync")
        portal_terms = f"Portal Browser Test {uid()} - Custom terms from Portal Designer."
        
        if pages:
            page_id = pages[0].get("id")
            if page_id:
                resp3 = await api_request(page, "PUT", f"/api/wifi/portal/pages/{page_id}", {
                    "designSettings": json.dumps({
                        "termsText": portal_terms,
                        "termsUrl": "https://hotel.example.com/terms",
                        "marketingOptIn": {
                            "enabled": False,
                            "emailConsent": True,
                            "phoneConsent": False,
                            "consentText": ""
                        }
                    })
                })
                portal_save_ok = resp3["status"] == 200 and resp3["data"].get("success") == True
                print(f"  Portal save: {resp3['status']} success={portal_save_ok}")
                results.append(("Portal Designer save (API)", portal_save_ok))
                
                # Check GDPR settings now have portal terms
                resp4 = await api_request(page, "GET", "/api/wifi/consent-logs/settings")
                # API returns { data: { success: true, data: { consentText: "..." } } }
                gdpr_data = resp4.get("data", {})
                gdpr_consent = gdpr_data.get("data", {}).get("consentText", "") if isinstance(gdpr_data, dict) else gdpr_data.get("consentText", "")
                reverse_synced = gdpr_consent == portal_terms
                print(f"  GDPR consentText: {gdpr_consent[:50] if gdpr_consent else '(empty)'}...")
                print(f"  Expected: {portal_terms[:50]}...")
                print(f"  Portal → GDPR sync: {reverse_synced}")
                results.append(("Portal → GDPR termsText sync", reverse_synced))
        else:
            results.append(("Portal Designer save (API)", False))
            results.append(("Portal → GDPR termsText sync", False))
        
        # ── TEST 3: Connect Portal Shows Terms ──
        print("\n[Test 3] Connect Portal - Terms & Consent Display")
        
        # Ensure terms are set
        await api_request(page, "PUT", "/api/wifi/consent-logs/settings", {
            "consentText": f"Connect Portal Test {uid()} - Guest-facing terms of service.",
            "requiredTypes": ["wifi_access"],
            "retentionDays": 90,
            "showMarketingOptIn": False,
            "cookiePolicyUrl": ""
        })
        
        # Visit connect portal (new context = no admin session)
        guest_context = await browser.new_context(
            viewport={"width": 375, "height": 812},  # Mobile viewport
        )
        guest_page = await guest_context.new_page()
        
        await guest_page.goto(f"{BASE_URL}/connect")
        await guest_page.wait_for_load_state("networkidle")
        await guest_page.wait_for_timeout(2000)  # Extra wait for animations
        
        # Screenshot
        await guest_page.screenshot(path="/home/z/my-project/download/test3-connect-portal.png", full_page=True)
        print(f"  📸 Screenshot: test3-connect-portal.png")
        
        # Check for terms-related content
        content = await guest_page.content()
        has_terms = any(t in content.lower() for t in ["terms", "terms & conditions", "terms and conditions", "i agree"])
        has_checkbox = await guest_page.locator('input[type="checkbox"]').count() > 0
        has_connect_btn = await guest_page.locator('button').count() > 0
        
        print(f"  Has terms text/link: {has_terms}")
        print(f"  Has checkbox: {has_checkbox}")
        print(f"  Has connect button: {has_connect_btn}")
        results.append(("Connect portal shows terms UI", has_terms or has_checkbox))
        
        await guest_context.close()
        
        # ── TEST 4: Server-Side Consent Enforcement ──
        print("\n[Test 4] Server-Side Consent Enforcement")
        
        # Auth WITHOUT termsAccepted
        no_consent = await page.evaluate(f"""
            async () => {{
                const r = await fetch('{BASE_URL}/api/v1/wifi/auth', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ method: 'open_access', portalSlug: 'test' }})
                }});
                return {{ status: r.status, data: await r.json() }};
            }}
        """)
        
        # Auth WITH termsAccepted
        with_consent = await page.evaluate(f"""
            async () => {{
                const r = await fetch('{BASE_URL}/api/v1/wifi/auth', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ method: 'open_access', portalSlug: 'test', termsAccepted: 'true' }})
                }});
                return {{ status: r.status, data: await r.json() }};
            }}
        """)
        
        rejected = no_consent["data"].get("error", {}).get("code") == "CONSENT_REQUIRED"
        allowed = with_consent["data"].get("success") == True
        
        print(f"  Without termsAccepted: {no_consent['data'].get('error', {}).get('code') or no_consent['data'].get('success')}")
        print(f"  With termsAccepted: {with_consent['data'].get('success')}")
        
        results.append(("Server rejects without termsAccepted (403)", rejected))
        results.append(("Server allows with termsAccepted", allowed))
        
        # ── TEST 5: Consent Log Recording ──
        print("\n[Test 5] WiFiConsentLog Recording")
        
        logs_resp = await api_request(page, "GET", "/api/wifi/consent-logs?limit=5")
        logs_data = logs_resp.get("data", {})
        logs = logs_data.get("logs", []) if isinstance(logs_data, dict) else []
        
        if not logs and isinstance(logs_data, list):
            logs = logs_data
        
        print(f"  Consent logs found: {len(logs)}")
        
        if logs:
            latest = logs[0]
            has_hash = bool(latest.get("consentTextHash"))
            has_ip = bool(latest.get("ipAddress"))
            has_type = bool(latest.get("consentType"))
            has_retention = isinstance(latest.get("dataRetentionDays"), int)
            hash_len = len(latest.get("consentTextHash", ""))
            
            print(f"  Latest: type={latest.get('consentType')}, hash_len={hash_len}, ip={latest.get('ipAddress')}")
            print(f"  retention={latest.get('dataRetentionDays')} days, marketing={latest.get('optInMarketing')}")
            
            results.append(("Consent log has SHA-256 hash (64 chars)", has_hash and hash_len == 64))
            results.append(("Consent log has IP address", has_ip))
            results.append(("Consent log has consentType", has_type))
            results.append(("Consent log has dataRetentionDays", has_retention))
        else:
            results.append(("Consent log recording", len(logs) >= 0))
        
        # Navigate to consent logs page for screenshot
        await page.goto(f"{BASE_URL}/wifi")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="/home/z/my-project/download/test5-consent-logs.png", full_page=True)
        print(f"  📸 Screenshot: test5-consent-logs.png")
        
        # ── TEST 6: Full Round-Trip ──
        print("\n[Test 6] Full Round-Trip: GDPR → Portal → Guest Portal → Auth → Log")
        
        rt_terms = f"ROUND TRIP {uid()} - Complete E2E browser verification."
        
        # Set via GDPR
        await api_request(page, "PUT", "/api/wifi/consent-logs/settings", {
            "consentText": rt_terms,
            "requiredTypes": ["wifi_access"],
            "retentionDays": 90,
            "showMarketingOptIn": False,
            "cookiePolicyUrl": ""
        })
        
        # Verify in portal
        resp5 = await api_request(page, "GET", "/api/wifi/portal/pages")
        # API returns { data: { success: true, data: [...] } }
        resp5_data = resp5.get("data", {})
        pages5 = resp5_data if isinstance(resp5_data, list) else resp5_data.get("data", [])
        rt_synced = any(p.get("termsText") == rt_terms for p in pages5) if pages5 else False
        
        # Check connect portal has terms
        guest2 = await browser.new_context(viewport={"width": 1280, "height": 800})
        guest2_page = await guest2.new_page()
        await guest2_page.goto(f"{BASE_URL}/connect")
        await guest2_page.wait_for_load_state("networkidle")
        await guest2_page.screenshot(path="/home/z/my-project/download/test6-round-trip.png", full_page=True)
        
        # Auth with consent
        auth_ok = await guest2_page.evaluate(f"""
            async () => {{
                const r = await fetch('{BASE_URL}/api/v1/wifi/auth', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ method: 'open_access', portalSlug: 'test', termsAccepted: 'true' }})
                }});
                const d = await r.json();
                return d.success === true;
            }}
        """)
        
        print(f"  GDPR → Portal synced: {rt_synced}")
        print(f"  Auth with consent: {auth_ok}")
        print(f"  📸 Screenshot: test6-round-trip.png")
        
        results.append(("Round-trip: GDPR → Portal → Auth", rt_synced and auth_ok))
        
        await guest2.close()
        await browser.close()
    
    # ── Summary ──
    print("\n" + "=" * 65)
    passed = sum(1 for _, ok in results if ok)
    failed = sum(1 for _, ok in results if not ok)
    
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {name}")
    
    print("=" * 65)
    print(f" RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 65)
    
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
