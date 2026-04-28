#!/usr/bin/env node
/**
 * Efficient bulk translator using z-ai-web-dev-sdk directly (no CLI spawning).
 * Processes one namespace at a time with small batches.
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const MSGS_DIR = path.resolve('./src/messages');
const BATCH_SIZE = 8; // Small batches for reliability
const DELAY_MS = 6000; // 6s between batches to avoid rate limiting

const LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'zh', name: 'Chinese', native: '中文' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractJSON(content) {
  if (!content) return null;
  content = content.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(content); } catch { return null; }
}

async function translateBatch(zai, keysObj, lang, attempt = 0) {
  const keyValues = Object.entries(keysObj).map(([k, v]) => `${k}: ${v}`).join('\n');
  
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: `You are a professional translator for a hotel management software (PMS). Return ONLY a valid JSON object with the exact same keys and translated ${lang.name} (${lang.native}) values. No markdown, no explanation, ONLY JSON.` },
        { role: 'user', content: `Translate these ${Object.keys(keysObj).length} English UI strings to ${lang.name} (${lang.native}).
Rules: Return ONLY valid JSON. Keep translations natural and concise for UI. Use formal business tone.
DO NOT translate: proper nouns, brand names, email/URL placeholders, variable refs like {count} {name} {value}, sample names like "John" "Smith".

${keyValues}` }
      ],
      thinking: { type: 'disabled' }
    });
    
    const content = completion.choices?.[0]?.message?.content;
    const result = extractJSON(content);
    if (result && typeof result === 'object' && Object.keys(result).length > 0) return result;
    throw new Error('Empty/invalid JSON');
  } catch (err) {
    if (attempt < 2) {
      await sleep(8000);
      return translateBatch(zai, keysObj, lang, attempt + 1);
    }
    console.error(`      ❌ Failed: ${err.message?.slice(0, 60)}`);
    return {};
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
  const targetNs = args.includes('--ns') ? args[args.indexOf('--ns') + 1] : null;

  const en = JSON.parse(fs.readFileSync(path.join(MSGS_DIR, 'en.json'), 'utf-8'));
  let namespaces = Object.keys(en).filter(k => !k.startsWith('_'));
  if (targetNs) namespaces = [targetNs];
  let languages = [...LANGUAGES];
  if (targetLang) languages = languages.filter(l => l.code === targetLang);

  console.log(`Namespaces: ${namespaces.length}, Languages: ${languages.length}`);
  const zai = await ZAI.create();
  console.log('SDK initialized');

  for (const lang of languages) {
    console.log(`\n🌐 ${lang.name} (${lang.code})`);
    const langFile = path.join(MSGS_DIR, `${lang.code}.json`);
    const langData = JSON.parse(fs.readFileSync(langFile, 'utf-8'));

    for (const ns of namespaces) {
      const enKeys = en[ns] || {};
      const langKeys = langData[ns] || {};
      const toTranslate = {};
      for (const [k, v] of Object.entries(enKeys)) {
        if (langKeys[k] === v || !langKeys[k]) toTranslate[k] = v;
      }
      const count = Object.keys(toTranslate).length;
      if (count === 0) { console.log(`  ✅ ${ns}`); continue; }
      console.log(`  📝 ${ns}: ${count} keys`);

      const entries = Object.entries(toTranslate);
      const allTranslated = {};
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = Object.fromEntries(entries.slice(i, i + BATCH_SIZE));
        const bn = Math.floor(i / BATCH_SIZE) + 1;
        const bt = Math.ceil(entries.length / BATCH_SIZE);
        process.stdout.write(`      [${bn}/${bt}]`);
        const translated = await translateBatch(zai, batch, lang);
        Object.assign(allTranslated, translated);
        process.stdout.write(` ✅\n`);
        if (i + BATCH_SIZE < entries.length) await sleep(DELAY_MS);
      }

      if (!langData[ns]) langData[ns] = {};
      Object.assign(langData[ns], allTranslated);
      fs.writeFileSync(langFile, JSON.stringify(langData, null, 2) + '\n', 'utf-8');
      console.log(`      💾 ${Object.keys(allTranslated).length}/${count} keys saved`);
    }
  }
  console.log('\n✨ Done!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
