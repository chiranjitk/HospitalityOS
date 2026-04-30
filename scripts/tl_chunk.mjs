// Translate one chunk for one language
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];
const CHUNK_IDX = parseInt(process.argv[4]) || 0;

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

const chunks = JSON.parse(fs.readFileSync(`/tmp/${LANG}_chunks.json`, 'utf-8'));
const chunk = chunks[CHUNK_IDX];
const sysPrompt = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel PMS. Translate ALL values to formal ${LANG_NAME}. Keep keys EXACT. Return valid JSON ONLY. No markdown. Keep acronyms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MikroTik Cisco Aruba Ubiquiti. Keep {placeholders}. Formal tone.`;

async function callLLM(zai, obj) {
  for (let attempt = 1; attempt <= 2; attempt++) {
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
      if (attempt === 2 && Object.keys(obj).length > 10) {
        const entries = Object.entries(obj);
        const half = Math.ceil(entries.length / 2);
        const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)));
        const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)));
        return { ...r1, ...r2 };
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return {};
}

async function main() {
  const zai = await ZAI.create();
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  
  const result = await callLLM(zai, chunk);
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string' && v.trim()) deepSet(locale, k, v);
  }
  
  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
  
  const lf = flatten(locale);
  const en = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<.*>$|^[^\w]+$|^[a-z]{2,3}$/;
  const still = Object.entries(en).filter(([k, v]) => lf[k] === v && !SKIP.test(v.trim())).length;
  
  console.error(`${LANG}[${CHUNK_IDX + 1}/${chunks.length}] +${Object.keys(result).length} (${still} remaining)`);
}

main().catch(e => console.error('FATAL:', e.message));
