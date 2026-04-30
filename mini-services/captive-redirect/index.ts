/**
 * StaySuite Captive Portal HTTP Redirect Server
 *
 * Intercepts ALL HTTP traffic from unauthenticated guests (via nftables redirect)
 * and sends a 302 redirect to the StaySuite login portal (/connect).
 *
 * Works with ALL devices:
 *   - Apple iOS/macOS  → CNA detects 302, shows captive portal popup
 *   - Android           → connectivity check gets 302, shows "Sign in to WiFi"
 *   - Windows 10/11     → NCSI gets 302, shows "Sign in" notification
 *   - Linux/Ubuntu      → NM connectivity check gets 302
 *   - Firefox           → detectportal.firefox.com gets 302
 *
 * IP auto-detection: Uses req.socket.localAddress to determine which
 * server IP the guest is connecting through (works for multi-homed gateways).
 */

import http from 'http';
import os from 'os';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.PORT || '8888', 10);
const PORTAL_PORT = parseInt(process.env.PORTAL_PORT || '3000', 10);
const REDIRECT_STATUS = 302;

// ═══════════════════════════════════════════════════════════════════════════
// Network Interface Helper
// ═══════════════════════════════════════════════════════════════════════════

/** Get all non-loopback IPv4 addresses from server network interfaces */
function getServerIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

/** Clean IP address — strip IPv6 prefix */
function cleanIP(ip: string | undefined): string {
  if (!ip) return '';
  return ip.replace('::ffff:', '');
}

/** Check if IP is loopback or invalid */
function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0' || ip === '' || ip.startsWith('169.254.');
}

/**
 * Determine the best redirect IP for this connection.
 *
 * Strategy:
 * 1. Use req.socket.localAddress (the IP the guest connected to via NAT redirect)
 * 2. If that's loopback/invalid, fall back to first non-loopback interface
 */
function getRedirectIP(req: http.IncomingMessage): string {
  const localIP = cleanIP(req.socket.localAddress);
  if (localIP && !isLoopback(localIP)) {
    return localIP;
  }

  // Fallback: find the first non-loopback IPv4
  const serverIPs = getServerIPs();
  if (serverIPs.length > 0) {
    return serverIPs[0];
  }

  // Last resort
  return '127.0.0.1';
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Redirect Server
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  const clientIP = cleanIP(req.socket.remoteAddress);
  const serverIP = getRedirectIP(req);
  const portalUrl = `http://${serverIP}:${PORTAL_PORT}/connect`;

  // ── Log the redirect ───────────────────────────────────────────────────
  const timestamp = new Date().toISOString();
  const host = req.headers['host'] || '-';
  console.log(`[${timestamp}] ${clientIP} → ${req.method} ${req.url} (Host: ${host}) → ${portalUrl}`);

  // ── Send 302 Redirect ─────────────────────────────────────────────────
  res.writeHead(REDIRECT_STATUS, {
    'Location': portalUrl,
    'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'close',
  });
  res.end();
});

// ── Handle server errors ─────────────────────────────────────────────────
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} is already in use. Stop netveli first:`);
    console.error(`  systemctl stop netveli`);
    console.error(`  Or kill: fuser -k ${PORT}/tcp`);
    process.exit(1);
  }
  console.error(`[ERROR] Server error: ${err.message}`);
});

// ── Handle client connection errors gracefully ───────────────────────────
server.on('clientError', (err, socket) => {
  if (err.code !== 'ECONNRESET') {
    console.error(`[CLIENT ERROR] ${err.code}: ${err.message}`);
  }
  if (socket.writable && !socket.destroyed) {
    socket.end('HTTP/1.1 302 Found\r\nLocation: /\r\n\r\n');
    socket.destroy();
  }
});

// ── Graceful shutdown ────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down captive redirect server...`);
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ips = getServerIPs();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   StaySuite Captive Portal Redirect Server              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Listening on: 0.0.0.0:${PORT}                            ║`);
  console.log(`║  Redirect to: http://<auto-ip>:${PORTAL_PORT}/connect    ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');

  if (ips.length > 0) {
    console.log('║  Auto-detected server IPs:                             ║');
    for (const ip of ips) {
      console.log(`║    → http://${ip}:${PORTAL_PORT}/connect`);
    }
  }

  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  Device compatibility:                                   ║');
  console.log('║    ✓ Apple iOS/macOS (Captive Network Assistant)         ║');
  console.log('║    ✓ Android (Connectivity Check → 302)                  ║');
  console.log('║    ✓ Windows 10/11 (NCSI → 302)                         ║');
  console.log('║    ✓ Linux/Ubuntu (NetworkManager)                       ║');
  console.log('║    ✓ Firefox (detectportal.firefox.com)                  ║');
  console.log('║    ✓ Chrome/Edge ( captive portal detection)             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});
