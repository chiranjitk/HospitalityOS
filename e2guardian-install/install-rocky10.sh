#!/usr/bin/env bash
# =============================================================================
# StaySuite-HospitalityOS — e2guardian v5.5.9 Installer for Rocky Linux 10
# =============================================================================
#
# Installs pre-compiled e2guardian to standard FHS system paths:
#
#   /usr/sbin/e2guardian                  — binary
#   /etc/e2guardian/                       — all config, lists, certificates
#   /etc/e2guardian/e2guardian/            — main config + filter groups
#   /usr/share/e2guardian/languages/       — 27 language packs
#   /usr/share/e2guardian/                 — scripts, templates, CGI
#   /usr/share/doc/e2guardian/             — documentation
#   /usr/share/man/man8/e2guardian.8.gz    — man page
#   /var/log/e2guardian/                   — access & stats logs
#   /var/run/e2guardian/                   — PID, monitor flags
#   /var/lib/e2guardian/                   — runtime data
#
# Source files are copied FROM the bundled e2guardian-install/ directory
# TO standard system locations.  Config paths are rewritten automatically.
#
# Usage:
#   cd /opt/staysuite && sudo ./e2guardian-install/install-rocky10.sh
#   sudo ./e2guardian-install/install-rocky10.sh --no-start
#   sudo ./e2guardian-install/install-rocky10.sh --uninstall
#
# Manage e2guardian:
#   sudo systemctl start|stop|restart|reload|status e2guardian
#   sudo journalctl -u e2guardian -f
#
# =============================================================================

set -euo pipefail

# =============================================================================
# SOURCE — Where are the pre-compiled files?
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# FHS TARGET PATHS — Standard Linux filesystem layout
# =============================================================================
readonly BIN_TARGET="/usr/sbin/e2guardian"
readonly CONF_DIR="/etc/e2guardian"
readonly ETC_DIR="${CONF_DIR}/e2guardian"
readonly SHARE_DIR="/usr/share/e2guardian"
readonly LANG_DIR="${SHARE_DIR}/languages"
readonly DOC_DIR="/usr/share/doc/e2guardian"
readonly MAN_DIR="/usr/share/man/man8"
readonly LOG_DIR="/var/log/e2guardian"
readonly RUN_DIR="/var/run/e2guardian"
readonly LIB_DIR="/var/lib/e2guardian"
readonly CERT_DIR="${CONF_DIR}/private"
readonly SERVICE_NAME="e2guardian"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
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
            error "Unsupported OS: $ID $VERSION_ID. This script is for Rocky/RHEL/AlmaLinux."
            exit 1
            ;;
    esac
    info "Detected OS: $ID $VERSION_ID ($PRETTY_NAME)"
}

confirm_source() {
    if [[ ! -f "$SCRIPT_DIR/sbin/e2guardian" ]]; then
        error "e2guardian binary not found at $SCRIPT_DIR/sbin/e2guardian"
        error "Expected this script at: <project>/e2guardian-install/install-rocky10.sh"
        exit 1
    fi
    local file_count
    file_count=$(find "$SCRIPT_DIR" -type f | wc -l)
    info "Source: $SCRIPT_DIR ($file_count files)"
}

# =============================================================================
# PATH REWRITING — Replace sandbox paths with FHS paths in config files
# =============================================================================
# Uses grep (NOT rg/ripgrep) for Rocky/RHEL minimal install compatibility.
rewrite_paths() {
    local dir="$1"
    local count=0
    local f

    while IFS= read -r -d '' f; do
        # Skip binary files and empty files
        if ! file "$f" | grep -qiE "text|ASCII|empty"; then continue; fi
        # Skip this install script
        if [[ "$f" == *"/install-rocky10.sh" ]]; then continue; fi
        # Skip if no e2guardian paths in the file
        if ! grep -q "e2guardian" "$f" 2>/dev/null; then continue; fi

        # Rewrite all sandbox paths to FHS system paths
        # Order matters: more specific patterns first

        # Pattern 1: .Define LISTDIR directives
        # Use CONF_DIR (/etc/e2guardian) NOT ETC_DIR to avoid double /e2guardian
        # Source: .../etc/e2guardian/e2guardian/lists/group1
        # After:  /etc/e2guardian/e2guardian/lists/group1  (conf_dir + remaining path)
        sed -i \
            -e "s|\.Define LISTDIR <[^>]*/e2guardian-install/etc/e2guardian|\.Define LISTDIR <${CONF_DIR}|g" \
            "$f"

        # Pattern 2: sbin/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/sbin/e2guardian|${BIN_TARGET}|g" \
            "$f"

        # Pattern 3: etc/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/etc/e2guardian|${CONF_DIR}|g" \
            "$f"

        # Pattern 4: share/e2guardian (languages, templates, scripts)
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/e2guardian|${SHARE_DIR}|g" \
            "$f"

        # Pattern 5: share/doc/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/doc/e2guardian|${DOC_DIR}|g" \
            "$f"

        # Pattern 6: share/man
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/share/man|/usr/share/man|g" \
            "$f"

        # Pattern 7: var/log/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/log/e2guardian|${LOG_DIR}|g" \
            "$f"

        # Pattern 8: var/run/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/run/e2guardian|${RUN_DIR}|g" \
            "$f"

        # Pattern 9: var/lib/e2guardian
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var/lib/e2guardian|${LIB_DIR}|g" \
            "$f"

        # Pattern 10: catch-all var
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install/var|/var|g" \
            "$f"

        # Pattern 11: final catch-all
        sed -i \
            -e "s|/[^ \"'>]*/e2guardian-install|/opt/staysuite/e2guardian-install|g" \
            "$f"

        count=$((count + 1))
    done < <(find "$dir" -type f -print0)

    echo "$count"
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
    step "Step 3/8: Installing binary to /usr/sbin"
    install -m 0755 "$SCRIPT_DIR/sbin/e2guardian" "$BIN_TARGET"
    info "Installed $BIN_TARGET ($(du -h "$BIN_TARGET" | cut -f1))"
}

install_configs() {
    step "Step 4/8: Installing config files to /etc/e2guardian"

    # Preserve any existing configs by backing up
    if [[ -d "$CONF_DIR" ]]; then
        local bak
        bak="/etc/e2guardian.pre-install.$(date +%Y%m%d%H%M%S)"
        cp -a "$CONF_DIR" "$bak"
        warn "Backed up existing config to $bak"
    fi

    # Install the entire etc tree
    mkdir -p "$CONF_DIR"
    cp -a "$SCRIPT_DIR/etc/e2guardian/"* "$CONF_DIR/"
    info "Installed config tree to $CONF_DIR"

    # Fix daemonuser/daemongroup
    sed -i \
        -e "s/^daemonuser = .*/daemonuser = '${SERVICE_NAME}'/" \
        -e "s/^daemongroup = .*/daemongroup = '${SERVICE_NAME}'/" \
        "$ETC_DIR/e2guardian.conf"
    info "Set daemonuser/daemongroup = '${SERVICE_NAME}'"

    # Set nodaemon = off for production (systemd manages daemonization)
    sed -i 's/^nodaemon = on/nodaemon = off/' "$ETC_DIR/e2guardian.conf"
    info "Set nodaemon = off (systemd manages the process)"

    # Rewrite ALL sandbox paths → FHS system paths
    info "Rewriting sandbox paths → FHS system paths"
    local count
    count=$(rewrite_paths "$CONF_DIR")
    info "Scanned and rewrote paths in $count config files"
}

install_shared() {
    step "Step 5/8: Installing shared data to /usr/share/e2guardian"

    # Languages (27 language packs)
    mkdir -p "$LANG_DIR"
    cp -a "$SCRIPT_DIR/share/e2guardian/languages/"* "$LANG_DIR/"
    info "Installed $(ls -1d "$LANG_DIR"/*/ 2>/dev/null | wc -l) language packs to $LANG_DIR"

    # Templates and scripts
    mkdir -p "$SHARE_DIR"
    cp -a "$SCRIPT_DIR/share/e2guardian/e2guardian.pl" "$SHARE_DIR/" 2>/dev/null || true
    cp -a "$SCRIPT_DIR/share/e2guardian/blockedflash.swf" "$SHARE_DIR/" 2>/dev/null || true
    cp -a "$SCRIPT_DIR/share/e2guardian/transparent1x1.gif" "$SHARE_DIR/" 2>/dev/null || true
    cp -a "$SCRIPT_DIR/share/e2guardian/scripts" "$SHARE_DIR/" 2>/dev/null || true
    info "Installed scripts and templates to $SHARE_DIR"

    # Rewrite paths in scripts
    local count
    count=$(rewrite_paths "$SHARE_DIR")
    info "Rewrote paths in $count shared files"

    # Documentation
    mkdir -p "$DOC_DIR"
    cp -a "$SCRIPT_DIR/share/doc/e2guardian/"* "$DOC_DIR/" 2>/dev/null || true
    info "Installed docs to $DOC_DIR"

    # Man page
    mkdir -p "$MAN_DIR"
    if [[ -f "$SCRIPT_DIR/share/man/man8/e2guardian.8" ]]; then
        cp -a "$SCRIPT_DIR/share/man/man8/e2guardian.8" "$MAN_DIR/"
        gzip -f "$MAN_DIR/e2guardian.8"
        info "Installed man page"
    fi
}

generate_certs() {
    step "Step 6/8: Checking & generating SSL certificates"

    mkdir -p "$CERT_DIR/generatedcerts"

    # Check if ca.pem exists; generate from ca.key if missing
    if [[ ! -f "$CERT_DIR/ca.pem" ]]; then
        if [[ -f "$CERT_DIR/ca.key" ]]; then
            info "Generating CA certificate from existing ca.key..."
            openssl req -new -x509 -days 3650 \
                -key "$CERT_DIR/ca.key" \
                -out "$CERT_DIR/ca.pem" \
                -subj "/C=IN/ST=Kolkata/L=Kolkata/O=StaySuite HospitalityOS/OU=ContentFilter/CN=StaySuite-CA" \
                2>/dev/null
            if [[ -f "$CERT_DIR/ca.pem" ]]; then
                info "Generated $CERT_DIR/ca.pem (valid 10 years)"
            else
                warn "Failed to generate ca.pem from ca.key — SSL features may not work"
            fi
        else
            warn "No ca.key found — generating a new CA key + certificate..."
            openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                -keyout "$CERT_DIR/ca.key" \
                -out "$CERT_DIR/ca.pem" \
                -subj "/C=IN/ST=Kolkata/L=Kolkata/O=StaySuite HospitalityOS/OU=ContentFilter/CN=StaySuite-CA" \
                2>/dev/null
            if [[ -f "$CERT_DIR/ca.pem" ]]; then
                info "Generated new CA key + certificate (valid 10 years)"
            else
                warn "Failed to generate CA certificate — SSL features may not work"
            fi
        fi
    else
        info "CA certificate exists: $CERT_DIR/ca.pem"
    fi

    # Verify certificates are valid
    if [[ -f "$CERT_DIR/ca.pem" ]]; then
        local expiry
        expiry=$(openssl x509 -in "$CERT_DIR/ca.pem" -noout -enddate 2>/dev/null | cut -d= -f2)
        info "CA cert expiry: $expiry"
    fi
}

install_runtime() {
    step "Step 7/8: Creating runtime directories & fixing permissions"

    # Runtime directories
    mkdir -p "$LOG_DIR"
    mkdir -p "$RUN_DIR"
    mkdir -p "$LIB_DIR"

    # Ownership on runtime dirs
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

    # Ensure config is readable by the e2guardian user
    chmod -R o+rX "$CONF_DIR"
    chmod -R o+rX "$SHARE_DIR"

    info "Created and owned:"
    info "  $LOG_DIR"
    info "  $RUN_DIR"
    info "  $LIB_DIR"
    info "  $CERT_DIR"
}

install_systemd() {
    step "Step 8/8: Installing systemd service & logrotate"

    # --- systemd service unit ---
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

# Clean up stale PID file from previous crashes
ExecStartPre=-/usr/bin/rm -f ${RUN_DIR}/e2guardian.pid

# IMPORTANT: -c flag is REQUIRED because the binary was compiled with
# sandbox paths hardcoded. Without -c, e2guardian looks for config at
# the old build-time path instead of /etc/e2guardian/.
ExecStart=${BIN_TARGET} -c ${ETC_DIR}/e2guardian.conf
ExecReload=${BIN_TARGET} -r -c ${ETC_DIR}/e2guardian.conf
ExecStop=${BIN_TARGET} -q -c ${ETC_DIR}/e2guardian.conf
PIDFile=${RUN_DIR}/e2guardian.pid

# Runtime directory (auto-created by systemd with correct ownership)
RuntimeDirectory=e2guardian
RuntimeDirectoryMode=0755

# Restart policy
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

# Hardening
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

    # --- tmpfiles.d ---
    cat > "/etc/tmpfiles.d/${SERVICE_NAME}.conf" << TMPFILES_EOF
d ${RUN_DIR} 0755 ${SERVICE_NAME} ${SERVICE_NAME} -
d ${LOG_DIR} 0755 ${SERVICE_NAME} ${SERVICE_NAME} -
TMPFILES_EOF

    info "Installed /etc/tmpfiles.d/${SERVICE_NAME}.conf"
}

start_service() {
    echo ""
    step "Enabling and starting e2guardian"

    systemctl enable "$SERVICE_NAME"
    info "Service enabled on boot"

    # Check for --no-start
    local start_flag="yes"
    for arg in "$@"; do
        if [[ "$arg" == "--no-start" ]]; then
            start_flag="no"
        fi
    done

    if [[ "$start_flag" == "no" ]]; then
        warn "Skipping service start (--no-start flag)."
        warn "Start manually: sudo systemctl start e2guardian"
        return
    fi

    systemctl start "$SERVICE_NAME"
    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        info "e2guardian is RUNNING"
        echo ""
        systemctl status "$SERVICE_NAME" --no-pager -l 2>&1 | head -20
        echo ""
        info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        info "  e2guardian v5.5.9 — FHS System Install"
        info ""
        info "  Listening on:"
        info "    Port 8080  — HTTP transparent proxy"
        info "    Port 8090  — TLS proxy"
        info "    Port 8443  — HTTPS transparent proxy"
        info ""
        info "  System paths:"
        info "    Binary:    $BIN_TARGET"
        info "    Config:    $ETC_DIR/e2guardian.conf"
        info "    Lists:     $ETC_DIR/e2guardian/lists/"
        info "    Languages: $LANG_DIR/"
        info "    Logs:      $LOG_DIR/"
        info "    PID:       $RUN_DIR/e2guardian.pid"
        info ""
        info "  Filter groups:"
        info "    $ETC_DIR/e2guardianf1.conf  (group 1 — kids)"
        info "    $ETC_DIR/e2guardianf2.conf  (group 2 — basic)"
        info "    $ETC_DIR/e2guardianf3.conf  (group 3 — premium)"
        info ""
        info "  Management:"
        info "    sudo systemctl restart e2guardian"
        info "    sudo systemctl reload e2guardian"
        info "    sudo journalctl -u e2guardian -f"
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
    step "Uninstalling e2guardian (FHS system paths)"

    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    rm -f "/etc/logrotate.d/${SERVICE_NAME}"
    rm -f "/etc/tmpfiles.d/${SERVICE_NAME}.conf"
    systemctl daemon-reload

    # Remove installed files
    rm -f "$BIN_TARGET"
    rm -f "/usr/share/man/man8/e2guardian.8.gz"

    info "Removed systemd service, logrotate, tmpfiles.d config."
    info "Removed binary and man page."

    warn "The following directories are preserved (contain data/logs):"
    warn "  $CONF_DIR   (configs, lists, certificates)"
    warn "  $SHARE_DIR  (languages, templates)"
    warn "  $DOC_DIR    (documentation)"
    warn "  $LOG_DIR    (log files)"
    warn "  $RUN_DIR    (runtime data)"
    warn "  $LIB_DIR    (application data)"
    warn ""
    warn "Remove manually if desired:"
    warn "  sudo rm -rf $CONF_DIR $SHARE_DIR $DOC_DIR $LOG_DIR $RUN_DIR $LIB_DIR"

    info "User '$SERVICE_NAME' NOT removed. Remove manually:"
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
    echo "║  Version: e2guardian v5.5.9 (pre-compiled, FHS layout)    ║"
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
            echo "Installs e2guardian v5.5.9 to standard FHS system paths."
            echo ""
            echo "Options:"
            echo "  (no flags)          Full install + start service"
            echo "  --no-start          Install but don't start the service"
            echo "  --uninstall         Remove e2guardian from system paths"
            echo "  --help              Show this help"
            echo ""
            echo "FHS Installation Layout:"
            echo "  $BIN_TARGET              — binary"
            echo "  $ETC_DIR/e2guardian.conf  — main config"
            echo "  $LANG_DIR/                 — 27 language packs"
            echo "  $LOG_DIR/                  — access & stats logs"
            echo "  $RUN_DIR/                  — PID & monitor flags"
            echo "  $LIB_DIR/                  — runtime data"
            echo ""
            echo "Examples:"
            echo "  cd /opt/staysuite && sudo ./e2guardian-install/install-rocky10.sh"
            echo "  sudo ./e2guardian-install/install-rocky10.sh --no-start"
            echo "  sudo ./e2guardian-install/install-rocky10.sh --uninstall"
            exit 0
            ;;
    esac

    check_root
    detect_os
    confirm_source

    echo ""
    info "FHS Installation Layout:"
    info "  Binary:    $BIN_TARGET"
    info "  Config:    $ETC_DIR/"
    info "  Share:     $SHARE_DIR/"
    info "  Languages: $LANG_DIR/"
    info "  Docs:      $DOC_DIR/"
    info "  Logs:      $LOG_DIR/"
    info "  Run:       $RUN_DIR/"
    info "  Lib:       $LIB_DIR/"
    echo ""

    install_deps
    create_user
    install_binary
    install_configs
    install_shared
    generate_certs
    install_runtime
    install_systemd
    start_service "$@"
}

main "$@"
