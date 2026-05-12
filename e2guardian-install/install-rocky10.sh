#!/usr/bin/env bash
# =============================================================================
# StaySuite-HospitalityOS — e2guardian Automated Installer for Rocky Linux 10
# =============================================================================
#
# Installs a pre-compiled e2guardian v5.5.9 web content filter from the
# bundled e2guardian-install/ directory.  No compilation needed — every
# artefact (binary, configs, blocklists, languages, man pages) is shipped
# with the project.
#
# What this script does:
#   1. Auto-detects the project directory from the script's own location
#   2. Validates the target system (Rocky 10 / RHEL 10 / AlmaLinux 10)
#   3. Installs runtime dependencies via dnf
#   4. Creates the dedicated "e2guardian" system user
#   5. Copies files to production paths under INSTALL_PREFIX (default /opt/staysuite):
#        <PREFIX>/e2guardian-install/sbin/e2guardian      (binary)
#        <PREFIX>/e2guardian-install/etc/e2guardian/       (configs & lists)
#        <PREFIX>/e2guardian-install/share/e2guardian/     (languages, scripts, CGI)
#        <PREFIX>/e2guardian-install/share/doc/e2guardian/ (documentation)
#        <PREFIX>/e2guardian-install/share/man/man8/       (man page)
#        <PREFIX>/e2guardian-install/var/log/e2guardian/   (access & stats logs)
#        <PREFIX>/e2guardian-install/var/run/e2guardian/   (PID & flag files)
#        <PREFIX>/e2guardian-install/var/lib/e2guardian/   (optional: generated certs)
#   6. Rewrites all hardcoded sandbox paths in every config file to
#      the detected production paths
#   7. Installs a systemd service unit (e2guardian.service)
#   8. Installs a logrotate config
#   9. Enables and starts the service
#
# Usage:
#   chmod +x install-rocky10.sh
#   sudo ./install-rocky10.sh                           # full install + start
#   sudo ./install-rocky10.sh --no-start                # install but don't start
#   sudo INSTALL_PREFIX=/custom/path ./install-rocky10.sh  # custom install prefix
#   sudo ./install-rocky10.sh --uninstall               # remove everything
#
# After install, manage e2guardian with:
#   sudo systemctl start e2guardian
#   sudo systemctl stop e2guardian
#   sudo systemctl restart e2guardian
#   sudo systemctl reload e2guardian      # reload lists without restart
#   sudo systemctl status e2guardian
#   sudo journalctl -u e2guardian -f       # live logs
#
# =============================================================================

set -euo pipefail

# =============================================================================
# AUTO-DETECT — Where is this script? Where is the project?
# =============================================================================
# Resolve the absolute path of this script, then derive the project root
# (two levels up: <project>/e2guardian-install/install-rocky10.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# BIN_SRC_DIR = directory containing this script (= e2guardian-install/)
BIN_SRC_DIR="$SCRIPT_DIR"
# PROJECT_DIR = parent of e2guardian-install/ (i.e. /opt/staysuite)
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# CONFIGURABLE — Override via environment variable
# =============================================================================
# INSTALL_PREFIX: where the StaySuite project lives on the production server.
# Defaults to the auto-detected PROJECT_DIR.
# All e2guardian files are installed UNDER this prefix, preserving the
# e2guardian-install/ directory structure so that FreeRADIUS, PostgreSQL,
# and e2guardian all live side-by-side under /opt/staysuite/.
#
# Examples:
#   INSTALL_PREFIX=/opt/staysuite  (default — auto-detected)
#   INSTALL_PREFIX=/opt/hotel      (custom)
INSTALL_PREFIX="${INSTALL_PREFIX:-$PROJECT_DIR}"

# =============================================================================
# DERIVED TARGET PATHS — Everything under INSTALL_PREFIX
# =============================================================================
readonly E2G_DIR="${INSTALL_PREFIX}/e2guardian-install"
readonly BIN_TARGET="${E2G_DIR}/sbin/e2guardian"
readonly CONF_TARGET="${E2G_DIR}/etc/e2guardian"
readonly SHARE_TARGET="${E2G_DIR}/share/e2guardian"
readonly DOC_TARGET="${E2G_DIR}/share/doc/e2guardian"
readonly MAN_TARGET="${E2G_DIR}/share/man/man8"
readonly LOG_DIR="${E2G_DIR}/var/log/e2guardian"
readonly RUN_DIR="${E2G_DIR}/var/run/e2guardian"
readonly LIB_DIR="${E2G_DIR}/var/lib/e2guardian"
readonly CERT_DIR="${E2G_DIR}/etc/e2guardian/private"
readonly SERVICE_NAME="e2guardian"

# =============================================================================
# PATH REWRITING VARIABLES
# =============================================================================
# OLD_BASE is auto-detected from the source directory.
# The sed rewrite rules replace OLD_BASE with E2G_DIR everywhere.
OLD_BASE="$BIN_SRC_DIR"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# =============================================================================
# HELPERS
# =============================================================================
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)."
        exit 1
    fi
}

detect_os() {
    if [[ ! -f /etc/os-release ]]; then
        error "Cannot detect OS — /etc/os-release not found."
        exit 1
    fi
    . /etc/os-release
    case "$ID" in
        rocky|rhel|almalinux|centos) ;;
        *)
            error "Unsupported OS: $ID $VERSION_ID. This script is for Rocky Linux 10 / RHEL 10 / AlmaLinux 10."
            exit 1
            ;;
    esac
    case "${VERSION_ID%%.*}" in
        9|10) ;;
        *)
            warn "Tested on Rocky 10. You are running $ID $VERSION_ID — proceeding anyway."
            ;;
    esac
    info "Detected OS: $ID $VERSION_ID ($PRETTY_NAME)"
}

confirm_source() {
    if [[ ! -f "$BIN_SRC_DIR/sbin/e2guardian" ]]; then
        error "e2guardian binary not found at $BIN_SRC_DIR/sbin/e2guardian"
        error "Expected this script at: <project>/e2guardian-install/install-rocky10.sh"
        error "Script location resolved to: $SCRIPT_DIR"
        exit 1
    fi
    local file_count
    file_count=$(find "$BIN_SRC_DIR" -type f | wc -l)
    info "Source directory: $BIN_SRC_DIR ($file_count files)"
    info "Install prefix:   $INSTALL_PREFIX"
    info "Target directory: $E2G_DIR"
}

# =============================================================================
# PATH REWRITING — Replace any sandbox paths with the real production paths
# =============================================================================
rewrite_path() {
    # $1 = file to rewrite in-place
    if [[ ! -f "$1" ]]; then return; fi

    # Skip binary files — only rewrite text files
    if ! file "$1" | grep -qiE "text|ASCII|empty"; then return; fi

    # Skip this install script itself
    if [[ "$1" == *"/install-rocky10.sh" ]]; then return; fi

    # Replace any occurrence of the OLD source base path with the production path
    # Order matters: more specific paths first, then catch-all
    sed -i \
        -e "s|${OLD_BASE}/sbin/e2guardian|${BIN_TARGET}|g" \
        -e "s|${OLD_BASE}/etc/e2guardian|${CONF_TARGET}|g" \
        -e "s|${OLD_BASE}/share/e2guardian|${SHARE_TARGET}|g" \
        -e "s|${OLD_BASE}/share/doc/e2guardian|${DOC_TARGET}|g" \
        -e "s|${OLD_BASE}/share/man|${E2G_DIR}/share/man|g" \
        -e "s|${OLD_BASE}/var/log/e2guardian|${LOG_DIR}|g" \
        -e "s|${OLD_BASE}/var/run/e2guardian|${RUN_DIR}|g" \
        -e "s|${OLD_BASE}/var/lib/e2guardian|${LIB_DIR}|g" \
        -e "s|${OLD_BASE}/var|${E2G_DIR}/var|g" \
        -e "s|${OLD_BASE}|${E2G_DIR}|g" \
        "$1"
}

# =============================================================================
# INSTALLATION STEPS
# =============================================================================
install_deps() {
    step "Step 1/8: Installing runtime dependencies"
    dnf install -y \
        zlib-devel \
        openssl-libs \
        openssl-devel \
        glibc-devel \
        libstdc++-devel \
        libgcc \
        which \
        procps-ng \
    2>&1 | tail -5
    info "Dependencies installed."
}

create_user() {
    step "Step 2/8: Creating e2guardian system user"
    if id "$SERVICE_NAME" &>/dev/null; then
        info "User '$SERVICE_NAME' already exists — skipping."
    else
        useradd -r -s /sbin/nologin -d "$LIB_DIR" -M "$SERVICE_NAME"
        info "Created system user '$SERVICE_NAME' with home $LIB_DIR"
    fi
}

install_binary() {
    step "Step 3/8: Installing e2guardian binary"
    mkdir -p "$(dirname "$BIN_TARGET")"
    install -m 0755 "$BIN_SRC_DIR/sbin/e2guardian" "$BIN_TARGET"
    info "Installed $BIN_TARGET ($(du -h "$BIN_TARGET" | cut -f1))"
}

install_configs() {
    step "Step 4/8: Installing configuration files"
    # Copy entire etc/ tree
    cp -a "$BIN_SRC_DIR/etc/e2guardian" "$CONF_TARGET"
    info "Installed config tree to $CONF_TARGET"

    # Fix daemonuser/daemongroup in main config
    sed -i \
        -e "s/^daemonuser = .*/daemonuser = '${SERVICE_NAME}'/" \
        -e "s/^daemongroup = .*/daemongroup = '${SERVICE_NAME}'/" \
        "$CONF_TARGET/e2guardian/e2guardian.conf"
    info "Set daemonuser/daemongroup = '${SERVICE_NAME}'"

    # Set nodaemon = off for production (systemd handles daemonization)
    sed -i 's/^nodaemon = on/nodaemon = off/' "$CONF_TARGET/e2guardian/e2guardian.conf"
    info "Set nodaemon = off (systemd manages the process)"

    # Rewrite ALL paths from sandbox/old paths to production paths
    info "Rewriting paths from '$OLD_BASE' to '$E2G_DIR'..."
    local count=0
    while IFS= read -r -d '' f; do
        if rewrite_path "$f"; then
            ((count++))
        fi
    done < <(find "$CONF_TARGET" -type f -print0)
    info "Rewrote paths in $count config files"
}

install_share() {
    step "Step 5/8: Installing shared data (languages, scripts, CGI)"
    # Languages
    mkdir -p "$SHARE_TARGET"
    cp -a "$BIN_SRC_DIR/share/e2guardian/languages" "$SHARE_TARGET/languages"
    # Perl CGI block page script
    cp -a "$BIN_SRC_DIR/share/e2guardian/e2guardian.pl" "$SHARE_TARGET/e2guardian.pl"
    # Static assets (blocked flash, transparent gif)
    cp -a "$BIN_SRC_DIR/share/e2guardian/blockedflash.swf" "$SHARE_TARGET/"
    cp -a "$BIN_SRC_DIR/share/e2guardian/transparent1x1.gif" "$SHARE_TARGET/"
    # Scripts (logrotation etc.)
    cp -a "$BIN_SRC_DIR/share/e2guardian/scripts" "$SHARE_TARGET/scripts"

    # Rewrite paths in the scripts we just copied
    while IFS= read -r -d '' f; do
        if rewrite_path "$f"; then
            :
        fi
    done < <(find "$SHARE_TARGET/scripts" -type f -print0 2>/dev/null || true)

    info "Installed shared data to $SHARE_TARGET"

    # Documentation
    mkdir -p "$DOC_TARGET"
    cp -a "$BIN_SRC_DIR/share/doc/e2guardian/"* "$DOC_TARGET/"
    info "Installed documentation to $DOC_TARGET"

    # Man page
    mkdir -p "$MAN_TARGET"
    cp -a "$BIN_SRC_DIR/share/man/man8/e2guardian.8" "$MAN_TARGET/"
    gzip -f "$MAN_TARGET/e2guardian.8"
    info "Installed man page"
}

install_runtime_dirs() {
    step "Step 6/8: Creating runtime directories"
    mkdir -p "$LOG_DIR"
    mkdir -p "$RUN_DIR"
    mkdir -p "$LIB_DIR"
    mkdir -p "$CERT_DIR/generatedcerts"

    # Set ownership
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$LOG_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$LIB_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$CERT_DIR"
    chmod 0750 "$CERT_DIR"
    chmod 0750 "$CERT_DIR/generatedcerts"

    # PID file placeholder
    touch "$RUN_DIR/e2guardian.pid"
    chown "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR/e2guardian.pid"

    # Running flag
    touch "$RUN_DIR/e2g_flag_running"
    chown "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR/e2g_flag_running"

    info "Created: $LOG_DIR"
    info "         $RUN_DIR"
    info "         $LIB_DIR"
    info "         $CERT_DIR"
}

install_systemd() {
    step "Step 7/8: Installing systemd service & logrotate"

    # --- systemd service unit ---
    # NOTE: Using UNIT_EOF without quotes so variables expand
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << UNIT_EOF
[Unit]
Description=E2guardian Web Content Filter (StaySuite HospitalityOS)
Documentation=man:e2guardian(8)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
GuessMainPID=no
IgnoreSIGPIPE=no

# Security hardening
TasksMax=infinity
LimitNOFILE=65535
LimitNPROC=infinity
LimitSTACK=infinity:infinity
UMask=0027

# Paths — production install under $INSTALL_PREFIX
ExecStart=${BIN_TARGET}
ExecReload=${BIN_TARGET} -r
ExecStop=${BIN_TARGET} -q
PIDFile=${RUN_DIR}/e2guardian.pid

# Restart policy — restart on crash, not on clean stop
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=30
TimeoutReloadSec=15

# Run as dedicated unprivileged user
User=${SERVICE_NAME}
Group=${SERVICE_NAME}

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Hardening — e2guardian writes to its own directories under the prefix
NoNewPrivileges=false
ProtectSystem=false
ReadWritePaths=${LOG_DIR} ${RUN_DIR} ${LIB_DIR} ${CERT_DIR}/generatedcerts

[Install]
WantedBy=multi-user.target
UNIT_EOF

    systemctl daemon-reload
    info "Installed /etc/systemd/system/${SERVICE_NAME}.service"

    # --- logrotate config ---
    cat > "/etc/logrotate.d/${SERVICE_NAME}" << LOGROTATE_EOF
${LOG_DIR}/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${SERVICE_NAME} ${SERVICE_NAME}
    sharedscripts
    postrotate
        /usr/bin/systemctl reload ${SERVICE_NAME} > /dev/null 2>&1 || true
    endscript
}
LOGROTATE_EOF

    info "Installed /etc/logrotate.d/${SERVICE_NAME}"

    # --- tmpfiles.d for run dir persistence across reboots ---
    cat > "/etc/tmpfiles.d/${SERVICE_NAME}.conf" << TMPFILES_EOF
d ${RUN_DIR} 0755 ${SERVICE_NAME} ${SERVICE_NAME} -
d ${LOG_DIR} 0755 ${SERVICE_NAME} ${SERVICE_NAME} -
TMPFILES_EOF

    info "Installed /etc/tmpfiles.d/${SERVICE_NAME}.conf"
}

start_service() {
    step "Step 8/8: Enabling and starting e2guardian"

    # Enable on boot
    systemctl enable "$SERVICE_NAME"
    info "Service enabled on boot (systemctl enable)"

    # Check for --no-start flag
    local start_flag="yes"
    for arg in "$@"; do
        if [[ "$arg" == "--no-start" ]]; then
            start_flag="no"
        fi
    done

    if [[ "$start_flag" == "no" ]]; then
        warn "Skipping service start (--no-start flag detected)."
        warn "Start manually with: sudo systemctl start e2guardian"
        return
    fi

    systemctl start "$SERVICE_NAME"
    sleep 2

    # Check status
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        info "e2guardian is RUNNING"
        echo ""
        systemctl status "$SERVICE_NAME" --no-pager -l 2>&1 | head -20
        echo ""
        info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        info "  e2guardian is active and listening on:"
        info "    Port 8080  — HTTP transparent proxy"
        info "    Port 8090  — TLS proxy (configurable)"
        info "    Port 8443  — HTTPS transparent proxy"
        info ""
        info "  Management commands:"
        info "    sudo systemctl status e2guardian"
        info "    sudo systemctl restart e2guardian"
        info "    sudo systemctl reload e2guardian     # reload lists"
        info "    sudo systemctl stop e2guardian"
        info "    sudo journalctl -u e2guardian -f       # live logs"
        info ""
        info "  Install prefix:  $INSTALL_PREFIX"
        info "  Binary:         $BIN_TARGET"
        info ""
        info "  Config files:"
        info "    $CONF_TARGET/e2guardian/e2guardian.conf"
        info "    $CONF_TARGET/e2guardian/e2guardianf1.conf  (group 1 - kids)"
        info "    $CONF_TARGET/e2guardian/e2guardianf2.conf  (group 2 - basic)"
        info "    $CONF_TARGET/e2guardian/e2guardianf3.conf  (group 3 - premium)"
        info ""
        info "  Log files:"
        info "    $LOG_DIR/access.log"
        info "    $LOG_DIR/dstats.log"
        info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    else
        error "e2guardian FAILED to start! Check logs:"
        error "  sudo journalctl -u e2guardian -n 50 --no-pager"
        exit 1
    fi
}

# =============================================================================
# UNINSTALL
# =============================================================================
uninstall() {
    step "Uninstalling e2guardian"

    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    rm -f "/etc/logrotate.d/${SERVICE_NAME}"
    rm -f "/etc/tmpfiles.d/${SERVICE_NAME}.conf"
    systemctl daemon-reload

    info "Removed systemd service, logrotate, tmpfiles.d config."

    warn "Runtime directories NOT removed (preserving logs and data):"
    warn "  $E2G_DIR/"
    warn "  Remove manually if desired: sudo rm -rf $E2G_DIR"

    info "User '$SERVICE_NAME' NOT removed. Remove manually if desired:"
    info "  sudo userdel e2guardian"

    info "e2guardian uninstalled."
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  StaySuite-HospitalityOS — e2guardian Installer            ║"
    echo "║  Target: Rocky Linux 10 / RHEL 10 / AlmaLinux 10          ║"
    echo "║  Version: e2guardian v5.5.9 (pre-compiled)                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    case "${1:-}" in
        --uninstall)
            check_root
            # Still need to detect OS and paths for uninstall
            . /etc/os-release 2>/dev/null || true
            uninstall
            exit 0
            ;;
        --help|-h)
            echo "Usage: sudo $0 [OPTIONS]"
            echo ""
            echo "Installs e2guardian from the e2guardian-install/ directory"
            echo "alongside the StaySuite project files."
            echo ""
            echo "Options:"
            echo "  (no flags)          Full install + start service"
            echo "  --no-start          Install but don't start the service"
            echo "  --uninstall         Remove e2guardian service (keep data)"
            echo "  --help              Show this help"
            echo ""
            echo "Environment variables:"
            echo "  INSTALL_PREFIX=/opt/staysuite   Override install prefix"
            echo "                               (default: auto-detected from script location)"
            echo ""
            echo "Examples:"
            echo "  cd /opt/staysuite && sudo ./e2guardian-install/install-rocky10.sh"
            echo "  sudo INSTALL_PREFIX=/opt/hotel ./e2guardian-install/install-rocky10.sh"
            echo "  sudo ./e2guardian-install/install-rocky10.sh --no-start"
            echo "  sudo ./e2guardian-install/install-rocky10.sh --uninstall"
            exit 0
            ;;
    esac

    check_root
    detect_os
    confirm_source

    info "Path mapping:"
    info "  Source:      $BIN_SRC_DIR"
    info "  Target:      $E2G_DIR"
    info "  Binary:      $BIN_TARGET"
    info "  Config:      $CONF_TARGET"
    info "  Logs:        $LOG_DIR"
    echo ""

    # Run installation steps
    install_deps
    create_user
    install_binary
    install_configs
    install_share
    install_runtime_dirs
    install_systemd
    start_service "$@"
}

main "$@"
