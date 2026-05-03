/**
 * WiFi User Service
 * 
 * Handles provisioning and deprovisioning of WiFi users.
 * This is the PMS-side logic that manages the RADIUS database.
 * 
 * Architecture (PostgreSQL database):
 * ┌─────────────────────────────────────────────────────┐
 * │  PostgreSQL database                                │
 * │  ┌──────────────┐  ┌──────────────┐                 │
 * │  │ WiFiUser     │  │ RadCheck     │                 │
 * │  │ RadReply     │  │ RadUserGroup │                 │
 * │  │ RadGroupCheck│  │ RadGroupReply│                 │
 * │  └──────────────┘  └──────────────┘                 │
 * └──────────┬──────────────────┬───────────────────────┘
 *            │                  │
 *   PMS (Prisma)        FreeRADIUS Service (:3010)
 *   writes RadCheck      reads RadCheck for auth
 *   writes RadReply      reads RadReply for attrs
 * 
 * No sync needed — both services read/write the SAME database.
 * When you move to PostgreSQL, just change DATABASE_URL.
 * 
 * DO: PMS = source of truth for user data
 * DO: Use transaction for provisioning operations
 * DO NOT: Implement RADIUS protocol in Node.js
 * DO NOT: Build DHCP/DNS in PMS
 */

import { db } from '@/lib/db';
import { randomBytes, randomInt } from 'crypto';
import {
  getActiveNASVendors,
  generateBandwidthAttributes,
  generateSessionAttributes,
  readDataLimitBytes,
  BANDWIDTH_ATTRIBUTES,
  DATA_LIMIT_ATTRIBUTES,
} from '@/lib/wifi/utils/vendor-attributes';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://127.0.0.1:3010';

/** Prisma unique constraint violation error code */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Helper to call the freeradius-service API
 */
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError: Record<string, unknown>;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  return response.json();
}

export interface WiFiUserCreateInput {
  tenantId: string;
  propertyId: string;
  guestId?: string;
  bookingId?: string;
  username?: string;
  password?: string;
  planId?: string;
  planName?: string; // Plan name for Cryptsk-Plan-Name and Cryptsk-User-Profile VSA
  validFrom: Date;
  validUntil: Date;
  userType?: 'guest' | 'staff' | 'admin' | 'service';
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionTimeoutMinutes?: number; // RADIUS Session-Timeout in minutes (from plan validityDays)
  idleTimeoutSeconds?: number; // Cryptsk-Idle-Timeout in seconds (from CaptivePortal.idleTimeout)
  sessionLimit?: number; // Max concurrent sessions (Simultaneous-Use RADIUS attribute)
  dataLimit?: number; // Data cap in MB (from plan dataLimit)
}

export interface WiFiUserUpdateInput {
  validUntil?: Date;
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionTimeoutMinutes?: number; // RADIUS Session-Timeout in minutes
  idleTimeoutSeconds?: number; // Cryptsk-Idle-Timeout in seconds
  sessionLimit?: number; // Max concurrent sessions
  dataLimit?: number;
  status?: 'active' | 'suspended' | 'expired' | 'revoked';
}

export class WiFiUserService {
  /**
   * Create a new WiFi user with RADIUS credentials
   * 
   * Since both PMS and FreeRADIUS service use the SAME PostgreSQL database,
   * writing to RadCheck/RadReply/RadUserGroup via Prisma is all that's needed.
   * The FreeRADIUS service will immediately see the new user.
   * 
   * Flow:
   * 1. Create WiFiUser record
   * 2. Create RadCheck (authentication) — same table FreeRADIUS reads
   * 3. Create RadReply (authorization policies) — same table FreeRADIUS reads
   * 4. Create RadUserGroup (plan group mapping) — links user to plan group
   */
  async provisionUser(input: WiFiUserCreateInput) {
    // Bug 4 Fix: Retry loop (3 attempts) with fresh randomBytes on P2002 unique constraint error
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const username = input.username || this.generateUsername(input.propertyId);
        const password = input.password || this.generatePassword();

        return await db.$transaction(async (tx) => {
          // Resolve plan group name (radusergroup maps username → groupname)
          let groupName = 'standard-guests'; // default fallback
          let planIdleTimeoutSec = 0;
          if (input.planId) {
            const plan = await tx.wiFiPlan.findUnique({
              where: { id: input.planId },
              select: { name: true, idleTimeoutSec: true, sessionTimeoutSec: true },
            });
            if (plan) {
              // Convert plan name to a RADIUS-safe group name (lowercase, underscores)
              groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
              // Auto-read idle timeout from plan if not explicitly provided
              if (!input.idleTimeoutSeconds && plan.idleTimeoutSec) {
                planIdleTimeoutSec = plan.idleTimeoutSec;
              }
            }
          }
          const effectiveIdleTimeout = input.idleTimeoutSeconds || planIdleTimeoutSec;

          // 1. Create WiFiUser
          const wifiUser = await tx.wiFiUser.create({
            data: {
              tenantId: input.tenantId,
              propertyId: input.propertyId,
              username,
              password,
              guestId: input.guestId,
              bookingId: input.bookingId,
              planId: input.planId,
              validFrom: input.validFrom,
              validUntil: input.validUntil,
              userType: input.userType || 'guest',
              status: 'active',
              radiusSynced: true, // Same DB — always synced
              radiusSyncedAt: new Date(),
            },
          });

          // 2. Create RadCheck (authentication — FreeRADIUS reads this table directly)
          await tx.radCheck.create({
            data: {
              wifiUserId: wifiUser.id,
              username,
              attribute: 'Cleartext-Password',
              op: ':=',
              value: password,
              isActive: true,
            },
          });

          // 3. Create RadReply (authorization policies — FreeRADIUS reads this table directly)
          // Use VENDOR-AWARE attribute generation based on active NAS types
          const vendors = await getActiveNASVendors(input.propertyId);

          // Bandwidth limits
          const downloadMbps = input.downloadSpeed ? input.downloadSpeed / 1000000 : 10;
          const uploadMbps = input.uploadSpeed ? input.uploadSpeed / 1000000 : 5;
          const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);

          // Session timeout + data limit
          const sessionAttrs = generateSessionAttributes(
            vendors,
            input.sessionTimeoutMinutes || 0,
            input.dataLimit || 0,
          );

          // Merge all reply attributes
          const replies = [...bwAttrs, ...sessionAttrs];

          // ── Cryptsk VSA attributes (Vendor ID 64179) ──
          // Cryptsk-Session-Timeout: mirrors Session-Timeout (integer, seconds)
          const sessionTimeoutSec = input.sessionTimeoutMinutes ? input.sessionTimeoutMinutes * 60 : 0;
          if (sessionTimeoutSec > 0) {
            replies.push({ attribute: 'Cryptsk-Session-Timeout', value: String(sessionTimeoutSec) });
          }

          // Cryptsk-Idle-Timeout: idle timeout (integer, seconds) from plan or portal config
          if (effectiveIdleTimeout && effectiveIdleTimeout > 0) {
            replies.push({ attribute: 'Cryptsk-Idle-Timeout', value: String(effectiveIdleTimeout) });
          }

          // Cryptsk-User-Profile: plan group name (string) — for policy matching
          replies.push({ attribute: 'Cryptsk-User-Profile', value: groupName });

          // Cryptsk-Plan-Name: human-readable plan name (string) — for display/audit
          replies.push({ attribute: 'Cryptsk-Plan-Name', value: input.planName || groupName });

          // Cryptsk-Max-Sessions: already handled via Simultaneous-Use in radcheck (step 5 below)

          // Create all replies
          for (const reply of replies) {
            await tx.radReply.create({
              data: {
                wifiUserId: wifiUser.id,
                username,
                attribute: reply.attribute,
                op: ':=',
                value: reply.value,
                isActive: true,
              },
            });
          }

          // 4. Create RadUserGroup — maps username to plan group
          // FreeRADIUS uses this to load group-level attributes from radgroupcheck/radgroupreply
          await tx.radUserGroup.create({
            data: {
              username,
              groupname: groupName,
              priority: 0,
            },
          });

          // 5. Set Simultaneous-Use if sessionLimit is specified (max concurrent sessions)
          // This goes in radcheck (not radreply) because it's an access check
          if (input.sessionLimit && input.sessionLimit > 0) {
            await tx.radCheck.create({
              data: {
                wifiUserId: wifiUser.id,
                username,
                attribute: 'Simultaneous-Use',
                op: ':=',
                value: String(input.sessionLimit),
                isActive: true,
              },
            });
          }

          console.log(`[WiFi Provisioning] User ${username} created in shared DB (booking: ${input.bookingId || 'manual'}, group: ${groupName})`);

          return {
            wifiUser,
            credentials: {
              username,
              password,
              validFrom: input.validFrom,
              validUntil: input.validUntil,
            },
            groupName,
          };
        });
      } catch (error: unknown) {
        // Check for Prisma unique constraint violation (P2002)
        const isUniqueViolation = (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code: string }).code === PRISMA_UNIQUE_VIOLATION
        );

        if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
          console.warn(`[WiFi Provisioning] Username collision on attempt ${attempt + 1}, retrying with fresh random bytes...`);
          lastError = error as Error;
          continue; // retry with fresh randomBytes in next iteration
        }
        throw error; // re-throw if not a unique violation or max retries exhausted
      }
    }

    throw lastError || new Error('Failed to provision user after retries');
  }

  /**
   * Update WiFi user
   */
  async updateUser(userId: string, input: WiFiUserUpdateInput) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Bug 10 Fix: Explicitly map each field instead of spreading raw input
      const updated = await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
          ...(input.downloadSpeed !== undefined && { /* downloadSpeed stored in RadReply, not WiFiUser */ }),
          ...(input.uploadSpeed !== undefined && { /* uploadSpeed stored in RadReply, not WiFiUser */ }),
          ...(input.sessionTimeoutMinutes !== undefined && { /* sessionTimeout stored in RadReply, not WiFiUser */ }),
          ...(input.idleTimeoutSeconds !== undefined && { /* idleTimeout stored in RadReply, not WiFiUser */ }),
          ...(input.sessionLimit !== undefined && { /* sessionLimit stored in RadCheck, not WiFiUser */ }),
          ...(input.dataLimit !== undefined && { /* dataLimit stored in RadReply, not WiFiUser */ }),
          ...(input.status !== undefined && { status: input.status }),
          radiusSynced: true,
          radiusSyncedAt: new Date(),
        },
      });

      // Update RadReply entries (same DB — changes are immediate)
      // Vendor-aware: delete ALL old bandwidth attrs, write new vendor-appropriate ones
      if (input.downloadSpeed || input.uploadSpeed) {
        const vendors = await getActiveNASVendors(wifiUser.propertyId);
        const downloadMbps = input.downloadSpeed ? input.downloadSpeed / 1000000 : 10;
        const uploadMbps = input.uploadSpeed ? input.uploadSpeed / 1000000 : 5;

        // Delete old bandwidth attributes (all known vendor names)
        for (const attr of BANDWIDTH_ATTRIBUTES) {
          await tx.radReply.deleteMany({ where: { username: wifiUser.username, attribute: attr } });
        }

        // Write new vendor-appropriate bandwidth attributes
        const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);
        for (const reply of bwAttrs) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: reply.attribute,
              op: ':=',
              value: reply.value,
              isActive: true,
            },
          });
        }
      }

      // Bug 1 Fix: Update data-limit RadReply attributes (mirrors the bandwidth update block)
      if (input.dataLimit !== undefined) {
        const vendors = await getActiveNASVendors(wifiUser.propertyId);

        // Delete old data-limit attributes (all known vendor names)
        for (const attr of DATA_LIMIT_ATTRIBUTES) {
          await tx.radReply.deleteMany({ where: { username: wifiUser.username, attribute: attr } });
        }

        // Write new vendor-appropriate data-limit attributes if dataLimit > 0
        if (input.dataLimit > 0) {
          const dataLimitAttrs = generateSessionAttributes(vendors, 0, input.dataLimit);
          for (const reply of dataLimitAttrs) {
            await tx.radReply.create({
              data: {
                wifiUserId: wifiUser.id,
                username: wifiUser.username,
                attribute: reply.attribute,
                op: ':=',
                value: reply.value,
                isActive: true,
              },
            });
          }
        }
      }

      // Update session timeout (from sessionTimeoutMinutes, not sessionLimit)
      if (input.sessionTimeoutMinutes !== undefined) {
        const existingTimeout = await tx.radReply.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Session-Timeout',
          },
        });

        if (existingTimeout) {
          if (input.sessionTimeoutMinutes > 0) {
            await tx.radReply.update({
              where: { id: existingTimeout.id },
              data: { value: String(input.sessionTimeoutMinutes * 60) },
            });
          } else {
            // Remove session timeout if set to 0
            await tx.radReply.delete({ where: { id: existingTimeout.id } });
          }
        } else if (input.sessionTimeoutMinutes > 0) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: 'Session-Timeout',
              op: ':=',
              value: String(input.sessionTimeoutMinutes * 60),
              isActive: true,
            },
          });
        }

        // Also update Cryptsk-Session-Timeout
        const existingCryptskTimeout = await tx.radReply.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Cryptsk-Session-Timeout',
          },
        });

        if (existingCryptskTimeout) {
          if (input.sessionTimeoutMinutes > 0) {
            await tx.radReply.update({
              where: { id: existingCryptskTimeout.id },
              data: { value: String(input.sessionTimeoutMinutes * 60) },
            });
          } else {
            await tx.radReply.delete({ where: { id: existingCryptskTimeout.id } });
          }
        } else if (input.sessionTimeoutMinutes > 0) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: 'Cryptsk-Session-Timeout',
              op: ':=',
              value: String(input.sessionTimeoutMinutes * 60),
              isActive: true,
            },
          });
        }
      }

      // Update Cryptsk-Idle-Timeout if idleTimeoutSeconds changed
      if (input.idleTimeoutSeconds !== undefined) {
        const existingIdleTimeout = await tx.radReply.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Cryptsk-Idle-Timeout',
          },
        });

        if (input.idleTimeoutSeconds > 0) {
          if (existingIdleTimeout) {
            await tx.radReply.update({
              where: { id: existingIdleTimeout.id },
              data: { value: String(input.idleTimeoutSeconds) },
            });
          } else {
            await tx.radReply.create({
              data: {
                wifiUserId: wifiUser.id,
                username: wifiUser.username,
                attribute: 'Cryptsk-Idle-Timeout',
                op: ':=',
                value: String(input.idleTimeoutSeconds),
                isActive: true,
              },
            });
          }
        } else if (existingIdleTimeout) {
          // Remove idle timeout if set to 0
          await tx.radReply.delete({ where: { id: existingIdleTimeout.id } });
        }
      }

      // Update Simultaneous-Use (max concurrent sessions) if sessionLimit changed
      if (input.sessionLimit !== undefined) {
        const existingSimUse = await tx.radCheck.findFirst({
          where: {
            username: wifiUser.username,
            attribute: 'Simultaneous-Use',
          },
        });

        if (input.sessionLimit > 0) {
          if (existingSimUse) {
            await tx.radCheck.update({
              where: { id: existingSimUse.id },
              data: { value: String(input.sessionLimit) },
            });
          } else {
            await tx.radCheck.create({
              data: {
                wifiUserId: wifiUser.id,
                username: wifiUser.username,
                attribute: 'Simultaneous-Use',
                op: ':=',
                value: String(input.sessionLimit),
                isActive: true,
              },
            });
          }
        } else if (existingSimUse) {
          // Remove Simultaneous-Use if set to 0/undefined
          await tx.radCheck.delete({ where: { id: existingSimUse.id } });
        }
      }

      return updated;
    });
  }

  /**
   * Deprovision (disable) WiFi user
   * This is called on checkout or cancellation.
   *
   * IMPORTANT: Uses HARD DELETE on RadCheck/RadReply instead of soft-delete (isActive=false).
   * FreeRADIUS queries no longer filter by isActive — they simply check if the record exists.
   * This allows guests to disconnect/reconnect from hotspot without issues.
   * The WiFiUser record is preserved for audit purposes (status = 'revoked').
   */
  async deprovisionUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update user status (preserves audit trail)
      // Bug 9 Fix: Set radiusSynced: true since deletion IS the synced state (same DB architecture)
      await tx.wiFiUser.update({
        where: { id: userId },
        data: {
          status: 'revoked',
          radiusSynced: true,
          radiusSyncedAt: new Date(),
        },
      });

      // HARD DELETE RADIUS credentials — FreeRADIUS will return 'User not found'
      await tx.radCheck.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radReply.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radUserGroup.deleteMany({
        where: { username: wifiUser.username },
      });

      console.log(`[WiFi Provisioning] User ${wifiUser.username} deprovisioned (credentials deleted, status: revoked)`);

      return { success: true };
    });
  }

  /**
   * Suspend WiFi user (temporary)
   * Uses HARD DELETE on RadCheck — on resume, credentials will be re-created.
   */
  async suspendUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: { status: 'suspended', radiusSynced: false },
      });

      // DELETE RADIUS credentials to prevent authentication
      await tx.radCheck.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radReply.deleteMany({
        where: { username: wifiUser.username },
      });

      await tx.radUserGroup.deleteMany({
        where: { username: wifiUser.username },
      });

      return { success: true };
    });
  }

  /**
   * Resume suspended WiFi user
   * Re-creates RadCheck/RadReply credentials from WiFiUser.password and WiFiPlan.
   */
  async resumeUser(userId: string) {
    return db.$transaction(async (tx) => {
      const wifiUser = await tx.wiFiUser.findUnique({
        where: { id: userId },
        include: { plan: true },
      });

      if (!wifiUser) {
        throw new Error('WiFi user not found');
      }

      // Update status
      await tx.wiFiUser.update({
        where: { id: userId },
        data: { status: 'active', radiusSynced: true, radiusSyncedAt: new Date() },
      });

      // Re-create RadCheck (password) if not exists
      const existingCheck = await tx.radCheck.findFirst({
        where: { username: wifiUser.username },
      });
      if (!existingCheck) {
        await tx.radCheck.create({
          data: {
            wifiUserId: wifiUser.id,
            username: wifiUser.username,
            attribute: 'Cleartext-Password',
            op: ':=',
            value: wifiUser.password,
            isActive: true,
          },
        });
      }

      // Bug 3 Fix: Re-create the FULL set of RadReply attributes from the user's plan
      // (previously only recreated password + bandwidth, missing most attributes)
      const existingReplyCount = await tx.radReply.count({
        where: { username: wifiUser.username },
      });
      if (existingReplyCount === 0) {
        const vendors = await getActiveNASVendors(wifiUser.propertyId);

        // Resolve plan group name and defaults
        let groupName = 'standard-guests';
        let downloadMbps = 10;
        let uploadMbps = 5;
        let sessionTimeoutMin = 0;
        let idleTimeoutSec = 0;
        let dataLimitMB = 0;
        let sessionLimit = 0;
        let planName = groupName;

        if (wifiUser.plan) {
          // Convert plan name to a RADIUS-safe group name (lowercase, underscores)
          groupName = wifiUser.plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
          planName = wifiUser.plan.name;
          downloadMbps = wifiUser.plan.downloadSpeed || 10;
          uploadMbps = wifiUser.plan.uploadSpeed || 5;
          sessionTimeoutMin = wifiUser.plan.sessionTimeoutSec ? Math.floor(wifiUser.plan.sessionTimeoutSec / 60) : 0;
          idleTimeoutSec = wifiUser.plan.idleTimeoutSec || 0;
          dataLimitMB = wifiUser.plan.dataLimit || 0;
          sessionLimit = wifiUser.plan.sessionLimit || 0;
        }

        // Generate vendor-aware attributes
        const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);
        const sessionAttrs = generateSessionAttributes(vendors, sessionTimeoutMin, dataLimitMB);
        const replies = [...bwAttrs, ...sessionAttrs];

        // Cryptsk-Session-Timeout
        const sessionTimeoutSec = sessionTimeoutMin * 60;
        if (sessionTimeoutSec > 0) {
          replies.push({ attribute: 'Cryptsk-Session-Timeout', value: String(sessionTimeoutSec) });
        }

        // Cryptsk-Idle-Timeout
        if (idleTimeoutSec > 0) {
          replies.push({ attribute: 'Cryptsk-Idle-Timeout', value: String(idleTimeoutSec) });
        }

        // Cryptsk-User-Profile: plan group name
        replies.push({ attribute: 'Cryptsk-User-Profile', value: groupName });

        // Cryptsk-Plan-Name: human-readable plan name
        replies.push({ attribute: 'Cryptsk-Plan-Name', value: planName });

        // Bug 2 Fix: Use op: ':=' (not '=') to match provisionUser behavior
        for (const reply of replies) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser.id,
              username: wifiUser.username,
              attribute: reply.attribute,
              op: ':=',
              value: reply.value,
              isActive: true,
            },
          });
        }

        // Re-create Simultaneous-Use in RadCheck if the plan specifies it
        if (sessionLimit > 0) {
          const existingSimUse = await tx.radCheck.findFirst({
            where: {
              username: wifiUser.username,
              attribute: 'Simultaneous-Use',
            },
          });
          if (!existingSimUse) {
            await tx.radCheck.create({
              data: {
                wifiUserId: wifiUser.id,
                username: wifiUser.username,
                attribute: 'Simultaneous-Use',
                op: ':=',
                value: String(sessionLimit),
                isActive: true,
              },
            });
          }
        }
      }

      // Re-create RadUserGroup if not exists
      const existingGroup = await tx.radUserGroup.findFirst({
        where: { username: wifiUser.username },
      });
      if (!existingGroup) {
        const groupName = wifiUser.plan
          ? wifiUser.plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests'
          : 'standard-guests';
        await tx.radUserGroup.create({
          data: { username: wifiUser.username, groupname: groupName, priority: 0 },
        });
      }

      return { success: true };
    });
  }

  /**
   * Get WiFi user by booking ID
   * Returns the most recent active WiFi user (skips revoked/expired)
   */
  async getUserByBooking(bookingId: string) {
    return db.wiFiUser.findFirst({
      where: { bookingId, status: { in: ['active', 'suspended'] } },
      include: {
        radCheck: { where: { isActive: true } },
        radReply: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get WiFi user by guest ID
   */
  async getUsersByGuest(guestId: string) {
    return db.wiFiUser.findMany({
      where: { guestId },
      include: {
        radCheck: { where: { isActive: true } },
        radReply: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Enforce simultaneous use limit for a user
   * Adds a Simultaneous-Use check attribute in RadCheck
   */
  async enforceSimultaneousUse(username: string, maxSessions: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if Simultaneous-Use already exists for this user
      const existing = await db.radCheck.findFirst({
        where: {
          username,
          attribute: 'Simultaneous-Use',
          isActive: true,
        },
      });

      if (existing) {
        // Update existing
        await db.radCheck.update({
          where: { id: existing.id },
          data: { value: String(maxSessions) },
        });
      } else {
        // Create new
        const wifiUser = await db.wiFiUser.findUnique({ where: { username } });
        await db.radCheck.create({
          data: {
            wifiUserId: wifiUser?.id,
            username,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: String(maxSessions),
            isActive: true,
          },
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enforce simultaneous use',
      };
    }
  }

  /**
   * Get data cap status for a user
   * Fetches from accounting API to check usage vs cap
   */
  async getDataCapStatus(username: string): Promise<{
    username: string;
    totalBytesIn: number;
    totalBytesOut: number;
    totalBytes: number;
    dataLimitBytes: number;
    usagePercent: number;
    isOverCap: boolean;
    isApproachingCap: boolean; // > 80%
    activeSessions: number;
  }> {
    // Get user's data limit from RadReply (vendor-agnostic — checks all known data-limit attrs)
    const allReplies = await db.radReply.findMany({
      where: { username, isActive: true },
    });
    const attrsMap: Record<string, string> = {};
    for (const r of allReplies) {
      attrsMap[r.attribute] = r.value;
    }
    const dataLimitBytes = readDataLimitBytes(attrsMap) || 0;

    // Get usage from accounting
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let activeSessions = 0;

    try {
      const result = await freeradiusRequest(`/api/accounting?username=${encodeURIComponent(username)}&limit=100`);
      if (result && result.sessions) {
        for (const session of result.sessions) {
          totalBytesIn += Number(session.acctInputOctets || session.inputOctets || 0);
          totalBytesOut += Number(session.acctOutputOctets || session.outputOctets || 0);
          if (!session.acctStopTime) {
            activeSessions++;
          }
        }
      }
    } catch {
      // Fallback: check RadAcct table directly
      const acctRecords = await db.radAcct.findMany({
        where: { username },
      });
      for (const record of acctRecords) {
        totalBytesIn += record.acctinputoctets;
        totalBytesOut += record.acctoutputoctets;
        if (!record.acctstoptime) {
          activeSessions++;
        }
      }
    }

    const totalBytes = totalBytesIn + totalBytesOut;
    // dataLimitBytes = 0 means unlimited — never over cap
    const isUnlimited = dataLimitBytes <= 0;
    const usagePercent = isUnlimited ? 0 : (totalBytes / dataLimitBytes) * 100;

    return {
      username,
      totalBytesIn,
      totalBytesOut,
      totalBytes,
      dataLimitBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isOverCap: isUnlimited ? false : totalBytes >= dataLimitBytes,
      isApproachingCap: isUnlimited ? false : usagePercent >= 80,
      activeSessions,
    };
  }

  /**
   * Disconnect a user's active session via CoA
   * Routes through freeradius-service API (radclient CLI)
   */
  async disconnectUser(username: string, sessionId?: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // If no sessionId provided, find the active one from accounting
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const result = await freeradiusRequest(`/api/accounting?username=${encodeURIComponent(username)}&status=active&limit=1`);
        if (result?.sessions?.length > 0) {
          targetSessionId = result.sessions[0].acctSessionId || result.sessions[0].sessionId;
        }
      }

      if (!targetSessionId) {
        return {
          success: false,
          error: 'No active session found for user',
        };
      }

      const result = await freeradiusRequest('/api/coa/disconnect', {
        method: 'POST',
        body: JSON.stringify({ username, sessionId: targetSessionId }),
      });

      return {
        success: result.success !== false,
        message: result.message || 'Disconnect sent',
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      };
    }
  }

  /**
   * Change a user's bandwidth via CoA
   * Routes through freeradius-service API (radclient CLI)
   */
  async changeUserBandwidth(
    username: string,
    downloadMbps: number,
    uploadMbps: number
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Update RadReply for persistent change
      const downloadBps = downloadMbps * 1000000;
      const uploadBps = uploadMbps * 1000000;

      // Vendor-aware: delete ALL old bandwidth attrs, write new vendor-appropriate ones
      const wifiUser = await db.wiFiUser.findUnique({ where: { username } });
      const vendors = wifiUser ? await getActiveNASVendors(wifiUser.propertyId) : ['other' as const];
      const bwAttrs = generateBandwidthAttributes(vendors, downloadMbps, uploadMbps);

      await db.$transaction(async (tx) => {
        // Delete all known bandwidth attributes
        for (const attr of BANDWIDTH_ATTRIBUTES) {
          await tx.radReply.deleteMany({ where: { username, attribute: attr } });
        }
        // Bug 5 Fix: Set wifiUserId on new RadReply entries
        for (const reply of bwAttrs) {
          await tx.radReply.create({
            data: {
              wifiUserId: wifiUser?.id,
              username,
              attribute: reply.attribute,
              op: ':=',
              value: reply.value,
              isActive: true,
            },
          });
        }
      });

      // Send CoA to apply immediately to active session
      const result = await freeradiusRequest('/api/coa/bandwidth', {
        method: 'POST',
        body: JSON.stringify({
          username,
          downloadMbps,
          uploadMbps,
        }),
      });

      return {
        success: true,
        message: `Bandwidth updated to ${downloadMbps}M/${uploadMbps}M`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bandwidth change failed',
      };
    }
  }

  /**
   * Bulk create event WiFi users
   * Creates multiple RADIUS users for event attendees
   */
  async createEventUsers(params: {
    eventId: string;
    eventName: string;
    count: number;
    bandwidthDown: number; // Mbps
    bandwidthUp: number;   // Mbps
    dataLimitMb?: number;
    validHours?: number;
    propertyId: string;
    tenantId: string;
  }): Promise<{
    success: boolean;
    created: number;
    failed: number;
    // Bug 11 Fix: Correct array nesting — was Array<...>[] (array of arrays)
    users?: Array<{ username: string; password: string }>;
    error?: string;
  }> {
    const {
      tenantId, propertyId, eventId, eventName, count,
      bandwidthDown, bandwidthUp, dataLimitMb = 512, validHours = 24,
    } = params;

    const results: Array<{ username: string; password: string }> = [];
    let created = 0;
    let failed = 0;

    const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000);
    const downloadSpeed = bandwidthDown * 1000000; // Mbps to bps
    const uploadSpeed = bandwidthUp * 1000000;

    // Bug 12 Fix: Process in parallel batches of 10 instead of sequentially
    const BATCH_SIZE = 10;
    const batchPromises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const username = `evt_${eventId.slice(-6)}_${String(i + 1).padStart(3, '0')}`;
      const password = this.generatePassword(6);

      const promise = this.provisionUser({
        tenantId,
        propertyId,
        username,
        password,
        validFrom: new Date(),
        validUntil,
        userType: 'guest',
        downloadSpeed,
        uploadSpeed,
        dataLimit: dataLimitMb,
      })
        .then(() => {
          results.push({ username, password });
          created++;
        })
        .catch(() => {
          failed++;
        });

      batchPromises.push(promise);

      // Execute in parallel batches
      if (batchPromises.length >= BATCH_SIZE || i === count - 1) {
        await Promise.all(batchPromises.splice(0));
      }
    }

    // Also create via backend for tracking
    try {
      await freeradiusRequest('/api/event-users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          eventName,
          count,
          propertyId,
          bandwidthDown,
          bandwidthUp,
          dataLimitMb,
          validHours,
          credentials: results,
        }),
      });
    } catch {
      // Best effort — credentials are already in the DB
    }

    return {
      success: created > 0,
      created,
      failed,
      users: results,
    };
  }

  /**
   * Revoke an event user and deprovision
   */
  async revokeEventUser(eventUserId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Revoke via backend API
      const result = await freeradiusRequest(`/api/event-users/${encodeURIComponent(eventUserId)}/revoke`, {
        method: 'POST',
      });

      return {
        success: result.success !== false,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Revoke failed',
      };
    }
  }

  /**
   * Add a MAC address for auto-authentication
   * Adds to the MAC authentication whitelist
   */
  async addMacAuth(params: {
    propertyId: string;
    macAddress: string;
    username?: string;
    guestId?: string;
    description?: string;
  }): Promise<{
    success: boolean;
    macAuthId?: string;
    error?: string;
  }> {
    try {
      // Create via backend API
      const result = await freeradiusRequest('/api/mac-auth', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      return {
        success: result.success !== false,
        macAuthId: result.id,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add MAC auth',
      };
    }
  }

  /**
   * Remove a MAC address from auto-authentication whitelist
   */
  async removeMacAuth(macAuthId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(macAuthId)}`, {
        method: 'DELETE',
      });

      return {
        success: result.success !== false,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove MAC auth',
      };
    }
  }

  /**
   * Persist a provisioning log to the database
   * Used for audit trail of all WiFi provisioning operations.
   * Writes to RadiusProvisioningLog table (NOT AuditLog).
   */
  async logProvisioning(params: {
    action: string;
    username: string;
    propertyId: string;
    tenantId?: string;
    guestId?: string;
    bookingId?: string;
    userId?: string;
    result: 'success' | 'failed' | 'partial';
    details?: string;
    error?: string;
    durationMs?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const logEntry = await db.radiusProvisioningLog.create({
        data: {
          propertyId: params.propertyId,
          action: params.action,
          username: params.username,
          guestId: params.guestId || null,
          bookingId: params.bookingId || null,
          userId: params.userId || null,
          result: params.result,
          details: params.details || null,
          error: params.error || null,
          durationMs: params.durationMs || null,
        },
      });

      console.log(`[WiFi Provisioning Log] ${params.action}: ${params.username} - ${params.result}${params.error ? ` (${params.error})` : ''}`);

      return { success: true, id: logEntry.id };
    } catch (error) {
      console.error('[WiFi Provisioning Log] Failed to persist log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to persist provisioning log',
      };
    }
  }

  /**
   * Generate username
   * Format: guest_{property_code}_{random}
   */
  private generateUsername(propertyId: string): string {
    const random = randomBytes(4).toString('hex');
    return `guest_${propertyId.slice(-4)}_${random}`;
  }

  /**
   * Generate random password
   * Bug 8 Fix: Use crypto.randomInt instead of modulo to avoid modulo bias
   */
  private generatePassword(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      const idx = randomInt(chars.length);
      password += chars[idx];
    }
    return password;
  }
}

// Singleton instance
export const wifiUserService = new WiFiUserService();
