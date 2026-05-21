/**
 * LDAP/Active Directory Integration Service
 *
 * Real LDAP authentication implementation using ldapjs.
 * Handles:
 * - LDAP bind authentication (admin + user)
 * - User search under baseDN
 * - Connection timeouts and error handling
 * - Proper LDAP connection cleanup
 * - Active Directory integration
 * - Multi-domain LDAP support
 */

import { db } from '@/lib/db';

// LDAP Configuration types
export interface LDAPConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  searchFilter: string;
  useStartTls: boolean;
  useSsl: boolean;
  timeout: number;
}

export interface LDAPUser {
  dn: string;
  cn: string;
  sn?: string;
  givenName?: string;
  displayName?: string;
  mail: string;
  sAMAccountName?: string;
  userPrincipalName?: string;
  memberOf?: string[];
  telephoneNumber?: string;
  department?: string;
  title?: string;
  employeeId?: string;
  distinguishedName: string;
  objectClass: string[];
  attributes: Record<string, string | string[]>;
}

export interface LDAPAuthResult {
  success: boolean;
  user?: LDAPUser;
  error?: string;
}

export interface LDAPTestResult {
  success: boolean;
  message: string;
  details?: {
    serverReachable: boolean;
    bindSuccessful: boolean;
    searchSuccessful: boolean;
    userCount?: number;
    error?: string;
  };
}

// Lazy-import ldapjs to avoid issues in environments where it's not available
let ldapjs: typeof import('ldapjs') | null = null;

async function getLdapjs() {
  if (!ldapjs) {
    try {
      ldapjs = await import('ldapjs');
    } catch {
      throw new Error('ldapjs package is not installed. Run: bun add ldapjs');
    }
  }
  return ldapjs;
}

export class LDAPService {
  /**
   * Authenticate user against LDAP/AD
   */
  static async authenticate(
    connectionId: string,
    username: string,
    password: string,
    tenantId: string
  ): Promise<LDAPAuthResult> {
    try {
      const connection = await db.sSOConnection.findFirst({
        where: { id: connectionId, tenantId, type: 'ldap', status: 'active' },
      });

      if (!connection) {
        return { success: false, error: 'LDAP connection not found or inactive' };
      }

      if (!connection.ldapUrl || !connection.ldapBaseDn) {
        return { success: false, error: 'LDAP configuration incomplete' };
      }

      const config: LDAPConfig = {
        url: connection.ldapUrl,
        baseDn: connection.ldapBaseDn,
        bindDn: connection.ldapBindDn || '',
        bindPassword: connection.ldapBindPassword || '',
        searchFilter: connection.ldapSearchFilter || '(mail={email})',
        useStartTls: connection.ldapUseStartTls,
        useSsl: connection.ldapUseSsl,
        timeout: connection.ldapTimeout || 30,
      };

      // Perform real LDAP authentication
      const result = await this.performLdapAuth(config, username, password);

      if (result.success) {
        // Update connection status
        await db.sSOConnection.update({
          where: { id: connectionId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
          },
        });
      }

      return result;
    } catch (error) {
      console.error('LDAP authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Perform actual LDAP authentication using ldapjs.
   *
   * Flow:
   * 1. Connect to LDAP server
   * 2. Bind with admin credentials
   * 3. Search for user by username/email under baseDN
   * 4. Disconnect admin client
   * 5. Bind with user's DN + provided password
   * 6. Return user attributes
   */
  private static async performLdapAuth(
    config: LDAPConfig,
    username: string,
    password: string
  ): Promise<LDAPAuthResult> {
    const ldap = await getLdapjs();
    let client: InstanceType<typeof ldap.Client> | null = null;
    let userClient: InstanceType<typeof ldap.Client> | null = null;

    try {
      // Step 1: Create and connect admin client
      client = ldap.createClient({
        url: config.url,
        connectTimeout: config.timeout * 1000,
        timeout: config.timeout * 1000,
        tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
      });

      // Step 2: Bind with admin/service account credentials
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`LDAP bind timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.bind(config.bindDn, config.bindPassword, (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(new Error(`Admin bind failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });

      // Step 3: Build search filter and search for the user
      const searchFilter = config.searchFilter
        .replace('{email}', username)
        .replace('{username}', username)
        .replace('{userPrincipalName}', username)
        .replace('{sAMAccountName}', username);

      const searchBase = config.baseDn;

      // Step 4: Perform the search
      const searchEntries: ldap.SearchEntry[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`LDAP search timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.search(
          searchBase,
          {
            filter: searchFilter,
            scope: 'sub',
            attributes: ['*', '+', 'memberOf'],
            sizeLimit: 10,
          },
          (err, res) => {
            if (err) {
              clearTimeout(timeout);
              reject(new Error(`LDAP search failed: ${err.message}`));
              return;
            }

            res.on('searchEntry', (entry) => {
              searchEntries.push(entry);
            });

            res.on('error', (err) => {
              clearTimeout(timeout);
              reject(new Error(`LDAP search error: ${err.message}`));
            });

            res.on('end', () => {
              clearTimeout(timeout);
              resolve();
            });
          }
        );
      });

      if (searchEntries.length === 0) {
        return { success: false, error: 'User not found in LDAP directory' };
      }

      // Take the first search result
      const entry = searchEntries[0];
      const userDn = entry.dn.toString();
      const rawAttributes = entry.attributes;

      // Convert attributes to a usable format
      const attributes: Record<string, string | string[]> = {};
      for (const attr of rawAttributes) {
        const vals = attr.vals as Buffer[];
        if (vals.length === 1) {
          attributes[attr.type] = vals[0].toString('utf8');
        } else if (vals.length > 1) {
          attributes[attr.type] = vals.map(v => v.toString('utf8'));
        }
      }

      // Step 5: Disconnect admin client before user bind
      try {
        await new Promise<void>((resolve) => {
          client!.unbind(() => resolve());
        });
      } catch {
        // Ignore unbind errors
      }
      client = null;

      // Step 6: Bind as the user with their password to verify credentials
      userClient = ldap.createClient({
        url: config.url,
        connectTimeout: config.timeout * 1000,
        timeout: config.timeout * 1000,
        tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`User bind timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        userClient!.bind(userDn, password, (err) => {
          clearTimeout(timeout);
          if (err) {
            const ldapErr = err as Error & { name?: string };
            if (ldapErr.name === 'InvalidCredentialsError' || err.message.includes('invalid credentials')) {
              reject(new Error('Invalid credentials'));
            } else {
              reject(new Error(`User bind failed: ${err.message}`));
            }
          } else {
            resolve();
          }
        });
      });

      // Clean up user client
      try {
        await new Promise<void>((resolve) => {
          userClient!.unbind(() => resolve());
        });
      } catch {
        // Ignore unbind errors
      }
      userClient = null;

      // Build LDAPUser from search result
      const memberOf = (attributes.memberOf as string[]) || [];
      const objectClass = (attributes.objectClass as string[]) || ['top'];

      const ldapUser: LDAPUser = {
        dn: userDn,
        cn: (attributes.cn as string) || username,
        sn: (attributes.sn as string) || undefined,
        givenName: (attributes.givenName as string) || (attributes.givenname as string) || undefined,
        displayName: (attributes.displayName as string) || (attributes.displayname as string) || undefined,
        mail: (attributes.mail as string) || '',
        sAMAccountName: (attributes.sAMAccountName as string) || (attributes.samaccountname as string) || undefined,
        userPrincipalName: (attributes.userPrincipalName as string) || (attributes.userprincipalname as string) || undefined,
        memberOf: Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : [],
        telephoneNumber: (attributes.telephoneNumber as string) || (attributes.telephonenumber as string) || undefined,
        department: (attributes.department as string) || undefined,
        title: (attributes.title as string) || undefined,
        employeeId: (attributes.employeeId as string) || (attributes.employeeid as string) || undefined,
        distinguishedName: (attributes.distinguishedName as string) || (attributes.dn as string) || userDn,
        objectClass,
        attributes,
      };

      return { success: true, user: ldapUser };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LDAP operation failed',
      };
    } finally {
      // Ensure all LDAP connections are properly closed
      const closeClient = async (c: InstanceType<typeof ldap.Client> | null) => {
        if (!c) return;
        try {
          await new Promise<void>((resolve) => {
            c.unbind(() => resolve());
          });
        } catch {
          // Best-effort close
        }
        try {
          c.destroy();
        } catch {
          // Ignore
        }
      };
      await closeClient(client);
      await closeClient(userClient);
    }
  }

  /**
   * Test LDAP connection with real server connectivity check
   */
  static async testConnection(config: LDAPConfig): Promise<LDAPTestResult> {
    const ldap = await getLdapjs();
    let client: InstanceType<typeof ldap.Client> | null = null;

    const details = {
      serverReachable: false,
      bindSuccessful: false,
      searchSuccessful: false,
      userCount: 0,
      error: undefined as string | undefined,
    };

    try {
      // Step 1: Create client and connect
      client = ldap.createClient({
        url: config.url,
        connectTimeout: config.timeout * 1000,
        timeout: config.timeout * 1000,
        tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        client!.on('connectError', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Connection error: ${err.message}`));
        });

        client!.on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Connection error: ${err.message}`));
        });
      });

      details.serverReachable = true;

      // Step 2: Bind with service account
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Bind timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.bind(config.bindDn, config.bindPassword, (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(new Error(`Bind failed: ${err.message}`));
          } else {
            details.bindSuccessful = true;
            resolve();
          }
        });
      });

      // Step 3: Test search
      const searchEntries: ldap.SearchEntry[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Search timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.search(
          config.baseDn,
          {
            filter: '(objectClass=user)',
            scope: 'sub',
            attributes: ['dn'],
            sizeLimit: 1,
          },
          (err, res) => {
            if (err) {
              clearTimeout(timeout);
              reject(new Error(`Search failed: ${err.message}`));
              return;
            }

            res.on('searchEntry', (entry) => {
              searchEntries.push(entry);
            });

            res.on('error', (err) => {
              clearTimeout(timeout);
              reject(new Error(`Search error: ${err.message}`));
            });

            res.on('end', (result) => {
              clearTimeout(timeout);
              details.searchSuccessful = true;
              details.userCount = searchEntries.length;
              resolve();
            });
          }
        );
      });

      // Cleanup
      try {
        await new Promise<void>((resolve) => {
          client!.unbind(() => resolve());
        });
      } catch {
        // Ignore
      }
      client = null;

      if (!details.serverReachable) {
        return {
          success: false,
          message: 'Cannot connect to LDAP server',
          details,
        };
      }

      if (!details.bindSuccessful) {
        return {
          success: false,
          message: 'Service account bind failed - check bind DN and password',
          details,
        };
      }

      if (!details.searchSuccessful) {
        return {
          success: false,
          message: 'LDAP search failed - check base DN',
          details,
        };
      }

      return {
        success: true,
        message: 'LDAP connection successful',
        details,
      };
    } catch (error) {
      details.error = error instanceof Error ? error.message : 'Unknown error';

      // Best-effort cleanup
      if (client) {
        try {
          await new Promise<void>((resolve) => {
            client!.unbind(() => resolve());
          });
        } catch {
          // Ignore
        }
        try {
          client.destroy();
        } catch {
          // Ignore
        }
      }

      return {
        success: false,
        message: `LDAP connection failed: ${details.error}`,
        details,
      };
    }
  }

  /**
   * Test LDAP connection by connectionId
   */
  static async testConnectionById(connectionId: string, tenantId: string): Promise<LDAPTestResult> {
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'ldap' },
    });

    if (!connection) {
      return {
        success: false,
        message: 'LDAP connection not found',
      };
    }

    const config: LDAPConfig = {
      url: connection.ldapUrl || '',
      baseDn: connection.ldapBaseDn || '',
      bindDn: connection.ldapBindDn || '',
      bindPassword: connection.ldapBindPassword || '',
      searchFilter: connection.ldapSearchFilter || '(mail={email})',
      useStartTls: connection.ldapUseStartTls,
      useSsl: connection.ldapUseSsl,
      timeout: connection.ldapTimeout || 30,
    };

    const result = await this.testConnection(config);

    // Update connection test status
    await db.sSOConnection.update({
      where: { id: connectionId },
      data: {
        testConnectionAt: new Date(),
        testConnectionStatus: result.success ? 'success' : 'failed',
      },
    });

    return result;
  }

  /**
   * Extract domain from DN
   */
  private static extractDomain(dn: string): string {
    const dcMatch = dn.match(/dc=([^,]+)/gi);
    if (dcMatch) {
      const domains = dcMatch.map(m => m.replace('dc=', ''));
      return domains.join('.');
    }
    return 'example.com';
  }

  /**
   * Map LDAP user to application user attributes
   */
  static mapUserAttributes(
    ldapUser: LDAPUser,
    connection: {
      emailAttribute: string;
      firstNameAttribute: string;
      lastNameAttribute: string;
      nameAttribute?: string | null;
      roleAttribute?: string | null;
      departmentAttribute?: string | null;
      phoneAttribute?: string | null;
    }
  ): {
    email: string;
    firstName: string;
    lastName: string;
    name: string;
    role?: string;
    department?: string;
    phone?: string;
  } {
    const getAttr = (name: string): string => {
      const value = ldapUser.attributes[name] || (ldapUser as unknown as Record<string, unknown>)[name];
      if (Array.isArray(value)) return value[0] || '';
      return typeof value === 'string' ? value : '';
    };

    return {
      email: getAttr(connection.emailAttribute) || ldapUser.mail,
      firstName: getAttr(connection.firstNameAttribute) || ldapUser.givenName || '',
      lastName: getAttr(connection.lastNameAttribute) || ldapUser.sn || '',
      name: connection.nameAttribute
        ? getAttr(connection.nameAttribute)
        : ldapUser.displayName || `${ldapUser.givenName || ''} ${ldapUser.sn || ''}`.trim(),
      role: connection.roleAttribute ? getAttr(connection.roleAttribute) : undefined,
      department: connection.departmentAttribute
        ? getAttr(connection.departmentAttribute)
        : ldapUser.department,
      phone: connection.phoneAttribute
        ? getAttr(connection.phoneAttribute)
        : ldapUser.telephoneNumber,
    };
  }

  /**
   * Search for users in LDAP using real LDAP search
   */
  static async searchUsers(
    connectionId: string,
    tenantId: string,
    searchTerm?: string
  ): Promise<LDAPUser[]> {
    const ldap = await getLdapjs();
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'ldap', status: 'active' },
    });

    if (!connection) {
      throw new Error('LDAP connection not found or inactive');
    }

    const config: LDAPConfig = {
      url: connection.ldapUrl || '',
      baseDn: connection.ldapBaseDn || '',
      bindDn: connection.ldapBindDn || '',
      bindPassword: connection.ldapBindPassword || '',
      searchFilter: connection.ldapSearchFilter || '(mail={email})',
      useStartTls: connection.ldapUseStartTls,
      useSsl: connection.ldapUseSsl,
      timeout: connection.ldapTimeout || 30,
    };

    let client: InstanceType<typeof ldap.Client> | null = null;
    const users: LDAPUser[] = [];

    try {
      client = ldap.createClient({
        url: config.url,
        connectTimeout: config.timeout * 1000,
        timeout: config.timeout * 1000,
        tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
      });

      // Bind with admin credentials
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Bind timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.bind(config.bindDn, config.bindPassword, (err) => {
          clearTimeout(timeout);
          if (err) reject(new Error(`Bind failed: ${err.message}`));
          else resolve();
        });
      });

      // Build search filter
      const filter = searchTerm
        ? `(|(cn=*${searchTerm}*)(mail=*${searchTerm}*)(sAMAccountName=*${searchTerm}*))`
        : '(objectClass=user)';

      // Search
      const searchEntries: ldap.SearchEntry[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Search timeout after ${config.timeout}s`));
        }, config.timeout * 1000);

        client!.search(
          config.baseDn,
          {
            filter,
            scope: 'sub',
            attributes: ['*', '+', 'memberOf'],
            sizeLimit: 50,
          },
          (err, res) => {
            if (err) {
              clearTimeout(timeout);
              reject(new Error(`Search failed: ${err.message}`));
              return;
            }

            res.on('searchEntry', (entry) => {
              searchEntries.push(entry);
            });

            res.on('error', (err) => {
              clearTimeout(timeout);
              reject(new Error(`Search error: ${err.message}`));
            });

            res.on('end', () => {
              clearTimeout(timeout);
              resolve();
            });
          }
        );
      });

      // Convert entries to LDAPUser objects
      for (const entry of searchEntries) {
        const attributes: Record<string, string | string[]> = {};
        for (const attr of entry.attributes) {
          const vals = attr.vals as Buffer[];
          if (vals.length === 1) {
            attributes[attr.type] = vals[0].toString('utf8');
          } else if (vals.length > 1) {
            attributes[attr.type] = vals.map(v => v.toString('utf8'));
          }
        }

        const memberOf = (attributes.memberOf as string[]) || [];
        users.push({
          dn: entry.dn.toString(),
          cn: (attributes.cn as string) || '',
          sn: (attributes.sn as string) || undefined,
          givenName: (attributes.givenName as string) || undefined,
          displayName: (attributes.displayName as string) || undefined,
          mail: (attributes.mail as string) || '',
          sAMAccountName: (attributes.sAMAccountName as string) || undefined,
          userPrincipalName: (attributes.userPrincipalName as string) || undefined,
          memberOf: Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : [],
          telephoneNumber: (attributes.telephoneNumber as string) || undefined,
          department: (attributes.department as string) || undefined,
          title: (attributes.title as string) || undefined,
          employeeId: (attributes.employeeId as string) || undefined,
          distinguishedName: (attributes.distinguishedName as string) || entry.dn.toString(),
          objectClass: (attributes.objectClass as string[]) || ['top'],
          attributes,
        });
      }

      return users;
    } finally {
      if (client) {
        try {
          await new Promise<void>((resolve) => {
            client!.unbind(() => resolve());
          });
        } catch {
          // Ignore
        }
        try {
          client.destroy();
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Sync users from LDAP
   */
  static async syncUsers(
    connectionId: string,
    tenantId: string,
    options?: {
      groupDn?: string;
      ou?: string;
    }
  ): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: string[];
  }> {
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'ldap', status: 'active' },
    });

    if (!connection) {
      throw new Error('LDAP connection not found or inactive');
    }

    // Use real search to get all users
    const ldapUsers = await this.searchUsers(connectionId, tenantId);

    const result = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const ldapUser of ldapUsers) {
      try {
        if (!ldapUser.mail) {
          result.errors.push(`User ${ldapUser.dn} has no email, skipping`);
          continue;
        }

        const mapped = this.mapUserAttributes(ldapUser, {
          emailAttribute: connection.emailAttribute,
          firstNameAttribute: connection.firstNameAttribute,
          lastNameAttribute: connection.lastNameAttribute,
          nameAttribute: connection.nameAttribute,
          roleAttribute: connection.roleAttribute,
          departmentAttribute: connection.departmentAttribute,
          phoneAttribute: connection.phoneAttribute,
        });

        if (!mapped.email) continue;

        // Try to find existing user by email
        const existing = await db.user.findFirst({
          where: { email: mapped.email.toLowerCase(), tenantId },
        });

        if (existing) {
          // Update existing user
          await db.user.update({
            where: { id: existing.id },
            data: {
              firstName: mapped.firstName || existing.firstName,
              lastName: mapped.lastName || existing.lastName,
            },
          });
          result.updated++;
        } else if (connection.autoProvision) {
          // Create new user
          const defaultRole = await db.role.findFirst({
            where: { tenantId, name: connection.autoProvisionRole || 'staff' },
          });

          await db.user.create({
            data: {
              email: mapped.email.toLowerCase(),
              firstName: mapped.firstName || 'LDAP',
              lastName: mapped.lastName || 'User',
              tenantId,
              roleId: defaultRole?.id || null,
              status: 'active',
              isVerified: true, // LDAP users are pre-verified
              // Use a pre-computed valid bcrypt hash for "password-required" — SSO users
              // authenticate via LDAP, not local password. Authentication logic should
              // check ssoProviderId to skip password verification for these users.
              passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36Kz2Vw6XpN6tV7tKV7FPCG', // bcrypt hash of "password-placeholder-ldap-sso"
              ssoProviderId: ldapUser.dn,
            },
          });
          result.created++;
        }

        result.synced++;
      } catch (err) {
        result.errors.push(`Error syncing ${ldapUser.dn}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Update connection sync status
    await db.sSOConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
      },
    });

    return result;
  }
}

export default LDAPService;
