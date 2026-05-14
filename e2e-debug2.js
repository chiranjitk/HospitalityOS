const API = "http://localhost:3000";
const SESSION_TOKEN = "a2dd5d50ece6e34bca509ad069eca63c19fec556559a9f369ed1d13b28835989";

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Cookie": `session_token=${SESSION_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

(async () => {
  // 1. Get a fresh unused voucher
  const { Client } = require("pg");
  const c = new Client("postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite");
  await c.connect();
  const vouchers = await c.query("SELECT code FROM \"WiFiVoucher\" WHERE \"isUsed\" = false LIMIT 1");
  await c.end();
  
  if (vouchers.rows.length === 0) {
    console.log("NO UNUSED VOUCHERS");
    return;
  }
  
  const code = vouchers.rows[0].code;
  console.log("Voucher code:", code, "type:", typeof code);
  
  // 2. Try auth with exact code
  const body = { method: "voucher", code, portalSlug: "royal-stay-guest", macAddress: "AA:BB:CC:DD:01:FF" };
  console.log("Auth body:", JSON.stringify(body));
  
  const res = await fetch(`${API}/api/v1/wifi/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("Auth response status:", res.status);
  console.log("Auth response:", JSON.stringify(data, null, 2));
})();
