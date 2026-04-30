#!/usr/bin/env node
// Batch translation script using z-ai-web-dev-sdk
// Usage: node scripts/translate-locale.mjs <lang_code> <Language Name>
// Example: node scripts/translate-locale.mjs hi "Hindi"

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const TARGET_LANG = process.argv[2];
const TARGET_LANG_NAME = process.argv[3];

if (!TARGET_LANG || !TARGET_LANG_NAME) {
  console.error('Usage: node scripts/translate-locale.mjs <lang_code> <Language Name>');
  process.exit(1);
}

// Skip strings that should remain as-is (codes, acronyms, placeholders, etc.)
const SKIP_PATTERN = /^[A-Z0-9_.@#:\/\-]+$/;
const SKIP_EXACT = new Set([
  // Acronyms and industry terms
  'CRS', 'ADR', 'RevPAR', 'POS', 'OTA', 'KDS', 'API', 'KYC', 'SaaS',
  'IoT', 'SSO', 'AAA', 'WAN', 'LAN', 'WLAN', 'VLAN', 'DNS', 'NAT',
  'DHCP', 'MAC', 'SSID', 'RADIUS', 'CoA', 'QoS', 'HTTPS', 'HTTP',
  'TCP', 'UDP', 'IP', 'IPv4', 'IPv6', 'FTP', 'SSH', 'SSL', 'TLS',
  'CSV', 'PDF', 'BI', 'AI', 'GPS', 'QR', 'PMS',
  // Units
  'Mbps', 'Kbps', 'MB', 'KB', 'GB', 'TB', 'ms', 's', 'min', 'hr',
  // Common unchanged
  '%', '#', 'N/A', 'TBD', 'T&C', 'FAQ',
]);

function shouldSkip(value) {
  const v = value.trim();
  if (!v || v.length <= 1) return true;
  if (SKIP_PATTERN.test(v)) return true;
  if (SKIP_EXACT.has(v)) return true;
  // Pure numbers with optional units
  if (/^\d+(\.\d+)?\s*(%|px|rem|em|ms|s|min|hr|MB|KB|GB|Mbps|Kbps)?$/.test(v)) return true;
  // HTML-like tags or placeholders
  if (/^<.*>/.test(v)) return true;
  // Pure special chars
  if (/^[^\w]+$/.test(v)) return true;
  // Very short codes like "en", "fr", "de"
  if (/^[a-z]{2}$/.test(v)) return true;
  return false;
}

function flatten(d, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') result[key] = v;
    else if (typeof v === 'object' && v !== null) Object.assign(result, flatten(v, key));
  }
  return result;
}

function unflatten(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

async function translate() {
  console.log(`\n🔄 Translating ${TARGET_LANG_NAME} (${TARGET_LANG})...`);
  
  const enFlat = JSON.parse(fs.readFileSync('/tmp/en_flat.json', 'utf-8'));
  const locale = JSON.parse(fs.readFileSync(`src/messages/${TARGET_LANG}.json`, 'utf-8'));
  const locFlat = flatten(locale);
  
  // Find keys where locale value still matches English
  const englishKeys = Object.entries(enFlat)
    .filter(([k, v]) => locFlat[k] === v && !shouldSkip(v))
    .map(([k, v]) => [k, v]);
  
  console.log(`  Found ${englishKeys.length} English values to translate (skipped ${Object.entries(enFlat).filter(([k, v]) => locFlat[k] === v && shouldSkip(v)).length} codes/acronyms)`);
  
  if (englishKeys.length === 0) {
    console.log(`  ✅ ${TARGET_LANG} is already 100% translated!`);
    return;
  }
  
  const BATCH_SIZE = 100;
  const batches = [];
  for (let i = 0; i < englishKeys.length; i += BATCH_SIZE) {
    batches.push(englishKeys.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`  Processing ${batches.length} batches of ~${BATCH_SIZE} keys...`);
  
  const zai = await ZAI.create();
  let totalTranslated = 0;
  
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const inputObj = Object.fromEntries(batch);
    
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional ${TARGET_LANG_NAME} translator for a hotel/hospitality management system called StaySuite. Rules:
1. Translate JSON values to natural ${TARGET_LANG_NAME}. Use polite/formal tone.
2. Keep JSON keys EXACTLY as provided - do NOT change any keys.
3. Keep industry acronyms as-is: CRS, ADR, RevPAR, POS, OTA, API, KYC, SaaS, IoT, SSO, WiFi, RADIUS, VLAN, DHCP, DNS, NAT, QoS, CoA, MAC, SSID, WAN, LAN, WLAN, GPS, QR, PMS, AI, BI.
4. Keep technical terms as-is: Mbps, Kbps, MB, KB, GB, IP, IPv4, IPv6, TCP, UDP, HTTP, HTTPS, SSH, SSL, TLS, CSV, PDF.
5. Do NOT add any explanation, commentary, or markdown fences.
6. Return ONLY valid JSON (the exact same keys, translated values).
7. For placeholder values like {count}, {name}, {date} etc., keep them in the translated string.
8. Keep proper nouns (MikroTik, Cisco, Aruba, Ubiquiti, etc.) as-is.`
          },
          {
            role: 'user',
            content: `Translate these ${TARGET_LANG_NAME} strings for StaySuite HospitalityOS. Return valid JSON only:\n\n${JSON.stringify(inputObj, null, 0)}`
          }
        ],
        thinking: { type: 'disabled' }
      });
      
      let responseText = completion.choices[0]?.message?.content || '';
      // Strip markdown fences if present
      responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      
      const translated = JSON.parse(responseText);
      
      // Merge translations back into locale flat map
      for (const [key, value] of Object.entries(translated)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          locFlat[key] = value;
          totalTranslated++;
        }
      }
      
      if ((b + 1) % 5 === 0 || b === batches.length - 1) {
        console.log(`  Batch ${b + 1}/${batches.length} done (${totalTranslated} translations so far)`);
      }
    } catch (err) {
      console.error(`  ❌ Batch ${b + 1} failed: ${err.message}`);
      // Retry once
      try {
        console.log(`  Retrying batch ${b + 1}...`);
        await new Promise(r => setTimeout(r, 2000));
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional ${TARGET_LANG_NAME} translator. Translate JSON values. Keep keys exact. Return valid JSON only. No markdown.`
            },
            {
              role: 'user',
              content: JSON.stringify(inputObj)
            }
          ],
          thinking: { type: 'disabled' }
        });
        let rt = (completion.choices[0]?.message?.content || '').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const translated = JSON.parse(rt);
        for (const [key, value] of Object.entries(translated)) {
          if (typeof value === 'string' && value.trim().length > 0) {
            locFlat[key] = value;
            totalTranslated++;
          }
        }
        console.log(`  Batch ${b + 1} retry succeeded`);
      } catch (retryErr) {
        console.error(`  Batch ${b + 1} retry also failed, skipping ${batch.length} keys`);
      }
    }
    
    // Small delay between batches to avoid rate limits
    if (b < batches.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Unflatten and write back
  const updated = unflatten(locFlat);
  fs.writeFileSync(`src/messages/${TARGET_LANG}.json`, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  
  // Verify
  const verify = JSON.parse(fs.readFileSync(`src/messages/${TARGET_LANG}.json`, 'utf-8'));
  const verifyFlat = flatten(verify);
  const remaining = Object.entries(enFlat).filter(([k, v]) => verifyFlat[k] === v && !shouldSkip(v));
  
  console.log(`\n  ✅ ${TARGET_LANG} complete: ${totalTranslated} translated, ${remaining.length} English values remaining (codes/acronyms)`);
  if (remaining.length > 0 && remaining.length < 50) {
    console.log(`  Remaining: ${remaining.map(([k]) => k).join(', ')}`);
  }
}

translate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
