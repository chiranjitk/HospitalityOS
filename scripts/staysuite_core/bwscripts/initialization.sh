#!/bin/bash
###########################################################################
# Script : StaySuite Bandwidth Initialization (Rocky Linux 10)
# Reason : Modern IFB/TC implementation replacing legacy IMQ
#
# TRAFFIC FLOW (same as 24online IMQ architecture):
#
#   DOWNLOAD (internet → client):
#     WAN → route → masq → LAN egress → mirred egress redirect → ifb0
#     fw filter: handle <mark> → classid 1:<dn_classid>
#     shaped at plan download rate → back to LAN → client
#
#   UPLOAD (client → internet):
#     LAN → nft prerouting sets mark → route → WAN egress → mirred egress redirect → ifb1
#     fw filter: handle <mark> → classid 1:<up_classid>
#     shaped at plan upload rate → back to WAN → internet
#
# KEY: Upload shaping uses fwmark (NOT IP) for matching.
#   The mark is set in nft prerouting BEFORE NAT masquerade, so it persists
#   on WAN egress even though the source IP has been changed.
#   This is exactly how 24online works: handle $userid fw classid 1:$class
#
#   tc fw filter syntax: handle <N> fw classid <X:Y>
#     handle goes BEFORE fw (it's a tc filter parameter, not fw keyword)
#     The fw filter matches: skb->mark & 0xFFFFFFFF == <N>
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
# ifb0 -> Download shaping (LAN egress redirect)
# ifb1 -> Upload shaping (WAN egress redirect)

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
# 4. PARSE INTERFACES & APPLY EGRESS REDIRECT FILTERS
# =========================================================================
# Same approach as 24online: egress redirect only, no ingress.
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

    # Flush existing qdisc on the physical interface
    tc qdisc del dev $device root 2>/dev/null

    # Add HTB root to the physical interface
    tc qdisc add dev $device root handle 1: $QUEUE

    if [ "$nettype" -eq 1 ]; then
        # NETTYPE 1 = WAN -> Redirect egress to ifb1 (Upload Shaping)
        # Traffic arrives here AFTER nft prerouting (mark already set) and AFTER nat (src IP masq'd)
        # fw filter on ifb1 matches by mark (not IP), so masqueraded src IP is OK
        tc filter add dev $device parent 1: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev ifb1
        echo "[INIT] $device (nettype=$nettype): WAN egress → ifb1 (upload shaping)"
    elif [ "$nettype" -eq 0 ] || [ "$nettype" -eq 2 ]; then
        # NETTYPE 0 = LAN | NETTYPE 2 = VLAN -> Redirect egress to ifb0 (Download Shaping)
        # Traffic arrives here after NAT, dst IP is still client IP
        # Both fw mark and dst IP are available for matching
        tc filter add dev $device parent 1: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev ifb0
        echo "[INIT] $device (nettype=$nettype): LAN egress → ifb0 (download shaping)"
    fi
done

exit 0
