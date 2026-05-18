/**
 * Memory Watcher for StaySuite
 *
 * Problem: PM2's max_memory_restart only monitors the SPAWNED process (the parent
 * `node` process at ~70MB), NOT the `next-server` child process which grows to 6GB+.
 * So PM2 never triggers a graceful restart — instead the kernel OOM-killer murders
 * the process, causing 30s+ downtime on every crash.
 *
 * Solution: This watcher periodically checks the total RSS of the staysuite-main
 * process tree. When it exceeds the threshold, it triggers `pm2 restart` for a
 * graceful restart BEFORE the kernel OOM killer fires.
 *
 * Memory thresholds:
 *   - WARNING at 3500MB: log a warning
 *   - SOFT RESTART at 4500MB: trigger PM2 graceful restart
 *   - HARD KILL at 5500MB: force kill the process tree (last resort before kernel OOM)
 */

import { execSync } from 'child_process';

const CHECK_INTERVAL_MS = 15_000; // Check every 15 seconds
const WARNING_MB = 4500;       // Initial compilation burst can reach 4-5GB — that's normal
const SOFT_RESTART_MB = 5500;  // Graceful restart before kernel OOM (kernel kills at ~6GB)
const HARD_KILL_MB = 6000;     // Emergency: force kill to prevent system freeze
const PROCESS_NAME = 'staysuite-main';
const COOLDOWN_MS = 300_000;   // 5 min cooldown — give app time to stabilize after restart

let lastRestartTime = 0;
const STARTUP_GRACE_MS = 120_000; // Don't restart during first 2 min (compilation burst)
const appStartTime = Date.now();

function getProcessTreeRSSmb(): number {
  try {
    // Get the PID of the PM2-managed process
    const pm2Output = execSync(`pm2 jlist`, { encoding: 'utf-8', timeout: 5000 });
    const processes = JSON.parse(pm2Output);
    const mainProc = processes.find((p: any) => p.name === PROCESS_NAME);
    if (!mainProc || !mainProc.pid) {
      return 0; // Process not found, skip
    }

    const mainPid = mainProc.pid;

    // Get all child processes of the main PID
    // pgrep -P finds direct children; we need the whole tree
    try {
      const treePids = execSync(`pgrep -P ${mainPid}`, { encoding: 'utf-8', timeout: 3000 }).trim();
      const childPids = treePids ? treePids.split('\n').filter(Boolean) : [];

      // Also include the main PID itself
      const allPids = [mainPid.toString(), ...childPids];

      let totalKB = 0;
      for (const pid of allPids) {
        try {
          const rss = execSync(`cat /proc/${pid}/status 2>/dev/null | grep VmRSS`, {
            encoding: 'utf-8', timeout: 2000
          }).trim();
          const match = rss.match(/VmRSS:\s+(\d+)\s+kB/);
          if (match) {
            totalKB += parseInt(match[1], 10);
          }
        } catch {
          // Process might have exited, skip
        }
      }

      return Math.round(totalKB / 1024); // Convert KB to MB
    } catch {
      // pgrep failed, fall back to just the main PID
      try {
        const rss = execSync(`cat /proc/${mainPid}/status 2>/dev/null | grep VmRSS`, {
          encoding: 'utf-8', timeout: 2000
        }).trim();
        const match = rss.match(/VmRSS:\s+(\d+)\s+kB/);
        if (match) {
          return Math.round(parseInt(match[1], 10) / 1024);
        }
      } catch {}
      return 0;
    }
  } catch (err) {
    console.error(`[MemoryWatcher] Error checking process: ${(err as Error).message}`);
    return 0;
  }
}

function softRestart(): void {
  const now = Date.now();
  // Startup grace period — don't restart during initial compilation burst
  if (now - appStartTime < STARTUP_GRACE_MS) {
    console.log(`[MemoryWatcher] Startup grace period active (${Math.round((now - appStartTime) / 1000)}s / ${STARTUP_GRACE_MS / 1000}s), skipping restart`);
    return;
  }
  if (now - lastRestartTime < COOLDOWN_MS) {
    console.log(`[MemoryWatcher] Cooldown active, skipping restart (last restart ${Math.round((now - lastRestartTime) / 1000)}s ago)`);
    return;
  }
  lastRestartTime = now;
  console.warn(`[MemoryWatcher] ⚠️ SOFT RESTART: Process tree exceeded ${SOFT_RESTART_MB}MB, triggering PM2 restart...`);
  try {
    execSync(`pm2 restart ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 30000 });
    console.log(`[MemoryWatcher] ✅ PM2 restart triggered successfully`);
  } catch (err) {
    console.error(`[MemoryWatcher] ❌ PM2 restart failed: ${(err as Error).message}`);
  }
}

function hardKill(currentRSSmb: number): void {
  const now = Date.now();
  // Even during hard kill, respect startup grace unless truly critical (>6.5GB)
  if (now - appStartTime < STARTUP_GRACE_MS && currentRSSmb < 6500) {
    console.log(`[MemoryWatcher] Startup grace — skipping hard kill (RSS=${currentRSSmb}MB)`);
    return;
  }
  if (now - lastRestartTime < COOLDOWN_MS) {
    return;
  }
  lastRestartTime = now;
  console.error(`[MemoryWatcher] 🚨 HARD KILL: Process tree exceeded ${HARD_KILL_MB}MB, force killing...`);
  try {
    execSync(`pm2 stop ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 10000 });
    console.log(`[MemoryWatcher] Process stopped, waiting 5s before restart...`);
    setTimeout(() => {
      try {
        execSync(`pm2 start ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 30000 });
        console.log(`[MemoryWatcher] ✅ Process restarted after hard kill`);
      } catch (err) {
        console.error(`[MemoryWatcher] ❌ Restart after hard kill failed: ${(err as Error).message}`);
      }
    }, 5000);
  } catch (err) {
    console.error(`[MemoryWatcher] ❌ Hard kill failed: ${(err as Error).message}`);
  }
}

function check(): void {
  const rssMB = getProcessTreeRSSmb();
  const now = new Date().toISOString();

  if (rssMB === 0) {
    // Process not found or not running — skip silently
    return;
  }

  if (rssMB >= HARD_KILL_MB) {
    console.error(`[${now}] [MemoryWatcher] 🚨 CRITICAL: ${PROCESS_NAME} tree RSS = ${rssMB}MB (>= ${HARD_KILL_MB}MB)`);
    hardKill(rssMB);
  } else if (rssMB >= SOFT_RESTART_MB) {
    console.warn(`[${now}] [MemoryWatcher] ⚠️ HIGH: ${PROCESS_NAME} tree RSS = ${rssMB}MB (>= ${SOFT_RESTART_MB}MB)`);
    softRestart();
  } else if (rssMB >= WARNING_MB) {
    console.log(`[${now}] [MemoryWatcher] 📊 WARNING: ${PROCESS_NAME} tree RSS = ${rssMB}MB (threshold: ${WARNING_MB}MB)`);
  }
  // Below warning threshold: silent (no log spam)
}

console.log(`[MemoryWatcher] Starting — check every ${CHECK_INTERVAL_MS / 1000}s, warn at ${WARNING_MB}MB, restart at ${SOFT_RESTART_MB}MB, hard kill at ${HARD_KILL_MB}MB`);

// Run check immediately
check();

// Then on interval
setInterval(check, CHECK_INTERVAL_MS);
