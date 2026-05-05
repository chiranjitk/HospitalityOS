#!/bin/bash
###############################################################################
#  patch-json-plugin.sh — Patch ulogd2 JSON output to include raw.pkt as hex
#
#  Problem: ulogd2 2.0.8 JSON output plugin silently drops ULOGD_RET_RAW fields
#  (falls through to "default: break"). This means raw.pkt (the actual packet
#  payload) is never in the JSON output, making TLS SNI extraction impossible.
#
#  Fix: Add a case for ULOGD_RET_RAW that converts binary data to hex string.
#
#  Usage on Rocky 10 server:
#    chmod +x patch-json-plugin.sh
#    ./patch-json-plugin.sh [/path/to/ulogd-2.0.8/source]
###############################################################################

set -e

ULOGD_SRC="${1:-/usr/local/src/ulogd-2.0.8}"
ULOGD_PREFIX="/usr/local/ulogd2"
PATCH_BACKUP="/root/ulogd-json-patch-backup.c"

echo "=== ulogd2 JSON output plugin — raw.pkt hex patch ==="
echo "Source dir: $ULOGD_SRC"
echo "Install prefix: $ULOGD_PREFIX"
echo

# ─── 1. Verify source exists ───
JSON_C="$ULOGD_SRC/output/ulogd_output_JSON.c"
if [ ! -f "$JSON_C" ]; then
    echo "ERROR: Source not found at $JSON_C"
    echo
    echo "Extract the source tarball first:"
    echo "  mkdir -p /usr/local/src && cd /usr/local/src"
    echo "  tar xjf /path/to/ulogd-2.0.8.tar.bz2"
    echo "  $0 /usr/local/src/ulogd-2.0.8"
    exit 1
fi

# ─── 2. Check if already patched ───
if grep -q "ULOGD_RET_RAW" "$JSON_C"; then
    echo "Already patched:"
    grep -A2 "case ULOGD_RET_RAW:" "$JSON_C" | head -3
    echo "Skipping. To redo: cp $PATCH_BACKUP $JSON_C && $0"
    exit 0
fi

# ─── 3. Backup original ───
cp "$JSON_C" "$PATCH_BACKUP"
echo "✓ Backup: $PATCH_BACKUP"

# ─── 4. Apply patch — insert ULOGD_RET_RAW case before "default:" ───
# Using sed with line-insert before the exact "default:" that follows UINT64
# This is the reliable approach tested on ulogd-2.0.8

# Create a heredoc with the new code block (tabs preserved)
NEW_CODE='		case ULOGD_RET_RAW:
			/* Output raw packet data as hex string (for TLS SNI extraction) */
			if (key->u.value.ptr && key->len > 0) {
				char *hex = calloc(key->len * 2 + 1, 1);
				if (hex) {
					for (uint32_t i = 0; i < key->len; i++)
						sprintf(hex + (i * 2), "%02x", ((uint8_t *)key->u.value.ptr)[i]);
					json_object_set_new(msg, field_name, json_string(hex));
					free(hex);
				}
			}
			break;'

# Find the line number of "default:" inside the json_interp switch (after ULOGD_RET_UINT64)
LINE=$(grep -n "case ULOGD_RET_UINT64:" "$JSON_C" | head -1 | cut -d: -f1)
if [ -z "$LINE" ]; then
    echo "ERROR: Cannot find ULOGD_RET_UINT64 case in source"
    exit 1
fi

# Find "default:" after that line
DEFAULT_LINE=$(sed -n "${LINE},\$p" "$JSON_C" | grep -n "^\t\tdefault:" | head -1 | cut -d: -f1)
DEFAULT_LINE=$((LINE + DEFAULT_LINE - 1))

if [ -z "$DEFAULT_LINE" ] || [ "$DEFAULT_LINE" -le "$LINE" ]; then
    echo "ERROR: Cannot find 'default:' case after ULOGD_RET_UINT64"
    exit 1
fi

echo "Inserting ULOGD_RET_RAW case at line $DEFAULT_LINE (before 'default:')"

# Insert the new code block BEFORE the default line
sed -i "${DEFAULT_LINE}i\\${NEW_CODE}" "$JSON_C"

# ─── 5. Verify patch ───
if grep -q "ULOGD_RET_RAW" "$JSON_C"; then
    echo "✓ Patch applied!"
    echo
    grep -A11 "case ULOGD_RET_RAW:" "$JSON_C"
else
    echo "ERROR: Patch failed! Restoring backup..."
    cp "$PATCH_BACKUP" "$JSON_C"
    exit 1
fi

echo
echo "=== Rebuilding JSON output plugin ==="
cd "$ULOGD_SRC"

# ─── 6. Rebuild ───
# Try make first (if build tree is configured)
if [ -f Makefile ]; then
    echo "Running make..."
    make -C output/ 2>&1 | tail -5 && MAKE_OK=1 || MAKE_OK=0
fi

# Fallback: manual gcc compile
if [ "${MAKE_OK:-0}" != "1" ] || [ ! -f "output/.libs/ulogd_output_JSON.so" ]; then
    echo "make failed or no .so — trying manual compile..."
    mkdir -p output/.libs
    gcc -shared -fPIC -Wall -o output/.libs/ulogd_output_JSON.so \
        output/ulogd_output_JSON.c \
        -I"$ULOGD_SRC/include" \
        -I"$ULOGD_SRC" \
        $(pkg-config --cflags --libs jansson 2>/dev/null || echo "-ljansson") \
        $(pkg-config --cflags --libs libnetfilter_log 2>/dev/null) \
        2>&1
fi

SO_FILE="$ULOGD_SRC/output/.libs/ulogd_output_JSON.so"
if [ ! -f "$SO_FILE" ]; then
    echo "ERROR: Rebuild failed — .so not found"
    exit 1
fi
echo "✓ Rebuilt: $SO_FILE"

# ─── 7. Install ───
DEST="$ULOGD_PREFIX/lib/ulogd/ulogd_output_JSON.so"
cp -f "$SO_FILE" "$DEST"
echo "✓ Installed: $DEST"

# ─── 8. Verify ───
if nm -D "$DEST" | grep -q "json_interp"; then
    echo "✓ Plugin symbols OK"
fi

echo
echo "=== Done! Now run: ==="
echo "  systemctl restart ulogd2"
echo "  > /var/log/ulogd/json/sni-queries.log"
echo "  # Browse HTTPS from guest device, then:"
echo '  tail -1 /var/log/ulogd/json/sni-queries.log | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(\"raw.pkt\" in d, len(d.get(\"raw.pkt\",\"\")))"'
