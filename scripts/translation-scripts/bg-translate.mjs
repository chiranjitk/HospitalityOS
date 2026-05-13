#!/usr/bin/env node
// Background translator - processes all languages sequentially
// Run: nohup node scripts/bg-translate.mjs > /tmp/translate_all.log 2>&1 &
// Check: tail -f /tmp/translate_all.log
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANGUAGES = [
  ['hi', 'Hindi'], ['fr', 'French'], ['ar', 'Arabic'], ['mr', 'Marathi'],
  ['bn', 'Bengali'], ['de', 'German'], ['pt', 'Portuguese'], ['es', 'Spanish'],
  ['ja', 'Japanese'], ['gu', 'Gujarati'], ['ml', 'Malayalam'], ['ta', 'Tamil'],
  ['te', 'Telugu'], ['zh', 'Chinese']
];

const BATCH = 60;

function flatten(d, p = '') {
  const r = {};
  for (const [k, v] of Object.entries(d)) {
    const k2 = p ? `${p}.${k}` : k;
    if (typeof v === 'string') r[k2] = v;
    else if (v && typeof v === 'object') Object.assign(r, flatten(v, k2));
  }
  return r;
}

function deepSet(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const SKIP = /^[A-Z0-9_.@#:\/\-\s]+$|^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|TB|Mbps|Kbps)?$|^<.*>$|^[^\w]+$|^[a-z]{2,3}$/;
function shouldSkip(v) { const s = v.trim(); return !s || s.length <= 1 || SKIP.test(s); }

async function callLLM(zai, obj, langName, retries = 3) {
  const sysPrompt = `Professional ${langName} translator for StaySuite HospitalityOS hotel PMS. Translate ALL values to formal ${langName}. Keep keys exact. Return valid JSON only. No markdown fences. Keep industry terms: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MikroTik Cisco Aruba Ubiquiti. Keep {placeholders} unchanged. Formal/polite tone.`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
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
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else if (Object.keys(obj).length > 10) {
        // Split in half on final retry
        const entries = Object.entries(obj);
        const half = Math.ceil(entries.length / 2);
        try {
          const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)), langName, 1);
          const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)), langName, 1);
          return { ...r1, ...r2 };
        } catch { return {}; }
      }
    }
  }
  return {};
}

async function processLanguage(zai, lang, langName) {
  const doneFile = `/tmp/${lang}_done.jsonl`;
  const locale = JSON.parse(fs.readFileSync(`src/messages/${lang}.json`, 'utf-8'));
  const locFlat = flatten(locale);
  const enFlat = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));

  // Load previous progress
  const alreadyDone = new Set();
  if (fs.existsSync(doneFile)) {
    for (const line of fs.readFileSync(doneFile, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        for (const k of Object.keys(d)) alreadyDone.add(k);
        for (const [k, v] of Object.entries(d)) {
          if (typeof v === 'string' && v.trim()) deepSet(locale, k, v);
        }
      } catch {}
    }
  }

  const remaining = [];
  for (const [k, v] of Object.entries(enFlat)) {
    if (locFlat[k] === v && !shouldSkip(v) && !alreadyDone.has(k)) remaining.push([k, v]);
  }

  if (remaining.length === 0) {
    // Write and verify
    fs.writeFileSync(`src/messages/${lang}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
    const vf = flatten(JSON.parse(fs.readFileSync(`src/messages/${lang}.json`, 'utf-8')));
    const rem = Object.entries(enFlat).filter(([k, v]) => vf[k] === v && !shouldSkip(v)).length;
    console.log(`${lang}: ✅ 100% (${rem} codes remaining)`);
    return;
  }

  console.log(`${lang}: ${remaining.length} keys to translate (${alreadyDone.size} already done)`);
  let total = 0;

  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const obj = Object.fromEntries(batch);
    const n = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH);

    const result = await callLLM(zai, obj, langName);
    const count = Object.keys(result).length;
    total += count;

    fs.appendFileSync(doneFile, JSON.stringify(result) + '\n');
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string' && v.trim()) deepSet(locale, k, v);
    }

    console.log(`  ${lang} [${n}/${totalBatches}] +${count} (${total}/${remaining.length})`);
    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync(`src/messages/${lang}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
  
  const vf = flatten(JSON.parse(fs.readFileSync(`src/messages/${lang}.json`, 'utf-8')));
  const rem = Object.entries(enFlat).filter(([k, v]) => vf[k] === v && !shouldSkip(v)).length;
  console.log(`${lang}: ✅ Done (${total} translated, ${rem} remaining)`);
}

async function main() {
  console.log('=== StaySuite i18n Translation Pipeline ===');
  console.log(`Languages: ${LANGUAGES.length}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const zai = await ZAI.create();
  console.log('LLM connected\n');

  for (const [lang, name] of LANGUAGES) {
    try {
      await processLanguage(zai, lang, name);
    } catch (e) {
      console.error(`${lang}: FATAL - ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== ALL DONE ===');
  console.log(`Time: ${new Date().toISOString()}`);
}

main().catch(e => console.error('PIPELINE FATAL:', e.message));
