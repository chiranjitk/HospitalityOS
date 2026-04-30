// Process multiple chunks for one language
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];
const START = parseInt(process.argv[4]) || 0;
const COUNT = parseInt(process.argv[5]) || 8;

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
function deepSet(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const chunks = JSON.parse(fs.readFileSync(`/tmp/${LANG}_chunks.json`, 'utf-8'));
const end = Math.min(START + COUNT, chunks.length);

async function callLLM(zai, obj) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const c = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: `Translate JSON values to ${LANG_NAME}. Keep keys exact. Return ONLY the JSON object, nothing else. No markdown. No explanation.` },
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
      if (attempt === 2 && Object.keys(obj).length > 5) {
        const entries = Object.entries(obj);
        const half = Math.ceil(entries.length / 2);
        const r1 = await callLLM(zai, Object.fromEntries(entries.slice(0, half)));
        const r2 = await callLLM(zai, Object.fromEntries(entries.slice(half)));
        return { ...r1, ...r2 };
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return {};
}

async function main() {
  const zai = await ZAI.create();
  const locale = JSON.parse(fs.readFileSync(`src/messages/${LANG}.json`, 'utf-8'));
  let total = 0;

  for (let i = START; i < end; i++) {
    const result = await callLLM(zai, chunks[i]);
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string' && v.trim()) deepSet(locale, k, v);
    }
    total += Object.keys(result).length;
    console.error(`${LANG}[${i + 1}/${chunks.length}] +${Object.keys(result).length}`);
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync(`src/messages/${LANG}.json`, JSON.stringify(locale, null, 2) + '\n', 'utf-8');
  console.error(`${LANG}: chunks ${START}-${end - 1} done (${total} keys)`);
}

main().catch(e => console.error('FATAL:', e.message));
