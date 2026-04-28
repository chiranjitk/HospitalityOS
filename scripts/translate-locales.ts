// @ts-nocheck
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

// Force GC if available (run with --expose-gc)
function forceGC() {
  if (global.gc) {
    global.gc();
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', es: 'Spanish',
  fr: 'French', gu: 'Gujarati', hi: 'Hindi', ja: 'Japanese',
  ml: 'Malayalam', mr: 'Marathi', pt: 'Portuguese', ta: 'Tamil',
  te: 'Telugu', zh: 'Chinese (Simplified)'
};

async function translateBatch(zai: any, keys: { key: string; en: string }[], targetLang: string, langName: string): Promise<Record<string, string>> {
  const systemPrompt = `You are a professional translator for a hotel/hospitality management system (StaySuite Hospitality OS). Translate the following English strings to ${langName}.
Rules:
- Keep UI labels concise (hotel staff dashboard, not tourist-facing)
- Keep technical terms, brand names, and abbreviations in English (e.g., API, WiFi, POS, KPI, RevPAR, ADR, CRS, OTA, KYC, GDPR, SaaS, SSO, MFA, DNS, DHCP, RADIUS)
- Keep proper nouns in English (e.g., Monday, Tuesday, etc. can be translated, but module names should match standard conventions)
- For plural ICU patterns like "{count, plural, one {# item} other {# items}}", translate the text parts but keep the ICU syntax exactly intact
- For placeholder patterns like "{value}", "{name}", "{count}", "{date}", "{email}" etc., keep the placeholder syntax intact
- Return ONLY a valid JSON object mapping English strings to translated strings
- Do NOT include any explanation, markdown, or code fences - ONLY the JSON object
- Be consistent with terminology throughout`;

  const userMessage = JSON.stringify(Object.fromEntries(keys.map(k => [k.en, k.en])), null, 0);

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: `Translate these ${keys.length} strings to ${langName}:\n${userMessage}` }
      ],
      thinking: { type: 'disabled' }
    });

    let response = completion.choices[0]?.message?.content || '';
    // Strip markdown code fences if present
    response = response.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(response);
    return parsed;
  } catch (err: any) {
    console.error(`  Batch translation error for ${targetLang}:`, err.message);
    return {};
  }
}

async function main() {
  const targetLocale = process.argv[2];
  if (!targetLocale) {
    console.error('Usage: npx tsx scripts/translate-locales.ts <locale>');
    process.exit(1);
  }

  const langName = LANGUAGE_NAMES[targetLocale];
  if (!langName) {
    console.error(`Unknown locale: ${targetLocale}`);
    process.exit(1);
  }

  console.log(`Translating ${targetLocale} (${langName})...`);

  // Read English
  const en = JSON.parse(fs.readFileSync('src/messages/en.json', 'utf8'));
  const data = JSON.parse(fs.readFileSync(`src/messages/${targetLocale}.json`, 'utf8'));

  // Flatten both
  function flatten(obj: any, prefix = ''): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) Object.assign(map, flatten(v, fullKey));
      else map[fullKey] = v;
    }
    return map;
  }
  const enFlat = flatten(en);
  const locFlat = flatten(data);

  // Find keys needing translation
  const needTranslation: { key: string; en: string }[] = [];
  for (const [key, val] of Object.entries(enFlat)) {
    if (locFlat[key] === val) {
      needTranslation.push({ key, en: val });
    }
  }

  console.log(`  Need to translate ${needTranslation.length} keys`);

  // Batch into groups of 80 (to stay within token limits)
  const BATCH_SIZE = 80;
  const batches: { key: string; en: string }[][] = [];
  for (let i = 0; i < needTranslation.length; i += BATCH_SIZE) {
    batches.push(needTranslation.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Processing ${batches.length} batches...`);

  const zai = await ZAI.create();
  const allTranslations: Record<string, string> = {};
  let failedBatches = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const translated = await translateBatch(zai, batch, targetLocale, langName);
    const translatedCount = Object.keys(translated).length;

    if (translatedCount === 0) {
      failedBatches++;
      console.log(`  Batch ${i + 1}/${batches.length}: FAILED (0 translations)`);
    } else {
      console.log(`  Batch ${i + 1}/${batches.length}: ${translatedCount}/${batch.length} translated`);
    }

    // Map back to keys
    for (const item of batch) {
      if (translated[item.en]) {
        allTranslations[item.key] = translated[item.en];
      }
    }

    // Force garbage collection to prevent OOM
    forceGC();

    // Incremental save every 5 batches to preserve progress
    if ((i + 1) % 5 === 0) {
      const dataCopy = JSON.parse(fs.readFileSync(`src/messages/${targetLocale}.json`, 'utf8'));
      for (const [key, value] of Object.entries(allTranslations)) {
        const parts = key.split('.');
        let current = dataCopy;
        for (let j = 0; j < parts.length - 1; j++) {
          if (!current[parts[j]]) current[parts[j]] = {};
          current = current[parts[j]];
        }
        current[parts[parts.length - 1]] = value;
      }
      fs.writeFileSync(`src/messages/${targetLocale}.json`, JSON.stringify(dataCopy, null, 2) + '\n');
      console.log(`  [Incremental save: ${Object.keys(allTranslations).length} keys written]`);
    }

    // Small delay to avoid rate limiting
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`  Translation complete: ${Object.keys(allTranslations).length} keys translated, ${failedBatches} failed batches`);

  // Apply translations to the locale file
  function setNestedValue(obj: any, keyPath: string, value: string) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  for (const [key, value] of Object.entries(allTranslations)) {
    setNestedValue(data, key, value);
  }

  fs.writeFileSync(`src/messages/${targetLocale}.json`, JSON.stringify(data, null, 2) + '\n');
  console.log(`  Saved to src/messages/${targetLocale}.json`);
}

main().catch(console.error);
