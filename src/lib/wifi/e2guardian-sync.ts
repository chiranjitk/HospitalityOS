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
  const bannedIncludes = categories
    .map(cat => {
      const fileName = CATEGORY_FILE_MAP[cat] || cat;
      return `bannedsitelist = 'name=staysuite_${cat},path=${LISTS_DIR}/banned/${fileName}'`;
    })
    .join('\n');

  // Group 1 (kids): SNI-only, most restrictive
  // Group 2 (basic): SNI-only, moderate
  // Group 3 (premium): SNI-only, minimal (only malware/phishing)
  const groupCategories = groupNum === 3
    ? categories.filter(c => ['malware', 'phishing', 'drugs', 'violence'].includes(c))
    : categories;

  const filteredIncludes = groupCategories
    .map(cat => {
      const fileName = CATEGORY_FILE_MAP[cat] || cat;
      return `bannedsitelist = 'name=staysuite_${cat},path=${LISTS_DIR}/banned/${fileName}'`;
    })
    .join('\n');

  return `# =============================================================================
# StaySuite Filter Group ${groupNum} — ${groupName}
# Auto-generated by e2guardian-sync.ts — DO NOT EDIT
# Generated: ${new Date().toISOString()}
# =============================================================================

# Filter group number (matches e2guardian.conf filtergroups)
# groupmode = 1  (combined weight — both site lists and phrase lists checked)

# --- SSL / TLS for this group ---
# SNI-only mode: filter by domain name from TLS ClientHello
# No CA certificate installation needed on guest devices
ssl_mitm = off

# --- Banned Site Lists (StaySuite generated) ---
${filteredIncludes || '# No categories assigned to this group'}

# --- Exception lists ---
# Exception IPs — always allowed (management, staff, internal)
ipsitelist = 'name=exception,path=${LISTS_DIR}/../common/exceptioniplist'
sitelist = 'name=exception,path=${LISTS_DIR}/../common/exceptionsitelist'

# --- Reporting ---
reportinglevel = 3

# --- Weighted phrase filtering ---
naughtynesslimit = ${groupNum === 1 ? 50 : groupNum === 2 ? 100 : 160}

# --- Category display ---
categorydisplaythreshold = 1

# --- Block page template ---
htmltemplate = '/usr/share/e2guardian/languages/ukenglish/template.html'
`;
}

// ---------------------------------------------------------------------------
// Main Config Generator
// ---------------------------------------------------------------------------

function generateMainConfig(): string {
  return `# =============================================================================
# StaySuite-HospitalityOS — e2guardian Main Configuration
# =============================================================================
# AUTO-GENERATED by e2guardian-sync.ts — DO NOT EDIT MANUALLY
# Generated: ${new Date().toISOString()}
#
# For custom settings, edit the template or use the StaySuite GUI.
# This file is overwritten on every sync.
# =============================================================================

# --- Language ---
language = 'ukenglish'

# --- Paths ---
.Define LISTDIR ${join(BASE_DIR, 'lists', 'common')}
languagedir = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'languages')}'

# --- Network ---
filterip = ''
filterports = 8080
tlsfilterports = 8090
transparenthttpsport = 8443
tlsproxycn = '10.10.0.1'

# --- SSL/TLS ---
enablessl = on
cacertificatepath = '${BASE_DIR}/private/ca.pem'
caprivatekeypath = '${BASE_DIR}/private/ca.key'
certprivatekeypath = '${BASE_DIR}/private/cert.key'
generatedcertpath = '${BASE_DIR}/private/generatedcerts/'
generatedcertstart = auto
useopensslconf = off
setcipherlist = "HIGH:!ADH:!MD5:!RC4:!SRP:!PSK:!DSS"

# --- Transparent mode ---
defaulttransparentfiltergroup = 1
useoriginalip = on

# --- Filter Groups ---
filtergroups = 3
defaultfiltergroup = 2

# --- Auth ---
authplugin = '${join(process.cwd(), 'tools', 'e2guardian', 'configs', 'authplugins', 'ip.conf')}'
ipmaplist = 'name=ipmap,path=${join(BASE_DIR, 'lists', 'authplugins', 'ipgroups')}'
maplist = 'name=defaultusermap,path=${join(BASE_DIR, 'lists', 'authplugins', 'filtergroupslist')}'
maplist = 'name=portmap,path=${join(BASE_DIR, 'lists', 'authplugins', 'portgroups')}'
authrequiresuserandgroup = off

# --- Client IP lists ---
iplist = 'name=bannedclient,messageno=100,logmessageno=103,path=__LISTDIR__/bannediplist'
iplist = 'name=exceptionclient,messageno=600,path=__LISTDIR__/exceptioniplist'
reverseclientiplookups = off

# --- Auth exception sites ---
ipsitelist = 'name=authexception,messageno=602,path=__LISTDIR__/authexceptioniplist'
sitelist = 'name=authexception,messageno=602,path=__LISTDIR__/authexceptionsitelist'
urllist = 'name=authexception,messageno=603,path=__LISTDIR__/authexceptionurllist'
regexpboollist = 'name=browser,path=__LISTDIR__/browserregexplist'

# --- No-MITM sites (banking, payments) ---
sitelist = 'name=nomitm,path=__LISTDIR__/nomitmsitelist'
ipsitelist = 'name=nomitm,path=__LISTDIR__/nomitmsiteiplist'

# --- Logging ---
set_accesslog = '${join(BASE_DIR, 'logs', 'access.log')}'
set_error = 'syslog:LOG_ERR'
set_info = 'syslog:LOG_INFO'
set_warning = 'syslog:LOG_WARNING'
logfileformat = 8
loglevel = 3
logexceptionhits = 2
logadblocks = off
showweightedfound = on
usedashforblank = on
logclientnameandip = on
loguseragent = off
logclienthostnames = off
tag_logs = on
addECHtoFlags = on
maxlogitemlength = 2000

# --- Monitoring ---
set_dstatslog = '${join(BASE_DIR, 'logs', 'dstats.log')}'
dstatinterval = 300
statshumanreadable = on
internaltesturl = 'internal.test.e2guardian.org'
internalstatusurl = 'internal.status.e2guardian.org'
monitorflagprefix = '/run/e2guardian/e2g_flag_'

# --- URL filtering ---
reverseaddresslookups = off

# --- List settings ---
abortiflistmissing = off
searchsitelistforip = off

# --- AV scanning (optional) ---
contentscannertimeout = 60

# --- Headers ---
addforwardedfor = off
usexforwardedfor = off
maxheaderlines = 2000

# --- Block page ---
reportinglevel = 3
usecustombannedimage = on
custombannedimagefile = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'transparent1x1.gif')}'
usecustombannedflash = on
custombannedflashfile = '${join(process.cwd(), 'tools', 'e2guardian', 'data', 'blockedflash.swf')}'

# --- Download manager ---
downloadmanager = '${join(process.cwd(), 'tools', 'e2guardian', 'configs', 'downloadmanagers', 'default.conf.in')}'
filecachedir = '/tmp'
deletedownloadedtempfiles = on
initialtrickledelay = 20
trickledelay = 10

# --- Phrase filtering ---
weightedphrasemode = 2
phrasefiltermode = 2
preservecase = 0
hexdecodecontent = off
forcequicksearch = off

# --- Tuning (5000+ users) ---
httpworkers = 5000
maxcontentfiltersize = 4096
maxcontentramcachescansize = 4096
maxcontentfilecachescansize = 50000
proxytimeout = 15
connecttimeout = 15
pcontimeout = 60
serverresponsechildren = 30
socketreceivebuffer = 131072
socketsendbuffer = 131072
maxchildren = 0

# --- Loop prevention ---
checkip = 127.0.0.1

# --- Daemon ---
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
