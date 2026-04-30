import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];
const BATCH = 60;
const SYS = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel PMS. Translate ALL values to formal ${LANG_NAME}. Keep keys exact. Return valid JSON only. No markdown. Keep acronyms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MikroTik Cisco Aruba Ubiquiti. Keep {placeholders} unchanged.`;

function flatten(d, p = '') {
  const r = {};
  for (const [k, v] of Object.entries(d)) {
    const k2 = p ? `${p}.${k}` : k;
    if (typeof v === 'string') r[k2] = v;
    else if (v && typeof v === 'object') Object.assign(r, flatten(v, k2));
  }
  return r;
}
function unflatten(flat) {
  const r = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = r;
    for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]]) cur[parts[i]] = {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = value;
  }
  return r;
}
const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<.*>$|^[^\w]+$|^[a-z]{2,3}$/;
function shouldSkip(v) { const s = v.trim(); return !s || s.length <= 1 || SKIP.test(s); }

async function callLLM(zai, obj, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const c = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: JSON.stringify(obj) }
        ],
        thinking: { type: 'disabled' }
      });
      let text = (c.choices[0]?.message?.content || '').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (m) text = m[0];
      // Fix common JSON issues
      text = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(text);
    } catch (e) {
      if (attempt === retries) {
        // Try splitting in half
        if (Object.keys(obj).length > 5) {
          const entries = Object.entries(obj);
          const half = Math.ceil(entries.length / 2);
          const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)), 1);
          const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)), 1);
          return { ...r1, ...r2 };
        }
        console.error(`Failed after ${retries} retries`);
        return {};
      }
      console.error(`Retry ${attempt}/${retries}: ${e.message.slice(0, 50)}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return {};
}

async function main() {
  const enFlat = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  const locFlat = flatten(locale);

  // Load already-done translations from result file
  if (fs.existsSync(`/tmp/${LANG}_result.jsonl`)) {
    for (const line of fs.readFileSync(`/tmp/${LANG}_result.jsonl`, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        for (const [k, v] of Object.entries(d)) { if (typeof v === 'string' && v.trim()) locFlat[k] = v; }
      } catch {}
    }
  }

  // Find remaining
  const remaining = [];
  for (const [k, v] of Object.entries(enFlat)) {
    if (locFlat[k] === v && !shouldSkip(v)) remaining.push([k, v]);
  }
  console.error(`${LANG}: ${remaining.length} remaining`);

  if (remaining.length === 0) {
    // Just merge and write
    const updated = unflatten(locFlat);
    fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    console.error(`${LANG}: Already 100%!`);
    return;
  }

  const zai = await ZAI.create();
  let total = 0;
  const totalBatches = Math.ceil(remaining.length / BATCH);

  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const obj = Object.fromEntries(batch);
    const n = Math.floor(i / BATCH) + 1;

    const result = await callLLM(zai, obj);
    const count = Object.keys(result).length;
    total += count;

    // Save incremental
    fs.appendFileSync(`/tmp/${LANG}_result.jsonl`, JSON.stringify(result) + '\n');
    for (const [k, v] of Object.entries(result)) { if (typeof v === 'string' && v.trim()) locFlat[k] = v; }

    console.error(`[${n}/${totalBatches}] +${count} (total: ${total}/${remaining.length})`);
    await new Promise(r => setTimeout(r, 300));
  }

  const updated = unflatten(locFlat);
  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  
  // Verify
  const vf = flatten(JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8')));
  const rem = Object.entries(enFlat).filter(([k, v]) => vf[k] === v && !shouldSkip(v)).length;
  console.error(`${LANG} DONE: ${total} translated, ${rem} remaining`);
}

main().catch(e => console.error('FATAL:', e.message));
