#!/bin/bash
###########################################################################
#  ulogd2 Production Installer — StaySuite HospitalityOS
#  Target OS : Rocky Linux 10 (nftables v1.1.1)
#
#  Installs compiled ulogd2 (from sandbox build) to production:
#    /opt/staysuite/ulogd2/
#
#  USAGE:
#    Option 1 — From the StaySuite repo (after git pull):
#      cd /opt/staysuite
#      bash tools/ulogd-build/install_ulogd2.sh
#
#    Option 2 — From a tarball / USB / custom source:
#      bash install_ulogd2.sh /path/to/ulogd-build
#
#    Option 3 — Force reinstall (stop service, wipe target, reinstall):
#      bash install_ulogd2.sh --force
#
#  WHAT IT INSTALLS:
#    /opt/staysuite/ulogd2/sbin/ulogd          (binary)
#    /opt/staysuite/ulogd2/lib/ulogd/*.so      (26 plugins)
#    /opt/staysuite/ulogd2/lib/*.so*           (shared deps)
#    /opt/staysuite/ulogd2/etc/ulogd.conf      (production config)
#    /opt/staysuite/ulogd2/log/                (json/pcap output)
#    /etc/ld.so.conf.d/staysuite-ulogd2.conf   (library path)
#    /etc/systemd/system/ulogd2.service        (systemd unit)
#
#  IDEMPOTENT: Safe to run multiple times. Uses --force to wipe+reinstall.
###########################################################################

set -euo pipefail

## ============================================================================
## CONFIGURATION
## ============================================================================
INSTALL_PREFIX="/opt/staysuite/ulogd2"
SERVICE_NAME="ulogd2"
LDCONF_FILE="/etc/ld.so.conf.d/staysuite-ulogd2.conf"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

# Resolve source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "${1:-}" = "--force" ]; then
    SRC_DIR="${SCRIPT_DIR}"
    FORCE=1
elif [ -n "${1:-}" ] && [ "${1:-}" != "--help" ]; then
    SRC_DIR="$(cd "$1" && pwd)"
    FORCE=0
else
    # Default: script is inside the ulogd-build directory itself
    SRC_DIR="${SCRIPT_DIR}"
    FORCE=0
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "Usage: $0 [--force] [SOURCE_DIR]"
    echo ""
    echo "Installs ulogd2 to ${INSTALL_PREFIX}"
    echo ""
    echo "Options:"
    echo "  --force      Stop service, wipe target, fresh install"
    echo "  SOURCE_DIR   Path to ulogd-build directory (default: script's own dir)"
    echo "  --help       Show this help"
    exit 0
fi

## ============================================================================
## PRE-FLIGHT CHECKS
## ============================================================================
echo "=========================================="
echo " ulogd2 Production Installer"
echo " Source : ${SRC_DIR}"
echo " Target : ${INSTALL_PREFIX}"
echo "=========================================="

# Check source
[ -x "${SRC_DIR}/install/sbin/ulogd" ] || { echo "ERROR: ulogd binary not found at ${SRC_DIR}/install/sbin/ulogd"; exit 1; }
[ -d "${SRC_DIR}/install/lib/ulogd" ] || { echo "ERROR: ulogd plugins not found at ${SRC_DIR}/install/lib/ulogd"; exit 1; }

# Check running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Must run as root (use sudo)"
    exit 1
fi

## ============================================================================
## STOP EXISTING SERVICE (if running)
## ============================================================================
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    echo "[1/7] Stopping existing ${SERVICE_NAME} service..."
    systemctl stop "${SERVICE_NAME}"
    sleep 1
else
    echo "[1/7] Service ${SERVICE_NAME} not running — skipping stop"
fi

# Kill any orphan processes
pkill -f "ulogd.*ulogd.conf" 2>/dev/null || true

## ============================================================================
## PREPARE TARGET DIRECTORIES
## ============================================================================
echo "[2/7] Creating target directories..."

if [ "$FORCE" -eq 1 ]; then
    echo "  --force: Wiping ${INSTALL_PREFIX}..."
    rm -rf "${INSTALL_PREFIX}"
fi

mkdir -p "${INSTALL_PREFIX}/sbin"
mkdir -p "${INSTALL_PREFIX}/lib/ulogd"
mkdir -p "${INSTALL_PREFIX}/etc"
mkdir -p "${INSTALL_PREFIX}/log"

## ============================================================================
## INSTALL BINARY
## ============================================================================
echo "[3/7] Installing ulogd binary..."
cp -f "${SRC_DIR}/install/sbin/ulogd" "${INSTALL_PREFIX}/sbin/ulogd"
chmod 755 "${INSTALL_PREFIX}/sbin/ulogd"
echo "  → ${INSTALL_PREFIX}/sbin/ulogd"

## ============================================================================
## INSTALL PLUGINS (.so files only — skip .la build artifacts)
## ============================================================================
echo "[4/7] Installing ulogd plugins..."
plugin_count=0
for so_file in "${SRC_DIR}/install/lib/ulogd/"*.so; do
    [ -f "$so_file" ] || continue
    cp -f "$so_file" "${INSTALL_PREFIX}/lib/ulogd/"
    chmod 755 "${INSTALL_PREFIX}/lib/ulogd/$(basename "$so_file")"
    plugin_count=$((plugin_count + 1))
done
echo "  → ${plugin_count} plugins installed to ${INSTALL_PREFIX}/lib/ulogd/"

## ============================================================================
## INSTALL SHARED LIBRARIES (only runtime .so files — skip .a, .la, pkgconfig)
## ============================================================================
echo "[5/7] Installing shared library dependencies..."
lib_count=0
for so_file in "${SRC_DIR}/install/lib/"*.so*; do
    # Skip .a (static), .la (libtool), and anything inside ulogd/ subdirectory
    case "$so_file" in
        *.a|*.la) continue ;;
        */ulogd/*|*/pkgconfig/*) continue ;;
    esac
    [ -f "$so_file" ] || continue
    cp -f "$so_file" "${INSTALL_PREFIX}/lib/"
    chmod 755 "${INSTALL_PREFIX}/lib/$(basename "$so_file")"
    lib_count=$((lib_count + 1))
done
echo "  → ${lib_count} shared libraries installed to ${INSTALL_PREFIX}/lib/"

## ============================================================================
## FIX LIBRARY SYMLINKS
## The sandbox build copies real files instead of creating symlinks.
## ldconfig expects .so.1 → .so.1.x.y symlink chain. Fix it:
##   1. Keep only the fully-versioned real files (e.g., libpcap.so.1.10.6)
##   2. Delete the short-name copies (e.g., libpcap.so.1)
##   3. Let ldconfig recreate proper symlinks
## ============================================================================
echo "      Fixing library symlinks..."
for real_file in "${INSTALL_PREFIX}/lib/".so.*.*.*; do
    [ -f "$real_file" ] || continue
    base=$(basename "$real_file")
    # Extract .so.X.Y from .so.X.Y.Z (e.g., libpcap.so.1.10 from libpcap.so.1.10.6)
    short_ver=$(echo "$base" | sed -E 's/(\.[0-9]+\.[0-9]+)\.[0-9]+$/\1/')
    short_unversioned=$(echo "$base" | sed -E 's/(\.so)$/\1/')
    # Remove the .so.X copy if it's a real file (not a symlink)
    if [ -f "${INSTALL_PREFIX}/lib/${short_ver}" ] && [ ! -L "${INSTALL_PREFIX}/lib/${short_ver}" ]; then
        rm -f "${INSTALL_PREFIX}/lib/${short_ver}"
    fi
    # Remove the .so copy if it's a real file (not a symlink)
    if [ -f "${INSTALL_PREFIX}/lib/${short_unversioned}" ] && [ ! -L "${INSTALL_PREFIX}/lib/${short_unversioned}" ]; then
        rm -f "${INSTALL_PREFIX}/lib/${short_unversioned}"
    fi
done

## ============================================================================
## INSTALL CONFIG (rewrite paths for production)
## ============================================================================
echo "[6/7] Installing production ulogd.conf..."

if [ -f "${SRC_DIR}/ulogd.conf" ]; then
    # Copy the repo config and rewrite all sandbox paths to production paths
    sed \
        -e "s|${SRC_DIR}/install/lib/ulogd/|${INSTALL_PREFIX}/lib/ulogd/|g" \
        -e "s|${SRC_DIR}/log/|${INSTALL_PREFIX}/log/|g" \
        -e "s|/home/z/my-project/tools/ulogd-build/|${INSTALL_PREFIX}/|g" \
        "${SRC_DIR}/ulogd.conf" > "${INSTALL_PREFIX}/etc/ulogd.conf"
else
    echo "  WARNING: ulogd.conf not found in source — generating default..."
    cat > "${INSTALL_PREFIX}/etc/ulogd.conf" <<EOFCONF
# ulogd.conf - StaySuite HospitalityOS (Production)
# Auto-generated by install_ulogd2.sh

[global]
logfile="${INSTALL_PREFIX}/log/ulogd.log"
loglevel=5

# Input plugins
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_inppkt_NFLOG.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_inpflow_NFCT.so"

# Filter plugins
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_raw2packet_BASE.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_filter_IFINDEX.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_filter_IP2STR.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_filter_HWHDR.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_filter_PRINTFLOW.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_filter_PRINTSNI.so"

# Output plugins
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_output_JSON.so"
plugin="${INSTALL_PREFIX}/lib/ulogd/ulogd_output_PCAP.so"

# Stack 1: Connection tracking flow logging (NFCT -> JSON)
stack=ct1:NFCT,ct_ip:IP2STR,ct_print:PRINTFLOW,ct_json:JSON

# Stack 2: Packet logging (NFLOG -> JSON)
# nftables: nft add rule inet mangle prerouting log group 10
stack=pkt1:NFLOG,pkt_base:BASE,pkt_if:IFINDEX,pkt_ip:IP2STR,pkt_mac:HWHDR,pkt_json:JSON

# Stack 3: TLS SNI extraction (NFLOG -> PRINTSNI -> JSON)
# nftables: nft add rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500
stack=sni:NFLOG,sni_sni:PRINTSNI,sni_json:JSON

# Stack 4: Raw TLS PCAP capture
stack=sni_pcap:NFLOG,sni_pcap_base:BASE,sni_pcap_out:PCAP

[ct1]
[ct_json]
file="${INSTALL_PREFIX}/log/flow.json"
sync=1
timestamp=1

[pkt1]
group=10
[pkt_json]
file="${INSTALL_PREFIX}/log/packet.json"
sync=1
timestamp=1

[sni]
group=20
[sni_json]
file="${INSTALL_PREFIX}/log/sni.json"
sync=1
timestamp=1

[sni_pcap]
group=20
[sni_pcap_out]
file="${INSTALL_PREFIX}/log/sni_raw.pcap"
sync=1
EOFCONF
fi
chmod 644 "${INSTALL_PREFIX}/etc/ulogd.conf"
echo "  → ${INSTALL_PREFIX}/etc/ulogd.conf"

## ============================================================================
## SYSTEMD SERVICE + LDCONFIG
## ============================================================================
echo "[7/7] Configuring systemd and library paths..."

# ldconfig — register shared libraries system-wide
echo "${INSTALL_PREFIX}/lib" > "${LDCONF_FILE}"
chmod 644 "${LDCONF_FILE}"
ldconfig
echo "  → ${LDCONF_FILE} (ldconfig updated)"

# Create systemd service
cat > "${SYSTEMD_UNIT}" <<EOFUNIT
[Unit]
Description=ulogd2 - Netfilter Logging Daemon (StaySuite HospitalityOS)
Documentation=man:ulogd(8)
After=network-online.target network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_PREFIX}/sbin/ulogd -c ${INSTALL_PREFIX}/etc/ulogd.conf
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
TimeoutStopSec=10
LimitNOFILE=65536
Nice=-5

# Security hardening
NoNewPrivileges=false
ProtectSystem=false
ProtectHome=false

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ulogd2

[Install]
WantedBy=multi-user.target
EOFUNIT
chmod 644 "${SYSTEMD_UNIT}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" 2>/dev/null
echo "  → ${SYSTEMD_UNIT} (enabled)"

## ============================================================================
## VERIFY INSTALLATION
## ============================================================================
echo ""
echo "=========================================="
echo " Installation Complete"
echo "=========================================="
echo ""
echo " Binary    : $(ls -lh "${INSTALL_PREFIX}/sbin/ulogd" 2>/dev/null | awk '{print $NF, $5}')"
echo " Plugins   : $(ls "${INSTALL_PREFIX}/lib/ulogd/"*.so 2>/dev/null | wc -l) .so files"
echo " Libraries : $(ls "${INSTALL_PREFIX}/lib/"*.so 2>/dev/null | wc -l) .so files"
echo " Config    : ${INSTALL_PREFIX}/etc/ulogd.conf"
echo " Log dir   : ${INSTALL_PREFIX}/log/"
echo " Service   : ${SERVICE_NAME} (systemd enabled)"
echo ""

# Verify binary can load
if "${INSTALL_PREFIX}/sbin/ulogd" -v 2>/dev/null; then
    ULOGD_VER=$("${INSTALL_PREFIX}/sbin/ulogd" -v 2>/dev/null || echo "unknown")
    echo " Version   : ${ULOGD_VER}"
fi

echo ""
echo " nftables rules (already in defaultchains_cryptsk.sh):"
echo "   nft add rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500"
echo "   nft add rule inet mangle prerouting tcp dport 80 tcp flags & (syn|rst|fin) == 0 log group 21 snaplen 1500"
echo "   nft add rule inet mangle prerouting udp dport 53 log group 22 snaplen 512"
echo ""
echo " Commands:"
echo "   systemctl start ${SERVICE_NAME}    # Start ulogd2"
echo "   systemctl status ${SERVICE_NAME}   # Check status"
echo "   journalctl -u ${SERVICE_NAME} -f   # Follow logs"
echo ""
echo " To start now: systemctl start ${SERVICE_NAME}"
