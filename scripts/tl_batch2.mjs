// Robust translation batch processor with aggressive rate-limit handling
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];
const START = parseInt(process.argv[4]) || 0;
const COUNT = parseInt(process.argv[5]) || 6;

function flatten(d, p = '') {
  const r = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined) continue;
    const k2 = p ? `${p}.${k}` : k;
    if (typeof v === 'string') r[k2] = v;
    else if (typeof v === 'object') Object.assign(r, flatten(v, k2));
  }
  return r;
}
function deepSet(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const chunks = JSON.parse(fs.readFileSync(`/tmp/${LANG}_chunks.json`, 'utf-8'));
const end = Math.min(START + COUNT, chunks.length);
const sysPrompt = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel PMS. Translate ALL values to formal ${LANG_NAME}. Keep keys EXACT. Return valid JSON ONLY. No markdown. Keep acronyms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MikroTik Cisco Aruba Ubiquiti. Keep {placeholders} and {variable} exactly as-is. Formal tone.`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callLLM(zai, obj) {
  // If object is too small (< 3 keys), might not be worth calling
  if (Object.keys(obj).length === 0) return {};
  
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const c = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: JSON.stringify(obj) }
        ],
        thinking: { type: 'disabled' }
      });
      let text = (c.choices[0]?.message?.content || '').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (m) text = m[0];
      text = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(text);
    } catch (e) {
      const isRateLimit = e.message?.includes('429');
      if (isRateLimit) {
        const waitTime = Math.min(30000 * attempt, 120000); // 30s, 60s, 90s, 120s
        console.error(`  Rate limited, waiting ${waitTime/1000}s (attempt ${attempt}/4)...`);
        await sleep(waitTime);
      } else if (attempt < 3) {
        await sleep(2000);
      } else if (attempt === 3 && Object.keys(obj).length > 10) {
        // Split in half on 3rd attempt
        const entries = Object.entries(obj);
        const half = Math.ceil(entries.length / 2);
        const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)));
        const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)));
        return { ...r1, ...r2 };
      } else {
        await sleep(1000);
      }
    }
  }
  return {};
}

async function main() {
  console.error(`${LANG}: Starting chunks ${START}-${end - 1} of ${chunks.length}...`);
  const zai = await ZAI.create();
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  let total = 0;

  for (let i = START; i < end; i++) {
    const result = await callLLM(zai, chunks[i]);
    let applied = 0;
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string' && v.trim()) {
        deepSet(locale, k, v);
        applied++;
      }
    }
    total += applied;
    console.error(`${LANG}[${i + 1}/${chunks.length}] +${applied}`);
    // Rate-limit protection: wait between calls
    await sleep(3000);
  }

  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
  
  // Report remaining
  const lf = flatten(locale);
  const en = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<.*>$|^[^\w]+$|^[a-z]{2,3}$/;
  const still = Object.entries(en).filter(([k, v]) => lf[k] === v && !SKIP.test(v.trim())).length;
  
  console.error(`${LANG}: Chunks ${START}-${end - 1} done. ${total} keys applied. ~${still} remaining.`);
}

main().catch(e => console.error('FATAL:', e.message));
