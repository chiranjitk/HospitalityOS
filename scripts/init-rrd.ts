#!/usr/bin/env tsx
/**
 * RRD Initialization Script — Production Bootstrap
 *
 * Creates all required RRD files for system health monitoring.
 * Run this once when deploying to a new server or after a clean install.
 *
 * Usage:
 *   npx tsx scripts/init-rrd.ts              # Create all RRD files (auto-detect cores/interfaces)
 *   npx tsx scripts/init-rrd.ts --force       # Recreate all RRD files (deletes existing data!)
 *   npx tsx scripts/init-rrd.ts --check       # Only verify RRD files exist, don't create
 *
 * Environment variables:
 *   RRD_BIN_PATH   - Path to rrdtool binary (default: ./rrdtool/bin/rrdtool)
 *   RRD_LIB_PATH   - Path to rrdtool shared libraries (default: ./rrdtool/lib)
 *   RRD_DATA_PATH  - Base directory for RRD files (default: ./data/rrd)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

// ─── Resolve paths ──────────────────────────────────────────────────────────

function findProjectRoot(startDir: string = __dirname): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

const PROJECT_ROOT = findProjectRoot();
const RRD_BIN = process.env.RRD_BIN_PATH || path.join(PROJECT_ROOT, 'rrdtool', 'bin', 'rrdtool');
const RRD_DATA_PATH = process.env.RRD_DATA_PATH || path.join(PROJECT_ROOT, 'data', 'rrd');
const SYSTEM_DIR = path.join(RRD_DATA_PATH, 'system');

const RRD_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: process.env.RRD_LIB_PATH || path.join(PROJECT_ROOT, 'rrdtool', 'lib'),
};

const DEFAULT_STEP = 60;

// ─── RRD schema definitions ────────────────────────────────────────────────

interface RRDDataSource {
  name: string;
  type: 'GAUGE' | 'DERIVE' | 'COUNTER' | 'ABSOLUTE';
  heartbeat: number;
  min: string;
  max: string;
}

interface RRDArchive {
  cf: string;
  steps: number;
  rows: number;
  xff?: number;
}

const SYSTEM_RRAS: RRDArchive[] = [
  { cf: 'AVERAGE', steps: 1, rows: 1440 },    // 1min avg, 24h
  { cf: 'AVERAGE', steps: 5, rows: 2016 },    // 5min avg, 7d
  { cf: 'AVERAGE', steps: 60, rows: 720 },    // 1hr avg, 30d
  { cf: 'AVERAGE', steps: 1440, rows: 365 },  // 1day avg, 1yr
  { cf: 'MAX', steps: 1, rows: 1440 },        // 1min max, 24h
  { cf: 'MAX', steps: 5, rows: 2016 },        // 5min max, 7d
];

// All RRD files to create
const RRD_DEFINITIONS: { filename: string; description: string; dataSources: RRDDataSource[] }[] = [
  {
    filename: 'cpu.rrd',
    description: 'CPU Usage (%)',
    dataSources: [
      { name: 'usage', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
    ],
  },
  {
    filename: 'cpu-percore.rrd',
    description: 'CPU Per-Core Usage (%)',
    dataSources: buildPerCoreDS(),
  },
  {
    filename: 'memory.rrd',
    description: 'Memory Usage',
    dataSources: [
      { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
    ],
  },
  {
    filename: 'disk.rrd',
    description: 'Disk Usage',
    dataSources: [
      { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
    ],
  },
  {
    filename: 'load.rrd',
    description: 'Load Average',
    dataSources: [
      { name: 'load1', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'load5', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'load15', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
  {
    filename: 'swap.rrd',
    description: 'Swap Usage',
    dataSources: [
      { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
    ],
  },
  {
    filename: 'disk-io.rrd',
    description: 'Disk I/O',
    dataSources: [
      { name: 'reads', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'writes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'read_bytes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'write_bytes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
  {
    filename: 'thermal.rrd',
    description: 'CPU Temperature (°C)',
    dataSources: [
      { name: 'cpu_temp', type: 'GAUGE', heartbeat: 120, min: '0', max: '150' },
    ],
  },
  {
    filename: 'network-errors.rrd',
    description: 'Network Errors & Drops',
    dataSources: [
      { name: 'rx_err', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'tx_err', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'rx_drop', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'tx_drop', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'rx_pkt', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'tx_pkt', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
  {
    filename: 'tcp-connections.rrd',
    description: 'TCP Connections',
    dataSources: [
      { name: 'established', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'time_wait', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'close_wait', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'syn_recv', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
  {
    filename: 'active-sessions.rrd',
    description: 'Active RADIUS Sessions',
    dataSources: [
      { name: 'count', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
  {
    filename: 'auth-stats.rrd',
    description: 'RADIUS Auth Statistics',
    dataSources: [
      { name: 'accept', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
      { name: 'reject', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    ],
  },
];

// Dynamic: interface RRDs
function getNetworkInterfaces(): string[] {
  const interfaces = os.networkInterfaces();
  const names: string[] = [];
  // Skip loopback and internal interfaces
  const skipPrefixes = ['lo', 'docker', 'br-', 'veth'];
  for (const name of Object.keys(interfaces)) {
    if (skipPrefixes.some(p => name.startsWith(p))) continue;
    if (interfaces[name] && interfaces[name]!.length > 0) {
      names.push(name);
    }
  }
  return names;
}

function buildPerCoreDS(): RRDDataSource[] {
  const cores = os.cpus().length;
  const ds: RRDDataSource[] = [];
  for (let i = 0; i < cores; i++) {
    ds.push({
      name: `cpu${i}`,
      type: 'GAUGE',
      heartbeat: 120,
      min: '0',
      max: '100',
    });
  }
  return ds;
}

function buildInterfaceDS(iface: string): RRDDataSource[] {
  return [
    { name: 'rx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    { name: 'tx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  ];
}

// ─── RRD operations ─────────────────────────────────────────────────────────

function dsToString(ds: RRDDataSource): string {
  return `DS:${ds.name}:${ds.type}:${ds.heartbeat}:${ds.min}:${ds.max}`;
}

function rraToString(rra: RRDArchive): string {
  return `RRA:${rra.cf}:${rra.xff ?? 0.5}:${rra.steps}:${rra.rows}`;
}

async function rrdExec(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync(RRD_BIN, args, {
    env: RRD_ENV,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stderr && !stdout ? stderr : stdout;
}

async function createRRD(
  filePath: string,
  dataSources: RRDDataSource[],
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const args = [
    'create',
    filePath,
    '--step', String(DEFAULT_STEP),
    '--start', String(now - DEFAULT_STEP),
    ...dataSources.map(dsToString),
    ...SYSTEM_RRAS.map(rraToString),
  ];
  await rrdExec(args);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const checkOnly = args.includes('--check');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           RRD Initialization — Production Bootstrap          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Project Root : ${PROJECT_ROOT}`);
  console.log(`  rrdtool bin  : ${RRD_BIN}`);
  console.log(`  RRD data dir : ${RRD_DATA_PATH}`);
  console.log(`  System dir   : ${SYSTEM_DIR}`);
  console.log(`  CPU cores    : ${os.cpus().length}`);
  console.log(`  Interfaces   : ${getNetworkInterfaces().join(', ') || 'none detected'}`);
  console.log('');

  // Check rrdtool binary exists
  if (!fs.existsSync(RRD_BIN)) {
    console.error('  ✗ rrdtool binary not found at:', RRD_BIN);
    console.error('    Install rrdtool or set RRD_BIN_PATH environment variable.');
    console.error('    On Ubuntu/Debian: sudo apt-get install rrdtool');
    console.error('    On RHEL/CentOS:   sudo yum install rrdtool');
    process.exit(1);
  }
  console.log('  ✓ rrdtool binary found');
  console.log('');

  // Create directories
  if (!fs.existsSync(SYSTEM_DIR)) {
    fs.mkdirSync(SYSTEM_DIR, { recursive: true });
    console.log('  ✓ Created system RRD directory');
  }

  // Collect all RRD files to create
  const allRRDs: { filePath: string; description: string; dataSources: RRDDataSource[] }[] = [];

  for (const def of RRD_DEFINITIONS) {
    allRRDs.push({
      filePath: path.join(SYSTEM_DIR, def.filename),
      description: def.description,
      dataSources: def.dataSources,
    });
  }

  // Add per-interface RRDs
  for (const iface of getNetworkInterfaces()) {
    allRRDs.push({
      filePath: path.join(SYSTEM_DIR, `${iface}.rrd`),
      description: `Network Interface: ${iface}`,
      dataSources: buildInterfaceDS(iface),
    });
  }

  console.log(`  RRD files to process: ${allRRDs.length}`);
  console.log('');

  if (checkOnly) {
    console.log('  ─── Check Mode (no creation) ───');
    console.log('');
    let allExist = true;
    for (const rrd of allRRDs) {
      const exists = fs.existsSync(rrd.filePath);
      const icon = exists ? '✓' : '✗';
      console.log(`  ${icon} ${path.basename(rrd.filePath)}  ${rrd.description}  (${rrd.dataSources.length} DS)`);
      if (!exists) allExist = false;
    }
    console.log('');
    if (allExist) {
      console.log('  ✓ All RRD files exist');
    } else {
      console.log('  ✗ Some RRD files are missing. Run without --check to create them.');
    }
    return;
  }

  console.log('  ─── Creating RRD Files ───');
  console.log('');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const rrd of allRRDs) {
    const exists = fs.existsSync(rrd.filePath);

    if (exists && !force) {
      console.log(`  ○ ${path.basename(rrd.filePath)}  ${rrd.description}  (already exists, skipped)`);
      skipped++;
      continue;
    }

    if (exists && force) {
      fs.unlinkSync(rrd.filePath);
    }

    try {
      await createRRD(rrd.filePath, rrd.dataSources);
      const dsInfo = rrd.dataSources.map(d => d.name).join(', ');
      console.log(`  ✓ ${path.basename(rrd.filePath)}  ${rrd.description}  (${rrd.dataSources.length} DS: ${dsInfo})`);
      created++;
    } catch (err) {
      console.error(`  ✗ ${path.basename(rrd.filePath)}  FAILED: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log('');
  console.log('  ─── Summary ───');
  console.log('');
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`  Total   : ${allRRDs.length}`);
  console.log('');

  if (failed > 0) {
    console.log('  ⚠ Some RRD files failed to create. Check rrdtool is working correctly.');
    process.exit(1);
  }

  console.log('  ✓ All RRD files ready!');
  console.log('');
  console.log('  Next steps:');
  console.log('    1. Set up cron job to run the collector every minute:');
  console.log('       * * * * * cd ' + PROJECT_ROOT + ' && npx tsx src/lib/rrd/collector-cron.ts >> logs/rrd-cron.log 2>&1');
  console.log('    2. Or use the provided script:');
  console.log('       bash scripts/rrd-cron-runner.sh');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
