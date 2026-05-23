/**
 * MikroTik CHR — PM2 Ecosystem Config
 * RouterOS 7.18 running via QEMU 9.2.0 TCG (software emulation)
 *
 * Usage:
 *   pm2 start ecosystem-mikrotik.cjs
 *   pm2 logs mikrotik-chr
 *   pm2 stop mikrotik-chr
 *   pm2 restart mikrotik-chr
 *
 * Ports (host → guest):
 *   8728  → RouterOS API       8291  → Winbox
 *   2222  → SSH                8080  → WebFig (HTTP)
 *   8729  → API-SSL
 *
 * First-time setup:
 *   python3 configure-mikrotik.py
 */

module.exports = {
  apps: [
    {
      name: 'mikrotik-chr',
      description: 'MikroTik CHR 7.18 — QEMU TCG (API:8728, Winbox:8291, SSH:2222, WebFig:8080)',
      script: '/home/z/my-project/start-mikrotik.sh',
      interpreter: 'bash',
      cwd: '/home/z/my-project',
      autorestart: false,
      max_restarts: 3,
      restart_delay: 10000,
      kill_timeout: 15000,
      watch: false,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/z/my-project/logs/mikrotik-chr-error.log',
      out_file: '/home/z/my-project/logs/mikrotik-chr-out.log',
      merge_logs: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project',
      },
    },
  ],
};
