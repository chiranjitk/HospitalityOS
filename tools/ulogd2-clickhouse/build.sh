#!/bin/bash
##############################################################################
#  ulogd2 Build Script — StaySuite-HospitalityOS
#
#  Compiles ulogd2 from source for Rocky Linux 10 (nftables NFLOG backend).
#
#  What this builds:
#    ulogd2 with plugins:
#      - ulogd_inppkt_NFLOG.so   (nftables NFLOG packet capture)
#      - ulogd_inpct_NFCT.so    (netfilter conntrack events — future use)
#      - ulogd_filter_HWHDR.so  (hardware header extraction)
#      - ulogd_filter_IFINDEX.so (interface index)
#      - ulogd_output_JSONLOG.so (JSON-lines output for sni-parser)
#
#  Pipeline:
#    nftables NFLOG rule (group 20) → ulogd2 → /var/log/sni-queries.log
#    sni-parser (port 3022) reads the JSON → ClickHouse ipdr.sni_log
#
#  Usage:
#    bash tools/ulogd2-clickhouse/build.sh
#
#  Install location: /usr/local/ulogd2/
##############################################################################

set -euo pipefail

INSTALL_PREFIX="/usr/local/ulogd2"
BUILD_DIR="/tmp/ulogd2-build"
ULOGD2_VERSION="2.0.8"
ULOGD2_URL="https://www.netfilter.org/projects/ulogd/files/ulogd-${ULOGD2_VERSION}.tar.bz2"

echo "=============================================="
echo "  ulogd2 Build for StaySuite-HospitalityOS"
echo "  Version: ${ULOGD2_VERSION}"
echo "  Install: ${INSTALL_PREFIX}"
echo "=============================================="

# ─── Prerequisites ──────────────────────────────────────────────────────
echo ""
echo "[1/6] Installing build dependencies..."

if command -v dnf &>/dev/null; then
    dnf install -y \
        gcc make autoconf automake libtool \
        libnetfilter_acct-devel libnetfilter_conntrack-devel \
        libnetfilter_log-devel libnfnetlink-devel \
        json-c-devel libpcap-devel sqlite-devel \
        2>&1 | tail -5
elif command -v apt-get &>/dev/null; then
    apt-get install -y \
        gcc make autoconf automake libtool \
        libnetfilter-acct-dev libnetfilter-conntrack-dev \
        libnetfilter-log-dev libnfnetlink-dev \
        libjson-c-dev libpcap-dev libsqlite3-dev \
        2>&1 | tail -5
else
    echo "WARNING: Unknown package manager. Install deps manually."
fi

echo "  Done."

# ─── Download Source ────────────────────────────────────────────────────
echo ""
echo "[2/6] Downloading ulogd2 ${ULOGD2_VERSION}..."

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

if [ -f "tools/ulogd2-clickhouse/ulogd-${ULOGD2_VERSION}.tar.bz2" ]; then
    echo "  Using cached source tarball..."
    cp "tools/ulogd2-clickhouse/ulogd-${ULOGD2_VERSION}.tar.bz2" "$BUILD_DIR/"
else
    curl -fSL "$ULOGD2_URL" -o "$BUILD_DIR/ulogd-${ULOGD2_VERSION}.tar.bz2"
fi

cd "$BUILD_DIR"
tar xjf "ulogd-${ULOGD2_VERSION}.tar.bz2"
cd "ulogd-${ULOGD2_VERSION}"

echo "  Source extracted."

# ─── Configure ──────────────────────────────────────────────────────────
echo ""
echo "[3/6] Configuring ulogd2..."

./configure \
    --prefix="$INSTALL_PREFIX" \
    --sysconfdir="$INSTALL_PREFIX/etc" \
    --localstatedir=/var \
    --with-jsonc \
    --with-pcap \
    --with-sqlite3 \
    --enable-static=no \
    --enable-shared=yes \
    2>&1 | tail -10

echo "  Configuration complete."

# ─── Build ──────────────────────────────────────────────────────────────
echo ""
echo "[4/6] Building ulogd2..."

make -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | tail -5

echo "  Build complete."

# ─── Install ────────────────────────────────────────────────────────────
echo ""
echo "[5/6] Installing to ${INSTALL_PREFIX}..."

make install 2>&1 | tail -5

# Verify plugins
echo ""
echo "  Installed plugins:"
ls -la "$INSTALL_PREFIX/lib/ulogd/"*.so 2>/dev/null | awk '{print "    " $NF}' || echo "    WARNING: No .so plugins found!"

echo "  Installed binary: $(which ulogd2 2>/dev/null || echo "${INSTALL_PREFIX}/sbin/ulogd2")"
ls -la "$INSTALL_PREFIX/sbin/ulogd2" 2>/dev/null || ls -la "$INSTALL_PREFIX/sbin/ulogd" 2>/dev/null

# ─── Install Config ────────────────────────────────────────────────────
echo ""
echo "[6/6] Installing configuration..."

# Copy our config
if [ -f "tools/ulogd2-clickhouse/ulogd.conf" ]; then
    cp "tools/ulogd2-clickhouse/ulogd.conf" "$INSTALL_PREFIX/etc/ulogd.conf"
    echo "  Config installed to ${INSTALL_PREFIX}/etc/ulogd.conf"
else
    echo "  WARNING: tools/ulogd2-clickhouse/ulogd.conf not found"
fi

# Create log directory
mkdir -p /var/log/ulogd
chmod 755 /var/log/ulogd

# Create JSON output directory
mkdir -p /var/log/ulogd/json
chmod 755 /var/log/ulogd/json

# Cleanup
cd /
rm -rf "$BUILD_DIR"

echo ""
echo "=============================================="
echo "  ulogd2 Build Complete!"
echo "=============================================="
echo ""
echo "  Binary:    ${INSTALL_PREFIX}/sbin/ulogd2"
echo "  Config:    ${INSTALL_PREFIX}/etc/ulogd.conf"
echo "  Plugins:   ${INSTALL_PREFIX}/lib/ulogd/"
echo "  Log dir:   /var/log/ulogd/"
echo ""
echo "  Next steps:"
echo "    1. Review config: ${INSTALL_PREFIX}/etc/ulogd.conf"
echo "    2. Start ulogd2:  ${INSTALL_PREFIX}/sbin/ulogd2 -c ${INSTALL_PREFIX}/etc/ulogd.conf"
echo "    3. NFLOG rules must be loaded via defaultchains_cryptsk.sh"
echo "    4. sni-parser reads /var/log/ulogd/json/sni-queries.log"
echo ""
