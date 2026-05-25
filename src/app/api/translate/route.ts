import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', es: 'Spanish',
  fr: 'French', gu: 'Gujarati', hi: 'Hindi', ja: 'Japanese',
  ml: 'Malayalam', mr: 'Marathi', pt: 'Portuguese-Brazilian', ta: 'Tamil',
  te: 'Telugu', zh: 'Chinese Simplified'
};

// Locale whitelist — only these locales are allowed (prevents path traversal)
const ALLOWED_LOCALES = new Set(Object.keys(LANGUAGE_NAMES));

// Zod schema for request validation
const translateRequestSchema = z.object({
  locale: z.string().min(2).max(10),
  namespace: z.string().max(100).optional().default(''),
});

function flatten(obj: any, prefix = ''): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) Object.assign(map, flatten(v, fullKey));
    else map[fullKey] = v;
  }
  return map;
}

function setNestedValue(obj: any, keyPath: string, value: string) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

async function translateWithRetry(zai: any, messages: any[], retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await zai.chat.completions.create({ messages, thinking: { type: 'disabled' } });
      return completion.choices[0]?.message?.content || null;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log(`    Attempt ${attempt} failed: ${msg.slice(0, 100)}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ctx = await requirePlatformAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  try {
    // Auth check — this route writes files to disk, require authentication
    const user = await getUserFromRequest(req);
    if (!user || !user.isPlatformAdmin) {
      return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = translateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const { locale, namespace } = parsed.data;
  
  // Validate locale against whitelist to prevent path traversal
  if (!ALLOWED_LOCALES.has(locale)) {
    return NextResponse.json({ error: `Unsupported locale: ${locale}` }, { status: 400 });
  }

  const langName = LANGUAGE_NAMES[locale];
  const msgsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'messages');
  
  const en = JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ msgsDir, 'en.json'), 'utf8'));
  const locData = JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ msgsDir, `${locale}.json`), 'utf8'));
  
  const enFlat = flatten(en);
  const locFlat = flatten(locData);
  
  // Find English-only keys in this namespace
  const toTranslate: { key: string; en: string }[] = [];
  const nsPrefix = namespace ? `${namespace}.` : '';
  
  for (const [key, val] of Object.entries(enFlat)) {
    if (nsPrefix && !key.startsWith(nsPrefix)) continue;
    if (locFlat[key] === val) {
      toTranslate.push({ key, en: val });
    }
  }
  
  if (toTranslate.length === 0) {
    return NextResponse.json({ translated: 0, message: 'Nothing to translate' });
  }

  // Deduplicate by value (same English string maps to multiple keys)
  const uniqueValues = [...new Set(toTranslate.map(t => t.en))];
  
  // Batch unique values in groups of 60
  const BATCH = 60;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueValues.length; i += BATCH) {
    batches.push(uniqueValues.slice(i, i + BATCH));
  }

  console.log(`[${locale}/${namespace || 'all'}] Translating ${uniqueValues.length} unique values in ${batches.length} batches`);
  
  const zai = await ZAI.create();
  const valueMap: Record<string, string> = {};
  let failedBatches = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const inputObj: Record<string, string> = {};
    for (const v of batch) inputObj[v] = v;
    
    const response = await translateWithRetry(zai, [
      { role: 'assistant', content: `You are a professional translator for StaySuite, a hotel/hospitality management system. Translate English strings to ${langName}.
Rules:
- Keep UI labels concise (hotel staff dashboard)
- Keep technical terms in English: API, WiFi, POS, KPI, RevPAR, ADR, CRS, OTA, KYC, GDPR, SaaS, SSO, MFA, DNS, DHCP, RADIUS, CSV, JSON, PDF
- Keep ICU patterns like "{count, plural, one {# item} other {# items}}" exactly intact
- Keep {placeholder} syntax intact  
- Return ONLY valid JSON object, no markdown fences, no explanation` },
      { role: 'user', content: JSON.stringify(inputObj) }
    ]);
    
    if (!response) {
      failedBatches++;
      console.log(`    Batch ${i+1}/${batches.length}: FAILED`);
      continue;
    }
    
    let parsed: Record<string, string> = {};
    try {
      let clean = response.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      failedBatches++;
      console.log(`    Batch ${i+1}/${batches.length}: PARSE ERROR`);
      continue;
    }
    
    for (const [enVal, translated] of Object.entries(parsed)) {
      if (typeof translated === 'string' && translated !== enVal) {
        valueMap[enVal] = translated;
      }
    }
    
    console.log(`    Batch ${i+1}/${batches.length}: ${Object.keys(parsed).length} translations`);
    
    // Rate limit delay
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Apply translations back
  let applied = 0;
  for (const item of toTranslate) {
    if (valueMap[item.en]) {
      setNestedValue(locData, item.key, valueMap[item.en]);
      applied++;
    }
  }
  
  fs.writeFileSync(path.join(msgsDir, `${locale}.json`), JSON.stringify(locData, null, 2) + '\n');
  
  return NextResponse.json({
    locale,
    namespace,
    totalKeys: toTranslate.length,
    uniqueValues,
    translatedValues: Object.keys(valueMap).length,
    applied,
    failedBatches,
    batchesProcessed: batches.length
  });
  } catch (error) {
    console.error('[Translate] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to check translation status
export async function GET() {
  const ctx = await requirePlatformAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  const msgsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'messages');
  const en = JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ msgsDir, 'en.json'), 'utf8'));
  const enFlat = flatten(en);
  const locales = Object.keys(LANGUAGE_NAMES);
  
  const status: Record<string, { total: number; translated: number; pct: string }> = {};
  for (const loc of locales) {
    const data = JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ msgsDir, `${loc}.json`), 'utf8'));
    const locFlat = flatten(data);
    let same = 0, diff = 0;
    for (const [k, v] of Object.entries(enFlat)) {
      if (locFlat[k] === v) same++;
      else diff++;
    }
    const total = same + diff;
    status[loc] = { total, translated: diff, pct: ((diff / total) * 100).toFixed(1) };
  }
  
  return NextResponse.json(status);
}
