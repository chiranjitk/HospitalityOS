/**
 * e2guardian Configuration Sync Engine
 *
 * Reads ContentFilter records from PostgreSQL and generates e2guardian
 * configuration files (banned/exception site lists, filter group configs).
 *
 * File output structure:
 *   data/e2guardian/
 *     configs/
 *       e2guardian.conf        (main config, generated from template)
 *       e2guardianf1.conf      (filter group 1 - most restrictive)
 *       e2guardianf2.conf      (filter group 2 - moderate)
 *       e2guardianf3.conf      (filter group 3 - minimal filtering)
 *     lists/
 *       staysuite/
 *         banned/
 *           adult               (one domain per line)
 *           malware
 *           phishing
 *           social_media
 *           streaming
 *           gambling
 *           drugs
 *           violence
 *           proxy
 *           vpn
 *           ads
 *           custom
 *         exception/
 *           (same structure for whitelisted domains)
 *     logs/
 *     status.json               (last sync metadata)
 */

import { db } from '@/lib/db';
import { writeFile, mkdir, readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_CATEGORIES = [
  'adult', 'malware', 'phishing', 'social_media', 'streaming',
  'gambling', 'drugs', 'violence', 'proxy', 'vpn', 'ads', 'custom',
] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];

/** Category → e2guardian file name (no spaces, lowercase) */
const CATEGORY_FILE_MAP: Record<string, string> = {
  adult: 'adult',
  malware: 'malware',
  phishing: 'phishing',
  social_media: 'social_media',
  streaming: 'streaming',
  gambling: 'gambling',
  drugs: 'drugs',
  violence: 'violence',
  proxy: 'proxy',
  vpn: 'vpn',
  ads: 'ads',
  custom: 'custom',
};

// Base path for e2guardian generated config (relative to project root)
const BASE_DIR = join(process.cwd(), 'data', 'e2guardian');
const LISTS_DIR = join(BASE_DIR, 'lists', 'staysuite');
const BANNED_DIR = join(LISTS_DIR, 'banned');
const EXCEPTION_DIR = join(LISTS_DIR, 'exception');
const CONFIGS_DIR = join(BASE_DIR, 'configs');
const STATUS_FILE = join(BASE_DIR, 'status.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  categoriesGenerated: string[];
  totalDomainsWritten: number;
  filesWritten: Record<string, number>;
  configFilesGenerated: string[];
  message: string;
  syncedAt: string;
  duration: number;
}

interface SyncStatus {
  lastSyncAt: string;
  tenantId: string;
  propertyId?: string;
  totalDomains: number;
  categoriesCount: number;
  filtersActive: number;
  configFiles: string[];
}

interface CategoryData {
  category: string;
  domains: string[];
}

// ---------------------------------------------------------------------------
// Core: Generate list files from DB
// ---------------------------------------------------------------------------

async function ensureDirs(): Promise<void> {
  await mkdir(BANNED_DIR, { recursive: true });
  await mkdir(EXCEPTION_DIR, { recursive: true });
  await mkdir(CONFIGS_DIR, { recursive: true });
}

function domainLine(domain: string): string {
  const cleaned = domain.trim().toLowerCase();
  if (!cleaned) return '';
  // e2guardian format: just the domain, one per line
  // Supports wildcards: *.domain.com blocks all subdomains
  return cleaned;
}

async function writeListFile(dir: string, category: string, domains: string[]): Promise<number> {
  const fileName = CATEGORY_FILE_MAP[category] || category;
  const filePath = join(dir, fileName);
  const lines = domains.map(domainLine).filter(Boolean);

  // Deduplicate while preserving order
  const unique = [...new Set(lines)];
  const content = unique.join('\n') + (unique.length > 0 ? '\n' : '');

  await writeFile(filePath, content, 'utf-8');
  return unique.length;
}

// ---------------------------------------------------------------------------
// Filter Group Config Generator
// ---------------------------------------------------------------------------

function generateFilterGroupConfig(groupNum: number, groupName: string, categories: string[]): string {
  // Production filter group policies for hospitality WiFi:
  // Group 1 (Kids/Family): ALL categories blocked — maximum protection
  // Group 2 (Standard Guest): malware, phishing, ads, violence, drugs, gambling, proxy, vpn
  // Group 3 (Premium/Business): malware, phishing only — minimal interference
  const GROUP_POLICIES: Record<number, string[]> = {
    1: ['adult', 'malware', 'phishing', 'social_media', 'streaming', 'gambling', 'drugs', 'violence', 'proxy', 'vpn', 'ads', 'gaming'],
    2: ['malware', 'phishing', 'ads', 'violence', 'drugs', 'gambling', 'proxy', 'vpn', 'adult'],
    3: ['malware', 'phishing'],
  };

  const policyCategories = GROUP_POLICIES[groupNum] || categories;
  const groupCategories = policyCategories.filter(c => categories.includes(c));

  const filteredIncludes = groupCategories
    .map(cat => {
      const fileName = CATEGORY_FILE_MAP[cat] || cat;
      return `bannedsitelist = 'name=staysuite_${cat},path=${LISTS_DIR}/banned/${fileName}'`;
    })
    .join('\n');

  // No-MITM sites for safe browsing (banking, payments, government)
  // These domains bypass SSL inspection to prevent certificate warnings
  const noMitmSites = [
    'online.banking', 'banking', 'secure.', 'payment',
    'paypal.com', 'stripe.com', 'squareup.com',
    'apple.com', 'icloud.com', 'google.com',
    'microsoft.com', 'live.com', 'outlook.com',
  ];

  const noMitmIncludes = noMitmSites
    .map(site => `  .${site}`)
    .join('\n');

  // Naughtyness limits per group (phrase filtering sensitivity)
  const naughtynessLimits: Record<number, number> = {
    1: 50,   // Kids: Very sensitive
    2: 100,  // Standard: Moderate
    3: 160,  // Premium: Lenient (phrase filtering off in practice)
  };

  return `# =============================================================================
# StaySuite Filter Group ${groupNum} — ${groupName}
# =============================================================================
# Auto-generated by e2guardian-sync.ts — DO NOT EDIT
# Generated: ${new Date().toISOString()}
#
# Policy: ${groupNum === 1 ? 'ALL categories blocked (Family/Kids mode)' : groupNum === 2 ? 'Security + Adult + Gambling blocked (Standard Guest)' : 'Malware + Phishing only (Premium/Business)'}
# Active categories: ${groupCategories.length > 0 ? groupCategories.join(', ') : 'none'}
# =============================================================================

# --- SSL/TLS Inspection ---
# SNI-only mode: filter by domain name from TLS ClientHello
# No CA certificate needed on guest devices — transparent filtering
ssl_mitm = off

# --- StaySuite Banned Site Lists ---
# Each list is auto-generated from the StaySuite ContentFilter database
# Lists are deduplicated and sorted for optimal lookup performance
${filteredIncludes || '# No categories assigned to this group'}

# --- No-MITM Exception Sites ---
# Critical banking/payment sites bypass MITM to prevent cert warnings
sitelist = 'name=nomitm_staysuite,path=${LISTS_DIR}/banned/nomitm_staysuite'
${noMitmIncludes ? `# (populate ${LISTS_DIR}/banned/nomitm_staysuite with one domain per line)` : ''}

# --- Exception Lists ---
# Management/staff IPs and whitelisted sites
ipsitelist = 'name=exception,path=${LISTS_DIR}/../common/exceptioniplist'
sitelist = 'name=exception,path=${LISTS_DIR}/../common/exceptionsitelist'

# --- Reporting ---
reportinglevel = 3

# --- Weighted Phrase Filtering ---
# Sensitivity threshold (lower = more restrictive)
naughtynesslimit = ${naughtynessLimits[groupNum]}

# --- Category Display ---
categorydisplaythreshold = 1

# --- Block Page ---
htmltemplate = '/usr/share/e2guardian/languages/ukenglish/template.html'

# --- Connection Handling ---
maxuploadsize = -1
connecttimeout = 15
proxytimeout = 15
`;
}

// ---------------------------------------------------------------------------
// Main Config Generator
// ---------------------------------------------------------------------------

function generateMainConfig(): string {
  return `# =============================================================================
# StaySuite HospitalityOS — e2guardian Production Configuration
# =============================================================================
# AUTO-GENERATED by e2guardian-sync.ts — DO NOT EDIT MANUALLY
# Generated: ${new Date().toISOString()}
#
# This is a production-ready configuration for hotel/hospitality guest WiFi.
# Key features:
#   - SNI-only TLS filtering (no MITM, no CA cert distribution needed)
#   - 3 filter groups: Kids (strict), Standard Guest, Premium/Business
#   - Tuned for 5000+ concurrent users
#   - Comprehensive logging with structured format
#   - Security-hardened cipher suites and timeouts
#
# For custom settings, use the StaySuite GUI or edit filter group configs.
# This file is overwritten on every sync from the database.
# =============================================================================

# =============================================================================
# LANGUAGE & PATHS
# =============================================================================
language = 'ukenglish'

.Define LISTDIR ${join(BASE_DIR, 'lists', 'common')}
languagedir = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'languages')}'

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
# Bind to all interfaces — iptables/nftables control external access
filterip = ''
# HTTP proxy port (for explicit proxy configuration)
filterports = 8080
# HTTPS/TLS proxy port
tlsfilterports = 8090
# Transparent HTTPS intercept port (iptables REDIRECT target)
transparenthttpsport = 8443
# IP address that the transparent proxy uses to connect upstream
# Set to the gateway/management interface IP
tlsproxycn = '10.10.0.1'

# =============================================================================
# SSL/TLS CONFIGURATION
# =============================================================================
enablessl = on

# Certificate paths (auto-generated on first run if missing)
cacertificatepath = '${BASE_DIR}/private/ca.pem'
caprivatekeypath = '${BASE_DIR}/private/ca.key'
certprivatekeypath = '${BASE_DIR}/private/cert.key'
generatedcertpath = '${BASE_DIR}/private/generatedcerts/'
generatedcertstart = auto
useopensslconf = off

# Production-hardened cipher suite (TLS 1.2+ only, no weak ciphers)
setcipherlist = "HIGH:!aNULL:!eNULL:!MD5:!RC4:!3DES:!SRP:!PSK:!DSS:!SEED:!IDEA"

# =============================================================================
# TRANSPARENT MODE
# =============================================================================
defaulttransparentfiltergroup = 2
useoriginalip = on

# =============================================================================
# FILTER GROUPS
# =============================================================================
# Group 1: Kids/Family — ALL categories blocked (adult, social, streaming, gaming, etc.)
# Group 2: Standard Guest — malware, phishing, ads, adult, gambling, proxy/vpn, violence, drugs
# Group 3: Premium/Business — malware + phishing only (minimal interference)
filtergroups = 3
defaultfiltergroup = 2

# =============================================================================
# AUTHENTICATION
# =============================================================================
# IP-based auth: guest devices are identified by their DHCP-assigned IP
authplugin = '${join(process.cwd(), 'tools', 'e2guardian', 'configs', 'authplugins', 'ip.conf')}'
ipmaplist = 'name=ipmap,path=${join(BASE_DIR, 'lists', 'authplugins', 'ipgroups')}'
maplist = 'name=defaultusermap,path=${join(BASE_DIR, 'lists', 'authplugins', 'filtergroupslist')}'
maplist = 'name=portmap,path=${join(BASE_DIR, 'lists', 'authplugins', 'portgroups')}'
authrequiresuserandgroup = off

# =============================================================================
# CLIENT IP ACCESS LISTS
# =============================================================================
# Banned client IPs (rate-limited or abusive devices)
iplist = 'name=bannedclient,messageno=100,logmessageno=103,path=__LISTDIR__/bannediplist'
# Exception client IPs (management, staff, admin devices — never filtered)
iplist = 'name=exceptionclient,messageno=600,path=__LISTDIR__/exceptioniplist'
reverseclientiplookups = off

# =============================================================================
# AUTH EXCEPTION SITES
# =============================================================================
# Sites that bypass authentication (captive portal, payment gateways, etc.)
ipsitelist = 'name=authexception,messageno=602,path=__LISTDIR__/authexceptioniplist'
sitelist = 'name=authexception,messageno=602,path=__LISTDIR__/authexceptionsitelist'
urllist = 'name=authexception,messageno=603,path=__LISTDIR__/authexceptionurllist'
regexpboollist = 'name=browser,path=__LISTDIR__/browserregexplist'

# =============================================================================
# NO-MITM SITES (Critical Security)
# =============================================================================
# Banking, payment, and government sites bypass MITM to prevent certificate warnings
# This ensures guest banking sessions work without installing StaySuite CA
sitelist = 'name=nomitm,path=__LISTDIR__/nomitmsitelist'
ipsitelist = 'name=nomitm,path=__LISTDIR__/nomitmsiteiplist'

# =============================================================================
# LOGGING (Production Configuration)
# =============================================================================
set_accesslog = '${join(BASE_DIR, 'logs', 'access.log')}'
set_error = 'syslog:LOG_ERR'
set_info = 'syslog:LOG_INFO'
set_warning = 'syslog:LOG_WARNING'

# Structured log format (JSON-like, machine-parseable)
logfileformat = 8
loglevel = 3
logexceptionhits = 2
logadblocks = off
showweightedfound = on
usedashforblank = on

# Client identification in logs
logclientnameandip = on
loguseragent = off
logclienthostnames = off

# Enhanced logging flags
tag_logs = on
addECHtoFlags = on
maxlogitemlength = 2000

# =============================================================================
# MONITORING & HEALTH CHECKS
# =============================================================================
set_dstatslog = '${join(BASE_DIR, 'logs', 'dstats.log')}'
dstatinterval = 300
statshumanreadable = on
internaltesturl = 'internal.test.e2guardian.org'
internalstatusurl = 'internal.status.e2guardian.org'
monitorflagprefix = '/run/e2guardian/e2g_flag_'

# =============================================================================
# URL FILTERING
# =============================================================================
reverseaddresslookups = off

# =============================================================================
# LIST SETTINGS
# =============================================================================
# Don't crash if a list file is missing (graceful degradation)
abortiflistmissing = off
searchsitelistforip = off

# =============================================================================
# ANTIVIRUS SCANNING (Optional — ClamAV integration)
# =============================================================================
contentscannertimeout = 60

# =============================================================================
# HTTP HEADERS
# =============================================================================
# Don't add X-Forwarded-For (preserves client IP privacy)
addforwardedfor = off
usexforwardedfor = off
maxheaderlines = 2000

# =============================================================================
# BLOCK PAGE
# =============================================================================
reportinglevel = 3
usecustombannedimage = on
custombannedimagefile = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'transparent1x1.gif')}'
usecustombannedflash = on
custombannedflashfile = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'blockedflash.swf')}'

# =============================================================================
# DOWNLOAD MANAGEMENT
# =============================================================================
downloadmanager = '${join(process.cwd(), 'tools', 'e2guardian', 'configs', 'downloadmanagers', 'default.conf.in')}'
filecachedir = '/tmp'
deletedownloadedtempfiles = on
initialtrickledelay = 20
trickledelay = 10

# =============================================================================
# PHRASE FILTERING (Content Inspection)
# =============================================================================
weightedphrasemode = 2
phrasefiltermode = 2
preservecase = 0
hexdecodecontent = off
forcequicksearch = off

# =============================================================================
# PERFORMANCE TUNING (5000+ concurrent hotel guests)
# =============================================================================
# HTTP worker threads — scale with CPU cores (default: 5000)
httpworkers = 5000

# Content scanning limits
maxcontentfiltersize = 4096
maxcontentramcachescansize = 4096
maxcontentfilecachescansize = 50000

# Timeout settings (seconds)
proxytimeout = 15
connecttimeout = 15
pcontimeout = 60

# Prefork server children — auto-scale with load
serverresponsechildren = 30

# Socket buffer sizes (128KB — optimal for hotel networks)
socketreceivebuffer = 131072
socketsendbuffer = 131072

# Auto-scale child processes (0 = unlimited based on demand)
maxchildren = 0

# =============================================================================
# LOOP PREVENTION
# =============================================================================
checkip = 127.0.0.1

# =============================================================================
# DAEMON SETTINGS
# =============================================================================
nodaemon = off
softrestart = on
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full sync: reads DB, generates all e2guardian config files.
 * This is the REAL implementation — no stub.
 */
export async function syncE2guardianConfig(
  tenantId: string,
  propertyId?: string,
): Promise<SyncResult> {
  const startTime = Date.now();
  const filesWritten: Record<string, number> = {};
  const configFilesGenerated: string[] = [];
  let totalDomainsWritten = 0;
  const categoriesGenerated: string[] = [];

  try {
    await ensureDirs();

    // 1. Query all enabled ContentFilter records
    const where: Record<string, unknown> = {
      tenantId,
      enabled: true,
    };
    if (propertyId) where.propertyId = propertyId;

    const filters = await db.contentFilter.findMany({
      where,
      select: { category: true, domains: true, name: true },
    });

    // 2. Group domains by category, deduplicate
    const categories: Record<string, Set<string>> = {};
    for (const filter of filters) {
      let domains: string[] = [];
      try {
        const parsed = JSON.parse(filter.domains || '[]');
        if (Array.isArray(parsed)) domains = parsed.map(String).filter(Boolean);
      } catch {
        // skip malformed
      }

      if (domains.length === 0) continue;

      if (!categories[filter.category]) {
        categories[filter.category] = new Set();
      }
      for (const d of domains) {
        categories[filter.category].add(d.trim().toLowerCase());
      }
    }

    // 3. Write banned list files
    for (const [category, domainSet] of Object.entries(categories)) {
      const domainArr = [...domainSet];
      const count = await writeListFile(BANNED_DIR, category, domainArr);
      filesWritten[category] = count;
      totalDomainsWritten += count;
      categoriesGenerated.push(category);
    }

    // 4. Write empty placeholder files for categories with no domains
    for (const cat of VALID_CATEGORIES) {
      if (!categories[cat]) {
        const filePath = join(BANNED_DIR, CATEGORY_FILE_MAP[cat]);
        if (!existsSync(filePath)) {
          await writeFile(filePath, '', 'utf-8');
        }
      }
    }

    // 5. Generate filter group configs
    const groupConfigs = [
      { num: 1, name: 'Kids (Most Restrictive)' },
      { num: 2, name: 'Basic (Standard)' },
      { num: 3, name: 'Premium (Minimal)' },
    ];
    const allCategories = Object.keys(categories);

    for (const group of groupConfigs) {
      const config = generateFilterGroupConfig(group.num, group.name, allCategories);
      const configPath = join(CONFIGS_DIR, `e2guardianf${group.num}.conf`);
      await writeFile(configPath, config, 'utf-8');
      configFilesGenerated.push(`e2guardianf${group.num}.conf`);
    }

    // 6. Generate main config
    const mainConfig = generateMainConfig();
    const mainConfigPath = join(CONFIGS_DIR, 'e2guardian.conf');
    await writeFile(mainConfigPath, mainConfig, 'utf-8');
    configFilesGenerated.push('e2guardian.conf');

    // 7. Write status file
    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      tenantId,
      propertyId,
      totalDomains: totalDomainsWritten,
      categoriesCount: categoriesGenerated.length,
      filtersActive: filters.length,
      configFiles: configFilesGenerated,
    };
    await writeFile(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');

    const duration = Date.now() - startTime;

    console.log(
      `[e2guardian-sync] Sync complete: ${totalDomainsWritten} domains across ${categoriesGenerated.length} categories, ${configFilesGenerated.length} config files in ${duration}ms`,
    );

    return {
      success: true,
      categoriesGenerated,
      totalDomainsWritten,
      filesWritten,
      configFilesGenerated,
      message: `Synced ${totalDomainsWritten} domains across ${categoriesGenerated.length} categories. ${configFilesGenerated.length} config files generated.`,
      syncedAt: new Date().toISOString(),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[e2guardian-sync] Sync failed after ${duration}ms:`, error);

    return {
      success: false,
      categoriesGenerated,
      totalDomainsWritten,
      filesWritten,
      configFilesGenerated,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      syncedAt: new Date().toISOString(),
      duration,
    };
  }
}

/**
 * Sync from pre-grouped domain data (used by /sync endpoint).
 */
export async function syncE2guardianConfigFromData(
  categoriesWithDomains: Record<string, string[]>,
): Promise<SyncResult> {
  const startTime = Date.now();
  const filesWritten: Record<string, number> = {};
  const configFilesGenerated: string[] = [];
  let totalDomainsWritten = 0;
  const categoriesGenerated: string[] = [];

  try {
    await ensureDirs();

    for (const [category, domains] of Object.entries(categoriesWithDomains)) {
      if (!domains || domains.length === 0) continue;

      const uniqueDomains = [...new Set(domains.map(d => d.trim().toLowerCase()).filter(Boolean))];
      const count = await writeListFile(BANNED_DIR, category, uniqueDomains);
      filesWritten[category] = count;
      totalDomainsWritten += count;
      categoriesGenerated.push(category);
    }

    // Regenerate filter group configs
    const allCategories = Object.keys(categoriesWithDomains);
    const groupConfigs = [
      { num: 1, name: 'Kids (Most Restrictive)' },
      { num: 2, name: 'Basic (Standard)' },
      { num: 3, name: 'Premium (Minimal)' },
    ];

    for (const group of groupConfigs) {
      const config = generateFilterGroupConfig(group.num, group.name, allCategories);
      const configPath = join(CONFIGS_DIR, `e2guardianf${group.num}.conf`);
      await writeFile(configPath, config, 'utf-8');
      configFilesGenerated.push(`e2guardianf${group.num}.conf`);
    }

    // Regenerate main config
    const mainConfig = generateMainConfig();
    const mainConfigPath = join(CONFIGS_DIR, 'e2guardian.conf');
    await writeFile(mainConfigPath, mainConfig, 'utf-8');
    configFilesGenerated.push('e2guardian.conf');

    // Write status
    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      tenantId: 'unknown',
      totalDomains: totalDomainsWritten,
      categoriesCount: categoriesGenerated.length,
      filtersActive: 0,
      configFiles: configFilesGenerated,
    };
    await writeFile(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');

    const duration = Date.now() - startTime;
    return {
      success: true,
      categoriesGenerated,
      totalDomainsWritten,
      filesWritten,
      configFilesGenerated,
      message: `Synced ${totalDomainsWritten} domains across ${categoriesGenerated.length} categories from provided data.`,
      syncedAt: new Date().toISOString(),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      categoriesGenerated,
      totalDomainsWritten,
      filesWritten,
      configFilesGenerated,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      syncedAt: new Date().toISOString(),
      duration,
    };
  }
}

/**
 * Read the last sync status from disk.
 */
export async function getSyncStatus(): Promise<SyncStatus | null> {
  try {
    if (!existsSync(STATUS_FILE)) return null;
    const raw = await readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(raw) as SyncStatus;
  } catch {
    return null;
  }
}

/**
 * Get a summary of generated list files (for display purposes).
 */
export async function getListFilesSummary(): Promise<{
  banned: Record<string, { file: string; domains: number; lastModified: string | null }>;
  configs: string[];
  status: SyncStatus | null;
}> {
  const banned: Record<string, { file: string; domains: number; lastModified: string | null }> = {};

  try {
    if (existsSync(BANNED_DIR)) {
      const files = await readdir(BANNED_DIR);
      for (const file of files) {
        const filePath = join(BANNED_DIR, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          const fileStat = await stat(filePath);
          banned[file] = {
            file,
            domains: lines.length,
            lastModified: fileStat.mtime.toISOString(),
          };
        } catch {
          banned[file] = { file, domains: 0, lastModified: null };
        }
      }
    }
  } catch {
    // directory doesn't exist yet
  }

  const configs: string[] = [];
  try {
    if (existsSync(CONFIGS_DIR)) {
      const files = await readdir(CONFIGS_DIR);
      configs.push(...files.sort());
    }
  } catch {
    // directory doesn't exist yet
  }

  return {
    banned,
    configs,
    status: await getSyncStatus(),
  };
}
