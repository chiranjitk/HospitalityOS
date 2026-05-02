#!/bin/bash
###########################################################################
#       Script : StaySuite Recovery — Restore TC + nft after reboot
#       OS     : Rocky Linux 10 (nftables v1.1.1 + tc HTB)
#
#  PROBLEM:
#    When the server reboots, ALL tc/qdisc/filter state is lost.
#    However, user sessions remain in the database (WiFiSession, WiFiUser).
#    nftables state is also lost but can be restored from backup files.
#
#  SOLUTION:
#    This script restores the complete network state from persistent
#    session files saved by staysuite_login.sh.
#
#    Session state files are stored in /var/lib/staysuite/sessions/
#    (persistent across reboots, written by login script).
#
#    nft set backups are in /var/lib/staysuite/nft_*.set
#
#  USAGE:
#    staysuite_recovery.sh              # Full recovery (nft + TC)
#    staysuite_recovery.sh --nft-only   # Only restore nft sets
#    staysuite_recovery.sh --tc-only    # Only restore TC classes
#    staysuite_recovery.sh --dry-run    # Show what would be restored
#    staysuite_recovery.sh --status     # Show current state
#
#  CRON:
#    # Also run periodically to catch drift (every 5 min)
#    */5 * * * * /usr/local/scripts/staysuite_core/staysuite_recovery.sh
#
#  SYSTEMD:
#    # Run after network-online
#    ExecStartPost=/usr/local/scripts/staysuite_core/staysuite_recovery.sh
###########################################################################

set -uo pipefail

LOGFILE="${LOGFILE:-/var/log/staysuite_recovery.log}"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [RECOVERY] $*" >> "$LOGFILE" 2>/dev/null; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [RECOVERY][ERR] $*" >> "$LOGFILE" 2>/dev/null; }

PERSIST_STATEDIR="/var/lib/staysuite/sessions"
NFT_BACKUP_DIR="/var/lib/staysuite"
LOGIN_SCRIPT="/usr/local/scripts/staysuite_core/staysuite_login.sh"
LOGOUT_SCRIPT="/usr/local/scripts/staysuite_core/staysuite_logout.sh"
POOL_SCRIPT="/usr/local/scripts/staysuite_core/staysuite_pool.sh"
DEFAULTCHAINS="/usr/local/scripts/staysuite_core/defaultchains_cryptsk.sh"
INIT_SCRIPT="/usr/local/scripts/staysuite_core/bwscripts/initialization.sh"

DRY_RUN=0
NFT_ONLY=0
TC_ONLY=0
SHOW_STATUS=0

# ─── Parse arguments ──────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)   DRY_RUN=1 ;;
        --nft-only)  NFT_ONLY=1 ;;
        --tc-only)   TC_ONLY=1 ;;
        --status)    SHOW_STATUS=1 ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--nft-only] [--tc-only] [--status]"
            exit 0
            ;;
    esac
    shift
done

# ─── Status check ────────────────────────────────────────────────────
if [[ "$SHOW_STATUS" -eq 1 ]]; then
    echo "=== nft sets ==="
    nft list sets 2>/dev/null | grep -E 'set inet (mangle|nat|filter)' || echo "(no sets found)"
    echo ""
    echo "=== loggedinusers ==="
    nft list elements inet mangle loggedinusers 2>/dev/null || echo "(empty)"
    echo ""
    echo "=== ifb devices ==="
    ip link show ifb0 2>/dev/null | head -1 || echo "ifb0: NOT FOUND"
    ip link show ifb1 2>/dev/null | head -1 || echo "ifb1: NOT FOUND"
    echo ""
    echo "=== TC root qdisc ==="
    tc qdisc show dev ifb0 2>/dev/null | head -1 || echo "ifb0: no qdisc"
    tc qdisc show dev ifb1 2>/dev/null | head -1 || echo "ifb1: no qdisc"
    echo ""
    echo "=== TC pool classes ==="
    tc class show dev ifb0 2>/dev/null | grep "parent 1:1" || echo "(no pool classes)"
    echo ""
    echo "=== TC user classes ==="
    tc class show dev ifb0 2>/dev/null | grep -v "parent 1:1" | grep -v "class htb 1:1 " || echo "(no user classes)"
    echo ""
    echo "=== fw filters ==="
    tc filter show dev ifb0 2>/dev/null | grep "fw handle" | wc -l | xargs echo "ifb0 fw filters:"
    tc filter show dev ifb1 2>/dev/null | grep "fw handle" | wc -l | xargs echo "ifb1 fw filters:"
    echo ""
    echo "=== Session state files ==="
    ls -la "$PERSIST_STATEDIR/"*.state 2>/dev/null | wc -l | xargs echo "State files in $PERSIST_STATEDIR:"
    exit 0
fi

log_msg "=== Recovery started (dry_run=$DRY_RUN nft_only=$NFT_ONLY tc_only=$TC_ONLY) ==="

RECOVERED_NFT=0
RECOVERED_TC=0
FAILED=0

# ═══════════════════════════════════════════════════════════════════
#  PHASE 1: Restore nftables state
# ═══════════════════════════════════════════════════════════════════

if [[ "$TC_ONLY" -ne 1 ]]; then
    log_msg "Phase 1: Restoring nftables..."

    # Check if base chains exist (defaultchains_cryptsk.sh should have run)
    if ! nft list table inet mangle >/dev/null 2>&1; then
        log_err "Base nftables not loaded! Run defaultchains_cryptsk.sh first."
        if [[ -x "$DEFAULTCHAINS" ]]; then
            log_msg "Running $DEFAULTCHAINS..."
            $DEFAULTCHAINS 2>&1 | tail -5 >> "$LOGFILE"
        fi
    fi

    # Restore loggedinusers set from backup
    if [[ -f "${NFT_BACKUP_DIR}/nft_loggedinusers.set" ]]; then
        # Read IPs from backup file and add them to the set
        while IFS= read -r ip; do
            [[ -z "$ip" ]] && continue
            # Parse IP from nft set element format: "192.168.1.100" or just the IP
            clean_ip=$(echo "$ip" | grep -oP '\d+\.\d+\.\d+\.\d+' | head -1)
            [[ -z "$clean_ip" ]] && continue

            if [[ "$DRY_RUN" -eq 1 ]]; then
                log_msg "DRY: nft add element loggedinusers { $clean_ip }"
            else
                if nft get element inet mangle loggedinusers "{ ${clean_ip} }" >/dev/null 2>&1; then
                    : # already exists
                else
                    nft add element inet mangle loggedinusers "{ ${clean_ip }" 2>/dev/null \
                        && ((RECOVERED_NFT++))
                fi
            fi
        done < "${NFT_BACKUP_DIR}/nft_loggedinusers.set"
        log_msg "Restored $RECOVERED_NFT IPs to loggedinusers set"
    fi

    # Restore loggedinuserssnatip set
    if [[ -f "${NFT_BACKUP_DIR}/nft_loggedinuserssnatip.set" ]]; then
        while IFS= read -r ip; do
            clean_ip=$(echo "$ip" | grep -oP '\d+\.\d+\.\d+\.\d+' | head -1)
            [[ -z "$clean_ip" ]] && continue
            if [[ "$DRY_RUN" -eq 0 ]]; then
                nft add element inet mangle loggedinuserssnatip "{ ${clean_ip }" 2>/dev/null || true
            fi
        done < "${NFT_BACKUP_DIR}/nft_loggedinuserssnatip.set"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
#  PHASE 2: Restore TC state from session files
# ═══════════════════════════════════════════════════════════════════

if [[ "$NFT_ONLY" -ne 1 ]]; then
    log_msg "Phase 2: Restoring TC state..."

    # Check if IFB devices exist
    if ! ip link show ifb0 >/dev/null 2>&1; then
        log_err "ifb0 not found! Running initialization.sh..."
        if [[ -x "$INIT_SCRIPT" ]]; then
            $INIT_SCRIPT 2>&1 >> "$LOGFILE"
        fi
    fi

    # Check if root qdisc exists
    if ! tc qdisc show dev ifb0 2>/dev/null | grep -q "htb"; then
        log_err "Root HTB qdisc not found on ifb0! Running initialization.sh..."
        if [[ -x "$INIT_SCRIPT" ]]; then
            $INIT_SCRIPT 2>&1 >> "$LOGFILE"
        fi
    fi

    # Process each session state file
    if [[ -d "$PERSIST_STATEDIR" ]]; then
        for state_file in "${PERSIST_STATEDIR}"/*.state; do
            [[ -f "$state_file" ]] || continue

            # Parse state file
            S_IP="" S_MARK="" S_POOL_ID=0 S_DN_CLASSID=0 S_UP_CLASSID=0
            S_DN_KBPS=0 S_UP_KBPS=0 S_DN_GUAR=0 S_UP_GUAR=0
            S_POOL_RATE_DN=0 S_POOL_CEIL_DN=0 S_POOL_RATE_UP=0 S_POOL_CEIL_UP=0
            S_FW_PREF=100

            while IFS='=' read -r key val; do
                case "$key" in
                    IP)           S_IP="$val" ;;
                    MARK)         S_MARK="$val" ;;
                    POOL_ID)      S_POOL_ID="$val" ;;
                    DN_CLASSID)   S_DN_CLASSID="$val" ;;
                    UP_CLASSID)   S_UP_CLASSID="$val" ;;
                    DN_KBPS)      S_DN_KBPS="$val" ;;
                    UP_KBPS)      S_UP_KBPS="$val" ;;
                    DN_GUAR)      S_DN_GUAR="$val" ;;
                    UP_GUAR)      S_UP_GUAR="$val" ;;
                    POOL_RATE_DN) S_POOL_RATE_DN="$val" ;;
                    POOL_CEIL_DN) S_POOL_CEIL_DN="$val" ;;
                    POOL_RATE_UP) S_POOL_RATE_UP="$val" ;;
                    POOL_CEIL_UP) S_POOL_CEIL_UP="$val" ;;
                    FW_PREF)      S_FW_PREF="$val" ;;
                esac
            done < "$state_file"

            [[ -z "$S_IP" ]] && continue
            [[ -z "$S_MARK" ]] && continue

            # Check if IP is still in loggedinusers set (nft restoration might have failed)
            if ! nft get element inet mangle loggedinusers "{ ${S_IP} }" >/dev/null 2>&1; then
                log_msg "SKIP: $S_IP not in loggedinusers (session expired or removed)"
                continue
            fi

            # Skip if TC filter already exists (avoid duplicate on periodic cron)
            if tc filter show dev ifb0 parent 1: 2>/dev/null | grep -q "handle ${S_MARK}"; then
                continue
            fi

            log_msg "Restoring TC for $S_IP (mark=$S_MARK pool=$S_POOL_ID dn_cls=$S_DN_CLASSID up_cls=$S_UP_CLASSID)"

            if [[ "$DRY_RUN" -eq 1 ]]; then
                ((RECOVERED_TC++))
                continue
            fi

            # 1. Re-create pool root class if needed
            if [[ "$S_POOL_ID" -gt 0 && "$S_POOL_RATE_DN" -gt 0 ]]; then
                for dev in ifb0 ifb1; do
                    [[ "$dev" == "ifb0" ]] && { prate="$S_POOL_RATE_DN"; pceil="$S_POOL_CEIL_DN"; }
                    [[ "$dev" == "ifb1" ]] && { prate="$S_POOL_RATE_UP"; pceil="$S_POOL_CEIL_UP"; }
                    [[ "$prate" -le 0 ]] && continue

                    if ! tc class show dev "$dev" classid "1:${S_POOL_ID}" >/dev/null 2>&1; then
                        tc class add dev "$dev" parent 1:1 classid "1:${S_POOL_ID}" htb \
                            rate "${prate}kbit" ceil "${pceil}kbit" quantum 1500 2>/dev/null \
                            && log_msg "  pool 1:${S_POOL_ID} created on $dev"
                    fi
                done
            fi

            # 2. Re-insert nft mark rules in prerouting
            TAG="ss_${S_IP//./_}"
            nft insert rule inet mangle prerouting position 5 \
                ip saddr "${S_IP}" meta mark set "${S_MARK}" \
                comment "\"${TAG}_mark\"" 2>/dev/null || true
            nft insert rule inet mangle prerouting position 5 \
                ip daddr "${S_IP}" meta mark set "${S_MARK}" \
                comment "\"${TAG}_mark_dn\"" 2>/dev/null || true

            # 3. Re-create user download class + fw filter on ifb0
            if [[ "$S_DN_KBPS" -gt 0 && "$S_DN_CLASSID" -gt 0 ]]; then
                dn_rate="${S_DN_KBPS}kbit"
                dn_ceil="${S_DN_KBPS}kbit"
                dn_guar="${S_DN_KBPS}kbit"
                [[ "$S_DN_GUAR" -gt 0 ]] && { dn_guar="${S_DN_GUAR}kbit"; dn_ceil="${S_DN_GUAR}kbit"; }

                local_parent="1:${S_POOL_ID}"
                [[ "$S_POOL_ID" -le 0 || "$S_POOL_RATE_DN" -le 0 ]] && local_parent="1:1"

                tc class add dev ifb0 parent "$local_parent" classid "1:${S_DN_CLASSID}" htb \
                    rate "$dn_guar" ceil "$dn_ceil" quantum 1500 2>/dev/null && \
                    log_msg "  dl class 1:${S_DN_CLASSID} under $local_parent"

                tc filter add dev ifb0 parent 1: protocol ip pref "$S_FW_PREF" fw \
                    handle "${S_MARK}" classid "1:${S_DN_CLASSID}" 2>/dev/null && \
                    log_msg "  fw ifb0 $MARK → 1:${S_DN_CLASSID}"
            fi

            # 4. Re-create user upload class + fw filter on ifb1
            if [[ "$S_UP_KBPS" -gt 0 && "$S_UP_CLASSID" -gt 0 ]]; then
                up_rate="${S_UP_KBPS}kbit"
                up_ceil="${S_UP_KBPS}kbit"
                up_guar="${S_UP_KBPS}kbit"
                [[ "$S_UP_GUAR" -gt 0 ]] && { up_guar="${S_UP_GUAR}kbit"; up_ceil="${S_UP_GUAR}kbit"; }

                local_parent="1:${S_POOL_ID}"
                [[ "$S_POOL_ID" -le 0 || "$S_POOL_RATE_UP" -le 0 ]] && local_parent="1:1"

                tc class add dev ifb1 parent "$local_parent" classid "1:${S_UP_CLASSID}" htb \
                    rate "$up_guar" ceil "$up_ceil" quantum 1500 2>/dev/null && \
                    log_msg "  ul class 1:${S_UP_CLASSID} under $local_parent"

                tc filter add dev ifb1 parent 1: protocol ip pref "$S_FW_PREF" fw \
                    handle "${S_MARK}" classid "1:${S_UP_CLASSID}" 2>/dev/null && \
                    log_msg "  fw ifb1 $MARK → 1:${S_UP_CLASSID}"
            fi

            ((RECOVERED_TC++))
        done
    fi
fi

# ─── Summary ─────────────────────────────────────────────────────────
log_msg "=== Recovery complete: nft=$RECOVERED_NFT tc=$RECOVERED_TC dry_run=$DRY_RUN ==="
echo "$(date): Recovery complete — nft_sets=$RECOVERED_NFT tc_sessions=$RECOVERED_TC (dry_run=$DRY_RUN)"
exit 0
