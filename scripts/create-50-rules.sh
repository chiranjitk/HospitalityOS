#!/bin/bash
# Create 50 firewall rules of all different types
# POST to /api/wifi/firewall/gui-rules

API="http://localhost:3000/api/wifi/firewall/gui-rules"

create_rule() {
  local name="$1" chain="$2" protocol="$3" src_ip="$4" dst_ip="$5" src_port="$6" dst_port="$7" action="$8" comment="$9" proxy_to="${10}" priority="${11}"
  
  local body=$(cat <<EOF
{
  "name": "$name",
  "chain": "$chain",
  "protocol": "$protocol",
  "sourceIp": "$src_ip",
  "destIp": "$dst_ip",
  "sourcePort": "$src_port",
  "sourcePortType": "include",
  "destPort": "$dst_port",
  "destPortType": "include",
  "action": "$action",
  "comment": "$comment",
  "enabled": true,
  "priority": $priority
EOF
)
  # Add proxyTo if provided
  if [ -n "$proxy_to" ]; then
    body="$body, \"proxyTo\": \"$proxy_to\""
  fi
  body="$body }"

  echo "Creating: [$priority] $name ($action)..."
  local resp=$(curl -s -w "\n%{http_code}" -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body_resp=$(echo "$resp" | head -n -1)
  
  if [ "$code" = "201" ]; then
    echo "  -> OK (201)"
  else
    echo "  -> ERROR ($code): $(echo "$body_resp" | head -c 200)"
  fi
}

echo "=== Creating 50 Firewall Rules ==="
echo ""

# ═══════════════════════════════════════════════
# ACCEPT RULES (10) — uplink + downlink expansion
# ═══════════════════════════════════════════════
echo "--- ACCEPT Rules (10) ---"

create_rule "Accept HTTPS to Google" "firewallchains" "tcp" "" "" "" "443" "accept" "Allow HTTPS to Google" "" 10
create_rule "Accept DNS UDP" "firewallchains" "udp" "" "" "" "53" "accept" "Allow DNS resolution UDP" "" 20
create_rule "Accept DNS TCP" "firewallchains" "tcp" "" "" "" "53" "accept" "Allow DNS resolution TCP fallback" "" 30
create_rule "Accept NTP" "firewallchains" "udp" "" "" "" "123" "accept" "Allow NTP time sync" "" 40
create_rule "Accept DHCP" "firewallchains" "udp" "" "" "" "67,68" "accept" "Allow DHCP client requests" "" 50
create_rule "Accept HTTP from guest subnet" "firewallchains" "tcp" "10.10.30.0/24" "" "" "80" "accept" "Allow HTTP from guest VLAN" "" 60
create_rule "Accept ICMP echo" "firewallchains" "icmp" "" "" "" "" "accept" "Allow ping" "" 70
create_rule "Accept SMTP" "firewallchains" "tcp" "" "10.0.1.100" "" "25,587" "accept" "Allow email relay" "" 80
create_rule "Accept RADIUS auth" "firewallchains" "udp" "" "" "" "1812" "accept" "Allow RADIUS authentication" "" 90
create_rule "Allow PMS Access TCP" "firewallchains" "tcp" "" "10.0.1.50" "" "5432" "accept" "Property Management System" "" 100

# ═══════════════════════════════════════════════
# DROP RULES (10) — uplink + downlink expansion
# ═══════════════════════════════════════════════
echo ""
echo "--- DROP Rules (10) ---"

create_rule "Drop Facebook HTTPS" "firewallchains" "tcp" "" "31.13.24.0/21" "" "443" "drop" "Block Facebook main range" "" 110
create_rule "Drop Instagram HTTPS" "firewallchains" "tcp" "" "31.13.24.0/21" "" "443" "drop" "Block Instagram (FB infra)" "" 120
create_rule "Drop Twitter/X" "firewallchains" "tcp" "" "104.244.42.0/21" "" "443" "drop" "Block Twitter/X range" "" 130
create_rule "Drop TikTok CDN" "firewallchains" "tcp" "" "162.125.80.0/20" "" "443" "drop" "Block TikTok CDN range" "" 140
create_rule "Drop Torrent ports" "firewallchains" "tcp" "" "" "" "6881-6999" "drop" "Block BitTorrent ports" "" 150
create_rule "Drop Telnet" "firewallchains" "tcp" "" "" "" "23" "drop" "Block insecure Telnet" "" 160
create_rule "Drop FTP" "firewallchains" "tcp" "" "" "" "21" "drop" "Block FTP access" "" 170
create_rule "Drop SMB from guests" "firewallchains" "tcp" "10.10.30.0/24" "" "" "445,139" "drop" "Block SMB file sharing" "" 180
create_rule "Drop All from blocked IP" "firewallchains" "all" "192.168.100.50" "" "" "" "drop" "Block known malicious host" "" 190
create_rule "Drop port 0" "firewallchains" "tcp" "" "" "" "0" "drop" "Block illegal port 0" "" 200

# ═══════════════════════════════════════════════
# REJECT RULES (5) — uplink + downlink expansion
# ═══════════════════════════════════════════════
echo ""
echo "--- REJECT Rules (5) ---"

create_rule "Reject SSH from guest" "firewallchains" "tcp" "10.10.30.0/24" "" "" "22" "reject" "Reject SSH attempts from guests" "" 210
create_rule "Reject MySQL direct" "firewallchains" "tcp" "10.10.30.0/24" "" "" "3306" "reject" "Reject direct DB access" "" 220
create_rule "Reject Redis" "firewallchains" "tcp" "10.10.30.0/24" "" "" "6379" "reject" "Reject Redis port access" "" 230
create_rule "Reject MongoDB" "firewallchains" "tcp" "10.10.30.0/24" "" "" "27017" "reject" "Reject MongoDB access" "" 240
create_rule "Reject SNMP" "firewallchains" "udp" "10.10.30.0/24" "" "" "161,162" "reject" "Reject SNMP polling" "" 250

# ═══════════════════════════════════════════════
# LOG RULES (3) — uplink + downlink expansion
# ═══════════════════════════════════════════════
echo ""
echo "--- LOG Rules (3) ---"

create_rule "Log SSH attempts" "firewallchains" "tcp" "" "" "" "22" "log" "Log all SSH connection attempts" "" 260
create_rule "Log DNS queries" "firewallchains" "udp" "" "" "" "53" "log" "Log DNS resolution requests" "" 270
create_rule "Log HTTP traffic" "firewallchains" "tcp" "" "" "" "80" "log" "Log unencrypted HTTP connections" "" 280

# ═══════════════════════════════════════════════
# PROXY RULES (2) — uplink + downlink + NAT post
# ═══════════════════════════════════════════════
echo ""
echo "--- PROXY Rules (2) ---"

create_rule "Proxy captive portal bypass" "firewallchains" "tcp" "10.10.30.0/24" "10.0.0.1" "" "80,443" "proxy" "Captive portal traffic via proxy" "10.0.0.1:3128" 290
create_rule "Proxy authenticated users" "firewallchains" "tcp" "10.10.30.0/24" "" "" "80" "proxy" "Authenticated user HTTP proxy" "127.0.0.1:8080" 300

# ═══════════════════════════════════════════════
# DNAT RULES (5) — NAT prerouting only
# ═══════════════════════════════════════════════
echo ""
echo "--- DNAT Rules (5) ---"

create_rule "DNAT RDP to management" "frchainspre" "tcp" "" "" "" "3389" "dnat" "Remote Desktop forwarding" "" 310
create_rule "DNAT SSH to server" "frchainspre" "tcp" "" "" "" "2222" "dnat" "SSH port forwarding" "" 320
create_rule "DNAT HTTPS to webmail" "frchainspre" "tcp" "" "" "" "8443" "dnat" "Webmail HTTPS forwarding" "" 330
create_rule "DNAT MQTT to IoT broker" "frchainspre" "tcp" "" "" "" "8883" "dnat" "MQTT TLS forwarding to IoT" "" 340
create_rule "DNAT RTSP to CCTV" "frchainspre" "tcp" "" "" "" "554" "dnat" "RTSP CCTV stream forwarding" "" 350

# ═══════════════════════════════════════════════
# MASQUERADE RULES (3) — NAT postrouting only
# ═══════════════════════════════════════════════
echo ""
echo "--- MASQUERADE Rules (3) ---"

create_rule "Masquerade guest VLAN" "frchainspost" "all" "10.10.30.0/24" "" "" "" "masquerade" "NAT masquerade for guest subnet" "" 360
create_rule "Masquerade IoT VLAN" "frchainspost" "all" "10.10.40.0/24" "" "" "" "masquerade" "NAT masquerade for IoT subnet" "" 370
create_rule "Masquerade staff VLAN" "frchainspost" "all" "10.10.20.0/24" "" "" "" "masquerade" "NAT masquerade for staff subnet" "" 380

# ═══════════════════════════════════════════════
# MARK/QoS RULES (5) — uplink + downlink expansion
# ═══════════════════════════════════════════════
echo ""
echo "--- MARK/QoS Rules (5) ---"

create_rule "Mark VoIP SIP high priority" "firewallchains" "udp" "" "" "" "5060" "mark" "SIP signaling high QoS" "" 390
create_rule "Mark VoIP RTP high priority" "firewallchains" "udp" "" "" "" "10000-20000" "mark" "RTP media high QoS" "" 400
create_rule "Mark guest bulk low priority" "firewallchains" "tcp" "10.10.30.0/24" "" "" "80,443" "mark" "Guest HTTP/HTTPS bulk traffic" "" 410
create_rule "Mark management critical" "firewallchains" "tcp" "10.10.20.0/24" "" "" "" "mark" "Management subnet critical priority" "" 420
create_rule "Mark IoT normal priority" "firewallchains" "tcp" "10.10.40.0/24" "" "" "1883,8883" "mark" "IoT MQTT normal priority" "" 430

# ═══════════════════════════════════════════════
# DOMAIN RULES (4) — DNS resolved + set-based
# ═══════════════════════════════════════════════
echo ""
echo "--- DOMAIN Rules (4) ---"

create_rule "Accept google.com" "firewallchains" "tcp" "" "google.com" "" "443" "accept" "Allow Google HTTPS" "" 440
create_rule "Drop facebook.com" "firewallchains" "tcp" "" "facebook.com" "" "443" "drop" "Block Facebook domain" "" 450
create_rule "Accept whatsapp.com" "firewallchains" "tcp" "" "whatsapp.com" "" "443" "accept" "Allow WhatsApp Web" "" 460
create_rule "Drop tiktok.com" "firewallchains" "tcp" "" "tiktok.com" "" "443" "drop" "Block TikTok domain" "" 470

# ═══════════════════════════════════════════════
# SNAT RULES (3) — NAT postrouting only
# ═══════════════════════════════════════════════
echo ""
echo "--- SNAT Rules (3) ---"

# Note: SNAT uses same chain as masquerade. The action field determines behavior.
# We use masquerade action but label them SNAT-style for demonstration.
create_rule "SNAT guest to public IP" "frchainspost" "all" "10.10.30.0/24" "" "" "" "masquerade" "Source NAT guest to WAN IP" "" 480
create_rule "Masquerade VIP lounge" "frchainspost" "all" "10.10.50.0/24" "" "" "" "masquerade" "VIP lounge NAT" "" 490
create_rule "Masquerade conference WiFi" "frchainspost" "all" "10.10.60.0/24" "" "" "" "masquerade" "Conference room WiFi NAT" "" 500

echo ""
echo "=== Done Creating Rules ==="
echo ""
echo "Verifying total count..."
curl -s "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rules = d.get('data', [])
print(f'Total rules in DB: {len(rules)}')
actions = {}
for r in rules:
    a = r.get('action', 'unknown')
    actions[a] = actions.get(a, 0) + 1
print(f'By action type:')
for a, c in sorted(actions.items()):
    print(f'  {a}: {c}')
chains = {}
for r in rules:
    c = r.get('chain', 'unknown')
    chains[c] = chains.get(c, 0) + 1
print(f'By chain:')
for c, cnt in sorted(chains.items()):
    print(f'  {c}: {cnt}')
"
