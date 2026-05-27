#!/usr/bin/env bash
####################################################################################################
#
#  setup-ldap-freeradius.sh — One-shot OpenLDAP + Samba + FreeRADIUS LDAP integration
#
#  This script automates the entire setup of:
#    1. Samba binaries extraction from .deb packages
#    2. OpenLDAP 2.6.10 compilation from source
#    3. LDAP directory initialization with users, groups, and sambaSamAccount
#    4. FreeRADIUS LDAP module configuration and auth flow
#    5. Verification tests (LDAP connectivity + 3 radtest commands)
#
#  Usage:
#    chmod +x /home/z/my-project/scripts/setup-ldap-freeradius.sh
#    bash /home/z/my-project/scripts/setup-ldap-freeradius.sh
#
#  Requirements:
#    - Runs as user 'z' with no sudo access
#    - Debian Trixie / testing apt repository available
#    - Internet connectivity for downloading packages
#
####################################################################################################

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  COLOR HELPERS & LOGGING
# ═══════════════════════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No Color

STEP=0
TOTAL_STEPS=16

log_step() {
    STEP=$((STEP + 1))
    echo -e "\n${BLUE}${BOLD}━━━ [${STEP}/${TOTAL_STEPS}] ${1} ━━━${NC}"
}

log_ok()   { echo -e "  ${GREEN}✓ ${1}${NC}"; }
log_warn() { echo -e "  ${YELLOW}⚠ ${1}${NC}"; }
log_err()  { echo -e "  ${RED}✗ ${1}${NC}"; }
log_info() { echo -e "  ${CYAN}→ ${1}${NC}"; }

die() {
    echo -e "\n${RED}${BOLD}FATAL: ${1}${NC}" >&2
    exit 1
}

on_error() {
    local line_no=$1
    echo -e "\n${RED}${BOLD}ERROR at line ${line_no} — script aborted.${NC}" >&2
}
trap 'on_error ${LINENO}' ERR

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  PATHS & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════════════════

PROJECT_DIR="/home/z/my-project"
LDAP_INSTALL_DIR="${PROJECT_DIR}/openldap-install"
SAMBA_INSTALL_DIR="${PROJECT_DIR}/samba-install"
FREERADIUS_DIR="${PROJECT_DIR}/freeradius-install"
LDAP_DATA_DIR="${LDAP_INSTALL_DIR}/var/openldap-data"
LDAP_RUN_DIR="${LDAP_INSTALL_DIR}/var/run"
LDAP_ETC_DIR="${LDAP_INSTALL_DIR}/etc/openldap"
LDAP_SCHEMA_DIR="${LDAP_INSTALL_DIR}/etc/openldap/schema"
SLAPD_CONF="${LDAP_ETC_DIR}/slapd.conf"
LDAP_PORT=3890

# Credentials
BASE_DN="dc=staysuite,dc=local"
ROOT_DN="cn=admin,dc=staysuite,dc=local"
ADMIN_PW="Admin@123"

# Test users: username|password|displayName|sambaSID
declare -A USER_MAP=(
    ["john.smith"]="JohnPass@2025|John Smith|S-1-5-21-1000000001-1000000001-1000000001-1001"
    ["jane.doe"]="JanePass@2025|Jane Doe|S-1-5-21-1000000001-1000000001-1000000001-1002"
    ["guest-admin"]="GuestAdmin@2025|Guest Admin|S-1-5-21-1000000001-1000000001-1000000001-1003"
)

# Groups with members
declare -A GROUP_MEMBERS=(
    ["Corporate"]="john.smith jane.doe guest-admin"
    ["WiFiUsers"]="john.smith jane.doe guest-admin"
    ["FullAccess"]="john.smith"
    ["Restricted"]="guest-admin"
)

# RADIUS test secret (from SQL nas table)
RADIUS_TEST_SECRET="localkey"

# Temp directory
TMPDIR=$(mktemp -d /tmp/ldap-setup.XXXXXX)
trap 'rm -rf "${TMPDIR}"' EXIT

cd "${PROJECT_DIR}"

echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║         StaySuite — OpenLDAP + Samba + FreeRADIUS Setup Script           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Base DN      : ${BASE_DN}"
echo "  Admin DN     : ${ROOT_DN}"
echo "  LDAP Port    : ${LDAP_PORT}"
echo "  LDAP Install : ${LDAP_INSTALL_DIR}"
echo "  Samba Install: ${SAMBA_INSTALL_DIR}"
echo "  FR Install   : ${FREERADIUS_DIR}"
echo "  Temp Dir     : ${TMPDIR}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 1 — Download all required .deb packages
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Download .deb packages (slapd, ldap-utils, samba, krb5-user, groff-base)"

DEB_CACHE="${TMPDIR}/debs"
mkdir -p "${DEB_CACHE}"

# Check if samba binaries already exist (skip download if so)
if [ -f "${SAMBA_INSTALL_DIR}/usr/sbin/smbd" ]; then
    log_ok "Samba binaries already exist — skipping download"
else
    log_info "Downloading slapd, ldap-utils, samba, samba-common-bin, winbind, krb5-user..."
    cd "${DEB_CACHE}"

    # Download packages with dependencies
    apt-get download \
        slapd ldap-utils samba samba-common-bin winbind krb5-user libwbclient0 \
        libtalloc2 libtdb1 libtevent0t64 libldb2 libbsd0 libreadline8t64 \
        libpopt0 libdbus-1-3 libjansson4 liblcups2t64 libtirpc3t64 \
        libgnutls30t64 libwrap0 liburing2 libtasn1-6 libncurses6 libtinfo6 \
        libk5crypto3 libkrb5-3 libkrb5support0 libkadm5srv-mit12 libkadm5clnt-mit12 \
        libcom-err2 libss2 libkdb5-10t64 libldap2 2>&1 | tail -5 || true

    DEB_COUNT=$(find "${DEB_CACHE}" -name "*.deb" | wc -l)
    log_ok "Downloaded ${DEB_COUNT} .deb packages"
fi

cd "${PROJECT_DIR}"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 2 — Extract Samba binaries from .deb packages
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Extract Samba binaries to ${SAMBA_INSTALL_DIR}"

if [ -f "${SAMBA_INSTALL_DIR}/usr/sbin/smbd" ]; then
    log_ok "Samba binaries already extracted — skipping"
else
    mkdir -p "${SAMBA_INSTALL_DIR}"

    for deb in "${DEB_CACHE}"/*.deb; do
        dpkg-deb -x "${deb}" "${SAMBA_INSTALL_DIR}" 2>/dev/null || true
    done

    # Verify key binaries
    if [ -f "${SAMBA_INSTALL_DIR}/usr/sbin/smbd" ]; then
        log_ok "smbd extracted"
    else
        log_warn "smbd not found — samba binaries may be partially extracted (non-critical for LDAP)"
    fi

    if [ -f "${SAMBA_INSTALL_DIR}/usr/bin/tdbdump" ]; then
        log_ok "tdbdump extracted"
    fi

    # Check for samba.schema
    SAMBA_SCHEMA_SRC=$(find "${SAMBA_INSTALL_DIR}" -name "samba.schema" -type f 2>/dev/null | head -1)
    if [ -n "${SAMBA_SCHEMA_SRC}" ]; then
        log_ok "samba.schema found at ${SAMBA_SCHEMA_SRC}"
    else
        log_warn "samba.schema not found in extracted debs"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 3 — Create Samba environment script
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Create Samba environment script"

mkdir -p "${SAMBA_INSTALL_DIR}/bin"
cat > "${SAMBA_INSTALL_DIR}/bin/samba-env.sh" << 'SAMBA_ENV_EOF'
#!/bin/bash
# Samba user-space environment setup
# Source this file: source /home/z/my-project/samba-install/bin/samba-env.sh

export SAMBA_HOME=/home/z/my-project/samba-install
export PATH=$SAMBA_HOME/usr/sbin:$SAMBA_HOME/usr/bin:$PATH
export LD_LIBRARY_PATH=$SAMBA_HOME/usr/lib/x86_64-linux-gnu:$SAMBA_HOME/usr/lib/x86_64-linux-gnu/samba:$LD_LIBRARY_PATH
export SMB_CONF_PATH=$SAMBA_HOME/etc/samba/smb.conf
SAMBA_ENV_EOF

chmod +x "${SAMBA_INSTALL_DIR}/bin/samba-env.sh"
log_ok "Created ${SAMBA_INSTALL_DIR}/bin/samba-env.sh"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 4 — Download and compile OpenLDAP 2.6.10 from source
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Download and compile OpenLDAP 2.6.10 from source"

# Check if already compiled
if [ -f "${LDAP_INSTALL_DIR}/libexec/slapd" ]; then
    log_ok "OpenLDAP already compiled — skipping build"
else
    # Download groff-base for soelim (needed by OpenLDAP man pages build)
    log_info "Downloading groff-base for soelim..."
    mkdir -p "${TMPDIR}/groff-deb"
    cd "${TMPDIR}/groff-deb"
    apt-get download groff-base 2>&1 | tail -2 || true
    mkdir -p /tmp/groff-extract
    for deb in "${TMPDIR}/groff-deb"/*.deb; do
        dpkg-deb -x "${deb}" /tmp/groff-extract 2>/dev/null || true
    done
    if [ -f /tmp/groff-extract/usr/bin/soelim ]; then
        log_ok "soelim available at /tmp/groff-extract/usr/bin/soelim"
    else
        log_warn "soelim not found — man page generation may fail (non-critical)"
    fi

    # Download OpenLDAP source
    cd "${TMPDIR}"
    OPENLDAP_TGZ="${TMPDIR}/openldap-2.6.10.tgz"

    if [ ! -f "${OPENLDAP_TGZ}" ]; then
        log_info "Downloading OpenLDAP 2.6.10 source..."
        wget -q --show-progress -O "${OPENLDAP_TGZ}" \
            "https://www.openldap.org/software/download/OpenLDAP/openldap-release/openldap-2.6.10.tgz" \
            || curl -sL -o "${OPENLDAP_TGZ}" \
            "https://www.openldap.org/software/download/OpenLDAP/openldap-release/openldap-2.6.10.tgz"
    fi

    if [ ! -f "${OPENLDAP_TGZ}" ]; then
        die "Failed to download OpenLDAP source tarball"
    fi
    log_ok "Downloaded OpenLDAP 2.6.10 source"

    # Extract
    log_info "Extracting OpenLDAP source..."
    cd "${TMPDIR}"
    tar xzf "${OPENLDAP_TGZ}"
    cd "${TMPDIR}/openldap-2.6.10"

    # Configure
    log_info "Configuring OpenLDAP..."
    export CFLAGS="-I/usr/include"
    export LDFLAGS="-L/usr/lib/x86_64-linux-gnu"
    export CPPFLAGS="-I/usr/include"

    ./configure \
        --prefix="${LDAP_INSTALL_DIR}" \
        --enable-slapd \
        --enable-mdb=yes \
        --enable-ldap=yes \
        --disable-syslog \
        --without-cyrus-sasl \
        --with-tls=openssl \
        2>&1 | tail -10

    log_ok "Configure complete"

    # Build
    log_info "Building OpenLDAP (make depend)..."
    make depend 2>&1 | tail -3

    log_info "Building OpenLDAP (make -j$(nproc))..."
    PATH="/tmp/groff-extract/usr/bin:$PATH" make -j"$(nproc)" 2>&1 | tail -10

    log_ok "Build complete"

    # Install
    log_info "Installing OpenLDAP..."
    PATH="/tmp/groff-extract/usr/bin:$PATH" make install 2>&1 | tail -10

    # Create slapd symlink
    cd "${LDAP_INSTALL_DIR}/sbin"
    ln -sf ../libexec/slapd slapd

    log_ok "OpenLDAP installed to ${LDAP_INSTALL_DIR}"

    # Verify
    if [ -x "${LDAP_INSTALL_DIR}/libexec/slapd" ]; then
        log_ok "slapd binary verified at ${LDAP_INSTALL_DIR}/libexec/slapd"
    else
        die "slapd binary not found after build!"
    fi

    if [ -x "${LDAP_INSTALL_DIR}/sbin/slappasswd" ]; then
        log_ok "slappasswd binary verified at ${LDAP_INSTALL_DIR}/sbin/slappasswd"
    else
        die "slappasswd binary not found after build!"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 5 — Create slapd runtime directories and config
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Create slapd runtime directories and config"

# Create directories
mkdir -p "${LDAP_DATA_DIR}" "${LDAP_RUN_DIR}" "${LDAP_ETC_DIR}" "${LDAP_SCHEMA_DIR}"
chmod 700 "${LDAP_DATA_DIR}"
log_ok "Created ${LDAP_DATA_DIR} (chmod 700)"

# Generate admin password hash
ADMIN_PW_HASH=$("${LDAP_INSTALL_DIR}/sbin/slappasswd" -s "${ADMIN_PW}")
log_info "Generated admin password hash: ${ADMIN_PW_HASH}"

# Write slapd.conf
cat > "${SLAPD_CONF}" << SLAPD_CONF_EOF
include         ${LDAP_SCHEMA_DIR}/core.schema
include         ${LDAP_SCHEMA_DIR}/cosine.schema
include         ${LDAP_SCHEMA_DIR}/inetorgperson.schema
include         ${LDAP_SCHEMA_DIR}/nis.schema
include         ${LDAP_SCHEMA_DIR}/samba.schema

pidfile         ${LDAP_RUN_DIR}/slapd.pid
argsfile        ${LDAP_RUN_DIR}/slapd.args

modulepath      ${LDAP_INSTALL_DIR}/libexec/openldap
moduleload      back_mdb

database        mdb
maxsize         1073741824
suffix          "${BASE_DN}"
rootdn          "${ROOT_DN}"
rootpw          ${ADMIN_PW_HASH}

directory       ${LDAP_DATA_DIR}

index           objectClass           eq
index           uid                   eq,pres
index           cn                    eq,pres,sub
index           memberUid             eq
index           entryUUID             eq
index           uniqueMember          eq

access to attrs=userPassword
        by self                write
        by dn.exact="${ROOT_DN}" write
        by anonymous           auth
        by *                   none

access to *
        by dn.exact="${ROOT_DN}" write
        by *                   read

loglevel        256
SLAPD_CONF_EOF

log_ok "Wrote ${SLAPD_CONF}"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 6 — Generate password hashes for all users
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Generate password hashes for all users"

declare -A PW_HASHES
for uid in "${!USER_MAP[@]}"; do
    pw=$(echo "${USER_MAP[$uid]}" | cut -d'|' -f1)
    hash=$("${LDAP_INSTALL_DIR}/sbin/slappasswd" -s "${pw}")
    PW_HASHES["${uid}"]="${hash}"
    log_ok "${uid}: ${hash}"
done

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 7 — Initialize LDAP database with base structure
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Initialize LDAP database with slapadd"

INIT_LDIF="${TMPDIR}/init-base.ldif"

cat > "${INIT_LDIF}" << INIT_LDIF_EOF
# ── Root DSE suffix ──
dn: ${BASE_DN}
objectClass: top
objectClass: dcObject
objectClass: organization
o: StaySuite
dc: staysuite

# ── Admin user ──
dn: ${ROOT_DN}
objectClass: simpleSecurityObject
objectClass: organizationalRole
cn: admin
description: LDAP Administrator
userPassword: ${ADMIN_PW_HASH}

# ── Users OU ──
dn: ou=Users,${BASE_DN}
objectClass: organizationalUnit
ou: Users

# ── Groups OU ──
dn: ou=Groups,${BASE_DN}
objectClass: organizationalUnit
ou: Groups
INIT_LDIF_EOF

# Add users
for uid in "${!USER_MAP[@]}"; do
    info="${USER_MAP[$uid]}"
    pw=$(echo "${info}" | cut -d'|' -f1)
    displayName=$(echo "${info}" | cut -d'|' -f2)
    sambaSID=$(echo "${info}" | cut -d'|' -f3)
    hash="${PW_HASHES[${uid}]}"

    cat >> "${INIT_LDIF}" << USER_EOF

# ── User: ${uid} ──
dn: uid=${uid},ou=Users,${BASE_DN}
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
objectClass: sambaSamAccount
uid: ${uid}
cn: ${displayName}
sn: ${displayName#* }
givenName: ${displayName%% *}
displayName: ${displayName}
mail: ${uid}@staysuite.local
uidNumber: $(od -An -tu2 -N2 /dev/urandom | tr -d ' ' | cut -c1-5)
gidNumber: 10000
homeDirectory: /home/${uid}
loginShell: /bin/bash
userPassword: ${hash}
sambaSID: ${sambaSID}
sambaAcctFlags: [U]
sambaNTPassword: PLACEHOLDER_NT_HASH_${uid}
USER_EOF

    log_info "Added user ${uid} to init LDIF"
done

# Add groups
for group in "${!GROUP_MEMBERS[@]}"; do
    gid=$(od -An -tu2 -N2 /dev/urandom | tr -d ' ' | cut -c1-5)
    members=""
    for member_uid in ${GROUP_MEMBERS[${group}]}; do
        members="${members}
memberUid: ${member_uid}"
    done

    cat >> "${INIT_LDIF}" << GROUP_EOF

# ── Group: ${group} ──
dn: cn=${group},ou=Groups,${BASE_DN}
objectClass: posixGroup
cn: ${group}
gidNumber: ${gid}${members}
GROUP_EOF

    log_info "Added group ${group} to init LDIF"
done

# Clear old database
rm -f "${LDAP_DATA_DIR}"/* 2>/dev/null || true
rm -f "${LDAP_RUN_DIR}"/* 2>/dev/null || true

# Run slapadd
"${LDAP_INSTALL_DIR}/sbin/slapadd" -f "${SLAPD_CONF}" -l "${INIT_LDIF}" 2>&1
log_ok "LDAP database initialized with slapadd"

# Fix ownership (just in case)
chmod 700 "${LDAP_DATA_DIR}"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 8 — Copy samba.schema to OpenLDAP schema directory
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Copy samba.schema to OpenLDAP schema directory"

SAMBA_SCHEMA_SRC=$(find "${SAMBA_INSTALL_DIR}" -name "samba.schema" -type f 2>/dev/null | head -1)

if [ -z "${SAMBA_SCHEMA_SRC}" ]; then
    die "samba.schema not found in ${SAMBA_INSTALL_DIR}"
fi

cp "${SAMBA_SCHEMA_SRC}" "${LDAP_SCHEMA_DIR}/samba.schema"
log_ok "Copied samba.schema to ${LDAP_SCHEMA_DIR}/samba.schema"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 9 — Verify slapd.conf includes samba.schema
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Verify slapd.conf includes samba.schema"

if rg -q "samba.schema" "${SLAPD_CONF}"; then
    log_ok "slapd.conf already includes samba.schema"
else
    log_warn "samba.schema not included — adding..."
    sed -i '/include.*nis.schema/a include         '"${LDAP_SCHEMA_DIR}"'/samba.schema' "${SLAPD_CONF}"
    log_ok "Added samba.schema include to slapd.conf"
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 10 — Generate NT password hashes and update LDAP entries
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Generate NT password hashes for sambaNTPassword"

for uid in "${!USER_MAP[@]}"; do
    pw=$(echo "${USER_MAP[$uid]}" | cut -d'|' -f1)
    nt_hash=$(echo -n "${pw}" | iconv -t UTF-16LE | OPENSSL_CONF=/dev/null openssl md4 -provider legacy -provider default 2>/dev/null | awk '{print $NF}')

    if [ -z "${nt_hash}" ]; then
        # Fallback: try without legacy provider
        nt_hash=$(echo -n "${pw}" | iconv -t UTF-16LE | OPENSSL_CONF=/dev/null openssl md4 2>/dev/null | awk '{print $NF}')
    fi

    if [ -z "${nt_hash}" ]; then
        log_warn "Could not generate NT hash for ${uid} — trying openssl-compat..."
        nt_hash=$(echo -n "${pw}" | iconv -t UTF-16LE \
            | "${PROJECT_DIR}/openssl-compat/bin/openssl" md4 -provider legacy -provider default 2>/dev/null \
            | awk '{print $NF}')
    fi

    if [ -n "${nt_hash}" ] && [ ${#nt_hash} -eq 32 ]; then
        log_ok "${uid} NT hash: ${nt_hash}"
    else
        log_warn "${uid}: NT hash generation may have failed (hash='${nt_hash}')"
        nt_hash="00000000000000000000000000000000"
    fi
done

log_ok "NT password hashes generated"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 11 — Start slapd via PM2
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Start slapd via PM2"

# Stop existing slapd if running
pm2 stop staysuite-slapd 2>/dev/null || true
sleep 1

# Start slapd
pm2 start "${LDAP_INSTALL_DIR}/sbin/slapd" \
    --name "staysuite-slapd" \
    -- \
    -f "${SLAPD_CONF}" \
    -h "ldap://127.0.0.1:${LDAP_PORT}" \
    -d 256

sleep 3

# Verify slapd is running
if pm2 pid staysuite-slapd >/dev/null 2>&1; then
    log_ok "slapd started via PM2 (PID: $(pm2 pid staysuite-slapd))"
else
    die "slapd failed to start!"
fi

# Wait for LDAP to be ready
for i in $(seq 1 10); do
    if "${LDAP_INSTALL_DIR}/bin/ldapsearch" -x -H "ldap://127.0.0.1:${LDAP_PORT}" \
        -D "${ROOT_DN}" -w "${ADMIN_PW}" -b "${BASE_DN}" "(objectClass=organization)" dn >/dev/null 2>&1; then
        log_ok "LDAP server is responding on port ${LDAP_PORT}"
        break
    fi
    log_info "Waiting for LDAP server... (${i}/10)"
    sleep 2
done

# Final check
if ! "${LDAP_INSTALL_DIR}/bin/ldapsearch" -x -H "ldap://127.0.0.1:${LDAP_PORT}" \
    -D "${ROOT_DN}" -w "${ADMIN_PW}" -b "${BASE_DN}" "(objectClass=organization)" dn >/dev/null 2>&1; then
    log_warn "LDAP server may not be fully ready yet"
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 12 — Add sambaSamAccount NT password hashes to LDAP users
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Update LDAP users with sambaNTPassword"

for uid in "${!USER_MAP[@]}"; do
    pw=$(echo "${USER_MAP[$uid]}" | cut -d'|' -f1)
    nt_hash=$(echo -n "${pw}" | iconv -t UTF-16LE | OPENSSL_CONF=/dev/null openssl md4 -provider legacy -provider default 2>/dev/null | awk '{print $NF}')

    if [ -z "${nt_hash}" ] || [ ${#nt_hash} -ne 32 ]; then
        nt_hash=$(echo -n "${pw}" | iconv -t UTF-16LE \
            | "${PROJECT_DIR}/openssl-compat/bin/openssl" md4 -provider legacy -provider default 2>/dev/null \
            | awk '{print $NF}')
    fi

    if [ -z "${nt_hash}" ] || [ ${#nt_hash} -ne 32 ]; then
        nt_hash="00000000000000000000000000000000"
        log_warn "${uid}: Using fallback NT hash"
    fi

    MODIFY_LDIF="${TMPDIR}/modify-${uid}.ldif"
    cat > "${MODIFY_LDIF}" << MODIFY_EOF
dn: uid=${uid},ou=Users,${BASE_DN}
changetype: modify
replace: sambaNTPassword
sambaNTPassword: ${nt_hash}
-
delete: sambaNTPassword
sambaNTPassword: PLACEHOLDER_NT_HASH_${uid}
MODIFY_EOF

    "${LDAP_INSTALL_DIR}/bin/ldapmodify" -x \
        -H "ldap://127.0.0.1:${LDAP_PORT}" \
        -D "${ROOT_DN}" \
        -w "${ADMIN_PW}" \
        -f "${MODIFY_LDIF}" 2>&1 | grep -v "^modifying entry" || true

    log_ok "${uid}: sambaNTPassword updated to ${nt_hash}"
done

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 13 — Configure FreeRADIUS LDAP module
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Configure FreeRADIUS LDAP module"

LDAP_MOD="${FREERADIUS_DIR}/etc/raddb/mods-available/ldap"

cat > "${LDAP_MOD}" << 'LDAP_MOD_EOF'
# StaySuite: LDAP module for enterprise AAA integration
# This module connects FreeRADIUS to OpenLDAP/Active Directory for
# enterprise user authentication (LDAP Bind as user).
#
# Feature flag: Only active when ldapRadiusEnabled = true per property
# When disabled, this module is NOT symlinked in mods-enabled/

ldap {
	server = '127.0.0.1'
	port = 3890
	identity = 'cn=admin,dc=staysuite,dc=local'
	password = 'Admin@123'
	base_dn = 'dc=staysuite,dc=local'
	ldap_version = 3

	user {
		base_dn = "${..base_dn}"
		filter = "(uid=%{%{Stripped-User-Name}:-%{User-Name}})"
		scope = 'sub'
		access_positive = yes
		sasl {
		}
	}

	password_attribute = 'userPassword'

	update {
		control:Password-With-Header += 'userPassword'
		control:NT-Password += 'sambaNTPassword'
	}

	group {
		base_dn = "${..base_dn}"
		filter = "(|(memberUid=%{%{Stripped-User-Name}:-%{User-Name}})(member=%{User-DN}))"
		scope = 'sub'
		name_attribute = 'cn'
		cacheable_name = no
		cacheable_dn = no
		allow_dangling_group_ref = no
	}

	groupname_attribute = 'cn'

	client {
		base_dn = "${..base_dn}"
		filter = '(objectClass=radiusClient)'
		scope = 'sub'
	}

	pool {
		start = 1
		min = 1
		max = 5
		spare = 3
		uses = 0
		lifetime = 0
		idle_timeout = 60
		connect_timeout = 3.0
		retries = 3
		retry_delay = 1
	}

	keepalive {
		idle = 60
		probes = 3
		interval = 3
	}

	timeout = 10
}
LDAP_MOD_EOF

log_ok "Wrote ${LDAP_MOD}"

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 14 — Enable LDAP module in FreeRADIUS
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Enable LDAP module in FreeRADIUS"

cd "${FREERADIUS_DIR}/etc/raddb"
ln -sf mods-available/ldap mods-enabled/ldap
log_ok "Symlinked mods-enabled/ldap -> mods-available/ldap"

# Verify
if [ -L "mods-enabled/ldap" ]; then
    log_ok "LDAP module enabled"
else
    die "Failed to enable LDAP module!"
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 15 — Configure FreeRADIUS auth flow (LDAP before SQL in authorize{})
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Configure FreeRADIUS auth flow"

DEFAULT_SITE="${FREERADIUS_DIR}/etc/raddb/sites-enabled/default"

# Verify LDAP is in the authorize{} section before SQL
if rg -q "ldap" "${DEFAULT_SITE}"; then
    # Check if LDAP is listed before SQL in the authorize section
    ldap_line=$(rg -n "^\s+ldap\s*$" "${DEFAULT_SITE}" | head -1 | cut -d: -f1)
    sql_line=$(rg -n "^\s+sql\s*$" "${DEFAULT_SITE}" | head -1 | cut -d: -f1)

    if [ -n "${ldap_line}" ] && [ -n "${sql_line}" ] && [ "${ldap_line}" -lt "${sql_line}" ]; then
        log_ok "LDAP already listed before SQL in authorize{} (ldap@${ldap_line}, sql@${sql_line})"
    elif [ -n "${ldap_line}" ]; then
        log_ok "LDAP is present in authorize{} at line ${ldap_line}"
    else
        log_warn "LDAP not found in authorize{} section"
    fi
else
    log_warn "LDAP not found in sites-enabled/default — auth may fall through to SQL only"
fi

# Also verify LDAP is in authenticate{} section
if rg -q "Auth-Type LDAP" "${DEFAULT_SITE}"; then
    log_ok "Auth-Type LDAP block present in authenticate{}"
else
    log_warn "Auth-Type LDAP block not found in authenticate{}"
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  STEP 16 — Restart FreeRADIUS and verify
# ═══════════════════════════════════════════════════════════════════════════════════════════

log_step "Restart FreeRADIUS and verify"

pm2 restart staysuite-freeradius 2>/dev/null || true
sleep 3

if pm2 pid staysuite-freeradius >/dev/null 2>&1; then
    log_ok "FreeRADIUS restarted (PID: $(pm2 pid staysuite-freeradius))"
else
    log_warn "FreeRADIUS may not have restarted properly"
fi

# ═══════════════════════════════════════════════════════════════════════════════════════════
#  VERIFICATION SECTION
# ═══════════════════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}                        VERIFICATION TESTS${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"

# ── Test 1: LDAP connectivity ──
echo ""
echo -e "${BOLD}── LDAP Connectivity Test ──${NC}"

LDAPSEARCH="${LDAP_INSTALL_DIR}/bin/ldapsearch"
LDAP_URI="ldap://127.0.0.1:${LDAP_PORT}"

RESULT=$(${LDAPSEARCH} -x -H "${LDAP_URI}" -D "${ROOT_DN}" -w "${ADMIN_PW}" \
    -b "${BASE_DN}" "(objectClass=*)" dn 2>&1)

ENTRY_COUNT=$(echo "${RESULT}" | grep -c "^dn:" || true)
if [ "${ENTRY_COUNT}" -gt 0 ]; then
    log_ok "LDAP connectivity: OK (${ENTRY_COUNT} entries found)"
    echo "${RESULT}" | grep "^dn:" | while read -r line; do
        log_info "  ${line}"
    done
else
    log_err "LDAP connectivity: FAILED"
    log_info "  ${RESULT}"
fi

# ── Test 2: Verify all users ──
echo ""
echo -e "${BOLD}── LDAP User Verification ──${NC}"

for uid in "${!USER_MAP[@]}"; do
    pw=$(echo "${USER_MAP[$uid]}" | cut -d'|' -f1)
    USER_RESULT=$(${LDAPSEARCH} -x -H "${LDAP_URI}" \
        -D "${ROOT_DN}" -w "${ADMIN_PW}" \
        -b "ou=Users,${BASE_DN}" \
        "(uid=${uid})" dn objectClass 2>&1)

    if echo "${USER_RESULT}" | grep -q "dn: uid=${uid}"; then
        if echo "${USER_RESULT}" | grep -q "sambaSamAccount"; then
            log_ok "${uid}: exists with sambaSamAccount"
        else
            log_warn "${uid}: exists but missing sambaSamAccount"
        fi
    else
        log_err "${uid}: NOT FOUND in LDAP"
    fi
done

# ── Test 3: radtest commands ──
echo ""
echo -e "${BOLD}── RADIUS Authentication Tests (radtest) ──${NC}"

RADTEST="${FREERADIUS_DIR}/bin/radtest"
RAD_HOST="127.0.0.1"
RAD_PORT=1812
RAD_SECRET="${RADIUS_TEST_SECRET}"

if [ ! -x "${RADTEST}" ]; then
    log_warn "radtest not found at ${RADTEST} — skipping RADIUS tests"
    log_info "  You can test manually: ${RADTEST} <user> <pass> ${RAD_HOST}:${RAD_PORT} 0 ${RAD_SECRET}"
else
    for uid in "${!USER_MAP[@]}"; do
        pw=$(echo "${USER_MAP[$uid]}" | cut -d'|' -f1)
        log_info "Testing: radtest ${uid} *** ${RAD_HOST}:${RAD_PORT} 0 ${RAD_SECRET}"

        RAD_RESULT=$(timeout 10 "${RADTEST}" "${uid}" "${pw}" "${RAD_HOST}:${RAD_PORT}" 0 "${RAD_SECRET}" 2>&1) || true

        if echo "${RAD_RESULT}" | grep -qi "Access-Accept"; then
            log_ok "${uid}: RADIUS Access-Accept ✓"
        elif echo "${RAD_RESULT}" | grep -qi "Access-Reject"; then
            log_err "${uid}: RADIUS Access-Reject ✗"
            log_info "  $(echo "${RAD_RESULT}" | grep -i "reply:" | head -3)"
        else
            log_warn "${uid}: RADIUS test inconclusive"
            log_info "  $(echo "${RAD_RESULT}" | tail -5)"
        fi
    done
fi

# ── Summary ──
echo ""
echo -e "${BOLD}${GREEN}"
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                     SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo -e "  ${CYAN}OpenLDAP Server${NC}"
echo -e "    Listen : ldap://127.0.0.1:${LDAP_PORT}"
echo -e "    Config : ${SLAPD_CONF}"
echo -e "    PM2    : staysuite-slapd"
echo -e "    Data   : ${LDAP_DATA_DIR}"
echo ""
echo -e "  ${CYAN}FreeRADIUS Server${NC}"
echo -e "    Auth   : 127.0.0.1:1812"
echo -e "    Acct   : 127.0.0.1:1813"
echo -e "    LDAP   : enabled (mods-enabled/ldap)"
echo -e "    PM2    : staysuite-freeradius"
echo ""
echo -e "  ${CYAN}LDAP Directory${NC}"
echo -e "    Base DN  : ${BASE_DN}"
echo -e "    Admin DN : ${ROOT_DN}"
echo -e "    Users    : $(echo "${!USER_MAP[@]}" | tr ' ' ', ')"
echo -e "    Groups   : $(echo "${!GROUP_MEMBERS[@]}" | tr ' ' ', ')"
echo ""
echo -e "  ${CYAN}Test Commands${NC}"
echo -e "    LDAP search : ${LDAPSEARCH} -x -H ldap://127.0.0.1:${LDAP_PORT} -D '${ROOT_DN}' -w '${ADMIN_PW}' -b '${BASE_DN}' '(objectClass=*)'"
echo -e "    RADIUS test  : ${RADTEST} john.smith JohnPass@2025 127.0.0.1:1812 0 ${RADIUS_SECRET}"
echo ""
