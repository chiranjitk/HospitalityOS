// Regenerate chunks for a language based on CURRENT state (only untranslated keys)
import fs from 'fs';

const LANG = process.argv[2];
const CHUNK_SIZE = parseInt(process.argv[3]) || 30;

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

// Skip patterns: placeholders, brand names, URLs, emails, pure acronyms, codes
const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$/ 
  + '|^<[^>]+>$|^[^\w\u4e00-\u9fff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0b00-\u0b7f\u0c00-\u0c7f\u0d00-\u0d7f\u3040-\u309f\u30a0-\u30ff]+$' 
  + '|^[a-z]{2,3}$|^[a-f0-9]{6,}$|^\d{4}-\d{2}-\d{2}';

const en = flatten(JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8')));
const loc = flatten(JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8')));

// Find untranslated keys (value matches English AND is not a skippable value)
const untranslated = Object.entries(en).filter(([k, v]) => {
  if (loc[k] !== v) return false; // Already translated
  if (!v.trim()) return false; // Empty - skip
  if (/^https?:\/\//.test(v)) return false; // URLs
  if (/^[A-Z0-9_.@#:\/\-\s]+$/.test(v.trim())) return false; // Codes/acronyms
  if (/^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$/.test(v.trim())) return false; // Numbers
  if (/^<[^>]+>$/.test(v.trim())) return false; // HTML-like
  if (/^[a-z]{2,3}$/.test(v.trim())) return false; // Short codes
  if (/^[a-f0-9]{6,}$/.test(v.trim())) return false; // Hex codes
  if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return false; // Date strings
  return true;
});

console.error(`${LANG}: ${untranslated.length} untranslated keys`);

// Split into chunks
const chunks = [];
for (let i = 0; i < untranslated.length; i += CHUNK_SIZE) {
  const chunk = {};
  for (const [k, v] of untranslated.slice(i, i + CHUNK_SIZE)) {
    chunk[k] = v;
  }
  chunks.push(chunk);
}

fs.writeFileSync(`/tmp/${LANG}_chunks.json`, JSON.stringify(chunks));
console.error(`${LANG}: ${chunks.length} chunks of ~${CHUNK_SIZE} keys each`);
