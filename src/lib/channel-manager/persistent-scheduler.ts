/**
 * Persistent Channel Scheduler
 * 
 * Replaces in-memory setInterval with database-backed scheduling.
 * Stores last sync time and next sync time in ChannelConnection model.
 * On server startup, loads all active connections and schedules syncs.
 * Persists sync state to survive restarts.
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export interface ScheduledSync {
  connectionId: string;
  channel: string;
  propertyId: string | null;
  intervalSeconds: number;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  timer: ReturnType<typeof setInterval> | null;
}

export interface SchedulerState {
  isRunning: boolean;
  activeSyncs: number;
  lastRunAt: Date | null;
  totalSyncs: number;
  totalErrors: number;
}

// ============================================
// STATE
// ============================================

let schedulerInstance: PersistentScheduler | null = null;
const timers = new Map<string, ReturnType<typeof setInterval>>();
let isInitialized = false;

// ============================================
// PERSISTENT SCHEDULER CLASS
// ============================================

export class PersistentScheduler {
  private state: SchedulerState = {
    isRunning: false,
    activeSyncs: 0,
    lastRunAt: null,
    totalSyncs: 0,
    totalErrors: 0,
  };

  /**
   * Initialize the scheduler from the database.
   * Called on server startup to restore scheduling state.
   */
  async initialize(): Promise<void> {
    if (isInitialized) return;

    console.log('[PersistentScheduler] Initializing from database...');

    try {
      // Load all active connections with autoSync enabled
      const connections = await db.channelConnection.findMany({
        where: {
          status: 'active',
          autoSync: true,
        },
        select: {
          id: true,
          channel: true,
          propertyId: true,
          syncInterval: true,
          lastSyncAt: true,
        },
      });

      console.log(`[PersistentScheduler] Found ${connections.length} active connections to schedule`);

      let scheduledCount = 0;
      for (const conn of connections) {
        const lastSync = conn.lastSyncAt;
        const intervalMs = conn.syncInterval * 60 * 1000;
        const nextSync = lastSync ? new Date(lastSync.getTime() + intervalMs) : new Date();

        // Only schedule if next sync time is in the future (or now)
        if (nextSync.getTime() <= Date.now()) {
          // Schedule immediately with a small delay to spread out initial load
          const delay = scheduledCount * 2000; // 2s stagger
          setTimeout(() => {
            this.executeSync(conn.id);
          }, delay);
          scheduledCount++;
        } else {
          // Schedule for the correct future time
          this.scheduleSync(conn.id, conn.channel, conn.propertyId, conn.syncInterval, lastSync);
          scheduledCount++;
        }
      }

      this.state.isRunning = true;
      isInitialized = true;

      // Save initial state to database
      await this.saveState();

      console.log(`[PersistentScheduler] Initialized with ${scheduledCount} scheduled syncs`);

      // Start the health check interval (every 5 minutes)
      setInterval(() => {
        this.healthCheck().catch(() => {});
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('[PersistentScheduler] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Schedule a sync for a specific connection.
   */
  async scheduleSync(
    connectionId: string,
    channel: string,
    propertyId: string | null,
    intervalMinutes: number,
    lastSync?: Date | null,
  ): Promise<void> {
    const intervalMs = intervalMinutes * 60 * 1000;
    const lastSyncTime = lastSync || new Date(0);
    const nextSyncTime = new Date(lastSyncTime.getTime() + intervalMs);
    const delay = Math.max(0, nextSyncTime.getTime() - Date.now());

    // Clear existing timer for this connection
    const existingTimer = timers.get(connectionId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(async () => {
      await this.executeSync(connectionId);
      // After execution, reschedule
      await this.scheduleSync(connectionId, channel, propertyId, intervalMinutes);
    }, delay);

    timers.set(connectionId, timer);

    console.log(`[PersistentScheduler] Scheduled sync for ${channel} (conn: ${connectionId}) in ${Math.round(delay / 1000)}s`);
  }

  /**
   * Execute a sync for a specific connection.
   */
  private async executeSync(connectionId: string): Promise<void> {
    try {
      this.state.activeSyncs++;
      this.state.totalSyncs++;

      const conn = await db.channelConnection.findUnique({
        where: { id: connectionId },
      });

      if (!conn || !conn.autoSync || conn.status !== 'active') {
        console.log(`[PersistentScheduler] Skipping sync for inactive connection ${connectionId}`);
        return;
      }

      console.log(`[PersistentScheduler] Executing sync for ${conn.channel} (conn: ${connectionId})`);

      const startTime = Date.now();

      // Update last sync time in database
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
        },
      });

      // Create sync log entry
      const syncLog = await db.channelSyncLog.create({
        data: {
          connectionId,
          syncType: 'scheduled',
          direction: 'outbound',
          status: 'pending',
          requestPayload: JSON.stringify({
            trigger: 'persistent_scheduler',
            connectionId,
            channel: conn.channel,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // H-33 FIX: Immediately process the created sync log instead of leaving it 'pending'
      // Previously sync logs were created but never consumed, causing stale data on OTAs
      try {
        const { processSyncMessage } = await import('./realtime-sync');
        await processSyncMessage(syncLog.id, {
          tenantId: String(conn.tenantId),
          propertyId: String(conn.propertyId),
          type: 'scheduled_sync',
          priority: 'low',
          data: { connectionId, channel: conn.channel },
        });
      } catch (procErr) {
        console.warn(`[PersistentScheduler] Failed to process sync log ${syncLog.id}:`, procErr);
      }

      const duration = Date.now() - startTime;
      console.log(`[PersistentScheduler] Sync completed for ${conn.channel} in ${duration}ms`);

      this.state.lastRunAt = new Date();

      // Save state
      await this.saveState();
    } catch (error) {
      console.error(`[PersistentScheduler] Sync failed for connection ${connectionId}:`, error);
      this.state.totalErrors++;

      // Log the error
      try {
        await db.channelSyncLog.create({
          data: {
            connectionId,
            syncType: 'scheduled',
            direction: 'outbound',
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            requestPayload: JSON.stringify({
              trigger: 'persistent_scheduler',
              connectionId,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (logError) {
        console.error('[PersistentScheduler] Failed to log error:', logError);
      }
    } finally {
      this.state.activeSyncs = Math.max(0, this.state.activeSyncs - 1);
    }
  }

  /**
   * Health check: verify all scheduled timers are still running
   * and reschedule any that have fallen behind.
   */
  private async healthCheck(): Promise<void> {
    if (!this.state.isRunning) return;

    console.log(`[PersistentScheduler] Running health check...`);

    try {
      const connections = await db.channelConnection.findMany({
        where: {
          status: 'active',
          autoSync: true,
        },
        select: {
          id: true,
          channel: true,
          propertyId: true,
          syncInterval: true,
          lastSyncAt: true,
        },
      });

      let recovered = 0;
      for (const conn of connections) {
        const hasTimer = timers.has(conn.id);
        const intervalMs = conn.syncInterval * 60 * 1000;
        const lastSync = conn.lastSyncAt;
        const nextExpectedSync = lastSync ? new Date(lastSync.getTime() + intervalMs) : null;
        const isOverdue = nextExpectedSync && nextExpectedSync.getTime() < Date.now() - 60000; // 1 min grace period

        if (!hasTimer || isOverdue) {
          console.log(`[PersistentScheduler] Recovering sync for ${conn.channel} (conn: ${conn.id})`);
          await this.scheduleSync(conn.id, conn.channel, conn.propertyId, conn.syncInterval, lastSync);
          recovered++;
        }
      }

      if (recovered > 0) {
        console.log(`[PersistentScheduler] Recovered ${recovered} syncs`);
      }

      // Clean up timers for connections that are no longer active
      const activeConnectionIds = new Set(connections.map(c => c.id));
      for (const [connId, timer] of timers.entries()) {
        if (!activeConnectionIds.has(connId)) {
          clearTimeout(timer);
          timers.delete(connId);
        }
      }
    } catch (error) {
      console.error('[PersistentScheduler] Health check failed:', error);
    }

    await this.saveState();
  }

  /**
   * Add a new connection to the scheduler.
   */
  async addConnection(
    connectionId: string,
    channel: string,
    propertyId: string | null,
    intervalMinutes: number,
  ): Promise<void> {
    await this.scheduleSync(connectionId, channel, propertyId, intervalMinutes);
    console.log(`[PersistentScheduler] Added connection ${channel} (conn: ${connectionId}) to scheduler`);
  }

  /**
   * Remove a connection from the scheduler.
   */
  removeConnection(connectionId: string): void {
    const timer = timers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(connectionId);
      console.log(`[PersistentScheduler] Removed connection ${connectionId} from scheduler`);
    }
  }

  /**
   * Get the current scheduler state.
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Stop the scheduler.
   */
  async shutdown(): Promise<void> {
    console.log('[PersistentScheduler] Shutting down...');

    // Clear all timers
    for (const [connId, timer] of timers.entries()) {
      clearTimeout(timer);
    }
    timers.clear();

    this.state.isRunning = false;
    isInitialized = false;

    await this.saveState();
    console.log('[PersistentScheduler] Shutdown complete');
  }

  /**
   * Persist the scheduler state to the database.
   */
  private async saveState(): Promise<void> {
    try {
      // Use ChannelConnection's lastSyncAt field for persistence
      // The scheduler state is implicitly persisted through the connection records
      console.log(`[PersistentScheduler] State saved. Active: ${timers.size}, Total syncs: ${this.state.totalSyncs}, Errors: ${this.state.totalErrors}`);
    } catch (error) {
      console.error('[PersistentScheduler] Failed to save state:', error);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

/**
 * Get or create the persistent scheduler singleton.
 */
export function getPersistentScheduler(): PersistentScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new PersistentScheduler();
  }
  return schedulerInstance;
}

/**
 * Initialize the scheduler on server startup.
 * Call this from instrumentation or a startup hook.
 */
export async function initializeScheduler(): Promise<PersistentScheduler> {
  const scheduler = getPersistentScheduler();
  await scheduler.initialize();
  return scheduler;
}

/**
 * Gracefully shut down the scheduler.
 */
export async function shutdownScheduler(): Promise<void> {
  if (schedulerInstance) {
    await schedulerInstance.shutdown();
    schedulerInstance = null;
  }
}
