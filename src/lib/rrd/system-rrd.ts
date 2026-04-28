/**
 * System Metrics RRD Support
 *
 * Extends the base RRD library to create, update, and query RRD files
 * for system-level metrics: CPU, memory, disk, and per-interface traffic.
 *
 * RRD storage: data/rrd/system/{cpu,memory,disk,{iface}}.rrd
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getRRDBasePath, type RRDDataSource, type RRDArchive } from './index';

const execFileAsync = promisify(execFile);

// rrdtool binary and environment (same as base library)
const RRD_BIN = '/home/z/my-project/StaySuite-HospitalityOS/rrdtool/bin/rrdtool';
const RRD_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: '/home/z/my-project/StaySuite-HospitalityOS/rrdtool/lib',
};
const DEFAULT_STEP = 60;

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_RRD_DIR = path.join(getRRDBasePath(), 'system');

// Same RRAs as the existing bandwidth collector (1min→24h, 5min→7d, 1hr→30d, 1day→1yr)
const SYSTEM_RRAS: RRDArchive[] = [
  { cf: 'AVERAGE', steps: 1, rows: 1440 },    // 1min avg, 24h
  { cf: 'AVERAGE', steps: 5, rows: 2016 },    // 5min avg, 7d
  { cf: 'AVERAGE', steps: 60, rows: 720 },    // 1hr avg, 30d
  { cf: 'AVERAGE', steps: 1440, rows: 365 },  // 1day avg, 1yr
  { cf: 'MAX', steps: 1, rows: 1440 },        // 1min max, 24h
  { cf: 'MAX', steps: 5, rows: 2016 },        // 5min max, 7d
];

// Resolution mapping for time ranges
const RANGE_RESOLUTIONS: Record<string, number> = {
  '1h': 60,
  '6h': 300,
  '24h': 300,
  '7d': 3600,
  '30d': 3600,
  '1y': 86400,
};

// ─── Helper: rrdtool exec ────────────────────────────────────────────────────

async function rrdExec(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(RRD_BIN, args, {
      env: RRD_ENV,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`rrdtool error: ${message}`);
  }
}

// ─── Helper: DS/RRA string formatting (matches base library) ─────────────────

function dsToString(ds: RRDDataSource): string {
  const hb = ds.heartbeat ?? 120;
  const min = ds.min ?? '0';
  const max = ds.max ?? 'U';
  return `DS:${ds.name}:${ds.type}:${hb}:${min}:${max}`;
}

function rraToString(rra: RRDArchive): string {
  const xff = rra.xff ?? 0.5;
  return `RRA:${rra.cf}:${xff}:${rra.steps}:${rra.rows}`;
}

// ─── DS definitions for each RRD type ────────────────────────────────────────

const CPU_DS: RRDDataSource[] = [
  { name: 'usage', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

const MEMORY_DS: RRDDataSource[] = [
  { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

const DISK_DS: RRDDataSource[] = [
  { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

function interfaceDS(iface: string): RRDDataSource[] {
  return [
    { name: 'rx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    { name: 'tx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  ];
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SystemGraphResult {
  timestamps: number[];
  data: Record<string, number[]>;
  meta: {
    step: number;
    start: number;
    end: number;
    cf: string;
    dsNames: string[];
    type: string;
    name?: string;
    range: string;
  };
}

/**
 * Ensure all system RRD files exist, creating them if necessary.
 * Call once at startup or when new interfaces are detected.
 */
export async function ensureSystemRRDs(interfaces?: string[]): Promise<void> {
  if (!fs.existsSync(SYSTEM_RRD_DIR)) {
    fs.mkdirSync(SYSTEM_RRD_DIR, { recursive: true });
  }

  const now = Math.floor(Date.now() / 1000);

  // CPU RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'cpu.rrd'),
    CPU_DS,
    now
  );

  // Memory RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'memory.rrd'),
    MEMORY_DS,
    now
  );

  // Disk RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'disk.rrd'),
    DISK_DS,
    now
  );

  // Per-interface RRDs
  if (interfaces) {
    for (const iface of interfaces) {
      await ensureSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface}.rrd`),
        interfaceDS(iface),
        now
      );
    }
  }
}

/**
 * Create a single RRD file if it doesn't exist.
 */
async function ensureSingleRRD(
  filePath: string,
  dataSources: RRDDataSource[],
  now: number
): Promise<void> {
  if (fs.existsSync(filePath)) return;

  try {
    const args = [
      'create',
      filePath,
      '--step', String(DEFAULT_STEP),
      '--start', String(now - DEFAULT_STEP),
      ...dataSources.map(dsToString),
      ...SYSTEM_RRAS.map(rraToString),
    ];
    await rrdExec(args);
  } catch (err) {
    console.error(`[SystemRRD] Failed to create ${filePath}:`, err);
  }
}

/**
 * Update all system RRD files with the latest metrics.
 */
export async function updateSystemRRDs(
  cpuPercent: number,
  ramUsed: number,
  ramPercent: number,
  diskUsed: number,
  diskPercent: number,
  interfaces: Array<{ name: string; rxBytes: number; txBytes: number }>
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // CPU
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'cpu.rrd'),
      now,
      { usage: cpuPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update CPU:', err);
  }

  // Memory
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'memory.rrd'),
      now,
      { used: ramUsed, percent: ramPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update memory:', err);
  }

  // Disk
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'disk.rrd'),
      now,
      { used: diskUsed, percent: diskPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update disk:', err);
  }

  // Per-interface
  for (const iface of interfaces) {
    try {
      await ensureSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface.name}.rrd`),
        interfaceDS(iface.name),
        now
      );
      await updateSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface.name}.rrd`),
        now,
        { rx: iface.rxBytes, tx: iface.txBytes }
      );
    } catch (err) {
      console.error(`[SystemRRD] Failed to update interface ${iface.name}:`, err);
    }
  }
}

/**
 * Update a single RRD file with timestamped values.
 */
async function updateSingleRRD(
  filePath: string,
  timestamp: number,
  values: Record<string, number>
): Promise<void> {
  const valueStr = [timestamp, ...Object.values(values)].join(':');
  await rrdExec(['update', filePath, valueStr]);
}

/**
 * Fetch graph data from a system RRD.
 *
 * @param type   - 'cpu' | 'memory' | 'disk' | 'interface'
 * @param name   - interface name (required when type = 'interface')
 * @param range  - '1h' | '6h' | '24h' | '7d' | '30d' | '1y'
 */
export async function fetchSystemGraph(
  type: string,
  name: string,
  range: string
): Promise<SystemGraphResult> {
  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds: Record<string, number> = {
    '1h': 3600,
    '6h': 21600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
    '1y': 31536000,
  };

  const seconds = rangeSeconds[range] || 86400;
  const start = now - seconds;
  const resolution = RANGE_RESOLUTIONS[range] || 300;
  const cf = 'AVERAGE';

  // Determine file path and DEF/XPORT definitions based on type
  let filePath: string;
  let defXportArgs: string[];
  let dsNames: string[];

  switch (type) {
    case 'cpu':
      filePath = path.join(SYSTEM_RRD_DIR, 'cpu.rrd');
      defXportArgs = [
        `DEF:usage=${filePath}:usage:${cf}`,
        'XPORT:usage:CPU Usage %',
      ];
      dsNames = ['usage'];
      break;

    case 'memory':
      filePath = path.join(SYSTEM_RRD_DIR, 'memory.rrd');
      defXportArgs = [
        `DEF:used=${filePath}:used:${cf}`,
        `DEF:percent=${filePath}:percent:${cf}`,
        'XPORT:used:Memory Used (bytes)',
        'XPORT:percent:Memory Usage %',
      ];
      dsNames = ['used', 'percent'];
      break;

    case 'disk':
      filePath = path.join(SYSTEM_RRD_DIR, 'disk.rrd');
      defXportArgs = [
        `DEF:used=${filePath}:used:${cf}`,
        `DEF:percent=${filePath}:percent:${cf}`,
        'XPORT:used:Disk Used (bytes)',
        'XPORT:percent:Disk Usage %',
      ];
      dsNames = ['used', 'percent'];
      break;

    case 'interface':
      if (!name) {
        return {
          timestamps: [],
          data: {},
          meta: { step: resolution, start, end: now, cf, dsNames: [], type, range },
        };
      }
      filePath = path.join(SYSTEM_RRD_DIR, `${name}.rrd`);
      defXportArgs = [
        `DEF:rx=${filePath}:rx:${cf}`,
        `DEF:tx=${filePath}:tx:${cf}`,
        'XPORT:rx:RX Bytes',
        'XPORT:tx:TX Bytes',
      ];
      dsNames = ['rx', 'tx'];
      break;

    default:
      return {
        timestamps: [],
        data: {},
        meta: { step: resolution, start, end: now, cf, dsNames: [], type, range },
      };
  }

  // File may not exist yet
  if (!fs.existsSync(filePath)) {
    return {
      timestamps: [],
      data: {},
      meta: { step: resolution, start, end: now, cf, dsNames, type, name: name || undefined, range },
    };
  }

  try {
    const args: string[] = [
      'xport',
      '--json',
      '--start', String(start),
      '--end', String(now),
      '--step', String(resolution),
      '--cf', cf,
      ...defXportArgs,
    ];

    const stdout = await rrdExec(args);
    const parsed = JSON.parse(stdout);

    const data: Record<string, number[]> = {};
    for (const dsName of dsNames) {
      data[dsName] = [];
    }

    const timestamps: number[] = [];

    if (parsed.data && Array.isArray(parsed.data)) {
      for (const row of parsed.data) {
        timestamps.push(row[0]);
        for (let i = 0; i < dsNames.length; i++) {
          const val = row[i + 1];
          data[dsNames[i]].push(val !== null && val !== undefined ? Number(val) : 0);
        }
      }
    }

    return {
      timestamps,
      data,
      meta: {
        step: resolution,
        start,
        end: now,
        cf,
        dsNames,
        type,
        name: name || undefined,
        range,
      },
    };
  } catch (err) {
    console.error(`[SystemRRD] Failed to fetch ${type} graph:`, err);
    return {
      timestamps: [],
      data: {},
      meta: { step: resolution, start, end: now, cf, dsNames, type, name: name || undefined, range },
    };
  }
}
