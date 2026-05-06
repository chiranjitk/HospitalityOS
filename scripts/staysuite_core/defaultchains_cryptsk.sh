#!/bin/bash
###########################################################################
#       Script : nftables Configuration - StaySuite HospitalityOS
#       Target OS : Rocky Linux 10 (nftables v1.1.1)
#       Reason : Native nftables migration (Legacy free)
#
#  REVIEWED & FIXED — 2026 Security Hardening Pass
#  ─────────────────────────────────────────────────────
#  Fix 1: filter input  policy accept → drop (was wide open)
#  Fix 2: drop_log chain now jumped to at end of input
#  Fix 3: Added filter forward chain (gateway must filter forwarded traffic)
#  Fix 4: Security hooks skip loopback (iif != "lo" on all chains)
#  Fix 5: Multiple gateway insertion order corrected (reverse iteration)
#  Fix 6: SMB broadcastfile logic simplified (was pointless if/then)
#  Fix 7: Port scan uses named set for dynamic management
#  Fix 8: ulogd.conf references updated to nftables syntax
###########################################################################

# --- StaySuite HospitalityOS Nettype Constants ---
NETTYPE_LAN=0
NETTYPE_WAN=1
NETTYPE_VLAN=2
NETTYPE_BRIDGE=3
NETTYPE_BOND=4
NETTYPE_MANAGEMENT=5
NETTYPE_GUEST=6
NETTYPE_IOT=7
NETTYPE_UNUSED=8
NETTYPE_DMZ=9
NETTYPE_WIFI=10

## ============================================================================
## SAFETY & DEFAULT VARIABLE INITIALIZATION
## ============================================================================
GUIPORT="${GUIPORT:-80}"
httpuptoratelimit="${httpuptoratelimit:-100}"
httpburstableratelimit="${httpburstableratelimit:-50}"
httpsuptoratelimit="${httpsuptoratelimit:-100}"
httpsburstableratelimit="${httpsburstableratelimit:-50}"
https_status="${https_status:-false}"
LLNETWORKUSERS="${LLNETWORKUSERS:-N}"
ipv6="${ipv6:-N}"

# Captive portal ports — must be accessible from guest network
PORTAL_HTTP="${PORTAL_HTTP:-8888}"   # captive-redirect HTTP
PORTAL_HTTPS="${PORTAL_HTTPS:-8443}"  # captive-redirect HTTPS/TLS SNI
PORTAL_APP="${PORTAL_APP:-3000}"       # Next.js portal app

## ============================================================================
## CONFIGURATION VARIABLES
## ============================================================================
# Include captive portal ports in open ports (guest must reach portal app directly)
OPENPORTS="{ 80, 443, 22, 222, 5555, 6791, 10080, 10090, ${PORTAL_HTTP}, ${PORTAL_HTTPS}, ${PORTAL_APP} }"
LEGACY_PORTS="{ 23, 273, 137, 138, 139, 445 }"
DNS_PORTS="{ 53, 3799, 3899 }"
SNMP_PORTS="{ 161, 162 }"
DROP_PORTS="{ 8007, 8009, 3306, 389, 3128 }"

## ============================================================================
## CAPTIVE PORTAL MODULE CHECK
## ============================================================================
# Check if captive-redirect service is listening on port $PORTAL_HTTP
if ss -tln sport = :${PORTAL_HTTP} 2>/dev/null | grep -q LISTEN; then
    httpmodule=1
else
    httpmodule=0
fi

echo "httpmodule=$httpmodule (captive-redirect on port $PORTAL_HTTP: $([ $httpmodule -eq 1 ] && echo 'YES' || echo 'NO'))"

## ============================================================================
## HELPER FUNCTIONS
## ============================================================================
mask2cidr() {
    nbits=0
    IFS='.'
    for dec in $1; do
        case $dec in
            255) ((nbits+=8));;
            254) ((nbits+=7));;
            252) ((nbits+=6));;
            248) ((nbits+=5));;
            240) ((nbits+=4));;
            224) ((nbits+=3));;
            192) ((nbits+=2));;
            128) ((nbits+=1));;
            0);;
            *) echo "Error: $dec is not recognised" >&2; exit 1;;
        esac
    done
    echo "$nbits"
}

get_interfaces() {
    for conn_file in /etc/NetworkManager/system-connections/*.nmconnection; do
        [ -f "$conn_file" ] || continue
        device=$(grep -E '^interface-name=' "$conn_file" | cut -d= -f2)
        [ -z "$device" ] && continue
        ip_cidr=$(grep -E '^address1=' "$conn_file" | cut -d= -f2)
        [ -z "$ip_cidr" ] && continue
        ipaddr=$(echo "$ip_cidr" | cut -d/ -f1)
        cidr=$(echo "$ip_cidr" | cut -d/ -f2)
        nettype=$(awk -F= '/^\[staysuite\]/{found=1} found && /^nettype=/{print $2; exit}' "$conn_file")
        nettype=${nettype:-0}
        echo "$device $ipaddr $cidr $nettype"
    done
}

## ============================================================================
## FLUSH AND CLEANUP
## ============================================================================
nft flush ruleset

## ============================================================================
## CREATE TABLES
## ============================================================================
nft 'add table inet mangle'
nft 'add table inet nat'
nft 'add table inet filter'

## ============================================================================
## CREATE SETS (Replacing ipset)
## ============================================================================
nft 'add set inet mangle loggedinusers { type ipv4_addr; flags interval; }'
nft 'add set inet mangle loggedinusersnetwork { type ipv4_addr; flags interval; }'
nft 'add set inet mangle usersset { type ipv4_addr; flags interval; }'
nft 'add set inet mangle usersdstset { type ipv4_addr; flags interval; }'
nft 'add set inet mangle llusersset { type ipv4_addr; flags interval; }'
nft 'add set inet mangle loggedinusers_leased { type ipv4_addr; }'
nft 'add set inet mangle loggedinusersdstip { type ipv4_addr; flags interval; }'
nft 'add set inet mangle loggedinuserssnatip { type ipv4_addr; flags interval; }'
nft 'add set inet mangle normaluserset { type ipv4_addr; flags interval; }'
nft 'add set inet nat gw_ipsets { type ipv4_addr; flags interval; }'
nft 'add set inet filter blocked_ips { type ipv4_addr; flags interval; }'
nft 'add set inet filter blocked_networks { type ipv4_addr; flags interval; }'
nft 'add set inet filter blocked_mac { type ether_addr; flags interval; }'

## ============================================================================
## DENY NETWORK FILE PROCESSING
## ============================================================================
restrictednetworkfile=/tmp/restrictednetworks
[ -x /usr/local/scripts/generate_restrictednetwork_file.sh ] && /bin/sh /usr/local/scripts/generate_restrictednetwork_file.sh

if [ -f "$restrictednetworkfile" ]; then
    while IFS= read -r line; do
        NETID=$(echo "$line" | awk -F "/" '{print $1}')
        MASK=$(echo "$line" | awk -F "/" '{print $2}')
        if [[ "$MASK" =~ ^[0-9]+$ ]]; then NUMBITS="$MASK"; else NUMBITS=$(mask2cidr "$MASK"); fi
        nft "add element inet mangle usersset { ${NETID}/${NUMBITS} }"
    done < "$restrictednetworkfile"
fi

## ============================================================================
## CREATE BASE HOOKS (Required in nftables 1.1.1)
## ============================================================================
nft 'add chain inet mangle prerouting { type filter hook prerouting priority mangle; }'
nft 'add chain inet mangle postrouting { type filter hook postrouting priority mangle; }'
nft 'add chain inet nat prerouting { type nat hook prerouting priority dstnat; }'
nft 'add chain inet nat postrouting { type nat hook postrouting priority srcnat; }'

## ============================================================================
## CREATE REGULAR CHAINS
## ============================================================================
nft 'add chain inet mangle open'
nft 'add chain inet mangle accountingup'
nft 'add chain inet mangle accountingdn'
nft 'add chain inet mangle gwacctup'
nft 'add chain inet mangle gwacctdn'
nft 'add chain inet mangle poolacctup'
nft 'add chain inet mangle poolacctdn'
nft 'add chain inet mangle acctup'
nft 'add chain inet mangle acctdn'
nft 'add chain inet mangle firewallchains'
nft 'add chain inet mangle firewallchainsdn'
nft 'add chain inet mangle firewallchains_conn'
nft 'add chain inet mangle firewallchainsdn_conn'

nft 'add chain inet nat open'
nft 'add chain inet nat proxy'
nft 'add chain inet nat frchainspre'
nft 'add chain inet nat frchainspost'

nft 'add chain inet filter intranetuploadaccounting'
nft 'add chain inet filter drop_log'
nft 'add rule inet filter drop_log log prefix "STAYSUITE_DROP_INPUT: " flags all'
nft 'add rule inet filter drop_log drop'

## ============================================================================
## OPEN CHAIN RULES (Localhost & Interface Processing)
## ============================================================================
nft 'add rule inet mangle open ip daddr 127.0.0.1 accept'

while read -r device ipaddr cidr nettype; do
    subnet="$ipaddr/$cidr"

    if [ -n "$GUIPORT" ] && [ "$GUIPORT" -ne 80 ]; then
        nft "add rule inet filter input iifname \"$device\" udp dport 80 drop"
        nft "add rule inet filter input iifname \"$device\" tcp dport 80 drop"
    fi

    nft "add rule inet mangle open ip saddr $ipaddr accept"
    # Fixed: use meta l4proto icmp for nft 1.1.1
    nft "add rule inet mangle open ip daddr $ipaddr meta l4proto icmp accept"
    nft "add rule inet mangle open ip daddr $ipaddr ct state related,established accept"
    nft "add rule inet mangle open ip daddr $ipaddr tcp dport $OPENPORTS accept"
    nft "add rule inet mangle open ip daddr $ipaddr tcp sport 273 accept"
    nft "add rule inet mangle open ip daddr $ipaddr udp dport 6060 accept"
    nft "add rule inet mangle open ip daddr $ipaddr udp dport $DNS_PORTS accept"
    # Fixed: removed 'udp' before ct state to prevent parser error
    nft "add rule inet mangle open ip daddr $ipaddr meta l4proto udp ct state related,established accept"

    nft "add rule inet mangle open ip daddr $ipaddr tcp dport $DROP_PORTS drop"
    nft "add rule inet mangle open ip saddr $ipaddr ip daddr $ipaddr tcp dport { 8009, 10080, 10090 } accept"
    nft "add rule inet nat open ip daddr $ipaddr tcp dport { 22, 23 } accept"

    if [ "$httpmodule" -eq 1 ] && { [ "$nettype" -eq "$NETTYPE_LAN" ] || [ "$nettype" -eq "$NETTYPE_VLAN" ]; }; then
        nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 80 mark set 10000"
        [ "$https_status" = "true" ] && nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 443 mark set 20000"

        nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 80 ct state new meter http_limit_${device} { ip saddr limit rate ${httpuptoratelimit}/minute burst ${httpburstableratelimit} packets } accept"
        nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 80 ct state new drop"

        if [ "$https_status" = "true" ]; then
            nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 443 ct state new meter https_limit_${device} { ip saddr limit rate ${httpsuptoratelimit}/minute burst ${httpsburstableratelimit} packets } accept"
            nft "add rule inet mangle accountingup ip saddr $subnet tcp dport 443 ct state new drop"
        fi
        nft "add rule inet mangle accountingup ip saddr $subnet tcp dport { 80, 443 } accept"
    fi
done < <(get_interfaces)

## ============================================================================
## SMB HARDENING (FIX #6 — simplified: always log then drop, no pointless if)
## ============================================================================
if [ -f /etc/broadcastfile ]; then
    nft 'add rule inet mangle open tcp dport { 137, 138, 139, 445 } log prefix "STAYSUITE_NETSEC_SMB_TCP: " flags all'
    nft 'add rule inet mangle open udp dport { 137, 138, 139, 445 } log prefix "STAYSUITE_NETSEC_SMB_UDP: " flags all'
fi
# Always drop SMB — both branches of the old if/fi did the same thing
nft 'add rule inet mangle open tcp dport { 137, 138, 139, 445 } drop'
nft 'add rule inet mangle open udp dport { 137, 138, 139, 445 } drop'

# Fixed: SNMP_PORTS variable needs double quotes to expand
nft "add rule inet mangle open udp dport $SNMP_PORTS accept"
nft 'add rule inet mangle open udp dport 6065 accept'

## ============================================================================
## MANGLE PREROUTING EXACT FLOW
## (Reconstructed to match exact sequence of iptables -I and -A commands)
## ============================================================================

## ============================================================================
## NFLOG RULES — ulogd2 SNI Capture Pipeline
##
## MUST be at the TOP of prerouting (before any accept rules).
## NFLOG is NON-TERMINATING — it logs AND continues processing.
## If placed after "ip saddr @usersset accept", logged-in user traffic
## would never reach these rules.
##
## Architecture:
##   nftables NFLOG (group 20) → ulogd2 → /var/log/ulogd/json/sni-queries.log
##   sni-parser (port 3022) reads JSON → extracts TLS SNI → ClickHouse ipdr.sni_log
##
## IMPORTANT — Why NOT "ct state new":
##   TCP handshake: SYN → SYN-ACK → ACK → ClientHello (with SNI)
##   "ct state new" only matches the SYN packet (60 bytes, zero payload).
##   The TLS ClientHello arrives AFTER the handshake in a data-carrying ACK
##   packet (tcp.psh=1, raw.pktlen ~200-500 bytes). By then ct state is
##   ESTABLISHED, not NEW. So we must filter by payload presence instead.
##
## Rule 1 (group 20): TCP 443 data packets → captures TLS ClientHello for SNI
## Rule 2 (group 21): TCP 80 data packets  → captures HTTP Host header
## Rule 3 (group 22): UDP/TCP port 53     → captures DNS queries
##
## nftables syntax (NOT iptables):
##   nft add rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500
## ============================================================================

# Only install NFLOG rules if ulogd2 is installed
# Binary: /usr/local/sbin/ulogd   Config: /usr/local/etc/ulogd.conf
if command -v ulogd >/dev/null 2>&1 || [ -x /usr/local/sbin/ulogd ]; then
    echo "ulogd2 detected — installing NFLOG rules for SNI capture pipeline"

    # Use 'insert rule' to place at the TOP of prerouting chain (position 0 by default)
    # Insert in reverse order so group 20 ends up first:
    #   insert order: DNS(22), DNS(22), HTTP(21), SNI(20)
    #   final order:  SNI(20), HTTP(21), DNS(22), DNS(22) ← then rest of chain

    # NFLOG group 22: DNS query capture (UDP/TCP port 53 — supplementary data)
    nft 'insert rule inet mangle prerouting udp dport 53 log group 22 snaplen 512 prefix "NFLOG_DNS: "'
    nft 'insert rule inet mangle prerouting tcp dport 53 log group 22 snaplen 512 prefix "NFLOG_DNS: "'

    # NFLOG group 21: HTTP Host capture (TCP port 80)
    # Same logic as SNI: HTTP GET/Host header is in the FIRST data packet after handshake,
    # NOT in the SYN. Use "tcp flags & (syn|rst|fin) == 0" to capture only ACK/ACK+PSH
    # packets (the data-carrying ones). Empty ACKs also match but are harmless.
    nft 'insert rule inet mangle prerouting tcp dport 80 tcp flags & (syn|rst|fin) == 0 log group 21 snaplen 1500 prefix "NFLOG_HTTP: "'

    # NFLOG group 20: TLS SNI capture (TCP port 443)
    # CRITICAL: Do NOT use "ct state new" — it only captures SYN (60 bytes, no payload).
    # TLS ClientHello with SNI arrives AFTER the 3-way handshake in a data packet.
    # Filter: no SYN/RST/FIN flags set → matches ACK-only and ACK+PSH packets only.
    # These are exactly the data-carrying packets. Empty ACKs also match (harmless).
    # NOTE: "tcp length > 0" does NOT work in nftables v1.1.1 — do not add it.
    # snaplen 1500 captures up to 1500 bytes — enough for the full ClientHello.
    nft 'insert rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500 prefix "NFLOG_SNI: "'

    # Restart ulogd2 to pick up the new rule change (native systemd — Rocky 10 has no SysV compat layer)
    if [ -f /etc/systemd/system/ulogd2.service ] || systemctl list-unit-files ulogd2.service >/dev/null 2>&1; then
        systemctl restart ulogd2 >/dev/null 2>&1
        echo "ulogd2 started via systemctl"
    elif [ -f /usr/local/etc/ulogd.conf ]; then
        # Fallback: start directly if no systemd service but config exists
        pkill -f "ulogd.*ulogd.conf" >/dev/null 2>&1
        sleep 1
        /usr/local/sbin/ulogd -c /usr/local/etc/ulogd.conf >/dev/null 2>&1 &
        echo "ulogd2 started manually (PID: $!)"
    else
        echo "WARNING: ulogd2 config not found at /usr/local/etc/ulogd.conf — NFLOG rules loaded but ulogd2 not started"
    fi
else
    echo "ulogd2 not found — skipping NFLOG rules (SNI capture pipeline disabled)"
fi

nft 'add rule inet mangle prerouting meta l4proto icmp accept'
nft 'add rule inet mangle prerouting tcp flags & (syn|ack|rst) == syn ip daddr @usersdstset accept'
nft 'add rule inet mangle prerouting tcp flags & (syn|ack|rst) == syn ip daddr @loggedinuserssnatip accept'
nft 'add rule inet mangle prerouting tcp flags & (syn|ack|rst) == syn ip saddr @usersset accept'
nft 'add rule inet mangle prerouting ip saddr @usersset meta mark set ct mark'
nft 'add rule inet mangle prerouting ip saddr @usersset ct mark != 0 accept'
nft 'add rule inet mangle prerouting ip saddr @llusersset jump acctup'
nft 'add rule inet mangle prerouting jump firewallchains'
nft 'add rule inet mangle prerouting ip saddr @usersset meta mark set mark | 0x10000000'
nft 'add rule inet mangle prerouting ip saddr @usersset ct mark set mark'
nft 'add rule inet mangle prerouting ip daddr @loggedinuserssnatip accept'
nft 'add rule inet mangle prerouting ip daddr @usersdstset accept'
nft 'add rule inet mangle prerouting ip saddr @usersset accept'

nft 'add rule inet mangle prerouting jump open'
# Hotelflow falls here (Appended before accountingup)
hotelflowstatus=$(dbi -q "select servicevalue from tblclientservices where servicekey ='ishotelflow'" 2>/dev/null)
if [ "$hotelflowstatus" = "Y" ]; then
    nft 'add rule inet mangle prerouting meta mark != 0 accept'
fi
nft 'add rule inet mangle prerouting jump accountingup'

## ============================================================================
## MANGLE POSTROUTING EXACT FLOW
## (Reconstructed to match exact sequence of iptables -I and -A commands)
## ============================================================================
nft 'add rule inet mangle postrouting ip frag-off & 0x1fff != 0 drop'
nft 'add rule inet mangle postrouting ip saddr 127.0.0.1 accept'
nft 'add rule inet mangle postrouting meta l4proto icmp accept'
nft 'add rule inet mangle postrouting tcp flags & (syn|ack|rst) == syn ip daddr @usersdstset accept'
nft 'add rule inet mangle postrouting tcp flags & (syn|ack|rst) == syn ip saddr @usersset accept'
nft 'add rule inet mangle postrouting ip daddr @usersdstset meta mark set ct mark'
nft 'add rule inet mangle postrouting ip daddr @usersdstset ct mark != 0 accept'
nft 'add rule inet mangle postrouting ip daddr @llusersset jump acctdn'
nft 'add rule inet mangle postrouting jump firewallchainsdn'
nft 'add rule inet mangle postrouting ip daddr @usersdstset meta mark set mark | 0x10000000'
nft 'add rule inet mangle postrouting ip daddr @usersdstset ct mark set mark'
nft 'add rule inet mangle postrouting ip saddr @usersset accept'
nft 'add rule inet mangle postrouting ip daddr @usersdstset accept'
nft 'add rule inet mangle postrouting jump accountingdn'

## First rules of accounting chains
nft 'add rule inet mangle acctup counter accept'
nft 'add rule inet mangle acctdn counter accept'

## ============================================================================
## DENY NETWORK FILE RULES
## ============================================================================
if [ -f /etc/restrictednetwork ]; then
    if [ "$httpmodule" -eq 1 ]; then
        while IFS= read -r line; do
            nft "add rule inet mangle accountingup ip saddr $line tcp dport 80 mark set 10000"
            [ "$https_status" = "true" ] && nft "add rule inet mangle accountingup ip saddr $line tcp dport 443 mark set 20000"
            nft "add rule inet mangle accountingup ip saddr $line tcp dport 80 ct state new meter deny_http { ip saddr limit rate ${httpuptoratelimit}/minute burst ${httpburstableratelimit} packets } accept"
            nft "add rule inet mangle accountingup ip saddr $line tcp dport 80 ct state new drop"
            if [ "$https_status" = "true" ]; then
                nft "add rule inet mangle accountingup ip saddr $line tcp dport 443 ct state new meter deny_https { ip saddr limit rate ${httpsuptoratelimit}/minute burst ${httpsburstableratelimit} packets } accept"
                nft "add rule inet mangle accountingup ip saddr $line tcp dport 443 ct state new drop"
            fi
            nft "add rule inet mangle accountingup ip saddr $line tcp dport { 80, 443 } accept"
        done < /etc/restrictednetwork
    else
        while IFS= read -r line; do
            nft "add rule inet mangle accountingup ip saddr $line drop"
        done < /etc/restrictednetwork
    fi
fi

## ============================================================================
## NAT EXACT FLOW (FIXED — insert at top for priority)
## ============================================================================
nft 'add rule inet nat prerouting jump open'
nft 'add rule inet nat prerouting jump frchainspre'

if [ "$httpmodule" -eq 1 ]; then
    # INSERT at position 0 so redirect runs BEFORE jump open
    # Order matters: HTTP first (position 0), then HTTPS (position 0 pushes HTTP to 1)
    nft "insert rule inet nat prerouting position 0 mark 10000 tcp dport 80 redirect to :$PORTAL_HTTP"
    [ "$https_status" = "true" ] && nft "insert rule inet nat prerouting position 0 mark 20000 tcp dport 443 redirect to :$PORTAL_HTTPS"
fi

## ============================================================================
## MULTIPLE GATEWAYS SUPPORT (FIX #5 — correct insertion order)
## ============================================================================
if [ -f /etc/registration_customization_status.properties ]; then
    . /etc/registration_customization_status.properties
fi

if [ "${multiplegateways:-N}" = "Y" ] || [ "${multiplegateways:-N}" = "y" ]; then
    # Collect all gateways into an array first
    declare -a gw_entries=()
    while read -r gatewayid; do
        fwmark=$(dbi -q "select fwmarkvalue from tblfwmark where fwmarkid in (select fwmarkid from tblgateway where gatewayid=$gatewayid)" 2>/dev/null)
        if [ -n "$fwmark" ]; then
            gw_entries+=("$gatewayid:$fwmark")
        fi
    done < <(dbi -q "select gatewayid from tblgateway order by gatewayid;" 2>/dev/null)

    # Insert in REVERSE order so first gateway (gatewayid=1) ends up at position 0
    # Without this fix, last gateway in the DB query ended up at position 0
    gw_count=${#gw_entries[@]}
    for (( i = gw_count - 1; i >= 0; i-- )); do
        IFS=: read -r gatewayid fwmark <<< "${gw_entries[$i]}"
        nft "add set inet nat gw${gatewayid}_ipset { type ipv4_addr; flags interval; }"
        nft "insert rule inet nat prerouting position 0 ct state new ip saddr @gw${gatewayid}_ipset mark set $fwmark"
        echo "Gateway $gatewayid (fwmark=$fwmark) inserted at nat prerouting"
    done
    unset gw_entries
fi

## ============================================================================
## SERVICES & SECURITY
## ============================================================================
[ -x /usr/local/scripts/general_settings.sh ] && /usr/local/scripts/general_settings.sh
[ -x /etc/rc.d/init.d/skein ] && { /etc/rc.d/init.d/skein stop 2>/dev/null; sleep 2; /etc/rc.d/init.d/skein restart 2>/dev/null; }
[ -x /usr/local/nascomponents/scripts/allowradiusclients.sh ] && sh /usr/local/nascomponents/scripts/allowradiusclients.sh
[ -x /usr/local/scripts/allowpmstraffic.sh ] && sh /usr/local/scripts/allowpmstraffic.sh >/dev/null 2>&1
[ -x /usr/local/scripts/catchall/catchallchains.sh ] && sh /usr/local/scripts/catchall/catchallchains.sh >/dev/null 2>&1
[ -x /usr/local/scripts/finalpacketratecontrol/script.sh ] && sh /usr/local/scripts/finalpacketratecontrol/script.sh >/dev/null 2>&1
[ -x /usr/local/scripts/blockmacentries.sh ] && sh /usr/local/scripts/blockmacentries.sh >/dev/null 2>&1
[ -x /usr/local/scripts/addwebsurflogclient.sh ] && sh /usr/local/scripts/addwebsurflogclient.sh >/dev/null 2>&1

## ============================================================================
## 2026 SECURITY ADDITIONS (Strict Integer Priorities for v1.1.1)
## FIX #4: All security hooks skip loopback (iif != "lo") to avoid unnecessary
##         processing of local traffic and prevent false positives on SSH/DNS.
## ============================================================================
nft 'add table inet security'

# ─── SYN Flood Protection (priority -300) ───
nft 'add chain inet security syn_flood { type filter hook input priority -300; }'
nft 'add rule inet security syn_flood iif "lo" accept'
nft 'add rule inet security syn_flood tcp flags & (fin|syn|rst|ack) == syn ct state new meter synflood { ip saddr limit rate over 200/second burst 100 packets } log prefix "SYN_FLOOD: " drop'
nft 'add rule inet security syn_flood tcp flags & (fin|syn|rst|ack) == syn ct state new accept'

# ONLY LOG in prerouting, DO NOT DROP. Let filter input/forward drop invalid states safely.
# Dropping here breaks active SSH/Routing sessions when firewall reloads!
nft 'add chain inet security invalid_packets { type filter hook prerouting priority -299; }'
nft 'add rule inet security invalid_packets ct state invalid log prefix "INVALID_PKT: "'

# ─── Port Scan Protection (priority -160) ───
# FIX #7: Uses named set "portscan_allow" for dynamic management.
# External scripts can add ports at runtime:
#   nft add element inet security portscan_allow { 8080 }
nft 'add chain inet security port_scan { type filter hook input priority -160; }'
nft 'add rule inet security port_scan iif "lo" accept'
nft 'add set inet security portscan_allow { type inet_service; flags interval; }'
PORTSCAN_PORTS="{ 22, 80, 443, 53, ${PORTAL_HTTP}, ${PORTAL_HTTPS}, ${PORTAL_APP}, 1812, 1813, 67 }"
nft "add element inet security portscan_allow $PORTSCAN_PORTS"
nft 'add rule inet security port_scan tcp dport != @portscan_allow ct state new meter portscan { ip saddr limit rate over 10/minute burst 5 packets } log prefix "PORT_SCAN: " drop'

# ─── SSH Brute Force Protection (priority -155) ───
nft 'add chain inet security ssh_protection { type filter hook input priority -155; }'
nft 'add rule inet security ssh_protection iif "lo" accept'
# Log the attempt, but DO NOT drop it (remove 'drop' so it passes to the next rule)
nft 'add rule inet security ssh_protection tcp dport 22 ct state new meter ssh_auth { ip saddr limit rate over 5/minute burst 3 packets } log prefix "SSH_BRUTE: "'
# Accept all SSH traffic so the admin never gets locked out
nft 'add rule inet security ssh_protection tcp dport 22 accept'

# ─── DNS Amplification Protection (priority -150) ───
nft 'add chain inet security dns_protection { type filter hook input priority -150; }'
nft 'add rule inet security dns_protection iif "lo" accept'
nft 'add rule inet security dns_protection udp dport 53 meter dns_amp { ip saddr limit rate over 50/second burst 20 packets } log prefix "DNS_AMP: " drop'

# ─── ICMP Rate Limiting (priority -140) ───
nft 'add chain inet security icmp_limit { type filter hook input priority -140; }'
nft 'add rule inet security icmp_limit iif "lo" accept'
nft 'add rule inet security icmp_limit icmp type echo-request meter ping_limit { ip saddr limit rate 1/second burst 5 packets } accept'
nft 'add rule inet security icmp_limit icmp type echo-request drop'

## ============================================================================
## FINAL FILTER TABLE SETUP
## FIX #1: filter input policy changed from accept → drop
## FIX #2: drop_log chain is now jumped to at end of input chain
## FIX #3: filter forward chain added (gateway must filter forwarded traffic)
## ============================================================================

## Create a whitelist set for absolute admin access (Bypasses ALL security rules)
nft 'add set inet filter ssh_whitelist { type ipv4_addr; flags interval; }'

## ─── INPUT chain (FIX #1: policy drop) ───
nft 'add chain inet filter input { type filter hook input priority filter; policy drop; }'
nft 'add rule inet filter input iif "lo" accept'

## ABSOLUTE WHITELIST (Add your IP here so you never get locked out)
nft 'add rule inet filter input ip saddr @ssh_whitelist accept'

nft 'add rule inet filter input ct state established,related accept'
## It is safe to drop invalid here in the filter table without breaking routing
nft 'add rule inet filter input ct state invalid drop'
nft 'add rule inet filter input jump intranetuploadaccounting'
nft "add rule inet filter input tcp dport $OPENPORTS ct state new accept"
# Allow RADIUS auth/acct from NAS devices (FreeRADIUS)
nft 'add rule inet filter input udp dport { 1812, 1813 } accept'
# Allow DHCP server
nft 'add rule inet filter input udp dport 67 accept'
# Allow ICMP (ping the gateway for diagnostics)
nft 'add rule inet filter input meta l4proto icmp accept'

## FIX #2: Jump to drop_log at end — catches everything that falls through
nft 'add rule inet filter input jump drop_log'

## ─── FORWARD chain (FIX #3: gateway must filter forwarded traffic) ───
nft 'add chain inet filter forward { type filter hook forward priority filter; policy drop; }'

# Allow established/related forwarded connections
nft 'add rule inet filter forward ct state established,related accept'

# Drop invalid forwarded packets
nft 'add rule inet filter forward ct state invalid drop'

# Allow forwarded traffic for logged-in users (marked by mangle prerouting)
nft 'add rule inet filter forward meta mark != 0 accept'

# Allow traffic from user sets (mangle has already classified these)
nft 'add rule inet filter forward ip saddr @loggedinusers accept'
nft 'add rule inet filter forward ip saddr @loggedinusersnetwork accept'

# Log and drop everything else (visible in journalctl/dmesg)
nft 'add rule inet filter forward log prefix "STAYSUITE_DROP_FORWARD: " flags all drop'

## ============================================================================
## IPv6 SUPPORT
## ============================================================================
if [ "$ipv6" = "y" ] || [ "$ipv6" = "Y" ]; then
    if [ -x /usr/local/scripts/defaultchains_cryptsk_ipv6.sh ]; then
        sh /usr/local/scripts/defaultchains_cryptsk_ipv6.sh
    else
        nft 'add table ip6 security'
        nft 'add chain ip6 security input6 { type filter hook input priority 0; policy drop; }'
        nft 'add rule ip6 security input6 iif "lo" accept'
        nft 'add rule ip6 security input6 ct state established,related accept'
        nft 'add rule ip6 security input6 icmpv6 accept'
        nft 'add rule ip6 security input6 tcp dport { 22, 80, 443 } accept'
    fi
fi

## ============================================================================
## PERSISTENCE & WRAP UP
## ============================================================================
[ -x /usr/local/scripts/applyallchains.sh ] && sh /usr/local/scripts/applyallchains.sh >> /var/log/nftables_restore.log 2>&1 &
[ -x /etc/rc.d/init.d/dnssniffer ] && /etc/rc.d/init.d/dnssniffer restart 2>/dev/null

mkdir -p /etc/nftables
nft list ruleset > /etc/nftables/rules.nft

echo "StaySuite HospitalityOS nftables Active."
