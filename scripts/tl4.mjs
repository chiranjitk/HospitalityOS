import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];

const BATCH = 60;
const SYS = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel PMS. Translate ALL values to formal ${LANG_NAME}. Keep keys EXACT. Return valid JSON ONLY. No markdown fences. Keep acronyms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MikroTik Cisco Aruba Ubiquiti. Keep {placeholders} unchanged. Formal/polite tone.`;

function flatten(d, p = '') {
  const r = {};
  for (const [k, v] of Object.entries(d)) {
    const k2 = p ? `${p}.${k}` : k;
    if (typeof v === 'string') r[k2] = v;
    else if (v && typeof v === 'object') Object.assign(r, flatten(v, k2));
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

function shouldSkip(v) {
  const s = v.trim();
  if (!s || s.length <= 1) return true;
  // Placeholders and template expressions
  if (s.includes('{') && s.includes('}')) return true;
  if (s.includes('${')) return true;
  // URLs
  if (/^https?:\/\//.test(s)) return true;
  // Emails
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)) return true;
  if (s.includes('@') && (s.includes('.com') || s.includes('.org') || s.includes('.hotel'))) return true;
  // Phone numbers
  if (/^\+?[\d\s\-\(\)]{7,}$/.test(s)) return true;
  // API keys/secrets placeholders
  if (/^(sk|pk|whsec|secret|token|api.?key)/.test(s, 10)) return true;
  if (/_xxxxx$/.test(s) || /_key$/.test(s)) return true;
  // ALL CAPS / codes
  if (/^[A-Z0-9_.@#:\/\-\s]+$/.test(s)) return true;
  if (/^[A-Z]{2,}$/.test(s)) return true;
  // Numbers with units
  if (/^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$/.test(s)) return true;
  // HTML
  if (/^<.*>$/.test(s)) return true;
  // Special chars only
  if (/^[^\w]+$/.test(s)) return true;
  // Short language codes
  if (/^[a-z]{2,3}$/.test(s)) return true;
  // Brand/product names (CamelCase with 2+ uppercase)
  if (/[a-z][A-Z]{2,}/.test(s)) return true;
  // Proper names (all words start with uppercase)
  const words = s.split(/[\s\-_:]/).filter(w => w.length > 0);
  if (words.length >= 2 && words.every(w => w[0] === w[0].toUpperCase() && /[a-z]/.test(w.slice(1)))) return true;
  // Domain-like strings
  if (/^[a-z0-9]+([-\.][a-z0-9]+)*\.[a-z]{2,}$/.test(s)) return true;
  // Currency codes
  if (/^[A-Z]{3}(,\s*[A-Z]{3})*$/.test(s)) return true;
  // File format patterns
  if (/^\w+\.\w+$/.test(s) && s.length < 30) return true;
  // Common example names
  if (/^(John|Jane|Admin|User|Test)\s/.test(s)) return true;
  if (/\b(John Doe|Jane Smith)\b/.test(s)) return true;
  return false;
}

async function callLLM(zai, obj) {
  for (let attempt = 1; attempt <= 3; attempt++) {
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
      text = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(text);
    } catch (e) {
      if (attempt === 3 && Object.keys(obj).length > 10) {
        const entries = Object.entries(obj);
        const half = Math.ceil(entries.length / 2);
        const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)));
        const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)));
        return { ...r1, ...r2 };
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return {};
}

async function main() {
  const enFlat = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  const locFlat = flatten(locale);

  const remaining = [];
  for (const [k, v] of Object.entries(enFlat)) {
    if (locFlat[k] === v && !shouldSkip(v)) remaining.push([k, v]);
  }
  console.error(`${LANG}: ${remaining.length} keys to translate`);
  if (remaining.length === 0) { console.error(`${LANG}: ✅ 100%`); return; }

  const zai = await ZAI.create();
  let done = 0;
  const totalBatches = Math.ceil(remaining.length / BATCH);

  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const obj = Object.fromEntries(batch);
    const n = Math.floor(i / BATCH) + 1;

    const result = await callLLM(zai, obj);
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string' && v.trim()) deepSet(locale, k, v);
    }
    done += Object.keys(result).length;
    console.error(`[${n}/${totalBatches}] +${Object.keys(result).length} (${done}/${remaining.length})`);
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
  console.error(`${LANG}: ✅ Done (${done} translated)`);
}

main().catch(e => console.error('FATAL:', e.message));
