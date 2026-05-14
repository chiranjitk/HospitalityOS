const { Client } = require("pg");
const c = new Client("postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite");
(async () => {
  await c.connect();
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'WiFiVoucher' ORDER BY ordinal_position");
  console.log("COLS:", cols.rows.map(r=>r.column_name));
  const v = await c.query("SELECT * FROM \"WiFiVoucher\" LIMIT 3");
  console.log("VOUCHERS:", JSON.stringify(v.rows));
  const p = await c.query("SELECT id, name FROM \"WiFiPlan\" LIMIT 5");
  console.log("PLANS:", JSON.stringify(p.rows));
  const uc = await c.query("SELECT count(*) as cnt FROM \"WiFiVoucher\" WHERE \"isUsed\" = false");
  console.log("UNUSED VOUCHERS:", uc.rows[0].cnt);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
