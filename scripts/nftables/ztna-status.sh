#!/bin/bash
# ZTNA Status — Reports ZTNA chain status
#
# Outputs JSON with rule counts for ztna_prerouting and ztna_quarantine chains.
#
# Usage: ztna-status.sh
#   Delegates to ztna-apply.sh status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/ztna-apply.sh" status
