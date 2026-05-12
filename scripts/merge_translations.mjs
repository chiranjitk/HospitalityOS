// Helper: Merge translated chunks and apply to locale file
import fs from 'fs';

const LANG = process.argv[2];

function deepSet(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
let total = 0;
let chunkIdx = 0;

while (true) {
  const path = `/tmp/${LANG}_translated_${chunkIdx}.json`;
  if (!fs.existsSync(path)) break;
  try {
    const translated = JSON.parse(fs.readFileSync(path, 'utf-8'));
    let applied = 0;
    for (const [k, v] of Object.entries(translated)) {
      if (v && typeof v === 'string') { deepSet(locale, k, v); applied++; }
    }
    console.log(`Chunk ${chunkIdx}: ${applied} translations applied`);
    total += applied;
  } catch (e) {
    console.error(`Chunk ${chunkIdx} error:`, e.message);
  }
  chunkIdx++;
}

fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
console.log(`${LANG}: Total ${total} translations applied`);

// Verify
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
const en = flatten(JSON.parse(fs.readFileSync('src/messages/en.json', 'utf-8')));
const loc = flatten(locale);
const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<[^>]+>$|^[^\w\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F\u0E00-\u0E7F\u1000-\u109F\u1100-\u11FF\u1200-\u137F\u1780-\u17FF\u1800-\u18AF\u2E80-\u2EFF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+$|^[a-z]{2,3}$|^[a-f0-9]{6,}$|^\d{4}-\d{2}-\d{2}|^https?:\/\/|@[a-zA-Z0-9.-]+\.[a-z]{2,}$|sk-[a-z]+$|pk-[a-z]+$|whsec_[a-z]+$|secret[_-]?key$|^\{.*\}$|StaySuite|Google|Facebook|Booking\.com|TripAdvisor|Expedia|SendGrid|Mailgun|Twilio|Nexmo|Plivo|Firebase|OneSignal|MikroTik|Cisco|Aruba|Ubiquiti|RevPAR|ADR|YouTube/;
const remaining = Object.entries(en).filter(([k, v]) => loc[k] === v && !SKIP.test(v)).length;
const pct = ((1 - remaining / Object.keys(en).length) * 100).toFixed(1);
console.log(`${LANG}: ${remaining} untranslated (${pct}%)`);
