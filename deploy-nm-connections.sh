#!/bin/bash
# deploy-nm-connections.sh
# Deploy .nmconnection files to /etc/NetworkManager/system-connections/
# Run on Rocky Linux 10 as root: sudo bash deploy-nm-connections.sh
#
# This script copies all .nmconnection files from ./network-profiles/
# to the NetworkManager connections directory and sets correct permissions.

set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/network-profiles" && pwd)"
DST_DIR="/etc/NetworkManager/system-connections"

echo "=== StaySuite NetworkManager Connection Profile Deploy ==="
echo "Source: $SRC_DIR"
echo "Target: $DST_DIR"
echo ""

# Check root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root."
  echo "Usage: sudo bash deploy-nm-connections.sh"
  exit 1
fi

# Create target directory if missing
mkdir -p "$DST_DIR"

# Copy all .nmconnection files
COUNT=0
for file in "$SRC_DIR"/*.nmconnection; do
  [ -f "$file" ] || continue
  filename=$(basename "$file")
  cp "$file" "$DST_DIR/$filename"
  chmod 600 "$DST_DIR/$filename"
  echo "  Deployed: $filename"
  COUNT=$((COUNT + 1))
done

echo ""
echo "Deployed $COUNT connection profile(s) to $DST_DIR"
echo ""
echo "To reload NetworkManager:"
echo "  sudo nmcli connection reload"
echo ""
echo "To bring up all connections:"
echo "  sudo nmcli connection up --activate"
