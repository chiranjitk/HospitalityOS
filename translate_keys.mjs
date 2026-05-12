import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const MSGS_DIR = './src/messages';

// Languages to translate
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

async function translateBatch(zai, keys, lang) {
  const keyValues = Object.entries(keys).map(([k, v]) => `${k}: ${v}`).join('\n');
  
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `You are a professional translator for a hospitality management software (hotel PMS). Translate the following English UI strings to ${lang.name} (${lang.native}).
Rules:
- Return ONLY a valid JSON object with the same keys and translated values
- Do NOT translate proper nouns, brand names, technical terms, API references, or placeholder text like "John", "Smith", "email@example.com", "https://..."
- Do NOT translate variable references like {count}, {name}, {value}, etc.
- Do NOT translate HTML tags or CSS class names
- Keep translations natural and concise for UI labels
- Use formal/professional tone appropriate for business software
- Preserve any special formatting, punctuation, or symbols
- The output must be ONLY the JSON object, no other text`
      },
      {
        role: 'user',
        content: keyValues
      }
    ],
    thinking: { type: 'disabled' }
  });

  const response = completion.choices[0]?.message?.content;
  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`Failed to parse JSON for ${lang.code}`);
    return {};
  }
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const zai = await ZAI.create();
  
  // Read English source
  const en = JSON.parse(fs.readFileSync(path.join(MSGS_DIR, 'en.json'), 'utf-8'));
  
  // Namespaces to process (those with many English copies)
  const namespacesToProcess = Object.keys(en).filter(k => !k.startsWith('_'));
  
  for (const lang of LANGUAGES) {
    console.log(`\n=== Translating to ${lang.name} (${lang.code}) ===`);
    const langFile = path.join(MSGS_DIR, `${lang.code}.json`);
    const langData = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
    
    for (const ns of namespacesToProcess) {
      const enKeys = en[ns];
      const langKeys = langData[ns] || {};
      
      // Find keys that are still English copies
      const toTranslate = {};
      for (const [k, v] of Object.entries(enKeys)) {
        if (langKeys[k] === v || !langKeys[k]) {
          toTranslate[k] = v;
        }
      }
      
      if (Object.keys(toTranslate).length === 0) {
        console.log(`  ${ns}: ✅ all translated`);
        continue;
      }
      
      console.log(`  ${ns}: translating ${Object.keys(toTranslate).length} keys...`);
      
      try {
        // Process in batches of 30 keys max
        const allKeys = Object.entries(toTranslate);
        const batchSize = 30;
        const translated = {};
        
        for (let i = 0; i < allKeys.length; i += batchSize) {
          const batch = Object.fromEntries(allKeys.slice(i, i + batchSize));
          const batchResult = await translateBatch(zai, batch, lang);
          Object.assign(translated, batchResult);
          
          // Small delay to avoid rate limiting
          if (i + batchSize < allKeys.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
        
        // Update locale data
        if (!langData[ns]) langData[ns] = {};
        Object.assign(langData[ns], translated);
        
        console.log(`  ${ns}: ✅ translated ${Object.keys(translated).length} keys`);
      } catch (err) {
        console.error(`  ${ns}: ❌ error - ${err.message}`);
      }
    }
    
    // Write updated locale file
    fs.writeFileSync(langFile, JSON.stringify(langData, null, 2), 'utf-8');
    console.log(`  → Saved ${langFile}`);
  }
  
  console.log('\n=== Translation complete! ===');
}

main().catch(console.error);
