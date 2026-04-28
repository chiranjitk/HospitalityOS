import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const msgsDir = path.join(process.cwd(), 'src', 'messages');

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', es: 'Spanish',
  fr: 'French', gu: 'Gujarati', hi: 'Hindi', ja: 'Japanese',
  ml: 'Malayalam', mr: 'Marathi', pt: 'Portuguese-Brazilian', ta: 'Tamil',
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

async function translateBatch(zai: any, values: string[], langName: string): Promise<Record<string, string>> {
  const inputObj: Record<string, string> = {};
  for (const v of values) inputObj[v] = v;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: `You are a professional translator for StaySuite, a hotel/hospitality management system. Translate English strings to ${langName}.
Rules:
- Keep UI labels concise (hotel staff dashboard, not tourist-facing)
- Keep technical terms in English: API, WiFi, POS, KPI, RevPAR, ADR, CRS, OTA, KYC, GDPR, SaaS, SSO, MFA, DNS, DHCP, RADIUS, CSV, JSON, PDF, XSS, SQL
- Keep ICU patterns like "{count, plural, one {# item} other {# items}}" exactly intact including all braces and syntax
- Keep {placeholder} syntax like {value}, {name}, {count}, {date} exactly intact
- Keep proper English brand names: Lucide, shadcn, Tailwind, NextAuth, Prisma
- For form labels, use concise professional language
- Return ONLY valid JSON object mapping English to translated, no markdown, no explanation` },
          { role: 'user', content: JSON.stringify(inputObj) }
        ],
        thinking: { type: 'disabled' }
      });

      let response = completion.choices[0]?.message?.content || '';
      response = response.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      return JSON.parse(response);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log(`      Attempt ${attempt} failed: ${msg.slice(0, 120)}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
  return {};
}

async function translateLocale(locale: string) {
  const langName = LANGUAGE_NAMES[locale];
  console.log(`\n========== Translating ${locale} (${langName}) ==========`);

  const en = JSON.parse(fs.readFileSync(path.join(msgsDir, 'en.json'), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(msgsDir, `${locale}.json`), 'utf8'));
  const enFlat = flatten(en);
  const locFlat = flatten(data);

  // Find English-only values, deduplicate
  const enToKeys: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(enFlat)) {
    if (locFlat[key] === val) {
      if (!enToKeys[val]) enToKeys[val] = [];
      enToKeys[val].push(key);
    }
  }

  const uniqueValues = Object.keys(enToKeys);
  console.log(`  ${uniqueValues.length} unique strings to translate (mapping to ${Object.keys(enFlat).length - Object.keys(locFlat).filter(k => locFlat[k] !== enFlat[k]).length} keys)`);

  // Batch into groups of 50 (conservative for quality)
  const BATCH = 50;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueValues.length; i += BATCH) {
    batches.push(uniqueValues.slice(i, i + BATCH));
  }
  console.log(`  ${batches.length} batches of ~${BATCH}`);

  const zai = await ZAI.create();
  const allTranslations: Record<string, string> = {};
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const translated = await translateBatch(zai, batch, langName);
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

    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  // Apply translations
  let applied = 0;
  for (const [enVal, translatedVal] of Object.entries(allTranslations)) {
    for (const key of enToKeys[enVal]) {
      setNested(data, key, translatedVal);
      applied++;
    }
  }

  fs.writeFileSync(path.join(msgsDir, `${locale}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`  Result: ${Object.keys(allTranslations).length} unique translations applied to ${applied} key instances`);
  if (failed > 0) console.log(`  ⚠️  ${failed} batches failed`);
}

// Main
async function main() {
  const locale = process.argv[2];
  if (!locale) {
    const allLocales = Object.keys(LANGUAGE_NAMES);
    console.log(`Translating all ${allLocales.length} locales...`);
    for (const loc of allLocales) {
      await translateLocale(loc);
    }
  } else {
    await translateLocale(locale);
  }
}
main();

// Final status
console.log('\n========== FINAL STATUS ==========');
const en2 = JSON.parse(fs.readFileSync(path.join(msgsDir, 'en.json'), 'utf8'));
const enFlat2 = flatten(en2);

for (const [loc, name] of Object.entries(LANGUAGE_NAMES)) {
  const data2 = JSON.parse(fs.readFileSync(path.join(msgsDir, `${loc}.json`), 'utf8'));
  const locFlat2 = flatten(data2);
  let same = 0, diff = 0;
  for (const [k, v] of Object.entries(enFlat2)) {
    if (locFlat2[k] === v) same++; else diff++;
  }
  const pct = ((diff / (same + diff)) * 100).toFixed(1);
  console.log(`  ${loc} (${name.padEnd(25)}): ${String(diff).padStart(5)}/${same + diff} = ${pct}%`);
}
