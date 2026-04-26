#!/bin/bash
# ─────────────────────────────────────────────────────────────
# StaySuite RRD Collector — Cron Setup Script
#
# This script sets up a system cron job that runs the RRD
# bandwidth collector every minute. Requires sudo/root.
#
# Usage:
#   sudo bash scripts/setup-rrd-cron.sh          # install cron
#   sudo bash scripts/setup-rrd-cron.sh --remove # remove cron
# ─────────────────────────────────────────────────────────────

set -e

APP_DIR="/home/z/my-project/StaySuite-HospitalityOS"
CRON_TAG="# STAYSUITE-RRD-COLLECTOR"
SCRIPT_NAME="staysuite-rrd-cron"

install_cron() {
    echo "=== StaySuite RRD Collector Cron Setup ==="

    # Verify prerequisites
    if [ ! -f "$APP_DIR/src/lib/rrd/collector-cron.ts" ]; then
        echo "ERROR: collector-cron.ts not found at $APP_DIR/src/lib/rrd/collector-cron.ts"
        exit 1
    fi

    if ! command -v npx &>/dev/null; then
        echo "ERROR: npx not found. Install Node.js first."
        exit 1
    fi

    if ! command -v tsx &>/dev/null && ! npx tsx --version &>/dev/null; then
        echo "INFO: Installing tsx..."
        cd "$APP_DIR" && npm install -g tsx 2>/dev/null || npm install tsx --save-dev
    fi

    # Ensure directories exist
    mkdir -p "$APP_DIR/logs" "$APP_DIR/data/rrd/state"

    # Create log rotation script
    cat > "$APP_DIR/scripts/rrd-cron-runner.sh" << 'RUNNER'
#!/bin/bash
# RRD collector cron runner — called by crontab
cd /home/z/my-project/StaySuite-HospitalityOS
exec npx tsx src/lib/rrd/collector-cron.ts >> logs/rrd-cron.log 2>&1
RUNNER
    chmod +x "$APP_DIR/scripts/rrd-cron-runner.sh"

    # Remove existing StaySuite cron entries
    remove_cron_silent

    # Add new cron job (every minute)
    (crontab -l 2>/dev/null | grep -v "$CRON_TAG"; echo "$CRON_TAG - runs every minute"; echo "* * * * * $APP_DIR/scripts/rrd-cron-runner.sh $CRON_TAG") | crontab -

    # Add weekly log cleanup (every Sunday 3 AM)
    (crontab -l 2>/dev/null; echo "$CRON_TAG - weekly log cleanup"; echo "0 3 * * 0 truncate -s 0 $APP_DIR/logs/rrd-cron.log $CRON_TAG") | crontab -

    echo ""
    echo "✓ Cron job installed successfully!"
    echo ""
    echo "  Collector runs:  Every minute"
    echo "  Log cleanup:     Every Sunday at 3:00 AM"
    echo "  Log file:        $APP_DIR/logs/rrd-cron.log"
    echo "  State file:      $APP_DIR/data/rrd/state/counter-state.json"
    echo ""
    echo "Current crontab:"
    crontab -l | grep "$CRON_TAG" -A1 | sed 's/^/  /'
    echo ""
    echo "To test manually:  cd $APP_DIR && npx tsx src/lib/rrd/collector-cron.ts"
    echo "To remove:         sudo bash $APP_DIR/scripts/setup-rrd-cron.sh --remove"
}

remove_cron_silent() {
    crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab - 2>/dev/null || true
}

remove_cron() {
    echo "=== Removing StaySuite RRD Collector Cron ==="
    remove_cron_silent
    echo "✓ Cron entries removed."
}

case "${1:-}" in
    --remove|--uninstall)
        remove_cron
        ;;
    *)
        install_cron
        ;;
esac
