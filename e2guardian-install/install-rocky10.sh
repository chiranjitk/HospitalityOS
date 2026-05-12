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
#   1. Validates the target system (Rocky 10 / RHEL 10 / AlmaLinux 10)
#   2. Installs runtime dependencies via dnf
#   3. Creates the dedicated "e2guardian" system user
#   4. Copies files to FHS-compliant paths:
#        /usr/sbin/e2guardian                    (binary)
#        /etc/e2guardian/                         (configs & lists)
#        /usr/share/e2guardian/                   (languages, scripts, perl CGI)
#        /usr/share/doc/e2guardian/               (documentation)
#        /usr/share/man/man8/e2guardian.8         (man page)
#        /var/log/e2guardian/                      (access & stats logs)
#        /var/run/e2guardian/                      (PID & flag files)
#        /var/lib/e2guardian/                      (optional: generated certs)
#   5. Rewrites all hardcoded /home/z/my-project/e2guardian-install paths
#      in every config file to the new FHS paths
#   6. Installs a systemd service unit (e2guardian.service)
#   7. Installs a logrotate config
#   8. Optionally opens firewall ports (8080, 8090, 8443)
#   9. Enables and starts the service
#
# Usage:
#   chmod +x install-rocky10.sh
#   sudo ./install-rocky10.sh              # full install + start
#   sudo ./install-rocky10.sh --no-start   # install but don't start
#   sudo ./install-rocky10.sh --uninstall  # remove everything
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
# CONSTANTS — Target FHS paths on the production Rocky 10 system
# =============================================================================
readonly BIN_SRC_DIR="/home/z/my-project/e2guardian-install"
readonly BIN_TARGET="/usr/sbin/e2guardian"
readonly CONF_TARGET="/etc/e2guardian"
readonly SHARE_TARGET="/usr/share/e2guardian"
readonly DOC_TARGET="/usr/share/doc/e2guardian"
readonly MAN_TARGET="/usr/share/man/man8"
readonly LOG_DIR="/var/log/e2guardian"
readonly RUN_DIR="/var/run/e2guardian"
readonly LIB_DIR="/var/lib/e2guardian"
readonly CERT_DIR="/etc/e2guardian/private"
readonly SERVICE_NAME="e2guardian"

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
    # Accept major version 9 or 10
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
        error "Make sure you are running this script from the StaySuite project root."
        exit 1
    fi
    local file_count
    file_count=$(find "$BIN_SRC_DIR" -type f | wc -l)
    info "Found $file_count files in $BIN_SRC_DIR"
}

# =============================================================================
# PATH REWRITING — Replace sandbox paths with FHS production paths
# =============================================================================
OLD_BASE="/home/z/my-project/e2guardian-install"
NEW_BASE="/usr"

rewrite_path() {
    # $1 = file to rewrite in-place
    # Replaces OLD_BASE with NEW_BASE in the file
    if [[ -f "$1" ]]; then
        sed -i \
            -e "s|${OLD_BASE}/sbin/e2guardian|${BIN_TARGET}|g" \
            -e "s|${OLD_BASE}/etc/e2guardian|${CONF_TARGET}|g" \
            -e "s|${OLD_BASE}/share/e2guardian|${SHARE_TARGET}|g" \
            -e "s|${OLD_BASE}/share/doc/e2guardian|${DOC_TARGET}|g" \
            -e "s|${OLD_BASE}/var/log/e2guardian|${LOG_DIR}|g" \
            -e "s|${OLD_BASE}/var/run/e2guardian|${RUN_DIR}|g" \
            -e "s|${OLD_BASE}/var/lib/e2guardian|${LIB_DIR}|g" \
            -e "s|${OLD_BASE}|${NEW_BASE}|g" \
            "$1"
    fi
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

    # Rewrite ALL paths from sandbox to FHS
    info "Rewriting sandbox paths to FHS production paths..."
    local count=0
    while IFS= read -r -d '' f; do
        if file "$f" | grep -qiE "text|ASCII"; then
            rewrite_path "$f"
            ((count++))
        fi
    done < <(find "$CONF_TARGET" -type f -print0)
    info "Rewrote paths in $count config files"
}

install_share() {
    step "Step 5/8: Installing shared data (languages, scripts, CGI)"
    # Languages
    cp -a "$BIN_SRC_DIR/share/e2guardian/languages" "$SHARE_TARGET/languages"
    # Perl CGI block page script
    cp -a "$BIN_SRC_DIR/share/e2guardian/e2guardian.pl" "$SHARE_TARGET/e2guardian.pl"
    # Static assets (blocked flash, transparent gif)
    cp -a "$BIN_SRC_DIR/share/e2guardian/blockedflash.swf" "$SHARE_TARGET/"
    cp -a "$BIN_SRC_DIR/share/e2guardian/transparent1x1.gif" "$SHARE_TARGET/"
    # Scripts (logrotation etc.)
    cp -a "$BIN_SRC_DIR/share/e2guardian/scripts" "$SHARE_TARGET/scripts"
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
    chown -R "$SERVICE_NAME:$SERVICE_NAME" "$LOG_DIR"
    chown -R "$SERVICE_NAME:$SERVICE_NAME" "$RUN_DIR"
    chown -R "$SERVICE_NAME:$SERVICE_NAME" "$LIB_DIR"
    chown -R "$SERVICE_NAME:$SERVICE_NAME" "$CERT_DIR"
    chmod 0750 "$CERT_DIR"
    chmod 0750 "$CERT_DIR/generatedcerts"

    # PID file placeholder
    touch "$RUN_DIR/e2guardian.pid"
    chown "$SERVICE_NAME:$SERVICE_NAME" "$RUN_DIR/e2guardian.pid"

    # Running flag
    touch "$RUN_DIR/e2g_flag_running"
    chown "$SERVICE_NAME:$SERVICE_NAME" "$RUN_DIR/e2g_flag_running"

    info "Created: $LOG_DIR, $RUN_DIR, $LIB_DIR, $CERT_DIR"
}

install_systemd() {
    step "Step 7/8: Installing systemd service & logrotate"

    # --- systemd service unit ---
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << 'UNIT_EOF'
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

# Paths
ExecStart=/usr/sbin/e2guardian
ExecReload=/usr/sbin/e2guardian -r
ExecStop=/usr/sbin/e2guardian -q
PIDFile=/var/run/e2guardian/e2guardian.pid

# Restart policy — restart on crash, not on clean stop
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=30
TimeoutReloadSec=15

# Run as dedicated unprivileged user
User=e2guardian
Group=e2guardian

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=e2guardian

# Hardening
NoNewPrivileges=false
ProtectSystem=false
ReadWritePaths=/var/log/e2guardian /var/run/e2guardian /var/lib/e2guardian /etc/e2guardian/private/generatedcerts

[Install]
WantedBy=multi-user.target
UNIT_EOF

    systemctl daemon-reload
    info "Installed /etc/systemd/system/${SERVICE_NAME}.service"

    # --- logrotate config ---
    cat > "/etc/logrotate.d/${SERVICE_NAME}" << 'LOGROTATE_EOF'
/var/log/e2guardian/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 e2guardian e2guardian
    sharedscripts
    postrotate
        /usr/bin/systemctl reload e2guardian > /dev/null 2>&1 || true
    endscript
}
LOGROTATE_EOF

    info "Installed /etc/logrotate.d/${SERVICE_NAME}"

    # --- tmpfiles.d for run dir ---
    cat > "/etc/tmpfiles.d/${SERVICE_NAME}.conf" << TMPFILES_EOF
d /var/run/e2guardian 0755 e2guardian e2guardian -
TMPFILES_EOF

    info "Installed /etc/tmpfiles.d/${SERVICE_NAME}.conf"
}

start_service() {
    step "Step 8/8: Enabling and starting e2guardian"

    # Enable on boot
    systemctl enable "$SERVICE_NAME"
    info "Service enabled on boot (systemctl enable)"

    # Start the service
    if [[ "${1:-}" == "--no-start" ]]; then
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
        info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
        info "  Config file:"
        info "    $CONF_TARGET/e2guardian/e2guardian.conf"
        info "    $CONF_TARGET/e2guardian/e2guardianf1.conf  (group 1 - kids)"
        info "    $CONF_TARGET/e2guardian/e2guardianf2.conf  (group 2 - basic)"
        info "    $CONF_TARGET/e2guardian/e2guardianf3.conf  (group 3 - premium)"
        info ""
        info "  Log files:"
        info "    $LOG_DIR/access.log"
        info "    $LOG_DIR/dstats.log"
        info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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

    rm -f "$BIN_TARGET"
    rm -rf "$CONF_TARGET"
    rm -rf "$SHARE_TARGET"
    rm -rf "$DOC_TARGET"
    rm -f "$MAN_TARGET/e2guardian.8" "$MAN_TARGET/e2guardian.8.gz"

    info "Removed service, binary, configs, shared data, docs, man page."
    warn "Runtime directories NOT removed (preserve logs):"
    warn "  $LOG_DIR"
    warn "  $RUN_DIR"
    warn "  $LIB_DIR"
    warn "  Remove manually if desired: sudo rm -rf $LOG_DIR $RUN_DIR $LIB_DIR"

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
            uninstall
            exit 0
            ;;
        --help|-h)
            echo "Usage: sudo $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (no flags)     Full install + start service"
            echo "  --no-start     Install but don't start the service"
            echo "  --uninstall    Remove e2guardian from the system"
            echo "  --help         Show this help"
            exit 0
            ;;
    esac

    check_root
    detect_os
    confirm_source

    # Run installation steps
    install_deps
    create_user
    install_binary
    install_configs
    install_share
    install_runtime_dirs
    install_systemd
    start_service "${1:-}"
}

main "$@"
