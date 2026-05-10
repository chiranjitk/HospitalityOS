#!/bin/bash
# Stub pool script for sandbox environment (no nftables/tc)
case "$1" in
  create|delete|list|stats|cleanup)
    exit 0
    ;;
  *)
    echo "Usage: $0 {create|delete|list|stats|cleanup}"
    exit 0
    ;;
esac
