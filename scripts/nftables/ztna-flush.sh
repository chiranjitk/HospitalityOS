#!/bin/bash
# ZTNA Flush — Flushes all ZTNA nftables rules
#
# Flushes both ztna_prerouting and ztna_quarantine chains in inet mangle.
# This removes all per-device trust level markings and quarantine jumps.
#
# Usage: ztna-flush.sh
#   Delegates to ztna-apply.sh flush

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/ztna-apply.sh" flush
