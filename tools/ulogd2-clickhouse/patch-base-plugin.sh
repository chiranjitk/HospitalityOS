#!/bin/bash
###############################################################################
#  patch-base-plugin.sh — Patch ulogd2 BASE plugin to pass through raw.pkt
#
#  Problem: BASE plugin consumes raw.pkt from NFLOG but doesn't include it in
#  its output keys. Even when patched to copy the pointer, okey_set_ptr() does
#  NOT set key->len, causing the JSON plugin's "key->len > 0" check to fail.
#
#  Fix: Explicitly copy ptr AND len AND VALID flag from input to output.
#
#  Usage on Rocky 10 server:
#    chmod +x patch-base-plugin.sh
#    ./patch-base-plugin.sh [/path/to/ulogd-2.0.8/source]
###############################################################################

set -e

ULOGD_SRC="${1:-/usr/local/src/ulogd-2.0.8}"
ULOGD_PREFIX="/usr/local/ulogd2"
PATCH_BACKUP="/root/ulogd-base-patch-backup.c"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== ulogd2 BASE plugin — raw.pkt passthrough patch ==="
echo "Source dir: $ULOGD_SRC"
echo "Install prefix: $ULOGD_PREFIX"
echo

# ─── 1. Verify source exists ───
BASE_C="$ULOGD_SRC/filter/raw2packet/ulogd_raw2packet_BASE.c"
if [ ! -f "$BASE_C" ]; then
    echo "ERROR: Source not found at $BASE_C"
    echo
    echo "Extract the source tarball first:"
    echo "  mkdir -p /usr/local/src && cd /usr/local/src"
    echo "  tar xjf /path/to/ulogd-2.0.8.tar.bz2"
    echo "  $0 /usr/local/src/ulogd-2.0.8"
    exit 1
fi

# ─── 2. Backup original ───
if [ ! -f "$PATCH_BACKUP" ]; then
    cp "$BASE_C" "$PATCH_BACKUP"
    echo "Backup: $PATCH_BACKUP"
else
    echo "Backup exists: $PATCH_BACKUP (use it to restore if needed)"
fi

# ─── 3. Run Python patch script ───
echo
python3 "$SCRIPT_DIR/patch-base-plugin.py" "$BASE_C"

# ─── 4. Verify patch ───
echo
echo "Verifying patch:"
if grep -q "KEY_RAW_PKT" "$BASE_C"; then
    echo "  KEY_RAW_PKT enum: OK"
else
    echo "  KEY_RAW_PKT enum: MISSING!"
    exit 1
fi

if grep -q "raw.pkt.*ULOGD_RET_RAW" "$BASE_C"; then
    echo "  iphdr_rets entry: OK"
else
    echo "  iphdr_rets entry: MISSING!"
    exit 1
fi

if grep -q "ret\[KEY_RAW_PKT\].*\.len.*=.*raw_src->len" "$BASE_C"; then
    echo "  len copy in _interp_pkt: OK"
else
    echo "  len copy in _interp_pkt: MISSING!"
    exit 1
fi

echo
echo "=== Rebuilding BASE plugin ==="
cd "$ULOGD_SRC"

# ─── 5. Rebuild ───
# Try make first (if build tree is configured)
if [ -f Makefile ]; then
    echo "Running make in filter/raw2packet/..."
    make -C filter/raw2packet/ 2>&1 | tail -5 && MAKE_OK=1 || MAKE_OK=0
fi

# Fallback: manual gcc compile (no external deps — just libc + ulogd headers)
if [ "${MAKE_OK:-0}" != "1" ] || [ ! -f "filter/raw2packet/.libs/ulogd_raw2packet_BASE.so" ]; then
    echo "make failed or no .so — trying manual compile..."
    mkdir -p filter/raw2packet/.libs
    gcc -shared -fPIC -Wall -o filter/raw2packet/.libs/ulogd_raw2packet_BASE.so \
        filter/raw2packet/ulogd_raw2packet_BASE.c \
        -I"$ULOGD_SRC/include" \
        -I"$ULOGD_SRC" \
        2>&1
fi

SO_FILE="$ULOGD_SRC/filter/raw2packet/.libs/ulogd_raw2packet_BASE.so"
if [ ! -f "$SO_FILE" ]; then
    echo "ERROR: Rebuild failed — .so not found"
    exit 1
fi
echo "Rebuilt: $SO_FILE"

# ─── 6. Install ───
DEST="$ULOGD_PREFIX/lib/ulogd/ulogd_raw2packet_BASE.so"
cp -f "$SO_FILE" "$DEST"
echo "Installed: $DEST"

# ─── 7. Verify ───
if nm -D "$DEST" | grep -q "base_plugin"; then
    echo "Plugin symbols OK"
fi

echo
echo "=== Done! Now run: ==="
echo "  systemctl restart ulogd2"
echo "  > /var/log/ulogd/json/sni-queries.log"
echo "  # Browse HTTPS from guest, then:"
echo '  tail -1 /var/log/ulogd/json/sni-queries.log | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(\"raw.pkt\" in d, len(d.get(\"raw.pkt\",\"\")))"'
