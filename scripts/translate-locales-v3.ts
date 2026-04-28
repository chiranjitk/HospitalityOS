import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const msgsDir = path.join(process.cwd(), 'src', 'messages');

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', es: 'Spanish',
  fr: 'French', gu: 'Gujarati', hi: 'Hindi', ja: 'Japanese',
  ml: 'Malayalam', mr: 'Marathi', pt: 'Portuguese', ta: 'Tamil',
  te: 'Telugu', zh: 'Chinese Simplified'
};

function flatten(obj: any, prefix = ''): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) Object.assign(map, flatten(v, fullKey));
    else map[fullKey] = v;
  }
  return map;
}

function setNested(obj: any, keyPath: string, value: string) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function translateBatch(zai: any, values: string[], langName: string, batchNum: number): Promise<Record<string, string>> {
  const inputObj: Record<string, string> = {};
  for (const v of values) inputObj[v] = v;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: `You are a professional translator for StaySuite Hospitality OS. Translate English UI strings to ${langName}. Keep technical terms (API, WiFi, POS, KPI, RevPAR, ADR, CRS, OTA, KYC, GDPR, SaaS, SSO, MFA, DNS, DHCP, RADIUS, CSV, JSON, PDF) in English. Keep ICU patterns like "{count, plural, one {# item} other {# items}}" exactly intact. Keep {placeholder} syntax intact. Return ONLY a valid JSON object, no markdown fences, no explanation.` },
          { role: 'user', content: JSON.stringify(inputObj) }
        ],
        thinking: { type: 'disabled' }
      });

      let response = completion.choices[0]?.message?.content || '';
      response = response.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      return JSON.parse(response);
    } catch (err: any) {
      const msg = err?.message || String(err);
      const delay = Math.min(20000 * attempt, 120000); // 20s, 40s, 60s, 80s, 100s
      console.log(`    [Batch ${batchNum}] Attempt ${attempt} failed, retrying in ${delay/1000}s... (${msg.slice(0, 80)})`);
      await sleep(delay);
    }
  }
  return {};
}

async function translateLocale(locale: string, zai: any) {
  const langName = LANGUAGE_NAMES[locale];
  console.log(`\n========== Translating ${locale} (${langName}) ==========`);

  const en = JSON.parse(fs.readFileSync(path.join(msgsDir, 'en.json'), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(msgsDir, `${locale}.json`), 'utf8'));
  const enFlat = flatten(en);
  const locFlat = flatten(data);

  const enToKeys: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(enFlat)) {
    if (locFlat[key] === val) {
      if (!enToKeys[val]) enToKeys[val] = [];
      enToKeys[val].push(key);
    }
  }

  const uniqueValues = Object.keys(enToKeys);
  console.log(`  ${uniqueValues.length} unique strings (${Object.values(enToKeys).reduce((a, b) => a + b.length, 0)} key instances)`);

  const BATCH = 40; // Smaller batches for rate limit
  const batches: string[][] = [];
  for (let i = 0; i < uniqueValues.length; i += BATCH) {
    batches.push(uniqueValues.slice(i, i + BATCH));
  }
  console.log(`  ${batches.length} batches of ~${BATCH}`);

  const allTranslations: Record<string, string> = {};
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const translated = await translateBatch(zai, batch, langName, i + 1);
    const count = Object.keys(translated).length;

    if (count === 0) {
      failed++;
      console.log(`  Batch ${i + 1}/${batches.length}: ❌ FAILED`);
    } else {
      for (const [en, loc] of Object.entries(translated)) {
        if (typeof loc === 'string' && loc !== en) allTranslations[en] = loc;
      }
      console.log(`  Batch ${i + 1}/${batches.length}: ✅ ${count}/${batch.length}`);
    }

    // Rate limit: 5 seconds between batches (conservative for rate limits)
    if (i < batches.length - 1) await sleep(5000);
  }

  // Apply
  let applied = 0;
  for (const [enVal, translatedVal] of Object.entries(allTranslations)) {
    for (const key of enToKeys[enVal]) {
      setNested(data, key, translatedVal);
      applied++;
    }
  }

  fs.writeFileSync(path.join(msgsDir, `${locale}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`  Result: ${Object.keys(allTranslations).length} unique -> ${applied} instances (${failed} failed batches)`);

  return { translated: Object.keys(allTranslations).length, failed, total: uniqueValues.length };
}

async function main() {
  const locale = process.argv[2];
  
  console.log('Creating ZAI instance...');
  const zai = await ZAI.create();
  console.log('ZAI ready!');
  
  if (locale) {
    await translateLocale(locale, zai);
  } else {
    const allLocales = Object.keys(LANGUAGE_NAMES);
    for (const loc of allLocales) {
      await translateLocale(loc, zai);
      // Extra delay between locales
      if (loc !== allLocales[allLocales.length - 1]) await sleep(5000);
    }
  }

  // Final status
  console.log('\n========== FINAL STATUS ==========');
  const en = JSON.parse(fs.readFileSync(path.join(msgsDir, 'en.json'), 'utf8'));
  const enFlat = flatten(en);
  for (const [loc, name] of Object.entries(LANGUAGE_NAMES)) {
    const d = JSON.parse(fs.readFileSync(path.join(msgsDir, `${loc}.json`), 'utf8'));
    const lf = flatten(d);
    let same = 0, diff = 0;
    for (const [k, v] of Object.entries(enFlat)) {
      if (lf[k] === v) same++; else diff++;
    }
    console.log(`  ${loc} (${name.padEnd(25)}): ${String(diff).padStart(5)}/${same+diff} = ${((diff/(same+diff))*100).toFixed(1)}%`);
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
