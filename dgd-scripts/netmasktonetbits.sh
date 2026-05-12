#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — Netmask to CIDR prefix bits converter              #
#  Usage: netmasktonetbits.sh <netmask>                                         #
#  Returns: prefix bits (0-32) via exit code                                    #
##################################################################################

netmask=$1

if [ -z "$netmask" ]; then
        echo "Usage: $0 <netmask>" >&2
        exit -1
fi

# Convert netmask to CIDR prefix bits
IFS='.' read -r o1 o2 o3 o4 <<< "$netmask"

prefix=0
for octet in $o1 $o2 $o3 $o4; do
        while [ $octet -gt 0 ]; do
                prefix=$((prefix + (octet & 1)))
                octet=$((octet >> 1))
        done
done

# Also validate it's a proper contiguous netmask
# (optional: strict validation)
binary=""
for octet in $o1 $o2 $o3 $o4; do
        binary="${binary}$(printf '%08d' "$(echo "obase=2;$octet" | bc)")"
done

# Check if it's contiguous (all 1s followed by all 0s)
cleaned=$(echo "$binary" | sed 's/1.*0//')
if [ ${#cleaned} -ne 0 ]; then
        # Non-contiguous netmask, return -1
        exit -1
fi

exit $prefix
