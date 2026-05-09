#!/usr/bin/env bash
##############################################################################
# install-rocky10.sh — One-shot installer for e2guardian v5.5.9r
#
# Target OS:  Rocky Linux 10 (x86_64)
# Build sys:  GNU autotools (autogen.sh → configure → make → make install)
#
# Usage:
#   ./install-rocky10.sh                  # interactive (prompts for confirmation)
#   ./install-rocky10.sh --yes            # skip all confirmations
#   ./install-rocky10.sh --source-dir /path/to/src
#   ./install-rocky10.sh --prefix /usr/local
#   ./install-rocky10.sh --yes --source-dir /opt/e2guardian-src
##############################################################################
set -euo pipefail

##############################################################################
# ANSI color helpers
##############################################################################
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'  # No Color

##############################################################################
# Logging / output helpers
##############################################################################
info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[ OK ]${NC}  %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error()   { printf "${RED}[FAIL]${NC}  %s\n" "$*" >&2; }
die()     { error "$*"; exit 1; }

step_counter=0
step() {
    step_counter=$((step_counter + 1))
    printf "\n${BOLD}${CYAN}━━━ Step %d/%d ━━━  %s${NC}\n\n" "$step_counter" "$TOTAL_STEPS" "$*"
}

##############################################################################
# Defaults (overridable via CLI flags)
##############################################################################
SKIP_CONFIRM=false
CUSTOM_PREFIX=""
SOURCE_DIR=""   # resolved after option parsing (see below)
TOTAL_STEPS=14

##############################################################################
# Derived paths (populated in the prereq / configure section)
##############################################################################
E2_VERSION="5.5.9r"
E2_USER="e2guardian"
E2_GROUP="e2guardian"
E2_BINDIR=""
E2_CONFDIR=""
E2_DATADIR=""
E2_LOGDIR="/var/log/e2guardian"
E2_PIDDIR="/run/e2guardian"
E2_LIBDIR=""
E2_MANDIR=""
INSTALL_LOG="/var/log/e2guardian-install.log"

##############################################################################
# Trap — print line number on error
##############################################################################
trap '_err_handler ${LINENO} $?' ERR
_err_handler() {
    local lineno="$1" rc="$2"
    error "Command failed at line ${lineno} (exit code ${rc})."
    info "Check the install log at ${INSTALL_LOG} for details."
    exit "$rc"
}

##############################################################################
# Confirmation helper
##############################################################################
confirm() {
    if [[ "$SKIP_CONFIRM" == true ]]; then
        return 0
    fi
    local prompt="${1:-Continue?} [y/N] "
    local ans
    read -rp "$(printf "${YELLOW}%s${NC}" "$prompt")" ans
    [[ "$ans" =~ ^[Yy]$ ]]
}

##############################################################################
# Usage / banner
##############################################################################
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

One-shot installer for e2guardian v${E2_VERSION} on Rocky Linux 10.

Options:
  --yes              Skip all confirmation prompts
  --prefix DIR       Installation prefix (default: /usr/local)
  --source-dir DIR   Path to e2guardian source tree
                     (default: directory containing this script)
  -h, --help         Show this help message and exit

Examples:
  $0                            # interactive install
  $0 --yes                      # non-interactive install
  $0 --yes --source-dir /tmp/e2guardian-5.5.9r
EOF
    exit 0
}

print_banner() {
    cat <<'BANNER'
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║           ██████╗ ███╗   ██╗██╗  ██╗ █████╗  ██████╗                  ║
║          ██╔════╝ ████╗  ██║██║ ██╔╝██╔══██╗██╔════╝                  ║
║          ██║  ███╗██╔██╗ ██║█████╔╝ ███████║██║                       ║
║          ██║   ██║██║╚██╗██║██╔═██╗ ██╔══██║██║                       ║
║          ╚██████╔╝██║ ╚████║██║  ██╗██║  ██║╚██████╗                 ║
║           ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝                 ║
║              Web Content Filter  v5.5.9r                              ║
║                                                                       ║
║         One-Shot Installer for Rocky Linux 10                         ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
BANNER
}

##############################################################################
# Parse command-line arguments
##############################################################################
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes)          SKIP_CONFIRM=true; shift ;;
            --prefix)       CUSTOM_PREFIX="$2"; shift 2 ;;
            --source-dir)   SOURCE_DIR="$2";   shift 2 ;;
            -h|--help)      usage ;;
            *) die "Unknown option: $1 (use --help for usage)" ;;
        esac
    done
}

##############################################################################
# Step 1 — Prerequisites (OS, root, resources)
##############################################################################
check_prerequisites() {
    step "Checking prerequisites"

    # --- Must run as root ---------------------------------------------------
    if [[ $EUID -ne 0 ]]; then
        die "This script must be run as root (EUID=${EUID}). Use sudo."
    fi
    success "Running as root (EUID=${EUID})"

    # --- Detect Rocky Linux -------------------------------------------------
    if [[ ! -f /etc/rocky-release ]]; then
        die "This script is designed for Rocky Linux. /etc/rocky-release not found."
    fi
    local os_release
    os_release=$(< /etc/rocky-release)
    info "Detected OS: ${os_release}"

    # Parse major version — warn if not 10
    local os_major
    os_major=$(rpm -E '%rhel')
    if [[ "$os_major" != "10" ]]; then
        warn "Expected Rocky Linux 10, detected version ${os_major}. Proceeding anyway..."
    else
        success "Rocky Linux ${os_major} detected"
    fi

    # --- Source directory check ----------------------------------------------
    if [[ ! -d "${SOURCE_DIR}" ]]; then
        die "Source directory not found: ${SOURCE_DIR}"
    fi
    if [[ ! -f "${SOURCE_DIR}/configure.ac" ]]; then
        die "configure.ac not found in ${SOURCE_DIR} — is this the e2guardian source tree?"
    fi
    success "Source tree found at ${SOURCE_DIR}"

    # --- Resource checks ----------------------------------------------------
    local mem_kb
    mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_mb=$((mem_kb / 1024))
    info "Available RAM: ${mem_mb} MB"
    if [[ $mem_mb -lt 512 ]]; then
        warn "Less than 512 MB RAM detected. Compilation may be slow."
    else
        success "RAM check passed (${mem_mb} MB)"
    fi

    local disk_kb
    disk_kb=$(df -k --output=avail "${SOURCE_DIR}" | tail -1 | tr -d ' ')
    local disk_mb=$((disk_kb / 1024))
    info "Available disk space (source dir): ${disk_mb} MB"
    if [[ $disk_mb -lt 1024 ]]; then
        warn "Less than 1 GB disk space available. You may run out of space during compilation."
    else
        success "Disk space check passed (${disk_mb} MB)"
    fi

    # --- Logging setup ------------------------------------------------------
    mkdir -p "$(dirname "${INSTALL_LOG}")"
    exec > >(tee -a "${INSTALL_LOG}") 2>&1
    success "Logging to ${INSTALL_LOG}"
}

##############################################################################
# Step 2 — System update + EPEL
##############################################################################
system_update() {
    step "Updating system and enabling EPEL"

    info "Running dnf check-update (quiet)..."
    dnf check-update --quiet || true
    success "Package metadata is fresh"

    # EPEL provides extra packages that may be useful
    if ! rpm -q epel-release &>/dev/null; then
        info "Installing EPEL repository..."
        dnf install -y epel-release
        success "EPEL repository enabled"
    else
        success "EPEL repository already enabled"
    fi

    success "System update complete"
}

##############################################################################
# Step 3 — Install build dependencies
##############################################################################
install_build_deps() {
    step "Installing build dependencies"

    local -a deps=(
        # Core build toolchain
        gcc
        gcc-c++
        make
        cpp
        autoconf
        automake
        libtool
        pkg-config

        # Libraries (headers)
        zlib-devel
        pcre-devel
        openssl-devel

        # Runtime / utility
        file
        perl
        gettext
        which

        # Additional utilities commonly needed
        findutils
        sed
        gawk
        coreutils
        bzip2
        xz
    )

    info "Will install ${#deps[@]} packages via dnf..."

    # Install in a single transaction for speed
    dnf install -y "${deps[@]}"

    # Verify critical tools
    local tool
    for tool in gcc g++ make autoconf automake libtool pkg-config; do
        if command -v "$tool" &>/dev/null; then
            success "  ${tool}: $(command -v "$tool")"
        else
            die "Required tool '${tool}' not found after installation"
        fi
    done

    success "All build dependencies installed"
}

##############################################################################
# Step 4 — Create e2guardian user/group
##############################################################################
create_user_group() {
    step "Creating e2guardian system user and group"

    # Create group if it doesn't exist
    if getent group "${E2_GROUP}" &>/dev/null; then
        info "Group '${E2_GROUP}' already exists"
    else
        groupadd -r "${E2_GROUP}"
        success "Group '${E2_GROUP}' created"
    fi

    # Create user if it doesn't exist
    if id "${E2_USER}" &>/dev/null; then
        info "User '${E2_USER}' already exists"
    else
        useradd -r -g "${E2_GROUP}" -s /usr/sbin/nologin \
            -d /var/spool/e2guardian -M \
            -c "E2guardian web filter" "${E2_USER}"
        success "User '${E2_USER}' created (shell=/usr/sbin/nologin, home=/var/spool/e2guardian)"
    fi

    # Ensure spool directory exists
    mkdir -p /var/spool/e2guardian
    chown "${E2_USER}:${E2_GROUP}" /var/spool/e2guardian
    chmod 750 /var/spool/e2guardian

    success "User/group setup complete"
}

##############################################################################
# Step 5 — Run autogen.sh
##############################################################################
run_autogen() {
    step "Running autogen.sh (GNU autotools bootstrap)"

    cd "${SOURCE_DIR}"

    if [[ -f configure && -f Makefile.in ]]; then
        info "configure script already generated. Skipping autogen.sh."
        info "(Delete configure and Makefile.in to force re-generation.)"
    else
        info "Running autogen.sh..."
        bash autogen.sh
        success "autogen.sh completed"
    fi

    # Verify configure was produced
    if [[ ! -f configure ]]; then
        die "configure script was not generated. Check autogen.sh output."
    fi
    success "configure script ready"
}

##############################################################################
# Step 6 — Run configure
##############################################################################
run_configure() {
    step "Running configure"

    cd "${SOURCE_DIR}"

    # Resolve the installation prefix
    local prefix="${CUSTOM_PREFIX:-/usr/local}"

    # Derived paths
    E2_BINDIR="${prefix}/sbin"
    E2_CONFDIR="/etc/e2guardian"
    E2_DATADIR="${prefix}/share/e2guardian"
    E2_LOGDIR="/var/log/e2guardian"
    E2_PIDDIR="/run/e2guardian"
    E2_LIBDIR="${prefix}/lib/e2guardian"
    E2_MANDIR="${prefix}/share/man"

    info "Configure options:"
    cat <<CFG
  --prefix=${prefix}
  --sysconfdir=/etc
  --localstatedir=/var
  --with-proxyuser=${E2_USER}
  --with-proxygroup=${E2_GROUP}
  --with-piddir=${E2_PIDDIR}
  --with-logdir=${E2_LOGDIR}
  --mandir=${E2_MANDIR}
  --enable-pcre=yes
  --enable-icap=yes
  --enable-commandline=yes
  --enable-email=yes
CFG

    confirm "Proceed with configure?"

    # Clean any stale config cache
    if [[ -f config.cache ]]; then
        rm -f config.cache
        info "Removed stale config.cache"
    fi

    # Run configure — redirect output for a clean experience but capture it
    # in the install log (already tee'd)
    ./configure \
        --prefix="${prefix}" \
        --sysconfdir=/etc \
        --localstatedir=/var \
        --with-proxyuser="${E2_USER}" \
        --with-proxygroup="${E2_GROUP}" \
        --with-piddir="${E2_PIDDIR}" \
        --with-logdir="${E2_LOGDIR}" \
        --mandir="${E2_MANDIR}" \
        --enable-pcre=yes \
        --enable-icap=yes \
        --enable-commandline=yes \
        --enable-email=yes

    success "Configure completed successfully"
}

##############################################################################
# Step 7 — Compile (make)
##############################################################################
compile() {
    step "Compiling e2guardian (make -j$(nproc))"

    cd "${SOURCE_DIR}"

    local jobs
    jobs=$(nproc)
    info "Using ${jobs} parallel jobs"

    make -j"${jobs}"

    success "Compilation completed successfully"
}

##############################################################################
# Step 8 — Install (make install-strip)
##############################################################################
install_binaries() {
    step "Installing e2guardian (make install-strip)"

    cd "${SOURCE_DIR}"

    make install-strip

    success "make install-strip completed"
}

##############################################################################
# Step 9 — Set up directories and permissions
##############################################################################
setup_permissions() {
    step "Setting up directories and permissions"

    # Create required directories with correct ownership
    local -a dirs=(
        "${E2_CONFDIR}"
        "${E2_DATADIR}"
        "${E2_LOGDIR}"
        "${E2_PIDDIR}"
        "${E2_LIBDIR}"
        "/var/spool/e2guardian"
    )

    local d
    for d in "${dirs[@]}"; do
        if [[ ! -d "$d" ]]; then
            mkdir -p "$d"
            info "Created directory: $d"
        fi
    done

    # Config files — readable by root, owned by root (e2guardian reads as root, drops privs)
    chown -R root:root "${E2_CONFDIR}"
    chmod -R 644 "${E2_CONFDIR}"
    find "${E2_CONFDIR}" -type d -exec chmod 755 {} +

    # Data files — readable by all
    chown -R root:root "${E2_DATADIR}"
    chmod -R 644 "${E2_DATADIR}"
    find "${E2_DATADIR}" -type d -exec chmod 755 {} +

    # Log directory — writable by e2guardian user
    chown "${E2_USER}:${E2_GROUP}" "${E2_LOGDIR}"
    chmod 750 "${E2_LOGDIR}"

    # PID directory — writable by e2guardian user
    chown "${E2_USER}:${E2_GROUP}" "${E2_PIDDIR}"
    chmod 755 "${E2_PIDDIR}"

    # Spool directory
    chown "${E2_USER}:${E2_GROUP}" /var/spool/e2guardian
    chmod 750 /var/spool/e2guardian

    # Binary — root-owned, world-executable
    if [[ -f "${E2_BINDIR}/e2guardian" ]]; then
        chown root:root "${E2_BINDIR}/e2guardian"
        chmod 755 "${E2_BINDIR}/e2guardian"
        success "Binary installed: ${E2_BINDIR}/e2guardian"
    else
        die "Binary not found at ${E2_BINDIR}/e2guardian after make install-strip"
    fi

    # Shared libraries
    if [[ -d "${E2_LIBDIR}" ]]; then
        chown -R root:root "${E2_LIBDIR}"
        chmod -R 755 "${E2_LIBDIR}"
    fi

    # Run ldconfig in case shared libs were installed
    if [[ -d "${E2_LIBDIR}" ]]; then
        echo "${E2_LIBDIR}" > /etc/ld.so.conf.d/e2guardian.conf
        ldconfig
        info "Updated ldconfig for ${E2_LIBDIR}"
    fi

    success "Directory permissions configured"
}

##############################################################################
# Step 10 — Install systemd service file
##############################################################################
install_systemd_service() {
    step "Installing systemd service file"

    local service_file="/etc/systemd/system/e2guardian.service"

    cat > "${service_file}" <<EOF
[Unit]
Description=E2guardian Web filtering
After=network.target
Documentation=https://e2guardian.org/

[Service]
TasksMax=infinity
LimitNOFILE=65535
LimitSTACK=infinity:infinity
Type=forking
IgnoreSIGPIPE=no
GuessMainPID=no
User=root
ExecStart=${E2_BINDIR}/e2guardian
ExecReload=${E2_BINDIR}/e2guardian -r
ExecStop=${E2_BINDIR}/e2guardian -q
PIDFile=${E2_PIDDIR}/e2guardian.pid
UMask=027
Restart=on-failure
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    chmod 644 "${service_file}"
    success "Service file installed: ${service_file}"

    # Reload systemd daemon to pick up the new unit
    systemctl daemon-reload
    success "systemd daemon reloaded"
}

##############################################################################
# Step 11 — Install logrotate config
##############################################################################
install_logrotate() {
    step "Installing logrotate configuration"

    local logrotate_file="/etc/logrotate.d/e2guardian"

    cat > "${logrotate_file}" <<EOF
${E2_LOGDIR}/access.log {
    rotate 14
    daily
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    prerotate
        systemctl stop e2guardian > /dev/null 2>&1 || true
    endscript
    postrotate
        systemctl start e2guardian > /dev/null 2>&1
    endscript
}
EOF

    chmod 644 "${logrotate_file}"
    success "Logrotate config installed: ${logrotate_file}"

    # Create an initial (empty) log file so logrotate doesn't complain
    touch "${E2_LOGDIR}/access.log"
    chown "${E2_USER}:${E2_GROUP}" "${E2_LOGDIR}/access.log"
    chmod 640 "${E2_LOGDIR}/access.log"
    success "Initial log file created"
}

##############################################################################
# Step 12 — Enable and start service
##############################################################################
enable_start_service() {
    step "Enabling and starting e2guardian service"

    # Check if there's a valid config before attempting to start
    if [[ ! -f "${E2_CONFDIR}/e2guardian.conf" ]]; then
        warn "No e2guardian.conf found in ${E2_CONFDIR}"
        warn "The service will be enabled but may fail to start until configured."
        systemctl enable e2guardian
        success "Service enabled (but NOT started — config required)"
        return 0
    fi

    # Enable at boot
    systemctl enable e2guardian
    success "Service enabled at boot"

    # Try to start
    if systemctl start e2guardian; then
        success "e2guardian service started successfully"
    else
        local rc=$?
        warn "e2guardian service failed to start (exit code ${rc})"
        warn "This is likely a configuration issue. Run 'journalctl -u e2guardian' for details."
        warn "The service is enabled and will be attempted at next boot after configuration."
    fi
}

##############################################################################
# Step 13 — Verify installation
##############################################################################
verify_installation() {
    step "Verifying installation"

    local failures=0

    # Binary
    if [[ -x "${E2_BINDIR}/e2guardian" ]]; then
        local installed_version
        installed_version=$("${E2_BINDIR}/e2guardian" -v 2>&1 || true)
        success "Binary: ${E2_BINDIR}/e2guardian  ${installed_version}"
    else
        error "Binary NOT found: ${E2_BINDIR}/e2guardian"
        failures=$((failures + 1))
    fi

    # Config directory
    if [[ -d "${E2_CONFDIR}" ]]; then
        local conf_count
        conf_count=$(find "${E2_CONFDIR}" -type f | wc -l)
        success "Config directory: ${E2_CONFDIR}  (${conf_count} files)"
    else
        error "Config directory NOT found: ${E2_CONFDIR}"
        failures=$((failures + 1))
    fi

    # Main config file
    if [[ -f "${E2_CONFDIR}/e2guardian.conf" ]]; then
        success "Main config: ${E2_CONFDIR}/e2guardian.conf"
    else
        warn "Main config NOT found: ${E2_CONFDIR}/e2guardian.conf"
    fi

    # Data directory
    if [[ -d "${E2_DATADIR}" ]]; then
        success "Data directory: ${E2_DATADIR}"
    else
        error "Data directory NOT found: ${E2_DATADIR}"
        failures=$((failures + 1))
    fi

    # Log directory
    if [[ -d "${E2_LOGDIR}" ]]; then
        success "Log directory: ${E2_LOGDIR}"
    else
        error "Log directory NOT found: ${E2_LOGDIR}"
        failures=$((failures + 1))
    fi

    # PID directory
    if [[ -d "${E2_PIDDIR}" ]]; then
        success "PID directory: ${E2_PIDDIR}"
    else
        error "PID directory NOT found: ${E2_PIDDIR}"
        failures=$((failures + 1))
    fi

    # systemd service
    if systemctl list-unit-files e2guardian.service &>/dev/null; then
        local is_enabled
        is_enabled=$(systemctl is-enabled e2guardian 2>/dev/null || echo "unknown")
        success "Systemd service: e2guardian.service (enabled=${is_enabled})"
    else
        error "Systemd service NOT found: e2guardian.service"
        failures=$((failures + 1))
    fi

    # logrotate config
    if [[ -f /etc/logrotate.d/e2guardian ]]; then
        success "Logrotate config: /etc/logrotate.d/e2guardian"
    else
        error "Logrotate config NOT found: /etc/logrotate.d/e2guardian"
        failures=$((failures + 1))
    fi

    # User/group
    if id "${E2_USER}" &>/dev/null; then
        success "System user: ${E2_USER} ($(id "${E2_USER}" | tr ',' '\n' | grep groups | sed 's/.*=//'))"
    else
        error "System user NOT found: ${E2_USER}"
        failures=$((failures + 1))
    fi

    if [[ $failures -gt 0 ]]; then
        warn "Verification completed with ${failures} failure(s)"
    else
        success "All verification checks passed"
    fi
}

##############################################################################
# Step 14 — Print summary
##############################################################################
print_summary() {
    local prefix="${CUSTOM_PREFIX:-/usr/local}"

    # Service status
    local svc_status="unknown"
    if systemctl is-active e2guardian &>/dev/null; then
        svc_status="running"
    elif systemctl is-enabled e2guardian &>/dev/null; then
        svc_status="enabled (not running)"
    else
        svc_status="not enabled"
    fi

    cat <<SUMMARY

${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════════${NC}
${BOLD}${GREEN}  Installation Summary${NC}
${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════════${NC}

  ${CYAN}Version:${NC}         ${E2_VERSION}
  ${CYAN}Install Prefix:${NC}  ${prefix}
  ${CYAN}Service Status:${NC}  ${svc_status}

${BOLD}  Paths:${NC}
  ${CYAN}Binary:${NC}          ${E2_BINDIR}/e2guardian
  ${CYAN}Config:${NC}          ${E2_CONFDIR}/
  ${CYAN}Data:${NC}            ${E2_DATADIR}/
  ${CYAN}Log:${NC}             ${E2_LOGDIR}/
  ${CYAN}PID:${NC}             ${E2_PIDDIR}/
  ${CYAN}Libraries:${NC}       ${E2_LIBDIR}/
  ${CYAN}Man pages:${NC}       ${E2_MANDIR}/

${BOLD}  Service Management:${NC}
  ${CYAN}Start:${NC}           systemctl start e2guardian
  ${CYAN}Stop:${NC}            systemctl stop e2guardian
  ${CYAN}Restart:${NC}         systemctl restart e2guardian
  ${CYAN}Reload:${NC}          systemctl reload e2guardian
  ${CYAN}Status:${NC}          systemctl status e2guardian
  ${CYAN}Logs (journal):${NC}  journalctl -u e2guardian -f
  ${CYAN}Logs (file):${NC}     tail -f ${E2_LOGDIR}/access.log

${BOLD}  Configuration:${NC}
  ${CYAN}Main config:${NC}     ${E2_CONFDIR}/e2guardian.conf
  ${CYAN}Filter groups:${NC}   ${E2_CONFDIR}/e2guardianf1.conf
  ${CYAN}Phrase lists:${NC}    ${E2_CONFDIR}/lists/
  ${CYAN}Auth plugins:${NC}    ${E2_CONFDIR}/authplugins/
  ${CYAN}Content scanners:${NC} ${E2_CONFDIR}/contentscanners/
  ${CYAN}Download managers:${NC}${E2_CONFDIR}/downloadmanagers/

${BOLD}  Install log:${NC}     ${INSTALL_LOG}

${BOLD}${YELLOW}  ⚠  Next Steps:${NC}
  1. Edit ${E2_CONFDIR}/e2guardian.conf to set your filtering preferences.
  2. At minimum, configure:
     - filterip / filterports (listen address)
  3. systemctl restart e2guardian
  4. Configure client browsers/DHCP to use this proxy as their gateway.
  5. For SSL/HTTPS filtering, enable: enablessl = on (see MITM section).

${BOLD}${CYAN}  Note:${NC} Running in STANDALONE mode (no Squid).
  e2guardian connects directly to websites after filtering.

${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════════${NC}

SUMMARY
}

##############################################################################
# Main
##############################################################################
main() {
    parse_args "$@"

    # Resolve SOURCE_DIR: default to the directory containing this script
    if [[ -z "$SOURCE_DIR" ]]; then
        # Resolve the real path of this script, then take its parent
        local script_path
        script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
        SOURCE_DIR="$(dirname "$(readlink -f "${script_path}")")"
    else
        # Resolve to absolute path
        SOURCE_DIR="$(readlink -f "${SOURCE_DIR}")"
    fi

    print_banner

    info "e2guardian v${E2_VERSION} installer for Rocky Linux 10"
    info "Source directory: ${SOURCE_DIR}"
    info "Install log:      ${INSTALL_LOG}"
    echo ""

    confirm "Begin installation?"

    # Run all steps
    check_prerequisites
    system_update
    install_build_deps
    create_user_group
    run_autogen
    run_configure
    compile
    install_binaries
    setup_permissions
    install_systemd_service
    install_logrotate
    enable_start_service
    verify_installation
    print_summary

    success "Installation complete!"
}

main "$@"
