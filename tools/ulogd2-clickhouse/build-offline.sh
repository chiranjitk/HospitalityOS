#!/bin/bash
##############################################################################
#  ulogd2 Offline Build Script — StaySuite-HospitalityOS
#
#  Builds ulogd2 + ALL dependencies from local source tarballs.
#  Designed for Rocky Linux 10 (no internet required after download).
#
#  Build Order (dependency chain):
#    1. libnfnetlink  — base netfilter library
#    2. libmnl        — minimalistic netlink library
#    3. libnetfilter_log      — NFLOG input plugin
#    4. libnetfilter_conntrack — conntrack input plugin
#    5. libnetfilter_acct     — accounting plugin
#    6. jansson               — JSON output plugin (autotools)
#    7. libpcap              — PCAP output plugin
#    8. ulogd2               — the daemon itself
#
#  IMPORTANT: ulogd2 2.0.8 JSON plugin uses libjansson (NOT json-c).
#  PKG_CHECK_MODULES([libjansson], [jansson]) in configure.ac.
#
#  Usage:
#    bash tools/ulogd2-clickhouse/build-offline.sh
#
#  System Requirements (Rocky Linux 10):
#    dnf install -y gcc make autoconf automake libtool flex bison
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
BUILD_DIR="/tmp/ulogd2-build"
INSTALL_PREFIX="/usr/local/ulogd2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { echo -e "\n${GREEN}[$(date +%H:%M:%S)] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_err()  { echo -e "${RED}[ERROR] $1${NC}"; }

# ─── Pre-flight Checks ────────────────────────────────────────────────────

echo "=============================================="
echo "  ulogd2 Offline Build — StaySuite-HospitalityOS"
echo "  Install prefix: ${INSTALL_PREFIX}"
echo "=============================================="

# Check for build tools
for tool in gcc make; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log_err "$tool not found. Install: dnf install -y gcc make autoconf automake libtool flex bison"
    exit 1
  fi
done

for tool in autoconf automake libtool; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log_warn "$tool not found — some autotools builds may fail"
  fi
done
echo "Build tools: OK"

# Check source directory
if [ ! -d "$SRC_DIR" ] || [ -z "$(ls "$SRC_DIR"/*.tar.* 2>/dev/null)" ]; then
  log_err "No source tarballs found in $SRC_DIR"
  log_err "Run first: bash tools/ulogd2-clickhouse/download-deps.sh"
  exit 1
fi

echo "Source tarballs: $(ls "$SRC_DIR"/*.tar.* 2>/dev/null | wc -l) files"

# ─── Setup Build Environment ─────────────────────────────────────────────

log_step "Setting up build environment..."

# Ensure we have flex/bison
if command -v dnf >/dev/null 2>&1; then
  dnf install -y flex bison gcc-c++ zlib-devel 2>/dev/null | tail -3 || true
fi

# Export paths so later configure scripts find our built libs
export PKG_CONFIG_PATH="${INSTALL_PREFIX}/lib/pkgconfig:${INSTALL_PREFIX}/lib64/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="${INSTALL_PREFIX}/lib:${INSTALL_PREFIX}/lib64:${LD_LIBRARY_PATH:-}"
export CFLAGS="-I${INSTALL_PREFIX}/include ${CFLAGS:-}"
export CPPFLAGS="-I${INSTALL_PREFIX}/include ${CPPFLAGS:-}"
export LDFLAGS="-L${INSTALL_PREFIX}/lib -L${INSTALL_PREFIX}/lib64 -Wl,-rpath,${INSTALL_PREFIX}/lib ${LDFLAGS:-}"

# Create build area
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$INSTALL_PREFIX/lib/pkgconfig"
mkdir -p "$INSTALL_PREFIX/lib64/pkgconfig"

echo "PKG_CONFIG_PATH=$PKG_CONFIG_PATH"
echo "CFLAGS=$CFLAGS"
echo "LDFLAGS=$LDFLAGS"

# ─── Helper: Find extracted directory ────────────────────────────────────

# After `tar xf`, find the top-level directory that was created.
# Handles double-name prefixes from GitHub (e.g., libpcap-libpcap-1.10.5)
find_extracted_dir() {
  local latest=""
  for d in "$BUILD_DIR"/*/; do
    [ -d "$d" ] || continue
    if [ "$latest" = "" ] || [ "$d" -nt "$latest" ]; then
      latest="$d"
    fi
  done
  if [ -n "$latest" ] && [ -d "$latest" ]; then
    echo "${latest%/}"
    return 0
  fi
  return 1
}

# ─── Helper: Build an autotools project ──────────────────────────────────

build_autotools() {
  local name="$1"
  local tarball="$2"
  shift 2
  local configure_args="$*"

  log_step "Building: $name (autotools)"

  if [ ! -f "$SRC_DIR/$tarball" ]; then
    log_err "  Source not found: $SRC_DIR/$tarball"
    return 1
  fi

  # Clear BUILD_DIR to make find_extracted_dir work
  cd "$BUILD_DIR"
  rm -rf "${BUILD_DIR:?}"/*

  log_step "  Extracting $tarball..."
  tar xf "$SRC_DIR/$tarball" 2>&1

  local extracted_dir
  extracted_dir=$(find_extracted_dir)
  if [ -z "$extracted_dir" ] || [ ! -d "$extracted_dir" ]; then
    log_err "  Failed to extract $tarball"
    return 1
  fi

  log_step "  Build dir: $(basename "$extracted_dir")"
  cd "$extracted_dir"

  # Run autoreconf if no configure script
  if [ ! -x ./configure ]; then
    if [ -f configure.ac ] || [ -f configure.in ]; then
      log_step "  Running autoreconf..."
      autoreconf -fi 2>&1 | tail -3
    else
      log_err "  No configure.ac and no ./configure — cannot build with autotools"
      return 1
    fi
  fi

  log_step "  Configuring..."
  ./configure \
    --prefix="$INSTALL_PREFIX" \
    --libdir="${INSTALL_PREFIX}/lib" \
    --includedir="${INSTALL_PREFIX}/include" \
    --enable-shared=yes \
    --enable-static=no \
    $configure_args \
    2>&1 | tail -8

  log_step "  Compiling..."
  make -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | tail -3

  log_step "  Installing to $INSTALL_PREFIX..."
  make install 2>&1 | tail -3

  # Post-install fixes
  ldconfig 2>/dev/null || true
  if [ -d "${INSTALL_PREFIX}/lib64/pkgconfig" ]; then
    cp -f "${INSTALL_PREFIX}/lib64/pkgconfig/"*.pc "${INSTALL_PREFIX}/lib/pkgconfig/" 2>/dev/null || true
  fi

  log_step "  ✓ $name built and installed"
  return 0
}

# ─── Build Dependencies (in order) ──────────────────────────────────────

BUILD_ERRORS=0

# 1. libnfnetlink (no deps — base library, autotools)
build_autotools "libnfnetlink" "libnfnetlink-1.0.2.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 2. libmnl (no deps — minimal netlink, autotools)
build_autotools "libmnl" "libmnl-1.0.5.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 3. libnetfilter_log (depends on libnfnetlink, autotools)
build_autotools "libnetfilter_log" "libnetfilter_log-1.0.2.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 4. libnetfilter_conntrack (depends on libnfnetlink, autotools)
build_autotools "libnetfilter_conntrack" "libnetfilter_conntrack-1.0.9.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 5. libnetfilter_acct (depends on libnfnetlink, autotools)
build_autotools "libnetfilter_acct" "libnetfilter_acct-1.0.3.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 6. jansson — JSON library for ulogd2 JSON output plugin (autotools)
#    ulogd2 2.0.8 configure.ac: PKG_CHECK_MODULES([libjansson], [jansson])
#    Produces jansson.pc → pkg-config finds "jansson" module
#    Plugin file: ulogd_output_JSON.so, registers as .name = "JSON"
build_autotools "jansson" "jansson-2.14.tar.gz" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# ─── Verify jansson is findable via pkg-config ──────────────────────────
log_step "Verifying jansson pkg-config..."
if command -v pkg-config >/dev/null 2>&1; then
  if pkg-config --exists jansson 2>/dev/null; then
    echo "  ✓ pkg-config finds jansson"
    echo "    pkg-config --cflags jansson: $(pkg-config --cflags jansson)"
    echo "    pkg-config --libs jansson: $(pkg-config --libs jansson)"
  else
    log_err "  pkg-config cannot find jansson!"
    log_err "  Checking .pc files:"
    find "${INSTALL_PREFIX}" -name "jansson*.pc" -type f 2>/dev/null | while read -r pc; do
      echo "    Found: $pc"
      cat "$pc" | sed 's/^/      /'
    done
    log_err "  ulogd2 JSON plugin will NOT build without jansson"
  fi
fi

# 7. libpcap (no deps — autotools)
#    GitHub tarball extracts to libpcap-libpcap-1.10.5/ (double name)
build_autotools "libpcap" "libpcap-1.10.5.tar.gz" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# ─── Verify critical libraries before building ulogd2 ────────────────────

log_step "Verifying dependency libraries..."

CRITICAL_OK=true
for lib in nfnetlink netfilter_log jansson; do
  if [ -f "${INSTALL_PREFIX}/lib/lib${lib}.so" ] || [ -f "${INSTALL_PREFIX}/lib64/lib${lib}.so" ]; then
    echo "  ✓ lib${lib}"
  else
    echo "  ✗ lib${lib} — NOT FOUND"
    CRITICAL_OK=false
  fi
done

if [ "$CRITICAL_OK" = false ]; then
  log_err "Critical libraries missing! ulogd2 build will likely fail."
  log_err "Check the build errors above for details."
fi

# ─── Build ulogd2 (the main target) ──────────────────────────────────────

log_step "Building ulogd2 (main target)..."

if [ ! -f "$SRC_DIR/ulogd-2.0.8.tar.bz2" ]; then
  log_err "ulogd2 source not found!"
  exit 1
fi

cd "$BUILD_DIR"
rm -rf "${BUILD_DIR:?}"/*
tar xf "$SRC_DIR/ulogd-2.0.8.tar.bz2"
cd "$BUILD_DIR/ulogd-2.0.8"

# Refresh PKG_CONFIG_PATH after all dep builds
export PKG_CONFIG_PATH="${INSTALL_PREFIX}/lib/pkgconfig:${INSTALL_PREFIX}/lib64/pkgconfig:${PKG_CONFIG_PATH:-}"

log_step "  Configuring ulogd2..."

# IMPORTANT configure flags for ulogd2 2.0.8:
#   --disable-pgsql:  pg_config exists on system but libpq-fe.h missing
#                    (would cause compile failure in output/pgsql/)
#   --disable-mysql:  no MySQL installed, avoid auto-detect noise
#   --disable-sqlite3: no SQLite3 installed
#   --disable-dbi:    no DBI installed
#
# NOTE: ulogd2 uses AC_ARG_ENABLE (not AC_ARG_WITH), so flags are
#       --disable-xxx (NOT --without-xxx). Passing --without-xxx is
#       silently ignored with "unrecognized options" warning.
#
# JSON plugin: auto-detected via PKG_CHECK_MODULES([libjansson], [jansson])
#   → requires jansson.pc in PKG_CONFIG_PATH (installed by step 6)
# PCAP plugin: auto-detected via PKG_CHECK_MODULES([libpcap], [libpcap])
#   → requires libpcap.pc in PKG_CONFIG_PATH (installed by step 7)

./configure \
  --prefix="$INSTALL_PREFIX" \
  --sysconfdir="$INSTALL_PREFIX/etc" \
  --libdir="${INSTALL_PREFIX}/lib" \
  --includedir="${INSTALL_PREFIX}/include" \
  --localstatedir=/var \
  --disable-pgsql \
  --disable-mysql \
  --disable-sqlite3 \
  --disable-dbi \
  --enable-static=no \
  --enable-shared=yes \
  2>&1 | tail -25

# Show what plugins were detected
echo ""
echo "  Plugin detection (check NFLOG and JSON lines above)"

log_step "  Compiling ulogd2..."
if ! make -j"$(nproc 2>/dev/null || echo 2)" 2>&1; then
  log_err "  ulogd2 compilation FAILED!"
  log_err "  Re-running: make V=1 2>&1 | tail -50"
  make V=1 2>&1 | tail -50
  log_err "  Common causes:"
  log_err "    - Missing jansson: JSON plugin = no"
  log_err "    - pg_config found but PostgreSQL headers missing"
  log_err "    - Check: pkg-config --cflags --libs jansson"
  exit 1
fi

log_step "  Installing ulogd2 to $INSTALL_PREFIX..."
make install 2>&1

# ─── Verify Installation ─────────────────────────────────────────────────

log_step "Verifying installation..."

echo ""
echo "  Binary:"
if [ -f "$INSTALL_PREFIX/sbin/ulogd" ]; then
  echo "    ✓ $INSTALL_PREFIX/sbin/ulogd"
  $INSTALL_PREFIX/sbin/ulogd -V 2>&1 | head -2 | sed 's/^/    /'
else
  echo "    ✗ ulogd binary NOT FOUND"
fi

echo ""
echo "  Plugins (.so):"
if ls "$INSTALL_PREFIX/lib/ulogd/"*.so 1>/dev/null 2>&1; then
  ls -la "$INSTALL_PREFIX/lib/ulogd/"*.so 2>/dev/null | while read line; do
    echo "    $(echo "$line" | awk '{print $NF}')"
  done
else
  echo "    ✗ No plugins found!"
fi

echo ""
echo "  Libraries (.so):"
for lib in libnfnetlink libmnl libnetfilter_log libnetfilter_conntrack libnetfilter_acct libjansson; do
  if [ -f "${INSTALL_PREFIX}/lib/${lib}.so" ]; then
    echo "    ✓ ${lib}.so"
  else
    echo "    ✗ ${lib}.so — MISSING"
  fi
done

# ─── Install Our Config ──────────────────────────────────────────────────

log_step "Installing StaySuite ulogd config..."
mkdir -p "$INSTALL_PREFIX/etc"
cp "$SCRIPT_DIR/ulogd.conf" "$INSTALL_PREFIX/etc/ulogd.conf"
echo "  Config installed to $INSTALL_PREFIX/etc/ulogd.conf"

# ─── Create Log Directories ─────────────────────────────────────────────

mkdir -p /var/log/ulogd/json
chmod 755 /var/log/ulogd /var/log/ulogd/json

# ─── Create Deployable tar.gz ────────────────────────────────────────────

log_step "Creating deployment package..."

DIST_DIR="$SCRIPT_DIR/dist"
mkdir -p "$DIST_DIR"

# Build a self-contained dist with binary + libs + config + init scripts
PACKAGE_DIR="/tmp/ulogd2-dist"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/ulogd2"

# Copy installed files
cp -a "$INSTALL_PREFIX"/* "$PACKAGE_DIR/ulogd2/" 2>/dev/null

# Copy init/service scripts
cp "$SCRIPT_DIR/ulogd2.init" "$PACKAGE_DIR/ulogd2/"
cp "$SCRIPT_DIR/ulogd2.service" "$PACKAGE_DIR/ulogd2/"

# Create a simple deploy script
cat > "$PACKAGE_DIR/ulogd2/deploy.sh" << 'DEPLOY_EOF'
#!/bin/bash
# Deploy ulogd2 to /usr/local/ulogd2 on target Rocky Linux 10 system
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="/usr/local"

echo "Deploying ulogd2 to ${TARGET}/ulogd2..."
cp -a "$SCRIPT_DIR" "${TARGET}/ulogd2"

# Create log dirs
mkdir -p /var/log/ulogd/json
chmod 755 /var/log/ulogd /var/log/ulogd/json

# Add to ldconfig
echo "${TARGET}/ulogd2/lib" > /etc/ld.so.conf.d/ulogd2.conf
ldconfig

# Install init script
cp "${TARGET}/ulogd2/ulogd2.init" /etc/rc.d/init.d/ulogd2
chmod +x /etc/rc.d/init.d/ulogd2
chkconfig --add ulogd2 2>/dev/null || true

# Install systemd unit (alternative)
cp "${TARGET}/ulogd2/ulogd2.service" /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true

# Load kernel modules
modprobe nfnetlink_log 2>/dev/null || true

echo ""
echo "Deploy complete! Verify:"
echo "  ldconfig -p | grep -E 'ulogd|nfnetlink|jansson'"
echo "  /usr/local/ulogd2/sbin/ulogd -V"
echo ""
echo "Start:"
echo "  /etc/rc.d/init.d/ulogd2 start"
echo "  OR: systemctl start ulogd2"
DEPLOY_EOF
chmod +x "$PACKAGE_DIR/ulogd2/deploy.sh"

# Create the tar.gz
DIST_TARBALL="$DIST_DIR/ulogd2-offline-compiled.tar.gz"
cd /tmp
tar czf "$DIST_TARBALL" ulogd2
DIST_SIZE=$(stat -c%s "$DIST_TARBALL")

log_step "Compiled package created:"
echo "  $DIST_TARBALL ($(numfmt --to=iec $DIST_SIZE 2>/dev/null || echo "${DIST_SIZE}B"))"

# ─── Create Source-only tar.gz (for offline rebuild) ────────────────────

SOURCE_TARBALL="$DIST_DIR/ulogd2-offline-sources.tar.gz"
cd "$SCRIPT_DIR"
tar czf "$SOURCE_TARBALL" \
  build-offline.sh \
  build.sh \
  download-deps.sh \
  ulogd.conf \
  ulogd2.init \
  ulogd2.service \
  src/
SRC_SIZE=$(stat -c%s "$SOURCE_TARBALL")

log_step "Source package created:"
echo "  $SOURCE_TARBALL ($(numfmt --to=iec $SRC_SIZE 2>/dev/null || echo "${SRC_SIZE}B"))"

# ─── Cleanup ─────────────────────────────────────────────────────────────

rm -rf "$BUILD_DIR" "$PACKAGE_DIR"

# ─── Final Summary ──────────────────────────────────────────────────────

echo ""
echo "=============================================="
echo "  Build Complete!"
echo "=============================================="
echo ""
echo "  Install prefix: $INSTALL_PREFIX"
echo ""

if [ "$BUILD_ERRORS" -gt 0 ]; then
  log_warn "  $BUILD_ERRORS dependency build(s) had errors"
  log_warn "  ulogd2 may have reduced functionality"
fi

# Check critical plugin — the JSON output plugin (ulogd_output_JSON.so)
# Plugin name registered as "JSON" in ulogd2 2.0.8
if [ -f "$INSTALL_PREFIX/lib/ulogd/ulogd_output_JSON.so" ]; then
  echo "  ✓ JSON plugin built — SNI capture pipeline ready"
else
  log_warn "  ✗ JSON plugin NOT built — check jansson installation"
  log_warn "    Expected: $INSTALL_PREFIX/lib/ulogd/ulogd_output_JSON.so"
fi

if [ -f "$INSTALL_PREFIX/lib/ulogd/ulogd_inppkt_NFLOG.so" ]; then
  echo "  ✓ NFLOG plugin built — nftables integration ready"
else
  log_warn "  ✗ NFLOG plugin NOT built"
fi

echo ""
echo "  On Rocky 10 — copy and deploy:"
echo "    scp dist/ulogd2-offline-compiled.tar.gz root@rocky10:/tmp/"
echo "    ssh root@rocky10 'cd /tmp && tar xzf ulogd2-offline-compiled.tar.gz && cd ulogd2 && bash deploy.sh'"
echo ""
echo "  Start:"
echo "    /etc/rc.d/init.d/ulogd2 start"
echo ""
