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
#    5. libnetfilter_acct     — accounting input plugin
#    6. json-c               — JSONLOG output plugin
#    7. libpcap              — PCAP output plugin
#    8. ulogd2               — the daemon itself
#
#  Usage:
#    bash tools/ulogd2-clickhouse/build-offline.sh
#
#  Output:
#    /usr/local/ulogd2/  — installed binary + plugins + config
#    dist/               — self-contained tar.gz for deployment
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
for tool in gcc make autoconf automake libtool; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log_err "$tool not found. Install: dnf install -y gcc make autoconf automake libtool flex bison"
    exit 1
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

# Ensure we have flex/bison for some dependency parsers
if command -v dnf >/dev/null 2>&1; then
  dnf install -y flex bison gcc-c++ zlib-devel 2>/dev/null | tail -3 || true
fi

# Export PKG_CONFIG_PATH so later configure scripts find our built libs
export PKG_CONFIG_PATH="${INSTALL_PREFIX}/lib/pkgconfig:${INSTALL_PREFIX}/lib64/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="${INSTALL_PREFIX}/lib:${INSTALL_PREFIX}/lib64:${LD_LIBRARY_PATH:-}"
export CFLAGS="-I${INSTALL_PREFIX}/include ${CFLAGS:-}"
export LDFLAGS="-L${INSTALL_PREFIX}/lib -L${INSTALL_PREFIX}/lib64 -Wl,-rpath,${INSTALL_PREFIX}/lib ${LDFLAGS:-}"

# Create build area
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$INSTALL_PREFIX/lib/pkgconfig"
mkdir -p "$INSTALL_PREFIX/lib64/pkgconfig"

echo "PKG_CONFIG_PATH=$PKG_CONFIG_PATH"
echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
echo "CFLAGS=$CFLAGS"
echo "LDFLAGS=$LDFLAGS"

# ─── Helper: Build a generic autotools project ───────────────────────────

build_project() {
  local name="$1"
  local tarball="$2"
  local configure_args="${3:-}"

  log_step "Building: $name"

  if [ ! -f "$SRC_DIR/$tarball" ]; then
    log_err "Source not found: $SRC_DIR/$tarball"
    return 1
  fi

  # Extract
  cd "$BUILD_DIR"
  rm -rf "${name}"*

  local ext=""
  case "$tarball" in
    *.tar.bz2) ext=".tar.bz2" ;;
    *.tar.gz)  ext=".tar.gz" ;;
    *.tar.xz)  ext=".tar.xz" ;;
  esac

  local base_name="${tarball%$ext}"
  log_step "  Extracting $tarball..."

  tar xf "$SRC_DIR/$tarball" 2>&1

  # Find the extracted directory (may have version suffix)
  local extracted_dir=""
  for d in "$BUILD_DIR"/${base_name}*; do
    [ -d "$d" ] && extracted_dir="$d" && break
  done

  if [ -z "$extracted_dir" ] || [ ! -d "$extracted_dir" ]; then
    log_err "  Failed to extract $tarball"
    return 1
  fi

  cd "$extracted_dir"

  # Run autoreconf if no configure script (common for git archives)
  if [ ! -x ./configure ]; then
    log_step "  Running autoreconf..."
    autoreconf -fi 2>&1 | tail -3
  fi

  # Configure
  log_step "  Configuring..."
  ./configure \
    --prefix="$INSTALL_PREFIX" \
    --libdir="${INSTALL_PREFIX}/lib" \
    --includedir="${INSTALL_PREFIX}/include" \
    --enable-shared=yes \
    --enable-static=no \
    $configure_args \
    2>&1 | tail -5

  # Build
  log_step "  Compiling..."
  make -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | tail -3

  # Install
  log_step "  Installing to $INSTALL_PREFIX..."
  make install 2>&1 | tail -3

  # Update library cache
  if [ -d "${INSTALL_PREFIX}/lib" ]; then
    ldconfig 2>/dev/null || true
  fi

  # Fix pkg-config files if they were installed to lib64 instead of lib
  if [ -d "${INSTALL_PREFIX}/lib64/pkgconfig" ]; then
    cp -f "${INSTALL_PREFIX}/lib64/pkgconfig/"*.pc "${INSTALL_PREFIX}/lib/pkgconfig/" 2>/dev/null || true
  fi

  log_step "  ✓ $name built and installed"
  return 0
}

# ─── Build Dependencies (in order) ──────────────────────────────────────

BUILD_ERRORS=0

# 1. libnfnetlink (no deps — base library)
build_project "libnfnetlink" "libnfnetlink-1.0.2.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 2. libmnl (no deps — minimal netlink)
build_project "libmnl" "libmnl-1.0.5.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 3. libnetfilter_log (depends on libnfnetlink)
build_project "libnetfilter_log" "libnetfilter_log-1.0.2.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 4. libnetfilter_conntrack (depends on libnfnetlink)
build_project "libnetfilter_conntrack" "libnetfilter_conntrack-1.0.9.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 5. libnetfilter_acct (depends on libnfnetlink)
build_project "libnetfilter_acct" "libnetfilter_acct-1.0.3.tar.bz2" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 6. json-c (no deps)
build_project "json-c" "json-c-0.17.tar.gz" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# 7. libpcap (no deps)
build_project "libpcap" "libpcap-1.10.5.tar.gz" "" || BUILD_ERRORS=$((BUILD_ERRORS + 1))

# ─── Build ulogd2 (the main target) ──────────────────────────────────────

log_step "Building ulogd2 (main target)..."

if [ ! -f "$SRC_DIR/ulogd-2.0.8.tar.bz2" ]; then
  log_err "ulogd2 source not found!"
  exit 1
fi

cd "$BUILD_DIR"
rm -rf ulogd-2.0.8*
tar xf "$SRC_DIR/ulogd-2.0.8.tar.bz2"
cd "$BUILD_DIR/ulogd-2.0.8"

# Refresh PKG_CONFIG_PATH after building all deps
export PKG_CONFIG_PATH="${INSTALL_PREFIX}/lib/pkgconfig:${INSTALL_PREFIX}/lib64/pkgconfig:${PKG_CONFIG_PATH:-}"

log_step "  Configuring ulogd2..."

./configure \
  --prefix="$INSTALL_PREFIX" \
  --sysconfdir="$INSTALL_PREFIX/etc" \
  --libdir="${INSTALL_PREFIX}/lib" \
  --includedir="${INSTALL_PREFIX}/include" \
  --localstatedir=/var \
  --with-jsonc \
  --with-pcap \
  --enable-static=no \
  --enable-shared=yes \
  2>&1 | tail -15

log_step "  Compiling ulogd2..."
make -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | tail -5

log_step "  Installing ulogd2 to $INSTALL_PREFIX..."
make install 2>&1 | tail -5

# ─── Verify Installation ─────────────────────────────────────────────────

log_step "Verifying installation..."

echo ""
echo "  Binary:"
ls -la "$INSTALL_PREFIX/sbin/ulogd" 2>/dev/null || ls -la "$INSTALL_PREFIX/sbin/ulogd2" 2>/dev/null || echo "    WARNING: ulogd2 binary not found in sbin/"

echo ""
echo "  Plugins (.so):"
ls -la "$INSTALL_PREFIX/lib/ulogd/"*.so 2>/dev/null | while read line; do
  echo "    $(echo "$line" | awk '{print $NF}')"
done || echo "    WARNING: No .so plugins found!"

echo ""
echo "  Libraries (.so):"
ls -la "$INSTALL_PREFIX/lib/"lib{nfnetlink,mnl,netfilter*,json-c,pcap}*.so* 2>/dev/null | while read line; do
  echo "    $(echo "$line" | awk '{print $NF}')"
done || echo "    WARNING: No shared libraries found!"

echo ""
echo "  Config: $INSTALL_PREFIX/etc/ulogd.conf"
ls -la "$INSTALL_PREFIX/etc/ulogd.conf" 2>/dev/null || echo "    (will be installed from tools/ulogd2-clickhouse/ulogd.conf)"

# ─── Install Our Config ──────────────────────────────────────────────────

log_step "Installing StaySuite ulogd config..."
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

# Update library cache
ldconfig

# Install init script
cp "${TARGET}/ulogd2/ulogd2.init" /etc/rc.d/init.d/ulogd2
chmod +x /etc/rc.d/init.d/ulogd2
chkconfig --add ulogd2 2>/dev/null || true

# Install systemd unit (alternative)
cp "${TARGET}/ulogd2/ulogd2.service" /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true

echo "Deploy complete! Start with:"
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

echo "  What to copy to Rocky 10:"
echo "    dist/ulogd2-offline-compiled.tar.gz"
echo "      → Extract and run deploy.sh (binary + libs, no build needed)"
echo ""
echo "    dist/ulogd2-offline-sources.tar.gz"
echo "      → For full rebuild from source (bash build-offline.sh)"
echo ""
echo "  Start ulogd2:"
echo "    /usr/local/ulogd2/sbin/ulogd2 -c /usr/local/ulogd2/etc/ulogd.conf"
echo ""
