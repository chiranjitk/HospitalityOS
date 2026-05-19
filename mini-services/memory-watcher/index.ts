/**
 * Memory Watcher for StaySuite
 *
 * Prevents kernel OOM kills by gracefully restarting the Next.js process
 * when memory usage exceeds safe thresholds on this 8GB system.
 *
 * Memory profile for this app (1831 source files, Turbopack):
 * - After first compilation: ~4-4.5GB
 * - Stable operation: ~3-4GB
 * - Growth over time: ~100MB/min (Turbopack cache accumulation)
 * - OOM kill threshold: ~5.9GB (kernel kills at this point)
 *
 * Strategy: Allow the app to use up to 5GB (it needs it for compilation),
 * then gracefully restart before hitting the 5.9GB OOM kill threshold.
 */

import { execSync } from 'child_process';

const CHECK_INTERVAL_MS = 15_000;   // Check every 15 seconds
const WARNING_MB = 3500;            // Log warning
const SOFT_RESTART_MB = 5000;       // Graceful restart (approaching OOM)
const HARD_KILL_MB = 5500;          // Force kill (OOM imminent, kernel kills at ~5900MB)
const PROCESS_NAME = 'staysuite-nextjs';
const COOLDOWN_MS = 180_000;        // 3 min cooldown for soft restarts
const STARTUP_GRACE_MS = 120_000;   // 120s grace for initial compilation

let lastRestartTime = 0;
const appStartTime = Date.now();

function getProcessTreeRSSmb(): number {
  try {
    const pm2Output = execSync(`pm2 jlist`, { encoding: 'utf-8', timeout: 5000 });
    const processes = JSON.parse(pm2Output);
    const mainProc = processes.find((p: any) => p.name === PROCESS_NAME);
    if (!mainProc || !mainProc.pid) return 0;

    const mainPid = mainProc.pid;

    function getAllChildPids(pid: string): string[] {
      const result: string[] = [];
      try {
        const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf-8', timeout: 3000 }).trim();
        if (children) {
          for (const childPid of children.split('\n').filter(Boolean)) {
            result.push(childPid);
            result.push(...getAllChildPids(childPid));
          }
        }
      } catch {}
      return result;
    }

    const allPids = [mainPid.toString(), ...getAllChildPids(mainPid.toString())];
    let totalKB = 0;
    for (const pid of allPids) {
      try {
        const rss = execSync(`cat /proc/${pid}/status 2>/dev/null | grep VmRSS`, {
          encoding: 'utf-8', timeout: 2000
        }).trim();
        const match = rss.match(/VmRSS:\s+(\d+)\s+kB/);
        if (match) totalKB += parseInt(match[1], 10);
      } catch {}
    }
    return Math.round(totalKB / 1024);
  } catch (err) {
    return 0;
  }
}

function softRestart(): void {
  const now = Date.now();
  if (now - appStartTime < STARTUP_GRACE_MS) {
    console.log(`[MemoryWatcher] Startup grace, skipping restart`);
    return;
  }
  if (now - lastRestartTime < COOLDOWN_MS) {
    console.log(`[MemoryWatcher] Cooldown (${Math.round((now - lastRestartTime) / 1000)}s left)`);
    return;
  }
  lastRestartTime = now;
  console.warn(`[MemoryWatcher] SOFT RESTART at ${SOFT_RESTART_MB}MB — triggering PM2 restart`);
  try {
    execSync(`pm2 restart ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 30000 });
    console.log(`[MemoryWatcher] Restart done`);
  } catch (err) {
    console.error(`[MemoryWatcher] Restart failed: ${(err as Error).message}`);
  }
}

function hardKill(currentRSSmb: number): void {
  const now = Date.now();
  if (now - lastRestartTime < 60000) return; // Min 60s between hard kills
  lastRestartTime = now;
  console.error(`[MemoryWatcher] HARD KILL at ${currentRSSmb}MB — clearing cache!`);
  try {
    // Clear cache on hard kill — memory critically high, needs fresh start
    execSync(`rm -rf /home/z/my-project/.next/dev`, { encoding: 'utf-8', timeout: 5000 });
    execSync(`pm2 stop ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 10000 });
    setTimeout(() => {
      try {
        execSync(`pm2 start ${PROCESS_NAME}`, { encoding: 'utf-8', timeout: 30000 });
        console.log(`[MemoryWatcher] Restarted after hard kill`);
      } catch (err) {
        console.error(`[MemoryWatcher] Restart failed: ${(err as Error).message}`);
      }
    }, 5000);
  } catch (err) {
    console.error(`[MemoryWatcher] Hard kill failed: ${(err as Error).message}`);
  }
}

function check(): void {
  const rssMB = getProcessTreeRSSmb();
  if (rssMB === 0) return;

  const now = new Date().toISOString();

  if (rssMB >= HARD_KILL_MB) {
    console.error(`[${now}] CRITICAL: ${rssMB}MB >= ${HARD_KILL_MB}MB`);
    hardKill(rssMB);
  } else if (rssMB >= SOFT_RESTART_MB) {
    console.warn(`[${now}] HIGH: ${rssMB}MB >= ${SOFT_RESTART_MB}MB`);
    softRestart();
  } else if (rssMB >= WARNING_MB) {
    console.log(`[${now}] WARNING: ${rssMB}MB`);
  }
}

console.log(`[MemoryWatcher] warn:${WARNING_MB}MB restart:${SOFT_RESTART_MB}MB kill:${HARD_KILL_MB}MB grace:${STARTUP_GRACE_MS / 1000}s`);
check();
setInterval(check, CHECK_INTERVAL_MS);
