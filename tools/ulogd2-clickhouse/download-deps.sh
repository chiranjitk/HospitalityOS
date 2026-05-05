#!/bin/bash
##############################################################################
#  Download All ulogd2 Build Dependencies — StaySuite-HospitalityOS
#
#  Downloads ulogd2 source + all required netfilter/json libraries
#  to tools/ulogd2-clickhouse/src/ for offline building on Rocky Linux 10.
#
#  Usage:
#    cd /home/z/my-project
#    bash tools/ulogd2-clickhouse/download-deps.sh
#
#  All files are saved to tools/ulogd2-clickhouse/src/
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"

mkdir -p "$SRC_DIR"

echo "=============================================="
echo "  Downloading ulogd2 + all dependencies"
echo "  Target: $SRC_DIR"
echo "=============================================="

# ─── Source URLs ──────────────────────────────────────────────────────────

declare -A SOURCES=(
  # ulogd2 itself
  ["ulogd-2.0.8.tar.bz2"]="https://www.netfilter.org/projects/ulogd/files/ulogd-2.0.8.tar.bz2"

  # Core netfilter libraries (build order matters)
  ["libmnl-1.0.5.tar.bz2"]="https://www.netfilter.org/projects/libmnl/files/libmnl-1.0.5.tar.bz2"
  ["libnfnetlink-1.0.2.tar.bz2"]="https://www.netfilter.org/projects/libnfnetlink/files/libnfnetlink-1.0.2.tar.bz2"
  ["libnetfilter_log-1.0.2.tar.bz2"]="https://www.netfilter.org/projects/libnetfilter_log/files/libnetfilter_log-1.0.2.tar.bz2"
  ["libnetfilter_conntrack-1.0.9.tar.bz2"]="https://www.netfilter.org/projects/libnetfilter_conntrack/files/libnetfilter_conntrack-1.0.9.tar.bz2"
  ["libnetfilter_acct-1.0.3.tar.bz2"]="https://www.netfilter.org/projects/libnetfilter_acct/files/libnetfilter_acct-1.0.3.tar.bz2"

  # JSON-C (for JSONLOG output plugin)
  ["json-c-0.17.tar.gz"]="https://s3.amazonaws.com/json-c_releases/releases/json-c-0.17.tar.gz"

  # libpcap (for PCAP output plugin — usually available via dnf too)
  ["libpcap-1.10.5.tar.gz"]="https://github.com/the-tcpdump-group/libpcap/archive/refs/tags/libpcap-1.10.5.tar.gz"
)

# ─── Download ─────────────────────────────────────────────────────────────

TOTAL=${#SOURCES[@]}
COUNT=0
FAILED=0

for filename in "${!SOURCES[@]}"; do
  COUNT=$((COUNT + 1))
  url="${SOURCES[$filename]}"
  dest="$SRC_DIR/$filename"

  printf "\n[%d/%d] %s\n" "$COUNT" "$TOTAL" "$filename"

  if [ -f "$dest" ]; then
    SIZE=$(stat -c%s "$dest" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 1000 ]; then
      echo "  ✓ Already downloaded ($(numfmt --to=iec $SIZE 2>/dev/null || echo "${SIZE}B"))"
      continue
    fi
    echo "  ⚠ Incomplete download ($SIZE bytes), re-downloading..."
    rm -f "$dest"
  fi

  echo "  ↓ $url"

  if curl -fSL --connect-timeout 15 --max-time 120 --retry 2 -o "$dest" "$url" 2>&1; then
    SIZE=$(stat -c%s "$dest" 2>/dev/null || echo 0)
    echo "  ✓ Saved ($SIZE bytes)"
  else
    echo "  ✗ FAILED to download $filename"
    FAILED=$((FAILED + 1))
    rm -f "$dest"
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────

echo ""
echo "=============================================="
echo "  Download Summary"
echo "=============================================="

TOTAL_SIZE=0
FILE_COUNT=0
for f in "$SRC_DIR"/*; do
  [ -f "$f" ] || continue
  SIZE=$(stat -c%s "$f" 2>/dev/null || echo 0)
  TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
  FILE_COUNT=$((FILE_COUNT + 1))
  echo "  $(basename "$f")  ($(numfmt --to=iec $SIZE 2>/dev/null || echo "${SIZE}B"))"
done

echo ""
echo "  Files: $FILE_COUNT / $TOTAL"
echo "  Total: $(numfmt --to=iec $TOTAL_SIZE 2>/dev/null || echo "${TOTAL_SIZE}B")"

if [ "$FAILED" -gt 0 ]; then
  echo "  ⚠ $FAILED download(s) failed — re-run this script to retry"
  exit 1
fi

echo "  ✓ All sources ready for offline build"
echo ""
echo "  Next: bash tools/ulogd2-clickhouse/build-offline.sh"
