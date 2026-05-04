#!/bin/bash
###########################################################################
# Script : StaySuite Bandwidth Initialization (Rocky Linux 10)
# Reason : Modern IFB/TC implementation replacing legacy IMQ
#
# TRAFFIC FLOW:
#
#   DOWNLOAD (internet → client):
#     WAN ingress → route → nft postrouting (masq) → LAN egress
#       → mirred egress redirect → ifb0
#       → u32 match ip dst <client_ip>/32 → class 1:<dn_classid>
#       → shaped at plan download rate
#       → exits LAN to client
#
#   UPLOAD (client → internet):
#     LAN ingress → mirred ingress redirect → ifb1
#       → u32 match ip src <client_ip>/32 → class 1:<up_classid>
#       → shaped at plan upload rate
#       → continues → nft prerouting (mark) → route → postrouting (masq)
#       → exits WAN to internet
#
# KEY INSIGHT:
#   Upload traffic MUST be captured at LAN INGRESS (before NAT masquerade),
#   because after masq the source IP changes to WAN IP and u32 can't match.
#   24online uses IMQ --todev 1 in PREROUTING (same principle).
###########################################################################

QUEUE="htb"
MIN="rate"
MAX="ceil"


# =========================================================================
# 1. CLEANUP OLD LEGACY IMQ STATE
# =========================================================================
modprobe -r imq 2>/dev/null

# =========================================================================
# 2. INITIALIZE IFB DEVICES (Modern Replacement for IMQ)
# =========================================================================
# ifb0 -> LAN Egress redirect (Download Shaping)
# ifb1 -> LAN Ingress redirect (Upload Shaping)

ip link add ifb0 type ifb 2>/dev/null
ip link add ifb1 type ifb 2>/dev/null

ip link set ifb0 up
ip link set ifb1 up
ip link set ifb0 txqueuelen 1000
ip link set ifb1 txqueuelen 1000

tc qdisc del dev ifb0 root 2>/dev/null
tc qdisc del dev ifb1 root 2>/dev/null

# =========================================================================
# 3. SETUP BASE HTB ON IFB DEVICES
# =========================================================================
# Explicitly setting 'quantum 1500' prevents the kernel math warning on 10Gbit+
tc qdisc add dev ifb0 root handle 1: $QUEUE default 1
tc class add dev ifb0 parent 1:0 classid 1:1 $QUEUE $MIN 10gbit ceil 10gbit quantum 1500

tc qdisc add dev ifb1 root handle 1: $QUEUE default 1
tc class add dev ifb1 parent 1:0 classid 1:1 $QUEUE $MIN 10gbit ceil 10gbit quantum 1500

# =========================================================================
# 4. PARSE INTERFACES & APPLY REDIRECT FILTERS
# =========================================================================
for conn_file in /etc/NetworkManager/system-connections/*.nmconnection; do
    [ -f "$conn_file" ] || continue

    device=$(grep -E '^interface-name=' "$conn_file" | cut -d= -f2)
    [ -z "$device" ] && continue

    # CRITICAL: Skip interfaces enslaved to a bridge (e.g., eth1/eth2 under br0)
    if ip link show "$device" | grep -q 'master'; then
        continue
    fi

    nettype=$(awk -F= '/^\[staysuite\]/{found=1} found && /^nettype=/{print $2; exit}' "$conn_file")
    nettype=${nettype:-0}

    if [ "$nettype" -eq 0 ] || [ "$nettype" -eq 2 ]; then
        # ── LAN / VLAN interface ──
        # Download: redirect LAN egress → ifb0
        #   Packet has been masqueraded; dst IP is still client IP → u32 match ip dst works
        # Upload: redirect LAN ingress → ifb1
        #   Packet source IP is still original client IP (before NAT) → u32 match ip src works

        # Egress: download shaping (existing, working)
        tc qdisc del dev $device root 2>/dev/null
        tc qdisc add dev $device root handle 1: $QUEUE
        tc filter add dev $device parent 1: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev ifb0

        # Ingress: upload shaping (NEW — captures traffic before NAT masquerade)
        tc qdisc add dev $device ingress 2>/dev/null || true
        tc filter add dev $device parent ffff: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred ingress redirect dev ifb1 2>/dev/null || true

        echo "[INIT] $device (nettype=$nettype): LAN egress→ifb0 (download) + ingress→ifb1 (upload)"
    fi
done

# WAN interfaces: no redirect needed.
# Download is shaped at LAN egress → ifb0.
# Upload is shaped at LAN ingress → ifb1 (before NAT).
# Shaping on WAN egress would fail because NAT already changed source IP.

exit 0
