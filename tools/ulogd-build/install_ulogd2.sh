#!/bin/bash
###########################################################################
#  ulogd2 Production Installer — StaySuite HospitalityOS
#  Target OS : Rocky Linux 10 (nftables v1.1.1)
#
#  Installs compiled ulogd2 (from sandbox build) to standard FHS paths:
#    /usr/local/sbin/ulogd           (binary — on $PATH)
#    /usr/local/lib/ulogd/*.so       (26 plugins)
#    /usr/local/lib/*.so*            (shared deps — ldconfig handles symlinks)
#    /usr/local/etc/ulogd.conf       (production config)
#    /var/log/ulogd2/                (json/pcap output)
#    /etc/systemd/system/ulogd2.service
#
#  USAGE:
#    cd /opt/staysuite
#    bash tools/ulogd-build/install_ulogd2.sh           # install
#    bash tools/ulogd-build/install_ulogd2.sh --force   # clean reinstall
#    bash tools/ulogd-build/install_ulogd2.sh --uninstall
#
#  IDEMPOTENT: Safe to run multiple times.
###########################################################################

set -euo pipefail

## ============================================================================
## STANDARD FHS PATHS
## ============================================================================
BIN_PATH="/usr/local/sbin/ulogd"
PLUGIN_DIR="/usr/local/lib/ulogd"
LIB_DIR="/usr/local/lib"
CONF_PATH="/usr/local/etc/ulogd.conf"
LOG_DIR="/var/log/ulogd2"
SERVICE_NAME="ulogd2"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
LDCONF_FILE="/etc/ld.so.conf.d/staysuite-ulogd2.conf"

# Resolve source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "${1:-}" = "--force" ]; then
    SRC_DIR="${SCRIPT_DIR}"
    FORCE=1
elif [ "${1:-}" = "--uninstall" ]; then
    # ── UNINSTALL ─────────────────────────────────────────────
    if [ "$(id -u)" -ne 0 ]; then echo "ERROR: Must run as root"; exit 1; fi
    echo "Uninstalling ulogd2..."
    systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    rm -f "${SYSTEMD_UNIT}"
    systemctl daemon-reload 2>/dev/null || true
    rm -f "${BIN_PATH}"
    rm -rf "${PLUGIN_DIR}"
    rm -f "${LIB_DIR}"/libnfnetlink* "${LIB_DIR}"/libnetfilter_* "${LIB_DIR}"/libpcap* \
          "${LIB_DIR}"/libmnl* "${LIB_DIR}"/libltdl* "${LIB_DIR}"/libjansson* \
          "${LIB_DIR}"/libfl*
    rm -f "${LDCONF_FILE}"
    ldconfig 2>/dev/null || true
    rm -f "${CONF_PATH}"
    echo "Done. Removed binary, plugins, shared libs, config, systemd unit."
    exit 0
elif [ -n "${1:-}" ] && [ "${1:-}" != "--help" ]; then
    SRC_DIR="$(cd "$1" && pwd)"
    FORCE=0
else
    SRC_DIR="${SCRIPT_DIR}"
    FORCE=0
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    cat <<EOF
Usage: $0 [--force] [--uninstall] [SOURCE_DIR]

Installs ulogd2 to standard Linux paths:
  ${BIN_PATH}
  ${PLUGIN_DIR}/*.so
  ${LIB_DIR}/*.so*
  ${CONF_PATH}
  ${LOG_DIR}/

Options:
  --force      Stop service, remove old files, fresh install
  --uninstall  Stop service, remove all installed files
  SOURCE_DIR   Path to ulogd-build directory (default: script's own dir)
  --help       Show this help
EOF
    exit 0
fi

## ============================================================================
## PRE-FLIGHT CHECKS
## ============================================================================
echo "=========================================="
echo " ulogd2 Production Installer"
echo " Source : ${SRC_DIR}"
echo "=========================================="
echo " Install paths:"
echo "   Binary  : ${BIN_PATH}"
echo "   Plugins : ${PLUGIN_DIR}/"
echo "   Libs    : ${LIB_DIR}/"
echo "   Config  : ${CONF_PATH}"
echo "   Logs    : ${LOG_DIR}/"
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
## STOP EXISTING SERVICE
## ============================================================================
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    echo "[1/7] Stopping existing ${SERVICE_NAME} service..."
    systemctl stop "${SERVICE_NAME}"
    sleep 1
else
    echo "[1/7] Service ${SERVICE_NAME} not running — skipping stop"
fi
pkill -f "ulogd.*ulogd.conf" 2>/dev/null || true

## ============================================================================
## CREATE DIRECTORIES
## ============================================================================
echo "[2/7] Creating directories..."
mkdir -p "$(dirname "${BIN_PATH}")"
mkdir -p "${PLUGIN_DIR}"
mkdir -p "${LIB_DIR}"
mkdir -p "$(dirname "${CONF_PATH}")"
mkdir -p "${LOG_DIR}"

## ── Enable conntrack byte/packet accounting ──
## Required for flow.json to show actual BYTES/PKTS (not 0)
## Persists across reboots via sysctl.d
SYSCTL_FILE="/etc/sysctl.d/99-staysuite-conntrack.conf"
echo "  Enabling conntrack accounting (byte/packet counters)..."
if [ ! -f "${SYSCTL_FILE}" ] || ! grep -q "nf_conntrack_acct" "${SYSCTL_FILE}" 2>/dev/null; then
    cat > "${SYSCTL_FILE}" <<EOFSYSCTL
# StaySuite: Enable per-connection byte/packet counters in conntrack
# Required by ulogd2 NFCT plugin for flow.json bandwidth accounting
net.netfilter.nf_conntrack_acct = 1
EOFSYSCTL
    chmod 644 "${SYSCTL_FILE}"
fi
sysctl -w net.netfilter.nf_conntrack_acct=1 >/dev/null 2>&1 || true
echo "  → conntrack accounting enabled (PKTS/BYTES will now count)"

## ============================================================================
## INSTALL BINARY
## ============================================================================
echo "[3/7] Installing ulogd binary..."
cp -f "${SRC_DIR}/install/sbin/ulogd" "${BIN_PATH}"
chmod 755 "${BIN_PATH}"
echo "  → ${BIN_PATH} ($(du -h "${BIN_PATH}" | cut -f1))"

## ============================================================================
## INSTALL PLUGINS
## ============================================================================
echo "[4/7] Installing ulogd plugins..."
plugin_count=0
for so_file in "${SRC_DIR}/install/lib/ulogd/"*.so; do
    [ -f "$so_file" ] || continue
    cp -f "$so_file" "${PLUGIN_DIR}/"
    chmod 755 "${PLUGIN_DIR}/$(basename "$so_file")"
    plugin_count=$((plugin_count + 1))
done
echo "  → ${plugin_count} plugins → ${PLUGIN_DIR}/"

## ============================================================================
## INSTALL SHARED LIBRARIES + FIX SYMLINKS
## ============================================================================
echo "[5/7] Installing shared library dependencies..."
lib_count=0
for so_file in "${SRC_DIR}/install/lib/"*.so*; do
    case "$so_file" in
        *.a|*.la) continue ;;
        */ulogd/*|*/pkgconfig/*) continue ;;
    esac
    [ -f "$so_file" ] || continue
    cp -f "$so_file" "${LIB_DIR}/"
    chmod 755 "${LIB_DIR}/$(basename "$so_file")"
    lib_count=$((lib_count + 1))
done
echo "  → ${lib_count} files copied to ${LIB_DIR}/"

# Fix symlinks — sandbox copies real files instead of creating .so.X → .so.X.Y.Z links.
# Delete the short-name copies so ldconfig can recreate proper symlinks.
echo "  Fixing library symlinks..."
for real_file in "${LIB_DIR}"/.so.*.*.*; do
    [ -f "$real_file" ] || continue
    base=$(basename "$real_file")
    # .so.X.Y from .so.X.Y.Z  (e.g. libpcap.so.1.10 from libpcap.so.1.10.6)
    short_ver=$(echo "$base" | sed -E 's/(\.[0-9]+\.[0-9]+)\.[0-9]+$/\1/')
    [ -f "${LIB_DIR}/${short_ver}" ] && [ ! -L "${LIB_DIR}/${short_ver}" ] && rm -f "${LIB_DIR}/${short_ver}"
    # .so from .so.X.Y.Z  (e.g. libpcap.so from libpcap.so.1.10.6)
    short_bare=$(echo "$base" | sed -E 's/(\.so)\.[0-9]+/\1/')
    [ -f "${LIB_DIR}/${short_bare}" ] && [ ! -L "${LIB_DIR}/${short_bare}" ] && rm -f "${LIB_DIR}/${short_bare}"
done

## ============================================================================
## INSTALL CONFIG
## Config already has production paths (/usr/local/lib/ulogd/, /var/log/ulogd2/).
## Just copy it — no sed rewriting needed.
## ============================================================================
echo "[6/7] Installing ulogd.conf..."

if [ -f "${SRC_DIR}/ulogd.conf" ]; then
    cp -f "${SRC_DIR}/ulogd.conf" "${CONF_PATH}"
else
    cat > "${CONF_PATH}" <<EOFCONF
# ulogd.conf - StaySuite HospitalityOS (Production)
# Auto-generated by install_ulogd2.sh

[global]
logfile="${LOG_DIR}/ulogd.log"
loglevel=5

# Input plugins
plugin="${PLUGIN_DIR}/ulogd_inppkt_NFLOG.so"
plugin="${PLUGIN_DIR}/ulogd_inpflow_NFCT.so"

# Filter plugins
plugin="${PLUGIN_DIR}/ulogd_raw2packet_BASE.so"
plugin="${PLUGIN_DIR}/ulogd_filter_IFINDEX.so"
plugin="${PLUGIN_DIR}/ulogd_filter_IP2STR.so"
plugin="${PLUGIN_DIR}/ulogd_filter_HWHDR.so"
plugin="${PLUGIN_DIR}/ulogd_filter_PRINTFLOW.so"
plugin="${PLUGIN_DIR}/ulogd_filter_PRINTSNI.so"

# Output plugins
plugin="${PLUGIN_DIR}/ulogd_output_JSON.so"
plugin="${PLUGIN_DIR}/ulogd_output_PCAP.so"

# Stack 1: Connection tracking flow logging (NFCT -> JSON)
stack=ct1:NFCT,ct_ip:IP2STR,ct_print:PRINTFLOW,ct_json:JSON

# Stack 2: Packet logging (NFLOG -> JSON)
# nftables: nft add rule inet mangle prerouting log group 10
stack=pkt1:NFLOG,pkt_base:BASE,pkt_if:IFINDEX,pkt_ip:IP2STR,pkt_mac:HWHDR,pkt_json:JSON

# Stack 3: TLS SNI extraction (NFLOG -> BASE -> IP2STR -> IFINDEX -> PRINTSNI -> JSON)
# nftables: nft add rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500
stack=sni:NFLOG,sni_base:BASE,sni_ip:IP2STR,sni_if:IFINDEX,sni_sni:PRINTSNI,sni_json:JSON

# Stack 4: Raw TLS PCAP (DISABLED — conflicts with Stack 3 on group 20)
# stack=sni_pcap:NFLOG,sni_pcap_base:BASE,sni_pcap_out:PCAP

[ct1]
[ct_json]
file="${LOG_DIR}/flow.json"
sync=1
timestamp=1

[pkt1]
group=10
[pkt_json]
file="${LOG_DIR}/packet.json"
sync=1
timestamp=1

[sni]
group=20
[sni_json]
file="${LOG_DIR}/sni.json"
sync=1
timestamp=1

# [sni_pcap] — DISABLED (would conflict with sni on group 20)
# [sni_pcap_out]
EOFCONF
fi
chmod 644 "${CONF_PATH}"
echo "  → ${CONF_PATH}"

## ============================================================================
## LDCONFIG + SYSTEMD
## ============================================================================
echo "[7/7] Configuring systemd and ldconfig..."

# /usr/local/lib may already be in ldconfig's default search path,
# but adding it explicitly is harmless and guarantees it on all distros.
if [ ! -f "${LDCONF_FILE}" ] || ! grep -q "${LIB_DIR}" "${LDCONF_FILE}" 2>/dev/null; then
    echo "${LIB_DIR}" > "${LDCONF_FILE}"
    chmod 644 "${LDCONF_FILE}"
fi
ldconfig 2>&1 | grep -v "is not a symbolic link" || true
echo "  → ${LDCONF_FILE} (ldconfig updated)"

# Systemd service
cat > "${SYSTEMD_UNIT}" <<EOFUNIT
[Unit]
Description=ulogd2 - Netfilter Logging Daemon (StaySuite HospitalityOS)
Documentation=man:ulogd(8)
After=network-online.target network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/sbin/ulogd -c /usr/local/etc/ulogd.conf
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
TimeoutStopSec=10
LimitNOFILE=65536
Nice=-5

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
## VERIFY
## ============================================================================
echo ""
echo "=========================================="
echo " Installation Complete"
echo "=========================================="
echo ""
echo " Binary    : $(which ulogd 2>/dev/null || echo "${BIN_PATH}")"
echo " Plugins   : $(ls "${PLUGIN_DIR}/"*.so 2>/dev/null | wc -l) .so files"
echo " Config    : ${CONF_PATH}"
echo " Logs      : ${LOG_DIR}/"
echo " Service   : ${SERVICE_NAME} (systemd enabled)"
echo ""

# Verify binary works
if "${BIN_PATH}" -v 2>/dev/null; then
    echo " Version   : $("${BIN_PATH}" -v 2>/dev/null || echo "unknown")"
fi

echo ""
echo " nftables rules (already in defaultchains_cryptsk.sh):"
echo "   nft add rule inet mangle prerouting tcp dport 443 tcp flags & (syn|rst|fin) == 0 log group 20 snaplen 1500"
echo "   nft add rule inet mangle prerouting tcp dport 80 tcp flags & (syn|rst|fin) == 0 log group 21 snaplen 1500"
echo "   nft add rule inet mangle prerouting udp dport 53 log group 22 snaplen 512"
echo ""
echo " Commands:"
echo "   systemctl start ${SERVICE_NAME}    # Start"
echo "   systemctl status ${SERVICE_NAME}   # Status"
echo "   journalctl -u ${SERVICE_NAME} -f   # Follow logs"
echo ""
echo " To start now: systemctl start ${SERVICE_NAME}"
