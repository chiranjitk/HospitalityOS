#!/usr/bin/env node
/**
 * Bulk translation script - uses z-ai CLI via stdin to avoid shell escaping issues.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MSGS_DIR = path.resolve('./src/messages');

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
  { code: 'zh', name: 'Chinese Simplified', native: '中文' },
];

function callLLM(systemPrompt, userPrompt) {
  const result = spawnSync('z-ai', ['chat', '--prompt', userPrompt, '--system', systemPrompt], {
    encoding: 'utf-8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`Exit code ${result.status}: ${result.stderr?.slice(0, 200)}`);
  return result.stdout;
}

function extractJSON(text) {
  try {
    // z-ai CLI outputs emoji prefixes before JSON - find the JSON start
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) return null;
    const jsonStr = text.slice(jsonStart);
    const data = JSON.parse(jsonStr);
    let content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    // Strip markdown code fences
    content = content.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

function translateBatch(keysObj, lang) {
  const keyValues = Object.entries(keysObj).map(([k, v]) => `${k}: ${v}`).join('\n');
  const systemPrompt = 'You are a professional translator for a hotel management software (PMS). Return ONLY a valid JSON object with the exact same keys and translated values. No markdown, no explanation.';
  const userPrompt = `Translate these ${Object.keys(keysObj).length} English UI strings to ${lang.name} (${lang.native}).\n\nRules:\n- Return ONLY valid JSON with same keys\n- Keep translations natural and concise for UI\n- Use formal business tone\n- DO NOT translate: proper nouns, brand names, email/URL placeholders, variable refs like {count} {name} {value}\n- DO NOT translate sample data: "John", "Smith", "Grand Hotel", "email@example.com"\n\n${keyValues}`;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = callLLM(systemPrompt, userPrompt);
      const translated = extractJSON(result);
      if (translated && typeof translated === 'object' && Object.keys(translated).length > 0) {
        return translated;
      }
      throw new Error('Empty or invalid JSON');
    } catch (err) {
      if (attempt < 2) {
        console.log(`      ⚠️ Retry ${attempt + 1}: ${err.message.slice(0, 80)}`);
        // Use sync sleep via spawnSync
        spawnSync('sleep', ['3']);
      } else {
        console.log(`      ❌ Failed: ${err.message.slice(0, 80)}`);
        return {};
      }
    }
  }
  return {};
}

async function main() {
  const args = process.argv.slice(2);
  const targetLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
  const targetNs = args.includes('--ns') ? args[args.indexOf('--ns') + 1] : null;

  const en = JSON.parse(fs.readFileSync(path.join(MSGS_DIR, 'en.json'), 'utf-8'));
  let namespaces = Object.keys(en).filter(k => !k.startsWith('_'));
  if (targetNs) namespaces = namespaces.filter(n => n === targetNs);
  let languages = [...LANGUAGES];
  if (targetLang) languages = languages.filter(l => l.code === targetLang);

  console.log(`=== StaySuite Bulk Translation ===`);
  console.log(`Namespaces: ${namespaces.length}, Languages: ${languages.length}`);
  
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
      const batchSize = 10;
      const allTranslated = {};
      
      for (let i = 0; i < entries.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(entries.length / batchSize);
        const batch = Object.fromEntries(entries.slice(i, i + batchSize));
        console.log(`      Batch ${batchNum}/${totalBatches} (${Object.keys(batch).length} keys)`);
        const translated = translateBatch(batch, lang);
        Object.assign(allTranslated, translated);
        if (i + batchSize < entries.length) spawnSync('sleep', ['1']);
      }

      if (!langData[ns]) langData[ns] = {};
      Object.assign(langData[ns], allTranslated);
      console.log(`      ✅ ${Object.keys(allTranslated).length}/${count} keys`);
    }

    fs.writeFileSync(langFile, JSON.stringify(langData, null, 2) + '\n', 'utf-8');
    console.log(`  💾 Saved ${lang.code}.json`);
  }
  console.log('\n✨ Done!');
}

main().catch(console.error);
