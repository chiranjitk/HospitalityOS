#!/bin/bash
###########################################################################
# Script : StaySuite Bandwidth Initialization (Rocky Linux 10)
# Reason : Modern IFB/TC implementation replacing legacy IMQ
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
# ifb0 -> LAN/VLAN Ingress (Download Shaping)
# ifb1 -> WAN Ingress (Upload Shaping)

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
    
    # Flush existing qdisc on the physical interface
    tc qdisc del dev $device root 2>/dev/null
    
    # Add HTB root to the physical interface
    tc qdisc add dev $device root handle 1: $QUEUE
    
    if [ "$nettype" -eq 1 ]; then
        # NETTYPE 1 = WAN -> Redirect to ifb1 (Upload Shaping)
        tc filter add dev $device parent 1: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev ifb1
    elif [ "$nettype" -eq 0 ] || [ "$nettype" -eq 2 ]; then
        # NETTYPE 0 = LAN | NETTYPE 2 = VLAN -> Redirect to ifb0 (Download Shaping)
        tc filter add dev $device parent 1: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev ifb0
    fi
done

# Legacy interface state management removed: NetworkManager handles ifup/ifdown.

exit 0