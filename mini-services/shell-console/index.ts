import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn, ChildProcess } from 'child_process';

// ─── Configuration ────────────────────────────────────────────────────────────
const PORT = 3025;
const GRACE_PERIOD_MS = 30_000; // 30 seconds before force-killing on disconnect
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

// ─── Auth validation (best-effort) ────────────────────────────────────────────
async function validateAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    console.log(`[${timestamp()}] AUTH No token provided, allowing (internal network)`);
    return true;
  }

  try {
    const res = await fetch('http://localhost:3000/api/auth/session', {
      headers: {
        Cookie: `next-auth.session-token=${token}`,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const session = await res.json();
      if (session?.user) {
        console.log(`[${timestamp()}] AUTH Valid session for user: ${session.user.email || session.user.name || session.user.id}`);
        return true;
      }
    }

    console.log(`[${timestamp()}] AUTH Session validation failed (status ${res.status}), allowing connection (internal)`);
    return true;
  } catch (err) {
    console.log(`[${timestamp()}] AUTH Session endpoint unreachable, allowing connection (internal): ${err instanceof Error ? err.message : err}`);
    return true;
  }
}

// ─── Per-connection shell state ───────────────────────────────────────────────
interface ShellSession {
  child: ChildProcess;
  killTimer: ReturnType<typeof setTimeout> | null;
  cols: number;
  rows: number;
}

const activeSessions = new Map<string, ShellSession>();

// ─── HTTP + Socket.IO server ──────────────────────────────────────────────────
const httpServer = createServer((_req, res) => {
  // Simple health check
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'shell-console',
      port: PORT,
      activeSessions: activeSessions.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',          // Allow all origins (internal gateway service)
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Socket.IO connection handler ─────────────────────────────────────────────
io.on('connection', async (socket) => {
  const clientAddr = socket.handshake.address || 'unknown';
  const authToken = socket.handshake.auth?.token
    || socket.handshake.query?.token as string | undefined;

  console.log(`[${timestamp()}] CONNECT Client ${socket.id} from ${clientAddr}`);

  // Validate auth token (best-effort — always allow on failure for internal use)
  const authorized = await validateAuthToken(authToken);
  if (!authorized) {
    console.log(`[${timestamp()}] DENY Client ${socket.id} — unauthorized`);
    socket.emit('error', { message: 'Unauthorized' });
    socket.disconnect(true);
    return;
  }

  // ── Spawn bash shell ──────────────────────────────────────────────────────
  const env = {
    HOME: '/root',
    TERM: 'xterm-256color',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    COLUMNS: String(DEFAULT_COLS),
    LINES: String(DEFAULT_ROWS),
    LANG: 'en_US.UTF-8',
    SHELL: '/bin/bash',
  };

  let child: ChildProcess;
  try {
    child = spawn('/bin/bash', ['--norc', '--noprofile', '-i'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      shell: false,
    });
  } catch (err) {
    console.error(`[${timestamp()}] SPAWN FAIL for ${socket.id}: ${err instanceof Error ? err.message : err}`);
    socket.emit('error', { message: 'Failed to spawn shell' });
    socket.disconnect(true);
    return;
  }

  const session: ShellSession = {
    child,
    killTimer: null,
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
  };
  activeSessions.set(socket.id, session);

  console.log(`[${timestamp()}] SPAWN Shell PID ${child.pid} for ${socket.id} (${DEFAULT_COLS}x${DEFAULT_ROWS})`);

  // ── Send ready signal with terminal info ──────────────────────────────────
  socket.emit('ready', {
    pid: child.pid,
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    term: 'xterm-256color',
    message: 'Shell session established',
  });

  // ── Pipe stdout → client ─────────────────────────────────────────────────
  child.stdout?.on('data', (data: Buffer) => {
    socket.emit('output', data.toString('utf-8'));
  });

  // ── Pipe stderr → client (also as 'output' so terminal shows both) ───────
  child.stderr?.on('data', (data: Buffer) => {
    socket.emit('output', data.toString('utf-8'));
  });

  // ── Handle shell exit ────────────────────────────────────────────────────
  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.log(`[${timestamp()}] EXIT Shell PID ${child.pid} for ${socket.id} — ${reason}`);

    socket.emit('exit', {
      code,
      signal,
      reason,
      timestamp: new Date().toISOString(),
    });

    activeSessions.delete(socket.id);
  });

  child.on('error', (err) => {
    console.error(`[${timestamp()}] ERROR Shell PID ${child.pid} for ${socket.id}: ${err.message}`);
    socket.emit('error', { message: `Shell error: ${err.message}` });
    activeSessions.delete(socket.id);
  });

  // ── Client → stdin ───────────────────────────────────────────────────────
  socket.on('input', (data: string) => {
    if (child.stdin && !child.stdin.destroyed) {
      child.stdin.write(data);
    }
  });

  // ── Terminal resize ──────────────────────────────────────────────────────
  // Without node-pty we can't actually resize the pty, but we store the
  // dimensions and forward them so the client can adjust its display.
  // We also update COLUMNS/LINES env in the child's running process
  // by sending SIGWINCH (which many programs respond to).
  socket.on('resize', (data: { cols: number; rows: number }) => {
    const cols = Math.max(1, Math.min(data?.cols || DEFAULT_COLS, 500));
    const rows = Math.max(1, Math.min(data?.rows || DEFAULT_ROWS, 200));

    session.cols = cols;
    session.rows = rows;

    // Attempt to notify the child process of the resize via SIGWINCH
    if (child.pid) {
      try {
        process.kill(child.pid, 'SIGWINCH');
      } catch {
        // PID may have exited — ignore
      }
    }

    // Acknowledge resize to client
    socket.emit('resized', { cols, rows });
    console.log(`[${timestamp()}] RESIZE ${socket.id} → ${cols}x${rows}`);
  });

  // ── Ping/Pong heartbeat ──────────────────────────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong', {
      pid: child.pid,
      cols: session.cols,
      rows: session.rows,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Force-kill the shell process ─────────────────────────────────────────
  socket.on('kill', () => {
    console.log(`[${timestamp()}] KILL Requested by client ${socket.id}`);
    cleanupSession(socket.id, true);
  });

  // ── Disconnect handler with grace period ─────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[${timestamp()}] DISCONNECT ${socket.id} — reason: ${reason}`);

    // Start the grace period timer
    session.killTimer = setTimeout(() => {
      console.log(`[${timestamp()}] GRACE EXPIRED Force-killing shell PID ${child.pid} for ${socket.id}`);
      cleanupSession(socket.id, true);
    }, GRACE_PERIOD_MS);
  });

  // ── Cleanup helper ───────────────────────────────────────────────────────
  function cleanupSession(sid: string, force: boolean) {
    const s = activeSessions.get(sid);
    if (!s) return;

    // Clear any pending grace timer
    if (s.killTimer) {
      clearTimeout(s.killTimer);
      s.killTimer = null;
    }

    const pid = s.child.pid;
    if (pid && !s.child.killed) {
      try {
        if (force) {
          // Kill the entire process group if possible
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            process.kill(pid, 'SIGKILL');
          }
        } else {
          s.child.stdin?.end();
          try {
            process.kill(pid, 'SIGTERM');
          } catch {
            // Already dead
          }
        }
      } catch {
        // Process may have already exited
      }
    }

    activeSessions.delete(sid);
  }
});

// ─── Periodic stats logging ───────────────────────────────────────────────────
setInterval(() => {
  if (activeSessions.size > 0) {
    const sessions = Array.from(activeSessions.entries()).map(([id, s]) => ({
      id,
      pid: s.child.pid,
      size: `${s.cols}x${s.rows}`,
    }));
    console.log(`[${timestamp()}] STATS Active sessions: ${activeSessions.size}`, JSON.stringify(sessions));
  }
}, 60_000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown() {
  console.log(`\n[${timestamp()}] SHUTTING DOWN — killing ${activeSessions.size} active shell(s)…`);

  for (const [sid] of activeSessions) {
    const session = activeSessions.get(sid)!;
    if (session.killTimer) clearTimeout(session.killTimer);

    const pid = session.child.pid;
    if (pid && !session.child.killed) {
      try {
        try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); }
      } catch {
        // Ignore
      }
    }
    activeSessions.delete(sid);
  }

  io.close();
  httpServer.close(() => {
    console.log(`[${timestamp()}] SHUTDOWN COMPLETE`);
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful shutdown stalls
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  StaySuite Shell Console — WebSocket Terminal Service   ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Port:        ${String(PORT).padEnd(41)}║`);
  console.log(`║  Health:      http://localhost:${String(PORT).padEnd(26)}║`);
  console.log(`║  CORS:        All origins allowed                     ║`);
  console.log(`║  Grace:       ${String(GRACE_PERIOD_MS / 1000 + 's').padEnd(41)}║`);
  console.log(`║  Shell:       /bin/bash --norc --noprofile -i         ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`[${timestamp()}] READY Shell Console service listening on port ${PORT}`);
});
