/**
 * Bandwidth Data Collector Daemon
 *
 * Polls radacct table for per-user bandwidth deltas (every 60s)
 * and /proc/net/dev for network interface counters (every 30s).
 * Stores data in RRD files for graphing.
 *
 * Exported as a singleton for standalone use via PM2.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import {
  ensureRRD,
  updateRRD,
  userRRDPath,
  interfaceRRDPath,
  getRRDBasePath,
} from './index';

// In-memory state: last seen octet counters for delta calculation
interface UserCounter {
  username: string;
  acctinputoctets: number;
  acctoutputoctets: number;
  lastPollTime: number;
}

interface IfaceCounter {
  iface: string;
  rxBytes: number;
  txBytes: number;
  lastPollTime: number;
}

class BandwidthCollector {
  private prisma: PrismaClient;
  private userCounters: Map<string, UserCounter> = new Map();
  private ifaceCounters: Map<string, IfaceCounter> = new Map();
  private userPollInterval: ReturnType<typeof setInterval> | null = null;
  private ifacePollInterval: ReturnType<typeof setInterval> | null = null;
  private logInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private usersPolled = 0;
  private ifacesPolled = 0;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  /**
   * Start the collector
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[Collector] Already running');
      return;
    }

    this.running = true;
    console.log('[Collector] Starting bandwidth collector...');

    // Ensure RRD directories exist
    const base = getRRDBasePath();
    fs.mkdirSync(`${base}/users`, { recursive: true });
    fs.mkdirSync(`${base}/interfaces`, { recursive: true });

    // Initial poll to seed counters (no deltas on first run)
    await this.pollUserBandwidth(true);
    await this.pollInterfaceBandwidth(true);

    // Schedule regular polls
    this.userPollInterval = setInterval(() => this.pollUserBandwidth(false), 60_000);
    this.ifacePollInterval = setInterval(() => this.pollInterfaceBandwidth(false), 30_000);
    this.logInterval = setInterval(() => this.logStatus(), 60_000);

    console.log('[Collector] Started — polling users every 60s, interfaces every 30s');
  }

  /**
   * Stop the collector gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('[Collector] Stopping...');
    this.running = false;

    if (this.userPollInterval) clearInterval(this.userPollInterval);
    if (this.ifacePollInterval) clearInterval(this.ifacePollInterval);
    if (this.logInterval) clearInterval(this.logInterval);

    await this.prisma.$disconnect();
    console.log('[Collector] Stopped');
  }

  /**
   * Poll radacct for active sessions and update per-user RRDs
   */
  private async pollUserBandwidth(isSeed: boolean): Promise<void> {
    try {
      const rows: Array<{
        username: string;
        acctinputoctets: bigint | number;
        acctoutputoctets: bigint | number;
      }> = await this.prisma.$queryRawUnsafe(`
        SELECT username, acctinputoctets, acctoutputoctets
        FROM radacct
        WHERE acctstoptime IS NULL
      `);

      const now = Math.floor(Date.now() / 1000);

      for (const row of rows) {
        const inBytes = Number(row.acctinputoctets) || 0;
        const outBytes = Number(row.acctoutputoctets) || 0;
        const prev = this.userCounters.get(row.username);

        if (isSeed) {
          // First run: just store counters, don't write deltas
          this.userCounters.set(row.username, {
            username: row.username,
            acctinputoctets: inBytes,
            acctoutputoctets: outBytes,
            lastPollTime: now,
          });
          // Ensure RRD file exists
          await ensureRRD(userRRDPath(row.username));
          continue;
        }

        if (prev) {
          const deltaIn = inBytes - prev.acctinputoctets;
          const deltaOut = outBytes - prev.acctoutputoctets;
          const deltaT = now - prev.lastPollTime;

          // Only update if time has progressed and counters haven't reset
          if (deltaT > 0 && deltaIn >= 0 && deltaOut >= 0) {
            const rrdPath = userRRDPath(row.username);
            try {
              await updateRRD(rrdPath, now, {
                ds_in: Math.max(0, deltaIn),
                ds_out: Math.max(0, deltaOut),
              });
              this.usersPolled++;
            } catch (err) {
              console.error(`[Collector] Failed to update RRD for ${row.username}:`, err);
            }
          }
        }

        // Update in-memory counter
        this.userCounters.set(row.username, {
          username: row.username,
          acctinputoctets: inBytes,
          acctoutputoctets: outBytes,
          lastPollTime: now,
        });
      }

      // Clean up counters for users that are no longer active
      const activeUsernames = new Set(rows.map(r => r.username));
      for (const [username] of this.userCounters) {
        if (!activeUsernames.has(username)) {
          this.userCounters.delete(username);
        }
      }
    } catch (err) {
      console.error('[Collector] Error polling user bandwidth:', err);
    }
  }

  /**
   * Poll /proc/net/dev for interface counters
   */
  private async pollInterfaceBandwidth(isSeed: boolean): Promise<void> {
    try {
      const procNetDev = '/proc/net/dev';
      if (!fs.existsSync(procNetDev)) {
        return; // Not Linux or no procfs
      }

      const content = fs.readFileSync(procNetDev, 'utf-8');
      const lines = content.trim().split('\n');

      const now = Math.floor(Date.now() / 1000);

      for (const line of lines) {
        const match = line.match(/^\s*(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
        if (!match) continue;

        const iface = match[1];
        if (iface === 'lo') continue; // Skip loopback

        const rxBytes = parseInt(match[2], 10);
        const txBytes = parseInt(match[3], 10);
        const prev = this.ifaceCounters.get(iface);

        if (isSeed) {
          this.ifaceCounters.set(iface, { iface, rxBytes, txBytes, lastPollTime: now });
          await ensureRRD(interfaceRRDPath(iface));
          continue;
        }

        if (prev) {
          const deltaRx = rxBytes - prev.rxBytes;
          const deltaTx = txBytes - prev.txBytes;
          const deltaT = now - prev.lastPollTime;

          if (deltaT > 0 && deltaRx >= 0 && deltaTx >= 0) {
            const rrdPath = interfaceRRDPath(iface);
            try {
              await updateRRD(rrdPath, now, {
                ds_in: Math.max(0, deltaRx),
                ds_out: Math.max(0, deltaTx),
              });
              this.ifacesPolled++;
            } catch (err) {
              console.error(`[Collector] Failed to update RRD for ${iface}:`, err);
            }
          }
        }

        this.ifaceCounters.set(iface, { iface, rxBytes, txBytes, lastPollTime: now });
      }

      // Clean up interfaces that no longer exist
      const activeIfaces = new Set(
        lines
          .map(l => l.match(/^\s*(\w+):/))
          .filter(Boolean)
          .map(m => m![1])
          .filter(i => i !== 'lo')
      );
      for (const [iface] of this.ifaceCounters) {
        if (!activeIfaces.has(iface)) {
          this.ifaceCounters.delete(iface);
        }
      }
    } catch (err) {
      console.error('[Collector] Error polling interface bandwidth:', err);
    }
  }

  /**
   * Log collector status
   */
  private logStatus(): void {
    const now = new Date().toISOString();
    const activeUsers = this.userCounters.size;
    const activeIfaces = this.ifaceCounters.size;
    console.log(
      `[Collector] ${now} | Active users: ${activeUsers} | Active interfaces: ${activeIfaces} | ` +
      `Total user updates: ${this.usersPolled} | Total iface updates: ${this.ifacesPolled}`
    );
  }
}

// Singleton instance
export const bandwidthCollector = new BandwidthCollector();

// Convenience start/stop functions
export async function startCollector(): Promise<void> {
  await bandwidthCollector.start();
}

export async function stopCollector(): Promise<void> {
  await bandwidthCollector.stop();
}
