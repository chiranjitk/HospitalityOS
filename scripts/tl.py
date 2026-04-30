import json, sys, asyncio

async def main():
    from z_ai_web_dev_sdk import create
    zai = await create()
    chunk = json.load(open(sys.argv[1]))
    lang = sys.argv[3]
    lang_name = sys.argv[4]
    
    c = await zai.chat.completions.create(
        messages=[
            {"role": "system", "content": f"Professional {lang_name} translator for StaySuite hotel PMS. Translate JSON values to {lang_name}. Keep keys exact. Return valid JSON only. No markdown fences. Keep acronyms as-is: CRS ADR RevPAR POS OTA API WiFi RADIUS VLAN DHCP DNS NAT QoS MAC SSID WAN LAN WLAN GPS QR PMS AI BI Mbps Kbps MB KB GB IP TCP UDP HTTP HTTPS MikroTik Cisco Aruba Ubiquiti. Keep {{placeholders}} unchanged. Formal/polite tone."},
            {"role": "user", "content": json.dumps(chunk)}
        ],
        thinking={"type": "disabled"}
    )
    text = c.choices[0].message.content.replace('```json', '').replace('```', '').strip()
    parsed = json.loads(text)
    with open(sys.argv[2], 'w') as f:
        json.dump(parsed, f, ensure_ascii=False)
    print(f'OK: {len(parsed)} keys')

asyncio.run(main())
