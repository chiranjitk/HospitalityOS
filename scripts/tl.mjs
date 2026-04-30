import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const LANG = process.argv[2];
const LANG_NAME = process.argv[3];
const INPUT = process.argv[4];
const OUTPUT = process.argv[5];

const sysPrompt = `Professional ${LANG_NAME} translator for StaySuite HospitalityOS hotel management system. 
Rules:
1. Translate ALL JSON values to natural, formal ${LANG_NAME}.
2. Keep ALL JSON keys EXACTLY as provided - do NOT modify any keys.
3. Return ONLY valid JSON. No markdown fences, no commentary.
4. Keep industry terms as-is: CRS, ADR, RevPAR, POS, OTA, API, WiFi, RADIUS, VLAN, DHCP, DNS, NAT, QoS, MAC, SSID, WAN, LAN, WLAN, GPS, QR, PMS, AI, BI, Mbps, Kbps, MB, KB, GB, IP, TCP, UDP, HTTP, HTTPS, MikroTik, Cisco, Aruba, Ubiquiti.
5. Keep {placeholders} like {count}, {name}, {date} unchanged in the translated string.
6. Use formal/polite tone appropriate for business software.`;

async function translate() {
  const zai = await ZAI.create();
  const chunk = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  
  const c = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: JSON.stringify(chunk) }
    ],
    thinking: { type: 'disabled' }
  });
  
  let text = (c.choices[0]?.message?.content || '').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const parsed = JSON.parse(text);
  
  fs.writeFileSync(OUTPUT, JSON.stringify(parsed, null, 0));
  console.log(`OK: ${Object.keys(parsed).length} keys`);
}

translate().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
