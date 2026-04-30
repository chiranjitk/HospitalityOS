import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];

const SYS = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel PMS.
Rules:
1. Translate ALL JSON values to formal ${LANG_NAME}.
2. Keep ALL JSON keys EXACTLY as provided.
3. Return ONLY valid JSON. No markdown fences, no commentary.
4. Keep industry terms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MB KB GB MikroTik Cisco Aruba Ubiquiti.
5. Keep {placeholders} unchanged.
6. Formal tone.`;

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
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return r;
}

const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<.*>$|^[^\w]+$|^[a-z]{2,3}$/;
function shouldSkip(v) { const s = v.trim(); return !s || s.length <= 1 || SKIP.test(s); }

async function main() {
  console.error(`Starting ${LANG}...`);
  const enFlat = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  const locFlat = flatten(locale);
  
  const toTranslate = [];
  for (const [k, v] of Object.entries(enFlat)) {
    if (locFlat[k] === v && !shouldSkip(v)) toTranslate.push([k, v]);
  }
  console.error(`Need: ${toTranslate.length}`);
  if (toTranslate.length === 0) { console.error('Already 100%!'); return; }
  
  // Save state for resume
  const stateFile = `/tmp/${LANG}_state.json`;
  let done = 0;
  if (fs.existsSync(stateFile)) {
    const prev = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    for (const [k, v] of Object.entries(prev)) locFlat[k] = v;
    done = Object.keys(prev).length;
    console.error(`Resuming from ${done} done`);
  }
  
  // Filter already done
  const remaining = toTranslate.filter(([k]) => {
    const enVal = enFlat[k];
    return locFlat[k] === enVal;
  });
  console.error(`Remaining: ${remaining.length}`);
  
  const BATCH = 60;
  const zai = await ZAI.create();
  let batchDone = 0;
  
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const obj = Object.fromEntries(batch);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(remaining.length / BATCH);
    
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
      text = text.replace(/,(\s*[}\]])/g, '$1'); // fix trailing commas
      
      const result = JSON.parse(text);
      const state = {};
      for (const [k, v] of Object.entries(result)) {
        if (typeof v === 'string' && v.trim()) {
          locFlat[k] = v;
          state[k] = v;
          batchDone++;
        }
      }
      // Save incremental state
      fs.writeFileSync(stateFile, JSON.stringify({...JSON.parse(fs.readFileSync(stateFile, 'utf-8').toString() || '{}'), ...state}));
      console.error(`[${n}/${total}] +${Object.keys(result).length} (done: ${done + batchDone}/${remaining.length})`);
    } catch (e) {
      console.error(`[${n}/${total}] ERROR: ${e.message.slice(0, 60)}`);
      // Save progress and continue
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Write final
  const updated = unflatten(locFlat);
  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  
  // Verify
  const vf = flatten(JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8')));
  const rem = Object.entries(enFlat).filter(([k, v]) => vf[k] === v && !shouldSkip(v)).length;
  console.error(`DONE: translated ${done + batchDone}, ${rem} English remaining`);
}

main().catch(e => console.error('FATAL:', e.message));
