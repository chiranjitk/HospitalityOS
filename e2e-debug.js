const API = "http://localhost:3000";
const SESSION_TOKEN = "a2dd5d50ece6e34bca509ad069eca63c19fec556559a9f369ed1d13b28835989";
const PLAN_ID = "c80731b1-952f-45c0-b6e5-9cb77deb2590";

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Cookie": `session_token=${SESSION_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

(async () => {
  // Create 2 vouchers
  const r = await api("POST", "/api/wifi/vouchers", { planId: PLAN_ID, quantity: 2 });
  console.log("VOUCHER CREATE:", JSON.stringify(r, null, 2).slice(0, 500));
  
  // Try auth with one
  if (r.success && r.data) {
    const codes = Array.isArray(r.data) ? r.data : [r.data];
    const code = codes[0]?.code;
    console.log("USING CODE:", code);
    const auth = await api("POST", "/api/v1/wifi/auth", {
      method: "voucher",
      code: code,
      portalSlug: "royal-stay-guest",
      macAddress: "AA:BB:CC:DD:01:FF",
    });
    console.log("AUTH:", JSON.stringify(auth, null, 2).slice(0, 1000));
  }
})();
