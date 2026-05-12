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
# Supports TWO install modes:
#
#   IN-PLACE (default when run from /opt/staysuite/e2guardian-install/):
#     Files already exist at the target (via git clone). The script skips
#     all copy operations and only performs:
#       - Install runtime dependencies
#       - Create system user
#       - Fix file permissions & ownership
#       - Rewrite sandbox paths in configs
#       - Set daemonuser/nodaemon for production
#       - Create missing runtime dirs (log, run, lib)
#       - Install systemd service, logrotate, tmpfiles.d
#       - Enable and start the service
#
#   COPY MODE (when source != target, e.g. running from a tarball /tmp):
#     The script copies files from source to target, then does everything above.
#
# Usage:
#   cd /opt/staysuite && sudo ./e2guardian-install/install-rocky10.sh
#   sudo ./e2guardian-install/install-rocky10.sh --no-start
#   sudo ./e2guardian-install/install-rocky10.sh --uninstall
#   sudo INSTALL_PREFIX=/custom/path ./e2guardian-install/install-rocky10.sh
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_SRC_DIR="$SCRIPT_DIR"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# CONFIGURABLE — Override via environment variable
# =============================================================================
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
# Collect ALL possible old base paths that might exist in config files.
# This handles: sandbox paths, other server paths, previous installs, etc.
# OLD_BASE is set AFTER confirm_source so we know BIN_SRC_DIR is valid.
OLD_BASE=""

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

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

# Check if source and target are the same directory (in-place install)
is_inplace() {
    [[ "$BIN_SRC_DIR" -ef "$E2G_DIR" ]] 2>/dev/null
}

# =============================================================================
# PATH REWRITING — Replace any old paths with the real production paths
# =============================================================================
# Scans ALL text config files for path-like patterns that point to e2guardian
# and rewrites them to the correct production paths.
# Uses the Define LISTDIR pattern as anchor, plus common path patterns.
rewrite_paths() {
    local dir="$1"
    local count=0
    local f

    while IFS= read -r -d '' f; do
        # Skip binary files and empty files
        if ! file "$f" | grep -qiE "text|ASCII|empty"; then continue; fi
        # Skip this install script itself
        if [[ "$f" == *"/install-rocky10.sh" ]]; then continue; fi

        # Check if file contains any e2guardian paths that need rewriting
        # Look for common patterns: paths containing /e2guardian-install/ or /e2guardian/
        if ! rg -q "e2guardian" "$f" 2>/dev/null; then continue; fi

        # Build sed commands to rewrite ALL discovered old paths
        # Strategy: find all absolute path references to e2guardian-install
        # in the file and replace them with the correct production path

        # Pattern 1: .Define LISTDIR directives
        sed -i \
            -e "s|\.Define LISTDIR <[^>]*/e2guardian-install/etc/e2guardian|\.Define LISTDIR <${CONF_TARGET}|g" \
            "$f"

        # Pattern 2: Any absolute path to e2guardian-install/sbin/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/sbin/e2guardian|${BIN_TARGET}|g" \
            "$f"

        # Pattern 3: Any absolute path to .../e2guardian-install/etc/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/etc/e2guardian|${CONF_TARGET}|g" \
            "$f"

        # Pattern 4: Any absolute path to .../e2guardian-install/share/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/e2guardian|${SHARE_TARGET}|g" \
            "$f"

        # Pattern 5: Any absolute path to .../e2guardian-install/share/doc/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/doc/e2guardian|${DOC_TARGET}|g" \
            "$f"

        # Pattern 6: Any absolute path to .../e2guardian-install/share/man/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/man|${E2G_DIR}/share/man|g" \
            "$f"

        # Pattern 7: Any absolute path to .../e2guardian-install/var/log/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/log/e2guardian|${LOG_DIR}|g" \
            "$f"

        # Pattern 8: Any absolute path to .../e2guardian-install/var/run/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/run/e2guardian|${RUN_DIR}|g" \
            "$f"

        # Pattern 9: Any absolute path to .../e2guardian-install/var/lib/e2guardian/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/lib/e2guardian|${LIB_DIR}|g" \
            "$f"

        # Pattern 10: Catch-all — any remaining .../e2guardian-install/var/...
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var|${E2G_DIR}/var|g" \
            "$f"

        # Pattern 11: Final catch-all — any remaining absolute path to e2guardian-install/
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install|${E2G_DIR}|g" \
            "$f"

        # Pattern 12: storyboard / preauth paths that may not have e2guardian-install in them
        # e.g. /home/z/my-project/e2guardian-install/etc/... -> already handled above

        ((count++))
    done < <(find "$dir" -type f -print0)

    echo "$count"
}

# =============================================================================
# INSTALLATION STEPS
# =============================================================================
install_deps() {
    step "Step 1/7: Installing runtime dependencies"
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
    step "Step 2/7: Creating e2guardian system user"
    if id "$SERVICE_NAME" &>/dev/null; then
        info "User '$SERVICE_NAME' already exists — skipping."
    else
        useradd -r -s /sbin/nologin -d "$LIB_DIR" -M "$SERVICE_NAME"
        info "Created system user '$SERVICE_NAME' with home $LIB_DIR"
    fi
}

prepare_binary() {
    step "Step 3/7: Preparing e2guardian binary"
    if is_inplace; then
        # In-place: just fix permissions
        chmod 0755 "$BIN_TARGET"
        info "Fixed permissions on $BIN_TARGET (in-place mode)"
    else
        # Copy mode: copy from source to target
        mkdir -p "$(dirname "$BIN_TARGET")"
        install -m 0755 "$BIN_SRC_DIR/sbin/e2guardian" "$BIN_TARGET"
        info "Installed $BIN_TARGET ($(du -h "$BIN_TARGET" | cut -f1))"
    fi
}

prepare_configs() {
    step "Step 4/7: Preparing configuration files"
    if is_inplace; then
        info "Files already in place (in-place mode)"
    else
        mkdir -p "$(dirname "$CONF_TARGET")"
        cp -a "$BIN_SRC_DIR/etc/e2guardian" "$CONF_TARGET"
        info "Copied config tree to $CONF_TARGET"
    fi

    # Fix daemonuser/daemongroup in main config
    sed -i \
        -e "s/^daemonuser = .*/daemonuser = '${SERVICE_NAME}'/" \
        -e "s/^daemongroup = .*/daemongroup = '${SERVICE_NAME}'/" \
        "$CONF_TARGET/e2guardian/e2guardian.conf"
    info "Set daemonuser/daemongroup = '${SERVICE_NAME}'"

    # Set nodaemon = off for production (systemd handles daemonization)
    sed -i 's/^nodaemon = on/nodaemon = off/' "$CONF_TARGET/e2guardian/e2guardian.conf"
    info "Set nodaemon = off (systemd manages the process)"

    # Rewrite ALL paths — this is the critical step
    info "Rewriting all e2guardian paths to: $E2G_DIR"
    local count
    count=$(rewrite_paths "$CONF_TARGET")
    info "Scanned and rewrote paths in $count config files"
}

prepare_share() {
    step "Step 5/7: Preparing shared data (languages, scripts, CGI)"
    if is_inplace; then
        info "Files already in place (in-place mode)"
    else
        mkdir -p "$SHARE_TARGET"
        cp -a "$BIN_SRC_DIR/share/e2guardian/languages" "$SHARE_TARGET/languages"
        cp -a "$BIN_SRC_DIR/share/e2guardian/e2guardian.pl" "$SHARE_TARGET/e2guardian.pl"
        cp -a "$BIN_SRC_DIR/share/e2guardian/blockedflash.swf" "$SHARE_TARGET/"
        cp -a "$BIN_SRC_DIR/share/e2guardian/transparent1x1.gif" "$SHARE_TARGET/"
        cp -a "$BIN_SRC_DIR/share/e2guardian/scripts" "$SHARE_TARGET/scripts"
        mkdir -p "$DOC_TARGET"
        cp -a "$BIN_SRC_DIR/share/doc/e2guardian/"* "$DOC_TARGET/"
        mkdir -p "$MAN_TARGET"
        cp -a "$BIN_SRC_DIR/share/man/man8/e2guardian.8" "$MAN_TARGET/"
        gzip -f "$MAN_TARGET/e2guardian.8"
        info "Copied shared data, docs, and man page"
    fi

    # Rewrite paths in scripts
    local count
    count=$(rewrite_paths "$SHARE_TARGET")
    info "Scanned and rewrote paths in $count shared files"
}

prepare_runtime_dirs() {
    step "Step 6/7: Creating runtime directories & fixing ownership"
    mkdir -p "$LOG_DIR"
    mkdir -p "$RUN_DIR"
    mkdir -p "$LIB_DIR"
    mkdir -p "$CERT_DIR/generatedcerts"

    # Set ownership on runtime dirs
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$LOG_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$LIB_DIR"
    chown -R "${SERVICE_NAME}:${SERVICE_NAME}" "$CERT_DIR"
    chmod 0750 "$CERT_DIR"
    chmod 0750 "$CERT_DIR/generatedcerts"

    # PID file
    touch "$RUN_DIR/e2guardian.pid"
    chown "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR/e2guardian.pid"

    # Running flag
    touch "$RUN_DIR/e2g_flag_running"
    chown "${SERVICE_NAME}:${SERVICE_NAME}" "$RUN_DIR/e2g_flag_running"

    # Ensure binary is executable and owned appropriately
    chmod 0755 "$BIN_TARGET"

    # Ensure config files are readable by the e2guardian user
    chmod -R o+rX "$CONF_TARGET"
    chmod -R o+rX "$SHARE_TARGET"
    chmod o+X "$E2G_DIR"
    chmod o+X "$E2G_DIR/etc"
    chmod o+X "$E2G_DIR/sbin"
    chmod o+X "$E2G_DIR/share"
    chmod o+X "$E2G_DIR/var"

    info "Created and owned: $LOG_DIR"
    info "                    $RUN_DIR"
    info "                    $LIB_DIR"
    info "                    $CERT_DIR"
}

install_systemd() {
    step "Step 7/7: Installing systemd service & logrotate"

    # --- systemd service unit ---
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << UNIT_EOF
[Unit]
Description=E2guardian Web Content Filter (StaySuite HospitalityOS)
Documentation=man:e2guardian(8)
After=network-online.target postgresql.service
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
# IMPORTANT: -c flag is REQUIRED because the binary was compiled with
# sandbox paths hardcoded (--prefix, --sysconfdir, etc.). Without -c,
# e2guardian would look for config at the old compiled-in path.
ExecStart=${BIN_TARGET} -c ${CONF_TARGET}/e2guardian/e2guardian.conf
ExecReload=${BIN_TARGET} -r -c ${CONF_TARGET}/e2guardian/e2guardian.conf
ExecStop=${BIN_TARGET} -q -c ${CONF_TARGET}/e2guardian/e2guardian.conf
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
    echo ""
    step "Enabling and starting e2guardian"

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

    # Detect install mode
    if is_inplace; then
        info -e "${CYAN}Mode: IN-PLACE${NC} — files already at $E2G_DIR (skipping copies)"
    else
        warn "Mode: COPY — copying from $BIN_SRC_DIR to $E2G_DIR"
    fi

    echo ""
    info "Path mapping:"
    info "  Source:      $BIN_SRC_DIR"
    info "  Target:      $E2G_DIR"
    info "  Binary:      $BIN_TARGET"
    info "  Config:      $CONF_TARGET"
    info "  Share:       $SHARE_TARGET"
    info "  Logs:        $LOG_DIR"
    info "  Run/PID:     $RUN_DIR"
    echo ""

    # Run installation steps
    install_deps
    create_user
    prepare_binary
    prepare_configs
    prepare_share
    prepare_runtime_dirs
    install_systemd
    start_service "$@"
}

main "$@"
